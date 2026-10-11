import { useState, useEffect, useRef } from 'react'
import { Play, Copy, Check, History, BookOpen, AlertCircle, Table as TableIcon, LineChart as ChartIcon, Terminal } from 'lucide-react'
import { promClient, calculateStep } from '@/lib/prom/client'
import { useTimeRange } from '@/hooks/useTimeRange'
import { transformPromMatrix, type EChartSeriesData } from '@/lib/prom/transform'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { formatTimestamp } from '@/lib/format'
import { toast } from 'sonner'
import type { PromMatrixSeries, PromSample } from '@/lib/prom/queries'

const EXAMPLE_QUERIES = [
  {
    name: 'API Latency (p95)',
    expr: 'histogram_quantile(0.95, sum by (le) (rate(api_latency_seconds_bucket[1m])))',
    desc: '95th percentile API response time across all endpoints',
  },
  {
    name: 'Queue Lag',
    expr: 'max(queue_lag)',
    desc: 'Unprocessed messages in Redis Stream queue',
  },
  {
    name: 'Error Ratio',
    expr: 'sum(rate(api_requests_total{status=~"5.."}[1m])) / clamp_min(sum(rate(api_requests_total[1m])), 0.001)',
    desc: '5xx HTTP error proportion of total traffic',
  },
  {
    name: 'Request Rate (RPS)',
    expr: 'sum(rate(api_requests_total[1m]))',
    desc: 'Total inbound HTTP requests per second',
  },
  {
    name: 'Ingestion vs Processing',
    expr: 'sum(rate(records_ingested_total{source="api"}[1m]))',
    desc: 'Cost records ingested into queue per second',
  },
  {
    name: 'Detection Delay (p95)',
    expr: 'histogram_quantile(0.95, sum by (le) (rate(detection_delay_seconds_bucket[5m])))',
    desc: 'Seconds from record timestamp to anomaly emission',
  },
  {
    name: 'DLQ Length',
    expr: 'max(dlq_length)',
    desc: 'Dead letter queue poison messages count',
  },
]

interface PromQueryConsoleProps {
  initialQuery?: string
  className?: string
}

