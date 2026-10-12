export type Severity = 'critical' | 'high' | 'medium' | 'low'

interface SeverityBadgeProps {
  severity: Severity | string
  className?: string
  showDot?: boolean
}

const SEVERITY_STYLES: Record<
  Severity,
  { bg: string; text: string; border: string; dot: string }
> = {
  critical: {
    bg: 'bg-severity-critical/10',
    text: 'text-severity-critical font-medium',
    border: 'border-severity-critical/25',
    dot: 'bg-severity-critical',
  },
  high: {
    bg: 'bg-severity-high/10',
    text: 'text-severity-high font-medium',
    border: 'border-severity-high/25',
    dot: 'bg-severity-high',
  },
  medium: {
    bg: 'bg-severity-medium/10',
    text: 'text-severity-medium font-medium',
    border: 'border-severity-medium/25',
    dot: 'bg-severity-medium',
  },
  low: {
    bg: 'bg-severity-low/10',
    text: 'text-severity-low font-normal',
    border: 'border-severity-low/25',
    dot: 'bg-severity-low',
  },
}

export function SeverityBadge({
  severity,
  className = '',
  showDot = true,
}: SeverityBadgeProps) {
  const normalized = (severity.toLowerCase() as Severity) in SEVERITY_STYLES
    ? (severity.toLowerCase() as Severity)
    : 'low'

  const style = SEVERITY_STYLES[normalized]
  const isCritical = normalized === 'critical'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border select-none ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          {isCritical && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${style.dot}`} />
        </span>
      )}
      {normalized}
    </span>
  )
}
