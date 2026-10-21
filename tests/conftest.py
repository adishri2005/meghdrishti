"""Test fixtures for Meghdrishti unit and integration tests."""

import pytest
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.db import Base, get_db
from app.main import create_app
from app.models import User
from app.security import create_access_token, hash_password

# Teach SQLite compiler how to render PostgreSQL-specific column types
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"


@compiles(BigInteger, "sqlite")
def compile_bigint_sqlite(type_, compiler, **kw):
    return "INTEGER"


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite session for testing database models and queries."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    # Pre-seed standard test user accounts
    admin_user = User(
        username="admin",
        password_hash=hash_password("Admin@12345"),
        role="admin",
        is_active=True,
    )
    analyst_user = User(
        username="analyst",
        password_hash=hash_password("Analyst@12345"),
        role="analyst",
        is_active=True,
    )
    disabled_user = User(
        username="disabled_user",
        password_hash=hash_password("Disabled@12345"),
        role="analyst",
        is_active=False,
    )
    session.add_all([admin_user, analyst_user, disabled_user])
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def admin_headers():
    token, _ = create_access_token("admin", "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def analyst_headers():
    token, _ = create_access_token("analyst", "analyst")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db_session):
    """FastAPI TestClient wired to the test SQLite database session."""
    app = create_app()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

