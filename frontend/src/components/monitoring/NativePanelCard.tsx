import { useState, useMemo } from 'react'
import {
  MoreVertical,
  Terminal,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  LineChart as ChartIcon,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { SkeletonCard } from '@/components/data/SkeletonCard'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { usePromRange } from '@/hooks/useProm'
import { formatTimestamp, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import type { DeploymentRecord } from '@/lib/api/types'

interface NativePanelCardProps {
  title: string
  query: string
  description?: string
  unit?: string
  color?: string
  stacked?: boolean
  chartType?: 'line' | 'area' | 'bar'
  deployments?: DeploymentRecord[]
  onOpenPrometheus?: (expr: string) => void
  onOpenGrafana?: () => void
  className?: string
}

export function NativePanelCard({
  title,
  query,
  description,
  unit = '',
  color = '#38BDF8',
  deployments = [],
  onOpenPrometheus,
  onOpenGrafana,
  className = '',
}: NativePanelCardProps) {
  const [showQuery, setShowQuery] = useState(false)
  const [viewTable, setViewTable] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const {
    series,
    rawData,
    isLoading,
    isError,
    error,
    refetch,
  } = usePromRange(query)

  // Build deployment event markers
  const deploymentEvents = useMemo(() => {
    return deployments.map((d) => ({
      timeMs: new Date(d.deployed_at).getTime(),
      label: `${d.version} (${d.color})`,
      color: d.status === 'rolled_back' ? '#F43F5E' : d.color === 'green' ? '#22C55E' : '#38BDF8',
    }))
  }, [deployments])


  const latestMetricValue = useMemo(() => {
    if (!rawData || rawData.length === 0) return null
    const first = rawData[0]
    if (!first?.values?.length) return null
    const last = first.values[first.values.length - 1]
    const val = parseFloat(last[1])
    return isNaN(val) ? null : val
  }, [rawData])

  const formattedLatest = useMemo(() => {
    if (latestMetricValue === null) return '--'
    if (unit === '%') return `${latestMetricValue.toFixed(1)}%`
    if (unit === 's') {
      return latestMetricValue < 1
        ? `${Math.round(latestMetricValue * 1000)}ms`
        : `${latestMetricValue.toFixed(2)}s`
    }
    if (unit === 'ratio') return `${(latestMetricValue * 100).toFixed(1)}%`
    if (latestMetricValue >= 1000) return `${(latestMetricValue / 1000).toFixed(1)}k`
    if (Number.isInteger(latestMetricValue)) return `${latestMetricValue}`
    return latestMetricValue.toFixed(1)
  }, [latestMetricValue, unit])

  const downloadCsv = () => {
    if (!rawData || rawData.length === 0) {
      toast.error('No data available to download')
      return
    }

    const headers = ['Timestamp', 'Series', 'Value']
    const rows: string[] = [headers.join(',')]

    rawData.forEach((s) => {
      const name = s.metric?.job || s.metric?.__name__ || JSON.stringify(s.metric)
      s.values.forEach(([ts, val]) => {
        rows.push(`"${formatTimestamp(ts * 1000)}","${name}",${val}`)
      })
    })

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_data.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${title} CSV`)
  }

  return (
    <div
      className={`flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm hover:border-border-strong/70 transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 bg-background shadow-2xl overflow-y-auto' : className
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </h3>
            {unit && <span className="text-[11px] font-mono text-muted-foreground/80">({unit})</span>}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            type="button"
            onClick={() => setViewTable(!viewTable)}
            className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            title={viewTable ? 'Switch to Chart' : 'View as Table'}
          >
            {viewTable ? <ChartIcon className="h-3.5 w-3.5" /> : <TableIcon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              title="Panel Options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg z-20"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowQuery(!showQuery)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-foreground hover:bg-surface transition-colors flex items-center gap-2"
                >
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  {showQuery ? 'Hide Query' : 'View Query'}
                </button>

                {onOpenPrometheus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPrometheus(query)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded text-xs text-foreground hover:bg-surface transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    Open in PromQL
                  </button>
                )}

                {onOpenGrafana && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenGrafana()
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded text-xs text-foreground hover:bg-surface transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-warning" />
                    Open in Grafana
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    downloadCsv()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-foreground hover:bg-surface transition-colors flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Value Readout */}
      <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-border/40">
        <span className="text-xl font-bold font-mono tracking-tight text-foreground">
          {formattedLatest}
        </span>
        <span className="text-[11px] text-muted-foreground font-sans font-medium">
          {unit === 'ratio' ? 'hit rate' : unit}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color || '#38BDF8' }}
          />
          <span>live</span>
        </div>
      </div>

      {/* Query Banner if toggled */}
      {showQuery && (
        <div className="mb-3 rounded-lg border border-border bg-surface p-2 font-mono text-[11px] text-muted-foreground flex items-center justify-between gap-2">
          <span className="truncate">{query}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(query)
              toast.success('PromQL copied to clipboard')
            }}
            className="shrink-0 text-primary hover:underline text-[10px]"
          >
            Copy
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-[190px]">
        {isError ? (
          <div className="flex h-full min-h-[190px] flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-6 w-6 text-danger mb-2" />
            <p className="text-xs font-medium text-foreground">Prometheus unreachable</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
              {error?.message || 'Failed to fetch metric series'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-elevated"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : viewTable ? (
          <div className="h-full min-h-[190px] max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3 py-1.5">Series</th>
                  <th className="px-3 py-1.5 text-right">Time</th>
                  <th className="px-3 py-1.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {rawData.length > 0 ? (
                  rawData.flatMap((s, sIdx) =>
                    s.values.slice(-8).map(([ts, val], vIdx) => (
                      <tr key={`${sIdx}-${vIdx}`} className="hover:bg-surface/50">
                        <td className="px-3 py-1 text-foreground truncate max-w-[120px]">
                          {s.metric?.job || s.metric?.__name__ || `series-${sIdx}`}
                        </td>
                        <td className="px-3 py-1 text-right text-muted-foreground">
                          {formatTimestamp(ts * 1000)}
                        </td>
                        <td className="px-3 py-1 text-right text-primary font-bold">
                          {formatNumber(parseFloat(val))} {unit}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground font-sans">
                      {isLoading ? 'Loading metrics...' : 'No data in active time window.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : isLoading ? (
          <SkeletonCard className="h-full min-h-[190px] w-full" />
        ) : (
          <TimeSeriesChart
            series={series}
            height={isFullscreen ? 'calc(100vh - 160px)' : '190px'}
            color={color}
            showArea={true}
            yAxisUnit={unit}
            events={deploymentEvents}
            groupId="monitoring-hub"
          />
        )}
      </div>
    </div>
  )
}
