import { useId, useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  className?: string
}

export function Sparkline({
  data = [],
  width = 96,
  height = 28,
  color = 'hsl(var(--primary))',
  fill = true,
  className = '',
}: SparklineProps) {
  const uniqueId = useId().replace(/:/g, '')

  const points = useMemo(() => {
    if (!data || data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min === 0 ? 1 : max - min
    const padding = 2

    const effectiveHeight = height - padding * 2
    const stepX = (width - padding * 2) / (data.length - 1)

    const coords = data.map((val, idx) => {
      const x = padding + idx * stepX
      const y = height - padding - ((val - min) / range) * effectiveHeight
      return [x, y]
    })

    const pathD = coords.reduce((acc, [x, y], i) => {
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
    }, '')

    const areaD = `${pathD} L ${coords[coords.length - 1][0]} ${height} L ${coords[0][0]} ${height} Z`

    return { pathD, areaD, lastPoint: coords[coords.length - 1] }
  }, [data, width, height])

  if (!points) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground/50 font-mono ${className}`}
        style={{ width, height }}
      >
        --
      </div>
    )
  }

  const gradId = `spark-grad-${uniqueId}`

  return (
    <svg
      width={width}
      height={height}
      className={`overflow-visible shrink-0 ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {fill && (
        <path
          d={points.areaD}
          fill={`url(#${gradId})`}
        />
      )}

      <path
        d={points.pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Trailing dot */}
      <circle
        cx={points.lastPoint[0]}
        cy={points.lastPoint[1]}
        r="2"
        fill={color}
      />
    </svg>
  )
}
