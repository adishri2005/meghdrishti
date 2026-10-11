import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatPercent } from '@/lib/format'

interface TrendDeltaProps {
  value: number | null | undefined
  reverseColor?: boolean // If true, positive is bad (danger/red), negative is good (success/green), e.g. for cost
  suffix?: string
  className?: string
}

export function TrendDelta({
  value,
  reverseColor = false,
  suffix = 'vs prior 24h',
  className = '',
}: TrendDeltaProps) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className={`text-xs text-muted-foreground ${className}`}>-</span>
  }

  const isZero = Math.abs(value) < 0.05
  const isPositive = value > 0

  let colorClass = 'text-muted-foreground'
  if (!isZero) {
    if (reverseColor) {
      colorClass = isPositive ? 'text-danger' : 'text-success'
    } else {
      colorClass = isPositive ? 'text-success' : 'text-danger'
    }
  }

  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-mono font-medium ${colorClass} ${className}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{formatPercent(value, { includeSign: true })}</span>
      {suffix && <span className="text-muted-foreground font-sans font-normal ml-0.5">{suffix}</span>}
    </div>
  )
}
