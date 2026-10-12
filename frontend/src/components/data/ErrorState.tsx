import { AlertTriangle, RefreshCw } from 'lucide-react'
import { CopyButton } from './CopyButton'

interface ErrorStateProps {
  title?: string
  message?: string
  requestId?: string
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while fetching information.',
  requestId,
  onRetry,
  isRetrying = false,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center rounded-lg border border-danger/20 bg-danger/5 ${className}`}
    >
      <div className="w-8 h-8 rounded-md bg-danger/10 text-danger flex items-center justify-center mb-2.5">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <h3 className="text-xs font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mb-3 leading-relaxed">{message}</p>

      {requestId && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-surface px-2.5 py-1 rounded-md border border-border mb-3">
          <span>Req ID: {requestId}</span>
          <CopyButton value={requestId} label="Request ID" />
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-muted/50 text-foreground border border-border shadow-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
        </button>
      )}
    </div>
  )
}
