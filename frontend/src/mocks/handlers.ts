import { http, HttpResponse } from 'msw'
import {
  getMockAnomalies,
  getMockCostTimeseries,
  getMockStatsOverview,
  updateMockAnomalyStatus,
  bulkUpdateMockAnomaliesStatus,
  injectMockAnomaly,
  getActiveMockJobs,
  addMockJob,
  MOCK_DEPLOYMENTS,
  MOCK_RESOURCES,
  MOCK_SYSTEM_STATUS,
} from './fixtures'

// Generates plausible time-series points for Prometheus matrix query_range with distinct behaviors per metric
function generatePrometheusMatrix(query: string, start: number, end: number, step: number) {
  const points: [number, string][] = []
  const count = Math.min(Math.floor((end - start) / step), 500)

  for (let i = 0; i <= count; i++) {
    const ts = start + i * step
    let val = 24.0

    const q = query.toLowerCase()

    if (q.includes('status=~"5.."') || q.includes('5..') || (q.includes('error') && !q.includes('node_cpu'))) {
      // 5xx Server Error Rate (clean 0.000 err/s with a subtle 0.04 bump during deployment rollout)
      const isRollout = i >= Math.floor(count * 0.12) && i <= Math.floor(count * 0.17)
      val = isRollout ? 0.04 : 0.000
    } else if (q.includes('queue_lag') || q.includes('backlog') || q.includes('dlq')) {
      // Redis Streams queue lag: 0 msgs normal, short 2 msg buffer during burst
      const isBurst = i >= Math.floor(count * 0.70) && i <= Math.floor(count * 0.72)
      val = isBurst ? 2 : 0
    } else if (q.includes('api_latency') || q.includes('latencyp95') || q.includes('latency')) {
      // API p95 Latency: Smooth 24ms - 30ms (0.024s - 0.030s)
      val = 0.025 + Math.sin(i / 14) * 0.003 + (Math.sin(i * 2.1) * 0.001)
    } else if (q.includes('detection_delay') || q.includes('detectionp95') || q.includes('detection')) {
      // Detection Delay: Steady 2.1s - 2.3s
      val = 2.18 + Math.sin(i / 16) * 0.06 + (Math.sin(i * 1.5) * 0.02)
    } else if (q.includes('records_ingested') || (q.includes('ingest') && !q.includes('processed'))) {
      // Ingestion throughput: ~24.5 rec/s
      val = 24.5 + Math.sin((i / count) * Math.PI * 2) * 1.5 + (Math.sin(i * 1.7) * 0.4)
    } else if (q.includes('records_processed') || q.includes('processed')) {
      // Analytics worker throughput: matches ingestion (~24.3 rec/s)
      val = 24.3 + Math.sin((i / count) * Math.PI * 2) * 1.5 + (Math.sin(i * 1.7) * 0.3)
    } else if (q.includes('node_cpu') || q.includes('cpupct') || q.includes('cpu')) {
      // Host CPU: 22% - 28%
      val = 24.5 + Math.sin((i / count) * Math.PI * 2) * 2.8 + (Math.sin(i * 1.2) * 0.5)
    } else if (q.includes('node_memory') || q.includes('mempct') || q.includes('memory') || q.includes('mem')) {
      // Host RAM: 62.4% - 63.8%
      val = 62.8 + Math.sin(i / 25) * 0.6
    } else if (q.includes('pg_stat') || q.includes('pgconnections') || q.includes('backends') || q.includes('connection')) {
      // Active database connections: 8-10
      val = 9 + (i % 24 === 0 ? 1 : 0)
    } else if (q.includes('anomalies_detected') || q.includes('anomaliesbysev') || q.includes('severity')) {
      // Hourly anomaly rate: 0 normally, 1 event detected at incident
      val = (i >= Math.floor(count * 0.74) && i <= Math.floor(count * 0.75)) ? 1 : 0
    } else if (q.includes('cache_hits_total') || q.includes('cachehitratio') || q.includes('cache_hit')) {
      // Cache hit ratio: 96.2% - 96.6%
      val = 0.964 + Math.sin(i / 18) * 0.002
    } else if (q.includes('api_requests_total') || q.includes('rps')) {
      // Request rate: Diurnal curve 28 - 40 req/s
      val = 33.0 + Math.sin((i / count) * Math.PI * 2 - 1.2) * 5.5 + (Math.sin(i * 1.4) * 0.6)
    } else {
      val = 24.0 + Math.sin((i / count) * Math.PI * 2) * 1.5
    }

    points.push([ts, Math.max(val, 0).toFixed(4)])
  }

  return [
    {
      metric: { job: 'meghdrishti-api', instance: 'localhost:8000' },
      values: points,
    },
  ]
}

