import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { StatusStrip } from './StatusStrip'
import { CommandPalette } from './CommandPalette'
import { ShortcutsDialog } from './ShortcutsDialog'
import { IdleWarningDialog } from './IdleWarningDialog'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useAuthStore } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isInitialized, checkSession } = useAuthStore()

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (isInitialized && !user) {
      const current = location.pathname + location.search
      navigate(`/login?next=${encodeURIComponent(current)}`, { replace: true })
    }
  }, [isInitialized, user, navigate, location])

  const handleRefresh = () => {
    toast.success('Live dashboard data refreshed', { duration: 1500 })
  }

  useHotkeys({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
    onRefresh: handleRefresh,
  })

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 select-none">
        <svg
          className="w-12 h-12 text-primary animate-pulse mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span className="font-mono text-xl font-bold tracking-tight text-foreground mb-1">
          CostGuard
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          Verifying security session...
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Skip Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg focus:font-semibold focus:text-xs focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Topbar */}
        <Topbar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onRefresh={handleRefresh}
        />

        {/* Status Strip */}
        <StatusStrip />

        {/* Dynamic Route Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Shortcuts Dialog */}
      <ShortcutsDialog
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Idle Timeout Dialog */}
      <IdleWarningDialog />
    </div>
  )
}
