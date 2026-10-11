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
    bg: 'bg-danger/10',
    text: 'text-danger font-semibold',
    border: 'border-danger/30',
    dot: 'bg-danger',
  },
  high: {
    bg: 'bg-amber-500/10',
    text: 'text-orange-400 font-medium',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
  },
  medium: {
    bg: 'bg-warning/10',
    text: 'text-warning font-medium',
    border: 'border-warning/30',
    dot: 'bg-warning',
  },
  low: {
    bg: 'bg-info/10',
    text: 'text-info font-normal',
    border: 'border-info/30',
    dot: 'bg-info',
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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider border select-none ${style.bg} ${style.text} ${style.border} ${
        isCritical ? 'shadow-[0_0_12px_rgba(244,63,94,0.25)]' : ''
      } ${className}`}
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
