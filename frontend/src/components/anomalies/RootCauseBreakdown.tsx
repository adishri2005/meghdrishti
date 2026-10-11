import { Sparkles, Server, Tag, MapPin } from 'lucide-react'
import { ContributionBars, type Contributor } from './ContributionBars'
import { formatPercent } from '@/lib/format'

export interface RootCauseData {
  summary?: string | null
  breakdown_by_team?: Record<string, number>
  breakdown_by_service?: Record<string, number>
  breakdown_by_region?: Record<string, number>
  top_contributors?: Contributor[]
}

interface RootCauseBreakdownProps {
  rootCause?: RootCauseData | null
  resourceName: string
  onResourceClick?: (resourceId: string) => void
  className?: string
}

export function RootCauseBreakdown({
  rootCause,
  resourceName,
  onResourceClick,
  className = '',
}: RootCauseBreakdownProps) {
  const summary =
    rootCause?.summary ||
    `Statistical cost outlier detected on ${resourceName}. Hourly spend exceeded 3-standard-deviation confidence band with elevated request rate.`

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Narrative Callout Card */}
      <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Root Cause Intelligence</span>
        </div>
        <p className="text-xs text-foreground leading-relaxed font-sans">
          {summary}
        </p>
      </div>

      {/* 2. Group Distribution Tags (Team, Service, Region) */}
      {(rootCause?.breakdown_by_team || rootCause?.breakdown_by_service || rootCause?.breakdown_by_region) && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* Dominant Team */}
          {rootCause.breakdown_by_team && (
            <div className="p-2 rounded-lg bg-surface-elevated border border-border">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                <Tag className="w-3 h-3 text-primary" />
                <span>Team Share</span>
              </div>
              {Object.entries(rootCause.breakdown_by_team).slice(0, 1).map(([team, pct]) => (
                <div key={team} className="font-mono font-medium text-foreground truncate">
                  <span className="capitalize">{team}</span>: <b className="text-primary">{formatPercent(pct)}</b>
                </div>
              ))}
            </div>
          )}

          {/* Dominant Service */}
          {rootCause.breakdown_by_service && (
            <div className="p-2 rounded-lg bg-surface-elevated border border-border">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                <Server className="w-3 h-3 text-sky-400" />
                <span>Service</span>
              </div>
              {Object.entries(rootCause.breakdown_by_service).slice(0, 1).map(([svc, pct]) => (
                <div key={svc} className="font-mono font-medium text-foreground truncate">
                  <span className="capitalize">{svc}</span>: <b className="text-sky-400">{formatPercent(pct)}</b>
                </div>
              ))}
            </div>
          )}

          {/* Dominant Region */}
          {rootCause.breakdown_by_region && (
            <div className="p-2 rounded-lg bg-surface-elevated border border-border">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>Region</span>
              </div>
              {Object.entries(rootCause.breakdown_by_region).slice(0, 1).map(([reg, pct]) => (
                <div key={reg} className="font-mono font-medium text-foreground truncate">
                  <span>{reg}</span>: <b className="text-amber-400">{formatPercent(pct)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Top Contributors */}
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">
          Top Cost Contributors
        </h4>
        <ContributionBars
          contributors={rootCause?.top_contributors || []}
          onResourceClick={onResourceClick}
        />
      </div>
    </div>
  )
}
