import { useMemo, useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'
import type { EChartSeriesData } from '@/lib/prom/transform'

echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
])

registerChartThemes()

export interface ChartEventMarker {
  timeMs: number
  label: string
  color?: string
}

export interface ChartThreshold {
  value: number
  label?: string
  color?: string
}

interface TimeSeriesChartProps {
  series: EChartSeriesData[]
  height?: number | string
  yAxisUnit?: string
  yAxisFormatter?: (val: number) => string
  thresholds?: ChartThreshold[]
  events?: ChartEventMarker[]
  groupId?: string
  showArea?: boolean
  showDataZoom?: boolean
  className?: string
}

export function TimeSeriesChart({
  series,
  height = 260,
  yAxisUnit,
  yAxisFormatter,
  thresholds = [],
  events = [],
  groupId = 'costguard-shared',
  showArea = false,
  showDataZoom = false,
  className = '',
}: TimeSeriesChartProps) {
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

  const option = useMemo(() => {
    // Generate markLines for thresholds & events
    const markLineData: Array<Record<string, unknown>> = []

    thresholds.forEach((t) => {
      markLineData.push({
        yAxis: t.value,
        lineStyle: {
          color: t.color || '#F43F5E',
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'end',
          formatter: t.label || `${t.value}${yAxisUnit || ''}`,
          color: t.color || '#F43F5E',
          fontSize: 10,
          fontFamily: '"Geist Mono Variable", monospace',
        },
      })
    })

    // Get timestamp domain from series to ensure event markers are only drawn if strictly inside range
    let minTime = Infinity
    let maxTime = -Infinity
    series.forEach((s) => {
      s.data.forEach(([t]) => {
        if (t < minTime) minTime = t
        if (t > maxTime) maxTime = t
      })
    })

    events.forEach((ev) => {
      if (ev.timeMs >= minTime && ev.timeMs <= maxTime) {
        markLineData.push({
          xAxis: ev.timeMs,
          lineStyle: {
            color: ev.color || '#38BDF8',
            type: 'dashed',
            width: 1.5,
          },
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: ev.label,
            color: ev.color || '#38BDF8',
            fontSize: 9,
            fontFamily: '"Geist Mono Variable", monospace',
            backgroundColor: isDark ? 'rgba(16, 23, 32, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            padding: [2, 4],
            borderRadius: 3,
            borderWidth: 1,
            borderColor: ev.color || '#38BDF8',
          },
        })
      }
    })

    const eSeries = series.map((s) => ({
      name: s.name,
      type: 'line',
      showSymbol: false,
      connectNulls: false, // Gap handling: breaks line on missing data
      smooth: 0.15,
      areaStyle: showArea ? { opacity: 0.15 } : undefined,
      data: s.data,
      markLine:
        markLineData.length > 0 && s === series[0]
          ? {
              silent: true,
              symbol: 'none',
              data: markLineData,
            }
          : undefined,
    }))

    return {
      grid: {
        top: 24,
        right: 18,
        bottom: showDataZoom ? 50 : 25,
        left: 8,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: Array<{ seriesName: string; color: string; value: [number, number | null] }>) => {
          if (!params || params.length === 0) return ''
          const time = new Date(params[0].value[0]).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })

          // Sort series descending by value at cursor
          const sorted = [...params].sort(
            (a, b) => (b.value[1] ?? -Infinity) - (a.value[1] ?? -Infinity)
          )

          let body = `<div class="font-mono text-[11px] text-muted-foreground pb-1 mb-1 border-b border-border/50">${time}</div>`
          sorted.forEach((p) => {
            const val = p.value[1]
            const valStr =
              val === null || val === undefined
                ? '<span class="text-muted-foreground">--</span>'
                : yAxisFormatter
                ? yAxisFormatter(val)
                : `${val.toFixed(2)}${yAxisUnit ? ' ' + yAxisUnit : ''}`

            body += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${p.color};"></span>
                  <span class="truncate text-muted-foreground font-sans">${p.seriesName}</span>
                </div>
                <span class="font-mono font-medium text-foreground ml-auto">${valStr}</span>
              </div>
            `
          })

          return body
        },
      },
      xAxis: {
        type: 'time',
        splitNumber: 4,
        axisLabel: {
          formatter: '{HH}:{mm}',
          fontSize: 10,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => {
            if (yAxisFormatter) return yAxisFormatter(v)
            if (yAxisUnit === '%') return `${v}%`
            if (yAxisUnit === 's') return v < 1 ? `${Math.round(v * 1000)}ms` : `${v}s`
            if (yAxisUnit === 'ms') return `${v}ms`
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
            return `${Number(v.toFixed(3))}`
          },
          fontSize: 10,
        },
      },
      dataZoom: showDataZoom
        ? [
            {
              type: 'inside',
            },
            {
              type: 'slider',
              height: 18,
              bottom: 8,
            },
          ]
        : undefined,
      series: eSeries,
    }
  }, [
    series,
    thresholds,
    events,
    showArea,
    showDataZoom,
    yAxisUnit,
    yAxisFormatter,
    isDark,
  ])

  return (
    <div className={`w-full ${className}`}>
      <ReactECharts
        ref={chartRef}
        option={option}
        theme={isDark ? 'costguard-dark' : 'costguard-light'}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
