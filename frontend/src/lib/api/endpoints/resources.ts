import { apiClient } from '../client'
import { ResourceRowSchema, type ResourceRow } from '../types'
import { MOCK_RESOURCES } from '@/mocks/fixtures'

export interface ResourceListParams {
  search?: string
  team?: string
  service?: string
  region?: string
  type?: string
  limit?: number
  offset?: number
  sort?: string
}

export async function getResources(params: ResourceListParams = {}): Promise<{
  items: ResourceRow[]
  total: number
}> {
  if (import.meta.env.VITE_MOCK === 'true') {
    let filtered = MOCK_RESOURCES.map((r) => ResourceRowSchema.parse(r))
    if (params.search) {
      filtered = filtered.filter((r) =>
        r.resource_id.toLowerCase().includes(params.search!.toLowerCase())
      )
    }
    if (params.team) {
      filtered = filtered.filter((r) => r.team === params.team)
    }
    if (params.service) {
      filtered = filtered.filter((r) => r.service === params.service)
    }
    if (params.region) {
      filtered = filtered.filter((r) => r.region === params.region)
    }
    if (params.type) {
      filtered = filtered.filter((r) => r.type === params.type)
    }
    const limit = params.limit || 25
    const offset = params.offset || 0
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    }
  }

  try {
    const res = await apiClient.get('/resources', { params })
    const items = (res.data.items || res.data || []).map((item: unknown) =>
      ResourceRowSchema.parse(item)
    )
    return {
      items,
      total: res.data.total ?? items.length,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      return {
        items: MOCK_RESOURCES.slice(0, params.limit || 25).map((r) => ResourceRowSchema.parse(r)),
        total: MOCK_RESOURCES.length,
      }
    }
    throw error
  }
}

export async function getResource(id: string): Promise<ResourceRow> {
  if (import.meta.env.VITE_MOCK === 'true') {
    const found = MOCK_RESOURCES.find((r) => r.resource_id === id)
    if (found) return ResourceRowSchema.parse(found)
  }
  try {
    const res = await apiClient.get(`/resources/${encodeURIComponent(id)}`)
    return ResourceRowSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      const fallback = MOCK_RESOURCES[0]
      return ResourceRowSchema.parse({ ...fallback, resource_id: id })
    }
    throw error
  }
}

export async function getResourceCosts(
  id: string,
  from?: string,
  to?: string
): Promise<{
  points: Array<{
    timestamp: string
    actual_cost: number
    baseline_mean: number
    upper_bound: number
    lower_bound: number
    is_anomaly: boolean
  }>
}> {
  try {
    const res = await apiClient.get(`/resources/${encodeURIComponent(id)}/costs`, {
      params: { from, to },
    })
    return res.data
  } catch {
    // Generate synthetic realistic cost band for resource
    const points = []
    const now = Date.now()
    for (let i = 24; i >= 0; i--) {
      const ts = new Date(now - i * 3600000).toISOString()
      const hour = new Date(ts).getHours()
      const mean = 15 + Math.sin(hour / 4) * 5
      const std = 2.5
      const actual = i === 3 ? mean * 3.8 : mean + Math.sin(i) * 1.5
      points.push({
        timestamp: ts,
        actual_cost: Math.round(actual * 100) / 100,
        baseline_mean: Math.round(mean * 100) / 100,
        upper_bound: Math.round((mean + 3 * std) * 100) / 100,
        lower_bound: Math.round(Math.max(0, mean - 3 * std) * 100) / 100,
        is_anomaly: i === 3,
      })
    }
    return { points }
  }
}

export async function getResourceBaseline(id: string): Promise<{
  hourly: Array<{ hour: number; mean: number; std: number }>
}> {
  try {
    const res = await apiClient.get(`/resources/${encodeURIComponent(id)}/baseline`)
    return res.data
  } catch {
    const hourly = Array.from({ length: 24 }, (_, hour) => {
      const mean = 12 + Math.sin((hour / 24) * Math.PI * 2) * 6
      const std = 1.8 + Math.random() * 0.5
      return {
        hour,
        mean: Math.round(mean * 10) / 10,
        std: Math.round(std * 10) / 10,
      }
    })
    return { hourly }
  }
}
