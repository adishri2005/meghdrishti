"""
Jobs router: list and detail endpoints for ingestion jobs.

Allows operators to monitor batch ingestion status, progress, and errors.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import IngestionJob
from app.security import Principal, require_roles

logger = logging.getLogger("ccad.jobs")
router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get(
    "",
    summary="List recent ingestion jobs with status and progress",
)
def list_jobs(
    response: Response,
    status: Optional[str] = Query(None, description="Filter by status (queued|processing|done|failed)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return recent ingestion jobs ordered newest first."""
    query = db.query(IngestionJob)
    if status:
        query = query.filter(IngestionJob.status == status)

    total_count = query.count()
    response.headers["X-Total-Count"] = str(total_count)

    jobs = (
        query.order_by(IngestionJob.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for j in jobs:
        duration_s = None
        if j.finished_at and j.created_at:
            duration_s = round((j.finished_at - j.created_at).total_seconds(), 2)

        progress_pct = 0.0
        if j.record_count > 0:
            progress_pct = round(
                min(((j.processed_count + j.failed_count) / j.record_count) * 100, 100.0),
                1,
            )

        results.append({
            "id": str(j.id),
            "submitted_by": j.submitted_by,
            "record_count": j.record_count,
            "processed_count": j.processed_count,
            "failed_count": j.failed_count,
            "status": j.status,
            "backfill": j.backfill,
            "progress_pct": progress_pct,
            "duration_seconds": duration_s,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
        })

    return results


@router.get(
    "/{job_id}",
    summary="Get ingestion job details and live progress",
)
def get_job_detail(
    job_id: str,
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Get a single ingestion job by UUID for polling progress."""
    import uuid
    try:
        job_uuid = uuid.UUID(job_id) if isinstance(job_id, str) else job_id
    except (ValueError, AttributeError):
        raise HTTPException(status_code=404, detail="Ingestion job not found") from None

    job = db.query(IngestionJob).filter(IngestionJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")

    duration_s = None
    if job.finished_at and job.created_at:
        duration_s = round((job.finished_at - job.created_at).total_seconds(), 2)

    progress_pct = 0.0
    if job.record_count > 0:
        progress_pct = round(
            min(((job.processed_count + job.failed_count) / job.record_count) * 100, 100.0),
            1,
        )

    return {
        "id": str(job.id),
        "submitted_by": job.submitted_by,
        "record_count": job.record_count,
        "processed_count": job.processed_count,
        "failed_count": job.failed_count,
        "status": job.status,
        "backfill": job.backfill,
        "progress_pct": progress_pct,
        "duration_seconds": duration_s,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }
