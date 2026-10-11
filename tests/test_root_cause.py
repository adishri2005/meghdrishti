"""Tests for root cause analysis — pure functions, no DB needed."""

import pytest
from app.detection.root_cause import (
    AggregateResult,
    ResourceContribution,
    build_resource_root_cause,
    check_aggregate,
)


class TestCheckAggregate:
    def test_no_anomaly_when_within_threshold(self):
        records = [
            {"resource_id": "ec2-1", "cost": 2.0, "mean": 2.0, "team": "web", "service": "EC2", "region": "us-east-1"},
            {"resource_id": "rds-1", "cost": 1.5, "mean": 1.5, "team": "data", "service": "RDS", "region": "us-west-2"},
        ]
        result = check_aggregate(records, threshold_pct=50.0)
        assert result is None

    def test_anomaly_when_above_threshold(self):
        records = [
            {"resource_id": "ec2-1", "cost": 10.0, "mean": 2.0, "team": "ml", "service": "EC2", "region": "us-east-1"},
            {"resource_id": "rds-1", "cost": 1.5, "mean": 1.5, "team": "data", "service": "RDS", "region": "us-west-2"},
        ]
        result = check_aggregate(records, threshold_pct=50.0, hour_ts="2026-10-11T14:00")
        assert result is not None
        assert result.is_anomaly is True
        assert result.pct_increase > 50.0

    def test_top_contributor_is_correct(self):
        records = [
            {"resource_id": "ec2-gpu", "cost": 30.0, "mean": 3.0, "team": "ml", "service": "EC2", "region": "us-east-1"},
            {"resource_id": "rds-1", "cost": 2.0, "mean": 1.5, "team": "data", "service": "RDS", "region": "us-west-2"},
            {"resource_id": "s3-1", "cost": 0.5, "mean": 0.5, "team": "web", "service": "S3", "region": "eu-west-1"},
        ]
        result = check_aggregate(records, threshold_pct=50.0, hour_ts="2026-10-11T14:00")
        assert result is not None
        assert len(result.top_contributors) > 0
        top = result.top_contributors[0]
        assert top.resource_id == "ec2-gpu"
        assert top.share_pct > 90.0, "GPU resource should dominate the increase"

    def test_group_by_team(self):
        records = [
            {"resource_id": "a", "cost": 20.0, "mean": 2.0, "team": "ml", "service": "EC2", "region": "us-east-1"},
            {"resource_id": "b", "cost": 5.0, "mean": 2.0, "team": "ml", "service": "EC2", "region": "us-east-1"},
            {"resource_id": "c", "cost": 2.0, "mean": 2.0, "team": "web", "service": "EC2", "region": "us-east-1"},
        ]
        result = check_aggregate(records, threshold_pct=50.0)
        assert result is not None
        team_groups = result.group_by_team
        assert len(team_groups) > 0
        assert team_groups[0]["group"] == "ml"

    def test_summary_mentions_responsible_resource(self):
        records = [
            {"resource_id": "ec2-ml-gpu-07", "cost": 30.0, "mean": 3.0, "team": "ml", "service": "EC2", "region": "us-east-1"},
        ]
        result = check_aggregate(records, threshold_pct=50.0, hour_ts="2026-10-11T14:00")
        assert result is not None
        assert "ec2-ml-gpu-07" in result.summary

    def test_empty_records_returns_none(self):
        assert check_aggregate([], threshold_pct=50.0) is None

    def test_no_baseline_records_returns_none(self):
        records = [
            {"resource_id": "new-1", "cost": 5.0, "mean": None, "team": "ml", "service": "EC2", "region": "us-east-1"},
        ]
        assert check_aggregate(records, threshold_pct=50.0) is None


class TestBuildResourceRootCause:
    def test_basic_root_cause(self):
        result = build_resource_root_cause(
            resource_id="ec2-ml-gpu-07",
            cost=30.0,
            expected=3.0,
            team="ml",
            service="EC2",
            region="us-east-1",
        )
        assert "ec2-ml-gpu-07" in result["summary"]
        assert result["root_cause"]["delta"] == pytest.approx(27.0)

    def test_with_aggregate_context(self):
        agg = AggregateResult(
            is_anomaly=True,
            observed_total=35.0,
            expected_total=5.0,
            pct_increase=600.0,
            top_contributors=[
                ResourceContribution("ec2-ml-gpu-07", 27.0, 90.0, "ml", "EC2", "us-east-1"),
            ],
            group_by_team=[],
            group_by_service=[],
            group_by_region=[],
            summary="test",
        )
        result = build_resource_root_cause(
            resource_id="ec2-ml-gpu-07",
            cost=30.0,
            expected=3.0,
            team="ml",
            service="EC2",
            region="us-east-1",
            aggregate_result=agg,
        )
        assert result["root_cause"]["aggregate_share_pct"] == 90.0


class TestRootCauseEdgeCases:
    def test_missing_metadata_defaults_to_unknown(self):
        records = [
            {"resource_id": "r1", "cost": 100.0, "mean": 10.0, "team": None, "service": None, "region": None},
            {"resource_id": "r2", "cost": 10.0, "mean": 10.0, "team": "core", "service": "s3", "region": "us-east-1"},
        ]
        res = check_aggregate(records, threshold_pct=50.0, hour_ts="2026-10-11T12:00:00Z")
        assert res is not None
        assert res.is_anomaly is True
        assert len(res.top_contributors) == 1
        assert res.top_contributors[0].resource_id == "r1"
        assert res.top_contributors[0].team == "unknown"
        # Group by team should handle None gracefully
        assert any(g["group"] == "unknown" for g in res.group_by_team)

    def test_top_contributors_caps_at_five(self):
        records = [
            {"resource_id": f"r{i}", "cost": 10.0 + i * 5, "mean": 5.0, "team": "dev", "service": "ec2", "region": "us-west-2"}
            for i in range(10)
        ]
        res = check_aggregate(records, threshold_pct=10.0)
        assert res is not None
        assert len(res.top_contributors) == 5
        # First contributor should be highest delta (r9)
        assert res.top_contributors[0].resource_id == "r9"

    def test_resources_below_mean_excluded_from_delta(self):
        records = [
            {"resource_id": "r1", "cost": 100.0, "mean": 20.0, "team": "a", "service": "s", "region": "r"},
            {"resource_id": "r2", "cost": 5.0, "mean": 20.0, "team": "b", "service": "s", "region": "r"},  # cost dropped
        ]
        res = check_aggregate(records, threshold_pct=50.0)
        assert res is not None
        # Only r1 has positive delta (80.0)
        assert len(res.top_contributors) == 1
        assert res.top_contributors[0].resource_id == "r1"
        assert res.top_contributors[0].delta == pytest.approx(80.0)
        assert res.top_contributors[0].share_pct == 100.0
