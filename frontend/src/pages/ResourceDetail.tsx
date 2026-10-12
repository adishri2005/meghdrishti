import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Layers,
  FileText,
} from 'lucide-react'
import {
  getResource,
  getResourceCosts,
  getResourceBaseline,
} from '@/lib/api/endpoints/resources'
import { getAnomalies } from '@/lib/api/endpoints/anomalies'
import { KpiCard } from '@/components/data/KpiCard'
import { ChartCard } from '@/components/charts/ChartCard'
import { BandChart, type BandDataPoint } from '@/components/charts/BandChart'
import { BarChart } from '@/components/charts/BarChart'
import { CopyButton } from '@/components/data/CopyButton'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import { useUIStore } from '@/store/ui'

export default function ResourceDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const { liveEnabled, refreshInterval } = useUIStore()

  // Resource metadata
  const { data: resource, isLoading: resourceLoading } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => getResource(id),
    staleTime: 30000,
  })

  // Cost history and baseline band
  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ['resource', id, 'costs'],
    queryFn: () => getResourceCosts(id),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    staleTime: 15000,
  })

  // Hourly baseline diurnal profile
  const { data: baselineData, isLoading: baselineLoading } = useQuery({
    queryKey: ['resource', id, 'baseline'],
    queryFn: () => getResourceBaseline(id),
    staleTime: 60000,
  })

  // Anomalies for this resource
  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['resource', id, 'anomalies'],
    queryFn: () => getAnomalies({ resource_id: id, limit: 10 }),
    staleTime: 10000,
  })

  const bandPoints: BandDataPoint[] = (costData?.points || []).map((p) => ({
    timestampMs: new Date(p.timestamp).getTime(),
    actualCost: p.actual_cost,
    baselineMean: p.baseline_mean,
    upperBound: p.upper_bound,
    lowerBound: p.lower_bound,
    isAnomaly: p.is_anomaly,
  }))

  const diurnalCategories = (baselineData?.hourly || []).map((h) => `${h.hour}:00`)
  const diurnalMeans = (baselineData?.hourly || []).map((h) => h.mean)
  const diurnalUpper = (baselineData?.hourly || []).map((h) => Math.round((h.mean + 3 * h.std) * 10) / 10)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Back button & Header */}
      <div className="space-y-2.5">
        <Link
          to="/resources"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Resources</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-semibold font-mono tracking-tight text-foreground">
                {id}
              </h1>
              <CopyButton value={id} label="Resource ID" />
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase border ${
                  resource?.status === 'anomalous'
                    ? 'bg-danger/10 text-danger border-danger/25'
                    : resource?.status === 'warning'
                    ? 'bg-warning/10 text-warning border-warning/25'
                    : 'bg-success/10 text-success border-success/25'
                }`}
              >
                {resource?.status || 'Active'}
              </span>
            </div>

            {/* Tags bar */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border capitalize">
                Team: <b className="text-foreground">{resource?.team || 'ml'}</b>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border uppercase">
                Type: <b className="text-foreground">{resource?.type || 'ec2'}</b>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border capitalize">
                Service: <b className="text-foreground">{resource?.service || 'compute'}</b>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border">
                Region: <b className="text-foreground">{resource?.region || 'us-east-1'}</b>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/logs/app?q=${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-muted/50 text-foreground border border-border transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Inspect Logs</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Current Spend Rate"
          value={formatCurrency(resource?.last_cost ?? 24.5)}
          trendDelta={8.4}
          reverseTrendColor
          icon={<DollarSign className="w-3.5 h-3.5 text-muted-foreground" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="24h Cumulative Cost"
          value={formatCurrency(resource?.cost_24h ?? 482.1)}
          trendDelta={12.0}
          reverseTrendColor
          icon={<Layers className="w-3.5 h-3.5 text-muted-foreground" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="Baseline Mean (Now)"
          value={formatCurrency(resource?.baseline_mean_now ?? 18.2)}
          icon={<TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="Detected Anomalies"
          value={anomaliesData?.total ?? resource?.open_anomalies ?? 0}
          badge={
            (anomaliesData?.total ?? 0) > 0 ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-danger/10 text-danger border border-danger/25">
                Incident Active
              </span>
            ) : undefined
          }
          icon={<AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />}
          isLoading={resourceLoading || anomaliesLoading}
        />
      </div>

      {/* Main Confidence Band Chart */}
      <ChartCard
        title="Cost Dynamics & Baseline Envelope (±3σ)"
        subtitle="Observed spending vs online calculated Welford confidence interval"
        isLoading={costLoading}
      >
        <BandChart data={bandPoints} height={320} />
      </ChartCard>

      {/* Middle Row: Diurnal Hourly Profile & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Hourly Diurnal Baseline Profile (6 cols) */}
        <div className="lg:col-span-6">
          <ChartCard
            title="Diurnal Hourly Envelope Profile"
            subtitle="Calculated normal diurnal profile across the 24h clock"
            isLoading={baselineLoading}
          >
            <BarChart
              categories={diurnalCategories}
              series={[
                { name: 'Baseline Mean', data: diurnalMeans },
                { name: 'Upper Bound (+3σ)', data: diurnalUpper },
              ]}
              height={260}
              valueFormatter={(v) => formatCurrency(v, { compact: true })}
            />
          </ChartCard>
        </div>

        {/* Recent Anomalies for Resource (6 cols) */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-border bg-surface p-4 flex flex-col h-full min-h-[320px] shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-foreground">
                Incident History on this Resource
              </h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                {anomaliesData?.total ?? 0} total incidents
              </span>
            </div>

            <div className="flex-1 divide-y divide-border/60 overflow-y-auto max-h-[260px]">
              {anomaliesLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted/40 rounded-md animate-pulse" />
                  ))}
                </div>
              ) : !anomaliesData?.items || anomaliesData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <span className="text-xs font-medium text-foreground">No Historical Anomalies</span>
                  <span className="text-[11px] mt-0.5">This resource has operated within normal bounds.</span>
                </div>
              ) : (
                anomaliesData.items.map((a) => (
                  <div
                    key={a.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1 hover:bg-muted/30 px-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={a.severity} />
                        <span className="font-mono text-[11px] uppercase text-muted-foreground">
                          {(a.anomaly_type || 'anomaly').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatRelativeTime(a.detected_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {a.root_cause_summary}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-foreground">
                        Observed: <b className="text-danger font-medium">{formatCurrency(a.actual_cost)}</b> (exp. {formatCurrency(a.expected_cost)})
                      </span>
                      <span className="text-muted-foreground font-mono">
                        z={a.z_score.toFixed(1)}σ
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
