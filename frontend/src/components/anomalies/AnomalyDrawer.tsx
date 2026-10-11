import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Share2,
  ExternalLink,
  FileText,
  Clock,
  TrendingUp,
  Percent,
  Bell,
} from 'lucide-react'
import { toast } from 'sonner'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { StatusDot } from '@/components/data/StatusDot'
import { CopyButton } from '@/components/data/CopyButton'
import { AnomalyTimelineChart } from './AnomalyTimelineChart'
import { RootCauseBreakdown } from './RootCauseBreakdown'
import { AckResolveButtons } from './AckResolveButtons'
import { formatCurrency, formatPercent, formatRelativeTime } from '@/lib/format'
import type { Anomaly } from '@/lib/api/types'

interface AnomalyDrawerProps {
  anomaly: Anomaly | null
  isOpen: boolean
  onClose: () => void
}

export function AnomalyDrawer({ anomaly, isOpen, onClose }: AnomalyDrawerProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !anomaly) return null

  const handleCopyLink = () => {
    const url = `${window.location.origin}/anomalies/${anomaly.id}`
    navigator.clipboard.writeText(url)
    toast.success('Shareable link copied to clipboard', { duration: 1500 })
  }

  const handleViewLogs = () => {
    navigate(`/logs/app?q=${encodeURIComponent(anomaly.resource_id)}`)
    onClose()
  }

  const handleOpenResource = () => {
    navigate(`/resources/${encodeURIComponent(anomaly.resource_id)}`)
    onClose()
  }

  const pctIncrease =
    anomaly.expected_cost > 0
      ? ((anomaly.actual_cost - anomaly.expected_cost) / anomaly.expected_cost) * 100
      : 100

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-border flex items-center justify-between gap-4 bg-surface-elevated/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <SeverityBadge severity={anomaly.severity} />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-sm font-bold text-foreground truncate">
                {anomaly.resource_id}
              </span>
              <CopyButton value={anomaly.resource_id} label="Resource ID" />
            </div>
            <StatusDot
              status={
                anomaly.status === 'resolved'
                  ? 'success'
                  : anomaly.status === 'acknowledged'
                  ? 'warning'
                  : 'danger'
              }
              pulse={anomaly.status === 'open' && anomaly.severity === 'critical'}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopyLink}
              type="button"
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Copy shareable incident link"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-elevated p-3 rounded-lg border border-border/70 font-mono">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Detected: {formatRelativeTime(anomaly.detected_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Detection Method:</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-foreground uppercase font-semibold text-[10px]">
                {anomaly.anomaly_type.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg border border-border bg-surface-elevated/40">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Observed Cost
              </span>
              <div className="text-base font-bold font-mono text-danger mt-0.5">
                {formatCurrency(anomaly.actual_cost)}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/40">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Expected Baseline
              </span>
              <div className="text-base font-bold font-mono text-foreground mt-0.5">
                {formatCurrency(anomaly.expected_cost)}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/40">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Z-Score
              </span>
              <div className="text-base font-bold font-mono text-warning mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{anomaly.z_score.toFixed(1)}σ</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/40">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">
                Cost Spike
              </span>
              <div className="text-base font-bold font-mono text-danger mt-0.5 flex items-center gap-0.5">
                <Percent className="w-3.5 h-3.5" />
                <span>+{formatPercent(pctIncrease)}</span>
              </div>
            </div>
          </div>

          {/* Expected Band Chart */}
          <div className="rounded-xl border border-border p-4 bg-surface-elevated/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-foreground">
                Expected Baseline Confidence Band (±3σ)
              </h4>
              <span className="text-[10px] font-mono text-muted-foreground">
                Hourly Variance
              </span>
            </div>
            <AnomalyTimelineChart
              anomalyId={anomaly.id}
              detectedAt={anomaly.detected_at}
              expectedCost={anomaly.expected_cost}
              actualCost={anomaly.actual_cost}
              height={220}
            />
          </div>

          {/* Root Cause Intelligence Breakdown */}
          <RootCauseBreakdown
            resourceName={anomaly.resource_id}
            rootCause={{
              summary: anomaly.root_cause_summary,
              breakdown_by_team: { ml: 58, platform: 26, data: 16 },
              breakdown_by_service: { compute: 65, database: 35 },
              breakdown_by_region: { 'us-east-1': 75, 'eu-west-1': 25 },
              top_contributors: [
                {
                  resource_id: anomaly.resource_id,
                  share_pct: 64,
                  delta_cost: anomaly.actual_cost - anomaly.expected_cost,
                  observed_cost: anomaly.actual_cost,
                },
                {
                  resource_id: 'rds-core-pg-replica-02',
                  share_pct: 22,
                  delta_cost: (anomaly.actual_cost - anomaly.expected_cost) * 0.35,
                  observed_cost: 84.5,
                },
              ],
            }}
            onResourceClick={(id) => {
              navigate(`/resources/${encodeURIComponent(id)}`)
              onClose()
            }}
          />

          {/* Related Alerts & Delivery Status */}
          <div className="rounded-xl border border-border p-4 bg-surface-elevated/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span>Related Prometheus Alerts & Webhooks</span>
              </div>
              <span className="text-[10px] font-mono text-success">
                2 Fired / 2 Delivered
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="p-2 rounded bg-surface border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                  <span className="font-semibold text-danger">CostAnomalyHighSpike</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Slack #finops-alerts (Delivered)</span>
              </div>

              <div className="p-2 rounded bg-surface border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <span className="font-semibold text-warning">BudgetThresholdExceeded</span>
                </div>
                <span className="text-[11px] text-muted-foreground">PagerDuty Incident #9182</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-elevated/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenResource}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Inspect Resource</span>
            </button>

            <button
              onClick={handleViewLogs}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>View Logs</span>
            </button>
          </div>

          <AckResolveButtons
            anomalyId={anomaly.id}
            status={anomaly.status}
            onSuccess={onClose}
          />
        </div>
      </div>
    </div>
  )
}
