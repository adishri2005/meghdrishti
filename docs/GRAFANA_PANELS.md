# Grafana Panel Mapping (CostGuard Overview)

The Grafana dashboard `monitoring/grafana/dashboards/ccad.json` is provisioned with UID `ccad-main` and title `CostGuard Overview`.

The frontend console embeds individual panels using Grafana's solo embed URL pattern:
`/grafana/d-solo/ccad-main/costguard-overview?orgId=1&panelId=<id>&theme=dark`

## Panel ID to Title & Metric Mapping

| Panel ID | Title | Type | Metric / PromQL Expression |
|:---:|:---|:---:|:---|
| **1** | Request Rate | `timeseries` | `sum(rate(api_requests_total[1m]))` |
| **2** | API Latency (p50/p95/p99) | `timeseries` | `histogram_quantile(..., api_latency_seconds_bucket)` |
| **3** | Error Rate by Color | `timeseries` | `sum(rate(api_requests_total{status=~"5.."}[1m])) by (job)` |
| **4** | Ingestion vs Processing Throughput | `timeseries` | `records_ingested_total` vs `records_processed_total` |
| **5** | Queue Lag | `timeseries` | `queue_lag` |
| **6** | DLQ Length | `stat` | `dlq_length` |
| **7** | Active Version | `stat` | `app_version_info` |
| **8** | Detection Delay (p95) | `timeseries` | `detection_delay_seconds_bucket` |
| **9** | Anomalies by Severity | `timeseries` | `anomalies_detected_total` |
| **10** | Cache Hit Ratio | `gauge` | `cache_hits_total / (hits + misses)` |
| **11** | CPU Usage | `timeseries` | `node_cpu_seconds_total` (non-idle %) |
| **12** | Memory Usage | `timeseries` | `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes` |
| **13** | PostgreSQL Connections | `timeseries` | `pg_stat_activity_count` |
| **14** | Redis Memory | `timeseries` | `redis_memory_used_bytes` |
