import { apiClient } from '../client'
import { ThresholdsSchema, type Thresholds } from '../types'

export const DEFAULT_THRESHOLDS: Thresholds = {
  detection: {
    z_threshold: 3.0,
    pct_jump_threshold: 50.0,
    ewma_alpha: 0.2,
    min_samples: 10,
    drift_ratio_threshold: 1.2,
    aggregate_cost_threshold: 1000.0,
    dedup_window_seconds: 3600,
  },
  severity: {
    critical: { z: 5.0, pct: 150.0 },
    high: { z: 4.0, pct: 100.0 },
    medium: { z: 3.0, pct: 50.0 },
  },
}

export async function getThresholds(): Promise<Thresholds> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return DEFAULT_THRESHOLDS
  }

  try {
    const res = await apiClient.get<Thresholds>('/config/thresholds')
    return ThresholdsSchema.parse(res.data)
  } catch (error) {
    if (import.meta.env.DEV) {
      return DEFAULT_THRESHOLDS
    }
    throw error
  }
}

export async function updateThresholds(payload: Partial<Thresholds>): Promise<Thresholds> {
  if (import.meta.env.VITE_MOCK === 'true') {
    return {
      ...DEFAULT_THRESHOLDS,
      detection: { ...DEFAULT_THRESHOLDS.detection, ...payload.detection },
      severity: { ...DEFAULT_THRESHOLDS.severity, ...payload.severity },
    }
  }

  const res = await apiClient.put<Thresholds>('/config/thresholds', payload)
  return ThresholdsSchema.parse(res.data)
}
