"""
Admin router: simulation and deployment tracking endpoints.

The /admin/simulate endpoint is the primary way to inject test data and
anomalies into the system.  It uses the same code paths as real ingestion
(queue → worker → detection) so the demo exercises the full pipeline.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

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
