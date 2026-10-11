"""Integration tests for Anomalies API endpoints."""

from datetime import datetime, timezone
import pytest

from app.models import Anomaly, Resource
from app.security import create_access_token


@pytest.fixture
def seeded_anomalies(db_session):
    # Seed resources
    r1 = Resource(
        resource_id="ec2-worker-01",
        type="ec2",
        service="compute",
        region="us-east-1",
        team_tag="backend",
    )
    r2 = Resource(
        resource_id="rds-db-primary",
        type="rds",
        service="database",
        region="eu-west-1",
        team_tag="data",
    )
    db_session.add_all([r1, r2])
    db_session.flush()

    # Seed anomalies
    a1 = Anomaly(
        scope="resource",
        resource_id=r1.id,
        record_ts=datetime(2026, 10, 11, 10, 0, tzinfo=timezone.utc),
        observed_cost=50.0,
        expected_cost=5.0,
        z_score=6.5,
        pct_increase=900.0,
        severity="critical",
        method="z_score",
        root_cause_summary="Spike in compute costs",
        status="open",
        occurrences=1,
    )
    a2 = Anomaly(
        scope="resource",
        resource_id=r2.id,
        record_ts=datetime(2026, 10, 11, 11, 0, tzinfo=timezone.utc),
        observed_cost=15.0,
        expected_cost=10.0,
        z_score=3.2,
        pct_increase=50.0,
        severity="medium",
        method="pct_jump",
        root_cause_summary="Moderate jump in DB costs",
        status="open",
        occurrences=1,
    )
    a3 = Anomaly(
        scope="aggregate",
        resource_id=None,
        record_ts=datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc),
        observed_cost=120.0,
        expected_cost=60.0,
        z_score=None,
        pct_increase=100.0,
        severity="high",
        method="aggregate_jump",
        root_cause_summary="Global hourly spend jump",
        status="acknowledged",
        occurrences=2,
    )
    db_session.add_all([a1, a2, a3])
    db_session.commit()
    return [a1, a2, a3]


class TestAnomaliesApi:
    def test_list_anomalies_and_pagination_header(self, client, seeded_anomalies):
        token, _ = create_access_token("analyst", "analyst")
        resp = client.get(
            "/api/v1/anomalies",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"Error: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert len(data) == 3
        assert resp.headers.get("X-Total-Count") == "3"

        # Verify resource_name was eagerly loaded without N+1
        res_names = {item["resource_name"] for item in data if item["resource_name"]}
        assert "ec2-worker-01" in res_names
        assert "rds-db-primary" in res_names

    def test_list_anomalies_filtered_by_severity(self, client, seeded_anomalies):
        token, _ = create_access_token("analyst", "analyst")
        resp = client.get(
            "/api/v1/anomalies?severity=critical",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["severity"] == "critical"
        assert data[0]["resource_name"] == "ec2-worker-01"

    def test_get_anomaly_detail(self, client, seeded_anomalies):
        token, _ = create_access_token("analyst", "analyst")
        a1 = seeded_anomalies[0]
        resp = client.get(
            f"/api/v1/anomalies/{a1.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == a1.id
        assert data["resource_name"] == "ec2-worker-01"

    def test_patch_anomaly_status(self, client, seeded_anomalies):
        token, _ = create_access_token("analyst", "analyst")
        a1 = seeded_anomalies[0]
        resp = client.patch(
            f"/api/v1/anomalies/{a1.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "resolved"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "resolved"
