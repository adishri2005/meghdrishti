import { describe, it, expect } from 'vitest'
import { getMockCostTimeseries, getMockAnomalies } from '@/mocks/fixtures'

describe('Overview Cost and Anomaly Synchronization', () => {
  it('checks timestamps of cost timeseries and anomalies', () => {
    const costData = getMockCostTimeseries()
    const anomalies = getMockAnomalies()

    const mlSeries = costData.series.find((s) => s.name === 'ml')!
    const coreSeries = costData.series.find((s) => s.name === 'core')!

    console.log('Total cost points:', mlSeries.points.length)
    console.log('First point ts:', mlSeries.points[0][0])
    console.log('Last point ts:', mlSeries.points[mlSeries.points.length - 1][0])

    const spikeIndex = mlSeries.points.findIndex(([_, val]) => val > 100)
    const anomaly101 = anomalies.find((a) => a.id === 101)!
    const anomaly102 = anomalies.find((a) => a.id === 102)!

    expect(spikeIndex).toBeGreaterThan(-1)
    expect(mlSeries.points[spikeIndex][0]).toBe(anomaly101.record_ts)
    expect(coreSeries.points.some(([ts]) => ts === anomaly102.record_ts)).toBe(true)
  })
})
