"""
Health and metrics endpoints (not under /api/v1).

The health endpoint serves dual duty:
- **Liveness**: "is the process running?" (always yes if this responds)
- **Readiness**: "can it serve traffic?" (only if DB and Redis are reachable)

The deploy script polls /health to gate cutover, and Nginx uses it for
upstream health checks.  Returning 503 when a dependency is down prevents
traffic from reaching a half-working instance.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.cache import redis_healthy
from app.config import get_settings
from app.schemas import HealthResponse, LivenessResponse

logger = logging.getLogger("ccad.health")

router = APIRouter(tags=["Health"])


@router.get(
    "/health/live",
    response_model=LivenessResponse,
    summary="Liveness probe (process responsiveness)",
)
def liveness_check():
    """Return 200 if application process is running and event loop is responsive."""
    settings = get_settings()
    return LivenessResponse(status="alive", version=settings.app_version)


@router.get(
    "/health/ready",
    response_model=HealthResponse,
    summary="Readiness probe (database and cache dependency readiness)",
    responses={503: {"description": "Service unavailable"}},
)
def readiness_check():
    """Return 200 if backing dependencies (PostgreSQL and Redis) are reachable, else 503."""
    return health_check()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check (liveness + readiness)",
    responses={503: {"description": "Service unavailable"}},
)
def health_check():
    """Return 200 if both PostgreSQL and Redis are reachable, else 503.

    The deploy script polls this endpoint to decide whether to cut over
    traffic to a new release.  Returning 503 blocks the cutover.
    """
    settings = get_settings()

    db_ok = False
    try:
        from app.db import get_engine
        with get_engine().connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            db_ok = True
    except Exception as exc:
        logger.warning(f"DB health check failed: {exc}",
                       extra={"event": "health_degraded", "component": "db"})

    redis_ok = redis_healthy()
    if not redis_ok:
        logger.warning("Redis health check failed",
                       extra={"event": "health_degraded", "component": "redis"})

    status = "ok" if (db_ok and redis_ok) else "degraded"
    code = 200 if (db_ok and redis_ok) else 503

    resp = HealthResponse(
        status=status,
        version=settings.app_version,
        color=settings.app_color,
        db=db_ok,
        redis=redis_ok,
    )

    if code == 503:
        return Response(
            content=resp.model_dump_json(),
            media_type="application/json",
            status_code=503,
        )
    return resp


@router.get(
    "/metrics",
    summary="Prometheus metrics",
    include_in_schema=False,
)
def prometheus_metrics():
    """Expose all registered Prometheus metrics in text format."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
