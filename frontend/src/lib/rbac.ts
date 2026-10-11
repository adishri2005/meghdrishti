export type Role = 'admin' | 'analyst' | 'service'

export interface UserProfile {
  username: string
  role: Role
  expires_at?: number // Unix timestamp
}

export function isAdmin(role?: Role): boolean {
  return role === 'admin'
}

export function isAnalyst(role?: Role): boolean {
  return role === 'analyst' || role === 'admin'
}

export function canManageSettings(role?: Role): boolean {
  return role === 'admin'
}

export function canViewLogs(role?: Role): boolean {
  return role === 'admin'
}

export function canSimulate(role?: Role): boolean {
  return role === 'admin'
}

export function canAcknowledgeAnomalies(role?: Role): boolean {
  return role === 'admin' || role === 'analyst'
}

export function canResolveAnomalies(role?: Role): boolean {
  return role === 'admin' || role === 'analyst'
}
