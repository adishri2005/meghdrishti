"""
Prometheus metric objects — single source of truth.

All metrics are defined here so dashboards, alert rules, and application
code reference the same names and labels.  Importing this module is safe
even when prometheus_client is not running a server (metrics are just
in-memory objects until scraped).
"""

from prometheus_client import Counter, Gauge, Histogram

# ---------------------------------------------------------------------------
# API metrics
# ---------------------------------------------------------------------------

API_REQUESTS = Counter(
    "api_requests_total",
    "Total API requests",
    ["endpoint", "method", "status"],
)

API_LATENCY = Histogram(
    "api_latency_seconds",
    "API request latency in seconds",
    ["endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

# ---------------------------------------------------------------------------
# Ingestion metrics
# ---------------------------------------------------------------------------

RECORDS_INGESTED = Counter(
    "records_ingested_total",
    "Records accepted by the API for ingestion",
    ["source"],  # api | worker
)

RECORDS_PROCESSED = Counter(
    "records_processed_total",
    "Records processed by the worker",
)

# ---------------------------------------------------------------------------
# Detection metrics
# ---------------------------------------------------------------------------

ANOMALIES_DETECTED = Counter(
    "anomalies_detected_total",
    "Anomalies detected",
    ["severity", "method"],
)

DETECTION_DELAY = Histogram(
    "detection_delay_seconds",
    "Time from enqueue to anomaly detection",
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0),
)

# ---------------------------------------------------------------------------
# Queue metrics
# ---------------------------------------------------------------------------

QUEUE_LAG = Gauge(
    "queue_lag",
    "Pending + unread messages in the cost_records stream",
)

DLQ_LENGTH = Gauge(
    "dlq_length",
    "Number of messages in the dead-letter queue",
)

# ---------------------------------------------------------------------------
# Cache metrics
# ---------------------------------------------------------------------------

CACHE_HITS = Counter(
    "cache_hits_total",
    "Cache hit count",
    ["cache"],
)

CACHE_MISSES = Counter(
    "cache_misses_total",
    "Cache miss count",
    ["cache"],
)

# ---------------------------------------------------------------------------
# Worker metrics
# ---------------------------------------------------------------------------

WORKER_BATCH_SECONDS = Histogram(
    "worker_batch_seconds",
    "Time to process one batch of records",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# ---------------------------------------------------------------------------
# Version info (set at startup)
# ---------------------------------------------------------------------------

APP_VERSION_INFO = Gauge(
    "app_version_info",
    "Running application version and color",
    ["version", "color"],
)
