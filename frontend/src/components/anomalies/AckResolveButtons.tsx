import { useState } from 'react'
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { acknowledgeAnomaly, resolveAnomaly } from '@/lib/api/endpoints/anomalies'
import { useQueryClient } from '@tanstack/react-query'

interface AckResolveButtonsProps {
  anomalyId: string
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored'
  onSuccess?: () => void
  className?: string
}

export function AckResolveButtons({
  anomalyId,
  status,
  onSuccess,
  className = '',
}: AckResolveButtonsProps) {
  const queryClient = useQueryClient()
  const [isAcking, setIsAcking] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false)

  const handleAcknowledge = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAcking(true)
    try {
      await acknowledgeAnomaly(anomalyId)
      toast.success('Anomaly marked as acknowledged', { duration: 2000 })
      queryClient.invalidateQueries({ queryKey: ['anomalies'] })
      queryClient.invalidateQueries({ queryKey: ['stats', 'overview'] })
      onSuccess?.()
    } catch {
      toast.error('Failed to acknowledge anomaly')
    } finally {
      setIsAcking(false)
    }
  }

  const handleResolve = async () => {
    setIsResolving(true)
    try {
      await resolveAnomaly(anomalyId)
      toast.success('Anomaly resolved and baseline recalibrated', { duration: 2000 })
      setResolveConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['anomalies'] })
      queryClient.invalidateQueries({ queryKey: ['stats', 'overview'] })
      onSuccess?.()
    } catch {
      toast.error('Failed to resolve anomaly')
    } finally {
      setIsResolving(false)
    }
  }

  if (status === 'resolved') {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-success font-medium font-mono ${className}`}>
        <CheckCircle2 className="w-4 h-4" />
        <span>Resolved</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {status === 'open' && (
        <button
          onClick={handleAcknowledge}
          disabled={isAcking}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span>{isAcking ? 'Acking...' : 'Acknowledge'}</span>
        </button>
      )}

      <button
        onClick={() => setResolveConfirmOpen(true)}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/15 hover:bg-success/25 text-success border border-success/30 transition-colors"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Resolve</span>
      </button>

      {/* Confirmation Dialog for Resolve */}
      {resolveConfirmOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50"
        >
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm Anomaly Resolution
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to mark this anomaly as resolved?
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-surface-elevated p-3 rounded-lg border border-border/60 leading-relaxed">
              Resolving flags the incident as mitigated in audit logs and will recalculate the expected expenditure baseline for future evaluation windows.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setResolveConfirmOpen(false)}
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isResolving ? 'Resolving...' : 'Confirm Resolve'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
