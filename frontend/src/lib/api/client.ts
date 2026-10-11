import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

export interface ApiError {
  status: number
  code?: number | string
  message: string
  requestId?: string
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'X-Requested-With': 'CostGuard',
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attaches unique X-Request-ID
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = generateUuid()
  }
  return config
})

// Response interceptor: normalizes error and handles 401 redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; error?: { message?: string; code?: number } }>) => {
    const status = error.response?.status || 500
    const requestId = (error.config?.headers?.['X-Request-ID'] as string) || ''
    let message = 'An unexpected error occurred. Please try again.'

    if (error.response?.data) {
      if (typeof error.response.data.detail === 'string') {
        message = error.response.data.detail
      } else if (error.response.data.error?.message) {
        message = error.response.data.error.message
      }
    } else if (error.message) {
      message = error.message
    }

    const normalizedError: ApiError = {
      status,
      code: error.response?.data?.error?.code || status,
      message,
      requestId,
    }

    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      const currentPath = window.location.pathname + window.location.search
      window.location.href = `/login?next=${encodeURIComponent(currentPath)}`
    }

    return Promise.reject(normalizedError)
  }
)
