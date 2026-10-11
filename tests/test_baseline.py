"""Tests for Welford online baseline statistics."""

import math
import pytest
from app.detection.baseline import BaselineStats, welford_update


class TestWelfordUpdate:
    def test_single_value(self):
        stats = BaselineStats()
        updated = welford_update(stats, 5.0)
        assert updated.n == 1
        assert updated.mean == 5.0
        assert updated.m2 == 0.0

    def test_two_values(self):
        stats = BaselineStats()
        stats = welford_update(stats, 4.0)
        stats = welford_update(stats, 6.0)
        assert stats.n == 2
        assert stats.mean == pytest.approx(5.0)
        assert stats.std == pytest.approx(math.sqrt(2.0), abs=0.01)

    def test_many_values_converge(self):
        stats = BaselineStats()
        values = [2.0, 2.1, 1.9, 2.05, 1.95, 2.0, 2.1, 1.9, 2.0, 2.0]
        for v in values:
            stats = welford_update(stats, v)
        assert stats.n == 10
        assert stats.mean == pytest.approx(2.0, abs=0.05)
        assert stats.std < 0.2, "Std should be small for tightly clustered values"

    def test_pure_function(self):
        """welford_update should not mutate its input."""
        original = BaselineStats(n=5, mean=3.0, m2=2.0)
        updated = welford_update(original, 4.0)
        assert original.n == 5, "Original should not be mutated"
        assert updated.n == 6

    def test_std_requires_n_ge_2(self):
        stats = BaselineStats(n=1, mean=5.0, m2=0.0)
        assert stats.std == 0.0

    def test_cold_start_default(self):
        stats = BaselineStats()
        assert stats.is_cold is True

    def test_not_cold_after_samples(self):
        stats = BaselineStats(n=10, mean=1.0, m2=1.0)
        assert stats.is_cold is False

    def test_cold_for_custom_min(self):
        stats = BaselineStats(n=3, mean=1.0, m2=1.0)
        assert stats.is_cold_for(5) is True
        assert stats.is_cold_for(3) is False

    def test_std_numerical_underflow_guard(self):
        """std should safely clamp m2 to 0 if rounding error produces negative m2."""
        stats = BaselineStats(n=5, mean=2.0, m2=-1e-15)
        assert stats.std == 0.0

    def test_welford_rejects_non_finite_values(self):
        stats = BaselineStats(n=5, mean=2.0, m2=1.0)
        with pytest.raises(ValueError, match="non-finite"):
            welford_update(stats, float("nan"))
        with pytest.raises(ValueError, match="non-finite"):
            welford_update(stats, float("inf"))

    def test_welford_rejects_negative_cost(self):
        stats = BaselineStats()
        with pytest.raises(ValueError, match="negative"):
            welford_update(stats, -0.5)
