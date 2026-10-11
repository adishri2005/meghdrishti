import { CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, Clock } from 'lucide-react'
import { formatDateTime, formatRelativeTime, formatDuration } from '@/lib/format'
import type { DeploymentRecord } from '@/lib/api/types'

interface DeploymentTimelineProps {
  deployments: DeploymentRecord[]
  selectedId?: string
  onSelectDeployment: (deployment: DeploymentRecord) => void
}

export function DeploymentTimeline({
  deployments,
  selectedId,
  onSelectDeployment,
}: DeploymentTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Deployment & Rollback History
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {deployments.length} releases recorded
        </span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {deployments.map((d) => {
          const isSelected = selectedId === d.id
          const isRolledBack = d.status === 'rolled_back'
          const isFailed = d.status === 'failed'
          const isActive = d.status === 'active'
          const isBlue = d.color === 'blue'

          // Compute time-to-rollback if both activated_at and rolled_back_at exist
          let ttrSec: number | null = null
          if (d.activated_at && d.rolled_back_at) {
            const actMs = new Date(d.activated_at).getTime()
            const rbMs = new Date(d.rolled_back_at).getTime()
            ttrSec = Math.max(0, Math.round((rbMs - actMs) / 1000))
          }

          return (
            <div
              key={d.id}
              onClick={() => onSelectDeployment(d)}
              className={`relative group rounded-xl border p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/40'
                  : isRolledBack
                  ? 'border-danger/40 bg-danger/5 hover:border-danger'
                  : 'border-border bg-card hover:bg-surface hover:border-border-strong'
              }`}
            >
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-[31px] top-4.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background ${
                  isRolledBack
                    ? 'border-danger text-danger bg-danger/10'
                    : isActive
                    ? 'border-success text-success bg-success/10'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                {isRolledBack ? (
                  <RotateCcw className="h-3 w-3" />
                ) : isFailed ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
              </div>

              {/* Deployment Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {d.version}
                  </span>

                  {/* Color Badge */}
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                      isBlue
                        ? 'bg-info/10 text-info border border-info/30'
                        : 'bg-success/10 text-success border border-success/30'
                    }`}
                  >
                    {d.color}
                  </span>

                  {/* Status Badge */}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      isRolledBack
                        ? 'bg-danger/20 text-danger border-danger/40'
                        : isActive
                        ? 'bg-success/20 text-success border-success/40'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {d.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground font-mono">
                  {formatRelativeTime(d.deployed_at)}
                </div>
              </div>

              {/* Note / Rationale */}
              {d.note && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {d.note}
                </p>
              )}

              {/* Metadata strip */}
              <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  <span>Deployed: {formatDateTime(d.deployed_at)}</span>
                  {d.activated_at && <span>Cutover: {formatDateTime(d.activated_at)}</span>}
                  {d.rolled_back_at && (
                    <span className="text-danger font-semibold">
                      Rolled back: {formatDateTime(d.rolled_back_at)}
                    </span>
                  )}
                </div>

                {ttrSec !== null && (
                  <div className="inline-flex items-center gap-1.5 rounded bg-danger/10 px-2 py-0.5 font-mono text-xs font-bold text-danger">
                    <RotateCcw className="h-3 w-3" />
                    <span>Time to Rollback: {formatDuration(ttrSec)}</span>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                  <span>{isSelected ? 'Viewing Impact Metrics' : 'Inspect Impact'}</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
