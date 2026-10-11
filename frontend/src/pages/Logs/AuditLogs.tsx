import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
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
  const [pageSize, setPageSize] = useState<number>(25)
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

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Security & Audit Trail
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable log of state-changing operations, administrative actions, and authorization decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
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
              className="h-8 w-44 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(0)
            }}
            className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act === 'ALL' ? 'All Actions' : act}
              </option>
            ))}
          </select>

          {/* Result Filter */}
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            {RESULTS.map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => {
                  setResultFilter(res)
                  setPage(0)
                }}
                className={`rounded px-2.5 py-1 font-medium capitalize transition-colors ${
                  resultFilter === res
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Total: <strong className="text-foreground">{total}</strong> audit entries
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface text-muted-foreground font-semibold select-none">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Client IP</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((row) => {
                  const isDenied = row.result === 'denied'
                  const isSuccess = row.result === 'success'

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedAudit(row)}
                      className={`hover:bg-surface/60 cursor-pointer transition-colors ${
                        isDenied ? 'bg-danger/5' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        <div className="text-foreground font-medium">
                          {formatRelativeTime(row.ts)}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/70">
                          {formatDateTime(row.ts)}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 font-mono text-xs text-foreground border border-border">
                          {row.actor}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {row.action}
                        </div>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {row.entity || '-'}{' '}
                        {row.entity_id && (
                          <span className="text-foreground">({row.entity_id})</span>
                        )}
                      </td>

                      {/* Result */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            isSuccess
                              ? 'bg-success/10 text-success border-success/30'
                              : isDenied
                              ? 'bg-danger/20 text-danger border-danger/40 animate-pulse'
                              : 'bg-warning/10 text-warning border-warning/30'
                          }`}
                        >
                          {isSuccess ? (
                            <FileCheck2 className="h-3 w-3" />
                          ) : (
                            <AlertOctagon className="h-3 w-3" />
                          )}
                          {row.result}
                        </span>
                      </td>

                      {/* Client IP */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {row.ip || '-'}
                      </td>

                      {/* Inspect Action */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAudit(row)
                          }}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <Info className="h-3 w-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No audit records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between border-t border-border bg-surface px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(0)
              }}
              className="rounded border border-border bg-background px-2 py-0.5 text-foreground outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Page <strong>{page + 1}</strong> of <strong>{totalPages || 1}</strong>
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded border border-border bg-background p-1 text-foreground hover:bg-surface disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border bg-background p-1 text-foreground hover:bg-surface disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Right Drawer */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-lg border-l border-border bg-card p-6 shadow-2xl flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Audit Record #{selectedAudit.id}</h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedAudit.action} by {selectedAudit.actor}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Action:</span>
                <div className="font-mono text-foreground font-semibold mt-0.5">
                  {selectedAudit.action}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Actor:</span>
                <div className="font-mono text-foreground font-semibold mt-0.5">
                  {selectedAudit.actor}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Result:</span>
                <div className="mt-0.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedAudit.result === 'success'
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/20 text-danger'
                    }`}
                  >
                    {selectedAudit.result}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Timestamp:</span>
                <div className="font-mono text-foreground mt-0.5">
                  {formatDateTime(selectedAudit.ts)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Entity:</span>
                <div className="font-mono text-foreground mt-0.5">
                  {selectedAudit.entity} ({selectedAudit.entity_id})
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">IP Address:</span>
                <div className="font-mono text-foreground mt-0.5">
                  {selectedAudit.ip || '-'}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Event Detail Payload
              </span>
              <JsonViewer data={selectedAudit.detail || {}} title="Audit Payload Details" maxHeight="450px" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
