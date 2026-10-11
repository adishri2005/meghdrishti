import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/ui'

interface HotkeyOptions {
  onOpenCommandPalette: () => void
  onOpenShortcuts: () => void
  onRefresh?: () => void
}

export function useHotkeys({
  onOpenCommandPalette,
  onOpenShortcuts,
  onRefresh,
}: HotkeyOptions) {
  const navigate = useNavigate()
  const { theme, setTheme } = useUIStore()

  useEffect(() => {
    let gPressed = false
    let gTimeout: number | undefined

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea or contentEditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }

      // / opens command palette
      if (e.key === '/') {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }

      // ? opens shortcuts dialog
      if (e.key === '?') {
        e.preventDefault()
        onOpenShortcuts()
        return
      }

      // t toggles theme
      if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const nextTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(nextTheme)
        return
      }

      // r triggers refresh
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && onRefresh) {
        e.preventDefault()
        onRefresh()
        return
      }

      // Two-key chord navigation: 'g' then letter
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        gPressed = true
        window.clearTimeout(gTimeout)
        gTimeout = window.setTimeout(() => {
          gPressed = false
        }, 1000)
        return
      }

      if (gPressed) {
        gPressed = false
        window.clearTimeout(gTimeout)
        switch (e.key.toLowerCase()) {
          case 'o':
            navigate('/')
            break
          case 'a':
            navigate('/anomalies')
            break
          case 'c':
            navigate('/costs')
            break
          case 'm':
            navigate('/monitoring/native')
            break
          case 'l':
            navigate('/logs/app')
            break
          case 'd':
            navigate('/deployments')
            break
          case 's':
            navigate('/settings')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.clearTimeout(gTimeout)
    }
  }, [navigate, onOpenCommandPalette, onOpenShortcuts, onRefresh, theme, setTheme])
}
