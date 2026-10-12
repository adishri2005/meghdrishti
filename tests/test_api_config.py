"""Integration tests for Config / Thresholds API."""

import pytest
from app.models import AuditLog, SettingsRow
from app.security import create_access_token


@pytest.fixture
def admin_token():
    token, _ = create_access_token("admin", "admin")
    return token


@pytest.fixture
def analyst_token():
    token, _ = create_access_token("analyst", "analyst")
    return token


class TestConfigApi:
    def test_get_thresholds_unauthorized(self, client):
        resp = client.get("/api/v1/config/thresholds")
        assert resp.status_code == 401

    def test_get_thresholds_as_analyst(self, client, analyst_token):
        resp = client.get(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "detection" in data
        assert "severity" in data
        assert "z_threshold" in data["detection"]
        assert "critical" in data["severity"]

    def test_update_thresholds_forbidden_for_analyst(self, client, analyst_token):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json={"detection": {"z_threshold": 4.0}},
        )
        assert resp.status_code == 403

    def test_update_thresholds_detection_success(self, client, admin_token, db_session):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"detection": {"z_threshold": 4.5, "min_samples": 8}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["detection"]["z_threshold"] == 4.5
        assert data["detection"]["min_samples"] == 8

        # Verify persisted in database
        row = db_session.query(SettingsRow).filter(SettingsRow.key == "detection").first()
        assert row is not None
        assert row.value["z_threshold"] == 4.5

    def test_update_thresholds_invalid_detection_range(self, client, admin_token):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"detection": {"z_threshold": -1.0}},
        )
        assert resp.status_code == 400
        assert "z_threshold must be between 0 and 50" in resp.json()["detail"]

    def test_update_thresholds_severity_success(self, client, admin_token):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"severity": {"critical": {"z": 12.0}}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["severity"]["critical"]["z"] == 12.0
        # Check that previous fields like pct were preserved by deep merge
        assert "pct" in data["severity"]["critical"]

    def test_update_thresholds_severity_non_monotonic_rejected(self, client, admin_token):
        # critical.z must be greater than high.z (default high.z is 6)
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"severity": {"critical": {"z": 5.0}}},
        )
        assert resp.status_code == 400
        assert "critical.z must be greater than high.z" in resp.json()["detail"]

    def test_update_thresholds_severity_invalid_key_rejected(self, client, admin_token):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"severity": {"super_critical": {"z": 20.0}}},
        )
        assert resp.status_code == 400
        assert "Invalid severity level" in resp.json()["detail"]

    def test_update_thresholds_writes_audit_log(self, client, admin_token, db_session):
        resp = client.put(
            "/api/v1/config/thresholds",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"detection": {"pct_jump_threshold": 75.0}},
        )
        assert resp.status_code == 200

        audit = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "config_changed")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert audit is not None
        assert audit.actor == "admin"
        assert audit.result == "success"

    def test_production_startup_fails_with_default_secrets(self):
        from app.config import Settings
        with pytest.raises(ValueError, match="CRITICAL SECURITY CONFIGURATION ERROR"):
            Settings(
                environment="production",
                jwt_secret="change_me_to_a_long_random_string",
                admin_password="Admin@12345",
            )

    def test_production_startup_succeeds_with_strong_secrets(self):
        from app.config import Settings
        settings = Settings(
            environment="production",
            jwt_secret="super-secure-production-jwt-token-entropy-32-chars-long!",
            admin_password="StrongProdAdminPassword99#",
            analyst_password="StrongProdAnalystPassword99#",
            service_api_key="strong-random-service-key-12345678",
            postgres_password="strong_pg_password_99#",
        )
        assert settings.environment == "production"
