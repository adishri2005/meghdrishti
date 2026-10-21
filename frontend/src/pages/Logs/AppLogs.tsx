import { useState, useMemo } from 'react'
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Download,
  Filter,
  Search,
  Radio,
  FileText,
} from 'lucide-react'
import { useLogStream } from '@/hooks/useLogStream'
import { VirtualLogTable } from '@/components/data/VirtualLogTable'
import { toast } from 'sonner'

const LOG_LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
const COMMON_EVENTS = [
  'ALL',
  'records_ingested',
  'anomaly_detected',
  'detection_completed',
  'rate_limit_evaluated',
  'auth_token_verified',
  'model_drift_evaluated',
]

export default function AppLogs() {
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')
  const [selectedEvent, setSelectedEvent] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [requestIdFilter, setRequestIdFilter] = useState<string>('')
  const [wrapLines, setWrapLines] = useState<boolean>(false)

  const {
    logs,
    isConnected,
    isPollingFallback,
    isPaused,
    unreadCount,
    pause,
    resume,
    clearLogs,
  } = useLogStream({
    enabled: true,
  })

  // Filter logs locally for instantaneous response
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLevel !== 'ALL' && log.level?.toUpperCase() !== selectedLevel) {
        return false
      }
      if (selectedEvent !== 'ALL' && log.event !== selectedEvent) {
        return false
      }
      if (requestIdFilter && log.request_id !== requestIdFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const msg = (log.message || '').toLowerCase()
        const evt = (log.event || '').toLowerCase()
        const lgr = (log.logger || '').toLowerCase()
        if (!msg.includes(q) && !evt.includes(q) && !lgr.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [logs, selectedLevel, selectedEvent, requestIdFilter, searchQuery])

  const downloadNdjson = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs to download')
      return
    }
    const lines = filteredLogs.map((l) => JSON.stringify(l)).join('\n')
    const blob = new Blob([lines], { type: 'application/x-ndjson;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `meghdrishti_logs_${Date.now()}.ndjson`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${filteredLogs.length} log lines`)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Application Logs
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
              <Terminal className="w-3 h-3 text-muted-foreground" />
              <span>Live Tail</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structured server log streaming with Server-Sent Events and JSON inspection.
          </p>
        </div>

        {/* Live Tail Status & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Connection status pill */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs shadow-xs">
            <Radio
              className={`h-3 w-3 ${
                isConnected
                  ? 'text-success'
                  : 'text-muted-foreground'
              }`}
            />
            <span className="font-medium text-foreground">
              {isPollingFallback
                ? 'Polling Fallback'
                : isConnected
                ? 'SSE Connected'
                : 'Connecting...'}
            </span>
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={isPaused ? resume : pause}
            aria-label={isPaused ? 'Resume Stream' : 'Pause Stream'}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all shadow-xs ${
              isPaused
                ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
                : 'border-border bg-surface text-foreground hover:bg-muted/50'
            }`}
          >
            {isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
            {isPaused && unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-warning px-1.5 py-0.2 text-[10px] font-bold text-background">
                +{unreadCount}
              </span>
            )}
          </button>

          {/* Wrap lines */}
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            aria-label="Toggle word wrap"
            className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors shadow-xs ${
              wrapLines ? 'bg-muted text-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle word wrap"
          >
            <FileText className="h-3 w-3" />
            <span className="hidden sm:inline">Wrap</span>
          </button>

          {/* Export NDJSON */}
          <button
            type="button"
            onClick={downloadNdjson}
            aria-label="Download visible logs as NDJSON"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shadow-xs"
            title="Download visible logs as NDJSON"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={clearLogs}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors shadow-xs"
            title="Clear buffer"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Free text search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter message or logger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 sm:w-64 rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring focus:border-ring shadow-xs"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground hidden sm:inline" />
            <div className="flex rounded-md border border-border bg-muted/60 p-0.5 text-xs">
              {LOG_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    selectedLevel === lvl
                      ? 'bg-surface text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Event Dropdown */}
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="h-7 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring shadow-xs"
          >
            {COMMON_EVENTS.map((evt) => (
              <option key={evt} value={evt}>
                {evt === 'ALL' ? 'All Events' : evt}
              </option>
            ))}
          </select>
        </div>

        {/* Active Filter Chips & Counter */}
        <div className="flex items-center gap-2 text-xs">
          {requestIdFilter && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-foreground">
              <span className="font-mono text-[11px]">req: {requestIdFilter}</span>
              <button
                type="button"
                onClick={() => setRequestIdFilter('')}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          )}

          <span className="text-muted-foreground font-mono text-xs">
            Showing <strong className="text-foreground">{filteredLogs.length}</strong> / {logs.length} lines
          </span>
        </div>
      </div>

      {/* Virtualized Logs Table */}
      <VirtualLogTable
        logs={filteredLogs}
        wrapLines={wrapLines}
        searchQuery={searchQuery}
        onFilterRequestId={(id) => setRequestIdFilter(id)}
      />
    </div>
  )
}
