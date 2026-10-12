"""Tests for resource router endpoints, pagination, and sorting."""

import pytest
from app.models import Anomaly, Baseline, CostRecord, Resource
from datetime import datetime, timezone, timedelta


def test_list_resources_db_sorting_and_pagination(client, admin_headers, db_session):
    # Seed resources
    for i in range(10):
        res = Resource(
            resource_id=f"res-{i:02d}",
            type="ec2",
            service="compute",
            region="us-east-1",
            team_tag="backend",
        )
        db_session.add(res)
    db_session.commit()

    # Query with resource_id_asc and limit 5
    resp = client.get("/api/v1/resources?sort=resource_id_asc&limit=5&offset=0", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    assert data[0]["resource_id"] == "res-00"
    assert data[4]["resource_id"] == "res-04"
    assert resp.headers["x-total-count"] == "10"

    # Query offset 5
    resp2 = client.get("/api/v1/resources?sort=resource_id_asc&limit=5&offset=5", headers=admin_headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) == 5
    assert data2[0]["resource_id"] == "res-05"

    # Query resource_id_desc
    resp_desc = client.get("/api/v1/resources?sort=resource_id_desc&limit=3", headers=admin_headers)
    assert resp_desc.status_code == 200
    data_desc = resp_desc.json()
    assert len(data_desc) == 3
    assert data_desc[0]["resource_id"] == "res-09"


def test_list_resources_computed_metrics_and_status(client, admin_headers, db_session):
    now = datetime.now(timezone.utc)
    res_normal = Resource(resource_id="res-normal", type="s3", service="storage", region="us-west-2", team_tag="data")
    res_anom = Resource(resource_id="res-anom", type="rds", service="database", region="us-east-1", team_tag="backend")
    db_session.add_all([res_normal, res_anom])
    db_session.commit()

    # Add open anomaly to res_anom
    anom = Anomaly(
        scope="resource",
        resource_id=res_anom.id,
        record_ts=now,
        observed_cost=150.0,
        expected_cost=10.0,
        z_score=4.5,
        severity="critical",
        method="zscore",
        status="open",
    )
    # Add cost record
    cost = CostRecord(
        resource_id=res_anom.id,
        usage_quantity=1.0,
        unit_cost=150.0,
        cost=150.0,
        ts=now,
    )
    db_session.add_all([anom, cost])
    db_session.commit()

    # Sort by open_anomalies_desc
    resp = client.get("/api/v1/resources?sort=open_anomalies_desc", headers=admin_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 2
    # Find res-anom item
    anom_item = next(item for item in items if item["resource_id"] == "res-anom")
    assert anom_item["status"] == "anomalous"
    assert anom_item["open_anomalies"] == 1
    assert anom_item["cost_24h"] == 150.0


def test_get_resource_detail_and_404(client, admin_headers, db_session):
    res = Resource(resource_id="res-detail-test", type="lambda", service="compute", region="eu-central-1", team_tag="devops")
    db_session.add(res)
    db_session.commit()

    # Query by resource_id string
    resp = client.get(f"/api/v1/resources/{res.resource_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["resource_id"] == "res-detail-test"

    # Query by numeric ID string
    resp_num = client.get(f"/api/v1/resources/{res.id}", headers=admin_headers)
    assert resp_num.status_code == 200
    assert resp_num.json()["id"] == res.id

    # 404 for unknown
    resp_404 = client.get("/api/v1/resources/non-existent-res-id", headers=admin_headers)
    assert resp_404.status_code == 404
