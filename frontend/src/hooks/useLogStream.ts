import { useState, useEffect, useRef, useCallback } from 'react'
import { getAppLogs, type GetAppLogsParams } from '@/lib/api/endpoints/logs'
import { LogRecordSchema, type LogRecord } from '@/lib/api/types'

const MAX_LOG_BUFFER = 5000

interface UseLogStreamOptions {
  enabled?: boolean
  initialFilter?: GetAppLogsParams
}

export function useLogStream(options: UseLogStreamOptions = {}) {
  const { enabled = true, initialFilter = {} } = options

  const [logs, setLogs] = useState<LogRecord[]>([])
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isPollingFallback, setIsPollingFallback] = useState<boolean>(false)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [unreadCount, setUnreadCount] = useState<number>(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef<number>(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPausedRef = useRef<boolean>(isPaused)
  isPausedRef.current = isPaused

  const addLogEntries = useCallback((entries: LogRecord[]) => {
    if (entries.length === 0) return
    setLogs((prev) => {
      // Ring buffer up to MAX_LOG_BUFFER
      const combined = [...entries, ...prev]
      if (combined.length > MAX_LOG_BUFFER) {
        return combined.slice(0, MAX_LOG_BUFFER)
      }
      return combined
    })
    if (isPausedRef.current) {
      setUnreadCount((c) => c + entries.length)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    if (!enabled) return
    let active = true

    getAppLogs({ ...initialFilter, limit: 150 })
      .then((records) => {
        if (active) {
          setLogs(records)
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [enabled, initialFilter.level, initialFilter.event, initialFilter.q, initialFilter.request_id])

  // Setup SSE stream or fallback polling
  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      setIsConnected(false)
      return
    }

    let isSubscribed = true

    const startPollingFallback = () => {
      setIsPollingFallback(true)
      setIsConnected(true)
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

      pollingIntervalRef.current = setInterval(async () => {
        if (!isSubscribed || isPausedRef.current) return
        try {
          const fresh = await getAppLogs({ ...initialFilter, limit: 30 })
          addLogEntries(fresh)
        } catch {}
      }, 3000)
    }

    const connectSSE = () => {
      if (!isSubscribed) return
      if (import.meta.env.VITE_MOCK === 'true') {
        startPollingFallback()
        return
      }
      try {
        const streamUrl = '/api/v1/admin/logs/stream'
        const es = new EventSource(streamUrl, { withCredentials: true })
        eventSourceRef.current = es

        es.onopen = () => {
          if (!isSubscribed) return
          setIsConnected(true)
          setIsPollingFallback(false)
          retryCountRef.current = 0
        }

        es.onmessage = (event) => {
          if (!isSubscribed || isPausedRef.current) return
          try {
            const raw = JSON.parse(event.data)
            const record = LogRecordSchema.parse(raw)
            addLogEntries([record])
          } catch {
            // Raw text line fallback
            const record: LogRecord = {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              logger: 'ccad.system',
              event: 'stream_raw',
              message: event.data,
            }
            addLogEntries([record])
          }
        }

        es.onerror = () => {
          if (!isSubscribed) return
          es.close()
          eventSourceRef.current = null
          setIsConnected(false)

          retryCountRef.current += 1
          if (retryCountRef.current > 3) {
            // Switch to polling fallback
            startPollingFallback()
          } else {
            // Exponential backoff reconnect
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000)
            setTimeout(connectSSE, delay)
          }
        }
      } catch {
        startPollingFallback()
      }
    }

    connectSSE()

    return () => {
      isSubscribed = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [enabled, addLogEntries, initialFilter])

  const pause = useCallback(() => setIsPaused(true), [])
  const resume = useCallback(() => {
    setIsPaused(false)
    setUnreadCount(0)
  }, [])
  const clearLogs = useCallback(() => {
    setLogs([])
    setUnreadCount(0)
  }, [])
  const resetUnread = useCallback(() => setUnreadCount(0), [])

  return {
    logs,
    isConnected,
    isPollingFallback,
    isPaused,
    unreadCount,
    pause,
    resume,
    clearLogs,
    resetUnread,
  }
}
