import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
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
  Moon,
  Sun,
  Clock,
  ExternalLink,
  Copy,
  Flame,
} from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useTimeRange } from '@/hooks/useTimeRange'
import { MOCK_ANOMALIES, MOCK_RESOURCES } from '@/mocks/fixtures'
import { toast } from 'sonner'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { theme, setTheme } = useUIStore()
  const [, setTimeRange] = useTimeRange()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  if (!isOpen) return null

  const handleSelect = (callback: () => void) => {
    callback()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-xl card-surface border border-border-strong rounded-xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95">
        <Command
          value={search}
          onValueChange={setSearch}
          className="w-full flex flex-col focus:outline-none"
        >
          <div className="flex items-center px-4 border-b border-border">
            <Command.Input
              autoFocus
              placeholder="Type a command, jump to anomaly, or search resources..."
              className="w-full py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground font-mono">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="p-4 text-center text-xs text-muted-foreground">
              No results found for "{search}".
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <LayoutDashboard className="w-4 h-4 text-primary" />
                <span>Overview Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/anomalies'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span>Anomalies Explorer</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/costs'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <DollarSign className="w-4 h-4 text-info" />
                <span>Cost Analytics & Heatmaps</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/resources'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Server className="w-4 h-4 text-muted-foreground" />
                <span>Cloud Resources Catalog</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/ingestion'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Zap className="w-4 h-4 text-warning" />
                <span>Ingestion Pipeline & Simulator</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/monitoring/native'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Activity className="w-4 h-4 text-primary" />
                <span>Monitoring Hub (Native)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/logs/app'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Application Logs Viewer</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/deployments'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <GitBranch className="w-4 h-4 text-info" />
                <span>Blue/Green Deployments</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/settings'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <SettingsIcon className="w-4 h-4 text-muted-foreground" />
                <span>Settings & Thresholds</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Recent Incidents" className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              {MOCK_ANOMALIES.slice(0, 3).map((a) => (
                <Command.Item
                  key={a.id}
                  onSelect={() => handleSelect(() => navigate(`/anomalies/${a.id}`))}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                    <span className="font-mono">{a.resource_name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    z={a.z_score} (+{a.pct_increase}%)
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Resources" className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              {MOCK_RESOURCES.slice(0, 4).map((r) => (
                <Command.Item
                  key={r.id}
                  onSelect={() => handleSelect(() => navigate(`/resources/${r.resource_id}`))}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
                >
                  <span className="font-mono">{r.resource_id}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{r.team}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Quick Actions" className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/monitoring/grafana'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <ExternalLink className="w-4 h-4 text-warning" />
                <span>Open Grafana Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/monitoring/prometheus'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <ExternalLink className="w-4 h-4 text-danger" />
                <span>Open Prometheus Console</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  handleSelect(() => {
                    navigate('/ingestion')
                    toast.info('Simulator panel opened — inject spike ready')
                  })
                }
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Flame className="w-4 h-4 text-danger" />
                <span>Inject Anomaly Spike (Demo)</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  handleSelect(() => {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success('Shareable link copied to clipboard')
                  })
                }
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
                <span>Copy Shareable URL</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-info" />}
                <span>Toggle Theme ({theme === 'dark' ? 'Light' : 'Dark'})</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => setTimeRange('1h'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Set Time Range: Last 1 hour</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => setTimeRange('24h'))}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/15"
              >
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Set Time Range: Last 24 hours</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
