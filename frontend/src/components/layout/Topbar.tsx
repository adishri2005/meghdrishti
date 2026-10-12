import { useState } from 'react'
import {
  Search,
  Clock,
  RotateCw,
  Sun,
  Moon,
  Laptop,
  Radio,
  ChevronDown,
  Menu,
} from 'lucide-react'
import { Breadcrumbs } from './Breadcrumbs'
import { NotificationsMenu } from './NotificationsMenu'
import { useUIStore, Theme } from '@/store/ui'
import { useTimeRange } from '@/hooks/useTimeRange'
import { TIME_PRESETS } from '@/lib/time'

interface TopbarProps {
  onOpenCommandPalette: () => void
  onRefresh?: () => void
}

const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
]

export function Topbar({ onOpenCommandPalette, onRefresh }: TopbarProps) {
  const {
    theme,
    setTheme,
    liveEnabled,
    toggleLive,
    refreshInterval,
    setRefreshInterval,
    toggleMobileMenu,
  } = useUIStore()

  const [timeRange, setTimeRange] = useTimeRange()
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const [refreshDropdownOpen, setRefreshDropdownOpen] = useState(false)

  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case 'dark':
        return <Moon className="w-3.5 h-3.5 text-muted-foreground" />
      case 'light':
        return <Sun className="w-3.5 h-3.5 text-muted-foreground" />
      case 'system':
        return <Laptop className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  return (
    <header className="h-12 border-b border-border bg-surface/80 backdrop-blur-md px-3.5 flex items-center justify-between gap-3 sticky top-0 z-30 select-none">
      {/* Left: Mobile hamburger + Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={toggleMobileMenu}
          className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <Breadcrumbs />
      </div>

      {/* Center: Command Palette Trigger (Linear/Raycast style) */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md border border-border/80 bg-surface-elevated/60 hover:bg-muted/50 text-muted-foreground text-xs w-60 lg:w-72 justify-between transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Search or jump to...</span>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-muted/70 border border-border text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Global Time Range Selector */}
        <div className="relative">
          <button
            onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-muted/50 text-foreground text-xs font-medium transition-colors shadow-xs"
            title="Global time range"
          >
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{timeRange.label}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {timeDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setTimeDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-44 rounded-lg bg-popover text-popover-foreground border border-border shadow-md z-50 py-1 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Time Range
                </div>
                {TIME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setTimeRange(p.id)
                      setTimeDropdownOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      timeRange.preset === p.id
                        ? 'text-foreground font-medium bg-muted/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{p.label}</span>
                    {timeRange.preset === p.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Live Auto-Refresh Selector */}
        <div className="relative">
          <div className="flex items-center rounded-md border border-border bg-surface text-xs font-medium overflow-hidden shadow-xs">
            <button
              onClick={toggleLive}
              className={`flex items-center gap-1.5 px-2 py-1 transition-colors ${
                liveEnabled
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={liveEnabled ? 'Pause auto-refresh' : 'Enable live auto-refresh'}
            >
              <Radio
                className={`w-3 h-3 ${
                  liveEnabled ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs">Live</span>
            </button>

            <button
              onClick={() => setRefreshDropdownOpen(!refreshDropdownOpen)}
              className="px-1.5 py-1 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors border-l border-border"
              title="Change refresh interval"
            >
              <span className="text-[11px] font-mono mr-0.5">
                {refreshInterval === 0 ? 'Off' : `${refreshInterval}s`}
              </span>
              <ChevronDown className="w-3 h-3 inline-block" />
            </button>
          </div>

          {refreshDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setRefreshDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-popover text-popover-foreground border border-border shadow-md z-50 py-1 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Poll Interval
                </div>
                {REFRESH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setRefreshInterval(opt.value)
                      setRefreshDropdownOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      refreshInterval === opt.value
                        ? 'text-foreground font-medium bg-muted/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {refreshInterval === opt.value && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Manual Refresh Trigger */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
            title="Refresh now (r)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className="p-1.5 rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
          title={`Theme: ${theme} (Click to change)`}
          aria-label={`Theme: ${theme}`}
        >
          {getThemeIcon(theme)}
        </button>

        {/* Notifications */}
        <NotificationsMenu />
      </div>
    </header>
  )
}
