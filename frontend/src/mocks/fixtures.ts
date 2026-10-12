export interface MockResource {
  id: number
  resource_id: string
  type: string
  service: string
  region: string
  team: string
  first_seen: string
  last_cost: number
  baseline_mean_now: number
  cost_24h: number
  open_anomalies: number
  status: 'normal' | 'warning' | 'anomalous'
}

export interface MockAnomaly {
  id: number
  scope: string
  resource_id: number | null
  resource_name: string
  detected_at: string
  record_ts: string
  observed_cost: number
  expected_cost: number
  z_score: number
  pct_increase: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  method: string
  root_cause_summary: string
  root_cause?: {
    breakdown_by_team?: Record<string, number>
    breakdown_by_service?: Record<string, number>
    breakdown_by_region?: Record<string, number>
    top_contributors?: Array<{
      resource_id: string
      share_pct: number
      delta_cost: number
      observed_cost: number
    }>
  }
  status: 'open' | 'acknowledged' | 'resolved'
  occurrences: number
  peak_cost: number
  last_seen_ts: string
}

const teams = ['ml', 'core', 'data', 'platform', 'frontend', 'security']
const services = ['compute', 'database', 'storage', 'networking', 'analytics']
const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
const types = ['ec2', 'rds', 's3', 'eks', 'lambda', 'elasticache']

export const MOCK_RESOURCES: MockResource[] = Array.from({ length: 40 }).map((_, i) => {
  const team = teams[i % teams.length]
  const service = services[i % services.length]
  const region = regions[i % regions.length]
  const type = types[i % types.length]
  const isAnom = i === 3 || i === 7 || i === 15
  const isWarn = i === 12 || i === 22
  const baseCost = Math.round((20 + (i * 7) % 80) * 100) / 100
  const lastCost = isAnom ? baseCost * 4.5 : isWarn ? baseCost * 1.8 : baseCost

  return {
    id: i + 1,
    resource_id: `${type}-${team}-${service}-${String(i + 1).padStart(2, '0')}`,
    type,
    service,
    region,
    team,
    first_seen: new Date(Date.now() - 30 * 86400000).toISOString(),
    last_cost: lastCost,
    baseline_mean_now: baseCost,
    cost_24h: Math.round(lastCost * 24 * 100) / 100,
    open_anomalies: isAnom ? (i === 3 ? 2 : 1) : 0,
    status: isAnom ? 'anomalous' : isWarn ? 'warning' : 'normal',
  }
})

let _activeMockAnomalies: MockAnomaly[] | null = null