export function PromQueryConsole({
  initialQuery = 'sum(rate(api_requests_total[1m]))',
  className = '',
}: PromQueryConsoleProps) {
  const [timeRange] = useTimeRange()
  const fromDate = new Date(timeRange.from)
  const toDate = new Date(timeRange.to)
  
  const [query, setQuery] = useState<string>(initialQuery)
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph')
  const [queryType, setQueryType] = useState<'range' | 'instant'>('range')
  const [customStep, setCustomStep] = useState<string>('')
  
  const [running, setRunning] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [graphSeries, setGraphSeries] = useState<EChartSeriesData[]>([])
  const [instantSamples, setInstantSamples] = useState<PromSample[]>([])
  const [rawMatrix, setRawMatrix] = useState<PromMatrixSeries[]>([])

  
  const [metrics, setMetrics] = useState<string[]>([])
  const [filteredMetrics, setFilteredMetrics] = useState<string[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)
  const [history, setHistory] = useState<string[]>([])
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('costguard_prom_history')
      if (saved) {
        setHistory(JSON.parse(saved).slice(0, 20))
      }
    } catch {}
  }, [])

  // Fetch metric names for autocomplete
  useEffect(() => {
    let active = true
    promClient.labelValues('__name__').then((names) => {
      if (active && names) {
        setMetrics(names)
      }
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const saveToHistory = (expr: string) => {
    if (!expr.trim()) return
    const next = [expr, ...history.filter((h) => h !== expr)].slice(0, 20)
    setHistory(next)
    try {
      localStorage.setItem('costguard_prom_history', JSON.stringify(next))
    } catch {}
  }

  const executeQuery = async () => {
    if (!query.trim()) return
    setRunning(true)
    setErrorMessage(null)
    saveToHistory(query)

    const startSec = Math.floor(fromDate.getTime() / 1000)
    const endSec = Math.floor(toDate.getTime() / 1000)
    const stepSec = customStep ? parseInt(customStep, 10) : calculateStep(startSec, endSec)

    try {
      if (queryType === 'range') {
        const res = await promClient.queryRange(query, startSec, endSec, stepSec)
        const seriesData = res.data?.result || []
        setRawMatrix(seriesData)
        const formatted = transformPromMatrix(seriesData, { stepSec })
        setGraphSeries(formatted)
      } else {
        const res = await promClient.query(query, endSec)
        const samples = res.data?.result || []
        setInstantSamples(samples)
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'PromQL execution error'
      setErrorMessage(msg)
    } finally {
      setRunning(false)
    }
  }

  // Handle Ctrl+Enter execution
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
    const words = val.split(/[\s,()]+/)
    const lastWord = words[words.length - 1] || ''
    if (lastWord.length >= 2 && metrics.length > 0) {
      const matches = metrics.filter((m) => m.toLowerCase().includes(lastWord.toLowerCase())).slice(0, 8)
      setFilteredMetrics(matches)
      setShowAutocomplete(matches.length > 0)
    } else {
      setShowAutocomplete(false)
    }
  }

  const insertMetric = (metric: string) => {
    const words = query.split(/([\s,()]+)/)
    words[words.length - 1] = metric
    const updated = words.join('')
    setQuery(updated)
    setShowAutocomplete(false)
    textareaRef.current?.focus()
  }

  const copyAsCurl = () => {
    const startSec = Math.floor(fromDate.getTime() / 1000)
    const endSec = Math.floor(toDate.getTime() / 1000)
    const stepSec = customStep ? parseInt(customStep, 10) : calculateStep(startSec, endSec)
    const cmd = `curl -G -s 'https://localhost/prometheus/api/v1/query_range' \\
  --data-urlencode 'query=${query}' \\
  --data-urlencode 'start=${startSec}' \\
  --data-urlencode 'end=${endSec}' \\
  --data-urlencode 'step=${stepSec}'`

    navigator.clipboard.writeText(cmd)
    setCopiedCurl(true)
    toast.success('Copied curl command to clipboard')
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  return (
    <div className={`space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {/* Editor & Controls */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              PromQL Native Console
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              (Press Ctrl+Enter to execute)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Range vs Instant */}
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setQueryType('range')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  queryType === 'range' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Range
              </button>
              <button
                type="button"
                onClick={() => setQueryType('instant')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  queryType === 'instant' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Instant
              </button>
            </div>

            {queryType === 'range' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Step:</span>
                <input
                  type="text"
                  placeholder="auto"
                  value={customStep}
                  onChange={(e) => setCustomStep(e.target.value)}
                  className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-mono outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <button
              type="button"
              onClick={copyAsCurl}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
              title="Copy as curl command"
            >
              {copiedCurl ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              <span>curl</span>
            </button>
          </div>
        </div>

        {/* Text Area with Autocomplete */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={3}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type PromQL query (e.g. sum(rate(api_requests_total[1m])))..."
            className="w-full rounded-lg border border-border bg-surface font-mono text-xs text-foreground p-3 leading-relaxed outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
          />

          {showAutocomplete && (
            <div className="absolute left-2 top-full z-20 mt-1 max-h-48 w-80 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1 shadow-lg backdrop-blur-md">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Matching Metrics
              </div>
              {filteredMetrics.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => insertMetric(m)}
                  className="w-full rounded px-2 py-1 text-left font-mono text-xs text-foreground hover:bg-primary/20 hover:text-primary transition-colors truncate"
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Quick presets dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Examples:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.slice(0, 4).map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  onClick={() => {
                    setQuery(ex.expr)
                    setShowAutocomplete(false)
                  }}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-elevated hover:border-primary/50 transition-colors"
                  title={ex.desc}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <div className="relative group">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>History ({history.length})</span>
                </button>
                <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-72 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg z-30">
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">Recent Queries</div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setQuery(h)}
                        className="w-full text-left font-mono text-[11px] px-2 py-1 rounded text-foreground hover:bg-primary/10 hover:text-primary truncate"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={executeQuery}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Play className={`h-3.5 w-3.5 fill-current ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Prometheus Execution Error:</span>
            <p className="font-mono">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Query Results {queryType === 'range' ? `(${rawMatrix.length} series)` : `(${instantSamples.length} samples)`}
          </div>
          {queryType === 'range' && (
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                  viewMode === 'graph' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                <ChartIcon className="h-3 w-3" />
                <span>Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                  viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                <TableIcon className="h-3 w-3" />
                <span>Table</span>
              </button>
            </div>
          )}
        </div>

        {/* Graph Mode */}
        {queryType === 'range' && viewMode === 'graph' && (
          <div className="h-72 w-full">
            {graphSeries.length > 0 ? (
              <TimeSeriesChart
                series={graphSeries}
                height="100%"
                yAxisUnit=""
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {running ? 'Running query...' : 'No range data to display. Click Run Query.'}
              </div>
            )}
          </div>
        )}

        {/* Table Mode (Range or Instant) */}
        {(viewMode === 'table' || queryType === 'instant') && (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3 py-2">Metric Labels</th>
                  <th className="px-3 py-2 text-right">Timestamp</th>
                  <th className="px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {queryType === 'instant' ? (
                  instantSamples.length > 0 ? (
                    instantSamples.map((s, idx) => (
                      <tr key={idx} className="hover:bg-surface/50">
                        <td className="px-3 py-2 text-foreground">
                          {Object.entries(s.metric).map(([k, v]) => (
                            <span key={k} className="mr-1.5 inline-block rounded bg-surface px-1 py-0.5 text-[11px]">
                              <span className="text-muted-foreground">{k}=</span>"{v}"
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {formatTimestamp(s.value[0] * 1000)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-primary">
                          {s.value[1]}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground font-sans">
                        {running ? 'Fetching instant samples...' : 'No instant samples returned.'}
                      </td>
                    </tr>
                  )
                ) : rawMatrix.length > 0 ? (
                  rawMatrix.flatMap((m, sIdx) =>
                    m.values.slice(-5).map((v, vIdx) => (
                      <tr key={`${sIdx}-${vIdx}`} className="hover:bg-surface/50">
                        <td className="px-3 py-1.5 text-foreground">
                          {Object.entries(m.metric).map(([k, val]) => (
                            <span key={k} className="mr-1.5 inline-block rounded bg-surface px-1 py-0.5 text-[11px]">
                              <span className="text-muted-foreground">{k}=</span>"{val}"
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {formatTimestamp(v[0] * 1000)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-primary">
                          {v[1]}
                        </td>
                      </tr>
                    ))
                  )
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground font-sans">
                      {running ? 'Fetching series data...' : 'No data in range.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
