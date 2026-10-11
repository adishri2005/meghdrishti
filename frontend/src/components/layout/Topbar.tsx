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
  } = useUIStore()

  const [timeRange, setTimeRange] = useTimeRange()
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const [refreshDropdownOpen, setRefreshDropdownOpen] = useState(false)

  const getThemeIcon = (t: Theme) => {
    switch (t) {
      case 'dark':
        return <Moon className="w-4 h-4 text-info" />
      case 'light':
        return <Sun className="w-4 h-4 text-warning" />
      case 'system':
        return <Laptop className="w-4 h-4 text-muted-foreground" />
    }
  }

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center min-w-0">
        <Breadcrumbs />
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/50 hover:bg-muted/40 text-muted-foreground text-xs w-64 lg:w-80 justify-between transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          <span>Quick search or command...</span>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Global Time Range Selector */}
        <div className="relative">
          <button
            onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-muted/50 text-foreground text-xs font-medium transition-colors"
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
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl card-surface border border-border shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Select Range
                </div>
                {TIME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setTimeRange(p.id)
                      setTimeDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      timeRange.preset === p.id
                        ? 'text-primary font-semibold'
                        : 'text-foreground'
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
          <div className="flex items-center rounded-lg border border-border bg-surface text-xs font-medium overflow-hidden">
            <button
              onClick={toggleLive}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${
                liveEnabled
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={liveEnabled ? 'Pause auto-refresh' : 'Enable live auto-refresh'}
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  liveEnabled ? 'text-primary animate-pulse' : 'text-muted-foreground'
                }`}
              />
              <span>Live</span>
            </button>

            <button
              onClick={() => setRefreshDropdownOpen(!refreshDropdownOpen)}
              className="px-1.5 py-1.5 hover:bg-muted/50 text-muted-foreground transition-colors border-l border-border"
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
              <div className="absolute right-0 mt-1.5 w-36 rounded-xl card-surface border border-border shadow-2xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Poll Interval
                </div>
                {REFRESH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setRefreshInterval(opt.value)
                      setRefreshDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50 transition-colors ${
                      refreshInterval === opt.value
                        ? 'text-primary font-semibold'
                        : 'text-foreground'
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
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Refresh now (r)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title={`Theme: ${theme} (Click to change or press 't')`}
        >
          {getThemeIcon(theme)}
        </button>

        {/* Notifications */}
        <NotificationsMenu />
      </div>
    </header>
  )
}
