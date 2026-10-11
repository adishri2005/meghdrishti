"""
Config router: runtime threshold management.

Detection thresholds live in the ``settings`` database table.  This endpoint
lets admins read and update them without redeploying.  Every change is
audit-logged with the old and new values for accountability.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_detection_config, invalidate_detection_cache
from app.db import get_db
from app.models import SettingsRow
from app.schemas import ThresholdsResponse, ThresholdsUpdateRequest
from app.security import Principal, audit, require_roles

logger = logging.getLogger("ccad.config")
router = APIRouter(prefix="/config", tags=["Configuration"])


@router.get(
    "/thresholds",
    response_model=ThresholdsResponse,
    summary="Get current detection thresholds",
)
def get_thresholds(
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return the current detection and severity thresholds."""
    cfg = get_detection_config(db)
    return ThresholdsResponse(
        detection=cfg.get("detection", {}),
        severity=cfg.get("severity", {}),
    )


@router.put(
    "/thresholds",
    response_model=ThresholdsResponse,
    summary="Update detection thresholds (admin only)",
)
def update_thresholds(
    body: ThresholdsUpdateRequest,
    request: Request,
    principal: Principal = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Partially update detection and/or severity thresholds.

    Validates that numeric values are within sensible ranges, persists
    changes in the ``settings`` table, and audit-logs the old and new values.
    """
    old_cfg = get_detection_config(db)

    if body.detection:
        _validate_detection(body.detection)
        _upsert_setting(db, "detection", body.detection, old_cfg.get("detection", {}), principal.name)

    if body.severity:
        _upsert_setting(db, "severity", body.severity, old_cfg.get("severity", {}), principal.name)

    db.commit()
    invalidate_detection_cache()

    new_cfg = get_detection_config(db)

    ip = request.client.host if request.client else None
    audit(
        db,
        actor=principal.name,
        action="config_changed",
        entity="settings",
        ip=ip,
        result="success",
        detail={
            "old": {k: old_cfg.get(k) for k in ("detection", "severity")},
            "new": {k: new_cfg.get(k) for k in ("detection", "severity")},
        },
    )

    logger.info(
        "Detection thresholds updated",
        extra={"event": "config_changed", "actor": principal.name},
    )

    return ThresholdsResponse(
        detection=new_cfg.get("detection", {}),
        severity=new_cfg.get("severity", {}),
    )


def _validate_detection(det: dict) -> None:
    """Validate detection threshold ranges."""
    if "z_threshold" in det and (det["z_threshold"] <= 0 or det["z_threshold"] > 50):
        raise HTTPException(status_code=400, detail="z_threshold must be between 0 and 50")
    if "pct_jump_threshold" in det and (det["pct_jump_threshold"] <= 0 or det["pct_jump_threshold"] > 1000):
        raise HTTPException(status_code=400, detail="pct_jump_threshold must be between 0 and 1000")
    if "ewma_alpha" in det and (det["ewma_alpha"] <= 0 or det["ewma_alpha"] >= 1):
        raise HTTPException(status_code=400, detail="ewma_alpha must be between 0 and 1")
    if "min_samples" in det and (det["min_samples"] < 1 or det["min_samples"] > 1000):
        raise HTTPException(status_code=400, detail="min_samples must be between 1 and 1000")


def _upsert_setting(
    db: Session,
    key: str,
    new_values: dict,
    old_values: dict,
    updated_by: str,
) -> None:
    """Merge new values into the settings row for the given key."""
    row = db.query(SettingsRow).filter(SettingsRow.key == key).first()
    if row:
        merged = {**row.value, **new_values} if isinstance(row.value, dict) else new_values
        row.value = merged
        row.updated_by = updated_by
    else:
        merged = {**old_values, **new_values}
        db.add(SettingsRow(key=key, value=merged, updated_by=updated_by))
