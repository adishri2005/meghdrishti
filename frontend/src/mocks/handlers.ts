import { http, HttpResponse } from 'msw'
import {
  MOCK_ANOMALIES,
  MOCK_DEPLOYMENTS,
  MOCK_RESOURCES,
  MOCK_STATS_OVERVIEW,
  MOCK_SYSTEM_STATUS,
} from './fixtures'

// Generates plausible time-series points for Prometheus matrix query_range
function generatePrometheusMatrix(query: string, start: number, end: number, step: number) {
  const points: [number, string][] = []
  const count = Math.min(Math.floor((end - start) / step), 500)

  let baseVal = 25.0
  if (query.includes('latency')) baseVal = 0.085
  if (query.includes('queue_lag')) baseVal = 12.0
  if (query.includes('error')) baseVal = 0.002
  if (query.includes('cache_hit')) baseVal = 0.94

  for (let i = 0; i <= count; i++) {
    const ts = start + i * step
    // Sinusoidal with slight noise
    const noise = Math.sin(i / 8) * (baseVal * 0.2) + (Math.random() - 0.5) * (baseVal * 0.1)
    const val = Math.max(baseVal + noise, 0)
    points.push([ts, val.toFixed(4)])
  }

  return [
    {
      metric: { job: 'ccad-api', instance: 'localhost:8000' },
      values: points,
    },
  ]
}

export const handlers = [
  // --- Auth ---
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as any
    if (body.username === 'admin' && body.password === 'Admin@12345') {
      return HttpResponse.json({
        access_token: 'mock-jwt-admin-token',
        token_type: 'bearer',
        expires_in: 1800,
        role: 'admin',
      })
    }
    if (body.username === 'analyst' && body.password === 'Analyst@12345') {
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
    return HttpResponse.json({
      username: 'admin',
      role: 'admin',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })
  }),

  http.get('/api/v1/auth/verify', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/auth/logout', () => {
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
    const groupBy = url.searchParams.get('group_by') || 'none'
    const interval = url.searchParams.get('interval') || 'hour'

    const seriesNames =
      groupBy === 'team'
        ? ['ml', 'core', 'platform', 'data']
        : groupBy === 'service'
        ? ['compute', 'database', 'storage']
        : ['total']

    const now = Date.now()
    const series = seriesNames.map((name, sIdx) => {
      const points: [string, number][] = []
      for (let i = 24; i >= 0; i--) {
        const ts = new Date(now - i * 3600000).toISOString()
        const base = (sIdx + 1) * 35
        const cost = Math.round((base + Math.sin(i / 2) * 12 + Math.random() * 5) * 100) / 100
        points.push([ts, cost])
      }
      return { name, points }
    })

    return HttpResponse.json({ interval, series })
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

    let filtered = [...MOCK_ANOMALIES]
    if (severity) filtered = filtered.filter((a) => a.severity === severity)
    if (status) filtered = filtered.filter((a) => a.status === status)

    return HttpResponse.json(filtered, {
      headers: { 'X-Total-Count': String(filtered.length) },
    })
  }),

  http.get('/api/v1/anomalies/:id', ({ params }) => {
    const anom = MOCK_ANOMALIES.find((a) => String(a.id) === params.id) || MOCK_ANOMALIES[0]
    return HttpResponse.json(anom)
  }),

  http.patch('/api/v1/anomalies/:id', async ({ params, request }) => {
    const body = (await request.json()) as any
    const anom = MOCK_ANOMALIES.find((a) => String(a.id) === params.id) || MOCK_ANOMALIES[0]
    anom.status = body.status
    return HttpResponse.json(anom)
  }),

  http.get('/api/v1/anomalies/:id/timeline', ({ params }) => {
    const anom = MOCK_ANOMALIES.find((a) => String(a.id) === params.id) || MOCK_ANOMALIES[0]
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
  http.get('/api/v1/jobs', () => {
    return HttpResponse.json([
      {
        id: '9f2913b8-6a31-419b-b0b3-05ecfb1a783a',
        submitted_by: 'admin',
        record_count: 500,
        processed_count: 500,
        failed_count: 0,
        status: 'done',
        progress_pct: 100,
        duration_seconds: 3.4,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ])
  }),

  http.post('/api/v1/admin/simulate', () => {
    return HttpResponse.json({
      job_ids: ['sim-job-12345'],
      records_generated: 40,
      injection: { kind: 'spike', resource_id: 'eks-ml-storage-04', multiplier: 8.0 },
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
