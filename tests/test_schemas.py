"""Tests for Pydantic schema validation rules."""

from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas import CostRecordIn, BatchIngestRequest, LoginRequest, RegisterRequest


class TestCostRecordInValidation:
    def test_valid_record(self):
        rec = CostRecordIn(
            resource_id="ec2-test-01",
            type="ec2",
            service="compute",
            region="us-east-1",
            team_tag="platform",
            timestamp=datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc),
            usage_quantity=1.0,
            unit_cost=0.5,
            cost=0.5,
        )
        assert rec.resource_id == "ec2-test-01"
        assert rec.cost == 0.5

    def test_rejects_nan_cost(self):
        with pytest.raises(ValidationError) as exc:
            CostRecordIn(
                resource_id="ec2-test-01",
                type="ec2",
                service="compute",
                region="us-east-1",
                team_tag="platform",
                timestamp=datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc),
                usage_quantity=1.0,
                unit_cost=0.5,
                cost=float("nan"),
            )
        assert "finite" in str(exc.value)

    def test_rejects_inf_cost(self):
        with pytest.raises(ValidationError) as exc:
            CostRecordIn(
                resource_id="ec2-test-01",
                type="ec2",
                service="compute",
                region="us-east-1",
                team_tag="platform",
                timestamp=datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc),
                usage_quantity=float("inf"),
                unit_cost=0.5,
                cost=0.5,
            )
        assert "finite" in str(exc.value)

    def test_rejects_negative_cost(self):
        with pytest.raises(ValidationError):
            CostRecordIn(
                resource_id="ec2-test-01",
                type="ec2",
                service="compute",
                region="us-east-1",
                team_tag="platform",
                timestamp=datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc),
                usage_quantity=1.0,
                unit_cost=0.5,
                cost=-1.0,
            )

    def test_rejects_ancient_timestamp(self):
        with pytest.raises(ValidationError) as exc:
            CostRecordIn(
                resource_id="ec2-test-01",
                type="ec2",
                service="compute",
                region="us-east-1",
                team_tag="platform",
                timestamp=datetime(2010, 1, 1, 0, 0, tzinfo=timezone.utc),
                usage_quantity=1.0,
                unit_cost=0.5,
                cost=0.5,
            )
        assert "earlier than 2020" in str(exc.value)


class TestAuthSchemas:
    def test_register_role_pattern(self):
        with pytest.raises(ValidationError):
            RegisterRequest(username="baduser", password="Password123!", role="superadmin")

    def test_valid_login_request(self):
        req = LoginRequest(username="admin", password="password")
        assert req.username == "admin"
