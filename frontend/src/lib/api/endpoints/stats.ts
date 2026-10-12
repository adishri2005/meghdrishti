import { apiClient } from '../client'
import {
  StatsOverviewSchema,
  type StatsOverview,
  SystemStatusSchema,
  type SystemStatus,
} from '../types'
import { getMockStatsOverview, MOCK_SYSTEM_STATUS } from '@/mocks/fixtures'

export async function getStatsOverview(): Promise<StatsOverview> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return StatsOverviewSchema.parse(getMockStatsOverview())
  }
  try {
    const res = await apiClient.get('/stats/overview')
    return StatsOverviewSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Falling back to mock overview stats:', error)
      return StatsOverviewSchema.parse(getMockStatsOverview())
    }
    throw error
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return SystemStatusSchema.parse(MOCK_SYSTEM_STATUS)
  }
  try {
    const res = await apiClient.get('/system/status')
    return SystemStatusSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      return SystemStatusSchema.parse(MOCK_SYSTEM_STATUS)
    }
    throw error
  }
}
