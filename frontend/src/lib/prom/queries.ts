export const PROM_QUERIES = {
  rps: 'sum(rate(api_requests_total[1m]))',
  errorRatio:
    'sum(rate(api_requests_total{status=~"5.."}[1m])) / clamp_min(sum(rate(api_requests_total[1m])), 0.001)',
  errorByColor:
    'sum by (job) (rate(api_requests_total{status=~"5.."}[1m]))',
  latencyP50:
    'histogram_quantile(0.50, sum by (le) (rate(api_latency_seconds_bucket[1m])))',
  latencyP95:
    'histogram_quantile(0.95, sum by (le) (rate(api_latency_seconds_bucket[1m])))',
  latencyP99:
    'histogram_quantile(0.99, sum by (le) (rate(api_latency_seconds_bucket[1m])))',
  ingestRate: 'sum(rate(records_ingested_total{source="api"}[1m]))',
  processedRate: 'sum(rate(records_processed_total[1m]))',
  queueLag: 'max(queue_lag)',
  dlqLength: 'max(dlq_length)',
  detectionP95:
    'histogram_quantile(0.95, sum by (le) (rate(detection_delay_seconds_bucket[5m])))',
  anomaliesBySev:
    'sum by (severity) (increase(anomalies_detected_total[1h]))',
  cacheHitRatio:
    'sum(rate(cache_hits_total[5m])) / clamp_min(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])), 0.001)',
  workerCount: 'count(up{job="worker"} == 1)',
  activeVersion: 'app_version_info',
  cpuPct:
    '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100',
  memPct:
    '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100',
  pgConnections: 'sum(pg_stat_database_numbackends)',
  redisMemory: 'redis_memory_used_bytes',
  targetsUp: 'up',
} as const

export type PromQueryKey = keyof typeof PROM_QUERIES

export interface PromSample {
  metric: Record<string, string>
  value: [number, string] // [timestamp_seconds, string_value]
}

export interface PromMatrixSeries {
  metric: Record<string, string>
  values: Array<[number, string]> // [[timestamp_seconds, string_value], ...]
}

export interface PromQueryResult<T = PromSample[] | PromMatrixSeries[]> {
  status: 'success' | 'error'
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string'
    result: T
  }
  errorType?: string
  error?: string
}

export interface PromTarget {
  discoveredLabels: Record<string, string>
  labels: Record<string, string>
  scrapePool: string
  scrapeUrl: string
  globalUrl: string
  lastError: string
  lastScrape: string
  lastScrapeDuration: number
  health: 'up' | 'down' | 'unknown'
}

export interface PromAlert {
  labels: Record<string, string>
  annotations: Record<string, string>
  state: 'firing' | 'pending' | 'inactive'
  activeAt: string
  value: string
}

export interface PromRuleGroup {
  name: string
  file: string
  rules: Array<{
    name: string
    query: string
    duration: number
    labels: Record<string, string>
    annotations: Record<string, string>
    alerts?: PromAlert[]
    health: string
    type: 'alerting' | 'recording'
  }>
}
