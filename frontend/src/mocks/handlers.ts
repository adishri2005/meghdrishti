import { http, HttpResponse } from 'msw'
import {
  getMockAnomalies,
  getMockCostTimeseries,
  updateMockAnomalyStatus,
  injectMockAnomaly,
  getActiveMockJobs,
  addMockJob,
  MOCK_DEPLOYMENTS,
  MOCK_RESOURCES,
  MOCK_STATS_OVERVIEW,
  MOCK_SYSTEM_STATUS,
} from './fixtures'

// Generates plausible time-series points for Prometheus matrix query_range with distinct behaviors per metric
function generatePrometheusMatrix(query: string, start: number, end: number, step: number) {
  const points: [number, string][] = []
  const count = Math.min(Math.floor((end - start) / step), 500)

  for (let i = 0; i <= count; i++) {
    const ts = start + i * step
    let val = 24.0

    if (query.includes('error') || query.includes('5..')) {
      // Near-zero error ratio (0.01% - 0.04%), with realistic micro-variations
      val = 0.0002 + Math.sin(i / 14) * 0.0001 + (i % 17 === 0 ? 0.0003 : 0)
    } else if (query.includes('queue_lag') || query.includes('backlog') || query.includes('dlq')) {
      // 0 msgs normal state with occasional small batch buffer
      val = i > count - 8 && i < count - 4 ? 8 : i % 22 === 0 ? 3 : 0
    } else if (query.includes('latency')) {
      // Stable p95 latency in seconds (0.022s - 0.038s = 22ms - 38ms)
      val = 0.026 + Math.sin(i / 11) * 0.005 + (i % 13) * 0.0004
    } else if (query.includes('detection') || query.includes('mttd')) {
      // Stable MTTD detection delay (1.8s - 2.8s)
      val = 2.1 + Math.sin(i / 7) * 0.35 + (i % 5) * 0.08
    } else if (query.includes('ingest') || query.includes('records_ingested')) {
      // Ingestion rate (22 - 28 rec/s with realistic jitter)
      val = 24.5 + Math.sin(i / 9) * 3.2 + (Math.sin(i * 3.7) * 0.8)
    } else if (query.includes('processed')) {
      // Processed rate tracking ingest
      val = 24.2 + Math.sin((i - 1) / 9) * 3.1 + (Math.sin(i * 3.7) * 0.7)
    } else if (query.includes('cpu')) {
      // Host CPU usage % (18% - 32%)
      val = 24.5 + Math.sin(i / 13) * 6.0 + (Math.sin(i * 2.1) * 2.5)
    } else if (query.includes('memory') || query.includes('mem')) {
      // Host RAM usage % (58% - 66%)
      val = 62.4 + Math.sin(i / 20) * 3.5 + (Math.sin(i * 1.5) * 0.8)
    } else if (query.includes('pg_stat') || query.includes('connections') || query.includes('numbackends')) {
      // PostgreSQL active backend connections (8 - 14)
      val = 11 + Math.floor(Math.sin(i / 8) * 2) + (i % 9 === 0 ? 1 : 0)
    } else if (query.includes('anomalies_detected') || query.includes('severity')) {
      // Anomaly detection frequency (0 - 4 events per hour)
      val = i % 18 === 0 ? 3 : i % 29 === 0 ? 1 : 0
    } else if (query.includes('http_requests') || query.includes('rps')) {
      // Web request rate (180 - 320 req/s)
      val = 240 + Math.sin(i / 6) * 45 + ((i % 7) * 4)
    } else if (query.includes('cache_hit')) {
      // Cache hit ratio (94% - 97%)
      val = 0.952 + Math.sin(i / 15) * 0.012
    } else {
      // Default metric
      val = 14.0 + Math.sin(i / 10) * 2.0
    }

    points.push([ts, Math.max(val, 0).toFixed(4)])
  }

  return [
    {
      metric: { job: 'ccad-api', instance: 'localhost:8000' },
      values: points,
    },
  ]
}

function getMockUser(): { username: string; role: 'admin' | 'analyst' } | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ccad_mock_user') : null
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { username: 'admin', role: 'admin' }
}

function setMockUser(user: { username: string; role: 'admin' | 'analyst' } | null) {
  try {
    if (user && typeof window !== 'undefined') {
      localStorage.setItem('ccad_mock_user', JSON.stringify(user))
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('ccad_mock_user')
    }
  } catch {
    // ignore
  }
}

