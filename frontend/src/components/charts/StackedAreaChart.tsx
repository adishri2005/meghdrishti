import { useMemo, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes, SEVERITY_COLORS } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'
import { formatCurrency } from '@/lib/format'

echarts.use([
  LineChart,
  ScatterChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
  CanvasRenderer,
])

registerChartThemes()

export interface AnomalyMarker {
  id: string
  timestampMs: number
  cost: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  resourceId: string
}

export interface StackedSeriesItem {
  name: string
  data: Array<[number, number]> // [ts_ms, cost]
}

interface StackedAreaChartProps {
  series: StackedSeriesItem[]
  anomalies?: AnomalyMarker[]
  onAnomalyClick?: (anomalyId: string) => void
  height?: number | string
  groupId?: string
  showLegend?: boolean
  className?: string
}

export function StackedAreaChart({
  series,
  anomalies = [],
  onAnomalyClick,
  height = 320,
  groupId = 'costguard-shared',
  showLegend = true,
  className = '',
}: StackedAreaChartProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    if (groupId && chartRef.current) {
      const instance = chartRef.current.getEchartsInstance()
      instance.group = groupId
      echarts.connect(groupId)
    }
  }, [groupId])

  // Click on chart handler for anomaly markers
  const onEvents = useMemo(() => {
    return {
      click: (params: { componentType: string; data: { anomalyId?: string } }) => {
        if (params.componentType === 'series' && params.data?.anomalyId && onAnomalyClick) {
          onAnomalyClick(params.data.anomalyId)
        }
      },
    }
  }, [onAnomalyClick])

  const option = useMemo(() => {
    const eSeries: Array<Record<string, unknown>> = series.map((s) => ({
      name: s.name,
      type: 'line',
      stack: 'total',
      smooth: 0.2,
      showSymbol: false,
      areaStyle: {
        opacity: 0.35,
      },
      emphasis: {
        focus: 'series',
      },
      data: s.data,
    }))

    // Add anomaly markers as a scatter overlay pinned to the top of the stacked curve
    if (anomalies.length > 0) {
      const anomalyScatterData = anomalies.map((a) => {
        let stackTotal = 0
        let closestTs = a.timestampMs
        if (series.length > 0 && series[0].data && series[0].data.length > 0) {
          let minDiff = Infinity
          series[0].data.forEach(([ts]) => {
            const diff = Math.abs(ts - a.timestampMs)
            if (diff < minDiff) {
              minDiff = diff
              closestTs = ts
            }
          })
          series.forEach((s) => {
            const pt = s.data.find(([t]) => t === closestTs)
            if (pt) stackTotal += pt[1]
          })
        }

        const yCoord = stackTotal > 0 ? Math.round(stackTotal * 10) / 10 : a.cost

        return {
          name: a.resourceId,
          value: [closestTs, yCoord],
          actualCost: a.cost,
          anomalyId: a.id,
          severity: a.severity,
          itemStyle: {
            color: SEVERITY_COLORS[a.severity] || '#F43F5E',
            borderColor: '#FFFFFF',
            borderWidth: 1.5,
            shadowBlur: 8,
            shadowColor: SEVERITY_COLORS[a.severity] || '#F43F5E',
          },
        }
      })

      eSeries.push({
        name: 'Anomalies',
        type: 'scatter',
        symbol: 'diamond',
        symbolSize: 13,
        z: 10,
        data: anomalyScatterData,
        tooltip: {
          formatter: (p: { data: { name: string; severity: string; value: [number, number]; actualCost: number } }) => {
            const dateStr = new Date(p.data.value[0]).toLocaleString()
            const costVal = p.data.actualCost !== undefined ? p.data.actualCost : p.data.value[1]
            return `
              <div class="font-mono text-[11px] text-muted-foreground mb-1">${dateStr}</div>
              <div class="flex items-center gap-1.5 font-bold text-xs text-danger mb-1">
                <span class="w-2 h-2 rounded-full" style="background-color: ${
                  SEVERITY_COLORS[p.data.severity as keyof typeof SEVERITY_COLORS] || '#F43F5E'
                }"></span>
                ${p.data.severity.toUpperCase()} ANOMALY
              </div>
              <div class="text-xs text-foreground font-mono">Resource: <b>${p.data.name}</b></div>
              <div class="text-xs text-foreground font-mono">Observed Cost: <b>${formatCurrency(costVal)}</b></div>
              <div class="text-[10px] text-muted-foreground mt-1.5 italic">Click marker to inspect root cause</div>
            `
          },
        },
      })
    }

    return {
      grid: {
        top: showLegend ? 40 : 20,
        right: 18,
        bottom: 24,
        left: 8,
        containLabel: true,
      },
      legend: showLegend
        ? {
            show: true,
            top: 5,
            type: 'scroll',
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
            type: 'dashed',
          },
        },
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        borderColor: isDark ? '#1E293B' : '#E2E8F0',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          fontSize: 11,
          fontFamily: '"Geist Variable", Inter, sans-serif',
        },
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4); border-radius: 8px; backdrop-filter: blur(10px);',
        formatter: (params: Array<{ seriesName: string; color: string; value: [number, number] }>) => {
          if (!params || params.length === 0) return ''
          const validParams = params.filter((p) => p.seriesName !== 'Anomalies')
          if (validParams.length === 0) return ''

          const time = new Date(validParams[0].value[0]).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })

          const totalCost = validParams.reduce((acc, p) => acc + (p.value[1] || 0), 0)
          const sorted = [...validParams].sort((a, b) => (b.value[1] || 0) - (a.value[1] || 0))

          let body = `
            <div class="flex items-center justify-between gap-4 font-mono text-[11px] pb-1 mb-1 border-b border-border/50">
              <span class="text-muted-foreground">${time}</span>
              <span class="font-bold text-foreground">Total: ${formatCurrency(totalCost)}</span>
            </div>
          `

          sorted.forEach((p) => {
            body += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${p.color};"></span>
                  <span class="truncate text-muted-foreground font-sans">${p.seriesName}</span>
                </div>
                <span class="font-mono font-medium text-foreground ml-auto">${formatCurrency(p.value[1])}</span>
              </div>
            `
          })

          return body
        },
      },
      xAxis: {
        type: 'time',
        min: series[0]?.data?.[0]?.[0],
        max: series[0]?.data?.[series[0].data.length - 1]?.[0],
        splitNumber: 6,
        axisLine: {
          show: true,
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          formatter: '{HH}:{mm}',
          fontSize: 10,
          color: isDark ? '#7E91A6' : '#64748B',
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: isDark ? '#7E91A6' : '#64748B',
          formatter: (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`,
          fontSize: 10,
        },
      },
      series: eSeries,
    }
  }, [series, anomalies, showLegend, isDark])

  return (
    <div className={`w-full ${className}`}>
      <ReactECharts
        ref={chartRef}
        option={option}
        theme={isDark ? 'costguard-dark' : 'costguard-light'}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
      />
    </div>
  )
}
