"""
Resources router: list and detail endpoints with real-time stats and baselines.

Provides resource metrics (last cost, 24h cost, baseline mean, open anomalies,
status: normal/warning/anomalous), cost history bands, and hourly baseline charts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Anomaly, Baseline, CostRecord, Resource
from app.security import Principal, require_roles

logger = logging.getLogger("ccad.resources")
router = APIRouter(prefix="/resources", tags=["Resources"])


@router.get(
    "",
    summary="List resources with filters, sorting, and aggregated metrics",
)
def list_resources(
    response: Response,
    search: Optional[str] = Query(None, description="Search by resource_id"),
    team: Optional[str] = Query(None, description="Filter by team"),
    service: Optional[str] = Query(None, description="Filter by service"),
    region: Optional[str] = Query(None, description="Filter by region"),
    type: Optional[str] = Query(None, description="Filter by resource type"),
    sort: Optional[str] = Query("cost_24h_desc", description="Sort order"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return resources matching filters along with last_cost, 24h cost, baseline, and status."""
    query = db.query(Resource)

    if search:
        query = query.filter(Resource.resource_id.ilike(f"%{search}%"))
    if team:
        query = query.filter(Resource.team_tag == team)
    if service:
        query = query.filter(Resource.service == service)
    if region:
        query = query.filter(Resource.region == region)
    if type:
        query = query.filter(Resource.type == type)

    total_count = query.count()
    response.headers["X-Total-Count"] = str(total_count)

    now = datetime.now(timezone.utc)
    current_hour = now.hour
    t_24h_ago = now - timedelta(hours=24)

    # Parse sort parameter
    reverse = True
    if sort:
        if sort.endswith("_asc"):
            reverse = False
            key_name = sort[:-4]
        elif sort.endswith("_desc"):
            reverse = True
            key_name = sort[:-5]
        else:
            key_name = sort
    else:
        key_name = "cost_24h"

    db_sort_columns = {
        "resource_id": Resource.resource_id,
        "first_seen": Resource.first_seen,
        "service": Resource.service,
        "region": Resource.region,
        "type": Resource.type,
    }

    if key_name in db_sort_columns:
        col = db_sort_columns[key_name]
        order_expr = desc(col) if reverse else col
        resources = query.order_by(order_expr).offset(offset).limit(limit).all()
        is_db_sorted = True
    else:
        resources = query.all()
        is_db_sorted = False

    # Pre-fetch recent data for selected resources to avoid N+1 queries
    res_ids = [r.id for r in resources]

    # Open anomalies per resource
    open_anomalies_map: dict[int, int] = {}
    if res_ids:
        anomaly_counts = (
            db.query(Anomaly.resource_id, func.count(Anomaly.id))
            .filter(
                Anomaly.resource_id.in_(res_ids),
                Anomaly.status.in_(["open", "acknowledged"]),
            )
            .group_by(Anomaly.resource_id)
            .all()
        )
        for rid, cnt in anomaly_counts:
            if rid:
                open_anomalies_map[rid] = cnt

    # 24h costs
    cost_24h_map: dict[int, float] = {}
    if res_ids:
        costs_24h = (
            db.query(CostRecord.resource_id, func.sum(CostRecord.cost))
            .filter(
                CostRecord.resource_id.in_(res_ids),
                CostRecord.ts >= t_24h_ago,
            )
            .group_by(CostRecord.resource_id)
            .all()
        )
        for rid, csum in costs_24h:
            cost_24h_map[rid] = round(float(csum or 0.0), 2)

    # Current hour baseline
    baseline_map: dict[int, float] = {}
    if res_ids:
        baselines = (
            db.query(Baseline.resource_id, Baseline.mean)
            .filter(
                Baseline.resource_id.in_(res_ids),
                Baseline.hour_of_day == current_hour,
            )
            .all()
        )
        for rid, mean in baselines:
            baseline_map[rid] = round(float(mean or 0.0), 2)

    # Most recent cost
    last_cost_map: dict[int, float] = {}
    if res_ids:
        latest_subq = (
            db.query(CostRecord.resource_id, func.max(CostRecord.ts).label("max_ts"))
            .filter(CostRecord.resource_id.in_(res_ids))
            .group_by(CostRecord.resource_id)
            .subquery()
        )
        latest_records = (
            db.query(CostRecord.resource_id, CostRecord.cost)
            .join(
                latest_subq,
                (CostRecord.resource_id == latest_subq.c.resource_id)
                & (CostRecord.ts == latest_subq.c.max_ts),
            )
            .all()
        )
        for rid, c in latest_records:
            last_cost_map[rid] = round(float(c or 0.0), 2)

    rows = []
    for r in resources:
        open_anom = open_anomalies_map.get(r.id, 0)
        c24 = cost_24h_map.get(r.id, 0.0)
        lcost = last_cost_map.get(r.id, 0.0)
        base_now = baseline_map.get(r.id, 0.0)

        # Determine status: anomalous (has open anomalies), warning (cost > baseline * 1.5), normal
        if open_anom > 0:
            status = "anomalous"
        elif base_now > 0 and lcost > (base_now * 1.5):
            status = "warning"
        else:
            status = "normal"

        rows.append({
            "id": r.id,
            "resource_id": r.resource_id,
            "type": r.type,
            "service": r.service,
            "region": r.region,
            "team": r.team_tag,
            "first_seen": r.first_seen.isoformat() if r.first_seen else None,
            "last_cost": lcost,
            "baseline_mean_now": base_now,
            "cost_24h": c24,
            "open_anomalies": open_anom,
            "status": status,
        })

    if is_db_sorted:
        return rows

    # Sort computed metrics in memory
    if key_name in ("cost_24h", "last_cost", "baseline_mean_now", "open_anomalies"):
        rows.sort(key=lambda x: x.get(key_name, 0), reverse=reverse)
    elif key_name == "status":
        order = {"anomalous": 0, "warning": 1, "normal": 2}
        rows.sort(key=lambda x: order.get(x.get("status"), 3), reverse=reverse)
    else:
        rows.sort(key=lambda x: x.get("cost_24h", 0), reverse=True)

    return rows[offset : offset + limit]