function initializeMockAnomalies(baseTime?: number): MockAnomaly[] {
  const now = baseTime ?? Math.floor(Date.now() / 60000) * 60000
  return [
    {
      id: 101,
      scope: 'resource',
      resource_id: 4,
      resource_name: 'eks-ml-storage-04',
      detected_at: new Date(now - 2 * 3600000 + 180000).toISOString(),
      record_ts: new Date(now - 2 * 3600000).toISOString(),
      observed_cost: 324.5,
      expected_cost: 42.1,
      z_score: 6.8,
      pct_increase: 670.8,
      severity: 'critical',
      method: 'z_score',
      root_cause_summary: 'Sudden 671% cost spike detected on GPU training node cluster eks-ml-storage-04',
      root_cause: {
        breakdown_by_team: { ml: 82, core: 11, data: 7 },
        breakdown_by_service: { compute: 75, storage: 20, database: 5 },
        breakdown_by_region: { 'us-east-1': 90, 'eu-west-1': 10 },
        top_contributors: [
          { resource_id: 'eks-ml-storage-04', share_pct: 68, delta_cost: 282.4, observed_cost: 324.5 },
          { resource_id: 'ec2-ml-compute-07', share_pct: 18, delta_cost: 65.2, observed_cost: 88.0 },
          { resource_id: 's3-data-storage-03', share_pct: 8, delta_cost: 22.0, observed_cost: 34.1 },
        ],
      },
      status: 'open',
      occurrences: 2,
      peak_cost: 345.0,
      last_seen_ts: new Date(now - 2 * 3600000 + 300000).toISOString(),
    },
    {
      id: 102,
      scope: 'resource',
      resource_id: 8,
      resource_name: 'rds-core-database-08',
      detected_at: new Date(now - 3 * 3600000 + 120000).toISOString(),
      record_ts: new Date(now - 3 * 3600000).toISOString(),
      observed_cost: 189.2,
      expected_cost: 64.0,
      z_score: 4.2,
      pct_increase: 195.6,
      severity: 'high',
      method: 'pct_jump',
      root_cause_summary: 'Sustained throughput jump and IOPS autoscaling on rds-core-database-08',
      root_cause: {
        breakdown_by_team: { core: 70, platform: 25, data: 5 },
        breakdown_by_service: { database: 85, storage: 15 },
        breakdown_by_region: { 'eu-west-1': 100 },
        top_contributors: [
          { resource_id: 'rds-core-database-08', share_pct: 74, delta_cost: 125.2, observed_cost: 189.2 },
          { resource_id: 'ec2-core-compute-02', share_pct: 19, delta_cost: 32.0, observed_cost: 58.4 },
        ],
      },
      status: 'open',
      occurrences: 3,
      peak_cost: 195.0,
      last_seen_ts: new Date(now - 10 * 60000).toISOString(),
    },
    {
      id: 103,
      scope: 'resource',
      resource_id: 7,
      resource_name: 'ec2-ml-compute-07',
      detected_at: new Date(now - 75 * 60000).toISOString(),
      record_ts: new Date(now - 80 * 60000).toISOString(),
      observed_cost: 295.4,
      expected_cost: 38.0,
      z_score: 5.9,
      pct_increase: 677.4,
      severity: 'critical',
      method: 'z_score',
      root_cause_summary: 'Unscheduled multi-GPU compute distributed training job run on ec2-ml-compute-07',
      root_cause: {
        breakdown_by_team: { ml: 92, core: 5, data: 3 },
        breakdown_by_service: { compute: 95, storage: 5 },
        breakdown_by_region: { 'us-east-1': 100 },
        top_contributors: [
          { resource_id: 'ec2-ml-compute-07', share_pct: 88, delta_cost: 257.4, observed_cost: 295.4 },
        ],
      },
      status: 'open',
      occurrences: 2,
      peak_cost: 310.0,
      last_seen_ts: new Date(now - 15 * 60000).toISOString(),
    },
    {
      id: 104,
      scope: 'resource',
      resource_id: 16,
      resource_name: 'lambda-platform-networking-16',
      detected_at: new Date(now - 90 * 60000).toISOString(),
      record_ts: new Date(now - 95 * 60000).toISOString(),
      observed_cost: 142.8,
      expected_cost: 45.0,
      z_score: 3.8,
      pct_increase: 217.3,
      severity: 'medium',
      method: 'ewma_drift',
      root_cause_summary: 'Heavy serverless cross-region egress networking burst on lambda-platform-networking-16',
      root_cause: {
        breakdown_by_team: { platform: 75, core: 15, data: 10 },
        breakdown_by_service: { networking: 80, compute: 20 },
        breakdown_by_region: { 'ap-southeast-1': 85, 'us-east-1': 15 },
        top_contributors: [
          { resource_id: 'lambda-platform-networking-16', share_pct: 78, delta_cost: 97.8, observed_cost: 142.8 },
        ],
      },
      status: 'open',
      occurrences: 1,
      peak_cost: 142.8,
      last_seen_ts: new Date(now - 30 * 60000).toISOString(),
    },
    {
      id: 105,
      scope: 'resource',
      resource_id: 3,
      resource_name: 's3-data-storage-03',
      detected_at: new Date(now - 110 * 60000).toISOString(),
      record_ts: new Date(now - 120 * 60000).toISOString(),
      observed_cost: 168.0,
      expected_cost: 52.0,
      z_score: 4.4,
      pct_increase: 223.1,
      severity: 'high',
      method: 'pct_jump',
      root_cause_summary: 'Uncompressed parquet analytic dataset duplication on s3-data-storage-03',
      root_cause: {
        breakdown_by_team: { data: 85, ml: 10, core: 5 },
        breakdown_by_service: { storage: 95, analytics: 5 },
        breakdown_by_region: { 'us-west-2': 100 },
        top_contributors: [
          { resource_id: 's3-data-storage-03', share_pct: 85, delta_cost: 116.0, observed_cost: 168.0 },
        ],
      },
      status: 'open',
      occurrences: 1,
      peak_cost: 168.0,
      last_seen_ts: new Date(now - 45 * 60000).toISOString(),
    },
    {
      id: 106,
      scope: 'aggregate',
      resource_id: null,
      resource_name: 'aggregate (platform)',
      detected_at: new Date(now - 140 * 60000).toISOString(),
      record_ts: new Date(now - 150 * 60000).toISOString(),
      observed_cost: 612.0,
      expected_cost: 410.0,
      z_score: 3.1,
      pct_increase: 49.3,
      severity: 'medium',
      method: 'ewma_drift',
      root_cause_summary: 'Multi-resource EWMA cost baseline drift across platform networking resources',
      root_cause: {
        breakdown_by_team: { platform: 60, data: 25, core: 15 },
        breakdown_by_service: { networking: 70, compute: 30 },
        breakdown_by_region: { 'ap-southeast-1': 80, 'us-east-1': 20 },
        top_contributors: [
          { resource_id: 'lambda-platform-networking-16', share_pct: 42, delta_cost: 84.8, observed_cost: 122.0 },
          { resource_id: 'elasticache-platform-database-11', share_pct: 31, delta_cost: 62.6, observed_cost: 95.0 },
        ],
      },
      status: 'acknowledged',
      occurrences: 1,
      peak_cost: 612.0,
      last_seen_ts: new Date(now - 60 * 60000).toISOString(),
    },
    {
      id: 107,
      scope: 'resource',
      resource_id: 11,
      resource_name: 'elasticache-platform-database-11',
      detected_at: new Date(now - 210 * 60000).toISOString(),
      record_ts: new Date(now - 220 * 60000).toISOString(),
      observed_cost: 95.0,
      expected_cost: 62.0,
      z_score: 2.1,
      pct_increase: 53.2,
      severity: 'low',
      method: 'ewma_drift',
      root_cause_summary: 'Redis cache cluster memory scaling threshold reached on elasticache-platform-database-11',
      status: 'acknowledged',
      occurrences: 1,
      peak_cost: 95.0,
      last_seen_ts: new Date(now - 90 * 60000).toISOString(),
    },
    {
      id: 108,
      scope: 'resource',
      resource_id: 16,
      resource_name: 's3-security-storage-16',
      detected_at: new Date(now - 360 * 60000).toISOString(),
      record_ts: new Date(now - 370 * 60000).toISOString(),
      observed_cost: 45.0,
      expected_cost: 18.2,
      z_score: 2.2,
      pct_increase: 147.3,
      severity: 'low',
      method: 'new_resource',
      root_cause_summary: 'New S3 audit bucket first seen with heavy initial export ingestion',
      status: 'resolved',
      occurrences: 1,
      peak_cost: 45.0,
      last_seen_ts: new Date(now - 240 * 60000).toISOString(),
    },
  ]
}

