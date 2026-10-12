import { apiClient } from '../client'
import { AnomalySchema, type Anomaly } from '../types'
import { MOCK_ANOMALIES, getMockAnomalies, updateMockAnomalyStatus, bulkUpdateMockAnomaliesStatus } from '@/mocks/fixtures'

export interface AnomalyListParams {
  severity?: string
  status?: string
  scope?: string
  method?: string
  resource_id?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface AnomalyTimelineData {
  resource_id: string
  anomaly_id: string
  points: Array<{
    timestamp: string
    actual_cost: number
    baseline_mean: number
    baseline_std: number
    upper_bound: number
    lower_bound: number
    is_anomaly: boolean
  }>
}

export async function getAnomalies(params: AnomalyListParams = {}): Promise<{
  items: Anomaly[]
  total: number
}> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const rawAnomalies = typeof getMockAnomalies === 'function' ? getMockAnomalies() : MOCK_ANOMALIES
    const mapped = rawAnomalies.map((a) => AnomalySchema.parse(a))
    let filtered = [...mapped]
    if (params.status) {
      filtered = filtered.filter((a) => a.status === params.status)
    }
    if (params.severity) {
      filtered = filtered.filter((a) => a.severity === params.severity)
    }
    if (params.resource_id) {
      filtered = filtered.filter((a) =>
        a.resource_id.toLowerCase().includes(params.resource_id!.toLowerCase())
      )
    }
    const limit = params.limit || 25
    const offset = params.offset || 0
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    }
  }

  try {
    const res = await apiClient.get('/anomalies', { params })
    const items = (res.data.items || res.data || []).map((item: unknown) =>
      AnomalySchema.parse(item)
    )
    return {
      items,
      total: res.data.total ?? items.length,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Falling back to mock anomalies:', error)
      let filtered = [...MOCK_ANOMALIES]
      if (params.status) {
        filtered = filtered.filter((a) => a.status === params.status)
      }
      if (params.severity) {
        filtered = filtered.filter((a) => a.severity === params.severity)
      }
      return {
        items: filtered.slice(0, params.limit || 25).map((a) => AnomalySchema.parse(a)),
        total: filtered.length,
      }
    }
    throw error
  }
}

export async function acknowledgeAnomaly(id: string | number): Promise<Anomaly> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const updated = updateMockAnomalyStatus(id, 'acknowledged')
    if (updated) {
      return AnomalySchema.parse(updated)
    }
  }

  try {
    const res = await apiClient.patch(`/anomalies/${id}`, { status: 'acknowledged' })
    return AnomalySchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      const updated = updateMockAnomalyStatus(id, 'acknowledged')
      if (updated) {
        return AnomalySchema.parse(updated)
      }
    }
    throw error
  }
}

export async function resolveAnomaly(id: string | number): Promise<Anomaly> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const updated = updateMockAnomalyStatus(id, 'resolved')
    if (updated) {
      return AnomalySchema.parse(updated)
    }
  }

  try {
    const res = await apiClient.patch(`/anomalies/${id}`, { status: 'resolved' })
    return AnomalySchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      const updated = updateMockAnomalyStatus(id, 'resolved')
      if (updated) {
        return AnomalySchema.parse(updated)
      }
    }
    throw error
  }
}

export async function getAnomalyTimeline(id: string): Promise<AnomalyTimelineData> {
  const res = await apiClient.get(`/anomalies/${id}/timeline`)
  return res.data
}

export async function acknowledgeAllAnomalies(): Promise<number> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return bulkUpdateMockAnomaliesStatus('acknowledged', 'open')
  }

  try {
    const res = await apiClient.post('/anomalies/bulk-acknowledge')
    return res.data.count ?? 0
  } catch (error) {
    if (import.meta.env.DEV) {
      return bulkUpdateMockAnomaliesStatus('acknowledged', 'open')
    }
    throw error
  }
}

export async function resolveAllAnomalies(): Promise<number> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return bulkUpdateMockAnomaliesStatus('resolved')
  }

  try {
    const res = await apiClient.post('/anomalies/bulk-resolve')
    return res.data.count ?? 0
  } catch (error) {
    if (import.meta.env.DEV) {
      return bulkUpdateMockAnomaliesStatus('resolved')
    }
    throw error
  }
}
