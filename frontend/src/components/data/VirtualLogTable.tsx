import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Copy, Terminal, ChevronRight, X } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { JsonViewer } from './JsonViewer'
import { toast } from 'sonner'
import type { LogRecord } from '@/lib/api/types'

interface VirtualLogTableProps {
  logs: LogRecord[]
  wrapLines?: boolean
  searchQuery?: string
  onFilterRequestId?: (requestId: string) => void
  className?: string
}

const LEVEL_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  DEBUG: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' },
  INFO: { bg: 'bg-info/10', text: 'text-info font-medium', border: 'border-info/30' },
  WARNING: { bg: 'bg-warning/10', text: 'text-warning font-semibold', border: 'border-warning/30' },
  WARN: { bg: 'bg-warning/10', text: 'text-warning font-semibold', border: 'border-warning/30' },
  ERROR: { bg: 'bg-danger/10', text: 'text-danger font-bold', border: 'border-danger/30' },
  CRITICAL: { bg: 'bg-danger/20', text: 'text-danger font-bold', border: 'border-danger/50' },
}

export function VirtualLogTable({
  logs,
  wrapLines = false,
  searchQuery = '',
  onFilterRequestId,
  className = '',
}: VirtualLogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [selectedRecord, setSelectedRecord] = useState<LogRecord | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (wrapLines ? 64 : 36),
    overscan: 15,
  })

  const copyRequestId = (e: React.MouseEvent, reqId: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(reqId)
    toast.success('Copied request ID')
  }

  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) return text
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-primary font-semibold rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className={`relative flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm ${className}`}>
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold text-muted-foreground select-none">
        <div className="col-span-2">Timestamp (ms)</div>
        <div className="col-span-1">Level</div>
        <div className="col-span-2">Logger / Event</div>
        <div className="col-span-5">Message</div>
        <div className="col-span-2 text-right">Request ID / Actor</div>
      </div>

      {/* Virtualized Scroll View */}
      <div
        ref={parentRef}
        className="h-[580px] overflow-y-auto font-mono text-xs divide-y divide-border/50"
      >
        {logs.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index]
              const lvl = (log.level || 'INFO').toUpperCase()
              const style = LEVEL_BADGES[lvl] || LEVEL_BADGES.INFO
              const formattedTime = log.timestamp
                ? formatDateTime(log.timestamp, 'HH:mm:ss.SSS')
                : '-'

              return (
                <div
                  key={virtualRow.index}
                  onClick={() => setSelectedRecord(log)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`grid grid-cols-12 gap-2 px-4 py-1.5 items-center cursor-pointer transition-colors hover:bg-surface/60 ${
                    lvl === 'ERROR' ? 'bg-danger/5' : ''
                  }`}
                >
                  {/* Timestamp */}
                  <div className="col-span-2 text-muted-foreground text-[11px] truncate">
                    {formattedTime}
                  </div>

                  {/* Level Chip */}
                  <div className="col-span-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase border ${style.bg} ${style.text} ${style.border}`}
                    >
                      {lvl}
                    </span>
                  </div>

                  {/* Logger & Event */}
                  <div className="col-span-2 truncate text-foreground text-[11px]">
                    <div className="text-muted-foreground truncate">{log.logger || 'ccad'}</div>
                    {log.event && (
                      <div className="text-primary font-medium truncate text-[10px]">
                        {highlightMatch(log.event)}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div className={`col-span-5 text-foreground leading-snug ${wrapLines ? 'break-words' : 'truncate'}`}>
                    {highlightMatch(log.message || '')}
                  </div>

                  {/* Request ID & User */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 text-right">
                    {log.request_id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          if (onFilterRequestId) {
                            e.stopPropagation()
                            onFilterRequestId(log.request_id!)
                          } else {
                            copyRequestId(e, log.request_id!)
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors max-w-[100px] truncate"
                        title={`Filter or copy: ${log.request_id}`}
                      >
                        <Copy className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{log.request_id.slice(-6)}</span>
                      </button>
                    )}
                    {log.user && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {log.user}
                      </span>
                    )}
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground font-sans">
            <Terminal className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">No log events recorded</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Waiting for incoming log events or adjust your level and search filters.
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase border ${
                    LEVEL_BADGES[(selectedRecord.level || 'INFO').toUpperCase()]?.bg || 'bg-muted'
                  } ${
                    LEVEL_BADGES[(selectedRecord.level || 'INFO').toUpperCase()]?.text || 'text-foreground'
                  }`}
                >
                  {selectedRecord.level || 'INFO'}
                </span>
                <h3 className="text-base font-semibold text-foreground">Log Record Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Timestamp:</span>
                <div className="font-mono text-foreground font-medium mt-0.5">
                  {selectedRecord.timestamp || '-'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Logger:</span>
                <div className="font-mono text-foreground font-medium mt-0.5">
                  {selectedRecord.logger || '-'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Event:</span>
                <div className="font-mono text-primary font-medium mt-0.5">
                  {selectedRecord.event || '-'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Request ID:</span>
                <div className="font-mono text-foreground font-medium mt-0.5">
                  {selectedRecord.request_id || '-'}
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground">Message:</span>
              <div className="mt-1 rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground leading-relaxed break-words">
                {selectedRecord.message}
              </div>
            </div>

            <JsonViewer data={selectedRecord} title="Complete JSON Record" />
          </div>
        </div>
      )}
    </div>
  )
}