export function getMockAnomalies(baseTime?: number): MockAnomaly[] {
  if (!_activeMockAnomalies) {
    _activeMockAnomalies = initializeMockAnomalies(baseTime)
  }
  return _activeMockAnomalies
}

export function injectMockAnomaly(anomaly: Partial<MockAnomaly>): MockAnomaly {
  const list = getMockAnomalies()
  const maxId = list.reduce((max, a) => Math.max(max, Number(a.id) || 100), 100)
  const newId = maxId + 1
  const targetName = anomaly.resource_name || 'ec2-ml-gpu-07'
  const created: MockAnomaly = {
    id: newId,
    scope: 'resource',
    resource_id: 4,
    resource_name: targetName,
    detected_at: new Date().toISOString(),
    record_ts: new Date().toISOString(),
    observed_cost: anomaly.observed_cost ?? 345.0,
    expected_cost: anomaly.expected_cost ?? 32.5,
    z_score: anomaly.z_score ?? 6.2,
    pct_increase: anomaly.pct_increase ?? 961.5,
    severity: (anomaly.severity as any) || 'critical',
    method: 'z_score',
    root_cause_summary: anomaly.root_cause_summary || `Sudden spend surge injected on ${targetName}`,
    root_cause: {
      breakdown_by_team: { ml: 85, core: 10, data: 5 },
      breakdown_by_service: { compute: 90, storage: 10 },
      breakdown_by_region: { 'us-east-1': 100 },
      top_contributors: [
        { resource_id: targetName, share_pct: 88, delta_cost: 312.5, observed_cost: 345.0 }
      ]
    },
    status: 'open',
    occurrences: 1,
    peak_cost: anomaly.observed_cost ?? 345.0,
    last_seen_ts: new Date().toISOString(),
    ...anomaly,
  }
  list.unshift(created)

  // Also reflect anomaly on matching resource in MOCK_RESOURCES
  const matchedRes = MOCK_RESOURCES.find(
    (r) => r.resource_id.toLowerCase() === targetName.toLowerCase() || targetName.toLowerCase().includes(r.resource_id.toLowerCase())
  )
  if (matchedRes) {
    matchedRes.open_anomalies += 1
    matchedRes.status = 'anomalous'
    matchedRes.last_cost = created.observed_cost
    matchedRes.cost_24h = Math.round((matchedRes.cost_24h + (created.observed_cost - created.expected_cost)) * 100) / 100
  }

  return created
}

