# Cloud Cost Anomaly Detection (CCAD) & CostGuard

> Real-time streaming anomaly detection, diurnal baseline profiling, root-cause attribution, and FinOps observability console for cloud infrastructure spending.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![CI Status](https://img.shields.io/badge/CI-Passing-success?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-informational)](pyproject.toml)
<!-- TODO: add license badge when license is chosen -->

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Detection Pipeline](#architecture--detection-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Quick Start](#installation--quick-start)
- [Configuration](#configuration)
- [Usage & Workflows](#usage--workflows)
  - [CostGuard Web Console](#costguard-web-console)
  - [Data Ingestion & Simulation](#data-ingestion--simulation)
  - [Anomaly Injection & Testing](#anomaly-injection--testing)
  - [Zero-Downtime Blue/Green Deployment](#zero-downtime-bluegreen-deployment)
  - [Failure Experiments & Resilience](#failure-experiments--resilience)
- [API Reference](#api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Production Deployment](#production-deployment)
- [Screenshots & UI Showcase](#screenshots--ui-showcase)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements & Contact](#acknowledgements--contact)

---

## Overview

**Cloud Cost Anomaly Detection (CCAD)** is an end-to-end FinOps and platform engineering observability platform designed to solve the critical problem of unpredicted cloud cost overruns. Modern distributed cloud infrastructures generate complex, multi-dimensional billing streams where sudden misconfigurations, unconstrained auto-scaling loops, memory leaks, and rogue batch workloads cause massive financial drift before monthly invoices arrive.

CCAD ingests granular, hourly cost and usage records through a resilient REST API, queues them asynchronously via **Redis Streams**, and analyzes them using an asynchronous background worker that maintains diurnal baselines with **Welford's streaming algorithm**. The detection engine runs statistical evaluations (**z-score, percentage jump, EWMA drift, new-resource detection, and cluster-wide aggregate surges**), attributes root causes across dimensions (service, region, team), and dispatches webhook notifications. The unified **CostGuard** console provides single-origin, zero-trust access to operational dashboards, embedded PromQL metrics, Grafana telemetry, and live Server-Sent Events (SSE) logs under zero-downtime blue/green deployment orchestration.

---

## Key Features

- **Streaming Ingestion & Decoupled Queue**: Asynchronous batch ingestion of 1–5,000 cost records per request into Redis 7 Streams with consumer groups, automatic idling claim recovery (`XAUTOCLAIM`), exponential backoff retries, and dead-letter queue (DLQ) isolation.
- **Statistical Diurnal Baselines (Welford's Algorithm)**: Maintains online running mean ($\mu$) and sample variance ($\sigma^2$) in $O(1)$ time and space per `(resource_id, hour_of_day)`, capturing cyclical day/night cloud usage patterns without expensive historical table re-scans.
- **Multi-Method Anomaly Detection Engine**:
  - **Z-Score Spike Detection (Rule A)**: Flags acute expenditures exceeding baseline standard deviations ($z > 3.0$), guarded by adaptive variance floors ($\sigma_{\text{eff}} = \max(\sigma, 0.05\mu, 0.01)$) to prevent false alerts on low-variance workloads.
  - **Percentage Jump (Rule B)**: Flags severe step-function increases ($> 50\%$ above baseline mean) even during periods of wide historical variance.
  - **EWMA Drift Detection (Rule C)**: Tracks long-term creeping cost inflation ($R_t > 1.3$) via Exponentially Weighted Moving Average ratios ($\alpha = 0.3$).
  - **New Resource Cold-Start (Rule D)**: Flags previously unseen cloud resources initiating non-trivial spend ($\ge \$1.00$) after 24 hours of cluster history.
  - **Aggregate Spike & Root Cause Attribution**: Aggregates hourly spend across the entire cluster, pinpoints cross-resource spikes, and ranks anomalous delta contributions grouped by service, region, and team.
- **Alert Suppression & Escalation**: 6-hour sliding deduplication window prevents alert storms; consecutive anomalies increment occurrence counters, update peak spend, and escalate severity levels.
- **CostGuard Mission Control Console**: Single-page application built with React 18, TypeScript, Tailwind CSS, and Apache ECharts featuring dark/light modes, interactive guided tours, real-time status monitoring, and virtualized SSE log streams.
- **Zero-Trust Reverse Proxy & Single-Origin Gateway**: Nginx gateway terminating TLS on port `:8443` with subrequest authentication (`/_auth_verify`), protecting embedded Prometheus PromQL and Grafana dashboards without exposing backend ports.
- **Zero-Downtime Blue/Green Deployments**: Automated deployment scripts with advisory database locking, health-gate polling (`/health`), 15-second post-cutover rollback monitoring, and instantaneous upstream symlink switching.
- **Chaos & Failure Engineering Tooling**: Automated failure injection tests measuring Mean Time to Recovery (MTTR) across worker crashes, Redis restarts, and simulated faulty releases.

---

## Architecture & Detection Pipeline

```
                                      CLIENT & INGESTION LAYER
                                                 │
            ┌────────────────────────────────────┴────────────────────────────────────┐
            ▼                                                                         ▼
   FinOps / DevOps Engineer                                                  Automated Ingestion
 (CostGuard Web Console :8443)                                             (REST Client / simulate.py)
            │                                                                         │
            └────────────────────────────────────┬────────────────────────────────────┘
                                                 │ HTTPS (TLS 1.2/1.3)
                                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ NGINX REVERSE PROXY & GATEWAY (:8443)                                                             │
│                                                                                                   │
│  ├── /                     ──► CostGuard Frontend SPA (React 18 + TS + Vite + ECharts)            │
│  ├── /api/v1/*             ──► Active Upstream API Node (FastAPI Blue/Green)                      │
│  ├── /api/v1/admin/logs/stream ──► SSE Log Stream (Bufferless Proxying)                           │
│  ├── /grafana/*            ──► Grafana Kiosk (Protected via /_auth_verify subrequest)             │
│  └── /prometheus/*         ──► Prometheus PromQL (Protected via /_auth_verify subrequest)         │
└────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASTAPI APPLICATION TIER (Blue / Green Active-Standby)                                             │
│                                                                                                   │
│  ├── Security Headers Middleware (OWASP HSTS, CSP, X-Frame-Options, No-Sniff)                     │
│  ├── Request-ID Correlation Middleware (UUID tracking across API, DB, and logs)                  │
│  ├── Prometheus Metrics & Latency Histogram Middleware                                            │
│  ├── Fault Injection Middleware (Simulates bad builds for rollback testing)                       │
│  └── Modular Routers: Auth (JWT/Bcrypt), Ingestion, Anomalies, Costs, Resources, Admin, Config   │
└───────────────────┬───────────────────────────────────────────────┬───────────────────────────────┘
                    │                                               │
       Enqueues 202 │ Batch Job                               Reads │ Baselines & Metadata
                    ▼                                               ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│ REDIS 7 (STREAM BROKER & CACHE)               │   │ POSTGRESQL 16 (RELATIONAL STORE)              │
│                                               │   │                                               │
│  ├── Stream: `cost_records`                   │   │  ├── cost_records (Unique: resource_id, ts)   │
│  ├── Consumer Group: `detectors`              │   │  ├── baselines (Welford n, mean, m2 per hour) │
│  ├── Stream DLQ: `cost_records:dlq`           │   │  ├── anomalies & alerts (Root-cause JSONB)    │
│  └── TTL Caches: Cost summaries & baselines   │   │  └── audit_logs, users, deployments, settings │
└───────────────────┬───────────────────────────┘   └───────────────────────▲───────────────────────┘
                    │                                                       │
      Consumes via  │ XREADGROUP                                            │ Updates baselines,
      Autoclaims    │ XAUTOCLAIM                                            │ records anomalies & alerts
                    ▼                                                       │
┌───────────────────────────────────────────────────────────────────────────┴───────────────────────┐
│ BACKGROUND DETECTION WORKER (app.worker.main)                                                     │
│                                                                                                   │
│  1. Batch Dequeue & Chronological Sort                                                            │
│  2. Resource Resolution & Metadata Upsert                                                         │
│  3. Statistical Evaluation:                                                                       │
│     ├── Cold-Start Verification (n < 5 samples?)                                                  │
│     ├── Rule D: New Resource Detection (cost >= $1.00 & cluster age > 24h)                        │
│     ├── Welford State Update: mean_t = mean_{t-1} + (x - mean_{t-1})/n                            │
│     ├── Variance Floor Calculation: std_eff = max(std, 0.05*mean, 0.01)                          │
│     ├── Rule A: z-score = (x - mean) / std_eff > 3.0                                              │
│     ├── Rule B: pct_jump = ((x - mean) / mean) * 100 > 50.0%                                      │
│     └── Rule C: EWMA drift = alpha*(x/mean) + (1-alpha)*EWMA_{t-1} > 1.3                          │
│  4. Cluster Aggregate Spend Analysis & Root Cause Dimension Attribution                           │
│  5. Sliding Window Deduplication (6h) & Severity Escalation Matrix (Critical / High / Med / Low)   │
│  6. Dispatch Webhook Alerts (Slack / Teams / Generic HTTP POST)                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend (CostGuard Console)
- **Framework & Core**: React 18.3, TypeScript 5.6 (strict mode), Vite 5.4
- **State & Data Fetching**: TanStack Query v5 (React Query), Zustand v5
- **Data Visualization**: Apache ECharts 5.6 (`echarts-for-react`)
- **UI Components & Styling**: Tailwind CSS 3.4, Radix UI primitives, Lucide React, Sonner (toasts)
- **Interactive Tour**: Driver.js 1.9
- **Table & Virtualization**: TanStack Table v8, TanStack Virtual v3

### Backend & Stream Processing
- **Language & Framework**: Python 3.11, FastAPI 0.115, Starlette
- **ASGI & WSGI Servers**: Uvicorn 0.30, Gunicorn 23.0
- **Validation & Settings**: Pydantic v2.9, Pydantic Settings v2.5
- **Authentication & Security**: PyJWT / python-jose, Passlib / Bcrypt 4.0 (rate-limited login, RBAC)
- **Database ORM & Migrations**: SQLAlchemy 2.0, Alembic 1.13, Psycopg2-binary 2.9
- **Logging & Tracing**: Python JSON Logger 2.0 (structured JSON logs with Request-ID correlation)
- **Algorithms**: Welford's algorithm (online variance), EWMA, NumPy 2.1

### Infrastructure, Data & Observability
- **Primary Database**: PostgreSQL 16 Alpine
- **Message Broker & Cache**: Redis 7 Alpine (Redis Streams, LRU eviction policy)
- **Reverse Proxy**: Nginx 1.27 Alpine (TLS termination, dynamic upstream inclusion)
- **Monitoring & Metrics**: Prometheus v2.54.0, Grafana 11.2.0
- **Telemetry Exporters**: Redis Exporter v1.63, Postgres Exporter v0.15, Node Exporter v1.8.2
- **Containerization**: Docker & Docker Compose (11 containers in a custom bridge network)

---

## Project Structure

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated CI: linting, pytest + coverage, Docker build, frontend test/build
│       └── deploy.yml             # CD workflow: automated EC2 SSH blue/green deployment
├── alembic/                       # Database schema migration revisions and env configuration
│   ├── versions/                  # Version migration scripts
│   └── env.py                     # Alembic database target configuration
├── app/                           # Core backend application package
│   ├── detection/                 # Pure statistical anomaly detection algorithms
│   │   ├── baseline.py            # Welford algorithm for incremental mean and variance tracking
│   │   ├── engine.py              # Orchestration of rules, baselines, deduplication, and root cause
│   │   ├── root_cause.py          # Cluster-wide aggregate checks and dimensional attribution
│   │   └── rules.py               # Pure detection functions (z-score, pct-jump, EWMA drift, new-resource)
│   ├── routers/                   # FastAPI route handlers
│   │   ├── admin.py               # Simulator controls, deployment logging, and live SSE log streams
│   │   ├── anomalies.py           # Anomaly listing, triage detail, timeline bands, and bulk actions
│   │   ├── audit_logs.py          # Immutable audit trail query endpoints
│   │   ├── auth.py                # JWT authentication, session verification, user and API client management
│   │   ├── config_router.py       # Runtime detection and severity threshold management
│   │   ├── costs.py               # Cached cost summaries, stacked time-series, and heatmap matrix
│   │   ├── health.py              # Liveness (/health/live), readiness (/health/ready), and Prometheus metrics
│   │   ├── jobs.py                # Batch ingestion job progress and lifecycle tracking
│   │   ├── records.py             # Batch cost ingestion entry point (accepts 1-5,000 records)
│   │   ├── resources.py           # Resource inventory, sorting, 24h spend, and baseline profile lookups
│   │   └── stats.py               # Aggregated overview KPIs and system status indicators
│   ├── simulator/                 # Deterministic synthetic data generator and cloud resource catalog
│   │   ├── catalog.py             # Synthetic cloud resource definitions (EC2, RDS, S3, Lambda, EKS)
│   │   └── generator.py           # Baseline diurnal cost curve generator with anomaly injectors
│   ├── worker/                    # Asynchronous Redis Streams consumer pipeline
│   │   ├── alerts.py              # Webhook alert dispatcher with HTTP retry logic
│   │   ├── main.py                # Stream consumer group loop, message acknowledgement, and DLQ handling
│   │   └── metrics_server.py      # Standalone Prometheus metrics HTTP server for worker metrics
│   ├── cache.py                   # Redis connection pooling, key-value caching, and health probes
│   ├── config.py                  # Pydantic settings loading, YAML defaults, and production secret validation
│   ├── db.py                      # SQLAlchemy engine configuration, session factories, and connection cleanup
│   ├── logging_setup.py           # JSON log formatting with contextual Request-ID injection
│   ├── main.py                    # FastAPI application factory, middleware pipeline, and exception handlers
│   ├── metrics.py                 # Prometheus metric definitions (counters, histograms, gauges)
│   ├── models.py                  # SQLAlchemy ORM models (13 tables: users, records, baselines, anomalies, etc.)
│   ├── queue.py                   # Redis Stream producer utilities, consumer group setup, and DLQ routing
│   ├── schemas.py                 # Pydantic request and response schemas (contracts)
│   └── security.py                # Password hashing, JWT token creation, RBAC dependencies, and audit logging
├── config/
│   └── config.yaml                # Default detection thresholds, queue settings, and cache TTL parameters
├── docker/
│   ├── Dockerfile                 # Multi-stage production container image for API and Worker
│   └── entrypoint.sh              # Startup orchestration: dependency wait, migrations, seeding, process exec
├── docs/                          # Comprehensive technical documentation and guides
│   ├── screenshots/               # Dark and light mode high-resolution application screenshots
│   ├── ARCHITECTURE.md            # Architectural design rationale and trade-offs
│   ├── ARCHITECTURE_FLOW.md       # Exhaustive architecture documentation and Mermaid flowcharts
│   ├── ASSUMPTIONS.md             # Theoretical and operational assumptions
│   ├── DEMO_SCRIPT.md             # Step-by-step viva presentation and demo walkthrough script
│   ├── DEPLOYMENT.md              # Cloud deployment and host configuration instructions
│   ├── EXPERIMENTS.md             # Controlled failure experiment benchmarks and evaluation results
│   ├── FRONTEND.md                # CostGuard console UI/UX design specifications
│   ├── GRAFANA_PANELS.md          # Grafana dashboard panel queries and PromQL references
│   └── README_API.md              # Standalone API documentation
├── frontend/                      # CostGuard React 18 single-page application
│   ├── e2e/                       # Playwright end-to-end test suites and automated screenshot capture
│   ├── src/                       # Application source code (components, pages, hooks, lib, store)
│   ├── Dockerfile                 # Production Nginx container serving static frontend assets
│   ├── package.json               # Node.js dependencies and build scripts
│   ├── tailwind.config.ts         # Tailwind CSS styling and theme configuration
│   └── vite.config.ts             # Vite development server and bundling configuration
├── loadtests/
│   └── locustfile.py              # Locust load testing scenarios (ingestion, analytics, and admin traffic)
├── monitoring/
│   ├── grafana/                   # Grafana dashboard JSON models and datasource provisioning
│   ├── alert_rules.yml            # Prometheus alerting rules (error rates, queue lag, DLQ alerts)
│   └── prometheus.yml             # Prometheus scrape configurations and target definitions
├── nginx/
│   ├── active/                    # Directory containing dynamic upstream pointer (`upstream.inc`)
│   ├── certs/                     # TLS certificates directory (generated self-signed or CA signed)
│   └── nginx.conf                 # Primary Nginx gateway configuration with security headers and auth gate
├── scripts/                       # DevOps, automation, deployment, and evaluation scripts
│   ├── bootstrap_ec2.sh           # Host initialization script for Ubuntu EC2 instances
│   ├── deploy.sh                  # Zero-downtime blue/green deployment orchestration script
│   ├── drift_check.py             # Configuration drift verification tool
│   ├── evaluate_detection.py      # Precision, recall, and F1-score evaluation against ground truth
│   ├── export_openapi.py          # OpenAPI schema exporter
│   ├── failure_experiment.sh      # Chaos testing: measures MTTR during worker or Redis failure
│   ├── gen_certs.sh               # Self-signed TLS certificate generator using OpenSSL
│   ├── rollback.sh                # Instant zero-downtime upstream rollback script
│   ├── run_loadtests.sh           # Automated multi-tier Locust load testing runner
│   ├── simulate.py                # CLI for dataset seeding and anomaly injection
│   └── switch_color.sh            # Nginx upstream symlink switcher and reloader
├── tests/                         # Pytest test suite (unit, integration, and gateway tests)
├── .env.example                   # Baseline environment variable template with security placeholders
├── alembic.ini                    # Alembic migration runner configuration
├── docker-compose.yml             # Multi-service composition (11 container platform stack)
├── Makefile                       # Top-level task automation interface (build, run, test, deploy)
├── pyproject.toml                 # Ruff linter, formatter, and Pytest configuration
├── requirements.txt               # Core Python runtime dependencies
├── requirements-dev.txt           # Python test, lint, and load-testing dependencies
└── SECURITY.md                    # Vulnerability reporting and operational secret rotation runbooks
```

---

## Prerequisites

Ensure your host system meets the following software requirements:

- **Docker Engine & Docker Compose**: Docker 24.0+ and Docker Compose v2.20+
- **Python**: Version 3.11+ (required for local scripting, CLI tooling, and test runners)
- **Node.js & npm**: Node.js 20.x LTS and npm 10.x+ (required for local frontend development)
- **GNU Make**: For executing Makefile automation targets
- **OpenSSL**: For generating local TLS certificates
- **Bash**: Standard shell for running deployment and chaos scripts (Linux / macOS / WSL2 on Windows)

---

## Installation & Quick Start

Follow these copy-pasteable steps to deploy the complete platform locally:

### 1. Clone the Repository
```bash
git clone https://github.com/adishri2005/cloud-cost-anomaly-detection.git
cd cloud-cost-anomaly-detection
```

### 2. Configure Environment Variables
Copy the template configuration file. The default development values are pre-configured for local testing:
```bash
cp .env.example .env
```
*(In production environments, ensure you set strong secrets as described in the [Configuration](#configuration) section).*

### 3. Generate TLS Certificates
Generate the self-signed TLS certificates required by the Nginx gateway:
```bash
bash scripts/gen_certs.sh
# Or using Make:
make certs
```

### 4. Build and Launch Containers
Start all 11 infrastructure and application services in the background:
```bash
docker compose up -d --build
# Or using Make:
make up
```

Verify that all containers are healthy:
```bash
docker compose ps
```

### 5. Seed Historical Baseline Data
Seed 14 days of realistic diurnal cloud cost history across 15 cloud resources to train the Welford baselines:
```bash
make seed
# Or manually via python:
python scripts/simulate.py seed --days 14
```

### 6. Access CostGuard & Services
Once running, the single-origin CostGuard gateway is reachable at:

| Service / Interface | URL | Credentials / Notes |
|---|---|---|
| **CostGuard Web Console** | `https://localhost:8443/` | **Admin**: `admin` / `Admin@12345`<br>**Analyst**: `analyst` / `Analyst@12345` |
| **Interactive API Docs (Swagger)** | `https://localhost:8443/docs` | Built-in OpenAPI specification |
| **ReDoc API Reference** | `https://localhost:8443/redoc` | Formatted API documentation |
| **Embedded Grafana Dashboards** | `https://localhost:8443/monitoring?tab=grafana` | Single-origin iframe protected via auth gate |
| **Embedded Prometheus PromQL** | `https://localhost:8443/monitoring?tab=prometheus` | Single-origin iframe protected via auth gate |

> **Note on Self-Signed Certificates**: Because local certificates are self-signed, your browser will display a security warning on first visit. Accept the warning to proceed to `https://localhost:8443`.

---

## Configuration

Application configuration is loaded using **Pydantic Settings** from the `.env` file and system environment variables. Runtime detection parameters are seeded from `config/config.yaml` into PostgreSQL on first launch and can be modified live without service restarts.

### Environment Variables Reference

| Variable | Description | Required in Production | Default / Example Value |
|---|---|:---:|---|
| `ENVIRONMENT` | Target environment mode (`development`, `staging`, `production`) | **Yes** | `development` |
| `POSTGRES_USER` | PostgreSQL superuser username | **Yes** | `ccad` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | **Yes** (enforced in prod) | `change_me_pg` |
| `POSTGRES_DB` | PostgreSQL primary database name | **Yes** | `ccad` |
| `DATABASE_URL` | SQLAlchemy PostgreSQL connection URI with psycopg2 driver | **Yes** | `postgresql+psycopg2://ccad:change_me_pg@postgres:5432/ccad` |
| `REDIS_URL` | Redis instance connection URI | **Yes** | `redis://redis:6379/0` |
| `JWT_SECRET` | Secret key for signing and validating JWTs (min 32 characters) | **Yes** (fails fast in prod) | `change_me_to_a_long_random_string` |
| `JWT_ALGORITHM` | Cryptographic signature algorithm for JWT tokens | No | `HS256` |
| `JWT_EXPIRE_MINUTES` | Access token lifespan before expiration | No | `30` |
| `ADMIN_USERNAME` | Bootstrap administrator username | No | `admin` |
| `ADMIN_PASSWORD` | Bootstrap administrator password | **Yes** (fails fast in prod) | `Admin@12345` |
| `ANALYST_USERNAME` | Bootstrap read-only analyst username | No | `analyst` |
| `ANALYST_PASSWORD` | Bootstrap read-only analyst password | **Yes** (fails fast in prod) | `Analyst@12345` |
| `SERVICE_API_KEY` | Machine-to-machine API key for data ingestion pipelines | **Yes** (fails fast in prod) | `svc-ingest-key-change-me` |
| `APP_VERSION` | Application release version string | No | `1.0.0` |
| `APP_COLOR` | Deployment color identifier (`blue` or `green`) | No | `blue` |
| `FAULTY_RELEASE` | Fault injection flag (returns 500 on 50% non-health calls) | No | `false` |
| `LOG_LEVEL` | Log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | No | `INFO` |
| `LOG_FILE` | Absolute file destination for JSON log output | No | `/var/log/app/app.log` |
| `ALERT_WEBHOOK_URL`| Destination webhook URI for anomaly dispatch (Slack/Teams/HTTP) | No | `https://hooks.slack.com/services/...` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin account password | **Yes** | `change_me_grafana` |
| `HTTP_PORT` | Host port for HTTP to HTTPS redirection | No | `8080` |
| `HTTPS_PORT` | Host port for the primary TLS Nginx Gateway | No | `8443` |

### Production Secret Validation
When `ENVIRONMENT=production`, the application performs a strict startup check. It will **fail to start** with a `ValueError` if:
1. `JWT_SECRET`, `ADMIN_PASSWORD`, `ANALYST_PASSWORD`, `SERVICE_API_KEY`, or `POSTGRES_PASSWORD` contain default `"change_me"` strings.
2. `JWT_SECRET` is shorter than 32 characters.
3. Passwords are shorter than 8 characters.

---

## Usage & Workflows

### CostGuard Web Console

CostGuard provides distinct role-based experiences:
- **Admin Role** (`admin`): Full access to operational controls, threshold tuning, data simulation, user/client registration, and live SSE log streams.
- **Analyst Role** (`analyst`): Access to cost analysis, anomaly triage, timeline comparisons, and reporting; administrative modifications are restricted.

Key Console Workflows:
1. **Overview Dashboard**: Monitor real-time cluster cost run-rates, 24h spend deltas, active anomaly severities, and top spending cloud resources.
2. **Anomalies Triage**: View open, acknowledged, and resolved anomalies. Click any incident to open the **Root-Cause Drawer** displaying the dynamic expected baseline band ($\pm 3\sigma$) and dimensional contributor rankings.
3. **Bulk Actions**: Rapidly acknowledge or resolve ongoing alert clusters using the **Acknowledge All** and **Resolve All** controls.
4. **Interactive Guided Tour**: Click the **Take a Tour** button in the header at any time for a step-by-step walkthrough of all navigation modules and FinOps controls.

---

### Data Ingestion & Simulation

Submit cost records using either the API or the built-in simulator:

#### Ingest via cURL
```bash
# Obtain Bearer token
TOKEN=$(curl -sk -X POST https://localhost:8443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}' \
  | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Submit a batch of records
curl -sk -X POST https://localhost:8443/api/v1/records/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "resource_id": "ec2-ml-gpu-01",
        "timestamp": "2026-10-21T08:00:00Z",
        "usage_quantity": 1.0,
        "unit_cost": 3.06,
        "cost": 3.06,
        "service": "ec2",
        "region": "us-east-1",
        "team_tag": "ml-platform",
        "type": "g4dn.xlarge"
      }
    ],
    "backfill": false
  }'
```

---

### Anomaly Injection & Testing

Inject synthetic anomalies to evaluate the detection engine in real time:

#### 1. Acute Cost Spike (Rule A: Z-Score)
Simulate an abrupt 12x cost spike on an ML GPU instance:
```bash
make inject KIND=spike RESOURCE=ec2-ml-gpu-01 MULT=12
```

#### 2. Creeping Cost Inflation (Rule C: EWMA Drift)
Inject gradual, compounding expenditure increases over 48 hours:
```bash
python scripts/simulate.py inject --kind drift --resource rds-pg-primary --hours 48
```

#### 3. Unapproved Cloud Resource (Rule D: New Resource)
Simulate an unexpected cloud resource appearing with high initial spend:
```bash
python scripts/simulate.py inject --kind new_resource --resource ec2-shadow-miner-99 --cost 85.50
```

#### 4. Evaluate Detection Accuracy
Run the detection evaluation benchmark to calculate Precision, Recall, and F1-score against ground truth:
```bash
make evaluate
# Or:
python scripts/evaluate_detection.py
```

---

### Zero-Downtime Blue/Green Deployment

Deploy new application versions without dropping inflight requests:

```bash
# Deploy release version 1.1.0 to the inactive standby container
make deploy VERSION=1.1.0

# Verify the current active deployment and uptime
curl -sk https://localhost:8443/api/v1/admin/deployments/current \
  -H "Authorization: Bearer $TOKEN"
```

#### Automated Rollback on Faulty Release
Test automated rollback behavior by triggering a deployment that deliberately returns 500 errors:
```bash
make deploy-faulty
```
The deploy script boots the standby container, executes health checks, runs a 15-second post-cutover monitoring window, detects the elevated error rate, and **automatically rolls back** to the original color.

To trigger an immediate manual rollback at any time:
```bash
make rollback
```

---

### Failure Experiments & Resilience

Test the platform's self-healing mechanisms and measure Mean Time to Recovery (MTTR):

#### Worker Failure Test
Kills the background worker container while streaming ingestion continues. Validates that records queue safely in Redis Streams and resume processing without data loss once restored:
```bash
make experiment-worker
```

#### Redis Broker Failure Test
Stops the Redis container to test API fault tolerance and reconnection backoff:
```bash
make experiment-redis
```

#### Load Testing with Locust
Run automated multi-scenario load tests (low, medium, and high stress tiers):
```bash
make loadtest
```

---

## API Reference

All API endpoints are documented interactively via OpenAPI at `https://localhost:8443/docs`.

### Key Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/health` | Combined liveness and readiness probe (returns 200 or 503) | Public |
| `GET` | `/health/live` | Lightweight liveness probe | Public |
| `GET` | `/health/ready` | Dependency readiness probe (PostgreSQL & Redis) | Public |
| `GET` | `/metrics` | Prometheus metrics exposition | Internal |
| `POST` | `/api/v1/auth/login` | Authenticate user, receive JWT Bearer token and session cookie | Public |
| `GET` | `/api/v1/auth/me` | Fetch active user identity, role, and token expiry | Analyst, Admin |
| `POST` | `/api/v1/auth/logout` | Terminate session and clear session cookie | Authenticated |
| `POST` | `/api/v1/auth/register` | Create a new user account | Admin |
| `POST` | `/api/v1/records/batch` | Ingest batch of 1–5,000 cost records (returns 202 Accepted) | Service, Admin |
| `GET` | `/api/v1/records/jobs/{id}` | Query progress and status of an ingestion batch | Authenticated |
| `GET` | `/api/v1/anomalies` | List detected anomalies with filters (`severity`, `status`, dates) | Analyst, Admin |
| `GET` | `/api/v1/anomalies/{id}` | Detailed anomaly record with root-cause attribution | Analyst, Admin |
| `PATCH` | `/api/v1/anomalies/{id}` | Update anomaly status (`acknowledged` or `resolved`) | Analyst, Admin |
| `POST` | `/api/v1/anomalies/bulk-acknowledge` | Acknowledge all open anomalies in bulk | Analyst, Admin |
| `POST` | `/api/v1/anomalies/bulk-resolve` | Resolve all open or acknowledged anomalies in bulk | Analyst, Admin |
| `GET` | `/api/v1/anomalies/{id}/timeline` | Cost timeline with baseline mean and $\pm 3\sigma$ confidence bands | Analyst, Admin |
| `GET` | `/api/v1/costs/summary` | Cost totals grouped by dimension (service, team, region) | Analyst, Admin |
| `GET` | `/api/v1/costs/timeseries` | Stacked-chart-ready multi-dimensional time series | Analyst, Admin |
| `GET` | `/api/v1/costs/heatmap` | Resource-by-hour-of-day spending heatmap matrix | Analyst, Admin |
| `GET` | `/api/v1/resources` | Cloud resource catalog with sorting and 24h spend metrics | Analyst, Admin |
| `GET` | `/api/v1/resources/{id}/baseline` | 24-hour diurnal baseline profile (mean and std whiskers) | Analyst, Admin |
| `GET` | `/api/v1/config/thresholds` | Retrieve current detection and severity thresholds | Analyst, Admin |
| `PUT` | `/api/v1/config/thresholds` | Dynamically update detection parameters at runtime | Admin |
| `POST` | `/api/v1/admin/simulate` | Trigger synthetic data generation and anomaly injection | Admin |
| `GET` | `/api/v1/admin/logs` | Server-side filtered application log tail | Admin |
| `GET` | `/api/v1/admin/logs/stream` | Server-Sent Events (SSE) live application log stream | Admin |
| `GET` | `/api/v1/admin/deployments` | Retrieve history of blue/green deployment events | Analyst, Admin |
| `GET` | `/api/v1/audit-logs` | Query immutable security audit trail | Admin |
| `GET` | `/api/v1/stats/overview` | Aggregated FinOps KPIs and top spending resources | Analyst, Admin |
| `GET` | `/api/v1/system/status` | Real-time connectivity and queue lag metrics | Analyst, Admin |

---

## Testing & Quality Assurance

The codebase includes comprehensive automated test coverage for backend business logic, API routing, stream processing, security controls, and frontend components.

### Backend Testing (Pytest)
Run the full backend test suite:
```bash
# Run unit & integration tests
pytest tests/ -v

# Run with test coverage report
pytest tests/ -v --cov=app --cov-report=term-missing
```

### Static Analysis & Security Auditing
```bash
# Run fast linting and code formatting checks with Ruff
ruff check app/ tests/

# Run dependency vulnerability security audit
python -m pip_audit -r requirements.txt
```

### Frontend Testing (Vitest & Playwright)
```bash
cd frontend

# Run unit and component tests with Vitest
npm test

# Run TypeScript compilation and ESLint checks
npm run lint

# Run end-to-end user journey tests with Playwright
npx playwright test
```

---

## Production Deployment

### Docker Multi-Container Topology
The platform runs 11 isolated containers orchestrated via `docker-compose.yml`:
1. `nginx`: Single-origin TLS gateway with reverse proxying and `auth_request` verification.
2. `frontend`: Static React SPA served via optimized Nginx container.
3. `api-blue`: Primary active FastAPI backend node (`:8000`).
4. `api-green`: Standby FastAPI backend node for blue/green cutover (`:8000`).
5. `worker`: Redis Streams background consumer and anomaly scoring engine.
6. `postgres`: Persistent database with automated migrations.
7. `redis`: Message stream broker and key-value cache.
8. `prometheus`: Time-series monitoring and alerting daemon.
9. `grafana`: Pre-provisioned dashboards with custom dark theme.
10. `redis-exporter`: Prometheus metrics exporter for Redis instance.
11. `postgres-exporter`: Prometheus metrics exporter for PostgreSQL.
12. `node-exporter`: Host-level hardware and operating system metrics.

### Automated EC2 Deployment via GitHub Actions
The repository includes a production deployment workflow in `.github/workflows/deploy.yml`:
1. Configure SSH credentials in your GitHub repository secrets:
   - `EC2_HOST`: Target server IP or hostname.
   - `EC2_USER`: SSH username (e.g. `ubuntu`).
   - `EC2_SSH_KEY`: Private SSH deployment key.
2. Trigger the workflow manually via GitHub Actions with the desired SemVer release tag (e.g., `1.1.0`).
3. The pipeline connects via SSH, pulls latest commits, and runs `scripts/deploy.sh` for a verified zero-downtime cutover.

---

## Screenshots & UI Showcase

The CostGuard console provides unified visibility across the FinOps lifecycle:

| View | Dark Mode | Light Mode |
|---|---|---|
| **Overview Dashboard** | ![Overview Dark](docs/screenshots/02_overview_dark.png) | ![Overview Light](docs/screenshots/02_overview_light.png) |
| **Anomalies Triage** | ![Anomalies Dark](docs/screenshots/03_anomalies_dark.png) | ![Anomalies Light](docs/screenshots/03_anomalies_light.png) |
| **Cost Explorer** | ![Costs Dark](docs/screenshots/04_costs_dark.png) | ![Costs Light](docs/screenshots/04_costs_light.png) |
| **Resources Inventory** | ![Resources Dark](docs/screenshots/05_resources_dark.png) | ![Resources Light](docs/screenshots/05_resources_light.png) |
| **Ingestion & Simulator** | ![Ingestion Dark](docs/screenshots/06_ingestion_dark.png) | ![Ingestion Light](docs/screenshots/06_ingestion_light.png) |
| **Monitoring Hub** | ![Monitoring Dark](docs/screenshots/07_monitoring_overview_dark.png) | ![Monitoring Light](docs/screenshots/07_monitoring_overview_light.png) |
| **Deployments & Blue/Green** | ![Deployments Dark](docs/screenshots/11_deployments_dark.png) | ![Deployments Light](docs/screenshots/11_deployments_light.png) |
| **Security & Audit Logs** | ![Audit Logs Dark](docs/screenshots/10_logs_audit_dark.png) | ![Audit Logs Light](docs/screenshots/10_logs_audit_light.png) |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit Your Changes** following conventional commit standards:
   ```bash
   git commit -m "feat: add support for custom webhook payloads"
   ```
4. **Run Verification Suites**:
   ```bash
   make test
   make lint
   make fe-test
   ```
5. **Push to Your Branch**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** against the `master` branch with a clear description of your changes.

---

## License

<!-- TODO: add license (e.g., MIT, Apache 2.0, or proprietary) -->
This project does not currently contain an explicit LICENSE file. All rights are reserved by the original project authors.

---

## Acknowledgements & Contact

- **Author**: Aditya Shrivastava ([@adishri2005](https://github.com/adishri2005))
- **Project**: Cloud Cost Anomaly Detection (CCAD) — Capstone Project P75
- **Security Inquiries**: Please consult [SECURITY.md](SECURITY.md) for responsible disclosure procedures.
<!-- TODO: add official contact email or project website link -->
