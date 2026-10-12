"""
Records router: batch ingestion endpoint.

The ingestion endpoint is the entry point for cost data.  It validates
the batch, creates a job tracking row, pushes records to Redis Streams,
and returns immediately with a 202 — the worker processes asynchronously.
This decoupling means the API stays fast even under heavy load.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import IngestionJob
from app.queue import enqueue_records
from app.schemas import (
    BatchIngestRequest,
    BatchIngestResponse,
    JobStatusResponse,
)
from app.security import Principal, get_current_principal, require_ingest

logger = logging.getLogger("ccad.records")
router = APIRouter(prefix="/records", tags=["Ingestion"])


@router.post(
    "/batch",
    response_model=BatchIngestResponse,
    status_code=202,
    summary="Submit a batch of cost records for processing",
    responses={400: {"description": "Validation error"}},
)
def ingest_batch(
    body: BatchIngestRequest,
    principal: Principal = Depends(require_ingest()),
    db: Session = Depends(get_db),
):
    """Accept 1-5000 cost records and enqueue them for async processing.

    Returns 202 immediately with a job ID.  The worker picks up the
    records from the Redis stream and processes them in the background.
    """
    now = datetime.now(timezone.utc)
    max_future = now + timedelta(hours=1)

    # Validate timestamps
    for i, rec in enumerate(body.records):
        ts = rec.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts > max_future:
            raise HTTPException(
                status_code=400,
                detail=f"Record {i}: timestamp {ts.isoformat()} is more than 1 hour in the future",
            )

    # Create job
    job = IngestionJob(
        submitted_by=principal.name,
        record_count=len(body.records),
        status="queued",
        backfill=body.backfill,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue to Redis Stream
    records_dicts = [rec.model_dump(mode="json") for rec in body.records]
    enqueued = enqueue_records(records_dicts, str(job.id), backfill=body.backfill)

    logger.info(
        f"Batch accepted: {enqueued} records, job={job.id}",
        extra={
            "event": "batch_accepted",
            "job_id": str(job.id),
            "count": enqueued,
            "submitted_by": principal.name,
            "backfill": body.backfill,
        },
    )

    return BatchIngestResponse(
        job_id=str(job.id),
        accepted=enqueued,
        status="queued",
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    summary="Get ingestion job status",
)
def get_job_status(
    job_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    """Check the status and progress of an ingestion job."""
    import uuid
    try:
        job_uuid = uuid.UUID(job_id) if isinstance(job_id, str) else job_id
    except (ValueError, AttributeError):
        raise HTTPException(status_code=404, detail="Job not found") from None

    job = db.query(IngestionJob).filter(IngestionJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # IDOR check: non-admin users may only view their own submitted jobs
    if principal.role != "admin" and job.submitted_by != principal.name:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You can only view status of jobs submitted by your account",
        )

    return JobStatusResponse(
        id=str(job.id),
        submitted_by=job.submitted_by,
        record_count=job.record_count,
        processed_count=job.processed_count,
        failed_count=job.failed_count,
        status=job.status,
        backfill=job.backfill,
        created_at=job.created_at,
        finished_at=job.finished_at,
    )