export function updateMockAnomalyStatus(id: number | string, status: 'open' | 'acknowledged' | 'resolved'): MockAnomaly | undefined {
  const list = getMockAnomalies()
  const match = list.find((a) => String(a.id) === String(id))
  if (match) {
    match.status = status
  }
  return match
}

export const MOCK_ANOMALIES = getMockAnomalies()

export function getMockStatsOverview() {
  const anomalies = getMockAnomalies()
  const openAnomalies = anomalies.filter((a) => a.status === 'open')
  const criticalCount = openAnomalies.filter((a) => a.severity === 'critical').length
  const highCount = openAnomalies.filter((a) => a.severity === 'high').length
  const mediumCount = openAnomalies.filter((a) => a.severity === 'medium').length
  const lowCount = openAnomalies.filter((a) => a.severity === 'low').length

  const costData = getMockCostTimeseries()
  const cost24h = Math.round(
    costData.series.reduce((sum, s) => sum + s.points.reduce((pSum, p) => pSum + p[1], 0), 0) * 10
  ) / 10
  const costPrev24h = Math.round((cost24h / 1.127) * 10) / 10
  const costChangePct = Math.round(((cost24h - costPrev24h) / costPrev24h) * 1000) / 10

  const sortedResources = [...MOCK_RESOURCES].sort((a, b) => b.cost_24h - a.cost_24h)
  const totalResourceCost = sortedResources.reduce((acc, r) => acc + r.cost_24h, 0) || 1
  const topSpenders = sortedResources.slice(0, 8).map((r) => ({
    resource_id: r.resource_id,
    team: r.team,
    cost: r.cost_24h,
    share_pct: Math.round((r.cost_24h / totalResourceCost) * 1000) / 10,
  }))

  return {
    generated_at: new Date().toISOString(),
    cost_24h: cost24h,
    cost_prev_24h: costPrev24h,
    cost_change_pct: costChangePct,
    records_24h: 960,
    active_resources: MOCK_RESOURCES.length,
    anomalies_open: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      total: openAnomalies.length,
    },
    anomalies_24h: anomalies.filter(
      (a) => Date.now() - new Date(a.detected_at).getTime() <= 86400000
    ).length,
    mttd_seconds_p95: 3.8,
    top_spenders: topSpenders,
    latest_anomaly: openAnomalies[0] || anomalies[0] || null,
  }
}

export const MOCK_STATS_OVERVIEW = new Proxy(
  {},
  {
    get(_target, prop) {
      const dynamicStats = getMockStatsOverview() as any
      return dynamicStats[prop]
    },
  }
) as unknown as ReturnType<typeof getMockStatsOverview>

export const MOCK_SYSTEM_STATUS = {
  api: {
    status: 'ok',
    version: '1.0.0',
    color: 'blue',
    uptime_seconds: 48200,
  },
  postgres: {
    connected: true,
    status: 'up',
  },
  redis: {
    connected: true,
    status: 'up',
    queue_lag: 0,
    dlq_length: 0,
  },
  worker: {
    count: 1,
    status: 'up',
    last_processed_at: new Date(Date.now() - 5000).toISOString(),
  },
  worker_count: 1,
  queue_lag: 0,
  dlq_length: 0,
  last_record_processed_at: new Date(Date.now() - 5000).toISOString(),
  prometheus_reachable: true,
  grafana_reachable: true,
  prometheus: {
    status: 'up',
    reachable: true,
  },
  grafana: {
    status: 'up',
    reachable: true,
  },
}

