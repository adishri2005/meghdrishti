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
    if (!isUp) return <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
    if (isWarning) return <span className="w-2 h-2 rounded-full bg-warning" />
    return <span className="w-2 h-2 rounded-full bg-success" />
  }

  return (
    <div className="border-b border-border/80 bg-surface/60 backdrop-blur-sm px-4 py-1.5 transition-all text-xs">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
            Status
          </span>

          {/* API */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
            title={`API Version ${current.api?.version} (${current.api?.color})`}
          >
            {getDot(current.api?.status === 'ok')}
            <span className="text-foreground font-mono">API ({current.api?.color})</span>
          </button>

          {/* PostgreSQL */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
          >
            {getDot(current.postgres?.connected)}
            <span className="text-foreground">Postgres</span>
          </button>

          {/* Redis */}
          <button
            onClick={() => navigate('/monitoring/native')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
            title={`Queue Lag: ${current.redis?.queue_lag || 0}, DLQ: ${current.redis?.dlq_length || 0}`}
          >
            {getDot(current.redis?.connected, (current.redis?.queue_lag || 0) > 100)}
            <span className="text-foreground">Redis</span>
            {(current.redis?.queue_lag || 0) > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                lag:{current.redis?.queue_lag}
              </span>
            )}
          </button>

          {/* Worker */}
          <button
            onClick={() => navigate('/monitoring/targets')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
          >
            {getDot(current.worker?.status === 'up' && (current.worker?.count || 0) > 0)}
            <span className="text-foreground">Worker ({current.worker?.count || 1})</span>
          </button>

          {/* Prometheus */}
          <button
            onClick={() => navigate('/monitoring/prometheus')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
          >
            {getDot(current.prometheus?.reachable ?? true)}
            <span className="text-foreground">Prometheus</span>
          </button>

          {/* Grafana */}
          <button
            onClick={() => navigate('/monitoring/grafana')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors shrink-0"
          >
            {getDot(current.grafana?.reachable ?? true)}
            <span className="text-foreground">Grafana</span>
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title={collapsed ? 'Expand status' : 'Collapse status'}
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
