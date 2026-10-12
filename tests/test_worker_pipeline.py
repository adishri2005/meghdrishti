"""Unit and integration tests for worker stream consumption pipeline."""

from datetime import datetime, timezone
import json
import pytest
from unittest.mock import MagicMock, patch

from app.models import CostRecord, Resource
from app.worker.main import insert_cost_record, process_batch, upsert_resource


def test_upsert_resource(db_session):
    payload = {
        "resource_id": "i-0123456789abcdef0",
        "type": "ec2",
        "service": "compute",
        "region": "us-east-1",
        "team_tag": "platform",
    }

    # First insert: is_new should be True
    res_id, meta, is_new = upsert_resource(db_session, payload)
    assert is_new is True
    assert res_id > 0
    assert meta["service"] == "compute"
    assert meta["team_tag"] == "platform"

    # Second insert with same resource_id: returns existing, is_new is False
    res_id2, meta2, is_new2 = upsert_resource(db_session, payload)
    assert is_new2 is False
    assert res_id2 == res_id
    assert meta2["service"] == "compute"


def test_insert_cost_record_idempotency(db_session):
    payload = {
        "resource_id": "i-test-idempotent",
        "type": "ec2",
        "service": "compute",
        "region": "us-east-1",
        "team_tag": "platform",
        "timestamp": "2026-10-12T10:00:00Z",
        "usage_quantity": 1.0,
        "unit_cost": 12.50,
        "cost": 12.50,
    }
    res_id, _, _ = upsert_resource(db_session, payload)
    db_session.commit()

    # First insert: returns True
    inserted_first = insert_cost_record(db_session, res_id, payload, job_id="")
    db_session.commit()
    assert inserted_first is True

    # Duplicate insert: returns False due to ON CONFLICT DO NOTHING
    inserted_second = insert_cost_record(db_session, res_id, payload, job_id="")
    db_session.commit()
    assert inserted_second is False

    records = db_session.query(CostRecord).filter(CostRecord.resource_id == res_id).all()
    assert len(records) == 1
    assert float(records[0].cost) == 12.50


def test_process_batch_pipeline(db_session, monkeypatch):
    """Verify that process_batch successfully runs detection, commits, and acks messages."""
    # Wire get_session_factory to return our db_session
    mock_session_factory = MagicMock(return_value=db_session)
    mock_redis = MagicMock()

    messages = [
        (
            "1728730000000-0",
            {
                "payload": json.dumps({
                    "resource_id": "vol-batch-test",
                    "type": "ebs",
                    "service": "storage",
                    "region": "us-west-2",
                    "team_tag": "devops",
                    "timestamp": "2026-10-12T12:00:00Z",
                    "usage_quantity": 100.0,
                    "unit_cost": 0.10,
                    "cost": 10.0,
                }),
                "job_id": "",
                "enqueued_at": "1728730000",
                "backfill": "0",
                "attempt": "0",
            },
        )
    ]

    cfg_cache = {}

    with (
        patch("app.worker.main.get_session_factory", return_value=mock_session_factory),
        patch("app.worker.main.get_redis", return_value=mock_redis),
        patch("app.worker.main.dispatch_alerts") as mock_dispatch,
    ):
        process_batch(messages, consumer_name="test-worker-1", cfg_cache=cfg_cache)
        assert mock_redis.xack.called
        assert mock_dispatch.called

    # Check resource was created
    res = db_session.query(Resource).filter(Resource.resource_id == "vol-batch-test").first()
    assert res is not None
    assert res.service == "storage"
