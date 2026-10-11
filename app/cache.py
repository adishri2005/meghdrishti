"""
Redis cache helpers with hit/miss counters.

Why Redis for caching: the cost summary endpoint does an expensive GROUP BY
query; caching the result for 60 seconds avoids redundant DB hits under
load.  Redis is already in the stack for the message queue, so no new
infrastructure is needed.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis as redis_lib

from app.config import get_settings
from app.metrics import CACHE_HITS, CACHE_MISSES

logger = logging.getLogger("ccad.cache")

_redis_client: Optional[redis_lib.Redis] = None


def get_redis() -> redis_lib.Redis:
    """Return the singleton Redis client (lazy-initialised)."""
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
    return _redis_client


def cache_get(key: str, cache_name: str = "default") -> Optional[Any]:
    """Get a value from cache; return None on miss or error.

    Increments the appropriate Prometheus counter so we can track
    hit ratio in Grafana.
    """
    try:
        r = get_redis()
        raw = r.get(key)
        if raw is not None:
            CACHE_HITS.labels(cache=cache_name).inc()
            return json.loads(raw)
        CACHE_MISSES.labels(cache=cache_name).inc()
        return None
    except Exception:
        CACHE_MISSES.labels(cache=cache_name).inc()
        return None


def cache_set(key: str, value: Any, ttl: int, cache_name: str = "default") -> None:
    """Set a value in cache with a TTL (seconds)."""
    try:
        r = get_redis()
        r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning(f"Cache set failed: {exc}", extra={"event": "cache_error"})


def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a pattern (used to invalidate after writes)."""
    try:
        r = get_redis()
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor, match=pattern, count=100)
            if keys:
                r.delete(*keys)
            if cursor == 0:
                break
    except Exception as exc:
        logger.warning(f"Cache delete failed: {exc}", extra={"event": "cache_error"})


def redis_healthy() -> bool:
    """Return True if Redis responds to PING."""
    try:
        return get_redis().ping()
    except Exception:
        return False
