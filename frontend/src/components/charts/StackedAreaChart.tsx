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

    // Add anomaly markers as a scatter overlay
    if (anomalies.length > 0) {
      const anomalyScatterData = anomalies.map((a) => ({
        name: a.resourceId,
        value: [a.timestampMs, a.cost],
        anomalyId: a.id,
        severity: a.severity,
        itemStyle: {
          color: SEVERITY_COLORS[a.severity] || '#F43F5E',
          borderColor: '#FFFFFF',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: SEVERITY_COLORS[a.severity] || '#F43F5E',
        },
      }))

      eSeries.push({
        name: 'Anomalies',
        type: 'scatter',
        symbol: 'diamond',
        symbolSize: 12,
        z: 10,
        data: anomalyScatterData,
        tooltip: {
          formatter: (p: { data: { name: string; severity: string; value: [number, number] } }) => {
            const dateStr = new Date(p.data.value[0]).toLocaleString()
            return `
              <div class="font-mono text-[11px] text-muted-foreground mb-1">${dateStr}</div>
              <div class="flex items-center gap-1.5 font-bold text-xs text-danger mb-1">
                <span class="w-2 h-2 rounded-full" style="background-color: ${
                  SEVERITY_COLORS[p.data.severity as keyof typeof SEVERITY_COLORS] || '#F43F5E'
                }"></span>
                ${p.data.severity.toUpperCase()} ANOMALY
              </div>
              <div class="text-xs text-foreground font-mono">Resource: <b>${p.data.name}</b></div>
              <div class="text-xs text-foreground font-mono">Cost: <b>${formatCurrency(p.data.value[1])}</b></div>
              <div class="text-[10px] text-muted-foreground mt-1.5 italic">Click marker to inspect root cause</div>
            `
          },
        },
      })
    }

    return {
      grid: {
        top: showLegend ? 40 : 20,
        right: 20,
        bottom: 25,
        left: 54,
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
          type: 'cross',
        },
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
        axisLabel: {
          formatter: '{HH}:{mm}',
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`,
          fontSize: 10,
        },
      },
      series: eSeries,
    }
  }, [series, anomalies, showLegend])

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
