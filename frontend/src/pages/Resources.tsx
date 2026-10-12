import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Server,
  Search,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { getResources } from '@/lib/api/endpoints/resources'
import { CopyButton } from '@/components/data/CopyButton'
import { Sparkline } from '@/components/charts/Sparkline'
import { formatCurrency } from '@/lib/format'
import { useUIStore } from '@/store/ui'

export default function Resources() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { liveEnabled, refreshInterval } = useUIStore()

  const searchQuery = searchParams.get('q') || ''
  const teamFilter = searchParams.get('team') || 'all'
  const serviceFilter = searchParams.get('service') || 'all'
  const regionFilter = searchParams.get('region') || 'all'
  const typeFilter = searchParams.get('type') || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('limit') || '25', 10)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['resources', searchQuery, teamFilter, serviceFilter, regionFilter, typeFilter, page, pageSize],
    queryFn: () =>
      getResources({
        search: searchQuery || undefined,
        team: teamFilter === 'all' ? undefined : teamFilter,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        region: regionFilter === 'all' ? undefined : regionFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  })

  const updateParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (val === null || val === 'all' || val === '') {
      next.delete(key)
    } else {
      next.set(key, val)
    }
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const items = data?.items || []
  const totalCount = data?.total || 0
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Resources
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
              <Server className="w-3 h-3 text-muted-foreground" />
              <span>{totalCount} Monitored Assets</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cloud compute, database, and storage assets tracked by baseline engine.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-muted/50 text-foreground border border-border shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-lg border border-border bg-surface flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Search resource ID or prefix..."
              className="w-full bg-surface border border-border rounded-md pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring font-mono shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => updateParam('q', null)}
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => updateParam('team', e.target.value)}
            className="bg-surface border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring capitalize shadow-xs"
          >
            <option value="all">All Teams</option>
            <option value="ml">ML Team</option>
            <option value="core">Core Team</option>
            <option value="data">Data Team</option>
            <option value="platform">Platform Team</option>
            <option value="frontend">Frontend Team</option>
            <option value="security">Security Team</option>
          </select>

          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => updateParam('service', e.target.value)}
            className="bg-surface border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring capitalize shadow-xs"
          >
            <option value="all">All Services</option>
            <option value="compute">Compute</option>
            <option value="database">Database</option>
            <option value="storage">Storage</option>
            <option value="networking">Networking</option>
            <option value="analytics">Analytics</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => updateParam('type', e.target.value)}
            className="bg-surface border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring uppercase shadow-xs"
          >
            <option value="all">All Types</option>
            <option value="ec2">EC2</option>
            <option value="rds">RDS</option>
            <option value="s3">S3</option>
            <option value="eks">EKS</option>
            <option value="lambda">Lambda</option>
            <option value="elasticache">ElastiCache</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || teamFilter !== 'all' || serviceFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              type="button"
              className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-muted/50 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Resources Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-surface-elevated text-muted-foreground font-mono border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 font-medium">Resource</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Current Cost</th>
                <th className="px-4 py-2.5 font-medium">Baseline Mean</th>
                <th className="px-4 py-2.5 font-medium">24h Total</th>
                <th className="px-4 py-2.5 font-medium">Spend Trend</th>
                <th className="px-4 py-2.5 font-medium text-right">Inspect</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={10} className="px-4 py-3 h-11 bg-muted/20" />
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No cloud resources match current filter parameters.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const sparkData = [
                    row.baseline_mean_now * 0.95,
                    row.baseline_mean_now * 1.02,
                    row.baseline_mean_now * 0.98,
                    row.baseline_mean_now * 1.04,
                    row.last_cost,
                  ]

                  return (
                    <tr
                      key={row.resource_id}
                      onClick={() => navigate(`/resources/${encodeURIComponent(row.resource_id)}`)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[190px]">{row.resource_id}</span>
                          <CopyButton value={row.resource_id} label="Resource ID" iconSize="w-3 h-3" />
                        </div>
                      </td>

                      <td className="px-4 py-2.5 font-mono uppercase text-muted-foreground">
                        {row.type}
                      </td>

                      <td className="px-4 py-2.5 font-sans capitalize text-muted-foreground">
                        {row.team}
                      </td>

                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {row.region}
                      </td>

                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase border ${
                            row.status === 'anomalous'
                              ? 'bg-danger/10 text-danger border-danger/25'
                              : row.status === 'warning'
                              ? 'bg-warning/10 text-warning border-warning/25'
                              : 'bg-success/10 text-success border-success/25'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {formatCurrency(row.last_cost)}
                      </td>

                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {formatCurrency(row.baseline_mean_now)}
                      </td>

                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {formatCurrency(row.cost_24h)}
                      </td>

                      <td className="px-4 py-2.5">
                        <Sparkline
                          data={sparkData}
                          color={row.status === 'anomalous' ? 'hsl(var(--danger))' : 'hsl(var(--primary))'}
                          width={60}
                          height={18}
                        />
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <span className="p-1 rounded hover:bg-muted/50 text-muted-foreground inline-flex items-center">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-2.5 border-t border-border bg-surface flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono text-[11px]">
            Page {page} of {totalPages} ({totalCount} assets)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
              disabled={page <= 1}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-muted/50 disabled:opacity-40 text-xs font-medium transition-colors shadow-xs"
            >
              Previous
            </button>
            <button
              onClick={() => updateParam('page', String(Math.min(totalPages, page + 1)))}
              disabled={page >= totalPages}
              type="button"
              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-muted/50 disabled:opacity-40 text-xs font-medium transition-colors shadow-xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
