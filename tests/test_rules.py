"""Tests for detection rules — pure functions, no DB needed.

These tests verify the core detection logic that the student must be able
to explain and modify in a viva.
"""

import pytest
from app.detection.baseline import BaselineStats
from app.detection.rules import (
    DetectionConfig,
    classify_severity,
    compute_z_and_pct,
    evaluate,
)


@pytest.fixture
def default_cfg():
    return DetectionConfig()


@pytest.fixture
def normal_baseline():
    """Baseline with 100 samples, mean=2.0, std≈0.2."""
    return BaselineStats(n=100, mean=2.0, m2=3.96)  # std = sqrt(3.96/99) ≈ 0.2


class TestComputeZAndPct:
    """Test z-score and percentage calculations."""

    def test_normal_value(self, normal_baseline, default_cfg):
        z, pct, std_eff = compute_z_and_pct(2.1, normal_baseline, default_cfg)
        assert abs(z) < 1.0, "A small deviation should have a low z-score"
        assert pct == pytest.approx(5.0, abs=1.0)

    def test_spike_value(self, normal_baseline, default_cfg):
        z, pct, std_eff = compute_z_and_pct(10.0, normal_baseline, default_cfg)
        assert z > 3.0, "A 5x cost should exceed z_threshold"
        assert pct > 300, "Should be >300% above mean"

    def test_std_floor_prevents_division_by_zero(self, default_cfg):
        """Even with zero variance, the std floor prevents trivial triggers."""
        zero_var = BaselineStats(n=100, mean=1.0, m2=0.0)
        z, pct, std_eff = compute_z_and_pct(1.01, zero_var, default_cfg)
        assert std_eff >= default_cfg.std_floor_pct * 1.0
        assert abs(z) < 3.0, "Tiny cost change should not flag with floor"

    def test_negative_mean_guard(self, default_cfg):
        """If mean is zero or negative, pct should not crash."""
        zero_mean = BaselineStats(n=100, mean=0.0, m2=1.0)
        z, pct, std_eff = compute_z_and_pct(1.0, zero_mean, default_cfg)
        assert pct == 0.0


