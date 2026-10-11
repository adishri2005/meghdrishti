import { formatDistanceToNow, format, isValid } from 'date-fns'

/**
 * Currency formatter with optional compact notation
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { decimals?: number; compact?: boolean } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return '$0.00'
  const { decimals = 2, compact = false } = options

  if (compact && Math.abs(value) >= 1000) {
    const units = ['', 'k', 'M', 'B']
    const order = Math.floor(Math.log10(Math.abs(value)) / 3)
    const unitName = units[order] || ''
    const num = (value / Math.pow(10, order * 3)).toFixed(1)
    return `$${num}${unitName}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Compact number formatter (e.g. 1.2k, 4.5M)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Format percentage with optional explicit plus sign
 */
export function formatPercent(
  value: number | null | undefined,
  options: { includeSign?: boolean; decimals?: number } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) return '0.0%'
  const { includeSign = false, decimals = 1 } = options
  const formatted = `${value.toFixed(decimals)}%`
  if (includeSign && value > 0) {
    return `+${formatted}`
  }
  return formatted
}

/**
 * Format duration in seconds to human readable form
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '0s'
  if (seconds < 0.001) return '<1ms'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = Math.round(seconds % 60)
  if (minutes < 60) {
    return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`
}

/**
 * Format bytes to human readable B, KB, MB, GB
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

/**
 * Relative time from now (e.g. 5m ago)
 */
export function formatRelativeTime(dateStr: string | Date | number | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = typeof dateStr === 'string' || typeof dateStr === 'number' ? new Date(dateStr) : dateStr
    if (!isValid(d)) return '-'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '-'
  }
}

/**
 * Absolute formatted date and time
 */
export function formatDateTime(
  dateStr: string | Date | number | null | undefined,
  pattern = 'yyyy-MM-dd HH:mm:ss'
): string {
  if (!dateStr) return '-'
  try {
    const d = typeof dateStr === 'string' || typeof dateStr === 'number' ? new Date(dateStr) : dateStr
    if (!isValid(d)) return '-'
    return format(d, pattern)
  } catch {
    return '-'
  }
}

/**
 * Formats rate numbers like req/s, records/s
 */
export function formatRate(
  val: number | null | undefined,
  unit = 'rec/s',
  decimals = 1
): string {
  if (val === null || val === undefined || isNaN(val)) return `0 ${unit}`
  return `${val.toFixed(decimals)} ${unit}`
}

/**
 * Formats a timestamp into a standard human readable string
 */
export function formatTimestamp(ts: number | string | Date): string {
  return formatDateTime(ts, 'yyyy-MM-dd HH:mm:ss')
}

/**
 * Formats generic number with decimal precision
 */
export function formatNumber(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '0'
  return val.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

