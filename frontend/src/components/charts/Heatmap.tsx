import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { HeatmapChart as EHeatmapChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'
import { formatCurrency } from '@/lib/format'

echarts.use([
  EHeatmapChart,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  CanvasRenderer,
])

registerChartThemes()

interface HeatmapProps {
  xLabels: string[] // e.g. ['00:00', '01:00', ..., '23:00']
  yLabels: string[] // e.g. resources ['ec2-ml-gpu-07', 'rds-pg-prod', ...]
  data: Array<[number, number, number]> // [xIndex, yIndex, value]
  height?: number | string
  className?: string
}

export function Heatmap({
  xLabels,
  yLabels,
  data,
  height = 300,
  className = '',
}: HeatmapProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const option = useMemo(() => {
    const values = data.map((d) => d[2])
    const maxVal = values.length > 0 ? Math.max(...values, 1) : 100

    return {
      grid: {
        top: 20,
        right: 80,
        bottom: 30,
        left: 110,
      },
      tooltip: {
        position: 'top',
        formatter: (params: { data: [number, number, number] }) => {
          const hour = xLabels[params.data[0]] || `${params.data[0]}:00`
          const resource = yLabels[params.data[1]] || `Resource ${params.data[1]}`
          const cost = params.data[2]

          return `
            <div class="font-mono text-xs">
              <div class="font-semibold text-foreground pb-1 mb-1 border-b border-border/50 truncate max-w-[200px]">${resource}</div>
              <div class="text-muted-foreground">Hour: <span class="text-foreground">${hour}</span></div>
              <div class="text-muted-foreground mt-0.5">Average Spend: <span class="text-primary font-bold">${formatCurrency(cost)}</span></div>
            </div>
          `
        },
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        splitArea: {
          show: true,
        },
        axisLabel: {
          fontSize: 10,
          interval: 2,
        },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        splitArea: {
          show: true,
        },
        axisLabel: {
          fontSize: 10,
          formatter: (val: string) => (val.length > 14 ? val.slice(0, 13) + '…' : val),
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        itemWidth: 12,
        itemHeight: 120,
        textStyle: {
          color: isDark ? '#8DA0B5' : '#64748B',
          fontSize: 10,
          fontFamily: '"Geist Mono Variable", monospace',
        },
        inRange: {
          color: isDark
            ? ['#101720', '#0F766E', '#2DD4BF', '#FBBF24', '#F43F5E']
            : ['#F1F5F9', '#99F6E4', '#14B8A6', '#F59E0B', '#EF4444'],
        },
      },
      series: [
        {
          name: 'Cost Distribution',
          type: 'heatmap',
          data,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    }
  }, [xLabels, yLabels, data, isDark])

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
