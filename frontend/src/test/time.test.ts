import { describe, it, expect } from 'vitest'
import {
  parseTimeRangeFromUrl,
  TIME_PRESETS,
} from '@/lib/time'

describe('Time Range Parsing and URL Sync', () => {
  it('parses default preset (24h) when URL has no params', () => {
    const params = new URLSearchParams()
    const range = parseTimeRangeFromUrl(params)
    expect(range.preset).toBe('24h')
    expect(range.from).toBeDefined()
    expect(range.to).toBeDefined()
  })

  it('parses preset when specified in query string', () => {
    const params = new URLSearchParams('range=1h')
    const range = parseTimeRangeFromUrl(params)
    expect(range.preset).toBe('1h')
    expect(range.label).toBe('Last 1h')
  })

  it('parses custom from/to ISO timestamps', () => {
    const fromStr = '2026-06-01T00:00:00.000Z'
    const toStr = '2026-06-01T12:00:00.000Z'
    const params = new URLSearchParams(`from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`)
    const range = parseTimeRangeFromUrl(params)
    expect(range.preset).toBe('custom')
    expect(new Date(range.from).getTime()).toBe(new Date(fromStr).getTime())
    expect(new Date(range.to).getTime()).toBe(new Date(toStr).getTime())
  })

  it('provides all 5 core presets', () => {
    const ids = TIME_PRESETS.map((p) => p.id)
    expect(ids).toEqual(['15m', '1h', '6h', '24h', '7d'])
  })
})
