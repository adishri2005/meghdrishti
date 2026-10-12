"""
Redis Streams queue helpers.

Why Redis Streams (not a simple list or Pub/Sub): Streams give us
consumer groups with at-least-once delivery, per-message acknowledgment,
and XAUTOCLAIM for crash recovery — exactly the semantics needed for
reliable asynchronous processing where losing a cost record is
unacceptable.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

from app.cache import get_redis
from app.metrics import RECORDS_INGESTED

logger = logging.getLogger("ccad.queue")

# Stream names (constants so they're referenced consistently)
STREAM_COST_RECORDS = "cost_records"
STREAM_DLQ = "cost_records_dlq"
CONSUMER_GROUP = "detectors"


def ensure_consumer_group() -> None:
    """Create the consumer group if it doesn't already exist.

    ``BUSYGROUP`` means the group already exists — we tolerate that
    because multiple containers may race during startup.
    """
    r = get_redis()
    for stream in (STREAM_COST_RECORDS,):
        try:
            r.xgroup_create(stream, CONSUMER_GROUP, id="0", mkstream=True)
            logger.info(
                f"Created consumer group '{CONSUMER_GROUP}' on '{stream}'",
                extra={"event": "queue_group_created"},
            )
        except Exception as exc:
            if "BUSYGROUP" in str(exc):
                pass  # already exists, fine
            else:
                raise


def enqueue_records(
    records: list[dict[str, Any]],
    job_id: str,
    backfill: bool = False,
) -> int:
    """Add records to the cost_records stream.

    Uses a Redis pipeline for efficiency — all XADDs are sent in one
    round-trip.  Returns the number of messages enqueued.
    """
    r = get_redis()
    pipe = r.pipeline(transaction=False)
    enqueued_at = str(time.time())

    for rec in records:
        pipe.xadd(
            STREAM_COST_RECORDS,
            {
                "job_id": str(job_id),
                "payload": json.dumps(rec, default=str),
                "enqueued_at": enqueued_at,
                "backfill": "1" if backfill else "0",
                "attempt": "0",
            },
        )

    results = pipe.execute()
    count = sum(1 for r in results if r)
    RECORDS_INGESTED.labels(source="api").inc(count)
    return count


def format_dlq_entry(fields: dict, error: str) -> dict[str, str]:
    """Format dictionary for writing to DLQ stream."""
    return {**fields, "error": error, "dlq_at": str(time.time())}


def deserialize_stream_message(fields: dict) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """Safely decode Redis stream fields into a structured record dictionary.

    Returns:
        (record_dict, None) on success.
        (None, error_message) on malformed envelope or corrupt JSON.
    """
    if "payload" not in fields:
        return None, "Missing 'payload' field in stream message"

    raw_payload = fields["payload"]
    if isinstance(raw_payload, bytes):
        raw_payload = raw_payload.decode("utf-8", errors="replace")

    try:
        data = json.loads(raw_payload)
        if not isinstance(data, dict):
            return None, f"Payload must decode to a JSON object, got {type(data).__name__}"
        return data, None
    except Exception as exc:
        return None, f"JSON decode error: {exc}"


def move_to_dlq(message_id: str, fields: dict, error: str) -> None:
    """Move a failed message to the dead-letter queue after max retries.

    The DLQ entry includes the original payload plus the error message,
    so operators can inspect failures without guessing.
    """
    r = get_redis()
    dlq_fields = format_dlq_entry(fields, error)
    r.xadd(STREAM_DLQ, dlq_fields)
    r.xack(STREAM_COST_RECORDS, CONSUMER_GROUP, message_id)
    logger.error(
        f"Message {message_id} moved to DLQ",
        extra={"event": "worker_dlq", "message_id": message_id, "error": error},
    )


def get_queue_stats() -> dict[str, int]:
    """Return queue lag and DLQ length for metrics."""
    r = get_redis()
    stats = {"lag": 0, "dlq_length": 0}
    try:
        groups = r.xinfo_groups(STREAM_COST_RECORDS)
        for g in groups:
            if g.get("name") == CONSUMER_GROUP:
                # 'lag' field is available in Redis 7+; fall back to pending
                stats["lag"] = g.get("lag", g.get("pending", 0))
                break
    except Exception:
        try:
            stats["lag"] = r.xlen(STREAM_COST_RECORDS)
        except Exception:
            pass
    try:
        stats["dlq_length"] = r.xlen(STREAM_DLQ)
    except Exception:
        pass
    return stats
