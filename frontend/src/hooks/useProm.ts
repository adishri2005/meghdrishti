import { useQuery } from '@tanstack/react-query'
import { useTimeRange } from './useTimeRange'
import { useUIStore } from '@/store/ui'
import { promClient, calculateStep } from '@/lib/prom/client'
import { transformPromMatrix, type EChartSeriesData } from '@/lib/prom/transform'
import type { PromSample, PromMatrixSeries } from '@/lib/prom/queries'

export interface UsePromInstantOptions {
  enabled?: boolean
  refetchInterval?: number
}

export function usePromInstant(
  queryStr: string,
  options: UsePromInstantOptions = {}
) {
  const { liveEnabled, refreshInterval } = useUIStore()
  const { enabled = true, refetchInterval } = options

  const effectiveInterval =
    refetchInterval !== undefined
      ? refetchInterval
      : liveEnabled && refreshInterval > 0
      ? refreshInterval * 1000
      : false

  return useQuery<PromSample[], Error>({
    queryKey: ['prom', 'instant', queryStr],
    queryFn: async ({ signal }) => {
      const res = await promClient.query(queryStr, undefined, signal)
      if (res.status === 'error') {
        throw new Error(res.error || 'Prometheus query failed')
      }
      return (res.data?.result as PromSample[]) || []
    },
    enabled: enabled && !!queryStr,
    refetchInterval: effectiveInterval,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  })
}

export interface UsePromRangeOptions {
  stepSec?: number
  enabled?: boolean
  refetchInterval?: number
  nameFormatter?: (metric: Record<string, string>) => string
}

export function usePromRange(
  queryStr: string,
  options: UsePromRangeOptions = {}
) {
  const [timeRange] = useTimeRange()
  const { liveEnabled, refreshInterval } = useUIStore()
  const { enabled = true, stepSec, refetchInterval, nameFormatter } = options

  const effectiveInterval =
    refetchInterval !== undefined
      ? refetchInterval
      : liveEnabled && refreshInterval > 0
      ? refreshInterval * 1000
      : false

  const startSec = Math.floor(new Date(timeRange.from).getTime() / 1000)
  const endSec = Math.floor(new Date(timeRange.to).getTime() / 1000)
  const step = stepSec || calculateStep(startSec, endSec)

  const query = useQuery<PromMatrixSeries[], Error>({
    queryKey: ['prom', 'range', queryStr, startSec, endSec, step],
    queryFn: async ({ signal }) => {
      const res = await promClient.queryRange(
        queryStr,
        startSec,
        endSec,
        step,
        signal
      )
      if (res.status === 'error') {
        throw new Error(res.error || 'Prometheus range query failed')
      }
      return (res.data?.result as PromMatrixSeries[]) || []
    },
    enabled: enabled && !!queryStr && endSec > startSec,
    refetchInterval: effectiveInterval,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })

  const series: EChartSeriesData[] = query.data
    ? transformPromMatrix(query.data, {
        stepSec: step,
        nameFormatter,
      })
    : []

  return {
    ...query,
    series,
    rawData: query.data || [],
    stepSec: step,
  }
}
