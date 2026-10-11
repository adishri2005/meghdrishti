import { apiClient } from '../client'
import {
  UserRecordSchema,
  ApiClientRecordSchema,
  type UserRecord,
  type ApiClientRecord,
} from '../types'

const MOCK_USERS: UserRecord[] = [
  { id: 1, username: 'admin', role: 'admin', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, username: 'analyst', role: 'analyst', is_active: true, created_at: '2026-01-02T00:00:00Z' },
]

const MOCK_CLIENTS: ApiClientRecord[] = [
  { id: 1, name: 'prometheus-scraper', role: 'service', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'cur-ingest-worker', role: 'service', is_active: true, created_at: '2026-01-02T00:00:00Z' },
]

export async function getUsers(): Promise<UserRecord[]> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return MOCK_USERS
  }

  try {
    const res = await apiClient.get<UserRecord[]>('/auth/users')
    return (res.data || []).map((u) => UserRecordSchema.parse(u))
  } catch (error) {
    if (import.meta.env.DEV) {
      return MOCK_USERS
    }
    throw error
  }
}

export async function registerUser(payload: {
  username: string
  password: string
  role: 'admin' | 'analyst'
}): Promise<UserRecord> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return {
      id: Date.now(),
      username: payload.username,
      role: payload.role,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  }

  const res = await apiClient.post<UserRecord>('/auth/register', payload)
  return UserRecordSchema.parse(res.data)
}

export async function getApiClients(): Promise<ApiClientRecord[]> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return MOCK_CLIENTS
  }

  try {
    const res = await apiClient.get<ApiClientRecord[]>('/auth/api-clients')
    return (res.data || []).map((c) => ApiClientRecordSchema.parse(c))
  } catch (error) {
    if (import.meta.env.DEV) {
      return MOCK_CLIENTS
    }
    throw error
  }
}

export async function createApiClient(payload: {
  name: string
}): Promise<{ id: number; name: string; api_key: string }> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return {
      id: Date.now(),
      name: payload.name,
      api_key: `cg_live_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
    }
  }

  const res = await apiClient.post<{ id: number; name: string; api_key: string }>(
    '/auth/api-clients',
    payload
  )
  return res.data
}
