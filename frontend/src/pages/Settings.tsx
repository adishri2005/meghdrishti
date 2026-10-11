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
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Settings & Administration
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Detection sensitivity thresholds, operator RBAC, machine API credentials, and interface preferences.
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('thresholds')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'thresholds'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Detection Thresholds</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'users'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>User Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api-clients')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'api-clients'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>API Clients & Tokens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'appearance'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Appearance & Preferences</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'about'
              ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span>About & Documentation</span>
        </button>
      </div>

      {/* Tab 1: Detection Thresholds */}
      {activeTab === 'thresholds' && (
        <div className="space-y-4">
          {loadingThresholds || !thresholds ? (
            <SkeletonCard className="h-96 w-full" />
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
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-8 text-center text-warning">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Administrator Privileges Required</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                User management and credential issuance are restricted to administrators. Contact an administrator to add or modify accounts.
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
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-8 text-center text-warning">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Administrator Privileges Required</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Machine API client generation is restricted to system administrators.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Appearance & UI Preferences */}
      {activeTab === 'appearance' && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
          <div className="border-b border-border pb-3">
            <h3 className="text-base font-semibold text-foreground">
              Local Interface Preferences
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preferences are preserved in your browser and sync across sessions.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Color Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: 'Dark Mode (Default)', icon: Moon },
                  { id: 'light', label: 'Light Mode', icon: Sun },
                  { id: 'system', label: 'System Sync', icon: Monitor },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id as Theme)}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                      theme === id
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40'
                        : 'border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Density Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Display Density</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'comfortable', label: 'Comfortable (Standard)' },
                  { id: 'compact', label: 'Compact (High Density)' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDensity(id as Density)}
                    className={`rounded-xl border p-3 text-xs font-medium transition-all ${
                      density === id
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Auto-Refresh Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Dashboard Auto-Refresh Frequency
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: 0, label: 'Off' },
                  { val: 5, label: '5 seconds' },
                  { val: 10, label: '10 seconds (Default)' },
                  { val: 30, label: '30 seconds' },
                  { val: 60, label: '1 minute' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRefreshInterval(val)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      refreshInterval === val
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5 text-primary" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Anomaly Detection Sound Alerts
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Play a gentle audio chime when critical anomalies appear in live watch mode.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                  soundEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Force Reduced Motion Override
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Disables page transition animations and chart drawing animations.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setReduceMotionOverride(!reduceMotionOverride)}
                className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                  reduceMotionOverride ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white transition-transform ${
                    reduceMotionOverride ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: About & Documentation */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-foreground">
              CostGuard: Autonomous Cloud Spend Anomaly Detection System
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
              Project P75 implements an enterprise-grade FinOps observability platform providing sub-5-second
              mean time to detect (MTTD) on statistical cost deviations across multi-cloud infrastructure. Built
              with streaming Redis Streams architecture, EWMA baseline forecasting, and automated zero-downtime Blue/Green
              cutover.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  System Architecture
                </span>
                <div className="text-xs font-medium text-foreground">
                  FastAPI + PostgreSQL 16 + Redis 7 + Nginx 1.27
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Telemetry & Metrics
                </span>
                <div className="text-xs font-medium text-foreground">
                  Prometheus 2.54 + Grafana 11.2 (Embedded Solo/Kiosk)
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Frontend Console
                </span>
                <div className="text-xs font-medium text-foreground">
                  React 18.3 + TypeScript 5.6 + Apache ECharts 5
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Swagger API Documentation (/docs)</span>
              </a>

              <a
                href="https://github.com/adishri2005/cloud-cost-anomaly-detection"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
