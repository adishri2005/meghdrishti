# Cloud Cost Anomaly Detection (CCAD) / CostGuard: Architecture & Data Flow

CostGuard (Cloud Cost Anomaly Detection — Project P75) is a distributed FinOps observability platform that continuously monitors cloud infrastructure spending, establishes historical spending baselines per resource using streaming statistical algorithms, flags unusual cost spikes and creeping drift, isolates root-cause contributors across organizational dimensions, dispatches automated alerts, and provides a zero-downtime, blue/green deployed operational console with native PromQL metrics and embedded Grafana dashboards.

---

## 2. Tech Stack

| Layer | Technologies & Frameworks | Key Dependencies | Primary Source Files |
|---|---|---|---|
| **Reverse Proxy & Gateway** | Nginx 1.27 Alpine | TLS v1.2/1.3, `auth_request` sub-requests, dynamic upstream switching | [nginx/nginx.conf](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/nginx/nginx.conf) |
| **Frontend SPA** | React 18.3, TypeScript 5.6 (Strict), Vite 5.4 | Apache ECharts 5, TanStack Query v5, TanStack Table v8, Tailwind CSS 3.4, Lucide React, Sonner | [frontend/src/App.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/App.tsx), [frontend/src/router.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/router.tsx) |
| **Application API** | Python 3.11, FastAPI, Uvicorn / Gunicorn | Pydantic v2, python-jose (JWT), bcrypt, prometheus-client | [app/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/main.py), [app/routers/](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers) |
| **Message Broker & Cache** | Redis 7 Alpine | Redis Streams (Consumer Groups, `XREADGROUP`, `XAUTOCLAIM`), Key-Value TTL Caches | [app/queue.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/queue.py), [app/cache.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/cache.py) |
| **Stream Processing Worker**| Python 3.11 Background Consumer | Redis client, SQLAlchemy 2.0, HTTPX (Alert Webhooks) | [app/worker/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py), [app/worker/alerts.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/alerts.py) |
| **Relational Database** | PostgreSQL 16 Alpine | SQLAlchemy ORM, Alembic migrations, psycopg2 | [app/models.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/models.py), [app/db.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/db.py) |
| **Telemetry & Observability**| Prometheus v2.54.0, Grafana 11.2.0 | Redis Exporter v1.63, Postgres Exporter v0.15, Node Exporter v1.8.2 | [monitoring/prometheus.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/monitoring/prometheus.yml), [monitoring/alert_rules.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/monitoring/alert_rules.yml) |
| **Container & Orchestration**| Docker Compose (11 Containers) | Bridge networking (`ccad-net`), Named volumes, Health check probes | [docker-compose.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/docker-compose.yml) |

---

## 3. Color & Shape Legend

| Symbol / Shape | Semantic Meaning | Color Class (`classDef`) | Hex Code |
|:---:|---|---|:---:|
| `(Rounded Box)` | Frontend UI Page or Component | `fe` (Blue) | `#1E40AF` fill / `#60A5FA` stroke |
| `[Rectangle]` | Backend Service, Controller, Middleware | `be` (Green) | `#065F46` fill / `#34D399` stroke |
| `[Rectangle]` | Business Logic & Scoring/Detection Engine | `engine` (Orange) | `#9A3412` fill / `#FB923C` stroke |
| `[(Cylinder)]` | Database, Persistent Store, Queue, Cache | `data` (Purple) | `#581C87` fill / `#C084FC` stroke |
| `{{Hexagon}}` | External Network Client, Webhook, Exporter | `ext` (Gray) | `#374151` fill / `#9CA3AF` stroke |
| `{-Diamond-}` | Decision Point / Gate / Threshold Check | `engine` (Orange) | `#9A3412` fill / `#FB923C` stroke |
| `([Stadium])` | Start / End Terminal Point | `term` (Slate) | `#1E293B` fill / `#94A3B8` stroke |
| `-.-> Red Line` | Error, Rollback, DLQ, or Fallback Path | `err` (Red) | `#991B1B` fill / `#F87171` stroke |

---

## 4. MASTER ARCHITECTURE & DATA FLOW DIAGRAM

