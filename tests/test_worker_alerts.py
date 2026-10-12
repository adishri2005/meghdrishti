"""Tests for worker alert dispatching, webhooks, error handling, and idempotency."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.config import get_settings
from app.models import Alert, Anomaly, Resource
from app.worker.alerts import dispatch_alerts


def test_dispatch_alerts_no_webhook_url(db_session, monkeypatch):
    """When alert_webhook_url is unset, dispatch_alerts should return without action."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "")
    get_settings.cache_clear()

    # Pre-seed anomaly and log alert
    res = Resource(resource_id="res-alert-1", type="ec2", service="compute", region="us-east-1", team_tag="core")
    db_session.add(res)
    db_session.commit()

    now = datetime.now(timezone.utc)
    anom = Anomaly(
        scope="resource",
        resource_id=res.id,
        record_ts=now,
        observed_cost=100.0,
        expected_cost=10.0,
        severity="critical",
        method="zscore",
        status="open",
    )
    db_session.add(anom)
    db_session.commit()

    log_alert = Alert(anomaly_id=anom.id, channel="log", delivery_status="sent")
    db_session.add(log_alert)
    db_session.commit()

    dispatch_alerts(db_session)
    webhook_alerts = db_session.query(Alert).filter(Alert.channel == "webhook").all()
    assert len(webhook_alerts) == 0


def test_dispatch_alerts_success(db_session, monkeypatch):
    """Successful webhook POST creates sent webhook Alert row."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/test")
    get_settings.cache_clear()

    res = Resource(resource_id="res-alert-2", type="ec2", service="compute", region="us-east-1", team_tag="core")
    db_session.add(res)
    db_session.commit()

    now = datetime.now(timezone.utc)
    anom = Anomaly(
        scope="resource",
        resource_id=res.id,
        record_ts=now,
        observed_cost=200.0,
        expected_cost=20.0,
        severity="critical",
        method="zscore",
        status="open",
        root_cause_summary="Sudden surge in GPU instances",
    )
    db_session.add(anom)
    db_session.commit()

    log_alert = Alert(anomaly_id=anom.id, channel="log", delivery_status="sent")
    db_session.add(log_alert)
    db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("httpx.post", return_value=mock_resp) as mock_post:
        dispatch_alerts(db_session)
        assert mock_post.called
        call_args, call_kwargs = mock_post.call_args
        assert call_args[0] == "https://hooks.slack.com/services/test"
        payload = call_kwargs["json"]
        assert payload["anomaly_id"] == anom.id
        assert payload["observed_cost"] == 200.0
        assert payload["summary"] == "Sudden surge in GPU instances"

    db_session.commit()
    webhook_alert = (
        db_session.query(Alert)
        .filter(Alert.anomaly_id == anom.id, Alert.channel == "webhook")
        .first()
    )
    assert webhook_alert is not None
    assert webhook_alert.delivery_status == "sent"
    assert webhook_alert.detail == "HTTP 200"


def test_dispatch_alerts_http_error_handling(db_session, monkeypatch):
    """Webhook returning 500 records failed delivery status without raising."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/fail")
    get_settings.cache_clear()

    res = Resource(resource_id="res-alert-3", type="s3", service="storage", region="us-east-1", team_tag="core")
    db_session.add(res)
    db_session.commit()

    now = datetime.now(timezone.utc)
    anom = Anomaly(
        scope="resource",
        resource_id=res.id,
        record_ts=now,
        observed_cost=500.0,
        expected_cost=50.0,
        severity="high",
        method="zscore",
        status="open",
    )
    db_session.add(anom)
    db_session.commit()

    log_alert = Alert(anomaly_id=anom.id, channel="log", delivery_status="sent")
    db_session.add(log_alert)
    db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 502

    with patch("httpx.post", return_value=mock_resp):
        dispatch_alerts(db_session)

    db_session.commit()
    webhook_alert = (
        db_session.query(Alert)
        .filter(Alert.anomaly_id == anom.id, Alert.channel == "webhook")
        .first()
    )
    assert webhook_alert is not None
    assert webhook_alert.delivery_status == "failed"
    assert "HTTP 502" in webhook_alert.detail


def test_dispatch_alerts_network_timeout_handling(db_session, monkeypatch):
    """Network exception during webhook call is safely caught and logged."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/timeout")
    get_settings.cache_clear()

    res = Resource(resource_id="res-alert-4", type="s3", service="storage", region="us-east-1", team_tag="core")
    db_session.add(res)
    db_session.commit()

    now = datetime.now(timezone.utc)
    anom = Anomaly(
        scope="resource",
        resource_id=res.id,
        record_ts=now,
        observed_cost=500.0,
        expected_cost=50.0,
        severity="high",
        method="zscore",
        status="open",
    )
    db_session.add(anom)
    db_session.commit()

    log_alert = Alert(anomaly_id=anom.id, channel="log", delivery_status="sent")
    db_session.add(log_alert)
    db_session.commit()

    with patch("httpx.post", side_effect=TimeoutError("Connection timed out")):
        dispatch_alerts(db_session)

    db_session.commit()
    webhook_alert = (
        db_session.query(Alert)
        .filter(Alert.anomaly_id == anom.id, Alert.channel == "webhook")
        .first()
    )
    assert webhook_alert is not None
    assert webhook_alert.delivery_status == "failed"
    assert "Connection timed out" in webhook_alert.detail