export const handlers = [
  // --- Auth ---
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as any
    if (body.username === 'admin' && (body.password === 'admin123' || body.password === 'Admin@12345')) {
      setMockUser({ username: 'admin', role: 'admin' })
      return HttpResponse.json({
        access_token: 'mock-jwt-admin-token',
        token_type: 'bearer',
        expires_in: 1800,
        role: 'admin',
      })
    }
    if (body.username === 'analyst' && (body.password === 'analyst123' || body.password === 'Analyst@12345')) {
      setMockUser({ username: 'analyst', role: 'analyst' })
      return HttpResponse.json({
        access_token: 'mock-jwt-analyst-token',
        token_type: 'bearer',
        expires_in: 1800,
        role: 'analyst',
      })
    }
    return HttpResponse.json({ detail: 'Invalid username or password' }, { status: 401 })
  }),

  http.get('/api/v1/auth/me', () => {
    const user = getMockUser()
    if (!user) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return HttpResponse.json({
      username: user.username,
      role: user.role,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })
  }),

  http.get('/api/v1/auth/verify', () => {
    const user = getMockUser()
    if (!user) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/auth/logout', () => {
    setMockUser(null)
    return HttpResponse.json({ status: 'ok', message: 'Logged out' })
  }),

  http.get('/api/v1/auth/users', () => {
    return HttpResponse.json([
      { id: 1, username: 'admin', role: 'admin', is_active: true, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, username: 'analyst', role: 'analyst', is_active: true, created_at: '2026-01-01T00:00:00Z' },
    ])
  }),

  http.get('/api/v1/auth/api-clients', () => {
    return HttpResponse.json([
      { id: 1, name: 'ingest-worker', role: 'service', is_active: true, created_at: '2026-01-01T00:00:00Z' },
    ])
  }),

  // --- Stats and System ---
  http.get('/api/v1/stats/overview', () => {
    return HttpResponse.json(MOCK_STATS_OVERVIEW)
  }),

  http.get('/api/v1/system/status', () => {
    return HttpResponse.json(MOCK_SYSTEM_STATUS)
  }),

  // --- Costs ---
  http.get('/api/v1/costs/timeseries', ({ request }) => {
    const url = new URL(request.url)
    const groupBy = url.searchParams.get('group_by') || 'team'
    return HttpResponse.json(getMockCostTimeseries(undefined, groupBy))
  }),

  http.get('/api/v1/costs/heatmap', () => {
    const resList = MOCK_RESOURCES.slice(0, 10).map((r) => r.resource_id)
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const values: [number, number, number][] = []

    resList.forEach((_, rIdx) => {
      hours.forEach((h) => {
        const cost = Math.round((15 + Math.sin(h / 3) * 10 + (rIdx * 7) % 25) * 10) / 10
        values.push([h, rIdx, cost])
      })
    })

    return HttpResponse.json({ resources: resList, hours, values })
  }),

  // --- Resources ---
  http.get('/api/v1/resources', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const team = url.searchParams.get('team')

    let filtered = [...MOCK_RESOURCES]
    if (search) {
      filtered = filtered.filter((r) => r.resource_id.toLowerCase().includes(search.toLowerCase()))
    }
    if (team) {
      filtered = filtered.filter((r) => r.team === team)
    }

    return HttpResponse.json(filtered, {
      headers: { 'X-Total-Count': String(filtered.length) },
    })
  }),

  http.get('/api/v1/resources/:id', ({ params }) => {
    const res =
      MOCK_RESOURCES.find((r) => r.resource_id === params.id || String(r.id) === params.id) ||
      MOCK_RESOURCES[0]
    return HttpResponse.json(res)
  }),

  http.get('/api/v1/resources/:id/costs', ({ params }) => {
    const now = Date.now()
    const points = Array.from({ length: 24 }).map((_, i) => {
      const ts = new Date(now - (24 - i) * 3600000).toISOString()
      const mean = 35.0
      const std = 4.2
      const isSpike = i === 20 && String(params.id).includes('eks')
      const cost = isSpike ? 240.0 : mean + (Math.random() - 0.5) * 8
      return {
        ts,
        cost: Math.round(cost * 100) / 100,
        expected_mean: mean,
        expected_lower: Math.max(mean - 3 * std, 0),
        expected_upper: mean + 3 * std,
      }
    })

    return HttpResponse.json({
      resource_id: params.id,
      points,
    })
  }),

  http.get('/api/v1/resources/:id/baseline', ({ params }) => {
    const hours = Array.from({ length: 24 }).map((_, h) => {
      const mean = 25 + Math.sin(h / 3) * 8
      const std = 3.5
      return {
        hour: h,
        mean: Math.round(mean * 100) / 100,
        std: Math.round(std * 100) / 100,
        samples: 72,
        min_band: Math.round(Math.max(mean - 3 * std, 0) * 100) / 100,
        max_band: Math.round((mean + 3 * std) * 100) / 100,
      }
    })
    return HttpResponse.json({ resource_id: params.id, hours })
  }),

  // --- Anomalies ---
  http.get('/api/v1/anomalies', ({ request }) => {
    const url = new URL(request.url)
    const severity = url.searchParams.get('severity')
    const status = url.searchParams.get('status')
    const resourceId = url.searchParams.get('resource_id')

    let filtered = [...getMockAnomalies()]
    if (severity && severity !== 'all') filtered = filtered.filter((a) => a.severity === severity)
    if (status && status !== 'all') filtered = filtered.filter((a) => a.status === status)
    if (resourceId) filtered = filtered.filter((a) => a.resource_name.toLowerCase().includes(resourceId.toLowerCase()))

    return HttpResponse.json({
      items: filtered,
      total: filtered.length,
    }, {
      headers: { 'X-Total-Count': String(filtered.length) },
    })
  }),

  http.get('/api/v1/anomalies/:id', ({ params }) => {
    const list = getMockAnomalies()
    const anom = list.find((a) => String(a.id) === params.id) || list[0]
    return HttpResponse.json(anom)
  }),

  http.patch('/api/v1/anomalies/:id', async ({ params, request }) => {
    const body = (await request.json()) as any
    const updated = updateMockAnomalyStatus(params.id as string, body.status)
    const list = getMockAnomalies()
    const anom = updated || list.find((a) => String(a.id) === params.id) || list[0]
    return HttpResponse.json(anom)
  }),

  http.get('/api/v1/anomalies/:id/timeline', ({ params }) => {
    const list = getMockAnomalies()
    const anom = list.find((a) => String(a.id) === params.id) || list[0]
    const now = Date.now()
    const points = Array.from({ length: 30 }).map((_, i) => {
      const ts = new Date(now - (24 - i) * 3600000).toISOString()
      const isTarget = i === 24
      const mean = anom.expected_cost
      const cost = isTarget ? anom.observed_cost : mean + (Math.random() - 0.5) * 6
      return {
        ts,
        cost: Math.round(cost * 100) / 100,
        expected_mean: Math.round(mean * 100) / 100,
        expected_lower: Math.round(Math.max(mean * 0.7, 0) * 100) / 100,
        expected_upper: Math.round(mean * 1.3 * 100) / 100,
      }
    })

    return HttpResponse.json({
      anomaly_id: anom.id,
      resource_id: anom.resource_name,
      scope: anom.scope,
      detected_at: anom.detected_at,
      record_ts: anom.record_ts,
      observed_cost: anom.observed_cost,
      expected_cost: anom.expected_cost,
      severity: anom.severity,
      points,
      markers: [
        {
          ts: anom.record_ts,
          cost: anom.observed_cost,
          severity: anom.severity,
          is_target: true,
        },
      ],
    })
  }),

  // --- Ingestion Jobs ---
  http.get('/api/v1/jobs', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    let jobs = [...getActiveMockJobs()]
    if (status && status !== 'all') {
      jobs = jobs.filter((j) => j.status === status)
    }
    return HttpResponse.json({
      items: jobs,
      total: jobs.length,
    })
  }),

  http.post('/api/v1/admin/simulate', async ({ request }) => {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // ignore
    }
    const scenario = body.inject || body.scenario || 'spike'
    const resource = body.resource_id || 'ec2-ml-gpu-07'
    const mult = Number(body.multiplier) || 12.0
    const recCount = scenario === 'seed_history' ? 13440 : 40 * (Number(body.hours) || 1)

    const job = addMockJob({
      job_type: `simulate_${scenario}`,
      total_records: recCount,
      processed_records: recCount,
      duration_ms: scenario === 'seed_history' ? 14200 : 2600,
      message: scenario === 'seed_history'
        ? 'Seeded 14 days of multi-cloud hourly baseline billing telemetry'
        : `Simulated ${mult}x spend surge injected on ${resource} (anomaly detected in 2.4s)`,
    })

    if (scenario === 'spike' || scenario === 'drift' || scenario === 'new_resource') {
      injectMockAnomaly({
        resource_name: resource,
        observed_cost: Math.round(35 * mult * 10) / 10,
        expected_cost: 35.0,
        severity: mult >= 5 ? 'critical' : mult >= 2 ? 'high' : 'medium',
        root_cause_summary: `Live pipeline anomaly detected on ${resource} (${mult}x baseline)`,
      })
    }

    return HttpResponse.json({
      job_id: job.id,
      job_ids: [job.id],
      message: `Simulation scenario '${scenario}' initiated successfully`,
      records_generated: job.total_records,
      injection: { kind: scenario, resource_id: resource, multiplier: mult },
    })
  }),

  // --- Deployments ---
  http.get('/api/v1/admin/deployments', () => {
    return HttpResponse.json(MOCK_DEPLOYMENTS)
  }),

  http.get('/api/v1/admin/deployments/current', () => {
    return HttpResponse.json({
      version: '1.0.0',
      color: 'blue',
      status: 'active',
      uptime_seconds: 48200,
    })
  }),

  // --- Logs & Audit ---
  http.get('/api/v1/admin/logs', () => {
    return HttpResponse.json([
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        logger: 'ccad.worker',
        event: 'record_processed',
        message: 'Processed hourly cost record for eks-ml-storage-04',
        request_id: 'req-9871',
      },
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'WARNING',
        logger: 'ccad.detector',
        event: 'anomaly_detected',
        message: 'Anomaly detected for eks-ml-storage-04: z_score=6.8',
        request_id: 'req-9870',
      },
    ])
  }),

  http.get('/api/v1/audit-logs', () => {
    return HttpResponse.json([
      {
        id: 1,
        actor: 'admin',
        action: 'simulate',
        result: 'success',
        detail: { inject: 'spike', resource: 'eks-ml-storage-04' },
        ts: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        id: 2,
        actor: 'analyst',
        action: 'anomaly_status_changed',
        result: 'success',
        detail: { old_status: 'open', new_status: 'acknowledged' },
        ts: new Date(Date.now() - 10 * 60000).toISOString(),
      },
    ])
  }),

  // --- Prometheus HTTP API ---
  http.get('/prometheus/api/v1/query_range', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query') || ''
    const start = parseFloat(url.searchParams.get('start') || String(Date.now() / 1000 - 3600))
    const end = parseFloat(url.searchParams.get('end') || String(Date.now() / 1000))
    const step = parseFloat(url.searchParams.get('step') || '15')

    return HttpResponse.json({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: generatePrometheusMatrix(query, start, end, step),
      },
    })
  }),

  http.get('/prometheus/api/v1/query', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query') || ''
    let val = '24.5'
    if (query.includes('queue_lag')) val = '0'
    if (query.includes('latency')) val = '0.042'
    if (query.includes('dlq')) val = '0'

    return HttpResponse.json({
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          {
            metric: {},
            value: [Date.now() / 1000, val],
          },
        ],
      },
    })
  }),

  http.get('/prometheus/api/v1/targets', () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        activeTargets: [
          {
            discoveredLabels: {},
            labels: { job: 'api-blue', instance: 'api-blue:8000' },
            scrapePool: 'api',
            scrapeUrl: 'http://api-blue:8000/metrics',
            health: 'up',
            lastScrape: new Date().toISOString(),
            lastScrapeDuration: 0.005,
          },
          {
            discoveredLabels: {},
            labels: { job: 'worker', instance: 'worker:8001' },
            scrapePool: 'worker',
            scrapeUrl: 'http://worker:8001/metrics',
            health: 'up',
            lastScrape: new Date().toISOString(),
            lastScrapeDuration: 0.004,
          },
        ],
      },
    })
  }),

  http.get('/prometheus/api/v1/alerts', () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        alerts: [],
      },
    })
  }),

  http.get('/prometheus/api/v1/rules', () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        groups: [],
      },
    })
  }),

  // --- Grafana API ---
  http.get('/grafana/api/search', () => {
    return HttpResponse.json([
      {
        id: 1,
        uid: 'ccad-main',
        title: 'CostGuard Overview',
        url: '/grafana/d/ccad-main/costguard-overview',
        type: 'dash-db',
        tags: ['ccad', 'costguard'],
      },
    ])
  }),
]
