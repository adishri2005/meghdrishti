import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Maximize2, Minimize2, RefreshCw, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useTimeRange } from '@/hooks/useTimeRange'
import { grafanaClient, type GrafanaDashboardSearchResult } from '@/lib/grafana/client'
import { SkeletonCard } from '@/components/data/SkeletonCard'

interface GrafanaFrameProps {
  panelId?: number
  defaultKiosk?: boolean
  className?: string
  height?: string
}

export function GrafanaFrame({
  panelId,
  defaultKiosk = true,
  className = '',
  height = 'calc(100vh - 220px)',
}: GrafanaFrameProps) {
  const { theme, refreshInterval } = useUIStore()
  const [timeRange] = useTimeRange()
  const { from, to, preset } = timeRange
  
  const [dashboards, setDashboards] = useState<GrafanaDashboardSearchResult[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState<string>('meghdrishti-main')
  const [selectedSlug, setSelectedSlug] = useState<string>('meghdrishti-overview')
  const [kiosk, setKiosk] = useState<boolean>(defaultKiosk)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)
  const [reloadKey, setReloadKey] = useState<number>(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch available dashboards
  useEffect(() => {
    let active = true
    grafanaClient.listDashboards().then((list) => {
      if (active && list.length > 0) {
        setDashboards(list)
        const current = list.find((d) => d.uid === selectedDashboard)
        if (current) {
          setSelectedSlug(current.slug || 'meghdrishti-overview')
        }
      }
    })
    return () => {
      active = false
    }
  }, [selectedDashboard])

  // Convert time range to Grafana format
  const grafanaFrom = preset ? `now-${preset}` : from ? String(new Date(from).getTime()) : 'now-1h'
  const grafanaTo = to ? String(new Date(to).getTime()) : 'now'
  const grafanaRefresh = refreshInterval > 0 ? `${Math.round(refreshInterval / 1000)}s` : ''

  // Build the embed URL
  const embedUrl = grafanaClient.buildEmbedUrl({
    uid: selectedDashboard,
    slug: selectedSlug,
    panelId,
    from: grafanaFrom,
    to: grafanaTo,
    theme: theme === 'light' ? 'light' : 'dark',
    refresh: grafanaRefresh,
    kiosk,
    orgId: 1,
  })

  // Start 10s load timeout
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
  }, [embedUrl, reloadKey])

  const handleIframeLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc && doc.body) {
        const text = doc.body.innerText || ''
        if (text.includes('"error"') && (text.includes('401') || text.includes('Unauthorized'))) {
          setHasError(true)
          setLoading(false)
          return
        }
      }
    } catch {
      // Cross-origin restriction (safe to ignore)
    }
    setLoading(false)
    setHasError(false)
  }

  const handleReauthAndReload = () => {
    if (typeof document !== 'undefined') {
      document.cookie =
        'meghdrishti_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM; path=/; max-age=86400; SameSite=Lax'
      document.cookie =
        'ccad_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM; path=/; max-age=86400; SameSite=Lax'
    }
    setLoading(true)
    setHasError(false)
    setReloadKey((k) => k + 1)
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

  const handleDashboardSelect = (uid: string) => {
    setSelectedDashboard(uid)
    const match = dashboards.find((d) => d.uid === uid)
    if (match) setSelectedSlug(match.slug || 'meghdrishti-overview')
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
            Grafana
          </span>
          {dashboards.length > 1 && !panelId && (
            <select
              aria-label="Select Grafana Dashboard"
              value={selectedDashboard}
              onChange={(e) => handleDashboardSelect(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              {dashboards.map((dash) => (
                <option key={dash.uid} value={dash.uid}>
                  {dash.title}
                </option>
              ))}
            </select>
          )}
          {panelId && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Panel #{panelId}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setKiosk(!kiosk)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
            title={kiosk ? 'Show Grafana Chrome' : 'Enable Kiosk Mode'}
          >
            {kiosk ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>{kiosk ? 'Kiosk' : 'Full Chrome'}</span>
          </button>

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
            href={embedUrl}
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
              <span>Connecting to Grafana gateway...</span>
            </div>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="rounded-full bg-danger/10 p-3 text-danger">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Grafana Frame Unreachable</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Failed to load embedded dashboard within 10 seconds. Verify that you have an active session cookie or that the Grafana gateway container is healthy.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReauthAndReload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Authenticate & Reload
              </button>
              <a
                href={embedUrl}
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
            ref={iframeRef}
            key={reloadKey}
            src={embedUrl}
            title="Meghdrishti Grafana Observability Dashboard"
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
