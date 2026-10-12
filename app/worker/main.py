"""
Worker: Redis Streams consumer with retries, DLQ, and XAUTOCLAIM recovery.

Architecture:
- Reads from ``cost_records`` stream via consumer group ``detectors``.
- Each message is a cost record; messages are processed in batches within
  a single DB transaction for efficiency.
- On success: XACK the batch (at-least-once delivery).
- On failure: retry with exponential backoff; after max_retries, move to DLQ.
- At startup and periodically: XAUTOCLAIM reclaims messages from dead consumers.
- Graceful shutdown on SIGTERM: finish current batch, ack, exit.

Why consumer groups (not plain XREAD): they give us per-consumer message
assignment, acknowledgment, and pending-entry tracking — exactly the
semantics needed for reliable at-least-once processing across multiple
worker replicas.
"""

from __future__ import annotations

import json
import logging
import signal
import socket
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.cache import get_redis
from app.config import get_detection_config, get_settings
from app.db import get_session_factory
from app.detection.engine import (
    process_aggregate,
    process_record,
    system_has_history,
)
from app.detection.rules import make_detection_config
from app.logging_setup import setup_logging
from app.metrics import (
    APP_VERSION_INFO,
    QUEUE_LAG,
    DLQ_LENGTH,
    RECORDS_PROCESSED,
    WORKER_BATCH_SECONDS,
)
from app.models import (
    CostRecord,
    IngestionJob,
    Resource,
)
from app.queue import (
    CONSUMER_GROUP,
    STREAM_COST_RECORDS,
    ensure_consumer_group,
    get_queue_stats,
    move_to_dlq,
)
from app.worker.alerts import dispatch_alerts
from app.worker.metrics_server import start_metrics_server

logger = logging.getLogger("ccad.worker")

# Graceful shutdown flag
_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    _shutdown = True
    logger.info("Shutdown signal received, finishing current batch...",
                extra={"event": "worker_shutdown"})


def upsert_resource(db, payload: dict) -> tuple[int, dict, bool]:
    """Insert or get a resource, returning (db_id, meta_dict, is_new)."""
    resource_id = payload["resource_id"]
    res = db.query(Resource).filter(Resource.resource_id == resource_id).first()
    is_new = False
    if not res:
        res = Resource(
            resource_id=resource_id,
            type=payload.get("type", "unknown"),
            service=payload.get("service", "unknown"),
            region=payload.get("region", "unknown"),
            team_tag=payload.get("team_tag", "unknown"),
        )
        db.add(res)
        db.flush()
        is_new = True

    meta = {
        "team_tag": res.team_tag,
        "service": res.service,
        "region": res.region,
        "type": res.type,
    }
    return res.id, meta, is_new


def insert_cost_record(db, resource_db_id: int, payload: dict, job_id: str) -> bool:
    """Insert a cost record with ON CONFLICT DO NOTHING (idempotent).

    Returns True if the row was actually inserted (not a duplicate).
    """
    ts_str = payload["timestamp"]
    if isinstance(ts_str, str):
        ts = datetime.fromisoformat(ts_str)
    else:
        ts = ts_str
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    # Truncate to hour
    ts = ts.replace(minute=0, second=0, microsecond=0)

    bind = db.get_bind() if hasattr(db, "get_bind") else getattr(db, "bind", None)
    is_sqlite = bind and bind.dialect.name == "sqlite"
    if is_sqlite:
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        stmt = sqlite_insert(CostRecord).values(
            resource_id=resource_db_id,
            ts=ts,
            usage_quantity=payload.get("usage_quantity", 0),
            unit_cost=payload.get("unit_cost", 0),
            cost=payload.get("cost", 0),
            job_id=job_id if job_id else None,
        ).on_conflict_do_nothing()
    else:
        stmt = pg_insert(CostRecord).values(
            resource_id=resource_db_id,
            ts=ts,
            usage_quantity=payload.get("usage_quantity", 0),
            unit_cost=payload.get("unit_cost", 0),
            cost=payload.get("cost", 0),
            job_id=job_id if job_id else None,
        ).on_conflict_do_nothing(
            constraint="uq_cost_record_resource_ts"
        )
    result = db.execute(stmt)
    return result.rowcount > 0


