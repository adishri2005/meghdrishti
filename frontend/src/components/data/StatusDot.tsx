export type StatusDotVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusDotProps {
  status: StatusDotVariant
  pulse?: boolean
  className?: string
  title?: string
}

const STATUS_COLORS: Record<StatusDotVariant, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
}

export function StatusDot({
  status,
  pulse = false,
  className = '',
  title,
}: StatusDotProps) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.neutral

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      title={title}
    >
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  )
}
