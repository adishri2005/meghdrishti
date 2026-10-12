import { useState, type ReactNode } from 'react'
import { Table, BarChart2, Download, Maximize2, Minimize2, ExternalLink } from 'lucide-react'
import { ErrorState } from '@/components/data/ErrorState'
import { EmptyState } from '@/components/data/EmptyState'
import { SkeletonCard } from '@/components/data/SkeletonCard'

export interface TableRowData {
  time?: string
  [key: string]: string | number | undefined
}

interface ChartCardProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  action?: ReactNode
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  isEmpty?: boolean
  emptyMessage?: string
  tableData?: TableRowData[]
  tableColumns?: { key: string; label: string }[]
  onDownloadCsv?: () => void
  externalUrl?: string
  externalLabel?: string
  className?: string
  children: ReactNode
}

export function ChartCard({
  title,
  subtitle,
  badge,
  action,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to fetch metric data',
  onRetry,
  isEmpty = false,
  emptyMessage = 'No samples recorded for the selected window. Run the simulator to produce cost data.',
  tableData,
  tableColumns,
  onDownloadCsv,
  externalUrl,
  externalLabel,
  className = '',
  children,
}: ChartCardProps) {
  const [viewAsTable, setViewAsTable] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleDownloadCsv = () => {
    if (onDownloadCsv) {
      onDownloadCsv()
      return
    }

    if (!tableData || tableData.length === 0 || !tableColumns) return

    const header = tableColumns.map((c) => `"${c.label}"`).join(',')
    const rows = tableData.map((row) =>
      tableColumns.map((c) => `"${row[c.key] ?? ''}"`).join(',')
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_data.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div
      className={`rounded-xl border border-border bg-surface flex flex-col relative transition-all shadow-xs ${
        isFullscreen
          ? 'fixed inset-4 z-50 shadow-2xl bg-surface p-5 overflow-hidden'
          : 'p-4'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight truncate">
              {title}
            </h3>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {action}

          {/* View as Table Toggle */}
          {tableData && tableData.length > 0 && (
            <button
              onClick={() => setViewAsTable(!viewAsTable)}
              type="button"
              className={`p-1.5 rounded-md border border-border text-xs transition-colors shadow-xs ${
                viewAsTable
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
              title={viewAsTable ? 'View as chart' : 'View as table'}
              aria-label={viewAsTable ? 'View as chart' : 'View as table'}
            >
              {viewAsTable ? (
                <BarChart2 className="w-3.5 h-3.5" />
              ) : (
                <Table className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* CSV Download */}
          {tableData && tableData.length > 0 && (
            <button
              onClick={handleDownloadCsv}
              type="button"
              className="p-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shadow-xs"
              title="Download CSV"
              aria-label="Download CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* External link */}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors inline-flex items-center shadow-xs"
              title={externalLabel || 'Open in external dashboard'}
              aria-label={externalLabel || 'Open in external dashboard'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            type="button"
            className="p-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shadow-xs"
            title={isFullscreen ? 'Exit fullscreen' : 'Expand chart'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand chart'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-[200px] relative">
        {isLoading ? (
          <SkeletonCard className="w-full h-full min-h-[200px]" />
        ) : isError ? (
          <ErrorState
            title="Unable to load chart metrics"
            message={errorMessage}
            onRetry={onRetry}
            className="h-full min-h-[200px]"
          />
        ) : isEmpty ? (
          <EmptyState
            title="No chart data"
            description={emptyMessage}
            className="h-full min-h-[200px]"
          />
        ) : viewAsTable && tableData && tableColumns ? (
          <div className="overflow-x-auto max-h-[360px] rounded-md border border-border">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-surface-elevated text-muted-foreground font-mono sticky top-0 border-b border-border">
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col.key} className="px-3 py-2 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {tableData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    {tableColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-foreground">
                        {row[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
