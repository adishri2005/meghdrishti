import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { TreemapChart as ETreemapChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes, CHART_PALETTE } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'
import { formatCurrency, formatPercent } from '@/lib/format'

echarts.use([ETreemapChart, TooltipComponent, CanvasRenderer])

registerChartThemes()

export interface TreemapNode {
  name: string
  value: number
  children?: TreemapNode[]
}

interface TreemapProps {
  data: TreemapNode[]
  height?: number | string
  className?: string
}

export function Treemap({ data, height = 320, className = '' }: TreemapProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const totalValue = useMemo(() => {
    return data.reduce((acc, n) => acc + (n.value || 0), 0)
  }, [data])

  const option = useMemo(() => {
    return {
      tooltip: {
        formatter: (params: { data: TreemapNode }) => {
          const node = params.data
          const share = totalValue > 0 ? (node.value / totalValue) * 100 : 0
          return `
            <div class="font-mono text-xs">
              <div class="font-semibold text-foreground pb-1 mb-1 border-b border-border/50">${node.name}</div>
              <div class="text-muted-foreground">Spend: <span class="text-primary font-bold">${formatCurrency(node.value)}</span></div>
              <div class="text-muted-foreground mt-0.5">Share: <span class="text-foreground">${formatPercent(share)}</span></div>
            </div>
          `
        },
      },
      series: [
        {
          type: 'treemap',
          data,
          leafDepth: 2,
          roam: false,
          color: CHART_PALETTE,
          label: {
            show: true,
            formatter: '{b}\n${c}',
            fontSize: 11,
            fontFamily: '"Geist Variable", sans-serif',
          },
          upperLabel: {
            show: true,
            height: 24,
            fontSize: 12,
            color: isDark ? '#E7EDF4' : '#0F1B2A',
          },
          itemStyle: {
            borderColor: isDark ? '#0A0E13' : '#FFFFFF',
            borderWidth: 1.5,
            gapWidth: 1.5,
          },
          levels: [
            {
              itemStyle: {
                borderColor: isDark ? '#0A0E13' : '#FFFFFF',
                borderWidth: 2,
                gapWidth: 2,
              },
            },
            {
              colorSaturation: [0.35, 0.6],
              itemStyle: {
                borderColorSaturation: 0.7,
                gapWidth: 1,
              },
            },
          ],
        },
      ],
    }
  }, [data, totalValue, isDark])

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
