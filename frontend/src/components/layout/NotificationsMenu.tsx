import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, AlertTriangle, ExternalLink } from 'lucide-react'
import { MOCK_ANOMALIES } from '@/mocks/fixtures'

export function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const urgentAnomalies = MOCK_ANOMALIES.filter(
    (a) => (a.severity === 'critical' || a.severity === 'high') && a.status === 'open'
  )
  const hasCritical = urgentAnomalies.some((a) => a.severity === 'critical')

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {urgentAnomalies.length > 0 && (
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
              hasCritical ? 'bg-danger animate-pulse' : 'bg-warning'
            }`}
          />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-xl card-surface border border-border shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Active Alerts</span>
              <span className="text-[10px] bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded font-mono font-medium">
                {urgentAnomalies.length} open
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
              {urgentAnomalies.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No critical or high anomalies active.
                </div>
              ) : (
                urgentAnomalies.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    to={`/anomalies/${a.id}`}
                    onClick={() => setIsOpen(false)}
                    className="p-3 block hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          a.severity === 'critical' ? 'text-danger' : 'text-warning'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-mono font-semibold text-foreground truncate">
                            {a.resource_name}
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase ${
                              a.severity === 'critical'
                                ? 'bg-danger/20 text-danger'
                                : 'bg-warning/20 text-warning'
                            }`}
                          >
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {a.root_cause_summary}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="p-2 border-t border-border bg-muted/20 text-center">
              <Link
                to="/anomalies"
                onClick={() => setIsOpen(false)}
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                View all incidents
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
