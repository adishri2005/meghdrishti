import { subMinutes, subHours, subDays, formatISO, parseISO, format } from 'date-fns'

export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom'

export interface TimeRange {
  preset: TimeRangePreset
  from: string // ISO string
  to: string   // ISO string
  label: string
}

export const TIME_PRESETS: { id: TimeRangePreset; label: string; getRange: () => { from: Date; to: Date } }[] = [
  {
    id: '15m',
    label: 'Last 15m',
    getRange: () => {
      const now = new Date()
      return { from: subMinutes(now, 15), to: now }
    },
  },
  {
    id: '1h',
    label: 'Last 1h',
    getRange: () => {
      const now = new Date()
      return { from: subHours(now, 1), to: now }
    },
  },
  {
    id: '6h',
    label: 'Last 6h',
    getRange: () => {
      const now = new Date()
      return { from: subHours(now, 6), to: now }
    },
  },
  {
    id: '24h',
    label: 'Last 24h',
    getRange: () => {
      const now = new Date()
      return { from: subHours(now, 24), to: now }
    },
  },
  {
    id: '7d',
    label: 'Last 7d',
    getRange: () => {
      const now = new Date()
      return { from: subDays(now, 7), to: now }
    },
  },
]

export function parseTimeRangeFromUrl(searchParams: URLSearchParams): TimeRange {
  const rangeParam = searchParams.get('range') as TimeRangePreset | null
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam && toParam) {
    try {
      const fromDate = parseISO(fromParam)
      const toDate = parseISO(toParam)
      return {
        preset: 'custom',
        from: formatISO(fromDate),
        to: formatISO(toDate),
        label: `${format(fromDate, 'MMM d, HH:mm')} - ${format(toDate, 'MMM d, HH:mm')}`,
      }
    } catch {
      // Fall through to preset
    }
  }

  const presetDef = TIME_PRESETS.find((p) => p.id === rangeParam) || TIME_PRESETS[3] // default 24h
  const { from, to } = presetDef.getRange()

  return {
    preset: presetDef.id,
    from: formatISO(from),
    to: formatISO(to),
    label: presetDef.label,
  }
}

export function formatTimeRangeForPrometheus(range: TimeRange): { start: number; end: number; step: number } {
  const start = Math.floor(new Date(range.from).getTime() / 1000)
  const end = Math.floor(new Date(range.to).getTime() / 1000)
  const rangeSeconds = Math.max(end - start, 60)
  // Step calculation: max(5, ceil(rangeSeconds / 240)) as specified in Section 9
  const step = Math.max(5, Math.ceil(rangeSeconds / 240))
  return { start, end, step }
}
