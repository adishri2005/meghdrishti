"""
Cost data generator: normal patterns + anomaly injection + ground truth.

Normal pattern for each resource:
    cost = base × daily(hour) × weekly(dow) × noise
where:
    daily(hour) = 1 + 0.25 × sin(2π(hour-8)/24)    — peak around 8 AM
    weekly(dow) = 0.7 on Saturday/Sunday, else 1.0   — weekend dip
    noise       = Normal(1, 0.05) clamped at ≥ 0.5   — realistic jitter

Anomaly injection modes:
- spike:        multiply one resource's cost by ``multiplier`` for 1-3 hours
- drift:        grow a resource's cost by 3% compounding every hour for 12h
- new_resource: add a brand-new resource at $15/h for 2 hours

Each injection returns ground-truth entries so detection quality can be
evaluated later.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

from app.simulator.catalog import CATALOG, CatalogEntry


@dataclass
class GroundTruth:
    """A labelled anomaly for evaluation against detected anomalies."""

    resource_id: str
    kind: str          # spike | drift | new_resource
    start_ts: datetime
    end_ts: datetime
    multiplier: float


def daily_factor(hour: int) -> float:
    """Sinusoidal daily pattern peaking around hour 8 (business hours)."""
    return 1.0 + 0.25 * math.sin(2 * math.pi * (hour - 8) / 24)


def weekly_factor(dow: int) -> float:
    """Weekend dip: 0.7 on Saturday (5) and Sunday (6), 1.0 otherwise."""
    return 0.7 if dow >= 5 else 1.0


def generate_cost(
    entry: CatalogEntry,
    ts: datetime,
    rng: random.Random,
) -> dict[str, Any]:
    """Generate one normal cost record for a resource at a timestamp."""
    hour = ts.hour
    dow = ts.weekday()

    noise = max(rng.gauss(1.0, 0.05), 0.5)
    cost = entry.base_cost * daily_factor(hour) * weekly_factor(dow) * noise
    cost = max(cost, 0.0)
    usage_quantity = cost / entry.unit_cost if entry.unit_cost > 0 else 0

    return {
        "resource_id": entry.resource_id,
        "type": entry.type,
        "service": entry.service,
        "region": entry.region,
        "team_tag": entry.team_tag,
        "timestamp": ts.isoformat(),
        "usage_quantity": round(usage_quantity, 4),
        "unit_cost": entry.unit_cost,
        "cost": round(cost, 4),
    }


def generate_hours(
    start: datetime,
    hours: int,
    inject: Optional[str] = None,
    inject_resource_id: Optional[str] = None,
    multiplier: float = 10.0,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[GroundTruth]]:
    """Generate cost records for all catalog resources across the given hours.

    Args:
        start: Start timestamp (will be truncated to the hour).
        hours: Number of hours to generate.
        inject: Anomaly type to inject (spike, drift, new_resource), or None.
        inject_resource_id: Target resource for spike/drift; ignored for new_resource.
        multiplier: Cost multiplier for spike injection.
        seed: RNG seed for reproducibility.

    Returns:
        (records, ground_truths) tuple.
    """
    rng = random.Random(seed)
    records: list[dict[str, Any]] = []
    ground_truths: list[GroundTruth] = []

    # Truncate start to the hour
    start = start.replace(minute=0, second=0, microsecond=0)

    # Determine injection parameters
    spike_hours: set[int] = set()
    drift_target: Optional[str] = None
    drift_start_offset: int = 0
    new_res_entry: Optional[CatalogEntry] = None

    if inject == "spike":
        target = inject_resource_id or "ec2-ml-gpu-01"
        spike_count = rng.randint(1, 3)
        spike_start = rng.randint(0, max(hours - spike_count, 0))
        spike_hours = set(range(spike_start, spike_start + spike_count))
        gt_start = start + timedelta(hours=spike_start)
        gt_end = start + timedelta(hours=spike_start + spike_count - 1)
        ground_truths.append(GroundTruth(
            resource_id=target,
            kind="spike",
            start_ts=gt_start,
            end_ts=gt_end,
            multiplier=multiplier,
        ))

    elif inject == "drift":
        drift_target = inject_resource_id or "ec2-ml-gpu-01"
        drift_start_offset = 0
        drift_end = min(12, hours)
        gt_start = start
        gt_end = start + timedelta(hours=drift_end - 1)
        ground_truths.append(GroundTruth(
            resource_id=drift_target,
            kind="drift",
            start_ts=gt_start,
            end_ts=gt_end,
            multiplier=1.03 ** drift_end,
        ))

    elif inject == "new_resource":
        new_res_entry = CatalogEntry(
            resource_id="ec2-rogue-99",
            type="EC2",
            service="EC2",
            region="us-east-1",
            team_tag="unknown",
            base_cost=15.0,
            unit_cost=0.05,
            unit="vCPU-hour",
        )
        new_res_hours = min(2, hours)
        gt_start = start
        gt_end = start + timedelta(hours=new_res_hours - 1)
        ground_truths.append(GroundTruth(
            resource_id="ec2-rogue-99",
            kind="new_resource",
            start_ts=gt_start,
            end_ts=gt_end,
            multiplier=15.0,
        ))

    for h in range(hours):
        ts = start + timedelta(hours=h)

        for entry in CATALOG:
            rec = generate_cost(entry, ts, rng)

            # Apply spike injection
            if inject == "spike" and h in spike_hours:
                target_id = inject_resource_id or "ec2-ml-gpu-01"
                if entry.resource_id == target_id:
                    rec["cost"] = round(rec["cost"] * multiplier, 4)
                    rec["usage_quantity"] = round(
                        rec["cost"] / entry.unit_cost if entry.unit_cost > 0 else 0, 4
                    )

            # Apply drift injection
            if inject == "drift" and entry.resource_id == drift_target:
                drift_factor = 1.03 ** (h - drift_start_offset)
                rec["cost"] = round(rec["cost"] * drift_factor, 4)
                rec["usage_quantity"] = round(
                    rec["cost"] / entry.unit_cost if entry.unit_cost > 0 else 0, 4
                )

            records.append(rec)

        # Add new resource if applicable
        if inject == "new_resource" and new_res_entry and h < 2:
            rec = generate_cost(new_res_entry, ts, rng)
            records.append(rec)

    return records, ground_truths
