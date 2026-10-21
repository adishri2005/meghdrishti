"""
Audit logs router: query and inspect immutable security audit trail.

Allows administrators to review who performed actions (logins, threshold changes,
simulations, user registrations, and anomaly status transitions).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuditLog
from app.security import Principal, require_roles

logger = logging.getLogger("meghdrishti.audit_logs")
router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get(
    "",
    summary="Query audit log trail (admin only)",
)
def get_audit_logs(
    response: Response,
    actor: Optional[str] = Query(None, description="Filter by actor username"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    result: Optional[str] = Query(None, description="Filter by result (success, denied, error)"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="From timestamp"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="To timestamp"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Return paginated audit log entries ordered newest first."""
    query = db.query(AuditLog)

    if actor:
        query = query.filter(AuditLog.actor == actor)
    if action:
        query = query.filter(AuditLog.action == action)
    if result:
        query = query.filter(AuditLog.result == result)
    if from_ts:
        query = query.filter(AuditLog.ts >= from_ts)
    if to_ts:
        query = query.filter(AuditLog.ts <= to_ts)

    total_count = query.count()
    response.headers["X-Total-Count"] = str(total_count)

    logs = (
        query.order_by(AuditLog.ts.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log_entry.id,
            "actor": log_entry.actor,
            "action": log_entry.action,
            "entity": log_entry.entity,
            "entity_id": log_entry.entity_id,
            "ip": log_entry.ip,
            "result": log_entry.result,
            "detail": log_entry.detail,
            "ts": log_entry.ts.isoformat() if log_entry.ts else None,
        }
        for log_entry in logs
    ]
