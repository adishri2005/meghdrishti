"""
FastAPI application factory with middleware, router mounting, and startup.

Middleware pipeline (order matters — outermost first):
1. Request-ID: assigns a UUID to every request, echoed in response header
   and injected into log context so all logs for one request correlate.
2. Timing: measures request duration, feeds the API latency histogram.
3. Request counter: counts requests by endpoint template and status code.
4. Fault injection: if FAULTY_RELEASE=true, 50% of non-health requests
   return 500 to simulate a bad release for the rollback demo.
"""

from __future__ import annotations

import logging
import random
import time
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.logging_setup import (
    request_id_var,
    request_role_var,
    request_user_var,
    setup_logging,
)
from app.metrics import API_LATENCY, API_REQUESTS, APP_VERSION_INFO

logger = logging.getLogger("ccad.main")


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    setup_logging()
    settings = get_settings()

    app = FastAPI(
        title="Cloud Cost Anomaly Detection API",
        description=(
            "REST API for ingesting cloud cost data, detecting anomalies "
            "using statistical methods (z-score, percentage jump, EWMA drift), "
            "and identifying the responsible resources."
        ),
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Set version metric
    APP_VERSION_INFO.labels(
        version=settings.app_version,
        color=settings.app_color,
    ).set(1)

    # --- Middleware ---
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(TimingMiddleware)
    if settings.faulty_release:
        app.add_middleware(FaultInjectionMiddleware)

    # --- Routers ---
    from app.routers.health import router as health_router
    from app.routers.auth import router as auth_router
    from app.routers.records import router as records_router
    from app.routers.anomalies import router as anomalies_router
    from app.routers.costs import router as costs_router
    from app.routers.config_router import router as config_router
    from app.routers.admin import router as admin_router
    from app.routers.stats import router as stats_router
    from app.routers.resources import router as resources_router
    from app.routers.jobs import router as jobs_router
    from app.routers.audit_logs import router as audit_logs_router

    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(records_router, prefix="/api/v1")
    app.include_router(anomalies_router, prefix="/api/v1")
    app.include_router(costs_router, prefix="/api/v1")
    app.include_router(config_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(stats_router, prefix="/api/v1")
    app.include_router(resources_router, prefix="/api/v1")
    app.include_router(jobs_router, prefix="/api/v1")
    app.include_router(audit_logs_router, prefix="/api/v1")

    # --- Exception handlers ---
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": 404, "message": "Not found"}},
        )

    @app.exception_handler(422)
    async def validation_handler(request: Request, exc):
        return JSONResponse(
            status_code=422,
            content={"error": {"code": 422, "message": str(exc)}},
        )

    logger.info(
        f"App started: version={settings.app_version}, color={settings.app_color}, "
        f"faulty={settings.faulty_release}",
    )

    return app


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assign a UUID to every request; echo it in the response header."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_var.set(rid)

        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """Measure request latency and update Prometheus metrics."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        # Use the route template (e.g. /api/v1/anomalies/{anomaly_id})
        # instead of the raw path to avoid cardinality explosion
        route = request.scope.get("path", request.url.path)
        if hasattr(request, "scope") and "route" in request.scope:
            r = request.scope["route"]
            if hasattr(r, "path"):
                route = r.path

        API_LATENCY.labels(endpoint=route).observe(duration)
        API_REQUESTS.labels(
            endpoint=route,
            method=request.method,
            status=str(response.status_code),
        ).inc()

        return response


class FaultInjectionMiddleware(BaseHTTPMiddleware):
    """Simulate a faulty release: 50% of non-health requests return 500.

    This is activated by setting FAULTY_RELEASE=true in the environment.
    /health and /metrics are exempted so the release passes the readiness
    gate but fails the post-cutover error-rate watch window.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        exempt = path in ("/health", "/metrics") or path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/openapi")

        if not exempt and random.random() < 0.5:
            logger.error(
                "Fault injected: returning 500",
                extra={"event": "fault_injected", "path": path},
            )
            return JSONResponse(
                status_code=500,
                content={"error": {"code": 500, "message": "Internal server error (fault injected)"}},
                headers={"X-Request-ID": request_id_var.get("")},
            )

        return await call_next(request)


# Create the app instance for gunicorn/uvicorn
app = create_app()
