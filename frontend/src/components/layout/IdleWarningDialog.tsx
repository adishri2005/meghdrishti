import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, LogOut, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'

export function IdleWarningDialog() {
  const { user, logout, checkSession } = useAuthStore()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120)

  useEffect(() => {
    if (!user || !user.expires_at) return

    const interval = window.setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const diff = user.expires_at! - now

      // Show warning if 2 minutes (120s) or less remain
      if (diff <= 120 && diff > 0) {
        setShowWarning(true)
        setSecondsRemaining(diff)
      } else if (diff <= 0) {
        setShowWarning(false)
        logout()
      } else {
        setShowWarning(false)
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [user, logout])

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md card-surface border border-warning/30 rounded-xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Session Expiring Soon</h3>
            <p className="text-xs text-muted-foreground">You will be logged out due to inactivity.</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-4 h-4 text-warning" />
            <span>Time remaining:</span>
          </div>
          <span className="font-mono text-sm font-bold text-warning tabular-nums">
            {Math.floor(secondsRemaining / 60)}:
            {String(secondsRemaining % 60).padStart(2, '0')}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => logout()}
            className="px-3.5 py-2 rounded-lg text-xs font-medium border border-border bg-surface hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
          <button
            onClick={async () => {
              await checkSession()
              setShowWarning(false)
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Stay Signed In</span>
          </button>
        </div>
      </div>
    </div>
  )
}
