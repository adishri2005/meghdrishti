import { apiClient } from '../client'
import {
  LogRecordSchema,
  AuditLogRecordSchema,
  type LogRecord,
  type AuditLogRecord,
} from '../types'
import { MOCK_APP_LOGS, MOCK_AUDIT_LOGS } from '@/mocks/fixtures'

export interface GetAppLogsParams {
  level?: string
  event?: string
  q?: string
  request_id?: string
  since?: string
  limit?: number
}

export async function getAppLogs(params: GetAppLogsParams = {}): Promise<LogRecord[]> {
  if (import.meta.env.VITE_MOCK === 'true') {
    let result = [...MOCK_APP_LOGS]
    if (params.level) {
      result = result.filter((l) => l.level.toLowerCase() === params.level?.toLowerCase())
    }
    if (params.event) {
      result = result.filter((l) => l.event === params.event)
    }
    if (params.request_id) {
      result = result.filter((l) => l.request_id === params.request_id)
    }
    if (params.q) {
      const q = params.q.toLowerCase()
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.logger.toLowerCase().includes(q) ||
          l.event.toLowerCase().includes(q)
      )
    }
    return result.slice(0, params.limit || 100).map((r) => LogRecordSchema.parse(r))
  }

  try {
    const res = await apiClient.get<LogRecord[]>('/admin/logs', { params })
    return (res.data || []).map((r) => LogRecordSchema.parse(r))
  } catch (error) {
    if (import.meta.env.DEV) {
      return MOCK_APP_LOGS.slice(0, params.limit || 100).map((r) => LogRecordSchema.parse(r))
    }
    throw error
  }
}

export interface GetAuditLogsParams {
  actor?: string
  action?: string
  result?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export async function getAuditLogs(
  params: GetAuditLogsParams = {}
): Promise<{ items: AuditLogRecord[]; total: number }> {
  if (import.meta.env.VITE_MOCK === 'true') {
    let items = [...MOCK_AUDIT_LOGS]
    if (params.actor) {
      items = items.filter((a) => a.actor.toLowerCase().includes(params.actor!.toLowerCase()))
    }
    if (params.action) {
      items = items.filter((a) => a.action === params.action)
    }
    if (params.result) {
      items = items.filter((a) => a.result === params.result)
    }
    const offset = params.offset || 0
    const limit = params.limit || 50
    return {
      items: items.slice(offset, offset + limit).map((a) => AuditLogRecordSchema.parse(a)),
      total: items.length,
    }
  }

  try {
    const res = await apiClient.get<AuditLogRecord[]>('/audit-logs', { params })
    const total = parseInt(res.headers['x-total-count'] || String(res.data?.length || 0), 10)
    return {
      items: (res.data || []).map((a) => AuditLogRecordSchema.parse(a)),
      total,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      const offset = params.offset || 0
      const limit = params.limit || 50
      return {
        items: MOCK_AUDIT_LOGS.slice(offset, offset + limit).map((a) =>
          AuditLogRecordSchema.parse(a)
        ),
        total: MOCK_AUDIT_LOGS.length,
      }
    }
    throw error
  }
}
