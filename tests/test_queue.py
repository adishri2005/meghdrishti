"""Tests for Redis queue message envelope serialization, deserialization, and DLQ handling."""

import json
from app.queue import deserialize_stream_message, format_dlq_entry


class TestQueueMessageHandling:
    def test_deserialize_valid_message(self):
        payload_data = {
            "resource_id": "ec2-node-01",
            "cost": 12.5,
            "timestamp": "2026-10-11T12:00:00Z",
        }
        fields = {
            "job_id": "job-1234",
            "payload": json.dumps(payload_data),
            "enqueued_at": "1760000000.0",
        }
        record, error = deserialize_stream_message(fields)
        assert error is None
        assert record == payload_data

    def test_deserialize_bytes_payload(self):
        payload_data = {"resource_id": "s3-bucket-01", "cost": 1.25}
        fields = {
            "job_id": "job-5678",
            "payload": json.dumps(payload_data).encode("utf-8"),
        }
        record, error = deserialize_stream_message(fields)
        assert error is None
        assert record == payload_data

    def test_deserialize_missing_payload(self):
        fields = {"job_id": "job-no-payload"}
        record, error = deserialize_stream_message(fields)
        assert record is None
        assert "Missing 'payload'" in error

    def test_deserialize_corrupt_json(self):
        fields = {
            "job_id": "job-corrupt",
            "payload": "{invalid json: true",
        }
        record, error = deserialize_stream_message(fields)
        assert record is None
        assert "JSON decode error" in error

    def test_deserialize_non_dict_payload(self):
        fields = {
            "job_id": "job-list",
            "payload": json.dumps(["not", "a", "dict"]),
        }
        record, error = deserialize_stream_message(fields)
        assert record is None
        assert "must decode to a JSON object" in error

    def test_format_dlq_entry(self):
        fields = {"job_id": "job-bad", "payload": "corrupt"}
        err_msg = "Validation failed: cost is negative"
        entry = format_dlq_entry(fields, err_msg)
        assert entry["job_id"] == "job-bad"
        assert entry["payload"] == "corrupt"
        assert entry["error"] == err_msg
        assert "dlq_at" in entry