```mermaid
flowchart TB
    classDef fe fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#ffffff;
    classDef be fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef engine fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#ffffff;
    classDef data fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#ffffff;
    classDef ext fill:#1f2937,stroke:#9ca3af,stroke-width:2px,color:#ffffff;
    classDef err fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#ffffff;
    classDef term fill:#0f172a,stroke:#94a3b8,stroke-width:2px,color:#ffffff;

    subgraph CLIENT_LAYER ["1. CLIENT & OPERATOR LAYER"]
        User(["FinOps / DevOps Engineer"]):::term
        IngestClient{{"Automated Ingestion Client / simulate.py"}}:::ext
    end

    subgraph GATEWAY_LAYER ["2. GATEWAY & AUTHENTICATION GATEWAY"]
        NginxGateway["Nginx Gateway :8443 (TLS Termination)"]:::be
        NginxAuthGate{"Nginx Auth Gate (/_auth_verify)"}:::be
        UpstreamFile["/etc/nginx/active/upstream.inc"]:::be
    end

    subgraph FRONTEND_LAYER ["3. FRONTEND CONSOLE (CostGuard React 18 SPA)"]
        UI_Overview("Overview Dashboard (ECharts)"):::fe
        UI_Costs("Costs Explorer & Treemap"):::fe
        UI_Anomalies("Anomalies Triage Table & BandChart"):::fe
        UI_Simulator("Simulator Studio"):::fe
        UI_Logs("Live Logs (SSE Virtualized)"):::fe
        UI_Monitoring("Monitoring Hub (PromQL/Grafana)"):::fe
        TanStackQuery["TanStack Query Cache"]:::fe
    end

    subgraph API_LAYER ["4. API APPLICATION LAYER (FastAPI Blue/Green)"]
        ActiveAPI["FastAPI Active Node (:8000)"]:::be
        StandbyAPI["FastAPI Standby Node (:8000)"]:::be
        MW_Security["Security & CORS Middleware"]:::be
        MW_ReqId["Request-ID Middleware"]:::be
        MW_Timing["Timing & Metrics Middleware"]:::be
        MW_Fault{"Fault Injection (FAULTY_RELEASE=true?)"}:::be
        Router_Auth["Auth Router (/api/v1/auth)"]:::be
        Router_Records["Records Router (/api/v1/records/batch)"]:::be
        Router_Admin["Admin Router (/api/v1/admin/simulate)"]:::be
        Router_Anomalies["Anomalies Router (/api/v1/anomalies)"]:::be
        Router_Costs["Costs Router (/api/v1/costs)"]:::be
        Router_Health["Health Router (/health/live, /health/ready)"]:::be
    end

    subgraph LOGIC_LAYER ["5. BUSINESS LOGIC & DETECTION ENGINE"]
        IngestValidator{"Validate Batch (ts <= now+1h, cost >= 0)"}:::engine
        StreamConsumer["Worker Consumer Loop (XREADGROUP)"]:::engine
        AutoClaimEngine["XAUTOCLAIM Engine (Reclaim idle >15s)"]:::engine
        SortCausal["Sort Batch Chronologically by ts"]:::engine
        ColdStartGate{"Is Cold-Start? (n < min_samples=5)"}:::engine
        Rule_D{"Rule D: New Resource? (seen=False & cost >= $1.00 & history > 24h)"}:::engine
        WelfordCalc["Welford Algorithm (Compute mean, M2, sample std)"]:::engine
        StdFloorCalc["Apply Variance Floor (std_eff = max(std, 0.05*mean, 0.01))"]:::engine
        Rule_A{"Rule A: z-score > 3.0?"}:::engine
        Rule_B{"Rule B: pct_jump > 50.0%?"}:::engine
        Rule_C{"Rule C: EWMA drift > 1.3?"}:::engine
        SeverityClassifier["Severity Matrix (Max rank of z and pct: Critical/High/Med/Low)"]:::engine
        DedupEngine{"Open Anomaly within 6h Dedup Window?"}:::engine
        EscalationHandler["Update Occurrences, Peak Cost, Escalate Severity"]:::engine
        RootCauseEngine["Root Cause Attribution (Rank Deltas, Group by Team/Service/Region)"]:::engine
        AggregateEngine{"Hourly Aggregate Spend Jump > 50%?"}:::engine
        BaselineUpdater["Update Welford Baseline (Only if NORMAL)"]:::engine
    end

    subgraph DATA_LAYER ["6. DATA & MESSAGING INFRASTRUCTURE"]
        RedisStream[("Redis Stream: cost_records (detectors group)")]:::data
        RedisDLQ[("Redis DLQ: cost_records:dlq")]:::err
        RedisCache[("Redis TTL Cache (Baselines: 300s, Summaries: 60s)")]:::data
        PostgresDB[("PostgreSQL 16 Relational Store (13 Tables)")]:::data
    end

    subgraph TELEMETRY_ALERTS ["7. OBSERVABILITY, ALERTS & JOBS"]
        AlertDispatcher["Worker Alert Dispatcher"]:::be
        SlackWebhook{{"Alert Webhook (Slack / Teams / HTTP)"}}:::ext
        PrometheusServer[("Prometheus Server :9090 (15s scrape)")]:::data
        GrafanaKiosk("Grafana Kiosk :3000 (14-Panel Dashboard)"):::fe
        DeployScript["deploy.sh / rollback.sh"]:::be
    end

    %% Client Interactions
    User -->|1. HTTPS Request :8443| NginxGateway
    IngestClient -->|1. Batch Ingest POST| NginxGateway

    %% Gateway Routing
    NginxGateway -->|2. Route /api/* via active upstream| UpstreamFile
    UpstreamFile --> ActiveAPI
    NginxGateway -->|2. Route /* SPA files| UI_Overview
    NginxGateway -->|2. Route /grafana/* & /prometheus/*| NginxAuthGate
    NginxAuthGate -->|3. Subrequest /_auth_verify| Router_Auth
    NginxAuthGate -->|4. If Valid Admin/Analyst| GrafanaKiosk
    NginxAuthGate -->|4. If Valid Admin/Analyst| PrometheusServer

    %% API Processing Pipeline
    ActiveAPI --> MW_Security
    MW_Security --> MW_ReqId
    MW_ReqId --> MW_Timing
    MW_Timing --> MW_Fault
    MW_Fault -.->|5a. Injected 500 Failure| User
    MW_Fault -->|5b. Normal Request| Router_Records
    MW_Fault -->|5b. Normal Request| Router_Admin
    MW_Fault -->|5b. Normal Request| Router_Anomalies
    MW_Fault -->|5b. Normal Request| Router_Costs

    %% Ingestion Flow
    Router_Records -->|6. Validate Payloads| IngestValidator
    Router_Admin -->|6. Validate Synthetic Payloads| IngestValidator
    IngestValidator -.->|7a. Invalid: Future ts or negative cost| User
    IngestValidator -->|7b. Create IngestionJob queued| PostgresDB
    IngestValidator -->|8. XADD cost_records| RedisStream

    %% Worker Processing
    RedisStream -->|9. XREADGROUP detectors batch <= 500| StreamConsumer
    AutoClaimEngine -->|Reclaim stuck messages > 15s| StreamConsumer
    StreamConsumer -.->|10a. JSON Deserialization Failure| RedisDLQ
    StreamConsumer -->|10b. Idempotent Insert (ON CONFLICT DO NOTHING)| PostgresDB
    StreamConsumer -->|11. Sort by Timestamp| SortCausal

    %% Detection Engine Decision Tree
    SortCausal --> Rule_D
    Rule_D -->|Yes: Flag new_resource anomaly| SeverityClassifier
    Rule_D -->|No: Check historical samples| ColdStartGate
    ColdStartGate -->|Yes: n < 5 cold-start| BaselineUpdater
    ColdStartGate -->|No: Sufficient samples| WelfordCalc
    WelfordCalc -->|Lookup cached stats| RedisCache
    WelfordCalc --> StdFloorCalc
    StdFloorCalc --> Rule_A
    Rule_A -->|z > 3.0: Spike| SeverityClassifier
    Rule_A -->|z <= 3.0| Rule_B
    Rule_B -->|pct > 50%: Jump| SeverityClassifier
    Rule_B -->|pct <= 50%| Rule_C
    Rule_C -->|EWMA > 1.3: Drift| SeverityClassifier
    Rule_C -->|No Anomaly Detected| BaselineUpdater

    %% Severity and Deduplication
    SeverityClassifier --> DedupEngine
    DedupEngine -->|Open match found within 6h| EscalationHandler
    EscalationHandler --> PostgresDB
    DedupEngine -->|New Incident| RootCauseEngine
    RootCauseEngine -->|Insert Anomaly Row with JSONB Root Cause| PostgresDB

    %% Aggregate Detection & Baseline Update
    BaselineUpdater -->|Save updated n, mean, m2| PostgresDB
    BaselineUpdater -->|Refresh cache (TTL 300s)| RedisCache
    BaselineUpdater --> AggregateEngine
    AggregateEngine -->|Sum Delta > 50% Jump| RootCauseEngine

    %% Commit, Ack, Alerts
    RootCauseEngine --> AlertDispatcher
    AlertDispatcher -->|Create log alert row| PostgresDB
    AlertDispatcher -->|POST Webhook payload (timeout 3s)| SlackWebhook
    StreamConsumer -->|12. Transaction Commit & XACK| RedisStream

    %% UI Querying & Feedback Loop
    UI_Overview -->|Query /api/v1/stats/overview| TanStackQuery
    UI_Costs -->|Query /api/v1/costs/timeseries| TanStackQuery
    UI_Anomalies -->|Query /api/v1/anomalies| TanStackQuery
    TanStackQuery --> Router_Costs
    TanStackQuery --> Router_Anomalies
    Router_Costs -->|Read cached group-by aggregation| RedisCache
    Router_Anomalies -->|Read incident rows| PostgresDB
    UI_Monitoring -->|Direct PromQL range queries| PrometheusServer
    PrometheusServer -->|Scrape metrics /metrics| ActiveAPI
    PrometheusServer -->|Scrape metrics :8001| StreamConsumer
    DeployScript -->|Atomic Upstream Flip & Reload| UpstreamFile
```

---

## 5. Step-by-Step Walkthrough of the Master Diagram

### Step 1: Client Request Inception
An engineer accesses the CostGuard Web Console (`https://localhost:8443`) or an automated ingestion client (`scripts/simulate.py` / CI runner) submits billing telemetry to the Nginx reverse gateway.

### Step 2: Gateway Routing & TLS Termination
`nginx:1.27-alpine` terminates TLS on port `8443`, injects OWASP headers, and routes traffic based on URL prefix:
- `/*` serves static frontend assets from the SPA container.
- `/api/*` proxies to `api_active` configured via `/etc/nginx/active/upstream.inc`.
- `/grafana/*` and `/prometheus/*` are routed through an internal `auth_request /_auth_verify` sub-request.

### Step 3: Auth Verification Sub-request
`GET /api/v1/auth/verify` validates the `ccad_token` cookie or `Authorization: Bearer` JWT. If the principal lacks `admin` or `analyst` roles, Nginx returns HTTP `401 Unauthorized` or `403 Forbidden`, preventing unauthorized access to raw monitoring endpoints.

### Step 4: Monitoring Proxy Access
Upon successful verification, Nginx proxies requests to Grafana (`grafana:3000`) or Prometheus (`prometheus:9090`), stripping prefixes where appropriate.

