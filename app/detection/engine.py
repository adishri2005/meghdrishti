"""
Detection engine — orchestrates rules on a batch of records.

This module bridges the pure detection functions and the database:
it loads baselines, runs rules, handles deduplication, creates anomaly
rows, and triggers alerts.  The worker calls ``process_batch()`` once
per batch of messages.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.cache import cache_get, cache_set, get_redis
from app.config import get_detection_config
from app.detection.baseline import BaselineStats, welford_update
from app.detection.root_cause import (
    AggregateResult,
    build_resource_root_cause,
    check_aggregate,
)
from app.detection.rules import DetectionConfig, Verdict, evaluate, make_detection_config
from app.metrics import ANOMALIES_DETECTED, DETECTION_DELAY
from app.models import Anomaly, Baseline, Resource, ResourceState

logger = logging.getLogger("ccad.detection")


def get_baseline_stats(
    db: Session, resource_db_id: int, hour: int, cfg_cache: dict
) -> BaselineStats:
    """Load baseline from Redis cache, falling back to DB."""
    cache_key = f"baseline:{resource_db_id}:{hour}"
    ttl = cfg_cache.get("cache", {}).get("baseline_ttl_seconds", 300)
    cached = cache_get(cache_key, cache_name="baseline")
    if cached:
        return BaselineStats(n=cached["n"], mean=cached["mean"], m2=cached["m2"])

    row = db.query(Baseline).filter(
        Baseline.resource_id == resource_db_id,
        Baseline.hour_of_day == hour,
    ).first()

    if row:
        stats = BaselineStats(n=row.n, mean=row.mean, m2=row.m2)
    else:
        stats = BaselineStats()

    cache_set(cache_key, {"n": stats.n, "mean": stats.mean, "m2": stats.m2}, ttl, "baseline")
    return stats


def save_baseline(
    db: Session, resource_db_id: int, hour: int, stats: BaselineStats, cfg_cache: dict
) -> None:
    """Persist updated baseline to DB and refresh the Redis cache."""
    row = db.query(Baseline).filter(
        Baseline.resource_id == resource_db_id,
        Baseline.hour_of_day == hour,
    ).first()
    if row:
        row.n = stats.n
        row.mean = stats.mean
        row.m2 = stats.m2
    else:
        db.add(Baseline(
            resource_id=resource_db_id,
            hour_of_day=hour,
            n=stats.n,
            mean=stats.mean,
            m2=stats.m2,
        ))

    cache_key = f"baseline:{resource_db_id}:{hour}"
    ttl = cfg_cache.get("cache", {}).get("baseline_ttl_seconds", 300)
    cache_set(cache_key, {"n": stats.n, "mean": stats.mean, "m2": stats.m2}, ttl, "baseline")


def get_or_create_resource_state(db: Session, resource_db_id: int) -> ResourceState:
    """Get or create the EWMA state row for a resource."""
    state = db.query(ResourceState).filter(
        ResourceState.resource_id == resource_db_id
    ).first()
    if not state:
        state = ResourceState(resource_id=resource_db_id, ewma_ratio=1.0)
        db.add(state)
        db.flush()
    return state


def system_has_history(db: Session) -> bool:
    """Check if the system has at least 24 hours of data (for new-resource detection)."""
    result = db.execute(
        text("SELECT MIN(ts) FROM cost_records")
    ).scalar()
    if result is None:
        return False
    if isinstance(result, str):
        result = datetime.fromisoformat(result)
    age = datetime.now(timezone.utc) - result.replace(tzinfo=timezone.utc) if result.tzinfo is None else datetime.now(timezone.utc) - result
    return age.total_seconds() > 24 * 3600


def dedup_anomaly(
    db: Session,
    resource_db_id: Optional[int],
    scope: str,
    record_ts: datetime,
    dedup_hours: int,
    cost: float,
    severity: str,
) -> Optional[Anomaly]:
    """Check for an existing open anomaly within the dedup window.

    Returns the existing anomaly if found (caller should update it),
    or None if a new anomaly should be created.
    """
    cutoff = record_ts - timedelta(hours=dedup_hours)
    query = db.query(Anomaly).filter(
        Anomaly.status == "open",
        Anomaly.last_seen_ts >= cutoff,
    )
    if scope == "resource" and resource_db_id is not None:
        query = query.filter(
            Anomaly.scope == "resource",
            Anomaly.resource_id == resource_db_id,
        )
    elif scope == "aggregate":
        query = query.filter(Anomaly.scope == "aggregate")
    else:
        return None

    existing = query.order_by(Anomaly.detected_at.desc()).first()
    return existing


def process_record(
    db: Session,
    resource_db_id: int,
    resource_id_str: str,
    cost: float,
    ts: datetime,
    resource_meta: dict[str, str],
    cfg_cache: dict,
    det_cfg: DetectionConfig,
    is_backfill: bool,
    enqueued_at: float,
    has_history: bool,
    is_new: bool,
) -> Optional[dict]:
    """Process a single record: update baseline, run detection, create anomaly.

    Returns a dict with record info for aggregate analysis, or None on error.
    """
    hour = ts.hour
    stats = get_baseline_stats(db, resource_db_id, hour, cfg_cache)
    state = get_or_create_resource_state(db, resource_db_id)

    if is_backfill:
        # Backfill: update baseline only, skip detection
        new_stats = welford_update(stats, cost)
        save_baseline(db, resource_db_id, hour, new_stats, cfg_cache)
        state.last_ts = ts
        return {
            "resource_id": resource_id_str,
            "resource_db_id": resource_db_id,
            "cost": cost,
            "mean": new_stats.mean if new_stats.n > 1 else None,
            "team": resource_meta.get("team_tag", ""),
            "service": resource_meta.get("service", ""),
            "region": resource_meta.get("region", ""),
        }

    # Run detection
    verdict = evaluate(
        cost=cost,
        baseline=stats,
        ewma_prev=state.ewma_ratio,
        cfg=det_cfg,
        is_new_resource=is_new,
        system_has_history=has_history,
    )

    # Update EWMA state
    if verdict.new_ewma is not None:
        state.ewma_ratio = verdict.new_ewma
    state.last_ts = ts

    # Update baseline only if normal (not anomalous)
    if not verdict.is_anomaly:
        new_stats = welford_update(stats, cost)
        save_baseline(db, resource_db_id, hour, new_stats, cfg_cache)
    else:
        # Record the anomaly
        dedup_hours = cfg_cache.get("detection", {}).get("dedup_window_hours", 6)
        existing = dedup_anomaly(
            db, resource_db_id, "resource", ts, dedup_hours, cost, verdict.severity
        )

        rc = build_resource_root_cause(
            resource_id=resource_id_str,
            cost=cost,
            expected=verdict.expected or 0,
            team=resource_meta.get("team_tag", ""),
            service=resource_meta.get("service", ""),
            region=resource_meta.get("region", ""),
        )

        if existing:
            # Deduplicate: update existing anomaly
            existing.occurrences += 1
            existing.peak_cost = max(existing.peak_cost or 0, cost)
            existing.last_seen_ts = ts
            severity_escalated = False
            severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
            if severity_rank.get(verdict.severity, 0) > severity_rank.get(existing.severity, 0):
                existing.severity = verdict.severity
                severity_escalated = True

            if severity_escalated:
                _create_alert(db, existing, enqueued_at)
        else:
            anomaly = Anomaly(
                scope="resource",
                resource_id=resource_db_id,
                record_ts=ts,
                observed_cost=cost,
                expected_cost=verdict.expected or 0,
                z_score=verdict.z_score,
                pct_increase=verdict.pct_increase,
                severity=verdict.severity,
                method=verdict.method,
                root_cause_summary=rc["summary"],
                root_cause=rc["root_cause"],
                peak_cost=cost,
                last_seen_ts=ts,
            )
            db.add(anomaly)
            db.flush()

            ANOMALIES_DETECTED.labels(
                severity=verdict.severity, method=verdict.method
            ).inc()

            delay = time.time() - enqueued_at
            DETECTION_DELAY.observe(delay)

            logger.warning(
                f"Anomaly detected: {resource_id_str} {verdict.method} "
                f"z={verdict.z_score} pct={verdict.pct_increase} severity={verdict.severity}",
                extra={
                    "event": "anomaly_detected",
                    "resource_id": resource_id_str,
                    "method": verdict.method,
                    "severity": verdict.severity,
                    "z_score": verdict.z_score,
                    "pct_increase": verdict.pct_increase,
                },
            )

            _create_alert(db, anomaly, enqueued_at)

    return {
        "resource_id": resource_id_str,
        "resource_db_id": resource_db_id,
        "cost": cost,
        "mean": stats.mean if stats.n > 0 else None,
        "team": resource_meta.get("team_tag", ""),
        "service": resource_meta.get("service", ""),
        "region": resource_meta.get("region", ""),
    }


def process_aggregate(
    db: Session,
    hour_records: list[dict],
    hour_ts: datetime,
    cfg_cache: dict,
    enqueued_at: float,
) -> None:
    """Check for aggregate anomaly across all resources for one hour."""
    threshold = cfg_cache.get("detection", {}).get("aggregate_pct_threshold", 50.0)
    result = check_aggregate(
        hour_records, threshold, hour_ts=str(hour_ts)
    )
    if result is None:
        return

    dedup_hours = cfg_cache.get("detection", {}).get("dedup_window_hours", 6)
    existing = dedup_anomaly(db, None, "aggregate", hour_ts, dedup_hours, result.observed_total, "high")

    severity = "high" if result.pct_increase >= 150 else "medium"
    if result.pct_increase >= 300:
        severity = "critical"

    rc_data = {
        "top_contributors": [
            {"resource_id": c.resource_id, "delta": c.delta, "share_pct": c.share_pct,
             "team": c.team, "service": c.service, "region": c.region}
            for c in result.top_contributors
        ],
        "group_by_team": result.group_by_team,
        "group_by_service": result.group_by_service,
        "group_by_region": result.group_by_region,
    }

    if existing:
        existing.occurrences += 1
        existing.peak_cost = max(existing.peak_cost or 0, result.observed_total)
        existing.last_seen_ts = hour_ts
    else:
        anomaly = Anomaly(
            scope="aggregate",
            resource_id=None,
            record_ts=hour_ts,
            observed_cost=result.observed_total,
            expected_cost=result.expected_total,
            z_score=None,
            pct_increase=result.pct_increase,
            severity=severity,
            method="aggregate_jump",
            root_cause_summary=result.summary,
            root_cause=rc_data,
            peak_cost=result.observed_total,
            last_seen_ts=hour_ts,
        )
        db.add(anomaly)
        db.flush()

        ANOMALIES_DETECTED.labels(severity=severity, method="aggregate_jump").inc()

        delay = time.time() - enqueued_at
        DETECTION_DELAY.observe(delay)

        logger.warning(
            f"Aggregate anomaly: +{result.pct_increase:.0f}% at {hour_ts}",
            extra={
                "event": "anomaly_detected",
                "scope": "aggregate",
                "pct_increase": result.pct_increase,
            },
        )

        _create_alert(db, anomaly, enqueued_at)


def _create_alert(db: Session, anomaly: Anomaly, enqueued_at: float) -> None:
    """Create an alert record (log channel). Webhook is handled by worker.alerts."""
    from app.models import Alert

    alert = Alert(
        anomaly_id=anomaly.id,
        channel="log",
        delivery_status="sent",
        detail=anomaly.root_cause_summary,
    )
    db.add(alert)
