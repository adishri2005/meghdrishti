import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  Download,
  Calendar,
  Layers,
  BarChart2,
  TrendingUp,
} from 'lucide-react'
import { getCostTimeseries, getCostHeatmap } from '@/lib/api/endpoints/costs'
import { useTimeRange } from '@/hooks/useTimeRange'
import { useUIStore } from '@/store/ui'
import { ChartCard } from '@/components/charts/ChartCard'
import { StackedAreaChart, type StackedSeriesItem } from '@/components/charts/StackedAreaChart'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { BarChart } from '@/components/charts/BarChart'
import { Treemap, type TreemapNode } from '@/components/charts/Treemap'
import { Heatmap } from '@/components/charts/Heatmap'
import { Sparkline } from '@/components/charts/Sparkline'
import { TrendDelta } from '@/components/data/TrendDelta'
import { formatCurrency, formatPercent } from '@/lib/format'

type GroupBy = 'team' | 'service' | 'region' | 'resource_type'
type ChartType = 'stacked' | 'lines' | 'bars'

export default function Costs() {
  const [timeRange] = useTimeRange()
  const { liveEnabled, refreshInterval } = useUIStore()

  const [groupBy, setGroupBy] = useState<GroupBy>('team')
  const [interval, setInterval] = useState<'hour' | 'day'>('hour')
  const [chartType, setChartType] = useState<ChartType>('stacked')
  const [comparePeriod, setComparePeriod] = useState(false)

  // Fetch cost timeseries
  const { data: timeseriesData, isLoading: timeseriesLoading, refetch: refetchTimeseries } = useQuery({
    queryKey: ['costs', 'explorer', groupBy, interval, timeRange.from, timeRange.to],
    queryFn: () =>
      getCostTimeseries({
        group_by: groupBy,
        from: timeRange.from,
        to: timeRange.to,
        interval,
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  })

  // Fetch heatmap
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['costs', 'heatmap', timeRange.from, timeRange.to],
    queryFn: () =>
      getCostHeatmap({
        from: timeRange.from,
        to: timeRange.to,
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  })

  // Stacked chart series
  const stackedSeries: StackedSeriesItem[] = useMemo(() => {
    if (!timeseriesData?.series) return []
    return timeseriesData.series.map((s) => ({
      name: s.name,
      data: s.points.map(([iso, cost]) => [new Date(iso).getTime(), cost]),
    }))
  }, [timeseriesData])

  // Summary table data calculation
  const summaryRows = useMemo(() => {
    if (!timeseriesData?.series) return []
    const totalSpend = timeseriesData.series.reduce((sum, s) => {
      return sum + s.points.reduce((pSum, p) => pSum + p[1], 0)
    }, 0)

    return timeseriesData.series.map((s) => {
      const sum = s.points.reduce((pSum, p) => pSum + p[1], 0)
      const share = totalSpend > 0 ? (sum / totalSpend) * 100 : 0
      const spark = s.points.map((p) => p[1])
      // Simulated previous period delta
      const delta = ((s.points[s.points.length - 1]?.[1] ?? 1) - (s.points[0]?.[1] ?? 1)) * 0.5

      return {
        name: s.name,
        total: sum,
        share,
        deltaPct: Math.round(delta * 10) / 10,
        spark,
      }
    }).sort((a, b) => b.total - a.total)
  }, [timeseriesData])

  // Treemap hierarchical nodes
  const treemapData: TreemapNode[] = useMemo(() => {
    return summaryRows.map((r) => ({
      name: r.name,
      value: Math.round(r.total * 100) / 100,
    }))
  }, [summaryRows])

  // Client-side CSV export
  const handleExportCsv = () => {
    if (!summaryRows.length) return
    const headers = ['Group', 'Total Cost', 'Share (%)', 'Period Delta (%)']
    const rows = summaryRows.map((r) => [
      `"${r.name}"`,
      r.total.toFixed(2),
      r.share.toFixed(1),
      r.deltaPct.toFixed(1),
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `costguard_spend_${groupBy}_${interval}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const grandTotal = summaryRows.reduce((a, b) => a + b.total, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Cloud Cost Explorer
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Multi-Dimensional FinOps</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Analyze historical and real-time cloud expenditure grouped by team, infrastructure service, region, or resource type.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-4 shadow-xs">
        {/* Left: Group by & Interval */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Layers className="w-4 h-4 text-primary" />
            <span>Group By:</span>
            <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
              {(['team', 'service', 'region', 'resource_type'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGroupBy(mode)}
                  type="button"
                  className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                    groupBy === mode
                      ? 'bg-primary/20 text-primary font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>Interval:</span>
            <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
              {(['hour', 'day'] as const).map((int) => (
                <button
                  key={int}
                  onClick={() => setInterval(int)}
                  type="button"
                  className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                    interval === int
                      ? 'bg-primary/20 text-primary font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {int}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Chart Type & Compare toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setChartType('stacked')}
              type="button"
              className={`p-1.5 rounded-md text-xs transition-colors ${
                chartType === 'stacked'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Stacked Area"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('lines')}
              type="button"
              className={`p-1.5 rounded-md text-xs transition-colors ${
                chartType === 'lines'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Lines"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bars')}
              type="button"
              className={`p-1.5 rounded-md text-xs transition-colors ${
                chartType === 'bars'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Bars"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={comparePeriod}
              onChange={(e) => setComparePeriod(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span>Compare Prior Period</span>
          </label>
        </div>
      </div>

      {/* Main Cost Visualization Card */}
      <ChartCard
        title={`Spend Dynamics by ${groupBy.replace('_', ' ').toUpperCase()}`}
        subtitle={`Aggregated cost over the active window (Total: ${formatCurrency(grandTotal)})`}
        isLoading={timeseriesLoading}
        onRetry={refetchTimeseries}
      >
        {chartType === 'stacked' ? (
          <StackedAreaChart series={stackedSeries} height={340} />
        ) : chartType === 'lines' ? (
          <TimeSeriesChart
            series={stackedSeries.map((s) => ({
              name: s.name,
              data: s.data.map(([ts, val]) => [ts, val]),
              metric: {},
            }))}
            height={340}
            yAxisUnit="$"
            yAxisFormatter={(v) => formatCurrency(v, { compact: true })}
          />
        ) : (
          <BarChart
            categories={timeseriesData?.series[0]?.points.map(([ts]) =>
              new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ) || []}
            series={summaryRows.map((r) => ({
              name: r.name,
              data: r.spark,
              stack: 'total',
            }))}
            height={340}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
          />
        )}
      </ChartCard>

      {/* Middle Row: Treemap & Summary Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Treemap (5 cols) */}
        <div className="lg:col-span-5">
          <ChartCard
            title="Spend Proportion Treemap"
            subtitle="Relative cost distribution by group"
          >
            <Treemap data={treemapData} height={300} />
          </ChartCard>
        </div>

        {/* Breakdown Summary Table (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-border bg-surface p-5 flex flex-col h-full min-h-[360px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Spend Share Breakdown
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Totals, proportion, and micro-trends
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-foreground">
                Total: {formatCurrency(grandTotal)}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-surface-elevated text-muted-foreground font-mono border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Group</th>
                    <th className="px-3.5 py-2.5 font-medium">Expenditure</th>
                    <th className="px-3.5 py-2.5 font-medium">Share</th>
                    <th className="px-3.5 py-2.5 font-medium">Trend (24h)</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {summaryRows.map((row) => (
                    <tr key={row.name} className="hover:bg-muted/20">
                      <td className="px-3.5 py-2.5 font-sans font-semibold text-foreground capitalize">
                        {row.name}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-foreground">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-10">
                            {formatPercent(row.share)}
                          </span>
                          <div className="w-16 h-1 bg-surface-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${row.share}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Sparkline data={row.spark} width={70} height={20} />
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <TrendDelta value={row.deltaPct} reverseColor suffix="" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Heatmap explaining diurnal baselines */}
      <ChartCard
        title="24-Hour Resource Baseline Heatmap"
        subtitle="Used by statistical detection engines to establish normal diurnal expenditure envelopes"
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
  )
}
