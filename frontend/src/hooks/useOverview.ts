import { useQuery } from '@tanstack/react-query'
import { getStatsOverview } from '@/lib/api/endpoints/stats'
import { getCostTimeseries, getCostHeatmap } from '@/lib/api/endpoints/costs'
import { getAnomalies } from '@/lib/api/endpoints/anomalies'
import { getCurrentDeployment } from '@/lib/api/endpoints/deployments'
import { useUIStore } from '@/store/ui'
import { useTimeRange } from './useTimeRange'

export function useOverviewStats() {
  const { liveEnabled, refreshInterval } = useUIStore()

  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: getStatsOverview,
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })
}

export function useOverviewCostTimeseries(groupBy = 'team') {
  const [timeRange] = useTimeRange()
  const { liveEnabled, refreshInterval } = useUIStore()

  return useQuery({
    queryKey: ['costs', 'timeseries', groupBy, timeRange.from, timeRange.to],
    queryFn: () =>
      getCostTimeseries({
        group_by: groupBy,
        from: timeRange.from,
        to: timeRange.to,
        interval: 'hour',
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  })
}

export function useOverviewHeatmap() {
  const [timeRange] = useTimeRange()
  const { liveEnabled, refreshInterval } = useUIStore()

  return useQuery({
    queryKey: ['costs', 'heatmap', timeRange.from, timeRange.to],
    queryFn: () =>
      getCostHeatmap({
        from: timeRange.from,
        to: timeRange.to,
      }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  })
}

export function useOverviewAnomalies(limit = 6) {
  const { liveEnabled, refreshInterval } = useUIStore()

  return useQuery({
    queryKey: ['anomalies', 'overview', limit],
    queryFn: () => getAnomalies({ status: 'open', limit }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  })
}

export function useOverviewDeployment() {
  const { liveEnabled, refreshInterval } = useUIStore()

  return useQuery({
    queryKey: ['deployments', 'current'],
    queryFn: getCurrentDeployment,
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  })
}
