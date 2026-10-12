import { create } from 'zustand'
import { apiClient, ApiError } from '@/lib/api/client'
import { Role, UserProfile } from '@/lib/rbac'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  checkSession: () => Promise<UserProfile | null>
  login: (username: string, password: string) => Promise<UserProfile>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  checkSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await apiClient.get<UserProfile>('/auth/me')
      set({ user: res.data, isLoading: false, isInitialized: true })
      return res.data
    } catch {
      set({ user: null, isLoading: false, isInitialized: true })
      return null
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await apiClient.post<{ role: Role; expires_in: number }>('/auth/login', {
        username,
        password,
      })
      const user: UserProfile = {
        username,
        role: res.data.role,
        expires_at: Math.floor(Date.now() / 1000) + res.data.expires_in,
      }
      set({ user, isLoading: false })
      return user
    } catch (err: any) {
      const apiErr = err as ApiError
      set({ error: apiErr.message || 'Login failed', isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Ignore network failure on logout
    } finally {
      try {
        localStorage.setItem('ccad_logout_sync', String(Date.now()))
        localStorage.removeItem('ccad_logout_sync')
      } catch {
        // Storage might be unavailable or restricted
      }
      set({ user: null })
      window.location.href = '/login'
    }
  },
}))

// Cross-tab logout listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'ccad_logout_sync' && event.newValue) {
      useAuthStore.setState({ user: null })
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
  })
}
