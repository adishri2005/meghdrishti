"""
Anomalies router: list, detail, and status updates.

Analysts and admins can browse detected anomalies, view root-cause details,
and change status (acknowledge or resolve).  Every status change is
audit-logged so there's a clear trail of who handled each incident.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Alert, Anomaly, Resource
from app.schemas import (
    AlertOut,
    AnomalyDetail,
    AnomalyOut,
    AnomalyPatchRequest,
)
from app.security import Principal, audit, require_roles

logger = logging.getLogger("ccad.anomalies")
router = APIRouter(prefix="/anomalies", tags=["Anomalies"])


@router.get(
    "",
    response_model=list[AnomalyOut],
    summary="List anomalies with filters",
)
def list_anomalies(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    resource_id: Optional[int] = Query(None, description="Filter by resource DB ID"),
    scope: Optional[str] = Query(None, description="Filter by scope (resource|aggregate)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="From timestamp"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="To timestamp"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """List anomalies sorted by detected_at descending, with optional filters."""
    query = db.query(Anomaly).outerjoin(Resource, Anomaly.resource_id == Resource.id)

    if severity:
        query = query.filter(Anomaly.severity == severity)
    if status:
        query = query.filter(Anomaly.status == status)
    if resource_id:
        query = query.filter(Anomaly.resource_id == resource_id)
    if scope:
        query = query.filter(Anomaly.scope == scope)
    if from_ts:
        query = query.filter(Anomaly.detected_at >= from_ts)
    if to_ts:
        query = query.filter(Anomaly.detected_at <= to_ts)

    anomalies = (
        query.order_by(Anomaly.detected_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for a in anomalies:
        res_name = None
        if a.resource_id:
            res = db.query(Resource).filter(Resource.id == a.resource_id).first()
            res_name = res.resource_id if res else None

        results.append(AnomalyOut(
            id=a.id,
            scope=a.scope,
            resource_id=a.resource_id,
            resource_name=res_name,
            detected_at=a.detected_at,
            record_ts=a.record_ts,
            observed_cost=a.observed_cost,
            expected_cost=a.expected_cost,
            z_score=a.z_score,
            pct_increase=a.pct_increase,
            severity=a.severity,
            method=a.method,
            root_cause_summary=a.root_cause_summary,
            status=a.status,
            occurrences=a.occurrences,
            peak_cost=a.peak_cost,
            last_seen_ts=a.last_seen_ts,
        ))

    return results


@router.get(
    "/{anomaly_id}",
    response_model=AnomalyDetail,
    summary="Get anomaly detail with root cause and alerts",
)
def get_anomaly_detail(
    anomaly_id: int,
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return full anomaly detail including root_cause JSON and related alerts."""
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    res_name = None
    if anomaly.resource_id:
        res = db.query(Resource).filter(Resource.id == anomaly.resource_id).first()
        res_name = res.resource_id if res else None

    alerts = db.query(Alert).filter(Alert.anomaly_id == anomaly.id).all()
    alert_outs = [
        AlertOut(
            id=a.id,
            channel=a.channel,
            sent_at=a.sent_at,
            delivery_status=a.delivery_status,
            detail=a.detail,
        )
        for a in alerts
    ]

    return AnomalyDetail(
        id=anomaly.id,
        scope=anomaly.scope,
        resource_id=anomaly.resource_id,
        resource_name=res_name,
        detected_at=anomaly.detected_at,
        record_ts=anomaly.record_ts,
        observed_cost=anomaly.observed_cost,
        expected_cost=anomaly.expected_cost,
        z_score=anomaly.z_score,
        pct_increase=anomaly.pct_increase,
        severity=anomaly.severity,
        method=anomaly.method,
        root_cause_summary=anomaly.root_cause_summary,
        root_cause=anomaly.root_cause,
        status=anomaly.status,
        occurrences=anomaly.occurrences,
        peak_cost=anomaly.peak_cost,
        last_seen_ts=anomaly.last_seen_ts,
        alerts=alert_outs,
    )


@router.patch(
    "/{anomaly_id}",
    response_model=AnomalyOut,
    summary="Update anomaly status (acknowledge or resolve)",
)
def patch_anomaly(
    anomaly_id: int,
    body: AnomalyPatchRequest,
    request=None,
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Change an anomaly's status to acknowledged or resolved.

    Writes an audit log entry so there's a record of who handled each incident.
    """
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    old_status = anomaly.status
    anomaly.status = body.status
    if body.status in ("acknowledged", "resolved"):
        anomaly.acknowledged_by = principal.name

    db.commit()

    audit(
        db,
        actor=principal.name,
        action="anomaly_status_changed",
        entity="anomaly",
        entity_id=str(anomaly.id),
        result="success",
        detail={"old_status": old_status, "new_status": body.status},
    )

    logger.info(
        f"Anomaly {anomaly.id} status changed: {old_status} -> {body.status}",
        extra={
            "event": "anomaly_status_changed",
            "anomaly_id": anomaly.id,
            "old_status": old_status,
            "new_status": body.status,
            "actor": principal.name,
        },
    )

    res_name = None
    if anomaly.resource_id:
        res = db.query(Resource).filter(Resource.id == anomaly.resource_id).first()
        res_name = res.resource_id if res else None

    return AnomalyOut(
        id=anomaly.id,
        scope=anomaly.scope,
        resource_id=anomaly.resource_id,
        resource_name=res_name,
        detected_at=anomaly.detected_at,
        record_ts=anomaly.record_ts,
        observed_cost=anomaly.observed_cost,
        expected_cost=anomaly.expected_cost,
        z_score=anomaly.z_score,
        pct_increase=anomaly.pct_increase,
        severity=anomaly.severity,
        method=anomaly.method,
        root_cause_summary=anomaly.root_cause_summary,
        status=anomaly.status,
        occurrences=anomaly.occurrences,
        peak_cost=anomaly.peak_cost,
        last_seen_ts=anomaly.last_seen_ts,
    )
