# Architecture

## Overview

The Cloud Cost Anomaly Detection (CCAD) system ingests simulated cloud usage/cost records through a REST API, queues them via Redis Streams for asynchronous processing, stores them in PostgreSQL, learns per-resource baselines, detects unusual cost increases using statistical methods, and identifies the responsible resources.

## Why PostgreSQL (not NoSQL)?

Cost data is structured and relational: it needs time-range aggregation (`GROUP BY hour, service`), joins (resources ↔ cost records ↔ anomalies), ACID writes for idempotent processing, and complex queries for the summary endpoint. PostgreSQL delivers all of this plus JSONB for semi-structured root-cause data. A document store like MongoDB would add complexity without any benefit for this workload.

## Architecture Diagram

```mermaid
graph TB
    subgraph "External Access"
        User["FinOps / DevOps Engineer"]
        Client["API Client / simulate.py"]
    end

    subgraph "Unified Gateway (Nginx :8443)"
        Nginx["Nginx Gateway<br/>TLS + auth_request Auth Gate"]
    end

    subgraph "Frontend Layer"
        Frontend["CostGuard Console :80<br/>React 18 + TS + ECharts"]
    end

    subgraph "Application Layer"
        BlueAPI["API Blue :8000 (Active)"]
        GreenAPI["API Green :8000 (Standby)"]
        Worker["Stream Worker :8001"]
    end

    subgraph "Data Layer"
        Redis["Redis :6379<br/>Streams + Baselines Cache"]
        Postgres["PostgreSQL :5432<br/>Cost Records, Baselines,<br/>Anomalies, Audit, Deployments"]
    end

    subgraph "Observability Stack"
        Prometheus["Prometheus :9090<br/>(Metrics & PromQL)"]
        Grafana["Grafana :3000<br/>(Embedded Kiosk)"]
        RedisExp["Redis Exporter"]
        PgExp["Postgres Exporter"]
        NodeExp["Node Exporter"]
    end

    User -->|HTTPS :8443| Nginx
    Client -->|HTTPS :8443 /api| Nginx

    Nginx -->|/ (SPA)| Frontend
    Nginx -->|/api/ (upstream.inc)| BlueAPI
    Nginx -.->|standby| GreenAPI
    Nginx -->|/grafana/ (auth_request)| Grafana
    Nginx -->|/prometheus/ (auth_request)| Prometheus

    BlueAPI -->|XADD| Redis
    BlueAPI -->|Read/Write| Postgres
    GreenAPI -->|XADD| Redis
    GreenAPI -->|Read/Write| Postgres

    Redis -->|XREADGROUP| Worker
    Worker -->|Write Anomalies| Postgres
    Worker -->|Cache Baselines| Redis

    Prometheus -->|Scrape /metrics| BlueAPI
    Prometheus -->|Scrape /metrics| GreenAPI
    Prometheus -->|Scrape /metrics| Worker
    Prometheus -->|Scrape| RedisExp
    Prometheus -->|Scrape| PgExp
    Prometheus -->|Scrape| NodeExp
    RedisExp --> Redis
    PgExp --> Postgres

    Grafana -->|Query| Prometheus
    Frontend -->|PromQL via /prometheus| Prometheus
```

## Cloud Components (8)

| # | Component | Role |
|---|-----------|------|
| 1 | **PostgreSQL** | Primary data store for cost records, baselines, anomalies, audit logs |
| 2 | **Redis Streams** | Message queue for async record processing (at-least-once delivery) |
| 3 | **Redis Cache** | TTL-based caching for cost summaries and baselines |
| 4 | **Nginx** | Reverse proxy with TLS termination, blue/green upstream switching |
| 5 | **Prometheus** | Metrics collection and alerting (6 alert rules) |
| 6 | **Grafana** | Dashboards and visualization (14 panels) |
| 7 | **Docker** | Container orchestration with health checks and restart policies |
| 8 | **Blue/Green Deploy** | Zero-downtime deployment with health gate and auto-rollback |

## Data Flow

1. **Ingestion**: Client POSTs a batch → API validates, creates job row, XADDs to Redis Stream, returns 202.
2. **Processing**: Worker XREADGROUPs messages, upserts resources, inserts cost records (idempotent via UNIQUE constraint), runs detection.
3. **Detection**: For each record — load Welford baseline, evaluate z-score / pct-jump / EWMA drift rules, create anomaly if flagged. After each hour's records, check for aggregate anomaly and rank contributors.
4. **Alerting**: New anomalies trigger log alerts and optional webhook notifications.
5. **Query**: Analysts browse anomalies with filters, view root-cause details, update status. Cost summaries are cached in Redis.

## Detection Methods

| Method | What it catches | When it fires |
|--------|----------------|---------------|
| z_score | Sudden spikes | cost > mean + z_threshold × std_eff |
| pct_jump | Large percentage increases | (cost - mean) / mean × 100 > pct_threshold |
| ewma_drift | Gradual cost creep | EWMA(cost/mean) > drift_ratio, only if z/pct didn't fire |
| new_resource | Unknown resources | New resource with cost > floor, system has 24h+ history |
| aggregate_jump | Total hourly spend spike | sum(observed) vs sum(expected) exceeds threshold |

## Key Design Decisions

- **Welford online statistics**: O(1) incremental mean/variance, no re-scanning history.
- **Poisoned baseline prevention**: Anomalous records don't update the baseline.
- **Idempotent writes**: `ON CONFLICT DO NOTHING` on `(resource_id, ts)` — replay-safe.
- **XACK after commit**: Messages are acknowledged only after the DB transaction commits — crash-safe.
- **Deduplication**: Repeat anomalies within a configurable window update the existing row instead of creating duplicates.
