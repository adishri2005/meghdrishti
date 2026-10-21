import axios from 'axios'

export interface GrafanaDashboardSearchResult {
  id: number
  uid: string
  title: string
  uri: string
  url: string
  slug: string
  type: string
  tags: string[]
  isStarred: boolean
}

export interface GrafanaEmbedOptions {
  uid?: string
  slug?: string
  panelId?: number
  from?: string | number
  to?: string | number
  theme?: 'dark' | 'light'
  refresh?: string
  kiosk?: boolean
  orgId?: number
}

export const GRAFANA_PANELS = {
  REQUEST_RATE: 1,
  LATENCY_P50_P95_P99: 2,
  ERROR_RATE_BY_COLOR: 3,
  INGESTION_VS_PROCESSING: 4,
  QUEUE_LAG: 5,
  DLQ_LENGTH: 6,
  ACTIVE_VERSION: 7,
  DETECTION_DELAY_P95: 8,
  ANOMALIES_BY_SEVERITY: 9,
  CACHE_HIT_RATIO: 10,
  CPU_USAGE: 11,
  MEMORY_USAGE: 12,
  POSTGRES_CONNECTIONS: 13,
  REDIS_MEMORY: 14,
} as const

export const GRAFANA_PANEL_INFO: Record<number, { title: string; type: string; expr: string }> = {
  1: { title: 'Request Rate', type: 'timeseries', expr: 'sum(rate(api_requests_total[1m]))' },
  2: { title: 'API Latency (p50/p95/p99)', type: 'timeseries', expr: 'histogram_quantile(..., api_latency_seconds_bucket)' },
  3: { title: 'Error Rate by Color', type: 'timeseries', expr: 'sum(rate(api_requests_total{status=~"5.."}[1m])) by (job)' },
  4: { title: 'Ingestion vs Processing Throughput', type: 'timeseries', expr: 'records_ingested_total vs records_processed_total' },
  5: { title: 'Queue Lag', type: 'timeseries', expr: 'queue_lag' },
  6: { title: 'DLQ Length', type: 'stat', expr: 'dlq_length' },
  7: { title: 'Active Version', type: 'stat', expr: 'app_version_info' },
  8: { title: 'Detection Delay (p95)', type: 'timeseries', expr: 'detection_delay_seconds_bucket' },
  9: { title: 'Anomalies by Severity', type: 'timeseries', expr: 'anomalies_detected_total' },
  10: { title: 'Cache Hit Ratio', type: 'gauge', expr: 'cache_hits_total / (hits + misses)' },
  11: { title: 'CPU Usage', type: 'timeseries', expr: 'node_cpu_seconds_total' },
  12: { title: 'Memory Usage', type: 'timeseries', expr: 'node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes' },
  13: { title: 'PostgreSQL Connections', type: 'timeseries', expr: 'pg_stat_activity_count' },
  14: { title: 'Redis Memory', type: 'timeseries', expr: 'redis_memory_used_bytes' },
}

const grafanaAxios = axios.create({
  baseURL: '/grafana/api',
  withCredentials: true,
  timeout: 10000,
})

export const grafanaClient = {
  /**
   * Search available dashboards in Grafana
   */
  async listDashboards(signal?: AbortSignal): Promise<GrafanaDashboardSearchResult[]> {
    try {
      const res = await grafanaAxios.get<GrafanaDashboardSearchResult[]>('/search?type=dash-db', { signal })
      return res.data || []
    } catch {
      // Return default provisioned dashboard if search is unavailable/restricted
      return [
        {
          id: 1,
          uid: 'meghdrishti-main',
          title: 'Meghdrishti Overview',
          uri: 'db/meghdrishti-overview',
          url: '/d/meghdrishti-main/meghdrishti-overview',
          slug: 'meghdrishti-overview',
          type: 'dash-db',
          tags: ['meghdrishti'],
          isStarred: false,
        },
      ]
    }
  },

  /**
   * Build embed URL for full dashboard or solo panel
   */
  buildEmbedUrl(options: GrafanaEmbedOptions): string {
    const {
      uid = 'meghdrishti-main',
      slug = 'meghdrishti-overview',
      panelId,
      from = 'now-1h',
      to = 'now',
      theme = 'dark',
      refresh = '10s',
      kiosk = true,
      orgId = 1,
    } = options

    const basePath = panelId !== undefined
      ? `/grafana/d-solo/${encodeURIComponent(uid)}/${encodeURIComponent(slug)}`
      : `/grafana/d/${encodeURIComponent(uid)}/${encodeURIComponent(slug)}`

    const params = new URLSearchParams()
    params.set('orgId', String(orgId))
    params.set('theme', theme)
    params.set('from', String(from))
    params.set('to', String(to))
    if (refresh) params.set('refresh', refresh)
    if (kiosk) params.set('kiosk', '')
    if (panelId !== undefined) params.set('panelId', String(panelId))

    return `${basePath}?${params.toString()}`
  },
}
