# Cloud Cost Anomaly Detection (CCAD)

A complete anomaly detection system for cloud cost monitoring — capstone project P75.

## What It Does

Ingests simulated cloud cost records through a REST API, queues them via **Redis Streams**, processes them with a background worker that learns per-resource baselines (**Welford's algorithm**), detects unusual cost increases (**z-score, percentage jump, EWMA drift**), identifies the responsible resources, and alerts via webhook. Deployed with **blue/green zero-downtime deployment** and monitored via **Prometheus + Grafana**.

## Quick Start

```bash
# 1. Clone
git clone <repo_url> && cd cloud-cost-anomaly-detection

# 2. Configure
cp .env.example .env    # Edit passwords and JWT secret

# 3. Generate TLS certificates
bash scripts/gen_certs.sh

# 4. Start everything
docker compose up -d --build

# 5. Seed 14 days of history
make seed

# 6. Inject a spike anomaly
make inject KIND=spike RESOURCE=ec2-ml-gpu-01 MULT=12

# 7. Check anomalies
curl -sk https://localhost:8443/api/v1/anomalies \
  -H "Authorization: Bearer $(curl -sk -X POST https://localhost:8443/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"Admin@12345"}' \
    | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
```

## CostGuard Web Console

CostGuard is the unified FinOps & Observability mission control web console built with React 18, TypeScript, Tailwind CSS, and Apache ECharts. One secure URL exposes the entire platform:
- **CostGuard Web Console**: `https://localhost:8443/`
- **Embedded Grafana Dashboards**: `https://localhost:8443/monitoring?tab=grafana`
- **Embedded Prometheus PromQL Console**: `https://localhost:8443/monitoring?tab=prometheus`
- **Interactive API Documentation**: `https://localhost:8443/docs`

**Demo Credentials**:
- **Admin**: `admin` / `admin123` (Full permissions: live SSE log stream, simulation controls, thresholds, user management)
- **Analyst**: `analyst` / `analyst123` (Read-only analytics and observability; restricted from administrative actions)

## Architecture

```
Client / Browser → Nginx :8443 (TLS + Auth Gate)
                     ├── /*             → CostGuard Frontend (React + TS + ECharts)
                     ├── /api/*         → API Blue/Green (FastAPI)
                     ├── /grafana/*     → Grafana Kiosk (Protected by auth_request)
                     └── /prometheus/*  → Prometheus Metrics (Protected by auth_request)
                                            ↓
               API Blue/Green → Redis Streams → Worker → PostgreSQL
                                                  ↓
                                            Detection Engine
                                            (z-score, pct, EWMA, new-resource)
                                                  ↓
                                            Anomaly + Root Cause → Webhooks / Alerts
```

**11 containers**: Frontend (Nginx), PostgreSQL, Redis, API (blue), Worker, Nginx Gateway, Prometheus, Grafana, Redis Exporter, Postgres Exporter, Node Exporter.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/FRONTEND.md](docs/FRONTEND.md) for full design rationale.

## Key Commands

| Command | Description |
|---------|-------------|
| `make up` | Build and start all services |
| `make test` | Run unit tests |
| `make seed` | Seed 14 days of simulated history |
| `make inject` | Inject a spike/drift/new_resource anomaly |
| `make deploy VERSION=1.1.0` | Blue/green deploy with health gate |
| `make deploy-faulty` | Deploy faulty release → auto-rollback |
| `make experiment-worker` | Kill worker, measure MTTR |
| `make loadtest` | Run Locust load tests (low/medium/high) |
| `make drift` | Check config drift |
| `make evaluate` | Measure precision/recall/F1 |

## Detection Methods

| Method | What it catches |
|--------|----------------|
| **z-score** | Sudden cost spikes (cost > mean + 3σ) |
| **pct-jump** | Large percentage increases (> 50% above mean) |
| **EWMA drift** | Gradual cost creep over time |
| **new-resource** | Previously unseen resources appearing with cost |
| **aggregate** | Total hourly spend spike across all resources |

## Project Structure

```
app/
  config.py          # Pydantic settings + YAML loader
  db.py              # SQLAlchemy engine and session
  models.py          # 12 ORM tables
  schemas.py         # Pydantic API contracts
  security.py        # Auth, RBAC, audit logging
  main.py            # FastAPI app factory + middleware
  detection/         # Pure detection logic (baseline, rules, root_cause, engine)
  simulator/         # Deterministic data generator (catalog + generator)
  worker/            # Redis Streams consumer + alert dispatch
  routers/           # API endpoints (health, auth, records, anomalies, costs, config, admin)
alembic/             # Database migrations
config/              # Default thresholds (config.yaml)
docker/              # Dockerfile + entrypoint
nginx/               # Reverse proxy config
monitoring/          # Prometheus, Grafana dashboards and alerts
scripts/             # Deploy, rollback, simulate, failure experiments, evaluation
loadtests/           # Locust load test scenarios
tests/               # Unit tests (rules, baseline, root_cause, auth)
docs/                # Architecture, API reference, deployment, experiments, demo script
```

## Documentation

- [Architecture & Design Rationale](docs/ARCHITECTURE.md)
- [API Reference](docs/README_API.md)
- [Deployment Guide (EC2)](docs/DEPLOYMENT.md)
- [Experiments & Expected Results](docs/EXPERIMENTS.md)
- [Demo Script (Viva)](docs/DEMO_SCRIPT.md)
- [Assumptions](docs/ASSUMPTIONS.md)

## Automated Testing

The repository contains an end-to-end unit and integration test suite with cross-dialect database compatibility (in-memory SQLite fixtures for local and CI runs):

```bash
# Run the complete test suite locally
pytest tests/ -v

# Run with test coverage
pytest tests/ --cov=app --cov-report=term-missing
```

| Test Suite | Scope |
|------------|-------|
| `tests/test_baseline.py` | Welford variance tracking and numerical underflow safeguards |
| `tests/test_schemas.py` | Ingestion payload validation (finite numbers, ISO timestamps) |
| `tests/test_auth.py` | Password hashing, API key tokens, forwarded IP extraction |
| `tests/test_api_auth_health.py` | Authentication, RBAC, health, and Prometheus metrics endpoints |
| `tests/test_api_anomalies.py` | Eager-loaded anomaly listing, pagination headers, and status transitions |
| `tests/test_api_config.py` | Runtime threshold configuration and monotonic severity validation |
| `tests/test_rules.py` | Z-score, percentage jump, EWMA drift, severity floors, and direction tags |
| `tests/test_queue.py` | Redis stream payload deserialization and structured dead-letter queuing |
| `tests/test_root_cause.py` | Aggregate anomaly attribution and dimension grouping |
| `tests/test_engine.py` | Detection orchestration, baseline persistence, deduplication, and escalation |

## Tech Stack

- **API**: FastAPI + Gunicorn + Uvicorn
- **Database**: PostgreSQL 16 + SQLAlchemy + Alembic
- **Queue**: Redis 7 Streams (consumer groups, XAUTOCLAIM)
- **Cache**: Redis (TTL-based, summary + baseline)
- **Proxy**: Nginx (TLS, blue/green upstream switching)
- **Monitoring**: Prometheus + Grafana (14-panel dashboard, 6 alert rules)
- **Deploy**: Blue/green with health gate + auto-rollback
- **Testing**: pytest (unit & integration), Locust (load), controlled failure experiments

