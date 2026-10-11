"""
SQLAlchemy engine and session management.

Why a scoped, dependency-injected session: each FastAPI request gets its own
DB session via ``get_db()``, ensuring transactions are isolated and the
connection is returned to the pool after the response.  The worker uses the
same factory but manages its own lifecycle (one session per batch).
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_engine():
    """Return the singleton SQLAlchemy engine (lazy-initialised)."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=300,
        )
    return _engine


def get_session_factory() -> sessionmaker:
    """Return the session factory bound to the engine."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine()
        )
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables() -> None:
    """Create all tables (used only in tests — production uses Alembic)."""
    Base.metadata.create_all(bind=get_engine())