function getMockUser(): { username: string; role: 'admin' | 'analyst' } | null {
  try {
    const raw = typeof window !== 'undefined'
      ? (localStorage.getItem('meghdrishti_mock_user') || localStorage.getItem('ccad_mock_user'))
      : null
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { username: 'admin', role: 'admin' }
}

function setMockUser(user: { username: string; role: 'admin' | 'analyst' } | null) {
  try {
    if (user && typeof window !== 'undefined') {
      localStorage.setItem('meghdrishti_mock_user', JSON.stringify(user))
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('meghdrishti_mock_user')
      localStorage.removeItem('ccad_mock_user')
    }
  } catch {
    // ignore
  }
}

const DEV_ADMIN_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM'

export const handlers = [
  // --- Auth ---
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as any
    if (body.username === 'admin' && (body.password === 'admin123' || body.password === 'Admin@12345')) {
      setMockUser({ username: 'admin', role: 'admin' })
      if (typeof document !== 'undefined') {
        document.cookie = `meghdrishti_token=${DEV_ADMIN_TOKEN}; path=/; max-age=86400; SameSite=Lax`
        document.cookie = `ccad_token=${DEV_ADMIN_TOKEN}; path=/; max-age=86400; SameSite=Lax`
      }
      return HttpResponse.json({
        access_token: DEV_ADMIN_TOKEN,
        token_type: 'bearer',
        expires_in: 1800,
        role: 'admin',
      })
    }
    if (body.username === 'analyst' && (body.password === 'analyst123' || body.password === 'Analyst@12345')) {
      setMockUser({ username: 'analyst', role: 'analyst' })
      if (typeof document !== 'undefined') {
        document.cookie = `meghdrishti_token=${DEV_ADMIN_TOKEN}; path=/; max-age=86400; SameSite=Lax`
        document.cookie = `ccad_token=${DEV_ADMIN_TOKEN}; path=/; max-age=86400; SameSite=Lax`
      }
      return HttpResponse.json({
        access_token: DEV_ADMIN_TOKEN,
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
    return HttpResponse.json(getMockStatsOverview())
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
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    let filtered = [...getMockAnomalies()]
    if (severity && severity !== 'all') filtered = filtered.filter((a) => a.severity === severity)
    if (status && status !== 'all') filtered = filtered.filter((a) => a.status === status)
    if (resourceId) filtered = filtered.filter((a) => a.resource_name.toLowerCase().includes(resourceId.toLowerCase()))

    const total = filtered.length
    if (limitParam) {
      const limit = parseInt(limitParam, 10)
      const offset = parseInt(offsetParam || '0', 10)
      filtered = filtered.slice(offset, offset + limit)
    }

    return HttpResponse.json({
      items: filtered,
      total,
    }, {
      headers: { 'X-Total-Count': String(total) },
    })
  }),

  http.post('/api/v1/anomalies/bulk-acknowledge', () => {
    const count = bulkUpdateMockAnomaliesStatus('acknowledged', 'open')
    return HttpResponse.json({ status: 'ok', count, message: `Acknowledged ${count} anomalies` })
  }),

  http.post('/api/v1/anomalies/bulk-resolve', () => {
    const count = bulkUpdateMockAnomaliesStatus('resolved')
    return HttpResponse.json({ status: 'ok', count, message: `Resolved ${count} anomalies` })
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
        logger: 'meghdrishti.worker',
        event: 'record_processed',
        message: 'Processed hourly cost record for eks-ml-storage-04',
        request_id: 'req-9871',
      },
      {
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'WARNING',
        logger: 'meghdrishti.detector',
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
        groups: [
          {
            name: 'meghdrishti_alerts',
            file: '/etc/prometheus/alert_rules.yml',
            rules: [
              {
                state: 'inactive',
                name: 'HighErrorRate',
                query: 'sum(rate(api_requests_total{status=~"5.."}[30s])) / sum(rate(api_requests_total[30s])) > 0.05',
                duration: 30,
                labels: { severity: 'critical' },
                annotations: {
                  summary: 'High 5xx error rate (> 5%)',
                  description: 'The API error rate has exceeded 5% for the last 30 seconds.',
                },
                type: 'alerting',
              },
              {
                state: 'inactive',
                name: 'HighLatencyP95',
                query: 'histogram_quantile(0.95, sum(rate(api_latency_seconds_bucket[1m])) by (le)) > 1.0',
                duration: 60,
                labels: { severity: 'warning' },
                annotations: {
                  summary: 'High API p95 latency (> 1s)',
                  description: 'The p95 API latency has exceeded 1 second for the last minute.',
                },
                type: 'alerting',
              },
              {
                state: 'inactive',
                name: 'QueueLagHigh',
                query: 'queue_lag > 500',
                duration: 20,
                labels: { severity: 'warning' },
                annotations: {
                  summary: 'Queue lag is high (> 500 messages)',
                  description: 'The cost_records stream has more than 500 pending messages.',
                },
                type: 'alerting',
              },
              {
                state: 'inactive',
                name: 'WorkerDown',
                query: 'up{job="worker"} == 0',
                duration: 10,
                labels: { severity: 'critical' },
                annotations: {
                  summary: 'Worker is down',
                  description: 'No worker instances are responding to health checks.',
                },
                type: 'alerting',
              },
              {
                state: 'inactive',
                name: 'DLQNotEmpty',
                query: 'dlq_length > 0',
                duration: 30,
                labels: { severity: 'warning' },
                annotations: {
                  summary: 'Dead-letter queue has messages',
                  description: 'Messages in the DLQ need investigation.',
                },
                type: 'alerting',
              },
              {
                state: 'inactive',
                name: 'NoRecordsProcessed',
                query: 'increase(records_ingested_total[1m]) > 0 and increase(records_processed_total[1m]) == 0',
                duration: 60,
                labels: { severity: 'critical' },
                annotations: {
                  summary: 'Records being ingested but none processed',
                  description: 'The worker may be stuck — records are being ingested but not processed.',
                },
                type: 'alerting',
              },
            ],
          },
        ],
      },
    })
  }),

  // --- Grafana API ---
  http.get('/grafana/api/search', () => {
    return HttpResponse.json([
      {
        id: 1,
        uid: 'meghdrishti-main',
        title: 'Meghdrishti Overview',
        url: '/grafana/d/meghdrishti-main/meghdrishti-overview',
        type: 'dash-db',
        tags: ['meghdrishti'],
      },
    ])
  }),
]
