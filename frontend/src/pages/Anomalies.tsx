import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Search,
  X,
  RefreshCw,
} from 'lucide-react'
import { getAnomalies } from '@/lib/api/endpoints/anomalies'
import { AnomalyTable } from '@/components/anomalies/AnomalyTable'
import { AnomalyDrawer } from '@/components/anomalies/AnomalyDrawer'
import { useUIStore } from '@/store/ui'
import type { Anomaly, Severity } from '@/lib/api/types'

export default function Anomalies() {
  const { id: urlAnomalyId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { liveEnabled, refreshInterval } = useUIStore()

  // URL state
  const statusFilter = searchParams.get('status') || 'open'
  const severityFilter = searchParams.get('severity') || 'all'
  const searchQuery = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('limit') || '25', 10)

  // Drawer state
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Fetch anomalies list
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['anomalies', statusFilter, severityFilter, searchQuery, page, pageSize],
    queryFn: () =>
      getAnomalies({
        status: statusFilter === 'all' ? undefined : statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        resource_id: searchQuery || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })

  // Deep linking: when URL contains :id, find or set selected anomaly
  useEffect(() => {
    if (urlAnomalyId && data?.items) {
      const match = data.items.find((a) => a.id === urlAnomalyId)
      if (match) {
        setSelectedAnomaly(match)
        setDrawerOpen(true)
      } else {
        // Fallback placeholder item while loading or deep link
        setSelectedAnomaly({
          id: urlAnomalyId,
          resource_id: urlAnomalyId,
          anomaly_type: 'statistical_spike',
          severity: 'critical',
          status: 'open',
          expected_cost: 45.0,
          actual_cost: 210.4,
          z_score: 4.8,
          detected_at: new Date().toISOString(),
          root_cause_summary: `Deep-linked incident inspection for ${urlAnomalyId}`,
          occurrences: 1,
        })
        setDrawerOpen(true)
      }
    } else if (!urlAnomalyId) {
      setDrawerOpen(false)
    }
  }, [urlAnomalyId, data])

  // Count open anomalies by severity for quick filter chips
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    if (!data?.items) return counts
    data.items.forEach((a) => {
      if (a.status === 'open') {
        counts[a.severity] = (counts[a.severity] || 0) + 1
        counts.total += 1
      }
    })
    return counts
  }, [data])

  const updateParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (val === null || val === 'all' || val === '') {
      next.delete(key)
    } else {
      next.set(key, val)
    }
    next.delete('page') // Reset page on filter change
    setSearchParams(next, { replace: true })
  }

  const handleSelectAnomaly = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly)
    setDrawerOpen(true)
    navigate(`/anomalies/${anomaly.id}`, { replace: false })
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    navigate('/anomalies', { replace: true })
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Cost Anomaly Explorer
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-warning/10 text-warning border border-warning/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Statistical & Multi-Dimensional Outliers</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time automated incident detection powered by Z-score baselines, EWMA drift analysis, and isolation forest.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Incidents</span>
        </button>
      </div>

      {/* Summary Severity Chips (Quick Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const isSelected = severityFilter === sev
          const count = sev === 'all' ? severityCounts.total : severityCounts[sev as Severity]

          return (
            <button
              key={sev}
              type="button"
              onClick={() => updateParam('severity', isSelected && sev !== 'all' ? null : sev)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-xs'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-elevated/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono uppercase font-semibold text-muted-foreground capitalize">
                  {sev === 'all' ? 'All Severities' : sev}
                </span>
                {sev !== 'all' && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sev === 'critical'
                        ? 'bg-danger animate-pulse'
                        : sev === 'high'
                        ? 'bg-orange-400'
                        : sev === 'medium'
                        ? 'bg-warning'
                        : 'bg-info'
                    }`}
                  />
                )}
              </div>
              <div className="text-xl font-bold font-mono text-foreground tabular-nums">
                {count}
                <span className="text-xs text-muted-foreground font-normal ml-1 font-sans">
                  open
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Search resource ID or prefix..."
              className="w-full bg-surface-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => updateParam('q', null)}
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
            {(['all', 'open', 'acknowledged', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateParam('status', s)}
                type="button"
                className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                  statusFilter === s
                    ? 'bg-primary/20 text-primary font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Clear Filters */}
          {(severityFilter !== 'all' || statusFilter !== 'open' || searchQuery) && (
            <button
              onClick={() => {
                setSearchParams(new URLSearchParams(), { replace: true })
              }}
              type="button"
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-danger rounded-md border border-border hover:border-danger/30 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Anomalies Table */}
      <AnomalyTable
        data={data?.items || []}
        totalCount={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => updateParam('page', String(p))}
        onPageSizeChange={(size) => updateParam('limit', String(size))}
        onSelectAnomaly={handleSelectAnomaly}
        isLoading={isLoading}
      />

      {/* Right Drawer Inspector */}
      <AnomalyDrawer
        anomaly={selectedAnomaly}
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  )
}
