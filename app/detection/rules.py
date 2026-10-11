"""
Detection rules — pure functions that decide whether a cost value is anomalous.

Each rule answers a specific question:
- Rule A (z-score): "Is this cost unusually far from the historical mean?"
- Rule B (pct-jump): "Is this cost a large percentage above the baseline?"
- Rule C (EWMA drift): "Has the cost been gradually creeping up over time?"
- Rule D (new resource): "Is this a brand-new resource with non-trivial cost?"

These are pure functions: they take data in, return a verdict, and have no
side effects.  This makes them trivially unit-testable and easy to explain
in a viva: "here's the input, here's the threshold, here's the output."

Severity classification uses the *larger* of what z-score and pct-increase
imply, because an anomaly that's both statistically extreme AND a large
percentage jump should be classified at the higher severity.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.detection.baseline import BaselineStats


@dataclass(frozen=True)
class DetectionConfig:
    """Thresholds passed to detection functions.

    Frozen so it's clear these are read-only inputs, not mutable state.
    """

    z_threshold: float = 3.0
    pct_jump_threshold: float = 50.0
    ewma_alpha: float = 0.3
    ewma_drift_ratio: float = 1.3
    min_samples: int = 5
    std_floor_pct: float = 0.05
    std_floor_abs: float = 0.01
    new_resource_cost_floor: float = 1.0
    # Severity thresholds
    critical_z: float = 10.0
    critical_pct: float = 300.0
    high_z: float = 6.0
    high_pct: float = 150.0
    medium_z: float = 4.0
    medium_pct: float = 100.0


def make_detection_config(cfg: dict) -> DetectionConfig:
    """Build a DetectionConfig from the nested config dict."""
    det = cfg.get("detection", {})
    sev = cfg.get("severity", {})
    return DetectionConfig(
        z_threshold=det.get("z_threshold", 3.0),
        pct_jump_threshold=det.get("pct_jump_threshold", 50.0),
        ewma_alpha=det.get("ewma_alpha", 0.3),
        ewma_drift_ratio=det.get("ewma_drift_ratio", 1.3),
        min_samples=det.get("min_samples", 5),
        std_floor_pct=det.get("std_floor_pct", 0.05),
        std_floor_abs=det.get("std_floor_abs", 0.01),
        new_resource_cost_floor=det.get("new_resource_cost_floor", 1.0),
        critical_z=sev.get("critical", {}).get("z", 10.0),
        critical_pct=sev.get("critical", {}).get("pct", 300.0),
        high_z=sev.get("high", {}).get("z", 6.0),
        high_pct=sev.get("high", {}).get("pct", 150.0),
        medium_z=sev.get("medium", {}).get("z", 4.0),
        medium_pct=sev.get("medium", {}).get("pct", 100.0),
    )


@dataclass(frozen=True)
class Verdict:
    """The output of the detection evaluation for one record.

    Immutable (frozen) so it's safe to pass around without accidental mutation.
    """

    is_anomaly: bool
    method: Optional[str] = None   # z_score | pct_jump | ewma_drift | new_resource
    z_score: Optional[float] = None
    pct_increase: Optional[float] = None
    severity: Optional[str] = None  # critical | high | medium | low
    expected: Optional[float] = None
    new_ewma: Optional[float] = None
    direction: Optional[str] = None  # spike | drift | new_resource | normal


def classify_severity(
    z: Optional[float],
    pct: Optional[float],
    cfg: DetectionConfig,
    min_severity: str = "low",
) -> str:
    """Assign severity based on the *larger* implication of z, pct, and min_severity.

    Why the max: a spike that is both 8 standard deviations out AND 200%
    above baseline should be classified as "high" (from the z) rather than
    "medium" (from the pct).  Taking the max of both dimensions gives us
    the most conservative (highest) severity.
    """
    severity_from_z = "low"
    severity_from_pct = "low"

    if z is not None:
        if z >= cfg.critical_z:
            severity_from_z = "critical"
        elif z >= cfg.high_z:
            severity_from_z = "high"
        elif z >= cfg.medium_z:
            severity_from_z = "medium"

    if pct is not None:
        if pct >= cfg.critical_pct:
            severity_from_pct = "critical"
        elif pct >= cfg.high_pct:
            severity_from_pct = "high"
        elif pct >= cfg.medium_pct:
            severity_from_pct = "medium"

    # Rank ordering for max comparison
    rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    highest = max(
        rank.get(severity_from_z, 1),
        rank.get(severity_from_pct, 1),
        rank.get(min_severity, 1),
    )
    inv_rank = {4: "critical", 3: "high", 2: "medium", 1: "low"}
    return inv_rank.get(highest, "low")


def compute_z_and_pct(
    cost: float,
    baseline: BaselineStats,
    cfg: DetectionConfig,
) -> tuple[float, float, float]:
    """Compute z-score and percentage increase.

    The effective std uses a floor to avoid division-by-zero and to prevent
    very low-variance resources from triggering on trivial cost changes.
    The floor is the larger of:
      - the actual std
      - std_floor_pct × mean   (5% of mean by default)
      - std_floor_abs           (0.01 by default)

    Returns (z, pct, std_eff).
    """
    std_eff = max(
        baseline.std,
        cfg.std_floor_pct * baseline.mean if baseline.mean > 0 else 0,
        cfg.std_floor_abs,
    )
    z = (cost - baseline.mean) / std_eff if std_eff > 0 else 0.0
    pct = ((cost - baseline.mean) / baseline.mean * 100) if baseline.mean > 0 else 0.0
    return z, pct, std_eff


def evaluate(
    cost: float,
    baseline: BaselineStats,
    ewma_prev: float,
    cfg: DetectionConfig,
    is_new_resource: bool = False,
    system_has_history: bool = True,
) -> Verdict:
    """Run all detection rules on a single cost observation.

    This is a PURE function: it reads its inputs and returns a Verdict
    without touching any database, cache, or global state.

    Args:
        cost: The observed hourly cost.
        baseline: Welford statistics for this (resource, hour_of_day).
        ewma_prev: Previous EWMA ratio from resource_state.
        cfg: Detection thresholds.
        is_new_resource: True if this resource has never been seen before.
        system_has_history: True if the system has >24h of data globally.

    Returns:
        Verdict with anomaly flag, method, scores, severity, and new EWMA.
    """
    # --- Rule D: new resource ---
    if is_new_resource and system_has_history and cost >= cfg.new_resource_cost_floor:
        return Verdict(
            is_anomaly=True,
            method="new_resource",
            z_score=None,
            pct_increase=None,
            severity="medium",
            expected=0.0,
            new_ewma=1.0,
            direction="new_resource",
        )

    # --- Cold start: not enough data to detect ---
    if baseline.is_cold_for(cfg.min_samples):
        return Verdict(is_anomaly=False, new_ewma=ewma_prev, direction="normal")

    z, pct, std_eff = compute_z_and_pct(cost, baseline, cfg)

    # --- Rule A: z-score ---
    rule_a = z > cfg.z_threshold

    # --- Rule B: pct-jump ---
    rule_b = pct > cfg.pct_jump_threshold

    # --- Rule C: EWMA drift ---
    ratio = cost / baseline.mean if baseline.mean > 0 else 1.0
    new_ewma = cfg.ewma_alpha * ratio + (1 - cfg.ewma_alpha) * ewma_prev

    # EWMA drift fires only if neither A nor B already caught it
    # (so slow leaks are labelled 'ewma_drift', not 'z_score')
    rule_c = (not rule_a and not rule_b) and new_ewma > cfg.ewma_drift_ratio

    if rule_a or rule_b:
        # If both fire, method is z_score; both scores are stored
        method = "z_score"
        severity = classify_severity(z, pct, cfg)
        return Verdict(
            is_anomaly=True,
            method=method,
            z_score=round(z, 4),
            pct_increase=round(pct, 2),
            severity=severity,
            expected=round(baseline.mean, 4),
            new_ewma=round(new_ewma, 6),
            direction="spike",
        )

    if rule_c:
        # Sustained drift receives at least medium severity to ensure alerting
        severity = classify_severity(None, pct if pct > 0 else None, cfg, min_severity="medium")
        return Verdict(
            is_anomaly=True,
            method="ewma_drift",
            z_score=round(z, 4),
            pct_increase=round(pct, 2),
            severity=severity,
            expected=round(baseline.mean, 4),
            new_ewma=round(new_ewma, 6),
            direction="drift",
        )

    # No anomaly
    return Verdict(
        is_anomaly=False,
        z_score=round(z, 4),
        pct_increase=round(pct, 2),
        expected=round(baseline.mean, 4),
        new_ewma=round(new_ewma, 6),
        direction="normal",
    )
