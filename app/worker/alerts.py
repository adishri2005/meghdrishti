"""
Alert dispatcher: log + webhook + optional SMTP.

For each new or severity-escalated anomaly, we:
1. Log a structured WARNING (always — this is the baseline alerting channel).
2. If ALERT_WEBHOOK_URL is set, POST a JSON summary with a 3-second timeout.
3. Record the alert in the ``alerts`` table with delivery status.

A webhook failure must NEVER crash the worker — we catch all exceptions,
log the failure, and move on.  This is a fire-and-forget notification
system, not a critical path.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings
from app.models import Alert, Anomaly

logger = logging.getLogger("ccad.alerts")


def dispatch_alerts(db) -> None:
    """Send webhook alerts for any pending (log-only) alerts.

    This is called at the end of each worker batch.  We look for alerts
    that have channel='log' and check if a webhook URL is configured;
    if so, we send the webhook and add a new alert row for the webhook channel.
    """
    settings = get_settings()
    if not settings.alert_webhook_url:
        return

    # Find recent anomalies that have a log alert but no webhook alert
    recent_alerts = (
        db.query(Alert)
        .filter(Alert.channel == "log")
        .order_by(Alert.id.desc())
        .limit(20)
        .all()
    )

    for alert in recent_alerts:
        # Check if webhook already sent for this anomaly
        existing_webhook = (
            db.query(Alert)
            .filter(Alert.anomaly_id == alert.anomaly_id, Alert.channel == "webhook")
            .first()
        )
        if existing_webhook:
            continue

        anomaly = db.query(Anomaly).filter(Anomaly.id == alert.anomaly_id).first()
        if not anomaly:
            continue

        payload = {
            "anomaly_id": anomaly.id,
            "scope": anomaly.scope,
            "severity": anomaly.severity,
            "method": anomaly.method,
            "observed_cost": anomaly.observed_cost,
            "expected_cost": anomaly.expected_cost,
            "summary": anomaly.root_cause_summary,
            "detected_at": anomaly.detected_at.isoformat() if anomaly.detected_at else None,
        }

        status = "sent"
        detail = None
        try:
            resp = httpx.post(
                settings.alert_webhook_url,
                json=payload,
                timeout=3.0,
            )
            detail = f"HTTP {resp.status_code}"
            if resp.status_code >= 400:
                status = "failed"
                logger.warning(
                    f"Webhook alert failed: HTTP {resp.status_code}",
                    extra={"event": "alert_failed", "anomaly_id": anomaly.id},
                )
        except Exception as exc:
            status = "failed"
            detail = str(exc)[:200]
            logger.warning(
                f"Webhook alert failed: {exc}",
                extra={"event": "alert_failed", "anomaly_id": anomaly.id},
            )

        webhook_alert = Alert(
            anomaly_id=anomaly.id,
            channel="webhook",
            delivery_status=status,
            detail=detail,
        )
        db.add(webhook_alert)

        if status == "sent":
            logger.info(
                f"Webhook alert sent for anomaly {anomaly.id}",
                extra={"event": "alert_sent", "anomaly_id": anomaly.id, "channel": "webhook"},
            )