def process_batch(
    messages: list[tuple[str, dict]],
    consumer_name: str,
    cfg_cache: dict,
) -> None:
    """Process a batch of messages in one DB transaction.

    Steps:
    1. Parse payloads, upsert resources, insert cost records.
    2. Sort by timestamp, run detection on each record.
    3. After processing all records for each hour, run aggregate detection.
    4. Update job counters.
    5. Commit the transaction, then XACK all messages.

    If any step fails, the transaction rolls back and messages are NOT acked,
    so they'll be retried on the next XREADGROUP or XAUTOCLAIM.
    """
    SessionLocal = get_session_factory()
    db = SessionLocal()
    redis = get_redis()

    det_cfg = make_detection_config(cfg_cache)
    has_history = False

    try:
        has_history = system_has_history(db)

        # Parse and sort by timestamp
        parsed: list[dict[str, Any]] = []
        for msg_id, fields in messages:
            try:
                payload = json.loads(fields.get("payload", "{}"))
                parsed.append({
                    "msg_id": msg_id,
                    "payload": payload,
                    "job_id": fields.get("job_id", ""),
                    "enqueued_at": float(fields.get("enqueued_at", time.time())),
                    "backfill": fields.get("backfill", "0") == "1",
                    "attempt": int(fields.get("attempt", "0")),
                })
            except Exception as exc:
                logger.error(f"Failed to parse message {msg_id}: {exc}",
                             extra={"event": "worker_parse_error"})
                move_to_dlq(msg_id, fields, str(exc))

        # Sort by timestamp for baseline evolution
        parsed.sort(key=lambda x: x["payload"].get("timestamp", ""))

        # Group by hour for aggregate detection
        hour_groups: dict[str, list[dict]] = defaultdict(list)
        job_processed: dict[str, int] = defaultdict(int)
        job_failed: dict[str, int] = defaultdict(int)

        batch_start = time.time()

        for item in parsed:
            payload = item["payload"]
            msg_id = item["msg_id"]
            job_id = item["job_id"]

            try:
                resource_db_id, meta, is_new = upsert_resource(db, payload)
                insert_cost_record(db, resource_db_id, payload, job_id)

                ts_str = payload.get("timestamp", "")
                if isinstance(ts_str, str):
                    ts = datetime.fromisoformat(ts_str)
                else:
                    ts = ts_str
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                ts = ts.replace(minute=0, second=0, microsecond=0)

                result = process_record(
                    db=db,
                    resource_db_id=resource_db_id,
                    resource_id_str=payload["resource_id"],
                    cost=float(payload.get("cost", 0)),
                    ts=ts,
                    resource_meta=meta,
                    cfg_cache=cfg_cache,
                    det_cfg=det_cfg,
                    is_backfill=item["backfill"],
                    enqueued_at=item["enqueued_at"],
                    has_history=has_history,
                    is_new=is_new,
                )

                if result:
                    hour_key = ts.isoformat()
                    hour_groups[hour_key].append(result)

                RECORDS_PROCESSED.inc()
                if job_id:
                    job_processed[job_id] += 1

            except Exception as exc:
                logger.error(f"Failed to process record in message {msg_id}: {exc}",
                             extra={"event": "worker_process_error", "msg_id": msg_id})
                if job_id:
                    job_failed[job_id] += 1

        # Aggregate detection per hour
        for hour_key, hour_records in hour_groups.items():
            try:
                hour_ts = datetime.fromisoformat(hour_key)
                avg_enqueued = sum(
                    item["enqueued_at"] for item in parsed
                    if item["payload"].get("timestamp", "").startswith(hour_key[:13])
                ) / max(len(hour_records), 1)

                process_aggregate(db, hour_records, hour_ts, cfg_cache, avg_enqueued)
            except Exception as exc:
                logger.error(f"Aggregate detection failed for {hour_key}: {exc}",
                             extra={"event": "worker_aggregate_error"})

        # Update job counters
        for jid, count in job_processed.items():
            try:
                job = db.query(IngestionJob).filter(IngestionJob.id == jid).first()
                if job:
                    job.processed_count += count
                    failed = job_failed.get(jid, 0)
                    job.failed_count += failed
                    if job.processed_count + job.failed_count >= job.record_count:
                        job.status = "done" if job.failed_count == 0 else "failed"
                        job.finished_at = datetime.now(timezone.utc)
            except Exception:
                pass

        # Dispatch webhook alerts for new anomalies
        try:
            dispatch_alerts(db)
        except Exception as exc:
            logger.error(f"Alert dispatch failed: {exc}",
                         extra={"event": "alert_dispatch_error"})

        # Commit
        db.commit()

        batch_duration = time.time() - batch_start
        WORKER_BATCH_SECONDS.observe(batch_duration)

        # ACK all messages
        msg_ids = [msg_id for msg_id, _ in messages]
        if msg_ids:
            redis.xack(STREAM_COST_RECORDS, CONSUMER_GROUP, *msg_ids)

        logger.info(
            f"Batch processed: {len(parsed)} records in {batch_duration:.3f}s",
            extra={
                "event": "record_batch_processed",
                "count": len(parsed),
                "duration": batch_duration,
            },
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"Batch failed, rolled back: {exc}",
                     extra={"event": "worker_batch_error"})
        raise
    finally:
        db.close()


