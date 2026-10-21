import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Settings as SettingsIcon,
  Sliders,
  Users,
  Key,
  Palette,
  Info,
  ExternalLink,
  ShieldAlert,
  Moon,
  Sun,
  Monitor,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuth'
import { isAdmin } from '@/lib/rbac'
import { useUIStore, type Theme, type Density } from '@/store/ui'
import { getThresholds, updateThresholds } from '@/lib/api/endpoints/config'
import { ThresholdForm } from '@/components/settings/ThresholdForm'
import { UsersPanel } from '@/components/settings/UsersPanel'
import { ApiClientsPanel } from '@/components/settings/ApiClientsPanel'
import { SkeletonCard } from '@/components/data/SkeletonCard'
import type { Thresholds } from '@/lib/api/types'

type SettingsTab = 'thresholds' | 'users' | 'api-clients' | 'appearance' | 'about'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('thresholds')
  const { user } = useAuthStore()
  const userIsAdmin = isAdmin(user?.role)

  const {
    theme,
    setTheme,
    density,
    setDensity,
    refreshInterval,
    setRefreshInterval,
    soundEnabled,
    setSoundEnabled,
    reduceMotionOverride,
    setReduceMotionOverride,
  } = useUIStore()

  // Fetch thresholds
  const {
    data: thresholds,
    isLoading: loadingThresholds,
    refetch: refetchThresholds,
  } = useQuery<Thresholds>({
    queryKey: ['config', 'thresholds'],
    queryFn: getThresholds,
    staleTime: 60000,
  })

  const handleSaveThresholds = async (newThresholds: Thresholds) => {
    await updateThresholds(newThresholds)
    refetchThresholds()
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            Settings & Admin
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
            <SettingsIcon className="w-3 h-3 text-muted-foreground" />
            <span>Configuration</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Detection sensitivity thresholds, access control, API tokens, and interface preferences.
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div id="tour-settings-tabs" className="flex rounded-md border border-border bg-muted/60 p-0.5 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('thresholds')}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
            activeTab === 'thresholds'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Detection Thresholds</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>User Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api-clients')}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
            activeTab === 'api-clients'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>API Tokens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
            activeTab === 'appearance'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
            activeTab === 'about'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span>About</span>
        </button>
      </div>

      {/* Tab 1: Detection Thresholds */}
      {activeTab === 'thresholds' && (
        <div className="space-y-4">
          {loadingThresholds || !thresholds ? (
            <SkeletonCard className="h-80 w-full" />
          ) : (
            <ThresholdForm
              initialThresholds={thresholds}
              isReadOnly={!userIsAdmin}
              onSave={handleSaveThresholds}
            />
          )}
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {userIsAdmin ? (
            <UsersPanel />
          ) : (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-6 text-center text-warning">
              <ShieldAlert className="h-7 w-7 mx-auto mb-2 text-warning" />
              <h3 className="text-xs font-semibold text-foreground">Administrator Privileges Required</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md mx-auto">
                User management is restricted to administrators. Contact an administrator to add or modify accounts.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: API Clients */}
      {activeTab === 'api-clients' && (
        <div className="space-y-4">
          {userIsAdmin ? (
            <ApiClientsPanel />
          ) : (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-6 text-center text-warning">
              <ShieldAlert className="h-7 w-7 mx-auto mb-2 text-warning" />
              <h3 className="text-xs font-semibold text-foreground">Administrator Privileges Required</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md mx-auto">
                Machine API client generation is restricted to system administrators.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Appearance & UI Preferences */}
      {activeTab === 'appearance' && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-semibold text-foreground">
              Interface Preferences
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Preferences are preserved in your browser and sync across sessions.
            </p>
          </div>

          <div className="space-y-5 max-w-2xl">
            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Theme</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'dark', label: 'Dark Mode', icon: Moon },
                  { id: 'light', label: 'Light Mode', icon: Sun },
                  { id: 'system', label: 'System', icon: Monitor },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id as Theme)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all shadow-xs ${
                      theme === id
                        ? 'border-border-strong bg-muted/80 text-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Density Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Density</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'comfortable', label: 'Comfortable' },
                  { id: 'compact', label: 'Compact' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDensity(id as Density)}
                    className={`rounded-lg border p-2.5 text-xs font-medium transition-all shadow-xs ${
                      density === id
                        ? 'border-border-strong bg-muted/80 text-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Auto-Refresh Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Dashboard Auto-Refresh Interval
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 0, label: 'Off' },
                  { val: 5, label: '5s' },
                  { val: 10, label: '10s (Default)' },
                  { val: 30, label: '30s' },
                  { val: 60, label: '1m' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRefreshInterval(val)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all shadow-xs ${
                      refreshInterval === val
                        ? 'border-border-strong bg-muted/80 text-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2.5">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-foreground" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <span className="text-xs font-medium text-foreground block">
                    Audio Chime for Incidents
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Play chime when critical anomalies are detected in live stream.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                  soundEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <span className="text-xs font-medium text-foreground block">
                  Force Reduced Motion Override
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Disables page transition animations and chart drawing animations.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setReduceMotionOverride(!reduceMotionOverride)}
                className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                  reduceMotionOverride ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    reduceMotionOverride ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: About & Documentation */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-foreground">
              Meghdrishti: Autonomous Cloud Spend Anomaly Detection System
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
              Project P75 implements an enterprise-grade FinOps observability platform providing sub-5-second
              mean time to detect (MTTD) on statistical cost deviations across multi-cloud infrastructure. Built
              with streaming Redis Streams architecture, EWMA baseline forecasting, and automated zero-downtime Blue/Green
              cutover.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-mono">
                  Architecture
                </span>
                <div className="text-xs font-medium text-foreground">
                  FastAPI + PostgreSQL 16 + Redis 7 + Nginx 1.27
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-mono">
                  Telemetry Engine
                </span>
                <div className="text-xs font-medium text-foreground">
                  Prometheus 2.54 + Grafana 11.2 (Embedded)
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-mono">
                  Frontend
                </span>
                <div className="text-xs font-medium text-foreground">
                  React 18.3 + TypeScript 5.6 + ECharts 5
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <span>Swagger API Docs (/docs)</span>
              </a>

              <a
                href="https://github.com/adishri2005/cloud-cost-anomaly-detection"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
