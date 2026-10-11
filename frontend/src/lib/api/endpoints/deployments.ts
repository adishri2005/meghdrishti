import { apiClient } from '../client'
import {
  DeploymentRecordSchema,
  type DeploymentRecord,
} from '../types'
import { MOCK_DEPLOYMENTS } from '@/mocks/fixtures'

export async function getCurrentDeployment(): Promise<{
  active_color: 'blue' | 'green'
  version: string
  uptime_seconds?: number
  last_deployment?: DeploymentRecord
}> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return {
      active_color: 'blue',
      version: 'v1.0.0',
      uptime_seconds: 86400,
      last_deployment: DeploymentRecordSchema.parse(MOCK_DEPLOYMENTS[0]),
    }
  }

  try {
    const res = await apiClient.get('/admin/deployments/current')
    return res.data
  } catch (error) {
    if (import.meta.env.DEV) {
      return {
        active_color: 'blue',
        version: 'v1.0.0',
        uptime_seconds: 86400,
        last_deployment: DeploymentRecordSchema.parse(MOCK_DEPLOYMENTS[0]),
      }
    }
    throw error
  }
}

export async function getDeployments(limit = 10): Promise<DeploymentRecord[]> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return MOCK_DEPLOYMENTS.slice(0, limit).map((d) => DeploymentRecordSchema.parse(d))
  }

  try {
    const res = await apiClient.get('/admin/deployments', { params: { limit } })
    return (res.data.items || res.data || []).map((d: unknown) =>
      DeploymentRecordSchema.parse(d)
    )
  } catch (error) {
    if (import.meta.env.DEV) {
      return MOCK_DEPLOYMENTS.slice(0, limit).map((d) => DeploymentRecordSchema.parse(d))
    }
    throw error
  }
}
