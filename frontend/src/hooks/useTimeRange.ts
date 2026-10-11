import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import {
  parseTimeRangeFromUrl,
  TimeRange,
  TimeRangePreset,
} from '@/lib/time'

export function useTimeRange(): [
  TimeRange,
  (preset: TimeRangePreset, customFrom?: string, customTo?: string) => void
] {
  const [searchParams, setSearchParams] = useSearchParams()

  const range = useMemo(() => {
    return parseTimeRangeFromUrl(searchParams)
  }, [searchParams])

  const setRange = useCallback(
    (preset: TimeRangePreset, customFrom?: string, customTo?: string) => {
      const nextParams = new URLSearchParams(searchParams)
      if (preset === 'custom' && customFrom && customTo) {
        nextParams.delete('range')
        nextParams.set('from', customFrom)
        nextParams.set('to', customTo)
      } else {
        nextParams.delete('from')
        nextParams.delete('to')
        nextParams.set('range', preset)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  return [range, setRange]
}
