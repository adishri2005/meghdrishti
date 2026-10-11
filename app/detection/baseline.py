"""
Welford online mean/variance per (resource, hour_of_day).

Why Welford's algorithm: it computes running mean and variance in a single
pass with O(1) memory per bucket.  This is critical because we process
records as a stream — we never want to re-scan history to recalculate
baselines.  The ``m2`` accumulator tracks the sum of squared deviations;
standard deviation is ``sqrt(m2 / (n - 1))`` when n >= 2.

Important: baselines are updated only with *normal* records.  If a record
is flagged as anomalous, we skip the baseline update so that a cost spike
doesn't inflate the baseline and mask future anomalies (the "poisoned
baseline" problem).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional


@dataclass
class BaselineStats:
    """Snapshot of Welford statistics for one (resource, hour) bucket."""

    n: int = 0
    mean: float = 0.0
    m2: float = 0.0

    @property
    def std(self) -> float:
        """Population-corrected standard deviation (Bessel's correction)."""
        if self.n < 2:
            return 0.0
        # Safeguard against floating point precision errors where m2 < 0
        return math.sqrt(max(0.0, self.m2) / (self.n - 1))

    @property
    def is_cold(self) -> bool:
        """True if we don't have enough samples to run detection."""
        return self.n < 5  # default min_samples; actual check uses config

    def is_cold_for(self, min_samples: int) -> bool:
        """Check cold-start against a configurable minimum."""
        return self.n < min_samples


def welford_update(stats: BaselineStats, value: float) -> BaselineStats:
    """Return a *new* BaselineStats with the value incorporated.

    This is a pure function — it does not mutate the input.  The worker
    writes the returned values back to the database row.

    Algorithm (Welford 1962):
        n     ← n + 1
        delta ← value - mean
        mean  ← mean + delta / n
        delta2← value - mean        (note: uses the *updated* mean)
        m2    ← m2 + delta * delta2
    """
    if not math.isfinite(value):
        raise ValueError(f"Cannot update baseline with non-finite value: {value}")
    if value < 0:
        raise ValueError(f"Cost value cannot be negative: {value}")

    n = stats.n + 1
    delta = value - stats.mean
    mean = stats.mean + delta / n
    delta2 = value - mean
    m2 = max(0.0, stats.m2 + delta * delta2)
    return BaselineStats(n=n, mean=mean, m2=m2)
