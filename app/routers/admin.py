"""
Admin router: simulation and deployment tracking endpoints.

The /admin/simulate endpoint is the primary way to inject test data and
anomalies into the system.  It uses the same code paths as real ingestion
(queue → worker → detection) so the demo exercises the full pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Deployment, GroundTruthAnomaly, IngestionJob
from app.queue import enqueue_records
from app.schemas import (
    DeploymentCreate,
    DeploymentOut,
    SimulateRequest,
    SimulateResponse,
)
from app.security import Principal, audit, require_roles
from app.simulator.generator import generate_hours

logger = logging.getLogger("ccad.admin")
_APP_START_TIME = time.time()
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post(
    "/simulate",
    response_model=SimulateResponse,
    status_code=202,
    summary="Generate simulated cost data with optional anomaly injection",
)
def simulate(
    body: SimulateRequest,
    request: Request,
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Generate cost records for the whole catalog and enqueue them.

    Optionally inject a spike, drift, or new_resource anomaly.  Ground
    truth entries are written to ``ground_truth_anomalies`` so detection
    quality can be evaluated.
    """
    start = body.start_time or datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    records, ground_truths = generate_hours(
        start=start,
        hours=body.hours,
        inject=body.inject,
        inject_resource_id=body.resource_id,
        multiplier=body.multiplier,
    )

    # Write ground truth entries
    for gt in ground_truths:
        db.add(GroundTruthAnomaly(
            resource_id=gt.resource_id,
            kind=gt.kind,
            start_ts=gt.start_ts,
            end_ts=gt.end_ts,
            multiplier=gt.multiplier,
        ))

    # Batch into chunks of 500 and create jobs
    job_ids = []
    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        job = IngestionJob(
            submitted_by=principal.name,
            record_count=len(batch),
            status="queued",
            backfill=body.backfill,
        )
        db.add(job)
        db.flush()
        enqueue_records(batch, str(job.id), backfill=body.backfill)
        job_ids.append(str(job.id))

    db.commit()

    injection_info = None
    if body.inject:
        injection_info = {
            "kind": body.inject,
            "resource_id": body.resource_id or (ground_truths[0].resource_id if ground_truths else None),
            "multiplier": body.multiplier,
            "ground_truths": len(ground_truths),
        }

    ip = request.client.host if request.client else None
    audit(
        db,
        actor=principal.name,
        action="simulate",
        ip=ip,
        result="success",
        detail={
            "hours": body.hours,
            "inject": body.inject,
            "records": len(records),
            "jobs": len(job_ids),
        },
    )

    logger.info(
        f"Simulation: {len(records)} records, {len(ground_truths)} ground truths",
        extra={
            "event": "simulate",
            "records": len(records),
            "inject": body.inject,
        },
    )

    return SimulateResponse(
        job_ids=job_ids,
        records_generated=len(records),
        injection=injection_info,
    )


