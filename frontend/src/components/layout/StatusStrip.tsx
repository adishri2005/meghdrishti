import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { MOCK_SYSTEM_STATUS } from '@/mocks/fixtures'

interface StatusResponse {
  api: { status: string; version: string; color: string; uptime_seconds: number }
  postgres: { connected: boolean; status: string }
  redis: { connected: boolean; status: string; queue_lag: number; dlq_length: number }
  worker: { count: number; status: string }
  prometheus?: { status: string; reachable: boolean }
  grafana?: { status: string; reachable: boolean }
}

export function StatusStrip() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const { data: status } = useQuery<StatusResponse>({
    queryKey: ['system-status'],
    queryFn: async () => {
      try {
        const res = await axios.get('/api/v1/system/status', {
          withCredentials: true,
          headers: { 'X-Requested-With': 'CostGuard' },
        })
        return res.data
      } catch {
        return MOCK_SYSTEM_STATUS
      }
    },
    refetchInterval: 10000,
  })

  const current = status || MOCK_SYSTEM_STATUS

  const getDot = (isUp: boolean, isWarning?: boolean) => {
    if (!isUp) return <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
    if (isWarning) return <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
    return <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
  }

  if (collapsed) {
    return (
      <div className="border-b border-border bg-surface/40 px-3 py-0.5 flex justify-end">
        <button
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 text-[10px] flex items-center gap-1"
          title="Expand status strip"
          aria-label="Expand status strip"
        >
          <span className="font-mono">Status</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-border bg-surface/50 backdrop-blur-xs px-3.5 py-1 text-xs select-none transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
            System
          </span>

          {/* API */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title={`API Version ${current.api?.version} (${current.api?.color})`}
          >
            {getDot(current.api?.status === 'ok')}
            <span>API</span>
            <span className="text-[10px] font-mono px-1 rounded bg-muted/60 text-muted-foreground uppercase">
              {current.api?.color}
            </span>
          </button>

          {/* PostgreSQL */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          >
            {getDot(current.postgres?.connected)}
            <span>Postgres</span>
          </button>

          {/* Redis */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title={`Queue Lag: ${current.redis?.queue_lag || 0}, DLQ: ${current.redis?.dlq_length || 0}`}
          >
            {getDot(current.redis?.connected, (current.redis?.queue_lag || 0) > 100)}
            <span>Redis</span>
            {(current.redis?.queue_lag || 0) > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                lag:{current.redis?.queue_lag}
              </span>
            )}
          </button>

          {/* Worker */}
          <button
            onClick={() => navigate('/monitoring/targets')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          >
            {getDot(current.worker?.status === 'up' && (current.worker?.count || 0) > 0)}
            <span>Workers ({current.worker?.count || 1})</span>
          </button>

          {/* Prometheus */}
          <button
            onClick={() => navigate('/monitoring/prometheus')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          >
            {getDot(current.prometheus?.reachable ?? true)}
            <span>Prometheus</span>
          </button>

          {/* Grafana */}
          <button
            onClick={() => navigate('/monitoring/grafana')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          >
            {getDot(current.grafana?.reachable ?? true)}
            <span>Grafana</span>
          </button>
        </div>

        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
          title="Collapse status strip"
          aria-label="Collapse status strip"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
