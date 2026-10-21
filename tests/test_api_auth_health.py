"""Integration tests for Health and Auth API endpoints."""

from app.security import create_access_token


class TestHealthAndMetricsEndpoints:
    def test_health_endpoint_returns_json(self, client):
        resp = client.get("/health")
        # In test environment, returns 200 or 503 depending on Redis reachability
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert "version" in data
        assert "color" in data

    def test_liveness_endpoint(self, client):
        resp = client.get("/health/live")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "alive"
        assert "version" in data

    def test_readiness_endpoint(self, client):
        resp = client.get("/health/ready")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert "db" in data
        assert "redis" in data

    def test_metrics_endpoint_returns_prometheus_format(self, client):
        resp = client.get("/metrics")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers.get("content-type", "")
        assert any(k in resp.text for k in ("meghdrishti", "ccad", "python"))

    def test_request_id_middleware(self, client):
        custom_rid = "custom-test-uuid-1234"
        resp = client.get("/health", headers={"X-Request-ID": custom_rid})
        assert resp.headers.get("X-Request-ID") == custom_rid

    def test_security_headers_middleware(self, client):
        resp = client.get("/health")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "SAMEORIGIN"
        assert resp.headers.get("X-XSS-Protection") == "0"
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "camera=()" in resp.headers.get("Permissions-Policy", "")


class TestAuthEndpoints:
    def test_login_success(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@12345"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "admin"
        assert data["expires_in"] > 0

    def test_login_invalid_password(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "WrongPassword"},
        )
        assert resp.status_code == 401
        assert "Invalid username or password" in resp.json()["detail"]

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "AnyPassword"},
        )
        assert resp.status_code == 401

    def test_login_disabled_user(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "disabled_user", "password": "Disabled@12345"},
        )
        assert resp.status_code == 401
        assert "disabled" in resp.json()["detail"]

    def test_admin_can_register_user(self, client):
        token, _ = create_access_token("admin", "admin")
        resp = client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {token}"},
            json={"username": "newanalyst", "password": "SecurePassword123!", "role": "analyst"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newanalyst"
        assert data["role"] == "analyst"

    def test_analyst_cannot_register_user(self, client):
        token, _ = create_access_token("analyst", "analyst")
        resp = client.post(
            "/api/v1/auth/register",
            headers={"Authorization": f"Bearer {token}"},
            json={"username": "anotheruser", "password": "SecurePassword123!", "role": "analyst"},
        )
        assert resp.status_code == 403

    def test_admin_can_create_api_client(self, client):
        token, _ = create_access_token("admin", "admin")
        resp = client.post(
            "/api/v1/auth/api-clients",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "ingestion-worker-pipeline"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "ingestion-worker-pipeline"
        assert "api_key" in data
        assert len(data["api_key"]) > 20
