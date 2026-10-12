"""
Authentication and authorization: JWT, API keys, RBAC dependencies.

Security design:
- JWT (HS256) for human users (admin, analyst) with short-lived tokens.
- API key for machine clients: the key itself is never stored; only its
  SHA-256 hash lives in the database, compared with ``hmac.compare_digest``
  to avoid timing attacks.
- Rate limiting on login: max 10 attempts/minute per IP using a Redis
  counter with EXPIRE, returning 429 when exceeded.
- RBAC is enforced through FastAPI dependency injection — each route
  declares which roles are allowed, and the dependency raises 401/403
  before the handler runs.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any, Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db

logger = logging.getLogger("ccad.security")

# ---------------------------------------------------------------------------
# Password hashing (bcrypt directly — passlib is broken on bcrypt>=4.1)
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# API key hashing (SHA-256)
# ---------------------------------------------------------------------------


def generate_api_key() -> str:
    """Generate a cryptographically random API key (32 bytes, URL-safe)."""
    return secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """Return the SHA-256 hex digest of an API key."""
    return hashlib.sha256(key.encode()).hexdigest()


def verify_api_key_hash(presented: str, stored_hash: str) -> bool:
    """Constant-time comparison of a presented key's hash against the stored hash."""
    presented_hash = hash_api_key(presented)
    return hmac.compare_digest(presented_hash, stored_hash)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


