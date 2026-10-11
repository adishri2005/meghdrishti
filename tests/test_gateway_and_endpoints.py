"""
Comprehensive integration tests for Phase 0 backend additions:
- Same-origin gateway requirements (cookie sessions, auth/me, auth/verify)
- CSRF defense on state-changing cookie requests
- New read endpoints: stats/overview, system/status, costs/timeseries, costs/heatmap,
  resources, jobs, anomaly timeline, audit-logs, admin/logs, admin/deployments.
"""

from datetime import datetime, timezone
import pytest
from app.models import Anomaly, CostRecord, Deployment, IngestionJob, Resource
from app.security import create_access_token


@pytest.fixture
def admin_headers():
    token, _ = create_access_token("admin", "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def analyst_headers():
    token, _ = create_access_token("analyst", "analyst")
    return {"Authorization": f"Bearer {token}"}


class TestCookieSessionAndGatewayAuth:
    def test_login_sets_cookie(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@12345"},
        )
        assert resp.status_code == 200
        assert "ccad_token" in resp.cookies
        cookie_val = resp.cookies["ccad_token"]
        assert len(cookie_val) > 20

    def test_auth_me_with_cookie_and_bearer(self, client):
        # Unauthenticated
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

        # With Bearer token
        token, _ = create_access_token("admin", "admin")
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"
        assert "expires_at" in data

        # With Cookie
        client.cookies.set("ccad_token", token)
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["username"] == "admin"

    def test_auth_verify_endpoint_for_nginx(self, client):
        # Unauthorized returns 401
        client.cookies.clear()
        resp = client.get("/api/v1/auth/verify")
        assert resp.status_code == 401

        # Authorized with cookie returns 204 No Content
        token, _ = create_access_token("analyst", "analyst")
        client.cookies.set("ccad_token", token)
        resp = client.get("/api/v1/auth/verify")
        assert resp.status_code == 204

    def test_logout_clears_cookie(self, client):
        token, _ = create_access_token("admin", "admin")
        client.cookies.set("ccad_token", token)

        resp = client.post(
            "/api/v1/auth/logout",
            headers={"X-Requested-With": "CostGuard"},
        )
        assert resp.status_code == 200
        # Cookie deleted or empty
        val = resp.cookies.get("ccad_token")
        assert val is None or val == '""' or val == ""

    def test_csrf_defense_on_cookie_auth(self, client):
        token, _ = create_access_token("admin", "admin")
        client.cookies.set("ccad_token", token)

        # POST without X-Requested-With should return 403 Forbidden
        resp = client.post(
            "/api/v1/auth/register",
            json={"username": "csrf_test_user", "password": "Password123!", "role": "analyst"},
        )
        assert resp.status_code == 403
        assert "CSRF" in resp.json()["detail"] or "X-Requested-With" in resp.json()["detail"]

        # POST with X-Requested-With: CostGuard should succeed
        resp = client.post(
            "/api/v1/auth/register",
            headers={"X-Requested-With": "CostGuard"},
            json={"username": "csrf_test_user", "password": "Password123!", "role": "analyst"},
        )
        assert resp.status_code == 201


class TestNewReadEndpoints:
    def test_stats_overview(self, client, admin_headers, db_session):
        # Create a resource and cost records
        res = Resource(
            resource_id="ec2-test-01",
            type="ec2",
            service="compute",
            region="us-east-1",
            team_tag="core",
        )
        db_session.add(res)
        db_session.commit()

        rec = CostRecord(
            resource_id=res.id,
            ts=datetime.now(timezone.utc),
            usage_quantity=10,
            unit_cost=1.5,
            cost=15.0,
        )
        db_session.add(rec)
        db_session.commit()

        resp = client.get("/api/v1/stats/overview", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "cost_24h" in data
        assert "anomalies_open" in data
        assert "top_spenders" in data
        assert isinstance(data["top_spenders"], list)

    def test_system_status(self, client, admin_headers):
        resp = client.get("/api/v1/system/status", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "api" in data
        assert "postgres" in data
        assert "redis" in data
        assert "worker_count" in data

    def test_costs_timeseries_and_heatmap(self, client, admin_headers):
        resp = client.get("/api/v1/costs/timeseries?group_by=team", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "interval" in data
        assert "series" in data

        resp2 = client.get("/api/v1/costs/heatmap", headers=admin_headers)
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert "resources" in data2
        assert "hours" in data2
        assert "values" in data2

    def test_resources_endpoints(self, client, admin_headers, db_session):
        res = Resource(
            resource_id="s3-bucket-logs",
            type="s3",
            service="storage",
            region="eu-west-1",
            team_tag="infra",
        )
        db_session.add(res)
        db_session.commit()

        resp = client.get("/api/v1/resources", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

        resp_detail = client.get(f"/api/v1/resources/{res.resource_id}", headers=admin_headers)
        assert resp_detail.status_code == 200
        assert resp_detail.json()["resource_id"] == "s3-bucket-logs"

        resp_costs = client.get(f"/api/v1/resources/{res.resource_id}/costs", headers=admin_headers)
        assert resp_costs.status_code == 200
        assert "points" in resp_costs.json()

        resp_base = client.get(f"/api/v1/resources/{res.resource_id}/baseline", headers=admin_headers)
        assert resp_base.status_code == 200
        assert len(resp_base.json()["hours"]) == 24

    def test_jobs_endpoints(self, client, admin_headers, db_session):
        job = IngestionJob(
            submitted_by="admin",
            record_count=100,
            processed_count=100,
            status="done",
        )
        db_session.add(job)
        db_session.commit()

        resp = client.get("/api/v1/jobs", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

        resp_detail = client.get(f"/api/v1/jobs/{job.id}", headers=admin_headers)
        assert resp_detail.status_code == 200
        assert resp_detail.json()["status"] == "done"

    def test_anomaly_timeline(self, client, admin_headers, db_session):
        res = Resource(
            resource_id="rds-postgres-main",
            type="rds",
            service="database",
            region="us-west-2",
            team_tag="backend",
        )
        db_session.add(res)
        db_session.commit()

        now = datetime.now(timezone.utc)
        anom = Anomaly(
            scope="resource",
            resource_id=res.id,
            record_ts=now,
            observed_cost=120.0,
            expected_cost=20.0,
            z_score=5.0,
            pct_increase=500.0,
            severity="critical",
            method="z_score",
            status="open",
        )
        db_session.add(anom)
        db_session.commit()

        resp = client.get(f"/api/v1/anomalies/{anom.id}/timeline", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["anomaly_id"] == anom.id
        assert data["observed_cost"] == 120.0
        assert "points" in data
        assert "markers" in data

    def test_audit_logs_role_defense(self, client, admin_headers, analyst_headers):
        # Admin can view
        resp_admin = client.get("/api/v1/audit-logs", headers=admin_headers)
        assert resp_admin.status_code == 200
        assert isinstance(resp_admin.json(), list)

        # Analyst is forbidden
        resp_analyst = client.get("/api/v1/audit-logs", headers=analyst_headers)
        assert resp_analyst.status_code == 403

    def test_deployments_endpoints(self, client, admin_headers, db_session):
        dep = Deployment(
            version="1.0.0",
            color="blue",
            status="active",
            note="Initial release",
        )
        db_session.add(dep)
        db_session.commit()

        resp = client.get("/api/v1/admin/deployments", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

        resp_cur = client.get("/api/v1/admin/deployments/current", headers=admin_headers)
        assert resp_cur.status_code == 200
        assert resp_cur.json()["version"] == "1.0.0"

    def test_auth_users_and_api_clients(self, client, admin_headers, analyst_headers):
        # Users list
        resp = client.get("/api/v1/auth/users", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

        # Analyst cannot list users
        resp_forbidden = client.get("/api/v1/auth/users", headers=analyst_headers)
        assert resp_forbidden.status_code == 403

        # API clients list
        resp_clients = client.get("/api/v1/auth/api-clients", headers=admin_headers)
        assert resp_clients.status_code == 200
        assert isinstance(resp_clients.json(), list)
