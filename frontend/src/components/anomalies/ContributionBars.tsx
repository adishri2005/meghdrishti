import { formatCurrency, formatPercent } from '@/lib/format'

export interface Contributor {
  resource_id: string
  share_pct: number
  delta_cost: number
  observed_cost: number
}

interface ContributionBarsProps {
  contributors: Contributor[]
  onResourceClick?: (resourceId: string) => void
  className?: string
}

export function ContributionBars({
  contributors = [],
  onResourceClick,
  className = '',
}: ContributionBarsProps) {
  if (contributors.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Single-resource root cause; no sub-resource variance detected.
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pb-1 border-b border-border/50">
        <span>Resource Contributor</span>
        <div className="flex items-center gap-4">
          <span>Cost Delta</span>
          <span>Share</span>
        </div>
      </div>

      {contributors.slice(0, 5).map((c, i) => (
        <div
          key={c.resource_id}
          onClick={() => onResourceClick?.(c.resource_id)}
          className="group cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground w-3.5">
                #{i + 1}
              </span>
              <span className="font-mono font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {c.resource_id}
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono text-xs shrink-0 ml-2">
              <span className="text-danger font-semibold">
                +{formatCurrency(c.delta_cost)}
              </span>
              <span className="text-muted-foreground w-12 text-right">
                {formatPercent(c.share_pct)}
              </span>
            </div>
          </div>

          <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-danger/80 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, c.share_pct))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
