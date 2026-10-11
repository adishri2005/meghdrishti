import { describe, it, expect } from 'vitest'
import {
  isAdmin,
  isAnalyst,
  canManageSettings,
  canViewLogs,
  canSimulate,
  canAcknowledgeAnomalies,
  canResolveAnomalies,
} from '@/lib/rbac'

describe('RBAC Authorization Helpers', () => {
  it('differentiates admin role correctly', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('analyst')).toBe(false)
    expect(isAdmin('service')).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })

  it('allows analyst or admin for analyst scopes', () => {
    expect(isAnalyst('analyst')).toBe(true)
    expect(isAnalyst('admin')).toBe(true)
    expect(isAnalyst('service')).toBe(false)
  })

  it('protects settings and logs for admin only', () => {
    expect(canManageSettings('admin')).toBe(true)
    expect(canManageSettings('analyst')).toBe(false)

    expect(canViewLogs('admin')).toBe(true)
    expect(canViewLogs('analyst')).toBe(false)

    expect(canSimulate('admin')).toBe(true)
    expect(canSimulate('analyst')).toBe(false)
  })

  it('allows both roles to acknowledge and resolve anomalies', () => {
    expect(canAcknowledgeAnomalies('admin')).toBe(true)
    expect(canAcknowledgeAnomalies('analyst')).toBe(true)

    expect(canResolveAnomalies('admin')).toBe(true)
    expect(canResolveAnomalies('analyst')).toBe(true)
  })
})
