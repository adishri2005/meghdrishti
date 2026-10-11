"""Integration tests for detection engine orchestration and state persistence."""

from datetime import datetime, timedelta, timezone
import pytest

from app.detection.baseline import BaselineStats
from app.detection.engine import (
    dedup_anomaly,
    get_baseline_stats,
    process_aggregate,
    process_record,
    save_baseline,
)
from app.detection.rules import DetectionConfig, make_detection_config
from app.models import Alert, Anomaly, Baseline, Resource


@pytest.fixture
def test_resource(db_session):
    res = Resource(
        resource_id="i-test-engine-01",
        type="ec2",
        service="compute",
        region="us-east-1",
        team_tag="infra",
    )
    db_session.add(res)
    db_session.commit()
    return res


class TestEngineBaseline:
    def test_get_and_save_baseline(self, db_session, test_resource):
        cfg = {"cache": {"baseline_ttl_seconds": 60}}
        stats = get_baseline_stats(db_session, test_resource.id, 14, cfg)
        assert stats.n == 0
        assert stats.mean == 0.0

        updated = BaselineStats(n=5, mean=10.0, m2=2.0)
        save_baseline(db_session, test_resource.id, 14, updated, cfg)
        db_session.commit()

        # Verify in DB
        row = (
            db_session.query(Baseline)
            .filter(Baseline.resource_id == test_resource.id, Baseline.hour_of_day == 14)
            .first()
        )
        assert row is not None
        assert row.n == 5
        assert row.mean == 10.0


class TestEngineDeduplication:
    def test_dedup_finds_open_within_window(self, db_session, test_resource):
        now = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
        a = Anomaly(
            scope="resource",
            resource_id=test_resource.id,
            record_ts=now,
            observed_cost=100.0,
            expected_cost=10.0,
            severity="medium",
            method="z_score",
            status="open",
            occurrences=1,
            last_seen_ts=now,
        )
        db_session.add(a)
        db_session.commit()

        # Query 1 hour later
        later = now + timedelta(hours=1)
        found = dedup_anomaly(db_session, test_resource.id, "resource", later, dedup_hours=6, cost=120.0, severity="high")
        assert found is not None
        assert found.id == a.id

    def test_dedup_ignores_resolved_anomalies(self, db_session, test_resource):
        now = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
        a = Anomaly(
            scope="resource",
            resource_id=test_resource.id,
            record_ts=now,
            observed_cost=100.0,
            expected_cost=10.0,
            severity="medium",
            method="z_score",
            status="resolved",
            occurrences=1,
            last_seen_ts=now,
        )
        db_session.add(a)
        db_session.commit()

        later = now + timedelta(hours=1)
        found = dedup_anomaly(db_session, test_resource.id, "resource", later, dedup_hours=6, cost=120.0, severity="high")
        assert found is None


class TestEngineProcessRecord:
    def test_process_normal_record_updates_baseline(self, db_session, test_resource):
        cfg_cache = {"cache": {"baseline_ttl_seconds": 60}}
        det_cfg = DetectionConfig(min_samples=5)
        ts = datetime(2026, 10, 11, 15, 0, tzinfo=timezone.utc)

        meta = {"team_tag": "infra", "service": "compute", "region": "us-east-1"}
        res = process_record(
            db=db_session,
            resource_db_id=test_resource.id,
            resource_id_str=test_resource.resource_id,
            cost=25.0,
            ts=ts,
            resource_meta=meta,
            cfg_cache=cfg_cache,
            det_cfg=det_cfg,
            is_backfill=False,
            enqueued_at=ts.timestamp(),
            has_history=True,
            is_new=False,
        )
        db_session.commit()
        assert res["cost"] == 25.0

        # Baseline should now have n=1
        b = db_session.query(Baseline).filter(Baseline.resource_id == test_resource.id).first()
        assert b is not None
        assert b.n == 1
        assert b.mean == 25.0

        # No anomaly should be created
        anomalies = db_session.query(Anomaly).all()
        assert len(anomalies) == 0

    def test_process_record_spike_creates_anomaly_and_alert(self, db_session, test_resource):
        cfg_cache = {"cache": {"baseline_ttl_seconds": 60}}
        det_cfg = DetectionConfig(min_samples=2, z_threshold=3.0)
        hour = 16
        ts = datetime(2026, 10, 11, hour, 0, tzinfo=timezone.utc)

        # Pre-seed baseline with low mean and tiny variance
        save_baseline(db_session, test_resource.id, hour, BaselineStats(n=10, mean=10.0, m2=1.0), cfg_cache)
        db_session.commit()

        meta = {"team_tag": "infra", "service": "compute", "region": "us-east-1"}
        # Massive spike: 200.0 vs mean 10.0
        process_record(
            db=db_session,
            resource_db_id=test_resource.id,
            resource_id_str=test_resource.resource_id,
            cost=200.0,
            ts=ts,
            resource_meta=meta,
            cfg_cache=cfg_cache,
            det_cfg=det_cfg,
            is_backfill=False,
            enqueued_at=ts.timestamp(),
            has_history=True,
            is_new=False,
        )
        db_session.commit()

        anomaly = db_session.query(Anomaly).filter(Anomaly.resource_id == test_resource.id).first()
        assert anomaly is not None
        assert anomaly.observed_cost == 200.0
        assert anomaly.severity == "critical"

        # Check alert was generated
        alert = db_session.query(Alert).filter(Alert.anomaly_id == anomaly.id).first()
        assert alert is not None
        assert alert.delivery_status == "sent"


class TestEngineProcessAggregate:
    def test_aggregate_anomaly_and_deduplication(self, db_session):
        cfg_cache = {
            "detection": {"aggregate_pct_threshold": 50.0, "dedup_window_hours": 6},
        }
        hour_ts = datetime(2026, 10, 11, 17, 0, tzinfo=timezone.utc)
        records = [
            {"resource_id": "r1", "cost": 150.0, "mean": 10.0, "team": "dev", "service": "ec2", "region": "us-east-1"},
            {"resource_id": "r2", "cost": 10.0, "mean": 10.0, "team": "qa", "service": "s3", "region": "us-east-1"},
        ]

        # First run: should create aggregate anomaly
        process_aggregate(db_session, records, hour_ts, cfg_cache, enqueued_at=hour_ts.timestamp())
        db_session.commit()

        agg = db_session.query(Anomaly).filter(Anomaly.scope == "aggregate").first()
        assert agg is not None
        assert agg.observed_cost == 160.0
        assert agg.occurrences == 1

        # Second run 1 hour later with higher spike: should deduplicate, escalate occurrences and peak cost
        later_ts = hour_ts + timedelta(hours=1)
        records_spike = [
            {"resource_id": "r1", "cost": 300.0, "mean": 10.0, "team": "dev", "service": "ec2", "region": "us-east-1"},
            {"resource_id": "r2", "cost": 10.0, "mean": 10.0, "team": "qa", "service": "s3", "region": "us-east-1"},
        ]
        process_aggregate(db_session, records_spike, later_ts, cfg_cache, enqueued_at=later_ts.timestamp())
        db_session.commit()

        agg_updated = db_session.query(Anomaly).filter(Anomaly.scope == "aggregate").first()
        assert agg_updated.occurrences == 2
        assert agg_updated.peak_cost == 310.0
