import { useState, useEffect, useMemo } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { promClient } from '@/lib/prom/client'
import { formatTimestamp } from '@/lib/format'
import { StatusDot } from '@/components/data/StatusDot'
import type { PromTarget } from '@/lib/prom/queries'

export function TargetsTable() {
  const [targets, setTargets] = useState<PromTarget[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filterHealth, setFilterHealth] = useState<'all' | 'up' | 'down'>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState<number>(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    promClient
      .targets()
      .then((data) => {
        if (active) {
          setTargets(data.activeTargets || [])
        }
      })
      .catch(() => {
        if (active) setTargets([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  const upCount = useMemo(() => targets.filter((t) => t.health === 'up').length, [targets])
  const downCount = useMemo(() => targets.filter((t) => t.health !== 'up').length, [targets])
  const totalCount = targets.length

  const filtered = useMemo(() => {
    return targets.filter((t) => {
      if (filterHealth === 'up' && t.health !== 'up') return false
      if (filterHealth === 'down' && t.health === 'up') return false
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const job = (t.labels.job || '').toLowerCase()
        const instance = (t.labels.instance || '').toLowerCase()
        const url = (t.scrapeUrl || '').toLowerCase()
        if (!job.includes(query) && !instance.includes(query) && !url.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [targets, filterHealth, searchTerm])

  return (
    <div className="space-y-4">
      {/* Header & KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Targets
            </span>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {loading ? '...' : totalCount}
            </div>
          </div>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Healthy (UP)
            </span>
            <div className="text-2xl font-bold font-mono text-success mt-1">
              {loading ? '...' : upCount}
            </div>
          </div>
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Degraded / Down
            </span>
            <div className={`text-2xl font-bold font-mono mt-1 ${downCount > 0 ? 'text-danger' : 'text-muted-foreground'}`}>
              {loading ? '...' : downCount}
            </div>
          </div>
          <XCircle className={`h-6 w-6 ${downCount > 0 ? 'text-danger' : 'text-muted-foreground'}`} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search job or instance..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-48 sm:w-64 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterHealth('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterHealth === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterHealth('up')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterHealth === 'up' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Up ({upCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterHealth('down')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterHealth === 'down' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Down ({downCount})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Targets Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Instance / URL</th>
                <th className="px-4 py-3">Scrape Duration</th>
                <th className="px-4 py-3">Last Scrape</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map((target, idx) => {
                  const isUp = target.health === 'up'
                  return (
                    <tr key={`${target.scrapeUrl}-${idx}`} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusDot status={isUp ? 'success' : 'danger'} pulse={!isUp} />
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isUp ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}
                          >
                            {target.health}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                        {target.labels.job || 'unknown'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        <div>{target.labels.instance || target.scrapeUrl}</div>
                        <div className="text-[10px] text-muted-foreground/70 truncate max-w-xs">{target.scrapeUrl}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {target.lastScrapeDuration ? `${(target.lastScrapeDuration * 1000).toFixed(1)} ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {target.lastScrape ? formatTimestamp(new Date(target.lastScrape).getTime()) : '-'}
                      </td>
                      <td className="px-4 py-3 text-danger font-mono text-[11px] max-w-xs truncate">
                        {target.lastError || <span className="text-muted-foreground">-</span>}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? 'Discovering scrape targets...' : 'No Prometheus targets match criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
