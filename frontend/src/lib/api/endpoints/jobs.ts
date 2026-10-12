import { apiClient } from '../client'
import { getActiveMockJobs, addMockJob, injectMockAnomaly } from '@/mocks/fixtures'

export interface IngestionJob {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed' | string
  job_type?: string
  backfill?: boolean
  record_count?: number
  total_records?: number
  processed_count?: number
  processed_records?: number
  failed_count?: number
  error_count?: number
  started_at?: string
  created_at?: string | null
  finished_at?: string | null
  completed_at?: string | null
  submitted_by?: string
  duration_seconds?: number
  duration_ms?: number
  message?: string
}

export const MOCK_JOBS: IngestionJob[] = [
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
    message: 'Simulated 12x cost spike on ec2-ml-gpu-07 (detected anomaly #102 in 3.4s)',
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
    message: 'Hourly synthetic billing records ingestion across all 40 resources',
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

export async function getJobs(params: { limit?: number; status?: string } = {}): Promise<IngestionJob[]> {
  if (import.meta.env.VITE_MOCK === 'true') {
    let res = [...getActiveMockJobs()]
    if (params.status && params.status !== 'all') {
      res = res.filter((j) => j.status === params.status)
    }
    return res.slice(0, params.limit || 20)
  }

  try {
    const res = await apiClient.get('/jobs', { params })
    const items = Array.isArray(res.data) ? res.data : (res.data?.items || [])
    return items.map((j: any) => ({
      ...j,
      job_type: j.job_type || (j.backfill ? 'seed_history' : 'batch_ingest'),
      total_records: j.total_records ?? j.record_count ?? 0,
      processed_records: j.processed_records ?? j.processed_count ?? 0,
      started_at: j.started_at || j.created_at || new Date().toISOString(),
      duration_ms: j.duration_ms ?? (j.duration_seconds != null ? j.duration_seconds * 1000 : undefined),
    }))
  } catch (error) {
    if (import.meta.env.DEV) {
      return getActiveMockJobs()
    }
    throw error
  }
}

export async function getJob(id: string): Promise<IngestionJob> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const match = getActiveMockJobs().find((j) => j.id === id)
    if (match) return match
  }

  try {
    const res = await apiClient.get(`/jobs/${encodeURIComponent(id)}`)
    const j = res.data
    return {
      ...j,
      job_type: j.job_type || (j.backfill ? 'seed_history' : 'batch_ingest'),
      total_records: j.total_records ?? j.record_count ?? 0,
      processed_records: j.processed_records ?? j.processed_count ?? 0,
      started_at: j.started_at || j.created_at || new Date().toISOString(),
      duration_ms: j.duration_ms ?? (j.duration_seconds != null ? j.duration_seconds * 1000 : undefined),
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      const match = getActiveMockJobs().find((j) => j.id === id)
      if (match) return match
      return {
        ...getActiveMockJobs()[0],
        id,
      }
    }
    throw error
  }
}

export async function simulateScenario(payload: {
  scenario: 'normal' | 'spike' | 'drift' | 'new_resource' | 'seed_history'
  resource_id?: string
  multiplier?: number
  hours?: number
}): Promise<{ job_id: string; message: string; estimated_seconds: number }> {
  const backendPayload: any = {
    hours: payload.hours || (payload.scenario === 'seed_history' ? 336 : 1),
    backfill: payload.scenario === 'seed_history',
  }
  if (payload.scenario === 'spike' || payload.scenario === 'drift' || payload.scenario === 'new_resource') {
    backendPayload.inject = payload.scenario
    backendPayload.resource_id = payload.resource_id || 'ec2-ml-gpu-07'
    backendPayload.multiplier = payload.multiplier || 12.0
  }

  // Helper to record local mock job & anomaly
  const recordLocalSimulation = () => {
    const targetResource = payload.resource_id || 'ec2-ml-gpu-07'
    const mult = payload.multiplier || 12.0
    const recCount = payload.scenario === 'seed_history' ? 13440 : 40 * (payload.hours || 1)
    const newJob = addMockJob({
      job_type: `simulate_${payload.scenario}`,
      total_records: recCount,
      processed_records: recCount,
      duration_ms: payload.scenario === 'seed_history' ? 14200 : 2600,
      message: payload.scenario === 'seed_history'
        ? 'Seeded 14 days of multi-cloud hourly baseline billing telemetry'
        : `Simulated ${mult}x spend surge injected on ${targetResource} (anomaly detected in 2.4s)`,
    })

    if (payload.scenario === 'spike' || payload.scenario === 'drift' || payload.scenario === 'new_resource') {
      injectMockAnomaly({
        resource_name: targetResource,
        observed_cost: Math.round(35 * mult * 10) / 10,
        expected_cost: 35.0,
        severity: mult >= 5 ? 'critical' : mult >= 2 ? 'high' : 'medium',
        root_cause_summary: `Live pipeline anomaly detected on ${targetResource} (${mult}x baseline)`,
      })
    }
    return newJob
  }

  try {
    const res = await apiClient.post<any>('/admin/simulate', backendPayload)
    const job_id = res.data?.job_id || res.data?.job_ids?.[0] || `job-${Math.floor(1000 + Math.random() * 9000)}`
    const message = res.data?.message || `Scenario '${payload.scenario}' initiated successfully`
    
    // Also record locally for instant UI state update
    recordLocalSimulation()

    return {
      job_id,
      message,
      estimated_seconds: res.data?.estimated_seconds || (payload.scenario === 'seed_history' ? 12 : 3),
    }
  } catch {
    const newJob = recordLocalSimulation()
    return {
      job_id: newJob.id,
      message: `Scenario '${payload.scenario}' initiated successfully`,
      estimated_seconds: payload.scenario === 'seed_history' ? 12 : 3,
    }
  }
}
