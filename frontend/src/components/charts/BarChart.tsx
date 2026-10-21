import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { BarChart as EBarChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'

echarts.use([
  EBarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
])

registerChartThemes()

export interface BarSeriesItem {
  name: string
  data: number[]
  color?: string
  stack?: string
}

interface BarChartProps {
  categories: string[]
  series: BarSeriesItem[]
  height?: number | string
  horizontal?: boolean
  showLegend?: boolean
  valueFormatter?: (val: number) => string
  className?: string
}

export function BarChart({
  categories,
  series,
  height = 260,
  horizontal = false,
  showLegend = false,
  valueFormatter,
  className = '',
}: BarChartProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const option = useMemo(() => {
    const eSeries = series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: s.stack,
      itemStyle: {
        color: s.color,
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      data: s.data,
    }))

    const categoryAxis = {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 10,
        interval: 0,
        rotate: horizontal ? 0 : categories.length > 8 ? 30 : 0,
      },
    }

    const valueAxis = {
      type: 'value',
      axisLabel: {
        formatter: (v: number) => (valueFormatter ? valueFormatter(v) : `${v}`),
        fontSize: 10,
      },
    }

    return {
      grid: {
        top: showLegend ? 35 : 15,
        right: 20,
        bottom: horizontal ? 20 : categories.length > 8 ? 45 : 25,
        left: horizontal ? 80 : 45,
      },
      legend: showLegend
        ? {
            show: true,
            top: 0,
            type: 'scroll',
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: Array<{ seriesName: string; name: string; color: string; value: number }>) => {
          if (!params || params.length === 0) return ''
          let body = `<div class="font-mono text-[11px] text-muted-foreground pb-1 mb-1 border-b border-border/50">${params[0].name}</div>`
          params.forEach((p) => {
            const valStr = valueFormatter ? valueFormatter(p.value) : `${p.value}`
            body += `
              <div class="flex items-center justify-between gap-4 py-0.5 text-xs">
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" style="background-color: ${p.color};"></span>
                  <span class="text-muted-foreground font-sans">${p.seriesName}</span>
                </div>
                <span class="font-mono font-medium text-foreground ml-auto">${valStr}</span>
              </div>
            `
          })
          return body
        },
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: eSeries,
    }
  }, [categories, series, horizontal, showLegend, valueFormatter])

  return (
    <div className={`w-full ${className}`}>
      <ReactECharts
        ref={chartRef}
        option={option}
        theme={isDark ? 'meghdrishti-dark' : 'meghdrishti-light'}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
