import * as echarts from 'echarts/core'

export const CHART_PALETTE = [
  '#2DD4BF', // brand teal
  '#60A5FA', // sky blue
  '#A78BFA', // soft violet
  '#FBBF24', // amber
  '#FB7185', // rose
  '#34D399', // emerald
  '#F472B6', // pink
  '#94A3B8', // slate
]

export const SEVERITY_COLORS = {
  critical: '#F43F5E',
  high: '#FB923C',
  medium: '#FBBF24',
  low: '#38BDF8',
}

const darkTheme = {
  color: CHART_PALETTE,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '"Geist Variable", Inter, system-ui, sans-serif',
    color: '#8DA0B5',
  },
  title: {
    textStyle: {
      color: '#E7EDF4',
      fontWeight: 600,
    },
    subtextStyle: {
      color: '#8DA0B5',
    },
  },
  line: {
    itemStyle: {
      borderWidth: 2,
    },
    lineStyle: {
      width: 2,
    },
    symbolSize: 4,
    symbol: 'emptyCircle',
    smooth: true,
  },
  bar: {
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
    },
  },
  categoryAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: '#223041',
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#8DA0B5',
      fontSize: 11,
      fontFamily: '"Geist Mono Variable", monospace',
    },
    splitLine: {
      show: false,
    },
  },
  valueAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#8DA0B5',
      fontSize: 11,
      fontFamily: '"Geist Mono Variable", monospace',
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#172130',
        type: 'dashed',
      },
    },
  },
  tooltip: {
    backgroundColor: '#101720',
    borderColor: '#223041',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: {
      color: '#E7EDF4',
      fontSize: 12,
      fontFamily: '"Geist Variable", sans-serif',
    },
    extraCssText:
      'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5); border-radius: 8px; backdrop-filter: blur(8px);',
    axisPointer: {
      lineStyle: {
        color: '#2DD4BF',
        type: 'dashed',
        width: 1,
      },
      crossStyle: {
        color: '#2DD4BF',
      },
    },
  },
  legend: {
    textStyle: {
      color: '#8DA0B5',
      fontSize: 12,
    },
    inactiveColor: '#3B4E63',
    icon: 'circle',
  },
  dataZoom: {
    backgroundColor: 'rgba(23, 33, 48, 0.5)',
    dataBackgroundColor: '#223041',
    fillerColor: 'rgba(45, 212, 191, 0.15)',
    handleColor: '#2DD4BF',
    handleSize: '100%',
    textStyle: {
      color: '#8DA0B5',
    },
  },
}

const lightTheme = {
  color: CHART_PALETTE,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '"Geist Variable", Inter, system-ui, sans-serif',
    color: '#64748B',
  },
  title: {
    textStyle: {
      color: '#0F1B2A',
      fontWeight: 600,
    },
    subtextStyle: {
      color: '#64748B',
    },
  },
  line: {
    itemStyle: {
      borderWidth: 2,
    },
    lineStyle: {
      width: 2,
    },
    symbolSize: 4,
    symbol: 'emptyCircle',
    smooth: true,
  },
  bar: {
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
    },
  },
  categoryAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: '#DDE5EE',
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#64748B',
      fontSize: 11,
      fontFamily: '"Geist Mono Variable", monospace',
    },
    splitLine: {
      show: false,
    },
  },
  valueAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#64748B',
      fontSize: 11,
      fontFamily: '"Geist Mono Variable", monospace',
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#F1F5F9',
        type: 'dashed',
      },
    },
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE5EE',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: {
      color: '#0F1B2A',
      fontSize: 12,
      fontFamily: '"Geist Variable", sans-serif',
    },
    extraCssText:
      'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border-radius: 8px;',
    axisPointer: {
      lineStyle: {
        color: '#0F9D8A',
        type: 'dashed',
        width: 1,
      },
      crossStyle: {
        color: '#0F9D8A',
      },
    },
  },
  legend: {
    textStyle: {
      color: '#64748B',
      fontSize: 12,
    },
    inactiveColor: '#CBD5E1',
    icon: 'circle',
  },
  dataZoom: {
    backgroundColor: 'rgba(241, 245, 249, 0.5)',
    dataBackgroundColor: '#E2E8F0',
    fillerColor: 'rgba(15, 157, 138, 0.15)',
    handleColor: '#0F9D8A',
    handleSize: '100%',
    textStyle: {
      color: '#64748B',
    },
  },
}

let registered = false

export function registerChartThemes() {
  if (!registered) {
    echarts.registerTheme('meghdrishti-dark', darkTheme)
    echarts.registerTheme('meghdrishti-light', lightTheme)
    echarts.registerTheme('costguard-dark', darkTheme)
    echarts.registerTheme('costguard-light', lightTheme)
    registered = true
  }
}
