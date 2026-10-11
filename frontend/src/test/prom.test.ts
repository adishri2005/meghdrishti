import { describe, it, expect } from 'vitest'
import { calculateStep } from '@/lib/prom/client'
import {
  transformPromMatrix,
  downsampleLTTB,
  formatSeriesName,
  type DataPoint,
} from '@/lib/prom/transform'
import type { PromMatrixSeries } from '@/lib/prom/queries'

describe('Prometheus Data Transforms', () => {
  describe('calculateStep', () => {
    it('enforces minimum step of 5 seconds', () => {
      expect(calculateStep(1000, 1050)).toBe(5)
    })

    it('calculates step proportional to range (range / 240)', () => {
      // 1 hour = 3600s / 240 = 15s
      expect(calculateStep(0, 3600)).toBe(15)
      // 24 hours = 86400s / 240 = 360s
      expect(calculateStep(0, 86400)).toBe(360)
    })
  })

  describe('formatSeriesName', () => {
    it('extracts job and instance', () => {
      const name = formatSeriesName({ job: 'worker', instance: 'worker-1' })
      expect(name).toBe('worker (worker-1)')
    })

    it('falls back to job or severity', () => {
      expect(formatSeriesName({ severity: 'critical' })).toBe('critical')
      expect(formatSeriesName({ resource_id: 'ec2-ml-gpu-07' })).toBe('ec2-ml-gpu-07')
    })
  })

  describe('downsampleLTTB', () => {
    it('returns raw points if under threshold', () => {
      const points: DataPoint[] = [
        [100, 10],
        [200, 20],
        [300, 30],
      ]
      expect(downsampleLTTB(points, 10)).toHaveLength(3)
    })

    it('downsamples larger array while keeping bounds', () => {
      const points: DataPoint[] = Array.from({ length: 500 }).map((_, i) => [
        i * 1000,
        Math.sin(i / 10) * 100,
      ])
      const reduced = downsampleLTTB(points, 50)
      expect(reduced.length).toBeLessThanOrEqual(50)
      expect(reduced[0]).toEqual(points[0])
      expect(reduced[reduced.length - 1]).toEqual(points[points.length - 1])
    })
  })

  describe('transformPromMatrix', () => {
    it('converts PromQL matrix into series with ms timestamps', () => {
      const matrix: PromMatrixSeries[] = [
        {
          metric: { job: 'api_active' },
          values: [
            [1700000000, '42.5'],
            [1700000015, '45.0'],
          ],
        },
      ]

      const series = transformPromMatrix(matrix, { stepSec: 15 })
      expect(series).toHaveLength(1)
      expect(series[0].name).toBe('api_active')
      expect(series[0].data).toEqual([
        [1700000000000, 42.5],
        [1700000015000, 45.0],
      ])
    })
  })
})
