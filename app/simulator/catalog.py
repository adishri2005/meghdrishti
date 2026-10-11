"""
Deterministic resource catalog for the simulator.

Uses ``random.Random(42)`` so every run produces the same 40 resources,
making tests reproducible and the demo predictable.

The catalog represents a realistic mix of AWS resource types across three
regions and four teams, with base costs that reflect real-world pricing
orders of magnitude (not exact prices, but plausible ratios).
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class CatalogEntry:
    """One simulated cloud resource."""

    resource_id: str
    type: str
    service: str
    region: str
    team_tag: str
    base_cost: float       # base hourly cost in USD
    unit_cost: float       # cost per unit of usage
    unit: str              # e.g. "vCPU-hour", "GB", "request"


# Unit costs by resource type (for usage_quantity = cost / unit_cost)
_UNIT_COSTS = {
    "EC2": 0.05,           # per vCPU-hour
    "RDS": 0.10,           # per instance-hour
    "S3": 0.023,           # per GB
    "Lambda": 0.0000002,   # per request
    "DataTransfer": 0.09,  # per GB
    "EBS": 0.10,           # per GB-month (hourly fraction)
}

_UNITS = {
    "EC2": "vCPU-hour",
    "RDS": "instance-hour",
    "S3": "GB",
    "Lambda": "request",
    "DataTransfer": "GB",
    "EBS": "GB-month",
}


def build_catalog(seed: int = 42) -> list[CatalogEntry]:
    """Generate the deterministic 40-resource catalog.

    Distribution: 12 EC2, 4 RDS, 8 S3, 8 Lambda, 4 DataTransfer, 4 EBS.
    """
    rng = random.Random(seed)
    regions = ["us-east-1", "us-west-2", "eu-west-1"]
    teams = ["web", "ml", "data", "platform"]

    catalog: list[CatalogEntry] = []

    def add(res_type: str, count: int, cost_range: tuple[float, float], prefix: str):
        for i in range(1, count + 1):
            region = regions[i % len(regions)]
            team = teams[i % len(teams)]

            # Special case: GPU instances for the ML team
            if res_type == "EC2" and team == "ml" and i <= 2:
                rid = f"ec2-ml-gpu-{i:02d}"
                base = rng.uniform(2.5, 3.5)
            else:
                rid = f"{prefix}-{i:02d}"
                base = rng.uniform(*cost_range)

            unit_cost = _UNIT_COSTS[res_type]
            unit = _UNITS[res_type]

            catalog.append(CatalogEntry(
                resource_id=rid,
                type=res_type,
                service=res_type,
                region=region,
                team_tag=team,
                base_cost=round(base, 4),
                unit_cost=unit_cost,
                unit=unit,
            ))

    add("EC2", 12, (0.5, 2.0), "ec2-web")
    add("RDS", 4, (1.0, 2.0), "rds-main")
    add("S3", 8, (0.1, 0.6), "s3-bucket")
    add("Lambda", 8, (0.1, 0.4), "lambda-fn")
    add("DataTransfer", 4, (0.2, 0.8), "dt-link")
    add("EBS", 4, (0.1, 0.3), "ebs-vol")

    return catalog


# Module-level singleton for convenience
CATALOG = build_catalog()
