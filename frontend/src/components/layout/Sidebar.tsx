import { useState, useEffect } from 'react'
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
  X,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/hooks/useAuth'
import { canManageSettings, canViewLogs } from '@/lib/rbac'
import { useOverviewStats } from '@/hooks/useOverview'

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useUIStore()
  const { user, logout } = useAuthStore()

  const [monitoringOpen, setMonitoringOpen] = useState(
    location.pathname.startsWith('/monitoring')
  )
  const [logsOpen, setLogsOpen] = useState(
    location.pathname.startsWith('/logs')
  )

  // Auto-expand active group on route change
  useEffect(() => {
    if (location.pathname.startsWith('/monitoring')) {
      setMonitoringOpen(true)
    }
    if (location.pathname.startsWith('/logs')) {
      setLogsOpen(true)
    }
  }, [location.pathname])

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, setMobileMenuOpen])

  const { data: stats } = useOverviewStats()
  const openCount = stats?.anomalies_open?.total ?? 0
  const hasCritical = (stats?.anomalies_open?.critical ?? 0) > 0

  const navItemClass = (isActive: boolean, isCollapsed: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group relative ${
      isActive
        ? 'bg-muted/80 text-foreground font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-primary before:rounded-r'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
    } ${isCollapsed ? 'justify-center px-0' : ''}`

  const subNavItemClass = (isActive: boolean) =>
    `block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
      isActive
        ? 'text-foreground font-medium bg-muted/60'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
    }`

  const isMonitoringSubActive = (target: string) => {
    const segments = location.pathname.split('/').filter(Boolean)
    if (segments[0] === 'monitoring') {
      const sub = segments[1]?.toLowerCase()
      if (!sub || sub === 'overview' || sub === 'native') {
        const tab = new URLSearchParams(location.search).get('tab')?.toLowerCase()
        if (tab) {
          return (target === 'native' && (tab === 'overview' || tab === 'native')) || target === tab
        }
        return target === 'native'
      }
      return sub === target
    }
    return false
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const renderContent = (isCollapsed: boolean, isMobile: boolean) => (
    <div className="flex flex-col h-full justify-between">
      {/* Top Header & Navigation */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-14 border-b border-border px-3.5 flex items-center justify-between shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5 min-w-0 overflow-hidden group">
            {/* Minimalist Shield Mark */}
            <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
              <svg
                className="w-4 h-4"
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
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs tracking-tight text-foreground truncate">
                  Meghdrishti
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase truncate">
                  FinOps Control
                </span>
              </div>
            )}
          </NavLink>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav id="tour-sidebar-nav" className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-none">
          {/* Overview */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && <span>Overview</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Overview
              </span>
            )}
          </NavLink>

          {/* Anomalies */}
          <NavLink
            to="/anomalies"
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate">Anomalies</span>
                {openCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                      hasCritical
                        ? 'bg-danger/15 text-danger border border-danger/30'
                        : 'bg-warning/15 text-warning border border-warning/30'
                    }`}
                  >
                    {openCount}
                  </span>
                )}
              </div>
            )}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Anomalies ({openCount})
              </span>
            )}
          </NavLink>

          {/* Costs */}
          <NavLink
            to="/costs"
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <DollarSign className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && <span>Costs</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Costs
              </span>
            )}
          </NavLink>

          {/* Resources */}
          <NavLink
            to="/resources"
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <Server className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && <span>Resources</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Resources
              </span>
            )}
          </NavLink>

          {/* Ingestion */}
          <NavLink
            to="/ingestion"
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <Zap className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && <span>Ingestion</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Ingestion
              </span>
            )}
          </NavLink>

          {/* Monitoring Group */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (isCollapsed && !isMobile) toggleSidebar()
                setMonitoringOpen(!monitoringOpen)
              }}
              aria-expanded={monitoringOpen}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ${
                location.pathname.startsWith('/monitoring')
                  ? 'text-foreground font-medium bg-muted/40'
                  : ''
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? 'Monitoring' : undefined}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                {!isCollapsed && <span>Monitoring</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                    monitoringOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {monitoringOpen && !isCollapsed && (
              <div className="ml-6 mt-1 space-y-0.5 pl-2 border-l border-border/60">
                <NavLink
                  to="/monitoring/native"
                  className={() => subNavItemClass(isMonitoringSubActive('native'))}
                >
                  Native Charts
                </NavLink>
                <NavLink
                  to="/monitoring/grafana"
                  className={() => subNavItemClass(isMonitoringSubActive('grafana'))}
                >
                  Grafana (Embedded)
                </NavLink>
                <NavLink
                  to="/monitoring/prometheus"
                  className={() => subNavItemClass(isMonitoringSubActive('prometheus'))}
                >
                  Prometheus Console
                </NavLink>
                <NavLink
                  to="/monitoring/alerts"
                  className={() => subNavItemClass(isMonitoringSubActive('alerts'))}
                >
                  Alert Rules
                </NavLink>
                <NavLink
                  to="/monitoring/targets"
                  className={() => subNavItemClass(isMonitoringSubActive('targets'))}
                >
                  Scrape Targets
                </NavLink>
              </div>
            )}
          </div>

          {/* Logs Group (Admin only) */}
          {canViewLogs(user?.role) && (
            <div>
              <button
                type="button"
                onClick={() => {
                  if (isCollapsed && !isMobile) toggleSidebar()
                  setLogsOpen(!logsOpen)
                }}
                aria-expanded={logsOpen}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ${
                  location.pathname.startsWith('/logs')
                    ? 'text-foreground font-medium bg-muted/40'
                    : ''
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? 'Logs' : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {!isCollapsed && <span>Logs</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                      logsOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {logsOpen && !isCollapsed && (
                <div className="ml-6 mt-1 space-y-0.5 pl-2 border-l border-border/60">
                  <NavLink
                    to="/logs/app"
                    className={({ isActive }) => subNavItemClass(isActive)}
                  >
                    Application Live Tail
                  </NavLink>
                  <NavLink
                    to="/logs/audit"
                    className={({ isActive }) => subNavItemClass(isActive)}
                  >
                    Audit Trail
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {/* Deployments */}
          <NavLink
            to="/deployments"
            className={({ isActive }) => navItemClass(isActive, isCollapsed)}
          >
            <GitBranch className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            {!isCollapsed && <span>Deployments</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Deployments
              </span>
            )}
          </NavLink>

          {/* Settings (Admin only) */}
          {canManageSettings(user?.role) && (
            <NavLink
              to="/settings"
              className={({ isActive }) => navItemClass(isActive, isCollapsed)}
            >
              <SettingsIcon className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
              {!isCollapsed && <span>Settings</span>}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  Settings
                </span>
              )}
            </NavLink>
          )}
        </nav>
      </div>

      {/* Bottom Environment & User Info */}
      <div className="p-2.5 border-t border-border space-y-2 shrink-0">
        {/* Environment Card */}
        {!isCollapsed && (
          <div className="p-2 rounded-md bg-surface-elevated/60 border border-border/60 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Cluster</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-mono text-[11px] font-medium text-foreground">
                  Blue (Active)
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
        <div className="flex items-center justify-between p-1" id="tour-user-panel">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center font-medium text-xs shrink-0 border border-border">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground truncate">
                  {user?.username || 'User'}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono capitalize">
                  {user?.role || 'Operator'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex h-screen sticky top-0 border-r border-border bg-surface flex-col justify-between transition-all duration-200 z-40 select-none ${
          sidebarCollapsed ? 'w-14' : 'w-60'
        }`}
      >
        {renderContent(sidebarCollapsed, false)}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-overlay/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-surface border-r border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
            {renderContent(false, true)}
          </aside>
        </div>
      )}
    </>
  )
}
