import { useState, useRef, useEffect } from 'react'
import { ExternalLink, Maximize2, Minimize2, RefreshCw, AlertCircle } from 'lucide-react'
import { SkeletonCard } from '@/components/data/SkeletonCard'

interface PrometheusFrameProps {
  initialQuery?: string
  className?: string
  height?: string
}

export function PrometheusFrame({
  initialQuery,
  className = '',
  height = 'calc(100vh - 220px)',
}: PrometheusFrameProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)
  const [reloadKey, setReloadKey] = useState<number>(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const params = new URLSearchParams()
  if (initialQuery) {
    params.set('g0.expr', initialQuery)
    params.set('g0.tab', '0')
  }
  const prometheusUrl = `/prometheus/graph${params.toString() ? `?${params.toString()}` : ''}`

  useEffect(() => {
    setLoading(true)
    setHasError(false)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setLoading((prev) => {
        if (prev) setHasError(true)
        return false
      })
    }, 10000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [prometheusUrl, reloadKey])

  const handleIframeLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setLoading(false)
    setHasError(false)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
      setIsFullscreen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-background p-4' : className
      }`}
    >
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prometheus UI
          </span>
          <span className="text-xs font-mono text-muted-foreground">/prometheus/graph</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
            title="Reload Frame"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          <a
            href={prometheusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Tab</span>
          </a>
        </div>
      </div>

      {/* Frame / Loading / Error Container */}
      <div className="relative w-full flex-1 bg-background" style={{ minHeight: height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs p-6 space-y-4">
            <SkeletonCard className="w-full max-w-2xl h-64" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Connecting to Prometheus gateway...</span>
            </div>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="rounded-full bg-danger/10 p-3 text-danger">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Prometheus Frame Unreachable</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Failed to load Prometheus UI within 10 seconds. Check that your session is authenticated and the Prometheus container is running.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
              <a
                href={prometheusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Direct Link
              </a>
            </div>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={prometheusUrl}
            title="CostGuard Prometheus Web Console"
            onLoad={handleIframeLoad}
            referrerPolicy="same-origin"
            loading="lazy"
            className="w-full h-full border-none"
            style={{ height }}
          />
        )}
      </div>
    </div>
  )
}
