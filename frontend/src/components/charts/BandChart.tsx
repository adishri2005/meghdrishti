import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'
import { formatCurrency } from '@/lib/format'

echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  CanvasRenderer,
])

registerChartThemes()

export interface BandDataPoint {
  timestampMs: number
  actualCost: number
  baselineMean: number
  upperBound: number // mean + 3 std
  lowerBound: number // mean - 3 std
  isAnomaly?: boolean
}

interface BandChartProps {
  data: BandDataPoint[]
  detectedAtMs?: number
  height?: number | string
  className?: string
}

export function BandChart({
  data,
  detectedAtMs,
  height = 300,
  className = '',
}: BandChartProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const option = useMemo(() => {
    const actual = data.map((d) => [d.timestampMs, d.actualCost])
    const mean = data.map((d) => [d.timestampMs, d.baselineMean])
    const lower = data.map((d) => [d.timestampMs, Math.max(0, d.lowerBound)])
    // Upper band as stack delta above lower
    const bandDiff = data.map((d) => [
      d.timestampMs,
      Math.max(0, d.upperBound - Math.max(0, d.lowerBound)),
    ])

    // Find anomaly regions for markArea
    const anomalyPoints = data.filter((d) => d.isAnomaly)
    const markAreaPieces: Array<[{ xAxis: number }, { xAxis: number }]> = []

    anomalyPoints.forEach((ap) => {
      markAreaPieces.push([
        { xAxis: ap.timestampMs - 1800000 }, // -30m
        { xAxis: ap.timestampMs + 1800000 }, // +30m
      ])
    })

    return {
      grid: {
        top: 30,
        right: 20,
        bottom: 25,
        left: 54,
      },
      legend: {
        show: true,
        top: 0,
        data: ['Actual Cost', 'Baseline Mean', 'Expected Band (±3σ)'],
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: Array<{ seriesName: string; value: [number, number] }>) => {
          if (!params || params.length === 0) return ''
          const ts = params[0].value[0]
          const point = data.find((d) => d.timestampMs === ts)
          if (!point) return ''

          const dateStr = new Date(ts).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })

          return `
            <div class="font-mono text-xs">
              <div class="text-muted-foreground pb-1 mb-1 border-b border-border/50">${dateStr}</div>
              <div class="flex items-center justify-between gap-4 py-0.5">
                <span class="text-foreground font-semibold">Actual Cost:</span>
                <span class="font-bold text-primary">${formatCurrency(point.actualCost)}</span>
              </div>
              <div class="flex items-center justify-between gap-4 py-0.5">
                <span class="text-muted-foreground">Baseline Mean:</span>
                <span class="text-muted-foreground">${formatCurrency(point.baselineMean)}</span>
              </div>
              <div class="flex items-center justify-between gap-4 py-0.5">
                <span class="text-muted-foreground">Expected Range:</span>
                <span class="text-muted-foreground">${formatCurrency(point.lowerBound)} – ${formatCurrency(point.upperBound)}</span>
              </div>
              ${
                point.isAnomaly
                  ? `<div class="mt-1 pt-1 border-t border-danger/40 text-danger font-bold uppercase tracking-wider text-[10px]">⚠️ Anomalous Spike Detected</div>`
                  : ''
              }
            </div>
          `
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
          formatter: (v: number) => `$${v}`,
          fontSize: 10,
        },
      },
      series: [
        // Lower invisible boundary
        {
          name: 'Lower Bound',
          type: 'line',
          data: lower,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none',
        },
        // Shaded confidence band (stack on top of lower)
        {
          name: 'Expected Band (±3σ)',
          type: 'line',
          data: bandDiff,
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: isDark ? 'rgba(45, 212, 191, 0.12)' : 'rgba(15, 157, 138, 0.12)',
          },
          stack: 'confidence-band',
          symbol: 'none',
        },
        // Baseline Mean
        {
          name: 'Baseline Mean',
          type: 'line',
          data: mean,
          lineStyle: {
            color: isDark ? '#8DA0B5' : '#64748B',
            type: 'dashed',
            width: 1.5,
          },
          symbol: 'none',
        },
        // Actual Cost line with anomaly regions & detected marker
        {
          name: 'Actual Cost',
          type: 'line',
          data: actual,
          lineStyle: {
            color: '#2DD4BF',
            width: 2.5,
          },
          symbol: 'circle',
          symbolSize: 4,
          markArea:
            markAreaPieces.length > 0
              ? {
                  silent: true,
                  itemStyle: {
                    color: 'rgba(244, 63, 94, 0.15)',
                  },
                  data: markAreaPieces,
                }
              : undefined,
          markLine: detectedAtMs
            ? {
                silent: true,
                symbol: 'none',
                data: [
                  {
                    xAxis: detectedAtMs,
                    lineStyle: {
                      color: '#F43F5E',
                      type: 'solid',
                      width: 2,
                    },
                    label: {
                      show: true,
                      position: 'insideStartTop',
                      formatter: 'ANOMALY DETECTED',
                      color: '#F43F5E',
                      fontSize: 10,
                      fontWeight: 'bold',
                      fontFamily: '"Geist Mono Variable", monospace',
                      backgroundColor: isDark ? 'rgba(16, 23, 32, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      padding: [3, 6],
                      borderRadius: 4,
                    },
                  },
                ],
              }
            : undefined,
        },
      ],
    }
  }, [data, detectedAtMs, isDark])

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
