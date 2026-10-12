import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  X,
  FileCheck2,
  AlertOctagon,
  Info,
} from 'lucide-react'
import { getAuditLogs } from '@/lib/api/endpoints/logs'
import { formatDateTime, formatRelativeTime } from '@/lib/format'
import { JsonViewer } from '@/components/data/JsonViewer'
import type { AuditLogRecord } from '@/lib/api/types'

const AUDIT_ACTIONS = [
  'ALL',
  'threshold_update',
  'simulate_spike',
  'anomaly_acknowledged',
  'anomaly_resolved',
  'login_success',
  'user_created',
]

const RESULTS = ['ALL', 'success', 'denied', 'error']

export default function AuditLogs() {
  const [actorFilter, setActorFilter] = useState<string>('')
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [resultFilter, setResultFilter] = useState<string>('ALL')
  const [page, setPage] = useState<number>(0)
  const [pageSize] = useState<number>(25)
  const [selectedAudit, setSelectedAudit] = useState<AuditLogRecord | null>(null)

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['audit-logs', actorFilter, actionFilter, resultFilter, page, pageSize],
    queryFn: () =>
      getAuditLogs({
        actor: actorFilter || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        result: resultFilter !== 'ALL' ? resultFilter : undefined,
        offset: page * pageSize,
        limit: pageSize,
      }),
    staleTime: 15000,
  })

  const items = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-success/10 text-success border border-success/25">
            <FileCheck2 className="w-3 h-3" />
            <span>Success</span>
          </span>
        )
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-danger/10 text-danger border border-danger/25">
            <AlertOctagon className="w-3 h-3" />
            <span>Denied</span>
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-warning/10 text-warning border border-warning/25">
            <Info className="w-3 h-3" />
            <span>Error</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase bg-muted text-muted-foreground border border-border">
            <span>{result}</span>
          </span>
        )
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Audit Logs
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
              <ShieldAlert className="w-3 h-3 text-muted-foreground" />
              <span>Immutable Ledger</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Security audit trail of state-changing operations and authorization decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Actor search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by actor..."
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value)
                setPage(0)
              }}
              className="h-7 w-40 sm:w-52 rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring focus:border-ring font-mono shadow-xs"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(0)
            }}
            className="h-7 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring shadow-xs"
          >
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act === 'ALL' ? 'All Actions' : act.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Result Filter */}
          <div className="flex rounded-md border border-border bg-muted/60 p-0.5 text-xs">
            {RESULTS.map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => {
                  setResultFilter(res)
                  setPage(0)
                }}
                className={`rounded px-2.5 py-0.5 font-medium capitalize transition-colors ${
                  resultFilter === res
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        <span className="text-muted-foreground font-mono text-xs">
          Showing <strong className="text-foreground">{items.length}</strong> / {total} entries
        </span>
      </div>

      {/* Main Audit Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-surface-elevated text-muted-foreground font-mono border-b border-border">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Timestamp</th>
                <th className="px-3.5 py-2.5 font-medium">Actor</th>
                <th className="px-3.5 py-2.5 font-medium">Action</th>
                <th className="px-3.5 py-2.5 font-medium">Target Resource</th>
                <th className="px-3.5 py-2.5 font-medium">Result</th>
                <th className="px-3.5 py-2.5 font-medium text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-3.5 py-2.5 h-10 bg-muted/20" />
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-12 text-center text-muted-foreground font-sans">
                    No audit records match the current filter parameters.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedAudit(log)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-3.5 py-2 text-muted-foreground whitespace-nowrap"
                      title={formatDateTime(log.ts || '')}
                    >
                      {formatRelativeTime(log.ts || '')}
                    </td>
                    <td className="px-3.5 py-2 font-medium text-foreground">
                      {log.actor}
                    </td>
                    <td className="px-3.5 py-2 text-foreground font-sans capitalize">
                      {log.action.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3.5 py-2 text-muted-foreground">
                      {log.entity_id || log.entity || '--'}
                    </td>
                    <td className="px-3.5 py-2">
                      {getResultBadge(log.result)}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <span className="text-[11px] text-muted-foreground underline underline-offset-2">
                        Inspect
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2.5 border-t border-border bg-surface flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono text-[11px]">
            Page {page + 1} of {Math.max(1, totalPages)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-muted/50 disabled:opacity-40 text-xs font-medium transition-colors shadow-xs"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-muted/50 disabled:opacity-40 text-xs font-medium transition-colors shadow-xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Detail Drawer / Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">
                  Audit Entry: {selectedAudit.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAudit(null)}
                type="button"
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Actor</span>
                <span className="font-medium text-foreground">{selectedAudit.actor}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium text-foreground">{selectedAudit.action}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Result</span>
                <div>{getResultBadge(selectedAudit.result)}</div>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Target Resource</span>
                <span className="text-foreground">{selectedAudit.entity_id || selectedAudit.entity || '--'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="text-foreground">{formatDateTime(selectedAudit.ts || '')}</span>
              </div>
            </div>

            {selectedAudit.detail && (
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-muted-foreground uppercase">Payload Details</span>
                <JsonViewer data={selectedAudit.detail} />
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedAudit(null)}
                type="button"
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-muted text-foreground border border-border transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
