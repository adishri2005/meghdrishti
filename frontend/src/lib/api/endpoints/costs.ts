import { apiClient } from '../client'
import {
  CostTimeSeriesSchema,
  type CostTimeSeries,
  CostHeatmapSchema,
  type CostHeatmap,
} from '../types'
import { getMockCostTimeseries, MOCK_HEATMAP } from '@/mocks/fixtures'

export async function getCostTimeseries(params: {
  group_by?: string
  from?: string
  to?: string
  interval?: string
} = {}): Promise<CostTimeSeries> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return getMockCostTimeseries()
  }
  try {
    const res = await apiClient.get('/costs/timeseries', { params })
    return CostTimeSeriesSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Falling back to mock cost timeseries:', error)
      return getMockCostTimeseries()
    }
    throw error
  }
}

export async function getCostHeatmap(params: {
  from?: string
  to?: string
} = {}): Promise<CostHeatmap> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return MOCK_HEATMAP
  }
  try {
    const res = await apiClient.get('/costs/heatmap', { params })
    return CostHeatmapSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Falling back to mock heatmap:', error)
      return MOCK_HEATMAP
    }
    throw error
  }
}
