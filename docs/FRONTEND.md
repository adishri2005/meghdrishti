# CostGuard Console Frontend Documentation

**CostGuard** is the enterprise-grade FinOps and Observability web console for the Cloud Cost Anomaly Detection System (Project P75). Built with React 18, TypeScript (strict mode), Tailwind CSS, shadcn/ui primitives, and Apache ECharts, it unifies cost anomaly exploration, root-cause diagnostics, pipeline simulation, live log streaming, blue/green deployment tracking, native Prometheus PromQL analytics, and embedded Grafana dashboards behind a single secure origin.

---

## 1. Architectural Overview

```
                      +---------------------------------------+
                      |               Browser                 |
                      |   CostGuard SPA (React 18 + Vite)     |
                      +-------------------+-------------------+
                                          |
                        HTTPS :8443 (Single Secure Origin)
                                          |
                      +-------------------v-------------------+
                      |         Nginx Reverse Gateway         |
                      |  - Cookie Auth Gate (auth_request)    |
                      |  - Blue/Green Upstream Routing        |
                      +---+---------------+---------------+---+
                          |               |               |
               /api/*     |    /grafana/* |  /prometheus/*|  /* (SPA)
                          v               v               v          v
                   +--------------+ +-----------+ +------------+ +----------+
                   |  FastAPI     | |  Grafana  | | Prometheus | | Frontend |
                   |  Active Node | |  :3000    | | :9090      | | Container|
                   |  (Blue/Green)| |  (Kiosk)  | | (PromQL)   | | (Nginx)  |
                   +--------------+ +-----------+ +------------+ +----------+
```

### Key Highlights
- **Single-Origin Gateway**: Eliminates cross-origin issues (CORS). Cookies, WebSockets, and iframes operate under the same secure domain (`https://localhost:8443/`).
- **Protected Telemetry**: Prometheus (`/prometheus/`) and Grafana (`/grafana/`) endpoints are guarded by Nginx's `auth_request /_auth_verify`, redirecting unauthorized requests and requiring role-based JWT validation (`admin` or `analyst`).
- **Dual Data Layer**: Direct PromQL time series metrics via `/prometheus/api/v1/query_range` combined with relational cost intelligence, baselines, and root causes via FastAPI REST endpoints.
- **Zero-Trust Role-Based Access Control**:
  - `admin`: Full visibility, log tailing, live audit trails, simulation injection, and threshold tuning.
  - `analyst`: Read-only access to cost, anomalies, resources, and telemetry; restricted from simulation, audit logs, raw application logs, and system configuration.

---

## 2. Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | React 18.3 + TypeScript 5.6 | Strict mode, zero `any`, Zod schema boundary validation |
| **Build Tool** | Vite 5.4 | Fast HMR, manual chunk splitting (`echarts`, `vendor`, `types`) |
| **Styling** | Tailwind CSS 3.4 + Radix UI | CSS variables, responsive design down to 360px |
| **Visualizations** | Apache ECharts 5 | Custom `costguard-dark` and `costguard-light` themes, LTTB downsampling |
| **State Management**| TanStack Query v5 + Zustand | Server cache with auto-refresh; client UI preferences persisted |
| **Tables & Lists** | TanStack Table v8 + TanStack Virtual | Virtualized application log table handling 10,000+ rows smoothly |
| **Testing** | Vitest, MSW 2, Playwright | 28 unit/component tests + 3 end-to-end integration flows |

---

## 3. Getting Started & Running Locally

### Development with Mock Mode (Instant Standalone UI)
The console includes a full-fidelity Mock Service Worker (MSW) engine with realistic cost curves, Welford baselines, 40 AWS resources, synthetic anomalies, and simulated Prometheus metrics:

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

### Full Stack Production Integration
To run CostGuard integrated with the entire Docker Compose stack:

```bash
# Build and launch all services (API, Worker, Postgres, Redis, Prometheus, Grafana, Nginx, Frontend)
make compose-up

# Or specifically rebuild the frontend container
make fe-build
```

Access the console at:
- **CostGuard Console**: `https://localhost:8443/`
- **Embedded Grafana Dashboard**: `https://localhost:8443/monitoring?tab=grafana`
- **Embedded Prometheus Console**: `https://localhost:8443/monitoring?tab=prometheus`

### Demo Credentials
- **Administrator**: Username `admin`, Password `admin123`
- **Financial Analyst**: Username `analyst`, Password `analyst123`

---

## 4. PromQL Named Query Reference

CostGuard draws native charts using standard Prometheus HTTP API requests (`/prometheus/api/v1/query_range`). The queries executed by the frontend include:

| Metric Name | PromQL Expression | Purpose |
|---|---|---|
| `rps` | `sum(rate(api_requests_total[1m]))` | Real-time API throughput |
| `errorRatio` | `sum(rate(api_requests_total{status=~"5.."}[1m])) / clamp_min(sum(rate(api_requests_total[1m])), 0.001)` | Fractional 5xx error rate |
| `latencyP95` | `histogram_quantile(0.95, sum by (le) (rate(api_latency_seconds_bucket[1m])))` | 95th-percentile API response latency |
| `ingestRate` | `sum(rate(records_ingested_total{source="api"}[1m]))` | Ingestion ingestion rate (records/s) |
| `processedRate`| `sum(rate(records_processed_total[1m]))` | Stream worker processing throughput |
| `queueLag` | `max(queue_lag)` | Unprocessed items in Redis Stream |
| `dlqLength` | `max(dlq_length)` | Dead-letter queue counter |
| `detectionP95`| `histogram_quantile(0.95, sum by (le) (rate(detection_delay_seconds_bucket[5m])))` | End-to-end anomaly detection delay |
| `anomaliesBySev` | `sum by (severity) (increase(anomalies_detected_total[1h]))` | Hourly anomaly distribution by severity |
| `cacheHitRatio`| `sum(rate(cache_hits_total[5m])) / clamp_min(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])), 0.001)` | Redis summary cache hit ratio |

---

## 5. How to Add a Page & Chart

### Adding a New Page
1. Create your component in `src/pages/<PageName>.tsx`.
2. Add the lazy route inside `src/router.tsx`:
   ```tsx
   const NewPage = React.lazy(() => import('@/pages/NewPage'))
   // Add route under RootLayout children:
   { path: 'new-page', element: <NewPage /> }
   ```
3. Add the navigation item to `src/components/layout/Sidebar.tsx` with appropriate role requirements (`requireAdmin` if restricted).
4. Register the hotkey or command in `src/components/layout/CommandPalette.tsx`.

### Adding a Native ECharts Chart
1. Import chart primitives from `@/components/charts`:
   ```tsx
   import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
   import { usePromRange } from '@/hooks/usePromRange'
   import { PROM_QUERIES } from '@/lib/prom/queries'
   import { matrixToSeries } from '@/lib/prom/transform'
   ```
2. Fetch Prometheus metrics via the reactive hook:
   ```tsx
   const { data, isLoading } = usePromRange(PROM_QUERIES.latencyP95)
   const series = React.useMemo(() => data ? matrixToSeries(data) : [], [data])
   ```
3. Render inside a responsive container:
   ```tsx
   <TimeSeriesChart series={series} unit="s" height={260} />
   ```

---

## 6. Testing Strategy

Run the test suites with Makefile commands:

```bash
# Unit & Component Tests (Vitest)
make fe-test

# Linter & Typechecks
make fe-lint

# End-to-End Test Suite (Playwright)
make fe-e2e

# Capture Full Documentation Screenshots
make fe-screenshots
```
