import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, SlidersHorizontal } from 'lucide-react'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { CopyButton } from '@/components/data/CopyButton'
import { AckResolveButtons } from './AckResolveButtons'
import { formatCurrency, formatRelativeTime, formatDateTime } from '@/lib/format'
import type { Anomaly } from '@/lib/api/types'

interface AnomalyTableProps {
  data: Anomaly[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectAnomaly: (anomaly: Anomaly) => void
  isLoading?: boolean
}

export function AnomalyTable({
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectAnomaly,
  isLoading = false,
}: AnomalyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'detected_at', desc: true },
  ])
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  const columns = useMemo<ColumnDef<Anomaly>[]>(
    () => [
      {
        accessorKey: 'severity',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            type="button"
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Severity</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        accessorKey: 'resource_id',
        header: 'Resource',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
            <span className="truncate max-w-[180px]">{row.original.resource_id}</span>
            <CopyButton value={row.original.resource_id} label="Resource ID" iconSize="w-3 h-3" />
          </div>
        ),
      },
      {
        accessorKey: 'anomaly_type',
        header: 'Method / Scope',
        cell: ({ row }) => (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground uppercase font-medium">
            {(row.original.anomaly_type || 'Anomaly').replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        id: 'cost_delta',
        header: 'Observed vs Expected',
        cell: ({ row }) => {
          const actual = row.original.actual_cost
          const expected = row.original.expected_cost
          const delta = actual - expected
          const pct = expected > 0 ? (delta / expected) * 100 : 100

          return (
            <div className="space-y-1 font-mono text-xs min-w-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-danger font-semibold">{formatCurrency(actual)}</span>
                <span className="text-muted-foreground text-[11px]">({formatCurrency(expected)})</span>
              </div>
              <div className="h-1 w-full bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-danger rounded-full"
                  style={{ width: `${Math.min(100, Math.max(10, pct))}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'z_score',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            type="button"
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Z-Score</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-warning">
            {row.original.z_score.toFixed(1)}σ
          </span>
        ),
      },
      {
        accessorKey: 'detected_at',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            type="button"
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <span>Detected At</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className="font-mono text-xs text-muted-foreground"
            title={formatDateTime(row.original.detected_at)}
          >
            {formatRelativeTime(row.original.detected_at)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status
          return (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase border ${
                status === 'resolved'
                  ? 'bg-success/10 text-success border-success/30'
                  : status === 'acknowledged'
                  ? 'bg-warning/10 text-warning border-warning/30'
                  : 'bg-danger/10 text-danger border-danger/30'
              }`}
            >
              {status}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <AckResolveButtons
              anomalyId={row.original.id}
              status={row.original.status}
            />
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  })

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-3">
      {/* Table controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-mono font-bold text-foreground">{data.length}</span> of{' '}
          <span className="font-mono font-bold text-foreground">{totalCount}</span> incidents
        </div>

        <div className="flex items-center gap-2">
          {/* Row density toggle */}
          <button
            onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
            type="button"
            className="p-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors inline-flex items-center gap-1 text-[11px]"
            title="Toggle row density"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="capitalize">{density}</span>
          </button>

          {/* Page size selector */}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-surface-elevated border border-border rounded-lg px-2 py-1 text-xs text-foreground font-mono focus:outline-hidden"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Table container */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-surface-elevated text-muted-foreground font-mono border-b border-border sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={columns.length} className="px-4 py-3 h-12 bg-muted/20" />
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No anomalies found matching current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onSelectAnomaly(row.original)}
                    className={`hover:bg-surface-elevated/80 cursor-pointer transition-colors ${
                      density === 'compact' ? 'py-1.5' : 'py-3'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-4 ${
                          density === 'compact' ? 'py-2' : 'py-3'
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-3 border-t border-border bg-surface-elevated/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono text-[11px]">
            Page {page} of {totalPages}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-elevated disabled:opacity-40 text-xs font-medium transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-elevated disabled:opacity-40 text-xs font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
