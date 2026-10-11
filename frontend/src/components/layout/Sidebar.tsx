import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  DollarSign,
  Server,
  Zap,
  Activity,
  FileText,
  GitBranch,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { MOCK_ANOMALIES } from '@/mocks/fixtures'

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const [monitoringOpen, setMonitoringOpen] = useState(
    location.pathname.startsWith('/monitoring')
  )
  const [logsOpen, setLogsOpen] = useState(
    location.pathname.startsWith('/logs')
  )

  const openAnomalies = MOCK_ANOMALIES.filter((a) => a.status === 'open')
  const hasCritical = openAnomalies.some((a) => a.severity === 'critical')

  const navItemClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative ${
      isActive
        ? 'bg-primary/15 text-primary font-semibold shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
    }`

  const handleLogout = () => {
    // Call logout endpoint and redirect
    document.cookie = 'ccad_token=; Max-Age=0; path=/;'
    navigate('/login')
  }

  return (
    <aside
      className={`h-screen sticky top-0 border-r border-border bg-surface flex flex-col justify-between transition-all duration-300 z-40 select-none ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header & Navigation */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-14 border-b border-border px-4 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            {/* Inline SVG Shield & Pulse Mark */}
            <svg
              className="w-7 h-7 shrink-0 text-primary"
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
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-foreground font-mono">
                  CostGuard
                </span>
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  FinOps Mission Control
                </span>
              </div>
            )}
          </NavLink>

          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-none">
          {/* Overview */}
          <NavLink to="/" end className={({ isActive }) => navItemClass(isActive)}>
            <LayoutDashboard className="w-4 h-4 shrink-0 text-primary" />
            {!sidebarCollapsed && <span>Overview</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Overview
              </span>
            )}
          </NavLink>

          {/* Anomalies */}
          <NavLink to="/anomalies" className={({ isActive }) => navItemClass(isActive)}>
            <AlertTriangle className="w-4 h-4 shrink-0 text-warning" />
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span>Anomalies</span>
                {openAnomalies.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      hasCritical
                        ? 'bg-danger text-white animate-pulse'
                        : 'bg-warning/20 text-warning'
                    }`}
                  >
                    {openAnomalies.length}
                  </span>
                )}
              </div>
            )}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Anomalies ({openAnomalies.length})
              </span>
            )}
          </NavLink>

          {/* Costs */}
          <NavLink to="/costs" className={({ isActive }) => navItemClass(isActive)}>
            <DollarSign className="w-4 h-4 shrink-0 text-info" />
            {!sidebarCollapsed && <span>Costs</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Costs
              </span>
            )}
          </NavLink>

          {/* Resources */}
          <NavLink to="/resources" className={({ isActive }) => navItemClass(isActive)}>
            <Server className="w-4 h-4 shrink-0 text-muted-foreground" />
            {!sidebarCollapsed && <span>Resources</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Resources
              </span>
            )}
          </NavLink>

          {/* Ingestion */}
          <NavLink to="/ingestion" className={({ isActive }) => navItemClass(isActive)}>
            <Zap className="w-4 h-4 shrink-0 text-warning" />
            {!sidebarCollapsed && <span>Ingestion</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Ingestion
              </span>
            )}
          </NavLink>

          {/* Monitoring Group */}
          <div>
            <button
              onClick={() => {
                if (sidebarCollapsed) toggleSidebar()
                setMonitoringOpen(!monitoringOpen)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ${
                location.pathname.startsWith('/monitoring') ? 'text-foreground font-semibold' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 shrink-0 text-primary" />
                {!sidebarCollapsed && <span>Monitoring</span>}
              </div>
              {!sidebarCollapsed && (
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    monitoringOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {monitoringOpen && !sidebarCollapsed && (
              <div className="ml-7 mt-1 space-y-1 pl-2 border-l border-border/60">
                <NavLink
                  to="/monitoring/native"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Native Charts
                </NavLink>
                <NavLink
                  to="/monitoring/grafana"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Grafana (Embedded)
                </NavLink>
                <NavLink
                  to="/monitoring/prometheus"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Prometheus Console
                </NavLink>
                <NavLink
                  to="/monitoring/alerts"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Alert Rules
                </NavLink>
                <NavLink
                  to="/monitoring/targets"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Scrape Targets
                </NavLink>
              </div>
            )}
          </div>

          {/* Logs Group */}
          <div>
            <button
              onClick={() => {
                if (sidebarCollapsed) toggleSidebar()
                setLogsOpen(!logsOpen)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ${
                location.pathname.startsWith('/logs') ? 'text-foreground font-semibold' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                {!sidebarCollapsed && <span>Logs</span>}
              </div>
              {!sidebarCollapsed && (
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${logsOpen ? 'rotate-180' : ''}`}
                />
              )}
            </button>

            {logsOpen && !sidebarCollapsed && (
              <div className="ml-7 mt-1 space-y-1 pl-2 border-l border-border/60">
                <NavLink
                  to="/logs/app"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Application Live Tail
                </NavLink>
                <NavLink
                  to="/logs/audit"
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-[11px] ${
                      isActive
                        ? 'text-primary font-semibold bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  Audit Trail
                </NavLink>
              </div>
            )}
          </div>

          {/* Deployments */}
          <NavLink to="/deployments" className={({ isActive }) => navItemClass(isActive)}>
            <GitBranch className="w-4 h-4 shrink-0 text-info" />
            {!sidebarCollapsed && <span>Deployments</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Deployments
              </span>
            )}
          </NavLink>

          {/* Settings */}
          <NavLink to="/settings" className={({ isActive }) => navItemClass(isActive)}>
            <SettingsIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
            {!sidebarCollapsed && <span>Settings</span>}
            {sidebarCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-elevated text-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Settings
              </span>
            )}
          </NavLink>
        </nav>
      </div>

      {/* Bottom Environment & User Info */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Environment Card */}
        {!sidebarCollapsed && (
          <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Cluster Active</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-[11px] font-bold text-primary uppercase">
                  Blue
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>v1.0.0</span>
              <span className="text-success font-medium">Healthy</span>
            </div>
          </div>
        )}

        {/* User Chip & Logout */}
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">
                  Admin User
                </span>
                <span className="text-[10px] text-primary font-mono capitalize">
                  Administrator
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
