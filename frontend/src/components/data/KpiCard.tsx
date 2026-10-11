import { type ReactNode, useEffect, useState } from 'react'
import { Sparkline } from '@/components/charts/Sparkline'
import { TrendDelta } from './TrendDelta'
import { SkeletonCard } from './SkeletonCard'
import { AlertCircle } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  trendDelta?: number | null
  reverseTrendColor?: boolean
  trendSuffix?: string
  sparklineData?: number[]
  sparklineColor?: string
  badge?: ReactNode
  icon?: ReactNode
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  className?: string
  onClick?: () => void
}

export function KpiCard({
  label,
  value,
  unit,
  trendDelta,
  reverseTrendColor = false,
  trendSuffix = 'vs prior 24h',
  sparklineData,
  sparklineColor = '#2DD4BF',
  badge,
  icon,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load metric',
  onRetry,
  className = '',
  onClick,
}: KpiCardProps) {
  // Count-up display animation for numeric values
  const [displayValue, setDisplayValue] = useState<string | number>(value)

  useEffect(() => {
    if (typeof value === 'number') {
      const start = typeof displayValue === 'number' ? displayValue : 0
      const duration = 600
      const startTime = performance.now()

      const animate = (time: number) => {
        const elapsed = time - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = 1 - Math.pow(1 - progress, 3)
        const current = start + (value - start) * easeProgress

        if (progress < 1) {
          setDisplayValue(
            Number.isInteger(value) ? Math.round(current) : parseFloat(current.toFixed(2))
          )
          requestAnimationFrame(animate)
        } else {
          setDisplayValue(value)
        }
      }

      requestAnimationFrame(animate)
    } else {
      setDisplayValue(value)
    }
  }, [value])

  if (isLoading) {
    return <SkeletonCard className={`h-[120px] ${className}`} />
  }

  if (isError) {
    return (
      <div
        className={`p-4 rounded-xl border border-danger/30 bg-danger/5 flex flex-col justify-between h-[120px] ${className}`}
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span>
          <AlertCircle className="w-4 h-4 text-danger" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-danger font-mono truncate">{errorMessage}</div>
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRetry()
              }}
              type="button"
              className="text-[11px] underline text-muted-foreground hover:text-foreground shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-all flex flex-col justify-between h-[120px] relative overflow-hidden group ${
        onClick ? 'cursor-pointer hover:bg-surface-elevated/80' : ''
      } ${className}`}
    >
      {/* Top Header: Label & Icon/Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
      </div>

      {/* Middle: Big Metric Value & Sparkline */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight tabular-nums truncate">
            {displayValue}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground font-mono font-medium">
              {unit}
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            width={84}
            height={26}
          />
        )}
      </div>

      {/* Bottom: Trend Delta */}
      <div className="flex items-center justify-between text-xs min-h-[18px]">
        {trendDelta !== undefined && (
          <TrendDelta
            value={trendDelta}
            reverseColor={reverseTrendColor}
            suffix={trendSuffix}
          />
        )}
      </div>
    </div>
  )
}
