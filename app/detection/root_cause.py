"""
Root cause analysis — contribution ranking for aggregate anomalies.

When total hourly spend jumps, we need to answer "which resource caused it?"
This module ranks each resource's contribution to the increase and groups
the deltas by team, service, and region so the operator gets actionable
context in the alert.

All functions are PURE: they take data in and return structured results,
with no database or network calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class ResourceContribution:
    """One resource's contribution to an aggregate cost increase."""

    resource_id: str
    delta: float           # observed - expected (clamped at 0)
    share_pct: float       # percentage of total increase
    team: str
    service: str
    region: str


@dataclass(frozen=True)
class AggregateResult:
    """Result of an aggregate anomaly check for one hour."""

    is_anomaly: bool
    observed_total: float
    expected_total: float
    pct_increase: float
    top_contributors: list[ResourceContribution]
    group_by_team: list[dict[str, Any]]
    group_by_service: list[dict[str, Any]]
    group_by_region: list[dict[str, Any]]
    summary: str


def check_aggregate(
    records: list[dict[str, Any]],
    threshold_pct: float,
    hour_ts: str = "",
) -> Optional[AggregateResult]:
    """Check whether the total hourly spend is anomalously high.

    Args:
        records: List of dicts with keys: resource_id, cost, mean, team,
                 service, region, type.  ``mean`` is the baseline mean for
                 this resource at this hour (None if no baseline).
        threshold_pct: The percentage increase above expected that triggers
                       an aggregate anomaly.
        hour_ts: Human-readable timestamp for the summary string.

    Returns:
        AggregateResult if anomalous, None otherwise.
    """
    if not records:
        return None

    # Only include resources with a baseline in the expected total
    with_baseline = [r for r in records if r.get("mean") is not None and r["mean"] > 0]
    if not with_baseline:
        return None

    expected_total = sum(r["mean"] for r in with_baseline)
    observed_total = sum(r["cost"] for r in with_baseline)

    if expected_total <= 0:
        return None

    pct_increase = (observed_total - expected_total) / expected_total * 100

    if pct_increase <= threshold_pct:
        return None

    # --- Contribution ranking ---
    deltas: list[tuple[dict, float]] = []
    for r in with_baseline:
        delta = max(r["cost"] - r["mean"], 0.0)
        deltas.append((r, delta))

    total_delta = sum(d for _, d in deltas)
    if total_delta <= 0:
        return None

    # Sort descending by delta and filter to positive contributors
    deltas.sort(key=lambda x: x[1], reverse=True)
    positive_deltas = [d for d in deltas if d[1] > 0.0]

    top = []
    for rec, delta in positive_deltas[:5]:
        top.append(ResourceContribution(
            resource_id=rec["resource_id"],
            delta=round(delta, 4),
            share_pct=round(delta / total_delta * 100, 2),
            team=rec.get("team") or "unknown",
            service=rec.get("service") or "unknown",
            region=rec.get("region") or "unknown",
        ))

    # --- Group by dimensions ---
    group_by_team = _group_deltas(deltas, "team")
    group_by_service = _group_deltas(deltas, "service")
    group_by_region = _group_deltas(deltas, "region")

    # --- Summary ---
    responsible = top[0] if top else None
    summary = (
        f"Total cost +{pct_increase:.0f}% at {hour_ts} "
        f"(expected ${expected_total:.2f}, observed ${observed_total:.2f})."
    )
    if responsible:
        summary += (
            f" Responsible resource: {responsible.resource_id} "
            f"({responsible.region}, team {responsible.team}) "
            f"contributing {responsible.share_pct:.1f}% of the increase."
        )

    return AggregateResult(
        is_anomaly=True,
        observed_total=round(observed_total, 4),
        expected_total=round(expected_total, 4),
        pct_increase=round(pct_increase, 2),
        top_contributors=top,
        group_by_team=group_by_team,
        group_by_service=group_by_service,
        group_by_region=group_by_region,
        summary=summary,
    )


def build_resource_root_cause(
    resource_id: str,
    cost: float,
    expected: float,
    team: str,
    service: str,
    region: str,
    aggregate_result: Optional[AggregateResult] = None,
) -> dict[str, Any]:
    """Build a root_cause_summary and root_cause dict for a resource-level anomaly.

    Includes the resource's own details and, if an aggregate anomaly exists,
    its share of the total increase.
    """
    delta = cost - expected if expected else cost
    summary = (
        f"Resource {resource_id} ({region}, team {team}, service {service}): "
        f"cost ${cost:.2f} vs expected ${expected:.2f} (delta ${delta:.2f})."
    )

    root_cause: dict[str, Any] = {
        "resource_id": resource_id,
        "cost": round(cost, 4),
        "expected": round(expected, 4),
        "delta": round(delta, 4),
        "team": team,
        "service": service,
        "region": region,
    }

    if aggregate_result:
        # Find this resource's share in the aggregate
        for contrib in aggregate_result.top_contributors:
            if contrib.resource_id == resource_id:
                root_cause["aggregate_share_pct"] = contrib.share_pct
                summary += f" Share of aggregate increase: {contrib.share_pct:.1f}%."
                break

    return {"summary": summary, "root_cause": root_cause}


def _group_deltas(
    deltas: list[tuple[dict, float]], key: str
) -> list[dict[str, Any]]:
    """Group deltas by a dimension (team, service, region) and return top groups."""
    groups: dict[str, float] = {}
    for rec, delta in deltas:
        if delta <= 0.0:
            continue
        group_val = rec.get(key) or "unknown"
        groups[group_val] = groups.get(group_val, 0.0) + delta

    total = sum(groups.values())
    if total <= 0:
        return []

    ranked = sorted(groups.items(), key=lambda x: x[1], reverse=True)
    return [
        {"group": name, "delta": round(d, 4), "share_pct": round(d / total * 100, 2)}
        for name, d in ranked[:3]
    ]
