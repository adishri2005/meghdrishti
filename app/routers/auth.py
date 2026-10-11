"""
Authentication router: login, registration, API client creation.

Security notes:
- Login is rate-limited (10/min per IP) to mitigate brute force.
- Passwords are bcrypt-hashed; the raw password never hits the DB.
- API keys are returned ONCE on creation; only the SHA-256 hash is stored.
- Every auth event (success or failure) is written to audit_logs.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ApiClient, User
from app.schemas import (
    ApiClientCreateRequest,
    ApiClientCreateResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.security import (
    Principal,
    audit,
    check_login_rate_limit,
    create_access_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    require_roles,
    verify_password,
)

logger = logging.getLogger("ccad.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate and receive a JWT",
    responses={401: {"description": "Invalid credentials"}, 429: {"description": "Rate limited"}},
)
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate with username/password and receive a JWT access token.

    Rate-limited to 10 attempts per minute per IP address.
    """
    await check_login_rate_limit(request)

    ip = request.client.host if request.client else None
    user = db.query(User).filter(User.username == body.username).first()

    if not user or not verify_password(body.password, user.password_hash):
        audit(db, actor=body.username, action="login", result="denied",
              ip=ip, detail={"reason": "invalid_credentials"})
        logger.warning(
            f"Login failed for {body.username}",
            extra={"event": "login_failed", "username": body.username},
        )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        audit(db, actor=body.username, action="login", result="denied",
              ip=ip, detail={"reason": "account_disabled"})
        raise HTTPException(status_code=401, detail="Account is disabled")

    token, expires_in = create_access_token(user.username, user.role)
    audit(db, actor=user.username, action="login", result="success", ip=ip)
    logger.info(
        f"Login success for {user.username}",
        extra={"event": "login_success", "username": user.username, "role": user.role},
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=user.role,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=201,
    summary="Register a new user (admin only)",
    responses={409: {"description": "Username already exists"}},
)
def register(
    body: RegisterRequest,
    request: Request,
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a new user account.  Only admins can register users."""
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    ip = request.client.host if request.client else None
    audit(db, actor=principal.name, action="register_user",
          entity="user", entity_id=str(user.id), ip=ip, result="success",
          detail={"username": body.username, "role": body.role})

    return RegisterResponse(id=user.id, username=user.username, role=user.role)


@router.post(
    "/api-clients",
    response_model=ApiClientCreateResponse,
    status_code=201,
    summary="Create an API client (admin only)",
)
def create_api_client(
    body: ApiClientCreateRequest,
    request: Request,
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a machine-to-machine API client.

    The API key is returned **once** in the response.  Only the SHA-256
    hash is stored — the key cannot be recovered later.
    """
    existing = db.query(ApiClient).filter(ApiClient.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="API client name already exists")

    raw_key = generate_api_key()
    client = ApiClient(
        name=body.name,
        api_key_hash=hash_api_key(raw_key),
        role="service",
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    ip = request.client.host if request.client else None
    audit(db, actor=principal.name, action="create_api_client",
          entity="api_client", entity_id=str(client.id), ip=ip, result="success",
          detail={"name": body.name})

    return ApiClientCreateResponse(id=client.id, name=client.name, api_key=raw_key)
