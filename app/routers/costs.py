"""
Costs router: summary (cached) and per-resource cost history.

The summary endpoint does an expensive GROUP BY query, so results are
cached in Redis for ``summary_ttl_seconds`` (default 60s).  The cache
key includes all query parameters so different group_by/date combinations
get independent caches.
"""

from __future__ import annotations

import hashlib
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

logger = logging.getLogger("meghdrishti.costs")
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


@router.get(
    "/timeseries",
    summary="Get cost time series grouped by dimension (stacked-chart ready)",
)
def cost_timeseries(
    group_by: str = Query("none", description="Group by: none|service|region|team|resource_type"),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    interval: str = Query("hour", pattern="^(hour|day)$"),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return time-series cost points grouped by dimension, ready for stacked area or line charts.
    Cached in Redis with 60s TTL.
    """
    cache_params = f"ts:{group_by}:{from_ts}:{to_ts}:{interval}"
    cache_key = f"cost_timeseries:{hashlib.md5(cache_params.encode()).hexdigest()}"
    cached = cache_get(cache_key, cache_name="summary")
    if cached:
        return cached

    group_col_map = {
        "service": Resource.service,
        "region": Resource.region,
        "team": Resource.team_tag,
        "resource_type": Resource.type,
    }

    # Query records
    query = db.query(CostRecord.ts, CostRecord.cost)
    has_group = group_by in group_col_map
    if has_group:
        col = group_col_map[group_by]
        query = db.query(CostRecord.ts, col.label("group_val"), CostRecord.cost).join(Resource, CostRecord.resource_id == Resource.id)

    if from_ts:
        query = query.filter(CostRecord.ts >= from_ts)
    if to_ts:
        query = query.filter(CostRecord.ts <= to_ts)

    rows = query.order_by(CostRecord.ts.asc()).all()

    # Bucket records by interval (hour or day) and group
    series_map: dict[str, dict[str, float]] = {}
    timestamps_set = set()

    for row in rows:
        ts: datetime = row[0]
        if interval == "day":
            ts_key = ts.strftime("%Y-%m-%d")
        else:
            ts_key = ts.strftime("%Y-%m-%dT%H:00:00Z")
        timestamps_set.add(ts_key)

        group_name = "total"
        cost_val = float(row[1]) if not has_group else float(row[2])
        if has_group:
            group_name = str(row[1] or "unknown")

        if group_name not in series_map:
            series_map[group_name] = {}
        series_map[group_name][ts_key] = series_map[group_name].get(ts_key, 0.0) + cost_val

    sorted_ts = sorted(timestamps_set)
    series_list = []
    for g_name, points_dict in sorted(series_map.items()):
        pts = [
            [ts_str, round(points_dict.get(ts_str, 0.0), 2)]
            for ts_str in sorted_ts
        ]
        series_list.append({"name": g_name, "points": pts})

    result = {
        "interval": interval,
        "timestamps": sorted_ts,
        "series": series_list,
    }

    cfg = get_detection_config()
    ttl = cfg.get("cache", {}).get("summary_ttl_seconds", 60)
    cache_set(cache_key, result, ttl, cache_name="summary")
    return result


@router.get(
    "/heatmap",
    summary="Get resource-by-hour-of-day cost heatmap matrix",
)
def cost_heatmap(
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return average cost matrix across resources and hours of day (0..23)."""
    # 1. Top 20 resources by total cost
    res_query = (
        db.query(Resource.id, Resource.resource_id, func.sum(CostRecord.cost).label("tot"))
        .join(CostRecord, CostRecord.resource_id == Resource.id)
    )
    if from_ts:
        res_query = res_query.filter(CostRecord.ts >= from_ts)
    if to_ts:
        res_query = res_query.filter(CostRecord.ts <= to_ts)

    top_resources = (
        res_query.group_by(Resource.id, Resource.resource_id)
        .order_by(func.sum(CostRecord.cost).desc())
        .limit(20)
        .all()
    )

    if not top_resources:
        # Fall back to all resources
        top_resources = db.query(Resource.id, Resource.resource_id, func.coalesce(func.sum(CostRecord.cost), 0)).outerjoin(CostRecord, CostRecord.resource_id == Resource.id).group_by(Resource.id, Resource.resource_id).limit(20).all()

    resource_names = [r[1] for r in top_resources]
    resource_id_to_idx = {r[0]: idx for idx, r in enumerate(top_resources)}

    # 2. Query baselines or cost records by hour of day
    hours = list(range(24))
    matrix = [[0.0 for _ in range(24)] for _ in range(len(top_resources))]

    # Use baselines for stable hour of day averages
    res_db_ids = [r[0] for r in top_resources]
    baselines = (
        db.query(Baseline.resource_id, Baseline.hour_of_day, Baseline.mean)
        .filter(Baseline.resource_id.in_(res_db_ids))
        .all()
    )
    for b in baselines:
        idx = resource_id_to_idx.get(b.resource_id)
        if idx is not None and 0 <= b.hour_of_day < 24:
            matrix[idx][b.hour_of_day] = round(float(b.mean), 2)

    # Coordinate list format for ECharts: [resource_idx, hour_idx, value]
    values = []
    for r_idx in range(len(resource_names)):
        for h_idx in range(24):
            val = matrix[r_idx][h_idx]
            values.append([r_idx, h_idx, val])

    return {
        "resources": resource_names,
        "hours": hours,
        "values": values,
        "matrix": matrix,
    }