def create_access_token(sub: str, role: str) -> tuple[str, int]:
    """Create a signed JWT.  Returns (token_string, expires_in_seconds)."""
    settings = get_settings()
    expires_delta = timedelta(minutes=settings.jwt_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": sub, "role": role, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT.  Raises ``JWTError`` on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# ---------------------------------------------------------------------------
# Principal (the authenticated identity for a request)
# ---------------------------------------------------------------------------


@dataclass
class Principal:
    """Lightweight identity object available to request handlers."""

    name: str
    role: str
    kind: str  # "user" | "api_client"
    expires_at: Optional[int] = None


def get_client_ip(request: Request) -> str:
    """Extract client IP, prioritizing trusted reverse proxy header (X-Real-IP) over spoofable X-Forwarded-For."""
    real_ip = request.headers.get("X-Real-IP")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[0]

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# Login rate limiting (Redis counter per IP)
# ---------------------------------------------------------------------------


async def check_login_rate_limit(request: Request) -> None:
    """Raise 429 if the IP has exceeded 10 login attempts in the last minute.

    Uses a Redis INCR + EXPIRE pattern: the counter key includes the IP
    and auto-expires after 60 seconds, so the window slides naturally.
    """
    from app.cache import get_redis  # avoid circular import

    ip = get_client_ip(request)
    key = f"login_rate:{ip}"
    try:
        redis = get_redis()
        current = redis.incr(key)
        if current == 1:
            redis.expire(key, 60)
        else:
            # Prevent permanently locked key if redis crashed before expire
            ttl = redis.ttl(key)
            if ttl is None or ttl < 0:
                redis.expire(key, 60)
        if current > 10:
            logger.warning(
                "Rate limited login attempt",
                extra={"event": "rate_limited", "ip": ip},
            )
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    except HTTPException:
        raise
    except Exception:
        # If Redis is down, allow the attempt rather than locking everyone out
        pass


# ---------------------------------------------------------------------------
# Dependency: extract principal from JWT Bearer token
# ---------------------------------------------------------------------------


def _get_jwt_principal(request: Request, db: Session) -> Optional[Principal]:
    """Try to extract a principal from Authorization: Bearer header OR ccad_token cookie."""
    auth_header = request.headers.get("Authorization", "")
    token = None
    from_cookie = False

    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "ccad_token" in request.cookies:
        token = request.cookies.get("ccad_token")
        from_cookie = True

    if not token:
        return None

    # CSRF check: For state-changing requests authenticated by cookie, require X-Requested-With: CostGuard
    if from_cookie and request.method in ("POST", "PUT", "DELETE", "PATCH"):
        csrf = request.headers.get("X-Requested-With", "")
        if csrf != "CostGuard":
            raise HTTPException(
                status_code=403,
                detail="CSRF validation failed: missing or invalid X-Requested-With header",
            )

    try:
        payload = decode_access_token(token)
        username = payload.get("sub")
        role = payload.get("role")
        if not username or not role:
            return None

        # Verify the user still exists and is active
        from app.models import User

        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            return None
        # Bind role directly from current DB state to reflect any administrative updates immediately
        return Principal(
            name=user.username,
            role=user.role,
            kind="user",
            expires_at=payload.get("exp"),
        )
    except JWTError:
        return None


def _get_apikey_principal(request: Request, db: Session) -> Optional[Principal]:
    """Try to extract a principal from the X-API-Key header."""
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        return None

    from app.models import ApiClient

    key_hash = hash_api_key(api_key)
    client = db.query(ApiClient).filter(ApiClient.api_key_hash == key_hash).first()
    if client and client.is_active and verify_api_key_hash(api_key, client.api_key_hash):
        return Principal(name=client.name, role=client.role, kind="api_client")
    return None


def get_current_principal(
    request: Request, db: Session = Depends(get_db)
) -> Principal:
    """FastAPI dependency: return the authenticated principal or raise 401.

    Checks JWT first, then API key.
    """
    principal = _get_jwt_principal(request, db)
    if principal:
        return principal
    principal = _get_apikey_principal(request, db)
    if principal:
        return principal

    # Record the denied attempt
    _audit_denied(request, db, "unknown", "authenticate")
    raise HTTPException(status_code=401, detail="Not authenticated")


# ---------------------------------------------------------------------------
# RBAC dependency factory
# ---------------------------------------------------------------------------


def require_roles(*allowed_roles: str):
    """Return a FastAPI dependency that enforces role membership.

    Usage::

        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
        def admin_endpoint(): ...

    Or inject the principal::

        @router.get("/data")
        def get_data(principal: Principal = Depends(require_roles("admin", "analyst"))): ...
    """

    def _dependency(
        request: Request,
        principal: Principal = Depends(get_current_principal),
        db: Session = Depends(get_db),
    ) -> Principal:
        if principal.role not in allowed_roles:
            _audit_denied(request, db, principal.name, "access")
            raise HTTPException(
                status_code=403,
                detail=f"Role '{principal.role}' is not allowed. Required: {', '.join(allowed_roles)}",
            )
        return principal

    return _dependency


def require_ingest():
    """Dependency that accepts a ``service`` API key OR an ``admin`` JWT.

    The ingestion endpoint is used by automated pipelines (API key) but
    admins can also submit records manually.
    """

    def _dependency(
        request: Request,
        principal: Principal = Depends(get_current_principal),
        db: Session = Depends(get_db),
    ) -> Principal:
        if principal.role not in ("service", "admin"):
            _audit_denied(request, db, principal.name, "ingest")
            raise HTTPException(
                status_code=403,
                detail="Ingestion requires a service API key or admin role.",
            )
        return principal

    return _dependency


# ---------------------------------------------------------------------------
# Audit helper (writes to audit_logs table)
# ---------------------------------------------------------------------------


def audit(
    db: Session,
    actor: str,
    action: str,
    entity: str | None = None,
    entity_id: str | None = None,
    ip: str | None = None,
    result: str = "success",
    detail: dict | None = None,
) -> None:
    """Insert a row into the audit_logs table and log the event.

    This is the single audit entry point — every security-relevant action
    (login, registration, threshold change, denied access) flows through here.
    """
    from app.models import AuditLog  # avoid circular import

    log = AuditLog(
        actor=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        ip=ip,
        result=result,
        detail=detail,
    )
    db.add(log)
    # We commit here so audit logs are written even if the caller's
    # transaction rolls back (audit logs must never be lost)
    try:
        db.commit()
    except Exception:
        db.rollback()
        # At minimum, log to stdout
        logger.error(
            "Failed to write audit log",
            extra={"event": "audit_error", "actor": actor, "action": action},
        )

    log_level = logging.WARNING if result == "denied" else logging.INFO
    logger.log(
        log_level,
        f"Audit: {action}",
        extra={
            "event": f"audit_{action}",
            "actor": actor,
            "entity": entity,
            "entity_id": entity_id,
            "result": result,
        },
    )


def _audit_denied(request: Request, db: Session, actor: str, action: str) -> None:
    """Convenience: record a denied access attempt."""
    ip = get_client_ip(request)
    audit(db, actor=actor, action=action, ip=ip, result="denied")
