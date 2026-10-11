"""
Costs router: summary (cached) and per-resource cost history.

The summary endpoint does an expensive GROUP BY query, so results are
cached in Redis for ``summary_ttl_seconds`` (default 60s).  The cache
key includes all query parameters so different group_by/date combinations
get independent caches.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cache import cache_get, cache_set
from app.config import get_detection_config
from app.db import get_db
from app.models import Baseline, CostRecord, Resource
from app.schemas import (
    CostSummaryGroup,
    CostSummaryResponse,
    ResourceCostPoint,
    ResourceCostsResponse,
)
from app.security import Principal, require_roles

logger = logging.getLogger("ccad.costs")
router = APIRouter(prefix="/costs", tags=["Costs"])


@router.get(
    "/summary",
    response_model=CostSummaryResponse,
    summary="Get cost summary grouped by dimension (cached)",
)
def cost_summary(
    group_by: str = Query("service", description="Group by: service|region|team|resource_type"),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return cost totals grouped by the requested dimension.

    Results are cached in Redis for summary_ttl_seconds to avoid
    redundant GROUP BY queries under load.
    """
    # Build cache key from all parameters
    cache_params = f"{group_by}:{from_ts}:{to_ts}"
    cache_key = f"cost_summary:{hashlib.md5(cache_params.encode()).hexdigest()}"

    cached = cache_get(cache_key, cache_name="summary")
    if cached:
        return CostSummaryResponse(**cached, cached=True)

    # Map group_by to column
    group_col_map = {
        "service": Resource.service,
        "region": Resource.region,
        "team": Resource.team_tag,
        "resource_type": Resource.type,
    }
    if group_by not in group_col_map:
        raise HTTPException(status_code=400, detail=f"Invalid group_by: {group_by}")

    group_col = group_col_map[group_by]

    query = (
        db.query(
            group_col.label("group_name"),
            func.sum(CostRecord.cost).label("total_cost"),
            func.count(CostRecord.id).label("record_count"),
        )
        .join(Resource, CostRecord.resource_id == Resource.id)
    )

    if from_ts:
        query = query.filter(CostRecord.ts >= from_ts)
    if to_ts:
        query = query.filter(CostRecord.ts <= to_ts)

    rows = query.group_by(group_col).all()

    groups = [
        CostSummaryGroup(
            group=row.group_name or "unknown",
            total_cost=float(row.total_cost or 0),
            record_count=row.record_count,
        )
        for row in rows
    ]

    overall_total = sum(g.total_cost for g in groups)
    overall_count = sum(g.record_count for g in groups)

    result = CostSummaryResponse(
        group_by=group_by,
        groups=groups,
        overall_total=round(overall_total, 4),
        overall_count=overall_count,
        cached=False,
    )

    # Cache the result
    cfg = get_detection_config()
    ttl = cfg.get("cache", {}).get("summary_ttl_seconds", 60)
    cache_set(cache_key, result.model_dump(mode="json"), ttl, cache_name="summary")

    return result


@router.get(
    "/resources/{resource_id_str}/costs",
    response_model=ResourceCostsResponse,
    summary="Get cost history with baseline overlay for a resource",
)
def resource_costs(
    resource_id_str: str,
    hours: int = Query(72, ge=1, le=720, description="Number of hours of history"),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return the last N hours of cost data for a resource, with baseline
    mean/std for each hour_of_day so a frontend can overlay expected ranges.
    """
    resource = db.query(Resource).filter(Resource.resource_id == resource_id_str).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    records = (
        db.query(CostRecord)
        .filter(CostRecord.resource_id == resource.id, CostRecord.ts >= cutoff)
        .order_by(CostRecord.ts)
        .all()
    )

    # Load baselines for this resource
    baselines = {
        b.hour_of_day: b
        for b in db.query(Baseline).filter(Baseline.resource_id == resource.id).all()
    }

    points = []
    for rec in records:
        hour = rec.ts.hour
        bl = baselines.get(hour)
        points.append(ResourceCostPoint(
            ts=rec.ts,
            cost=float(rec.cost),
            usage_quantity=float(rec.usage_quantity),
            baseline_mean=bl.mean if bl else None,
            baseline_std=bl.std if bl and bl.n >= 2 else None,
        ))

    return ResourceCostsResponse(
        resource_id=resource_id_str,
        points=points,
    )