@router.get(
    "/{resource_id}",
    summary="Get detailed resource info and summary stats",
)
def get_resource_detail(
    resource_id: str,
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Look up a resource by DB id or resource string identifier."""
    res = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not res:
        try:
            res = db.query(Resource).filter(Resource.id == int(resource_id)).first()
        except ValueError:
            pass

    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    now = datetime.now(timezone.utc)
    t_24h_ago = now - timedelta(hours=24)
    t_48h_ago = now - timedelta(hours=48)

    # 24h cost & previous 24h cost
    c24 = (
        db.query(func.sum(CostRecord.cost))
        .filter(CostRecord.resource_id == res.id, CostRecord.ts >= t_24h_ago)
        .scalar()
        or 0.0
    )
    c_prev = (
        db.query(func.sum(CostRecord.cost))
        .filter(
            CostRecord.resource_id == res.id,
            CostRecord.ts >= t_48h_ago,
            CostRecord.ts < t_24h_ago,
        )
        .scalar()
        or 0.0
    )

    open_anomalies_cnt = (
        db.query(func.count(Anomaly.id))
        .filter(Anomaly.resource_id == res.id, Anomaly.status.in_(["open", "acknowledged"]))
        .scalar()
        or 0
    )

    last_record = (
        db.query(CostRecord)
        .filter(CostRecord.resource_id == res.id)
        .order_by(CostRecord.ts.desc())
        .first()
    )

    base_now = (
        db.query(Baseline)
        .filter(Baseline.resource_id == res.id, Baseline.hour_of_day == now.hour)
        .first()
    )

    return {
        "id": res.id,
        "resource_id": res.resource_id,
        "type": res.type,
        "service": res.service,
        "region": res.region,
        "team": res.team_tag,
        "first_seen": res.first_seen.isoformat() if res.first_seen else None,
        "cost_24h": round(float(c24), 2),
        "cost_prev_24h": round(float(c_prev), 2),
        "cost_change_pct": round(((c24 - c_prev) / c_prev * 100), 2) if c_prev > 0 else 0.0,
        "last_cost": round(float(last_record.cost), 2) if last_record else 0.0,
        "last_seen": last_record.ts.isoformat() if last_record else None,
        "baseline_mean_now": round(float(base_now.mean), 2) if base_now else 0.0,
        "baseline_std_now": round(float(base_now.std), 2) if base_now else 0.0,
        "open_anomalies": open_anomalies_cnt,
        "status": "anomalous" if open_anomalies_cnt > 0 else "normal",
    }


@router.get(
    "/{resource_id}/costs",
    summary="Get cost time series and expected baseline band for a resource",
)
def get_resource_costs(
    resource_id: str,
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return historical hourly costs along with hourly baseline mean and +/- 3 std band."""
    res = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not res:
        try:
            res = db.query(Resource).filter(Resource.id == int(resource_id)).first()
        except ValueError:
            pass
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    to_ts = to_ts or datetime.now(timezone.utc)
    from_ts = from_ts or (to_ts - timedelta(days=7))

    records = (
        db.query(CostRecord)
        .filter(
            CostRecord.resource_id == res.id,
            CostRecord.ts >= from_ts,
            CostRecord.ts <= to_ts,
        )
        .order_by(CostRecord.ts.asc())
        .all()
    )

    baselines = db.query(Baseline).filter(Baseline.resource_id == res.id).all()
    base_dict = {b.hour_of_day: b for b in baselines}

    points = []
    for r in records:
        hour = r.ts.hour
        base = base_dict.get(hour)
        mean = base.mean if base else 0.0
        std = base.std if base else 0.0
        points.append({
            "ts": r.ts.isoformat(),
            "cost": round(float(r.cost), 4),
            "expected_mean": round(float(mean), 4),
            "expected_lower": round(max(float(mean - 3 * std), 0.0), 4),
            "expected_upper": round(float(mean + 3 * std), 4),
        })

    return {
        "resource_id": res.resource_id,
        "from": from_ts.isoformat(),
        "to": to_ts.isoformat(),
        "points": points,
    }


@router.get(
    "/{resource_id}/baseline",
    summary="Get 24-hour baseline profile (mean and std whiskers) for a resource",
)
def get_resource_baseline(
    resource_id: str,
    principal: Principal = Depends(require_roles("admin", "analyst")),
    db: Session = Depends(get_db),
):
    """Return the 24 hourly baseline means and std deviations for the resource."""
    res = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    if not res:
        try:
            res = db.query(Resource).filter(Resource.id == int(resource_id)).first()
        except ValueError:
            pass
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")

    baselines = db.query(Baseline).filter(Baseline.resource_id == res.id).order_by(Baseline.hour_of_day.asc()).all()
    base_map = {b.hour_of_day: b for b in baselines}

    hourly_profile = []
    for h in range(24):
        b = base_map.get(h)
        mean = round(b.mean, 4) if b else 0.0
        std = round(b.std, 4) if b else 0.0
        n = b.n if b else 0
        hourly_profile.append({
            "hour": h,
            "mean": mean,
            "std": std,
            "samples": n,
            "min_band": round(max(mean - 3 * std, 0.0), 4),
            "max_band": round(mean + 3 * std, 4),
        })

    return {
        "resource_id": res.resource_id,
        "hours": hourly_profile,
    }
