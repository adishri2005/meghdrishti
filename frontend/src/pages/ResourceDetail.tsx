import { useParams, Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Back button & Header */}
      <div className="space-y-3">
        <Link
          to="/resources"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Resources Inventory</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground">
                {id}
              </h1>
              <CopyButton value={id} label="Resource ID" />
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase border ${
                  resource?.status === 'anomalous'
                    ? 'bg-danger/10 text-danger border-danger/30'
                    : resource?.status === 'warning'
                    ? 'bg-warning/10 text-warning border-warning/30'
                    : 'bg-success/10 text-success border-success/30'
                }`}
              >
                {resource?.status || 'Active'}
              </span>
            </div>

            {/* Tags bar */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border capitalize">
                Team: <b>{resource?.team || 'ml'}</b>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border uppercase">
                Type: <b>{resource?.type || 'ec2'}</b>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border capitalize">
                Service: <b>{resource?.service || 'compute'}</b>
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border">
                Region: <b>{resource?.region || 'us-east-1'}</b>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/logs/app?q=${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Inspect Application Logs</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Current Spend Rate"
          value={formatCurrency(resource?.last_cost ?? 24.5)}
          trendDelta={8.4}
          reverseTrendColor
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="24h Cumulative Cost"
          value={formatCurrency(resource?.cost_24h ?? 482.1)}
          trendDelta={12.0}
          reverseTrendColor
          icon={<Layers className="w-4 h-4 text-sky-400" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="Baseline Mean (Now)"
          value={formatCurrency(resource?.baseline_mean_now ?? 18.2)}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          isLoading={resourceLoading}
        />
        <KpiCard
          label="Detected Anomalies"
          value={anomaliesData?.total ?? resource?.open_anomalies ?? 0}
          badge={
            (anomaliesData?.total ?? 0) > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-danger/15 text-danger border border-danger/30">
                Action Required
              </span>
            ) : undefined
          }
          icon={<AlertTriangle className="w-4 h-4 text-warning" />}
          isLoading={anomaliesLoading}
        />
      </div>

      {/* Main Historical Cost Band */}
      <ChartCard
        title="Cost Dynamics vs Expected Envelope"
        subtitle="Observed hourly expenditure against 3-sigma baseline envelope"
        isLoading={costLoading}
      >
        <BandChart data={bandPoints} height={320} />
      </ChartCard>

      {/* Lower Row: Diurnal Baseline Profile & Resource Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Baseline Profile by Hour of Day (6 cols) */}
        <div className="lg:col-span-6">
          <ChartCard
            title="Diurnal Baseline Envelope by Hour of Day"
            subtitle="Learned historical mean spend and upper 3-sigma variance bound"
            isLoading={baselineLoading}
          >
            <BarChart
              categories={diurnalCategories}
              series={[
                {
                  name: 'Expected Mean',
                  data: diurnalMeans,
                  color: '#2DD4BF',
                },
                {
                  name: 'Upper 3σ Threshold',
                  data: diurnalUpper,
                  color: '#FB923C',
                },
              ]}
              height={260}
              showLegend
              valueFormatter={(v) => formatCurrency(v)}
            />
          </ChartCard>
        </div>

        {/* Resource Anomalies List (6 cols) */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col h-full min-h-[340px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">
                  Incident History for {id}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {anomaliesData?.total || 0} Incidents Recorded
              </span>
            </div>

            <div className="flex-1 divide-y divide-border/60 overflow-y-auto max-h-[280px]">
              {anomaliesLoading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !anomaliesData?.items || anomaliesData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <span className="text-xs font-medium text-foreground">
                    No Incidents On Record
                  </span>
                  <span className="text-[11px] mt-0.5">
                    This asset operates strictly within normal baseline variance.
                  </span>
                </div>
              ) : (
                anomaliesData.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/anomalies/${item.id}`)}
                    className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1.5 hover:bg-surface-elevated/60 px-2 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityBadge severity={item.severity} />
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {item.anomaly_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                        {formatRelativeTime(item.detected_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {item.root_cause_summary || 'Spike exceeding 3-standard-deviation threshold.'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                      <span className="text-foreground">
                        Observed: <b className="text-danger">{formatCurrency(item.actual_cost)}</b> (exp. {formatCurrency(item.expected_cost)})
                      </span>
                      <span className="text-warning font-semibold">{item.z_score.toFixed(1)}σ</span>
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
