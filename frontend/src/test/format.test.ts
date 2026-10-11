import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCompactNumber,
  formatPercent,
  formatDuration,
  formatBytes,
  formatRate,
  formatTimestamp,
  formatNumber,
} from '@/lib/format'

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('formats standard currency with 2 decimals', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(0)).toBe('$0.00')
      expect(formatCurrency(null)).toBe('$0.00')
    })

    it('formats compact currency when requested', () => {
      expect(formatCurrency(1500, { compact: true })).toBe('$1.5k')
      expect(formatCurrency(2400000, { compact: true })).toBe('$2.4M')
      expect(formatCurrency(45, { compact: true })).toBe('$45.00')
    })
  })

  describe('formatCompactNumber', () => {
    it('formats large numbers into compact units', () => {
      expect(formatCompactNumber(1250)).toBe('1.3K')
      expect(formatCompactNumber(5000000)).toBe('5M')
      expect(formatCompactNumber(0)).toBe('0')
    })
  })

  describe('formatPercent', () => {
    it('formats percentage with decimal places and sign', () => {
      expect(formatPercent(12.34)).toBe('12.3%')
      expect(formatPercent(45.6, { includeSign: true })).toBe('+45.6%')
      expect(formatPercent(0)).toBe('0.0%')
    })
  })

  describe('formatDuration', () => {
    it('formats durations across scales', () => {
      expect(formatDuration(0.0005)).toBe('<1ms')
      expect(formatDuration(0.25)).toBe('250ms')
      expect(formatDuration(4.2)).toBe('4.2s')
      expect(formatDuration(45)).toBe('45s')
      expect(formatDuration(90)).toBe('1m 30s')
      expect(formatDuration(3660)).toBe('1h 1m')
    })
  })

  describe('formatBytes', () => {
    it('formats byte quantities', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1048576 * 5)).toBe('5.0 MB')
    })
  })

  describe('formatRate', () => {
    it('formats rates with units', () => {
      expect(formatRate(45.2, 'req/s')).toBe('45.2 req/s')
    })
  })

  describe('formatTimestamp and formatNumber', () => {
    it('formats timestamps into ISO-like date string', () => {
      const d = new Date('2026-05-10T12:00:00Z')
      expect(formatTimestamp(d)).toContain('2026-05-10')
    })

    it('formats numbers with commas', () => {
      expect(formatNumber(12345.67)).toBe('12,345.67')
    })
  })
})