### Step 5: Middleware Pipeline Execution
Within FastAPI ([app/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/main.py#L57-L63)):
1. `SecurityHeadersMiddleware` appends CSP, nosniff, frame-options headers.
2. `RequestIdMiddleware` extracts or generates an `X-Request-ID` UUID.
3. `TimingMiddleware` benchmarks duration and updates `api_latency_seconds` and `api_requests_total`.
4. `FaultInjectionMiddleware` (active only when `FAULTY_RELEASE=true`) injects HTTP 500 errors on 50% of non-health requests to demonstrate automated rollback.

### Step 6: Ingestion Payload Validation
In `POST /api/v1/records/batch` ([app/routers/records.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/records.py#L32-L94)):
- Timestamps exceeding 1 hour in the future trigger HTTP `400 Bad Request`.
- Costs must be non-negative, finite floats.
- Batch size is bounded between 1 and 5,000 records.

### Step 7: Asynchronous Job Persistence
A tracking record is created in `ingestion_jobs` with status `queued`. The batch is enqueued to Redis Stream `cost_records` using `XADD`. The API immediately returns HTTP `202 Accepted` with the `job_id`.

### Step 8: Stream Queue Ingestion
Records enter the `cost_records` stream under consumer group `detectors`.

### Step 9: Worker Batch Consumption
The background worker ([app/worker/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py)) reads up to 500 messages via `XREADGROUP`. Concurrently, `XAUTOCLAIM` reclaims messages from crashed or idle consumers after 15 seconds.

### Step 10: Idempotent Database Writes & DLQ Handling
- Malformed payloads that fail JSON decoding are moved to Dead-Letter Queue `cost_records:dlq`.
- Valid records upsert the `resources` table and insert into `cost_records` using `ON CONFLICT (resource_id, ts) DO NOTHING`, ensuring idempotent replays.

### Step 11: Causal Timestamp Sorting
Records within the batch are sorted chronologically by `timestamp` so baseline metrics evolve in true historical order.

### Step 12: Detection Decision Engine Execution
For each record, the detection engine evaluates rules in sequence:
- **Rule D (New Resource):** Flags unknown resources with cost $\ge \$1.00$ when system history $>24$h.
- **Cold-Start Check:** Suppresses statistical checks if sample count $n < 5$.
- **Welford Algorithm:** Loads baseline $(\mu, M_2)$ from Redis cache (or DB). Computes $\sigma_{\text{eff}} = \max(\sigma, 0.05\mu, 0.01)$.
- **Rule A (Z-Score):** $z > 3.0 \implies$ Statistical spike.
- **Rule B (Percentage Jump):** $\text{pct} > 50.0\% \implies$ Relative increase.
- **Rule C (EWMA Drift):** Sustained gradual cost creep ($\text{EWMA} > 1.3$) when Rules A and B do not trigger.

### Step 13: Severity Classification & Deduplication
- Severity is assigned based on the maximum rank of $z$ and $\text{pct}$ (Critical, High, Medium, Low).
- The deduplication engine queries open anomalies for the resource within a 6-hour window. Existing matches update `occurrences`, `peak_cost`, and `last_seen_ts`, escalating severity if the new condition is worse. New incidents insert a row into `anomalies`.

### Step 14: Hourly Aggregate Analysis
After evaluating all resource records for an hour, `process_aggregate()` computes macro spend increase: $\frac{\sum \text{observed} - \sum \mu}{\sum \mu} \times 100$. If increase $> 50\%$, an aggregate anomaly is generated with root-cause contribution rankings.

### Step 15: Baseline Evolution (Poisoning Safeguard)
Normal records update Welford statistics and write back to PostgreSQL and Redis cache (TTL 300s). Anomalous records skip baseline updates to prevent baseline corruption.

### Step 16: Alert Dispatch & Stream Acknowledgment
Webhook alerts are dispatched via HTTP POST (timeout 3s) and recorded in `alerts`. After database transaction commit, the worker issues `XACK` to acknowledge messages in Redis.

### Step 17: UI Data Retrieval & Visualization
The CostGuard frontend fetches cached summaries, anomaly timelines with $\pm 3\sigma$ confidence bands (BandChart), and live PromQL telemetry, completing the operational loop.

---

## 6. Scoring Logic

### 6.1. Formulas
The mathematical formulas governing detection in [app/detection/baseline.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/baseline.py) and [app/detection/rules.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py):

```python
# 1. Welford's Running Statistics (app/detection/baseline.py:48-71)
delta = value - mean_prev
mean_new = mean_prev + (delta / n)
delta2 = value - mean_new
m2_new = max(0.0, m2_prev + delta * delta2)
std = math.sqrt(max(0.0, m2_new) / (n - 1)) if n >= 2 else 0.0

# 2. Effective Standard Deviation Floor (app/detection/rules.py:149-153)
std_eff = max(
    std,
    std_floor_pct * mean if mean > 0 else 0.0,  # 0.05 * mean
    std_floor_abs                               # 0.01
)

# 3. Z-Score (app/detection/rules.py:154)
z_score = (cost - mean) / std_eff if std_eff > 0 else 0.0

# 4. Percentage Increase (app/detection/rules.py:155)
pct_increase = ((cost - mean) / mean * 100.0) if mean > 0 else 0.0

# 5. EWMA Ratio & Drift (app/detection/rules.py:209-210)
ratio = cost / mean if mean > 0 else 1.0
new_ewma = ewma_alpha * ratio + (1.0 - ewma_alpha) * ewma_prev  # alpha = 0.3

# 6. Aggregate Cost Delta & Share (app/detection/root_cause.py:86, 102)
delta_i = max(cost_i - mean_i, 0.0)
share_pct_i = (delta_i / total_delta) * 100.0
```

### 6.2. Weight & Threshold Parameters Table

| Parameter | Code Variable | Default Value | Config Key | Source Location |
|---|---|:---:|---|---|
| Z-Score Anomaly Threshold | `z_threshold` | `3.0` | `detection.z_threshold` | [app/detection/rules.py:34](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L34) |
| Percentage Jump Threshold | `pct_jump_threshold`| `50.0%` | `detection.pct_jump_threshold`| [app/detection/rules.py:35](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L35) |
| EWMA Smoothing Factor ($\alpha$) | `ewma_alpha` | `0.3` | `detection.ewma_alpha` | [app/detection/rules.py:36](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L36) |
| EWMA Drift Trigger Ratio | `ewma_drift_ratio` | `1.3` | `detection.ewma_drift_ratio` | [app/detection/rules.py:37](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L37) |
| Cold-Start Sample Minimum | `min_samples` | `5` | `detection.min_samples` | [app/detection/rules.py:38](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L38) |
| Relative Std Floor | `std_floor_pct` | `0.05` ($5\%$) | `detection.std_floor_pct` | [app/detection/rules.py:39](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L39) |
| Absolute Std Floor | `std_floor_abs` | `0.01` ($\$0.01$) | `detection.std_floor_abs` | [app/detection/rules.py:40](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L40) |
| New Resource Cost Minimum | `new_resource_cost_floor`| `1.0` ($\$1.00$) | `detection.new_resource_cost_floor`| [app/detection/rules.py:41](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L41) |
| Aggregate Hourly Jump | `aggregate_pct_threshold`| `50.0%` | `detection.aggregate_pct_threshold`| [config/config.yaml:9](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/config/config.yaml#L9) |
| Anomaly Deduplication Window | `dedup_window_hours`| `6` hours | `detection.dedup_window_hours`| [config/config.yaml:10](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/config/config.yaml#L10) |

### 6.3. Worked Mathematical Example

#### Initial State
A GPU cluster (`ec2-ml-gpu-01`) has 14 historical observations ($n=14$) for hour `14:00`:
- Running mean: $\mu = 3.0000$
- Sum of squared deviations: $M_2 = 0.5200$
- Previous EWMA ratio: $\text{EWMA}_{\text{prev}} = 1.0500$
- Anomaly observation arrives: $\text{cost} = 36.0000$ ($12\times$ injection spike)

#### Step 1: Baseline Variance Calculation
$$\sigma = \sqrt{\frac{M_2}{n - 1}} = \sqrt{\frac{0.5200}{13}} = \sqrt{0.0400} = 0.2000$$

#### Step 2: Variance Floor Application
$$\sigma_{\text{floor, pct}} = 0.05 \times 3.0000 = 0.1500$$
$$\sigma_{\text{floor, abs}} = 0.0100$$
$$\sigma_{\text{eff}} = \max(0.2000, \, 0.1500, \, 0.0100) = 0.2000$$

#### Step 3: Z-Score Calculation
$$z = \frac{36.0000 - 3.0000}{0.2000} = \frac{33.0000}{0.2000} = 165.0000$$

#### Step 4: Percentage Jump Calculation
$$\text{pct} = \frac{36.0000 - 3.0000}{3.0000} \times 100 = 1100.00\%$$

#### Step 5: EWMA Update
$$\text{ratio} = \frac{36.0000}{3.0000} = 12.0000$$
$$\text{EWMA}_{\text{new}} = 0.3 \times 12.0000 + 0.7 \times 1.0500 = 3.6000 + 0.7350 = 4.3350$$

#### Step 6: Rule Evaluation & Severity Assignment
- $z = 165.00 > 3.0 \implies$ Rule A triggers (`True`).
- $\text{pct} = 1100.0\% > 50.0\% \implies$ Rule B triggers (`True`).
- Method assigned: `"z_score"`.
- Severity classification:
  - $z = 165.0 \ge 10.0 \implies \text{Critical}$
  - $\text{pct} = 1100.0\% \ge 300.0\% \implies \text{Critical}$
  - Final Severity: **Critical**.
- Baseline action: **Skipped** (preserves $\mu=3.0000, \sigma=0.2000$ to prevent baseline poisoning).

---

## 7. Classification Logic

### 7.1. Rule & Severity Decision Table

| Classification Dimension | Assigned Class / Value | Exact Logical Condition / Threshold | Source File & Handler |
|---|---|---|---|
| **Severity** | `critical` | $z \ge 10.0$ OR $\text{pct} \ge 300.0\%$ | [app/detection/rules.py:107, 115](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L107) |
| **Severity** | `high` | $z \ge 6.0$ OR $\text{pct} \ge 150.0\%$ | [app/detection/rules.py:109, 117](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L109) |
| **Severity** | `medium` | $z \ge 4.0$ OR $\text{pct} \ge 100.0\%$; or `ewma_drift`; or `new_resource` | [app/detection/rules.py:111, 119, 184, 233](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L111) |
| **Severity** | `low` | Triggered $z > 3.0$ or $\text{pct} > 50.0\%$ but below medium thresholds | [app/detection/rules.py:130](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L130) |
| **Detection Method** | `new_resource` | `is_new_resource == True` AND `system_has_history == True` AND `cost >= 1.0` | [app/detection/rules.py:184-194](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L184-L194) |
| **Detection Method** | `z_score` | $z > 3.0$ OR $\text{pct} > 50.0\%$ | [app/detection/rules.py:216-229](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L216-L229) |
| **Detection Method** | `ewma_drift` | NOT (`z_score` or `pct_jump`) AND $\text{EWMA} > 1.3$ | [app/detection/rules.py:231-243](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py#L231-L243) |
| **Detection Method** | `aggregate_jump`| Hourly aggregate $\frac{\sum \text{cost} - \sum \mu}{\sum \mu} \times 100 > 50.0\%$ | [app/detection/root_cause.py:78](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/root_cause.py#L78) |
| **Incident Status** | `open` | Initial state upon anomaly detection | [app/models.py:204](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/models.py#L204) |
| **Incident Status** | `acknowledged`| Operator triage via `/api/v1/anomalies/{id}` | [app/routers/anomalies.py:214](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L214) |
| **Incident Status** | `resolved` | Operator remediation via `/api/v1/anomalies/{id}` | [app/routers/anomalies.py:214](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L214) |
| **Resource Health** | `anomalous` | Count of open or acknowledged anomalies $> 0$ | [app/routers/resources.py:287](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L287) |
| **Resource Health** | `normal` | Count of open or acknowledged anomalies $== 0$ | [app/routers/resources.py:287](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L287) |
| **Job Status** | `done` | `processed_count + failed_count >= record_count` AND `failed_count == 0` | [app/worker/main.py:270-272](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py#L270-L272) |
| **Job Status** | `failed` | `processed_count + failed_count >= record_count` AND `failed_count > 0` | [app/worker/main.py:270-272](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py#L270-L272) |

---

## 8. Sorting & Ranking

| Priority | Entity / Context | Sort Key | Direction | Implementation Level | Code Reference |
|:---:|---|---|:---:|:---:|---|
| **1** | Stream Ingestion Batch | `payload.timestamp` | **ASC** | Worker Memory (Python) | [app/worker/main.py:192](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py#L192) |
| **2** | Aggregate Top Contributors | Resource Delta ($\Delta = \text{cost} - \mu$) | **DESC** | Worker Memory (Python) | [app/detection/root_cause.py:94](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/root_cause.py#L94) |
| **3** | Root Cause Dimensional Groups | Group Delta ($\sum \Delta$) | **DESC** | Worker Memory (Python) | [app/detection/root_cause.py:195](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/root_cause.py#L195) |
| **4** | Anomaly Feed Listing | `anomalies.detected_at` | **DESC** | PostgreSQL Database Index | [app/routers/anomalies.py:71](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L71) |
| **5** | Ingestion Jobs List | `ingestion_jobs.created_at` | **DESC** | PostgreSQL Database | [app/routers/jobs.py:44](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/jobs.py#L44) |
| **6** | Deployment Timeline | `deployments.deployed_at` | **DESC** | PostgreSQL Database | [app/routers/admin.py:183](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L183) |
| **7** | Security Audit Trail | `audit_logs.ts` | **DESC** | PostgreSQL Database Index | [app/routers/audit_logs.py:59](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/audit_logs.py#L59) |
| **8** | Cost History Timeseries | `cost_records.ts` | **ASC** | PostgreSQL Database Index | [app/routers/costs.py:208](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/costs.py#L208) |
| **9** | Resource Catalog (Default) | `cost_24h` | **DESC** | Backend / Frontend | [app/routers/resources.py:76](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L76) |
| **10**| Top Spenders (Overview) | 24-Hour Total Spend | **DESC** | PostgreSQL Database | [app/routers/stats.py:100-112](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/stats.py#L100-L112) |

---

## 9. Drill-Down Diagrams

### 9.1. Scoring Pipeline Flowchart

```mermaid
flowchart TD
    classDef step fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef calc fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#ffffff;
    classDef store fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#ffffff;

    Start([Incoming Cost Record]):::step --> GetBaseline[Load Baseline Stats n, mean, m2]:::step
    GetBaseline --> CheckN{n >= 2?}:::calc
    CheckN -->|No| StdZero[std = 0.0]:::calc
    CheckN -->|Yes| CalcStd["std = sqrt(m2 / (n - 1))"]:::calc
    StdZero --> FloorCalc
    CalcStd --> FloorCalc
    FloorCalc["std_eff = max(std, 0.05 * mean, 0.01)"]:::calc
    FloorCalc --> CalcZ["z = (cost - mean) / std_eff"]:::calc
    FloorCalc --> CalcPct["pct = ((cost - mean) / mean) * 100"]:::calc
    FloorCalc --> CalcEWMA["EWMA = 0.3 * (cost/mean) + 0.7 * EWMA_prev"]:::calc
    CalcZ --> FinalMetrics[Record Verdict Metrics]:::step
    CalcPct --> FinalMetrics
    CalcEWMA --> FinalMetrics
    FinalMetrics --> Save[(Persist to anomalies table if anomalous)]:::store
```

### 9.2. Classification Decision Tree

```mermaid
flowchart TD
    classDef check fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#ffffff;
    classDef classNode fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef sevNode fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#ffffff;

    RecordIn([Cost Observation]):::check --> RuleD{New Resource & History > 24h & Cost >= $1?}:::check
    RuleD -->|Yes| NewResClass[Method: new_resource]:::classNode
    NewResClass --> MedSev[Severity: medium]:::sevNode
    RuleD -->|No| ColdCheck{Samples n < 5?}:::check
    ColdCheck -->|Yes: Cold Start| NoAnomaly[No Anomaly: Normal Baseline Progress]:::classNode
    ColdCheck -->|No| RuleA{z > 3.0?}:::check
    RuleA -->|Yes| SpikeClass[Method: z_score]:::classNode
    RuleA -->|No| RuleB{pct > 50.0%?}:::check
    RuleB -->|Yes| JumpClass[Method: z_score / pct_jump]:::classNode
    RuleB -->|No| RuleC{EWMA > 1.3?}:::check
    RuleC -->|Yes| DriftClass[Method: ewma_drift]:::classNode
    RuleC -->|No| NormalClass[Normal Spend: Update Baseline]:::classNode

    SpikeClass --> SevCheck{z >= 10 OR pct >= 300%?}:::check
    JumpClass --> SevCheck
    SevCheck -->|Yes| CritSev[Severity: critical]:::sevNode
    SevCheck -->|No| HighCheck{z >= 6 OR pct >= 150%?}:::check
    HighCheck -->|Yes| HighSev[Severity: high]:::sevNode
    HighCheck -->|No| MedCheck{z >= 4 OR pct >= 100%?}:::check
    MedCheck -->|Yes| MedSev2[Severity: medium]:::sevNode
    MedCheck -->|No| LowSev[Severity: low]:::sevNode
    DriftClass --> DriftSevCheck{pct >= 100%?}:::check
    DriftSevCheck -->|Yes| SevCheck
    DriftSevCheck -->|No: Floor| MedSev3[Severity: medium]:::sevNode
```

### 9.3. Primary User Journey Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as Ingestion Client / Browser
    participant Gateway as Nginx Gateway (:8443)
    participant API as FastAPI Blue (:8000)
    participant Redis as Redis Streams / Cache
    participant Worker as Stream Worker (:8001)
    participant DB as PostgreSQL 16
    participant Prom as Prometheus / Grafana

    Client->>Gateway: POST /api/v1/records/batch (JSON records)
    Gateway->>API: Proxy via active upstream (X-Request-ID attached)
    API->>API: Validate timestamps and non-negative costs
    API->>DB: INSERT IngestionJob (status='queued')
    API->>Redis: XADD cost_records (job_id, payload)
    API-->>Gateway: HTTP 202 Accepted (job_id)
    Gateway-->>Client: HTTP 202 Accepted (job_id)

    Worker->>Redis: XREADGROUP detectors (batch <= 500)
    Redis-->>Worker: Messages batch
    Worker->>DB: Upsert resources & INSERT cost_records (ON CONFLICT DO NOTHING)
    Worker->>Redis: GET baseline:{resource_id}:{hour}
    Redis-->>Worker: Cached stats (n, mean, m2)
    Worker->>Worker: Evaluate z-score, pct-jump, EWMA drift
    alt Anomaly Detected
        Worker->>DB: INSERT/UPDATE anomalies (JSONB root cause)
        Worker->>DB: INSERT alerts (channel='log')
        Worker->>Worker: Skip Welford update (prevent poisoning)
    else Normal Record
        Worker->>Worker: Calculate new Welford stats
        Worker->>DB: UPDATE baselines (n, mean, m2)
        Worker->>Redis: SET baseline:{resource_id}:{hour} (TTL 300s)
    end
    Worker->>DB: UPDATE IngestionJob (status='done')
    Worker->>DB: COMMIT Transaction
    Worker->>Redis: XACK cost_records (message IDs)

    Prom->>Worker: Scrape /metrics (:8001)
    Prom->>API: Scrape /metrics (:8000)
    Client->>Gateway: GET /api/v1/anomalies
    Gateway->>API: Proxy to anomalies router
    API->>DB: SELECT * FROM anomalies ORDER BY detected_at DESC
    DB-->>API: Incident rows
    API-->>Client: JSON Anomalies List with Root Cause
```

### 9.4. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o{ audit_logs : triggers
    resources ||--o{ cost_records : incurs
    resources ||--o{ baselines : maintains
    resources ||--o{ resource_state : tracks
    resources ||--o{ anomalies : experiences
    ingestion_jobs ||--o{ cost_records : batches
    anomalies ||--o{ alerts : generates

    users {
        bigint id PK
        string username UK
        string password_hash
        string role "admin | analyst"
        boolean is_active
        timestamptz created_at
    }

    api_clients {
        bigint id PK
        string name UK
        string api_key_hash UK
        string role "service"
        boolean is_active
        timestamptz created_at
    }

    resources {
        bigint id PK
        string resource_id UK
        string type "EC2 | RDS | S3 | Lambda | EBS | DataTransfer"
        string service
        string region "us-east-1 | us-west-2 | eu-west-1"
        string team_tag "web | ml | data | platform"
        timestamptz first_seen
    }

    ingestion_jobs {
        uuid id PK
        string submitted_by
        int record_count
        int processed_count
        int failed_count
        string status "queued | processing | done | failed"
        boolean backfill
        timestamptz created_at
        timestamptz finished_at
    }

    cost_records {
        bigint id PK
        bigint resource_id FK
        timestamptz ts
        numeric usage_quantity
        numeric unit_cost
        numeric cost
        uuid job_id FK
        timestamptz created_at
    }

    baselines {
        bigint resource_id PK,FK
        int hour_of_day PK "0..23"
        int n
        float mean
        float m2
        timestamptz updated_at
    }

    resource_state {
        bigint resource_id PK,FK
        float ewma_ratio
        timestamptz last_ts
        timestamptz updated_at
    }

    anomalies {
        bigint id PK
        string scope "resource | aggregate"
        bigint resource_id FK
        timestamptz detected_at
        timestamptz record_ts
        float observed_cost
        float expected_cost
        float z_score
        float pct_increase
        string severity "critical | high | medium | low"
        string method "z_score | pct_jump | ewma_drift | new_resource | aggregate_jump"
        text root_cause_summary
        jsonb root_cause
        string status "open | acknowledged | resolved"
        int occurrences
        float peak_cost
        timestamptz last_seen_ts
        string acknowledged_by
    }

    alerts {
        bigint id PK
        bigint anomaly_id FK
        string channel "log | webhook"
        timestamptz sent_at
        string delivery_status "sent | failed"
        text detail
    }

    audit_logs {
        bigint id PK
        string actor
        string action
        string entity
        string entity_id
        string ip
        string result "success | denied | error"
        jsonb detail
        timestamptz ts
    }

    settings {
        string key PK "detection | severity | queue | cache"
        jsonb value
        string updated_by
        timestamptz updated_at
    }

    deployments {
        bigint id PK
        string version
        string color "blue | green"
        string status "deployed | active | rolled_back | failed"
        timestamptz deployed_at
        timestamptz activated_at
        timestamptz rolled_back_at
        text note
    }

    ground_truth_anomalies {
        bigint id PK
        string resource_id
        string kind "spike | drift | new_resource"
        timestamptz start_ts
        timestamptz end_ts
        float multiplier
        timestamptz created_at
    }
```

### 9.5. Error Handling & Fallback Paths

```mermaid
flowchart TD
    classDef err fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#ffffff;
    classDef check fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#ffffff;
    classDef ok fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;

    Req([Incoming HTTP Request]):::check --> RateCheck{Login Rate > 10 / min?}:::check
    RateCheck -->|Yes| Ret429[HTTP 429 Too Many Requests]:::err
    RateCheck -->|No| AuthCheck{Valid JWT or API Key?}:::check
    AuthCheck -->|No| AuditDenied[Audit Log 'denied' -> HTTP 401]:::err
    AuthCheck -->|Yes| RoleCheck{Role Allowed by Route?}:::check
    RoleCheck -->|No| AuditForbidden[Audit Log 'denied' -> HTTP 403]:::err
    RoleCheck -->|Yes| BatchCheck{Timestamp > now + 1h?}:::check
    BatchCheck -->|Yes| Ret400[HTTP 400 Bad Request]:::err
    BatchCheck -->|No| Enqueue[XADD to Redis Stream]:::ok

    WorkerLoop([Worker Stream Consumer]):::check --> MsgParse{Valid JSON Payload?}:::check
    MsgParse -->|No| SendDLQ[move_to_dlq: Stream cost_records:dlq]:::err
    MsgParse -->|Yes| DBWrite{DB Transaction Succeeded?}:::check
    DBWrite -->|Exception| DBRollback[DB Rollback -> Do NOT XACK message]:::err
    DBRollback --> AutoClaim[Message remains pending -> Reclaimed via XAUTOCLAIM after 15s]:::ok
    DBWrite -->|Commit Success| WebhookTry{Webhook Configured?}:::check
    WebhookTry -->|Timeout > 3s or HTTP 5xx| WebhookFail[Alert delivery_status='failed' -> Worker continues]:::err
    WebhookTry -->|200 OK| WebhookSent[Alert delivery_status='sent']:::ok
    WebhookSent --> XAck[XACK message IDs]:::ok
    WebhookFail --> XAck
```

---

## 10. API Endpoint Reference

| Method | Path | Handler Function | Role Required | Purpose | Request Body $\rightarrow$ Response Shape | Source File |
|---|---|---|:---:|---|---|---|
| `GET` | `/health/live` | `liveness_check` | Public | Liveness probe (process up) | None $\rightarrow$ `{"status": "alive", "version": "1.0.0"}` | [app/routers/health.py:30](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/health.py#L30) |
| `GET` | `/health/ready` | `readiness_check` | Public | Readiness probe (DB + Redis up) | None $\rightarrow$ `{"status": "ok", "db": true, "redis": true}` | [app/routers/health.py:41](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/health.py#L41) |
| `GET` | `/health` | `health_check` | Public | Unified health probe for Nginx/deploy | None $\rightarrow$ HTTP 200 or 503 JSON | [app/routers/health.py:52](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/health.py#L52) |
| `GET` | `/metrics` | `prometheus_metrics` | Public | Prometheus scrape target | None $\rightarrow$ Prometheus text exposition | [app/routers/health.py:100](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/health.py#L100) |
| `POST`| `/api/v1/auth/login` | `login` | Public | User authentication & cookie grant | `{"username", "password"}` $\rightarrow$ `{"access_token", "expires_in", "role"}` | [app/routers/auth.py:48](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L48) |
| `GET` | `/api/v1/auth/me` | `get_me` | Analyst / Admin | Current session identity | None $\rightarrow$ `{"username", "role", "expires_at"}` | [app/routers/auth.py:110](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L110) |
| `POST`| `/api/v1/auth/logout` | `logout` | Authenticated | Clears `ccad_token` cookie | None $\rightarrow$ `{"status": "ok"}` | [app/routers/auth.py:125](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L125) |
| `GET` | `/api/v1/auth/verify` | `verify_session` | Public / Gateway | Fast check for Nginx `auth_request` | None $\rightarrow$ HTTP 204 No Content (or 401) | [app/routers/auth.py:142](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L142) |
| `GET` | `/api/v1/auth/users` | `list_users` | Admin | List all registered users | None $\rightarrow$ `[{"id", "username", "role", "is_active"}]` | [app/routers/auth.py:161](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L161) |
| `POST`| `/api/v1/auth/register` | `register` | Admin | Register new operator account | `{"username", "password", "role"}` $\rightarrow$ `{"id", "username", "role"}` | [app/routers/auth.py:183](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L183) |
| `POST`| `/api/v1/auth/api-clients` | `create_api_client` | Admin | Create ingestion API token | `{"name"}` $\rightarrow$ `{"id", "name", "api_key"}` | [app/routers/auth.py:218](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L218) |
| `GET` | `/api/v1/auth/api-clients` | `list_api_clients` | Admin | List API tokens without secrets | None $\rightarrow$ `[{"id", "name", "role", "is_active"}]` | [app/routers/auth.py:257](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py#L257) |
| `POST`| `/api/v1/records/batch` | `ingest_batch` | Service / Admin | Asynchronously enqueue cost batch | `{"records": [...], "backfill": bool}` $\rightarrow$ `{"job_id", "accepted"}` | [app/routers/records.py:32](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/records.py#L32) |
| `GET` | `/api/v1/records/jobs/{job_id}` | `get_job_status` | Authenticated | Query ingestion job progress | None $\rightarrow$ `{"id", "processed_count", "failed_count", "status"}` | [app/routers/records.py:96](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/records.py#L96) |
| `GET` | `/api/v1/anomalies` | `list_anomalies` | Analyst / Admin | List filterable anomaly incidents | Query params $\rightarrow$ `[{"id", "resource_name", "z_score", ...}]` | [app/routers/anomalies.py:33](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L33) |
| `GET` | `/api/v1/anomalies/{id}` | `get_anomaly_detail` | Analyst / Admin | Full anomaly record with root-cause | None $\rightarrow$ `{"id", "root_cause": {...}, "alerts": [...]}` | [app/routers/anomalies.py:140](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L140) |
| `PATCH`| `/api/v1/anomalies/{id}` | `patch_anomaly` | Analyst / Admin | Acknowledge / resolve anomaly | `{"status": "acknowledged" | "resolved"}` $\rightarrow$ AnomalyOut | [app/routers/anomalies.py:192](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L192) |
| `POST`| `/api/v1/anomalies/bulk-acknowledge` | `bulk_acknowledge` | Analyst / Admin | Bulk acknowledge all open items | None $\rightarrow$ `{"status": "ok", "count": int}` | [app/routers/anomalies.py:104](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L104) |
| `POST`| `/api/v1/anomalies/bulk-resolve` | `bulk_resolve` | Analyst / Admin | Bulk resolve all incidents | None $\rightarrow$ `{"status": "ok", "count": int}` | [app/routers/anomalies.py:122](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py#L122) |
| `GET` | `/api/v1/costs/summary` | `cost_summary` | Analyst / Admin | Grouped cost total (Redis cached) | Query `group_by=service|region|team` $\rightarrow$ `{"groups": [...]}` | [app/routers/costs.py:37](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/costs.py#L37) |
| `GET` | `/api/v1/costs/timeseries` | `cost_timeseries` | Analyst / Admin | Stacked area timeseries (cached) | Query `interval, group_by` $\rightarrow$ `{"timestamps", "series"}` | [app/routers/costs.py:168](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/costs.py#L168) |
| `GET` | `/api/v1/costs/resources/{id}/costs` | `resource_costs` | Analyst / Admin | Per-resource cost history & baseline | Query `hours=72` $\rightarrow$ `{"points": [{"cost", "mean", "std"}]}` | [app/routers/costs.py:118](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/costs.py#L118) |
| `GET` | `/api/v1/resources` | `list_resources` | Analyst / Admin | Paginated resources with metrics | Query filters $\rightarrow$ `[{"resource_id", "cost_24h", "status"}]` | [app/routers/resources.py:26](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L26) |
| `GET` | `/api/v1/resources/{id}` | `get_resource_detail` | Analyst / Admin | Resource detail & live status | None $\rightarrow$ `{"resource_id", "baseline_mean_now", "status"}` | [app/routers/resources.py:230](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L230) |
| `GET` | `/api/v1/resources/{id}/costs` | `get_resource_costs` | Analyst / Admin | Resource costs with $\pm 3\sigma$ band | Query `from, to` $\rightarrow$ `{"points": [{"expected_lower", "upper"}]}` | [app/routers/resources.py:291](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L291) |
| `GET` | `/api/v1/resources/{id}/baseline` | `get_resource_baseline` | Analyst / Admin | 24-hour diurnal baseline profile | None $\rightarrow$ `{"hours": [{"hour", "mean", "std", "samples"}]}` | [app/routers/resources.py:351](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py#L351) |
| `GET` | `/api/v1/stats/overview` | `get_stats_overview` | Analyst / Admin | Dashboard KPI summary | None $\rightarrow$ `{"cost_24h", "anomalies_open", "top_spenders"}` | [app/routers/stats.py:28](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/stats.py#L28) |
| `GET` | `/api/v1/jobs` | `list_jobs` | Analyst / Admin | Ingestion jobs overview | Query `status, limit` $\rightarrow$ `[{"id", "progress_pct", ...}]` | [app/routers/jobs.py:23](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/jobs.py#L23) |
| `GET` | `/api/v1/jobs/{id}` | `get_job_detail` | Analyst / Admin | Poll specific job progress | None $\rightarrow$ `{"id", "status", "processed_count"}` | [app/routers/jobs.py:80](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/jobs.py#L80) |
| `GET` | `/api/v1/audit-logs` | `get_audit_logs` | Admin | Query security audit trail | Query filters $\rightarrow$ `[{"actor", "action", "ip", "result"}]` | [app/routers/audit_logs.py:25](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/audit_logs.py#L25) |
| `GET` | `/api/v1/config/thresholds` | `get_thresholds` | Analyst / Admin | Read detection thresholds | None $\rightarrow$ `{"detection": {...}, "severity": {...}}` | [app/routers/config_router.py:26](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/config_router.py#L26) |
| `PUT` | `/api/v1/config/thresholds` | `update_thresholds` | Admin | Runtime threshold modification | `{"detection": {...}, "severity": {...}}` $\rightarrow$ New thresholds | [app/routers/config_router.py:43](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/config_router.py#L43) |
| `POST`| `/api/v1/admin/simulate` | `simulate` | Admin | Generate simulated history/spikes | `{"hours", "inject", "resource_id", "multiplier"}` $\rightarrow$ Job IDs | [app/routers/admin.py:41](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L41) |
| `POST`| `/api/v1/admin/deployments` | `create_deployment` | Admin | Record deploy / rollback event | `{"version", "color", "status", "note"}` $\rightarrow$ DeploymentOut | [app/routers/admin.py:139](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L139) |
| `GET` | `/api/v1/admin/deployments` | `list_deployments` | Analyst / Admin | List deployment history | Query `limit` $\rightarrow$ `[{"id", "version", "color", "status"}]` | [app/routers/admin.py:173](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L173) |
| `GET` | `/api/v1/admin/deployments/current` | `get_current_deployment`| Analyst / Admin | Active color, version, uptime | None $\rightarrow$ `{"version", "color", "status", "uptime_seconds"}` | [app/routers/admin.py:199](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L199) |
| `GET` | `/api/v1/admin/logs` | `get_logs` | Admin | Paginated JSON log tail | Query `level, event, q, limit` $\rightarrow$ `[LogRecords]` | [app/routers/admin.py:228](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L228) |
| `GET` | `/api/v1/admin/logs/stream` | `stream_logs` | Admin | Server-Sent Events real-time log | SSE text stream with 15s heartbeat $\rightarrow$ `data: {...}` | [app/routers/admin.py:309](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py#L309) |

---

## 11. Data Model Summary (13 Tables)

All tables use `TIMESTAMPTZ` for UTC timezone consistency ([app/models.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/models.py) and [alembic/versions/0001_initial.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/alembic/versions/0001_initial.py)):

1. **`users`**: Human operator accounts (`id`, `username`, `password_hash`, `role`, `is_active`, `created_at`).
2. **`api_clients`**: M2M service tokens (`id`, `name`, `api_key_hash` [SHA-256], `role="service"`, `is_active`, `created_at`).
3. **`resources`**: Cloud catalog entries (`id`, `resource_id` [UK], `type`, `service`, `region`, `team_tag`, `first_seen`).
4. **`ingestion_jobs`**: Batch lifecycle status (`id` [UUID], `submitted_by`, `record_count`, `processed_count`, `failed_count`, `status`, `backfill`, `created_at`, `finished_at`).
5. **`cost_records`**: Hourly time series (`id`, `resource_id`, `ts`, `usage_quantity`, `unit_cost`, `cost`, `job_id`, `created_at`). Enforces `UNIQUE(resource_id, ts)`.
6. **`baselines`**: Welford statistics (`resource_id`, `hour_of_day`, `n`, `mean`, `m2`, `updated_at`). Composite PK on `(resource_id, hour_of_day)`.
7. **`resource_state`**: Per-resource EWMA drift tracking (`resource_id` [PK], `ewma_ratio`, `last_ts`, `updated_at`).
8. **`anomalies`**: Detected incidents (`id`, `scope`, `resource_id`, `detected_at`, `record_ts`, `observed_cost`, `expected_cost`, `z_score`, `pct_increase`, `severity`, `method`, `root_cause_summary`, `root_cause` [JSONB], `status`, `occurrences`, `peak_cost`, `last_seen_ts`, `acknowledged_by`).
9. **`alerts`**: Outbound notification records (`id`, `anomaly_id`, `channel`, `sent_at`, `delivery_status`, `detail`).
10. **`audit_logs`**: Immutable security trail (`id`, `actor`, `action`, `entity`, `entity_id`, `ip`, `result`, `detail` [JSONB], `ts`).
11. **`settings`**: Runtime threshold storage (`key` [PK], `value` [JSONB], `updated_by`, `updated_at`).
12. **`deployments`**: Blue/Green releases and rollbacks (`id`, `version`, `color`, `status`, `deployed_at`, `activated_at`, `rolled_back_at`, `note`).
13. **`ground_truth_anomalies`**: Synthetic injections for F1 scoring (`id`, `resource_id`, `kind`, `start_ts`, `end_ts`, `multiplier`, `created_at`).

---

## 12. Environment Variables & Runtime Configuration

Defined in [app/config.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/config.py) and [.env.example](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/.env.example):

| Environment Variable | Default Value | Purpose | Impact on Behavior |
|---|---|---|---|
| `ENVIRONMENT` | `development` | Deployment tier | In `production`, default passwords and short secrets trigger startup errors. |
| `DATABASE_URL` | `postgresql+psycopg2://ccad:change_me_pg@postgres:5432/ccad` | SQLAlchemy database URI | Defines target PostgreSQL database connection pool. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis instance connection | Connects queue consumer, caches, and rate-limiting counters. |
| `JWT_SECRET` | `change_me_to_a_long_random_string` | HS256 JWT signature key | Cryptographic key for session validation. Fails fast in prod if default. |
| `JWT_EXPIRE_MINUTES` | `30` | Access token lifespan | Sets session cookie and JWT expiry timestamp. |
| `ADMIN_USERNAME` | `admin` | Bootstrap administrator | Username for seed administrator account. |
| `ADMIN_PASSWORD` | `Admin@12345` | Bootstrap admin password | Password for initial admin account. Fails fast in prod if default. |
| `ANALYST_USERNAME` | `analyst` | Bootstrap analyst | Username for read-only financial analyst account. |
| `ANALYST_PASSWORD` | `Analyst@12345` | Bootstrap analyst password | Password for initial analyst account. |
| `SERVICE_API_KEY` | `svc-ingest-key-change-me` | Ingestion API key | Pre-shared token for automated ingestion clients. |
| `APP_VERSION` | `1.0.0` | Semantic version | Exposed in health checks, Prometheus metric `app_version_info`, and UI. |
| `APP_COLOR` | `blue` | Active container color | Indicates blue vs. green instance in metrics and UI status indicators. |
| `FAULTY_RELEASE` | `false` | Canary fault injector | When `true`, injects 50% HTTP 500 errors to test automated rollback. |
| `LOG_LEVEL` | `INFO` | Logger verbosity | Sets threshold for Python standard library logger. |
| `LOG_FILE` | `/var/log/app/app.log` | Log destination | File tailed by the SSE `/logs/stream` endpoint. |
| `ALERT_WEBHOOK_URL` | `""` (empty) | Notification endpoint | If set, worker dispatches JSON incident payloads via HTTP POST. |
| `HTTP_PORT` | `8080` | External HTTP port | Plain HTTP entry point (redirects to HTTPS 8443). |
| `HTTPS_PORT` | `8443` | External HTTPS port | Secure TLS entry point for the CostGuard console. |

---

## 13. Unverified / Needs Human Confirmation Items

The following items represent operational assumptions or configuration choices that should be confirmed for specific deployment environments:

1. **Production SMTP Configuration (UNVERIFIED):**  
   While `app/models.py:221` defines `channel = Column(String(20))` with support for `email`, the active alert dispatcher in `app/worker/alerts.py` only implements `log` and `webhook` delivery. An SMTP mailer is not currently wired in code.
2. **Cluster Multi-Worker Concurrency Limit (UNVERIFIED):**  
   `docker-compose.yml` runs 1 worker replica by default. While Redis Streams consumer groups (`detectors`) natively support horizontal scaling, running $>5$ concurrent workers against a small PostgreSQL instance may require tuning `max_connections` and connection pool sizes in `app/db.py`.
3. **Cross-Site Cookie Gating over Plain HTTP (UNVERIFIED):**  
   `response.set_cookie()` in `app/routers/auth.py:92` sets `secure=request.url.scheme == "https"`. If testing behind a TLS-terminating load balancer that forwards plain HTTP without `X-Forwarded-Proto: https`, the `Secure` cookie flag will be omitted.

---

## 14. Source Index

This architecture documentation is derived directly from the following verified repository files:

### Application Core & Routers
- [app/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/main.py) — Application factory, middleware pipeline, fault injector
- [app/config.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/config.py) — Pydantic settings, environment variables, in-memory cache
- [app/security.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/security.py) — JWT, bcrypt hashing, API key verification, RBAC, audit logging
- [app/db.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/db.py) — SQLAlchemy session factory and engine
- [app/models.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/models.py) — 13 ORM database tables
- [app/schemas.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/schemas.py) — Pydantic request/response validation schemas
- [app/cache.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/cache.py) — Redis connection and key-value cache helpers
- [app/queue.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/queue.py) — Redis Streams producer, DLQ routing, consumer groups
- [app/metrics.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/metrics.py) — Prometheus metrics definitions
- [app/logging_setup.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/logging_setup.py) — JSON structured logging formatters
- [app/routers/health.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/health.py) — `/health/live`, `/health/ready`, `/metrics`
- [app/routers/auth.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/auth.py) — `/auth/login`, `/auth/verify`, `/auth/users`, `/auth/api-clients`
- [app/routers/records.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/records.py) — `/records/batch`, `/records/jobs/{job_id}`
- [app/routers/anomalies.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/anomalies.py) — `/anomalies`, `/anomalies/{id}`, bulk ack/resolve
- [app/routers/costs.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/costs.py) — `/costs/summary`, `/costs/timeseries`, resource history
- [app/routers/resources.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/resources.py) — `/resources`, resource detail, baseline band
- [app/routers/stats.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/stats.py) — `/stats/overview`
- [app/routers/jobs.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/jobs.py) — `/jobs`, job progress polling
- [app/routers/config_router.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/config_router.py) — `/config/thresholds`
- [app/routers/admin.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/admin.py) — `/admin/simulate`, `/admin/deployments`, `/admin/logs/stream`
- [app/routers/audit_logs.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/routers/audit_logs.py) — `/audit-logs`

### Detection & Worker Engine
- [app/detection/baseline.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/baseline.py) — Welford online algorithm
- [app/detection/rules.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/rules.py) — Rules A, B, C, D, variance floor, severity matrix
- [app/detection/root_cause.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/root_cause.py) — Aggregate anomaly checks, contribution ranking
- [app/detection/engine.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/detection/engine.py) — Detection orchestration, deduplication, baseline persistence
- [app/worker/main.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/main.py) — Redis Streams consumer group processing loop
- [app/worker/alerts.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/worker/alerts.py) — Outbound webhook alert dispatcher

### Simulator & Scripts
- [app/simulator/catalog.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/simulator/catalog.py) — 40-resource AWS catalog generator
- [app/simulator/generator.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/app/simulator/generator.py) — Diurnal and weekly cost generator, anomaly injection
- [scripts/simulate.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/simulate.py) — CLI client for seeding history, streaming traffic, injecting anomalies
- [scripts/deploy.sh](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/deploy.sh) — Zero-downtime blue/green deployment script with health gate and auto-rollback
- [scripts/rollback.sh](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/rollback.sh) — Instant Nginx upstream rollback
- [scripts/switch_color.sh](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/switch_color.sh) — Nginx upstream configuration flipper
- [scripts/failure_experiment.sh](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/failure_experiment.sh) — Chaos testing script measuring MTTR on worker/redis death
- [scripts/evaluate_detection.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/scripts/evaluate_detection.py) — Precision, recall, and F1 evaluation

### Frontend Console
- [frontend/src/router.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/router.tsx) — Browser router and lazy route registrations
- [frontend/src/pages/Overview.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Overview.tsx) — Main dashboard with KPIs and ECharts
- [frontend/src/pages/Costs.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Costs.tsx) — Cost explorer, grouped breakdowns, and treemap
- [frontend/src/pages/Anomalies.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Anomalies.tsx) — Anomaly triage table and status management
- [frontend/src/components/anomalies/AnomalyDrawer.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/components/anomalies/AnomalyDrawer.tsx) — Incident inspection drawer with BandChart
- [frontend/src/components/charts/BandChart.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/components/charts/BandChart.tsx) — Expected vs. observed $\pm 3\sigma$ confidence interval chart
- [frontend/src/pages/Monitoring/Hub.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Monitoring/Hub.tsx) — PromQL panel cards, Grafana kiosk, Prometheus console
- [frontend/src/pages/Deployments.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Deployments.tsx) — Blue/Green cluster status and release history
- [frontend/src/pages/Ingestion.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Ingestion.tsx) — Simulator studio, burst controls, and job monitor
- [frontend/src/pages/Logs/AppLogs.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Logs/AppLogs.tsx) — Virtualized SSE real-time log viewer
- [frontend/src/pages/Settings.tsx](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/frontend/src/pages/Settings.tsx) — Runtime threshold controls and user management

### Infrastructure & Deployment
- [docker-compose.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/docker-compose.yml) — 11-container deployment definition
- [nginx/nginx.conf](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/nginx/nginx.conf) — Reverse proxy, auth gate, TLS, upstream definitions
- [config/config.yaml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/config/config.yaml) — Default detection thresholds and queue settings
- [alembic/versions/0001_initial.py](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/alembic/versions/0001_initial.py) — Initial PostgreSQL schema migration
- [monitoring/prometheus.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/monitoring/prometheus.yml) — Prometheus scrape configurations
- [monitoring/alert_rules.yml](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/monitoring/alert_rules.yml) — 6 automated alert rules
- [monitoring/grafana/dashboards/ccad.json](file:///c:/Users/adity/Downloads/CCVT/Semester%207/CAD%20P75/application/monitoring/grafana/dashboards/ccad.json) — 14-panel Grafana dashboard
