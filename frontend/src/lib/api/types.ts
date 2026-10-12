import { z } from 'zod'

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low'])
export type Severity = z.infer<typeof SeveritySchema>

export const AnomalyStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'ignored'])
export type AnomalyStatus = z.infer<typeof AnomalyStatusSchema>

export const TopSpenderSchema = z.object({
  resource_id: z.string(),
  team: z.string(),
  cost: z.number(),
  share_pct: z.number(),
})
export type TopSpender = z.infer<typeof TopSpenderSchema>

export const AnomalySchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  resource_id: z.union([z.string(), z.number(), z.null()]).transform((v) => (v ? String(v) : 'unknown')),
  resource_name: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  anomaly_type: z.string().optional().nullable(),
  severity: SeveritySchema,
  status: AnomalyStatusSchema,
  expected_cost: z.number(),
  actual_cost: z.number().optional().nullable(),
  observed_cost: z.number().optional().nullable(),
  z_score: z.number().nullable().optional(),
  pct_increase: z.number().nullable().optional(),
  detected_at: z.string(),
  record_ts: z.string().optional().nullable(),
  root_cause_summary: z.string().optional().nullable(),
  acknowledged_at: z.string().optional().nullable(),
  resolved_at: z.string().optional().nullable(),
  occurrences: z.number().optional().nullable().default(1),
  detection_delay_seconds: z.number().optional().nullable(),
}).transform((data) => ({
  ...data,
  anomaly_type: data.anomaly_type || data.method || 'statistical_spike',
  actual_cost: data.actual_cost ?? data.observed_cost ?? data.expected_cost * 2,
  resource_id: data.resource_name || data.resource_id,
  z_score: data.z_score ?? 0,
}))
export type Anomaly = z.infer<typeof AnomalySchema>

export const StatsOverviewSchema = z.object({
  generated_at: z.string(),
  cost_24h: z.number(),
  cost_prev_24h: z.number(),
  cost_change_pct: z.number(),
  records_24h: z.number(),
  active_resources: z.number(),
  anomalies_open: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    total: z.number(),
  }),
  anomalies_24h: z.number(),
  mttd_seconds_p95: z.number(),
  top_spenders: z.array(TopSpenderSchema),
  latest_anomaly: z.any().optional().nullable(),
})
export type StatsOverview = z.infer<typeof StatsOverviewSchema>

export const CostTimeSeriesSchema = z.object({
  interval: z.string(),
  series: z.array(
    z.object({
      name: z.string(),
      points: z.array(z.tuple([z.string(), z.number()])),
    })
  ),
})
export type CostTimeSeries = z.infer<typeof CostTimeSeriesSchema>

export const CostHeatmapSchema = z.object({
  resources: z.array(z.string()),
  hours: z.array(z.number()),
  values: z.array(z.tuple([z.number(), z.number(), z.number()])),
})
export type CostHeatmap = z.infer<typeof CostHeatmapSchema>

export const ResourceRowSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  resource_id: z.string(),
  team: z.string(),
  service: z.string(),
  region: z.string(),
  type: z.string(),
  last_cost: z.number(),
  baseline_mean_now: z.number(),
  cost_24h: z.number(),
  open_anomalies: z.number(),
  status: z.enum(['normal', 'warning', 'anomalous']),
})
export type ResourceRow = z.infer<typeof ResourceRowSchema>

export const DeploymentRecordSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  version: z.string(),
  color: z.enum(['blue', 'green']),
  status: z.enum(['active', 'standby', 'rolled_back', 'failed']),
  deployed_at: z.string(),
  activated_at: z.string().optional().nullable(),
  rolled_back_at: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})
export type DeploymentRecord = z.infer<typeof DeploymentRecordSchema>

export const SystemStatusSchema = z.object({
  api: z.object({
    status: z.string(),
    version: z.string(),
    color: z.string(),
    uptime_seconds: z.number().optional(),
  }),
  postgres: z.object({
    status: z.string(),
    latency_ms: z.number().optional(),
    connected: z.boolean().optional(),
  }),
  redis: z.object({
    status: z.string(),
    latency_ms: z.number().optional(),
    connected: z.boolean().optional(),
  }),
  queue: z.object({
    stream_length: z.number().optional(),
    pending: z.number().optional(),
    lag: z.number().optional(),
  }).optional(),
  worker: z.object({
    active_workers: z.number().optional(),
    dlq_length: z.number().optional(),
    status: z.string().optional(),
  }).optional(),
  prometheus: z.object({
    reachable: z.boolean().optional(),
    status: z.string().optional(),
  }).optional(),
  grafana: z.object({
    reachable: z.boolean().optional(),
    status: z.string().optional(),
  }).optional(),
})
export type SystemStatus = z.infer<typeof SystemStatusSchema>

export const LogRecordSchema = z.object({
  timestamp: z.string().optional().default(''),
  level: z.string().optional().default('INFO'),
  logger: z.string().optional().default('ccad'),
  event: z.string().optional().default(''),
  message: z.string().optional().default(''),
  request_id: z.string().optional(),
  user: z.string().optional(),
}).passthrough()
export type LogRecord = z.infer<typeof LogRecordSchema>

export const AuditLogRecordSchema = z.object({
  id: z.number(),
  actor: z.string(),
  action: z.string(),
  entity: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  result: z.enum(['success', 'denied', 'error']),
  detail: z.record(z.any()).nullable().optional(),
  ts: z.string().nullable().optional(),
})
export type AuditLogRecord = z.infer<typeof AuditLogRecordSchema>

export const ThresholdsSchema = z.object({
  detection: z.object({
    z_threshold: z.number().default(3.0),
    pct_jump_threshold: z.number().default(50.0),
    ewma_alpha: z.number().default(0.2),
    min_samples: z.number().default(10),
    drift_ratio_threshold: z.number().optional().default(1.2),
    aggregate_cost_threshold: z.number().optional().default(1000.0),
    dedup_window_seconds: z.number().optional().default(3600),
  }),
  severity: z.object({
    critical: z.object({ z: z.number(), pct: z.number() }),
    high: z.object({ z: z.number(), pct: z.number() }),
    medium: z.object({ z: z.number(), pct: z.number() }),
  }),
})
export type Thresholds = z.infer<typeof ThresholdsSchema>

export const UserRecordSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.string().nullable().optional(),
})
export type UserRecord = z.infer<typeof UserRecordSchema>

export const ApiClientRecordSchema = z.object({
  id: z.number(),
  name: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.string().nullable().optional(),
})
export type ApiClientRecord = z.infer<typeof ApiClientRecordSchema>