@router.post(
    "/deployments",
    response_model=DeploymentOut,
    status_code=201,
    summary="Record a deployment event",
)
def create_deployment(
    body: DeploymentCreate,
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Insert a deployment record (called by deploy/rollback scripts)."""
    dep = Deployment(
        version=body.version,
        color=body.color,
        status=body.status,
        note=body.note,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)

    return DeploymentOut(
        id=dep.id,
        version=dep.version,
        color=dep.color,
        status=dep.status,
        deployed_at=dep.deployed_at,
        activated_at=dep.activated_at,
        rolled_back_at=dep.rolled_back_at,
        note=dep.note,
    )


@router.get(
    "/deployments",
    summary="List deployment history",
)
def list_deployments(
    limit: int = Query(50, ge=1, le=200),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return past deployment and rollback events ordered newest first."""
    deps = db.query(Deployment).order_by(Deployment.deployed_at.desc()).limit(limit).all()
    return [
        {
            "id": d.id,
            "version": d.version,
            "color": d.color,
            "status": d.status,
            "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
            "activated_at": d.activated_at.isoformat() if d.activated_at else None,
            "rolled_back_at": d.rolled_back_at.isoformat() if d.rolled_back_at else None,
            "note": d.note,
        }
        for d in deps
    ]


@router.get(
    "/deployments/current",
    summary="Get active deployment info and uptime",
)
def get_current_deployment(
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return currently active version, color, and uptime."""
    settings = get_settings()
    active_dep = (
        db.query(Deployment)
        .filter(Deployment.status.in_(["active", "deployed"]))
        .order_by(Deployment.deployed_at.desc())
        .first()
    )

    uptime_s = round(time.time() - _APP_START_TIME, 1)

    return {
        "version": active_dep.version if active_dep else settings.app_version,
        "color": active_dep.color if active_dep else settings.app_color,
        "status": active_dep.status if active_dep else "active",
        "deployed_at": active_dep.deployed_at.isoformat() if active_dep and active_dep.deployed_at else None,
        "activated_at": active_dep.activated_at.isoformat() if active_dep and active_dep.activated_at else None,
        "uptime_seconds": uptime_s,
    }


@router.get(
    "/logs",
    summary="Read application log tail with server-side filtering (admin only)",
)
def get_logs(
    level: Optional[str] = Query(None, description="Filter by level (DEBUG, INFO, WARNING, ERROR)"),
    event: Optional[str] = Query(None, description="Filter by event name"),
    q: Optional[str] = Query(None, description="Free text substring search"),
    request_id: Optional[str] = Query(None, description="Filter by request_id"),
    since: Optional[datetime] = Query(None, description="Filter logs since timestamp"),
    limit: int = Query(200, ge=1, le=1000),
    principal: Principal = Depends(require_roles("admin")),
):
    """Read the tail of the application JSON log file up to 5 MB, filter and return newest first."""
    settings = get_settings()
    log_path = Path(settings.log_file)
    if not log_path.exists():
        return []

    try:
        file_size = log_path.stat().st_size
        read_size = min(file_size, 5 * 1024 * 1024)  # 5 MB max
        with open(log_path, "rb") as f:
            if file_size > read_size:
                f.seek(file_size - read_size)
            raw_bytes = f.read()

        text = raw_bytes.decode("utf-8", errors="replace")
        lines = text.splitlines()

        # If we didn't read from start of file, the first line might be truncated
        if file_size > read_size and lines:
            lines.pop(0)

        parsed_records = []
        for line in reversed(lines):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                rec = json.loads(line_str)
            except Exception:
                # Raw text line fallback
                rec = {"timestamp": "", "level": "INFO", "message": line_str}

            # Filter level
            if level and rec.get("level", "").upper() != level.upper():
                continue
            # Filter event
            if event and rec.get("event") != event:
                continue
            # Filter request_id
            if request_id and rec.get("request_id") != request_id:
                continue
            # Filter free text query
            if q:
                q_lower = q.lower()
                msg = str(rec.get("message", "")).lower()
                evt = str(rec.get("event", "")).lower()
                logger_name = str(rec.get("logger", "")).lower()
                if q_lower not in msg and q_lower not in evt and q_lower not in logger_name:
                    continue
            # Filter since
            if since and rec.get("timestamp"):
                try:
                    ts = datetime.fromisoformat(rec["timestamp"].replace("Z", "+00:00"))
                    if ts < since:
                        continue
                except Exception:
                    pass

            parsed_records.append(rec)
            if len(parsed_records) >= limit:
                break

        return parsed_records
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        return []


@router.get(
    "/logs/stream",
    summary="Server-Sent Events real-time log tail (admin only)",
)
async def stream_logs(
    request: Request,
    principal: Principal = Depends(require_roles("admin")),
):
    """Tail the application log file and emit Server-Sent Events with heartbeat."""
    settings = get_settings()
    log_path = Path(settings.log_file)

    async def log_generator() -> AsyncGenerator[str, None]:
        # Yield initial connection confirmation
        yield ": connected\n\n"

        file_pos = 0
        if log_path.exists():
            file_pos = log_path.stat().st_size

        heartbeat_interval = 15.0
        last_heartbeat = time.time()

        while True:
            if await request.is_disconnected():
                break

            now = time.time()
            if now - last_heartbeat >= heartbeat_interval:
                yield ": heartbeat\n\n"
                last_heartbeat = now

            if log_path.exists():
                curr_size = log_path.stat().st_size
                if curr_size > file_pos:
                    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                        f.seek(file_pos)
                        new_text = f.read()
                        file_pos = f.tell()

                    for line in new_text.splitlines():
                        line_str = line.strip()
                        if line_str:
                            yield f"data: {line_str}\n\n"
                elif curr_size < file_pos:
                    # Log file was rotated
                    file_pos = 0

            await asyncio.sleep(0.5)

    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

