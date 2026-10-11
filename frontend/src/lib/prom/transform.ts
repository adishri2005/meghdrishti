import type { PromMatrixSeries } from './queries'

export type DataPoint = [number, number | null] // [timestamp_ms, value]

export interface EChartSeriesData {
  name: string
  data: DataPoint[]
  metric: Record<string, string>
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm
 * Keeps visual fidelity while limiting data points to target threshold (e.g. 1500)
 */
export function downsampleLTTB(data: DataPoint[], threshold = 1500): DataPoint[] {
  if (data.length <= threshold || threshold <= 2) return data

  const sampled: DataPoint[] = []
  const bucketSize = (data.length - 2) / (threshold - 2)

  let a = 0
  sampled.push(data[a]) // Always add the first point

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length)

    // Calculate average point for the next bucket (C)
    let avgX = 0
    let avgY = 0
    let count = 0
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += data[j][0]
      avgY += data[j][1] ?? 0
      count++
    }
    avgX = count > 0 ? avgX / count : 0
    avgY = count > 0 ? avgY / count : 0

    // Find the point in the current bucket with the largest triangle area (B)
    const currentStart = Math.floor(i * bucketSize) + 1
    const currentEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxAreaIndex = currentStart

    const pointAX = data[a][0]
    const pointAY = data[a][1] ?? 0

    for (let j = currentStart; j < currentEnd; j++) {
      const pointBX = data[j][0]
      const pointBY = data[j][1] ?? 0

      // Area of triangle ABC
      const area =
        Math.abs(
          (pointAX - avgX) * (pointBY - pointAY) -
            (pointAX - pointBX) * (avgY - pointAY)
        ) * 0.5

      if (area > maxArea) {
        maxArea = area
        maxAreaIndex = j
      }
    }

    sampled.push(data[maxAreaIndex])
    a = maxAreaIndex // Next A is this selected B
  }

  sampled.push(data[data.length - 1]) // Always add the last point
  return sampled
}

/**
 * Generate human readable series name from Prometheus labels
 */
export function formatSeriesName(metric: Record<string, string>, defaultName = 'Series'): string {
  if (!metric || Object.keys(metric).length === 0) return defaultName
  if (metric.job && metric.instance) return `${metric.job} (${metric.instance})`
  if (metric.job) return metric.job
  if (metric.severity) return metric.severity
  if (metric.status) return `HTTP ${metric.status}`
  if (metric.resource_id) return metric.resource_id
  if (metric.team) return metric.team
  if (metric.service) return metric.service
  if (metric.region) return metric.region
  if (metric.__name__) return metric.__name__

  // Fallback: join top 2 key-values
  const entries = Object.entries(metric).filter(([k]) => !k.startsWith('__'))
  if (entries.length > 0) {
    return entries
      .slice(0, 2)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ')
  }

  return defaultName
}

/**
 * Converts Prometheus matrix result into series ready for ECharts
 * Handles gaps (missing samples) by inserting nulls if time delta exceeds step * 2.5
 */
export function transformPromMatrix(
  matrix: PromMatrixSeries[],
  options: {
    stepSec?: number
    downsampleThreshold?: number
    nameFormatter?: (metric: Record<string, string>) => string
  } = {}
): EChartSeriesData[] {
  const {
    stepSec = 15,
    downsampleThreshold = 1500,
    nameFormatter = formatSeriesName,
  } = options

  return matrix.map((series) => {
    const rawData: DataPoint[] = []
    const gapThresholdMs = stepSec * 2500 // 2.5 * step in ms

    for (let i = 0; i < series.values.length; i++) {
      const [tsSec, valStr] = series.values[i]
      const tsMs = tsSec * 1000
      const valNum = valStr === 'NaN' || valStr === '+Inf' || valStr === '-Inf' ? null : parseFloat(valStr)

      // Gap check: if gap from previous point is too large, break line with null
      if (i > 0) {
        const prevTsMs = series.values[i - 1][0] * 1000
        if (tsMs - prevTsMs > gapThresholdMs) {
          rawData.push([prevTsMs + stepSec * 1000, null])
        }
      }

      rawData.push([tsMs, valNum])
    }

    const data =
      rawData.length > downsampleThreshold
        ? downsampleLTTB(rawData, downsampleThreshold)
        : rawData

    return {
      name: nameFormatter(series.metric),
      data,
      metric: series.metric,
    }
  })
}
