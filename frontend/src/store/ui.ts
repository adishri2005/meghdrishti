import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'system'
export type Density = 'comfortable' | 'compact'

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  liveEnabled: boolean
  toggleLive: () => void
  setLiveEnabled: (enabled: boolean) => void
  refreshInterval: number // seconds: 0 (Off), 5, 10, 30, 60
  setRefreshInterval: (interval: number) => void
  density: Density
  setDensity: (density: Density) => void
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  reduceMotionOverride: boolean
  setReduceMotionOverride: (override: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme })
        applyThemeToDocument(theme)
      },
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      liveEnabled: true,
      toggleLive: () => set((state) => ({ liveEnabled: !state.liveEnabled })),
      setLiveEnabled: (liveEnabled) => set({ liveEnabled }),
      refreshInterval: 10,
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      soundEnabled: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      reduceMotionOverride: false,
      setReduceMotionOverride: (reduceMotionOverride) => set({ reduceMotionOverride }),
    }),
    {
      name: 'costguard-ui-preferences',
    }
  )
)

export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(systemDark ? 'dark' : 'light')
  } else {
    root.classList.add(theme)
  }
}