export const MOCK_DEPLOYMENTS = [
  {
    id: 1,
    version: '1.0.0',
    color: 'blue',
    status: 'active',
    deployed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    activated_at: new Date(Date.now() - 86400000 * 2 + 120000).toISOString(),
    rolled_back_at: null,
    note: 'Initial production release v1.0.0 (blue active)',
  },
  {
    id: 2,
    version: '1.1.0-faulty',
    color: 'green',
    status: 'rolled_back',
    deployed_at: new Date(Date.now() - 86400000 + 3600000).toISOString(),
    activated_at: new Date(Date.now() - 86400000 + 3660000).toISOString(),
    rolled_back_at: new Date(Date.now() - 86400000 + 3750000).toISOString(),
    note: 'Post-cutover error rate exceeded threshold 5%; auto-rollback executed in 90s',
  },
]

export function getMockCostTimeseries(baseTime?: number, groupBy: string = 'team') {
  const now = baseTime ?? Math.floor(Date.now() / 60000) * 60000

  let names: string[] = []
  let baseWeights: number[] = []

  switch (groupBy) {
    case 'service':
      names = ['compute', 'database', 'storage', 'networking', 'analytics']
      baseWeights = [115, 68, 42, 26, 16]
      break
    case 'region':
      names = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
      baseWeights = [145, 65, 45, 20]
      break
    case 'resource_type':
      names = ['ec2', 'rds', 'eks', 's3', 'lambda']
      baseWeights = [110, 72, 48, 28, 14]
      break
    case 'team':
    default:
      names = ['ml', 'core', 'data', 'platform', 'frontend']
      baseWeights = [85, 55, 42, 30, 18]
      break
  }

  return {
    interval: 'hour',
    series: names.map((name, idx) => {
      const points: Array<[string, number]> = []
      const baseWeight = baseWeights[idx] || 25
      for (let i = 23; i >= 0; i--) {
        const ts = new Date(now - i * 3600000).toISOString()
        const wave = baseWeight + Math.sin((i + idx * 2) / 3.5) * (baseWeight * 0.12)
        // Distinct spike on primary dimension at 2h ago and secondary at 3h ago
        const spike = (idx === 0 && i === 2 ? 140 : 0) + (idx === 1 && i === 3 ? 55 : 0)
        points.push([ts, Math.round((wave + spike) * 10) / 10])
      }
      return { name, points }
    }),
  }
}

export const MOCK_COST_TIMESERIES = getMockCostTimeseries()

export interface MockIngestionJob {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  job_type: string
  total_records: number
  processed_records: number
  error_count: number
  started_at: string
  completed_at?: string
  submitted_by: string
  duration_ms: number
  message?: string
}

const _activeMockJobs: MockIngestionJob[] = [
  {
    id: 'job-9842',
    status: 'done',
    job_type: 'simulate_spike',
    total_records: 48,
    processed_records: 48,
    error_count: 0,
    started_at: new Date(Date.now() - 300000).toISOString(),
    completed_at: new Date(Date.now() - 296000).toISOString(),
    submitted_by: 'admin',
    duration_ms: 4120,
    message: 'Simulated 12x cost spike on ec2-ml-gpu-07 (detected anomaly #101 in 2.8s)',
  },
  {
    id: 'job-9841',
    status: 'done',
    job_type: 'normal_hour',
    total_records: 40,
    processed_records: 40,
    error_count: 0,
    started_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3597000).toISOString(),
    submitted_by: 'scheduler',
    duration_ms: 2850,
    message: 'Hourly synthetic billing records ingestion across all 40 cloud resources',
  },
  {
    id: 'job-9840',
    status: 'done',
    job_type: 'seed_history',
    total_records: 13440,
    processed_records: 13440,
    error_count: 0,
    started_at: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 86372000).toISOString(),
    submitted_by: 'admin',
    duration_ms: 27800,
    message: 'Seeded 14 days of hourly multi-cloud baseline billing history',
  },
]

