import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { GaugeChart as EGaugeChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { registerChartThemes } from '@/lib/charts/chartTheme'
import { useUIStore } from '@/store/ui'

echarts.use([EGaugeChart, TooltipComponent, CanvasRenderer])

registerChartThemes()

interface GaugeProps {
  value: number
  min?: number
  max?: number
  name?: string
  unit?: string
  height?: number | string
  thresholds?: { warning: number; danger: number }
  className?: string
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  name = 'Utilization',
  unit = '%',
  height = 200,
  thresholds = { warning: 75, danger: 90 },
  className = '',
}: GaugeProps) {
  const { theme } = useUIStore()
  const chartRef = useRef<ReactECharts>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const option = useMemo(() => {
    const warningNormalized = (thresholds.warning - min) / (max - min)
    const dangerNormalized = (thresholds.danger - min) / (max - min)

    return {
      tooltip: {
        formatter: `{a} <br/>{b} : {c}${unit}`,
      },
      series: [
        {
          name,
          type: 'gauge',
          min,
          max,
          radius: '90%',
          center: ['50%', '55%'],
          startAngle: 210,
          endAngle: -30,
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [warningNormalized, '#2DD4BF'],
                [dangerNormalized, '#FBBF24'],
                [1, '#F43F5E'],
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: 'auto',
            },
            length: '65%',
            width: 4,
          },
          axisTick: {
            distance: -15,
            length: 4,
            lineStyle: {
              color: isDark ? '#223041' : '#DDE5EE',
              width: 1,
            },
          },
          splitLine: {
            distance: -18,
            length: 8,
            lineStyle: {
              color: isDark ? '#223041' : '#DDE5EE',
              width: 2,
            },
          },
          axisLabel: {
            color: isDark ? '#8DA0B5' : '#64748B',
            distance: -30,
            fontSize: 9,
            fontFamily: '"Geist Mono Variable", monospace',
          },
          detail: {
            valueAnimation: true,
            formatter: `{value}${unit}`,
            color: isDark ? '#E7EDF4' : '#0F1B2A',
            fontSize: 18,
            offsetCenter: [0, '70%'],
            fontFamily: '"Geist Mono Variable", monospace',
            fontWeight: 700,
          },
          title: {
            offsetCenter: [0, '95%'],
            fontSize: 11,
            color: isDark ? '#8DA0B5' : '#64748B',
            fontFamily: '"Geist Variable", sans-serif',
          },
          data: [
            {
              value: Math.round(value * 10) / 10,
              name,
            },
          ],
        },
      ],
    }
  }, [value, min, max, name, unit, thresholds, isDark])

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
