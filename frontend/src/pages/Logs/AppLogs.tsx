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
    link.setAttribute('download', `costguard_logs_${Date.now()}.ndjson`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${filteredLogs.length} log lines`)
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Terminal className="h-6 w-6 text-primary" />
            Application Logs
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time structured log streaming with Server-Sent Events, filtering, and JSON inspector.
          </p>
        </div>

        {/* Live Tail Status & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Connection status pill */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs">
            <Radio
              className={`h-3 w-3 ${
                isConnected
                  ? 'text-success animate-pulse'
                  : 'text-muted-foreground'
              }`}
            />
            <span className="font-medium text-foreground">
              {isPollingFallback
                ? 'Polling Fallback'
                : isConnected
                ? 'Live SSE Connected'
                : 'Connecting...'}
            </span>
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={isPaused ? resume : pause}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              isPaused
                ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
                : 'border-border bg-surface text-foreground hover:bg-surface-elevated'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
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
            className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              wrapLines ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle word wrap"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wrap</span>
          </button>

          {/* Export NDJSON */}
          <button
            type="button"
            onClick={downloadNdjson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
            title="Download visible logs as NDJSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={clearLogs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
            title="Clear buffer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Free text search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search message or logger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 sm:w-64 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
            <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
              {LOG_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    selectedLevel === lvl
                      ? 'bg-primary text-primary-foreground'
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
            className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
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
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-primary">
              <span className="font-mono text-[11px]">req: {requestIdFilter}</span>
              <button
                type="button"
                onClick={() => setRequestIdFilter('')}
                className="hover:text-foreground"
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
