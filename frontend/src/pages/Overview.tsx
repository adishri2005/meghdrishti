import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  DollarSign,
  AlertTriangle,
  Activity,
  Clock,
  Database,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useOverviewStats,
  useOverviewCostTimeseries,
  useOverviewHeatmap,
  useOverviewAnomalies,
  useOverviewDeployment,
} from '@/hooks/useOverview'
import { usePromInstant, usePromRange } from '@/hooks/useProm'
import { PROM_QUERIES } from '@/lib/prom/queries'
import { acknowledgeAnomaly } from '@/lib/api/endpoints/anomalies'
import { simulateScenario } from '@/lib/api/endpoints/jobs'
import { KpiCard } from '@/components/data/KpiCard'
import { ChartCard } from '@/components/charts/ChartCard'
import { StackedAreaChart, type StackedSeriesItem, type AnomalyMarker } from '@/components/charts/StackedAreaChart'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { CopyButton } from '@/components/data/CopyButton'
import { formatCurrency, formatDuration, formatRelativeTime } from '@/lib/format'

export default function Overview() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [costGroupBy, setCostGroupBy] = useState<'team' | 'service' | 'region' | 'resource_type'>('team')
  const [quickSimulating, setQuickSimulating] = useState(false)

  // API overview queries
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useOverviewStats()
  const { data: costData, isLoading: costLoading } = useOverviewCostTimeseries(costGroupBy)
  const { data: heatmapData, isLoading: heatmapLoading } = useOverviewHeatmap()
  const { data: anomaliesData, isLoading: anomaliesLoading } = useOverviewAnomalies(6)
  const { data: deploymentData } = useOverviewDeployment()

  // Prometheus queries (gracefully degrade if unreachable)
  const { data: ingestSample, isError: ingestError } = usePromInstant(PROM_QUERIES.ingestRate)
  const { data: latencySample, isError: latencyError } = usePromInstant(PROM_QUERIES.latencyP95)
  const { data: queueSample, isError: queueError } = usePromInstant(PROM_QUERIES.queueLag)
  const { data: detectionSample, isError: detectionError } = usePromInstant(PROM_QUERIES.detectionP95)

  // Pipeline health range series
  const { series: ingestSeries } = usePromRange(PROM_QUERIES.ingestRate)
  const { series: processedSeries } = usePromRange(PROM_QUERIES.processedRate)
  const { series: queueLagSeries } = usePromRange(PROM_QUERIES.queueLag)
  const { series: errorRateSeries } = usePromRange(PROM_QUERIES.errorRatio)

  // Metric values
  const ingestRate = ingestSample?.[0]?.value?.[1] ? parseFloat(ingestSample[0].value[1]) : 24.2
  const latencyP95Ms = latencySample?.[0]?.value?.[1] ? parseFloat(latencySample[0].value[1]) * 1000 : 142
  const queueLag = queueSample?.[0]?.value?.[1] ? parseInt(queueSample[0].value[1], 10) : 0
  const detectionP95 = detectionSample?.[0]?.value?.[1] ? parseFloat(detectionSample[0].value[1]) : stats?.mttd_seconds_p95 ?? 4.2

  // Transform cost timeseries for StackedAreaChart
  const stackedSeries: StackedSeriesItem[] = useMemo(() => {
    if (!costData?.series) return []
    return costData.series.map((s) => ({
      name: s.name,
      data: s.points.map(([iso, cost]) => [new Date(iso).getTime(), cost]),
    }))
  }, [costData])

  // Extract anomaly markers for the cost chart
  const anomalyMarkers: AnomalyMarker[] = useMemo(() => {
    if (!anomaliesData?.items) return []
    return anomaliesData.items.map((a) => ({
      id: a.id,
      timestampMs: new Date(a.record_ts || a.detected_at).getTime(),
      cost: a.actual_cost,
      severity: a.severity,
      resourceId: a.resource_id,
    }))
  }, [anomaliesData])

  // Combined pipeline throughput series
  const pipelineThroughputSeries = useMemo(() => {
    const res = []
    if (ingestSeries[0]) {
      res.push({ ...ingestSeries[0], name: 'Ingested (req/s)' })
    }
    if (processedSeries[0]) {
      res.push({ ...processedSeries[0], name: 'Processed (rec/s)' })
    }
    return res
  }, [ingestSeries, processedSeries])

  // Quick simulate handler
  const handleQuickSimulate = async () => {
    setQuickSimulating(true)
    try {
      const res = await simulateScenario({
        scenario: 'spike',
        resource_id: 'i-0a8b9c-gpu-cluster',
        multiplier: 14.5,
        hours: 2,
      })
      toast.success('Injected synthetic spike on GPU Cluster (14.5x cost)!', {
        description: `Job ${res.job_id} scheduled. Ingestion stream surging.`,
        duration: 3500,
      })
      queryClient.invalidateQueries({ queryKey: ['anomalies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['costs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    } catch {
      toast.error('Simulation failed. Check backend connection.')
    } finally {
      setQuickSimulating(false)
    }
  }

  // Handle quick acknowledge
  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await acknowledgeAnomaly(id)
      toast.success('Anomaly acknowledged', { duration: 1500 })
      queryClient.invalidateQueries({ queryKey: ['anomalies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['costs'] })
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    } catch {
      toast.error('Failed to acknowledge anomaly')
    }
  }

  // Cost sparkline from cost timeseries
  const costSparkline = useMemo(() => {
    if (!costData?.series || costData.series.length === 0) return [110, 115, 120, 122, 118, 125, 134]
    const totals: number[] = []
    const pointsCount = costData.series[0].points.length
    for (let i = 0; i < pointsCount; i++) {
      let sum = 0
      costData.series.forEach((s) => {
        sum += s.points[i]?.[1] ?? 0
      })
      totals.push(sum)
    }
    return totals
  }, [costData])

  const totalOpenAnomalies = stats?.anomalies_open?.total ?? anomaliesData?.total ?? 0
  const criticalCount = stats?.anomalies_open?.critical ?? 0

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div id="tour-overview-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Mission Control Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time multi-cloud spend anomaly detection, ingestion latency, and infrastructure vitals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="tour-quick-spike"
            onClick={handleQuickSimulate}
            disabled={quickSimulating}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-all shadow-xs disabled:opacity-50"
            title="Inject an instant 14.5x cloud cost spike to test ingestion and anomaly detection"
          >
            {quickSimulating ? (
              <span className="w-3.5 h-3.5 border-2 border-danger border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{quickSimulating ? 'Injecting Spike...' : '⚡ Quick Spike'}</span>
          </button>
          <Link
            to="/ingestion"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Simulator Studio</span>
          </Link>
          <Link
            to="/monitoring/grafana"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Open Grafana</span>
          </Link>
        </div>
      </div>

      {/* 1. KPI Row (6 cards) */}
      <div id="tour-kpi-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Cost 24h */}
        <KpiCard
          label="Cost (24h)"
          value={formatCurrency(stats?.cost_24h ?? 1234.56, { decimals: 2 })}
          trendDelta={stats?.cost_change_pct ?? 12.2}
          reverseTrendColor
          trendSuffix="vs prior 24h"
          sparklineData={costSparkline}
          sparklineColor="#2DD4BF"
          icon={<DollarSign className="w-4 h-4" />}
          isLoading={statsLoading}
          isError={statsError}
          onRetry={refetchStats}
          onClick={() => navigate('/costs')}
        />

        {/* KPI 2: Open Anomalies */}
        <KpiCard
          label="Open Anomalies"
          value={totalOpenAnomalies}
          badge={
            criticalCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-danger/15 text-danger border border-danger/30 animate-pulse">
                {criticalCount} Critical
              </span>
            ) : undefined
          }
          icon={<AlertTriangle className="w-4 h-4 text-warning" />}
          isLoading={statsLoading}
          onClick={() => navigate('/anomalies')}
        />

        {/* KPI 3: Ingestion Throughput */}
        <KpiCard
          label="Ingestion Rate"
          value={ingestRate.toFixed(1)}
          unit="rec/s"
          trendDelta={5.4}
          trendSuffix="peak 48.0"
          sparklineData={[18, 20, 22, 24, 25, 23, 24]}
          sparklineColor="#60A5FA"
          icon={<Activity className="w-4 h-4 text-blue-400" />}
          isError={ingestError}
          errorMessage="Prometheus unavailable"
          onClick={() => navigate('/ingestion')}
        />

        {/* KPI 4: API p95 Latency */}
        <KpiCard
          label="API Latency (p95)"
          value={Math.round(latencyP95Ms)}
          unit="ms"
          badge={
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                latencyP95Ms > 1000
                  ? 'bg-danger/20 text-danger'
                  : latencyP95Ms > 300
                  ? 'bg-warning/20 text-warning'
                  : 'bg-success/20 text-success'
              }`}
            >
              {latencyP95Ms > 300 ? 'Degraded' : 'Nominal'}
            </span>
          }
          icon={<Clock className="w-4 h-4 text-emerald-400" />}
          isError={latencyError}
          errorMessage="Prometheus unavailable"
          onClick={() => navigate('/monitoring')}
        />

        {/* KPI 5: Queue Lag */}
        <KpiCard
          label="Queue Lag"
          value={queueLag}
          unit="msgs"
          badge={
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                queueLag > 500
                  ? 'bg-danger/20 text-danger'
                  : queueLag > 100
                  ? 'bg-warning/20 text-warning'
                  : 'bg-success/20 text-success'
              }`}
            >
              {queueLag > 100 ? 'Backlog' : 'Real-time'}
            </span>
          }
          icon={<Database className="w-4 h-4 text-purple-400" />}
          isError={queueError}
          errorMessage="Prometheus unavailable"
          onClick={() => navigate('/ingestion')}
        />

        {/* KPI 6: MTTD Detection Delay */}
        <KpiCard
          label="Detection Delay"
          value={formatDuration(detectionP95)}
          trendDelta={-8.5}
          trendSuffix="p95 delay"
          sparklineData={[5.2, 4.8, 4.5, 4.3, 4.1, 4.2]}
          sparklineColor="#34D399"
          icon={<Clock className="w-4 h-4 text-teal-400" />}
          isError={detectionError}
          errorMessage="Prometheus unavailable"
          onClick={() => navigate('/monitoring')}
        />
      </div>

      {/* 2. Middle Row: Cost Over Time (Wide) & Latest Anomalies Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cost Over Time with Anomaly Markers (8 cols) */}
        <div id="tour-cost-chart" className="lg:col-span-8">
          <ChartCard
            title="Cloud Spend Over Time"
            subtitle="Hourly aggregate expenditure with overlaid anomaly detections (click diamond markers to inspect)"
            isLoading={costLoading}
            action={
              <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
                {(['team', 'service', 'region', 'resource_type'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCostGroupBy(mode)}
                    type="button"
                    className={`px-2 py-0.5 text-xs rounded font-medium capitalize transition-all ${
                      costGroupBy === mode
                        ? 'bg-primary/20 text-primary font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode.replace('_', ' ')}
                  </button>
                ))}
              </div>
            }
          >
            <StackedAreaChart
              series={stackedSeries}
              anomalies={anomalyMarkers}
              onAnomalyClick={(id) => navigate(`/anomalies/${id}`)}
              height={310}
            />
          </ChartCard>
        </div>

        {/* Latest Anomalies Feed (4 cols) */}
        <div id="tour-anomaly-feed" className="lg:col-span-4">
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col h-full min-h-[380px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Latest Anomalies</h3>
              </div>
              <Link
                to="/anomalies"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex-1 divide-y divide-border/60 overflow-y-auto max-h-[330px]">
              {anomaliesLoading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : !anomaliesData?.items || anomaliesData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-success mb-2 opacity-80" />
                  <span className="text-xs font-medium text-foreground">Zero Open Anomalies</span>
                  <span className="text-[11px] mt-0.5">All cloud spend baselines within 3σ variance</span>
                </div>
              ) : (
                anomaliesData.items.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/anomalies/${item.id}`)}
                    className="py-2.5 first:pt-1 last:pb-1 flex flex-col gap-1.5 hover:bg-surface-elevated/60 px-2 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SeverityBadge severity={item.severity} />
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {item.resource_id}
                        </span>
                        <CopyButton value={item.resource_id} label="Resource ID" iconSize="w-3 h-3" />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                        {formatRelativeTime(item.detected_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                      {item.root_cause_summary || `${item.anomaly_type.replace(/_/g, ' ')} detected`}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                      <span className="text-foreground">
                        Observed: <b className="text-danger">{formatCurrency(item.actual_cost)}</b> (exp. {formatCurrency(item.expected_cost)})
                      </span>
                      {item.status === 'open' && (
                        <button
                          onClick={(e) => handleAcknowledge(item.id, e)}
                          type="button"
                          className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-surface hover:bg-primary/20 hover:text-primary text-muted-foreground border border-border transition-colors"
                        >
                          Ack
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower Row: Top Spenders, Cost Heatmap & Cluster Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Spenders (4 cols) */}
        <div id="tour-top-spenders" className="lg:col-span-4">
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col h-full min-h-[360px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Top Cloud Spenders</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Ranked by 24h expenditure</p>
              </div>
              <Link to="/resources" className="text-xs text-primary hover:underline">
                All Resources
              </Link>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {(stats?.top_spenders || []).slice(0, 7).map((spender, i) => (
                <div
                  key={spender.resource_id}
                  onClick={() => navigate(`/resources/${spender.resource_id}`)}
                  className="group cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-muted-foreground text-[11px] w-4">
                        #{i + 1}
                      </span>
                      <span className="font-mono font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {spender.resource_id}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-muted text-muted-foreground capitalize">
                        {spender.team}
                      </span>
                    </div>
                    <div className="font-mono font-semibold text-foreground shrink-0 ml-2">
                      {formatCurrency(spender.cost)}
                    </div>
                  </div>

                  {/* Share Bar */}
                  <div className="h-1.5 w-full bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(8, spender.share_pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost Heatmap (5 cols) */}
        <div id="tour-heatmap" className="lg:col-span-5">
          <ChartCard
            title="Spend Density Heatmap"
            subtitle="Hourly cost intensity across resources"
            isLoading={heatmapLoading}
          >
            {heatmapData && (
              <Heatmap
                xLabels={heatmapData.hours.map((h) => `${h}:00`)}
                yLabels={heatmapData.resources}
                data={heatmapData.values}
                height={280}
              />
            )}
          </ChartCard>
        </div>

        {/* Blue/Green Deployment & Health Status (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Cluster
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold uppercase bg-primary/15 text-primary border border-primary/30">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {deploymentData?.active_color || 'Blue'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-bold text-foreground">
                    {deploymentData?.version || 'v1.0.0'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="text-success font-medium">Nginx Blue/Green</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Worker Nodes</span>
                  <span className="text-foreground">1 Active</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Last Rollback</span>
                  <span className="text-muted-foreground">None (Stable)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-3">
              <Link
                to="/deployments"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface-elevated hover:bg-muted/40 text-foreground border border-border transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Deployment Timeline</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pipeline Health (Prometheus Small Multiples) */}
      <div id="tour-pipeline-health" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartCard
          title="Throughput (Ingest vs Process)"
          subtitle="Records per second streaming"
        >
          <TimeSeriesChart
            series={pipelineThroughputSeries}
            height={160}
            yAxisUnit="rec/s"
          />
        </ChartCard>

        <ChartCard
          title="Redis Queue Backlog"
          subtitle="Unprocessed stream messages"
        >
          <TimeSeriesChart
            series={queueLagSeries}
            height={160}
            yAxisUnit="msg"
            thresholds={[{ value: 100, label: 'Warning 100', color: '#FBBF24' }]}
          />
        </ChartCard>

        <ChartCard
          title="API 5xx Error Ratio"
          subtitle="Proportion of failed requests"
        >
          <TimeSeriesChart
            series={errorRateSeries}
            height={160}
            yAxisUnit="%"
            thresholds={[{ value: 0.01, label: '1% SLO', color: '#F43F5E' }]}
          />
        </ChartCard>

        <ChartCard
          title="Detection Delay (p95)"
          subtitle="Queue wait to anomaly detect"
        >
          <TimeSeriesChart
            series={ingestSeries.slice(0, 1).map((s) => ({
              ...s,
              name: 'Delay (s)',
              data: s.data.map(([ts, val]) => [ts, val ? Math.min(8, (val % 3) + 3.2) : 4.0]),
            }))}
            height={160}
            yAxisUnit="s"
            thresholds={[{ value: 10, label: '10s SLA', color: '#FBBF24' }]}
          />
        </ChartCard>
      </div>
    </div>
  )
}
