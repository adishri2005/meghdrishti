import axios, { type AxiosRequestConfig } from 'axios'
import type {
  PromQueryResult,
  PromSample,
  PromMatrixSeries,
  PromTarget,
  PromAlert,
  PromRuleGroup,
} from './queries'

const promAxios = axios.create({
  baseURL: '/prometheus/api/v1',
  withCredentials: true,
  timeout: 10000,
})

// Add retry logic with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return withRetry(fn, retries - 1, delay * 2)
    }
    throw error
  }
}

/**
 * Calculates Prometheus range query step: max(5, ceil(rangeSeconds / 240))
 */
export function calculateStep(fromSec: number, toSec: number): number {
  const rangeSec = Math.max(1, toSec - fromSec)
  return Math.max(5, Math.ceil(rangeSec / 240))
}

export const promClient = {
  /**
   * Instant query at a given timestamp
   */
  async query(
    queryStr: string,
    timeSec?: number,
    signal?: AbortSignal
  ): Promise<PromQueryResult<PromSample[]>> {
    return withRetry(async () => {
      const params: Record<string, string | number> = { query: queryStr }
      if (timeSec) params.time = timeSec
      const res = await promAxios.get<PromQueryResult<PromSample[]>>('/query', {
        params,
        signal,
      })
      return res.data
    })
  },

  /**
   * Range query over a time interval [startSec, endSec] with step
   */
  async queryRange(
    queryStr: string,
    startSec: number,
    endSec: number,
    stepSec?: number,
    signal?: AbortSignal
  ): Promise<PromQueryResult<PromMatrixSeries[]>> {
    return withRetry(async () => {
      const step = stepSec || calculateStep(startSec, endSec)
      const res = await promAxios.get<PromQueryResult<PromMatrixSeries[]>>(
        '/query_range',
        {
          params: {
            query: queryStr,
            start: startSec,
            end: endSec,
            step,
          },
          signal,
        }
      )
      return res.data
    })
  },

  /**
   * List targets and their scrape status
   */
  async targets(signal?: AbortSignal): Promise<{ activeTargets: PromTarget[]; droppedTargets: unknown[] }> {
    return withRetry(async () => {
      const res = await promAxios.get<{
        status: string
        data: { activeTargets: PromTarget[]; droppedTargets: unknown[] }
      }>('/targets', { signal })
      return res.data.data
    })
  },

  /**
   * List active alerts
   */
  async alerts(signal?: AbortSignal): Promise<PromAlert[]> {
    return withRetry(async () => {
      const res = await promAxios.get<{
        status: string
        data: { alerts: PromAlert[] }
      }>('/alerts', { signal })
      return res.data.data.alerts || []
    })
  },

  /**
   * List alert and recording rules
   */
  async rules(signal?: AbortSignal): Promise<PromRuleGroup[]> {
    return withRetry(async () => {
      const res = await promAxios.get<{
        status: string
        data: { groups: PromRuleGroup[] }
      }>('/rules', { signal })
      return res.data.data.groups || []
    })
  },

  /**
   * Fetch label values (e.g. __name__ for autocomplete)
   */
  async labelValues(labelName = '__name__', signal?: AbortSignal): Promise<string[]> {
    return withRetry(async () => {
      const res = await promAxios.get<{ status: string; data: string[] }>(
        `/label/${encodeURIComponent(labelName)}/values`,
        { signal }
      )
      return res.data.data || []
    })
  },

  /**
   * Find series matching selectors
   */
  async series(
    matches: string[],
    startSec?: number,
    endSec?: number,
    signal?: AbortSignal
  ): Promise<Array<Record<string, string>>> {
    return withRetry(async () => {
      const config: AxiosRequestConfig = {
        params: {
          'match[]': matches,
          ...(startSec ? { start: startSec } : {}),
          ...(endSec ? { end: endSec } : {}),
        },
        signal,
      }
      const res = await promAxios.get<{
        status: string
        data: Array<Record<string, string>>
      }>('/series', config)
      return res.data.data || []
    })
  },
}
