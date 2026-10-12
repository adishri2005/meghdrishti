import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const routeLabels: Record<string, string> = {
  anomalies: 'Anomalies',
  costs: 'Costs',
  resources: 'Resources',
  ingestion: 'Ingestion Pipeline',
  monitoring: 'Monitoring',
  native: 'Native Charts',
  grafana: 'Grafana',
  prometheus: 'Prometheus',
  alerts: 'Alert Rules',
  targets: 'Scrape Targets',
  logs: 'Logs',
  app: 'Application Logs',
  audit: 'Audit Trail',
  deployments: 'Deployments',
  settings: 'Settings',
}

export function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return (
      <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5">
        <Home className="w-3.5 h-3.5 text-primary" />
        <span className="text-foreground font-semibold">Overview</span>
      </div>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-muted-foreground gap-1.5">
      <Link
        to="/"
        className="hover:text-foreground transition-colors flex items-center gap-1"
        title="Overview"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1
        const path = `/${segments.slice(0, idx + 1).join('/')}`
        const label = routeLabels[seg] || seg

        return (
          <div key={path} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-border-strong" />
            {isLast ? (
              <span className="text-foreground font-semibold capitalize">{label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors capitalize">
                {label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