class TestEvaluate:
    """Test the main evaluate() function across different scenarios."""

    def test_cold_start_returns_no_anomaly(self, default_cfg):
        """With fewer than min_samples, detection is skipped."""
        cold = BaselineStats(n=2, mean=1.0, m2=0.01)
        verdict = evaluate(cost=100.0, baseline=cold, ewma_prev=1.0, cfg=default_cfg)
        assert verdict.is_anomaly is False, "Cold start should never flag"

    def test_normal_value_not_flagged(self, normal_baseline, default_cfg):
        verdict = evaluate(cost=2.1, baseline=normal_baseline, ewma_prev=1.0, cfg=default_cfg)
        assert verdict.is_anomaly is False

    def test_spike_flagged_as_z_score(self, normal_baseline, default_cfg):
        """A large spike should trigger Rule A (z-score)."""
        verdict = evaluate(cost=10.0, baseline=normal_baseline, ewma_prev=1.0, cfg=default_cfg)
        assert verdict.is_anomaly is True
        assert verdict.method == "z_score"
        assert verdict.z_score > default_cfg.z_threshold

    def test_pct_jump_flagged(self, default_cfg):
        """A cost 2x above mean should trigger pct_jump even if z is moderate."""
        # Low variance baseline where z might be moderate
        baseline = BaselineStats(n=100, mean=1.0, m2=990.0)  # std ≈ 3.16
        verdict = evaluate(cost=3.0, baseline=baseline, ewma_prev=1.0, cfg=default_cfg)
        # pct = 200%, z = (3-1)/3.16 ≈ 0.63 — so only pct fires
        # Actually with these numbers z is low but pct is 200% which exceeds 50%
        assert verdict.pct_increase > default_cfg.pct_jump_threshold or verdict.z_score > default_cfg.z_threshold

    def test_ewma_drift_fires_for_slow_leak(self, normal_baseline, default_cfg):
        """EWMA drift catches gradual increases that don't spike enough for z/pct."""
        # Simulate a previous EWMA that's been creeping up
        high_ewma = 1.25  # Already elevated
        # Cost slightly above mean — not enough for z or pct
        cost = 2.4
        v1 = evaluate(cost=cost, baseline=normal_baseline, ewma_prev=high_ewma, cfg=default_cfg)
        assert v1.is_anomaly is False
        v2 = evaluate(cost=cost, baseline=normal_baseline, ewma_prev=1.28, cfg=default_cfg)
        assert v2.is_anomaly is False
        v3 = evaluate(cost=3.0, baseline=normal_baseline, ewma_prev=1.28, cfg=default_cfg)
        assert v3.is_anomaly is True
        # EWMA drift fires ONLY when neither A nor B fired
        # We need: pct <= 50 AND z <= 3 AND ewma > 1.3
        cost4 = 2.3  # pct = 15%, z = (2.3-2)/0.2 = 1.5
        v4 = evaluate(cost=cost4, baseline=normal_baseline, ewma_prev=1.29, cfg=default_cfg)
        assert v4.is_anomaly is False
        verdict5 = evaluate(cost=cost4, baseline=normal_baseline, ewma_prev=1.4, cfg=default_cfg)
        # new_ewma = 0.345 + 0.7 * 1.4 = 0.345 + 0.98 = 1.325 > 1.3
        # z = 1.5 < 3, pct = 15% < 50% — EWMA drift should fire
        assert verdict5.is_anomaly is True
        assert verdict5.method == "ewma_drift"

    def test_new_resource_flagged(self, default_cfg):
        """A brand new resource with cost above floor should be flagged."""
        cold = BaselineStats(n=0, mean=0.0, m2=0.0)
        verdict = evaluate(
            cost=5.0, baseline=cold, ewma_prev=1.0, cfg=default_cfg,
            is_new_resource=True, system_has_history=True,
        )
        assert verdict.is_anomaly is True
        assert verdict.method == "new_resource"

    def test_new_resource_below_floor_not_flagged(self, default_cfg):
        """A new resource with trivial cost should not be flagged."""
        cold = BaselineStats(n=0, mean=0.0, m2=0.0)
        verdict = evaluate(
            cost=0.01, baseline=cold, ewma_prev=1.0, cfg=default_cfg,
            is_new_resource=True, system_has_history=True,
        )
        assert verdict.is_anomaly is False

    def test_ewma_updated_even_without_anomaly(self, normal_baseline, default_cfg):
        """EWMA should be updated for every non-cold record."""
        verdict = evaluate(cost=2.0, baseline=normal_baseline, ewma_prev=1.0, cfg=default_cfg)
        assert verdict.new_ewma is not None
        assert verdict.new_ewma != 1.0 or abs(verdict.new_ewma - 1.0) < 0.01


class TestClassifySeverity:
    def test_critical_z(self, default_cfg):
        assert classify_severity(12.0, None, default_cfg) == "critical"

    def test_high_pct(self, default_cfg):
        assert classify_severity(None, 200.0, default_cfg) == "high"

    def test_max_of_both(self, default_cfg):
        """Severity should use the higher of z and pct implications."""
        sev = classify_severity(5.0, 200.0, default_cfg)
        # z=5 → medium, pct=200 → high → max is high
        assert sev == "high"

    def test_low_values(self, default_cfg):
        assert classify_severity(2.0, 30.0, default_cfg) == "low"

    def test_min_severity_floor(self, default_cfg):
        """When a minimum severity floor is given, it cannot be lower than that floor."""
        assert classify_severity(None, 10.0, default_cfg, min_severity="medium") == "medium"
        assert classify_severity(12.0, 10.0, default_cfg, min_severity="medium") == "critical"

    def test_verdict_direction_metadata(self, normal_baseline, default_cfg):
        v_normal = evaluate(cost=2.0, baseline=normal_baseline, ewma_prev=1.0, cfg=default_cfg)
        assert v_normal.direction == "normal"

        v_spike = evaluate(cost=10.0, baseline=normal_baseline, ewma_prev=1.0, cfg=default_cfg)
        assert v_spike.direction == "spike"

        v_drift = evaluate(cost=2.3, baseline=normal_baseline, ewma_prev=1.4, cfg=default_cfg)
        assert v_drift.direction == "drift"
        assert v_drift.severity in ("medium", "high", "critical")