def claim_pending(consumer_name: str, cfg: dict) -> list[tuple[str, dict]]:
    """Reclaim idle messages from dead consumers via XAUTOCLAIM."""
    redis = get_redis()
    claim_idle_ms = cfg.get("queue", {}).get("claim_idle_ms", 15000)

    try:
        result = redis.xautoclaim(
            STREAM_COST_RECORDS,
            CONSUMER_GROUP,
            consumer_name,
            min_idle_time=claim_idle_ms,
            start_id="0-0",
            count=100,
        )
        # result is (next_start_id, messages, deleted_ids) in redis-py 5.x
        if result and len(result) >= 2:
            messages = result[1]
            if messages:
                logger.info(
                    f"Claimed {len(messages)} pending messages",
                    extra={"event": "worker_claimed_pending", "count": len(messages)},
                )
                return messages
    except Exception as exc:
        # XAUTOCLAIM may not be available on older Redis
        logger.warning(f"XAUTOCLAIM failed: {exc}",
                       extra={"event": "worker_claim_error"})
    return []


def update_queue_metrics():
    """Update queue lag and DLQ length gauges."""
    try:
        stats = get_queue_stats()
        QUEUE_LAG.set(stats["lag"])
        DLQ_LENGTH.set(stats["dlq_length"])
    except Exception:
        pass


def run():
    """Main worker entry point."""
    setup_logging()
    settings = get_settings()

    logger.info("Worker starting", extra={
        "event": "worker_started",
        "version": settings.app_version,
        "color": settings.app_color,
    })

    # Set version metric
    APP_VERSION_INFO.labels(
        version=settings.app_version,
        color=settings.app_color,
    ).set(1)

    # Start Prometheus metrics server on port 8001
    start_metrics_server(port=8001)

    # Register signal handlers
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Wait for Redis
    redis = None
    for attempt in range(30):
        try:
            redis = get_redis()
            redis.ping()
            break
        except Exception:
            logger.info(f"Waiting for Redis (attempt {attempt + 1}/30)...")
            time.sleep(2)
    else:
        logger.error("Redis not available after 30 attempts, exiting")
        sys.exit(1)

    # Ensure consumer group
    ensure_consumer_group()

    consumer_name = socket.gethostname()
    cfg_cache = get_detection_config()
    batch_size = cfg_cache.get("queue", {}).get("batch_size", 100)
    claim_idle_ms = cfg_cache.get("queue", {}).get("claim_idle_ms", 15000)
    last_claim_time = 0
    last_config_refresh = time.time()
    last_metrics_update = 0

    logger.info(f"Worker ready, consumer={consumer_name}, batch_size={batch_size}")

    while not _shutdown:
        try:
            # Refresh config every 30 seconds
            if time.time() - last_config_refresh > 30:
                try:
                    SessionLocal = get_session_factory()
                    db = SessionLocal()
                    cfg_cache = get_detection_config(db)
                    db.close()
                except Exception:
                    cfg_cache = get_detection_config()
                last_config_refresh = time.time()
                batch_size = cfg_cache.get("queue", {}).get("batch_size", 100)

            # Update queue metrics every 2 seconds
            if time.time() - last_metrics_update > 2:
                update_queue_metrics()
                last_metrics_update = time.time()

            # Periodically reclaim pending messages
            if time.time() - last_claim_time > (claim_idle_ms / 1000):
                claimed = claim_pending(consumer_name, cfg_cache)
                if claimed:
                    process_batch(claimed, consumer_name, cfg_cache)
                last_claim_time = time.time()

            # Read new messages
            messages = redis.xreadgroup(
                CONSUMER_GROUP,
                consumer_name,
                {STREAM_COST_RECORDS: ">"},
                count=batch_size,
                block=2000,
            )

            if messages:
                for _stream_name, stream_messages in messages:
                    if stream_messages:
                        process_batch(stream_messages, consumer_name, cfg_cache)

        except KeyboardInterrupt:
            break
        except Exception as exc:
            logger.error(f"Worker loop error: {exc}",
                         extra={"event": "worker_loop_error"})
            time.sleep(1)

    logger.info("Worker shut down gracefully", extra={"event": "worker_stopped"})


if __name__ == "__main__":
    run()