export function getActiveMockJobs(): MockIngestionJob[] {
  return _activeMockJobs
}

export function addMockJob(job: Partial<MockIngestionJob>): MockIngestionJob {
  const newJob: MockIngestionJob = {
    id: `job-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'done',
    job_type: 'simulate_spike',
    total_records: 40,
    processed_records: 40,
    error_count: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    submitted_by: 'admin',
    duration_ms: 2400,
    message: 'Scenario execution completed successfully',
    ...job,
  }
  _activeMockJobs.unshift(newJob)
  return newJob
}

const heatmapResources = [
  'ec2-ml-gpu-07',
  'rds-core-pg-prod',
  'eks-platform-ingress',
  'lambda-data-sync',
  's3-security-audit',
  'elasticache-ml-redis',
  'ec2-core-compute-02',
  'rds-data-warehouse',
]

const heatmapValues: Array<[number, number, number]> = []
for (let r = 0; r < heatmapResources.length; r++) {
  for (let h = 0; h < 24; h++) {
    const isSpike = r === 0 && h >= 14 && h <= 17
    const base = 5 + ((r * 7) % 25) + Math.sin(h / 3.8) * 4
    const val = isSpike ? base * 4.2 : base
    heatmapValues.push([h, r, Math.round(val * 10) / 10])
  }
}

export const MOCK_HEATMAP = {
  resources: heatmapResources,
  hours: Array.from({ length: 24 }, (_, i) => i),
  values: heatmapValues,
}

export const MOCK_APP_LOGS = Array.from({ length: 80 }).map((_, i) => {
  const levels = ['INFO', 'INFO', 'WARNING', 'INFO', 'ERROR', 'DEBUG']
  const events = [
    'anomaly_detected',
    'records_ingested',
    'detection_completed',
    'rate_limit_evaluated',
    'auth_token_verified',
    'model_drift_evaluated',
    'dlq_check_passed',
  ]
  const loggers = ['ccad.detector', 'ccad.worker', 'ccad.api', 'ccad.security', 'ccad.db']
  const lvl = levels[i % levels.length]
  const evt = events[i % events.length]
  const ts = new Date(Date.now() - i * 45000).toISOString()
  const reqId = `req-${Math.random().toString(36).substring(2, 10)}`
  const resId = `ec2-ml-compute-${String((i % 10) + 1).padStart(2, '0')}`

  return {
    timestamp: ts,
    level: lvl,
    logger: loggers[i % loggers.length],
    event: evt,
    message:
      lvl === 'ERROR'
        ? `Failed to process record batch for ${resId}: timeout during stream ingestion`
        : lvl === 'WARNING'
        ? `Statistical deviation observed on ${resId}: z-score=3.8 exceeds threshold`
        : `Successfully evaluated metric window for ${resId} in 14.2ms`,
    request_id: reqId,
    user: i % 3 === 0 ? 'admin' : 'analyst',
    resource_id: resId,
    duration_ms: Math.round(10 + (i * 3.5) % 40),
  }
})

export const MOCK_AUDIT_LOGS = Array.from({ length: 50 }).map((_, i) => {
  const actions = [
    'threshold_update',
    'simulate_spike',
    'anomaly_acknowledged',
    'anomaly_resolved',
    'login_success',
    'user_created',
  ]
  const results: Array<'success' | 'denied' | 'error'> = ['success', 'success', 'denied', 'success', 'success']
  const actors = ['admin', 'analyst', 'system', 'admin']
  const act = actions[i % actions.length]
  const res = results[i % results.length]
  const ts = new Date(Date.now() - i * 3600000).toISOString()

  return {
    id: i + 1,
    actor: actors[i % actors.length],
    action: act,
    entity: 'anomaly_detector',
    entity_id: `anom-${100 + (i % 20)}`,
    ip: `192.168.1.${10 + (i % 50)}`,
    result: res,
    detail: {
      old_value: act === 'threshold_update' ? { z_threshold: 3.0 } : undefined,
      new_value: act === 'threshold_update' ? { z_threshold: 3.5 } : undefined,
      multiplier: act === 'simulate_spike' ? 4.5 : undefined,
      note: res === 'denied' ? 'User lacks required administrator permissions' : undefined,
    },
    ts,
  }
})

