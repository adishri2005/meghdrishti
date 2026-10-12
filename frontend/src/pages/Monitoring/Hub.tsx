import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Layers,
  Terminal,
  Bell,
  Radio,
  ExternalLink,
} from 'lucide-react'
import { PROM_QUERIES } from '@/lib/prom/queries'
import { getDeployments } from '@/lib/api/endpoints/deployments'
import { NativePanelCard } from '@/components/monitoring/NativePanelCard'
import { GrafanaFrame } from '@/components/monitoring/GrafanaFrame'
import { PrometheusFrame } from '@/components/monitoring/PrometheusFrame'
import { PromQueryConsole } from '@/components/monitoring/PromQueryConsole'
import { TargetsTable } from '@/components/monitoring/TargetsTable'
import { AlertsList } from '@/components/monitoring/AlertsList'

type MonitoringTab = 'overview' | 'grafana' | 'prometheus' | 'alerts' | 'targets'

export default function MonitoringHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabParam = (searchParams.get('tab') as MonitoringTab) || 'overview'
  const [activeTab, setActiveTab] = useState<MonitoringTab>(activeTabParam)
  
  // Custom PromQL pre-fill query when navigating from panel
  const [promConsoleQuery, setPromConsoleQuery] = useState<string>(PROM_QUERIES.rps)
  const [promMode, setPromMode] = useState<'console' | 'embed'>('console')

  // Fetch recent deployments for markLines on native charts
  const { data: deployments = [] } = useQuery({
    queryKey: ['deployments', 'monitoring'],
    queryFn: () => getDeployments(10),
    staleTime: 30000,
  })

  // Sync tab with URL
  useEffect(() => {
    const current = searchParams.get('tab') as MonitoringTab
    if (current && current !== activeTab) {
      setActiveTab(current)
    }
  }, [searchParams, activeTab])

  const handleTabChange = (tab: MonitoringTab) => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleOpenInPrometheus = (expr: string) => {
    setPromConsoleQuery(expr)
    setPromMode('console')
    handleTabChange('prometheus')
  }

  const handleOpenInGrafana = () => {
    handleTabChange('grafana')
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Monitoring Hub
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span>Prometheus Telemetry</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time metric telemetry, PromQL analytics, and embedded Grafana dashboards.
          </p>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex rounded-md border border-border bg-muted/60 p-0.5 shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
              activeTab === 'overview'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Overview (Native)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('grafana')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
              activeTab === 'grafana'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Grafana</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('prometheus')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
              activeTab === 'prometheus'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Prometheus</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('alerts')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
              activeTab === 'alerts'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('targets')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all shrink-0 ${
              activeTab === 'targets'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Targets</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Overview (Native PromQL Panels Grid) */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              12 live telemetry panels queried natively via Prometheus PromQL engine.
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Live Queries</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {/* 1. Request Rate */}
            <NativePanelCard
              title="Request Rate"
              query={PROM_QUERIES.rps}
              description="Inbound HTTP requests per second"
              unit="req/s"
              color="hsl(var(--primary))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 2. API Latency p95 */}
            <NativePanelCard
              title="API Latency (p95)"
              query={PROM_QUERIES.latencyP95}
              description="95th percentile response latency across endpoints"
              unit="s"
              color="hsl(var(--warning))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 3. Error Rate by Color */}
            <NativePanelCard
              title="5xx Errors by Color"
              query={PROM_QUERIES.errorByColor}
              description="Server error rate partitioned by deployment color"
              unit="err/s"
              color="hsl(var(--danger))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 4. Ingestion Rate */}
            <NativePanelCard
              title="Ingestion Rate"
              query={PROM_QUERIES.ingestRate}
              description="Cost records written to queue per second"
              unit="rec/s"
              color="hsl(var(--primary))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 5. Processed Rate */}
            <NativePanelCard
              title="Processed Rate"
              query={PROM_QUERIES.processedRate}
              description="Worker anomaly detection evaluations per second"
              unit="rec/s"
              color="hsl(var(--primary))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 6. Queue Lag */}
            <NativePanelCard
              title="Queue Lag"
              query={PROM_QUERIES.queueLag}
              description="Pending messages waiting in Redis Streams"
              unit="msgs"
              color="hsl(var(--warning))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 7. Detection Delay (p95) */}
            <NativePanelCard
              title="Detection Delay (p95)"
              query={PROM_QUERIES.detectionP95}
              description="Pipeline latency from record ingestion to anomaly trigger"
              unit="s"
              color="hsl(var(--primary))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 8. Anomalies by Severity */}
            <NativePanelCard
              title="Anomalies Rate by Severity"
              query={PROM_QUERIES.anomaliesBySev}
              description="Hourly anomaly detection rate partitioned by severity"
              unit="events/h"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 9. Cache Hit Ratio */}
            <NativePanelCard
              title="Cache Hit Ratio"
              query={PROM_QUERIES.cacheHitRatio}
              description="Redis baseline lookup hit efficiency"
              unit="ratio"
              color="hsl(var(--primary))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 10. System CPU Usage */}
            <NativePanelCard
              title="Host CPU Usage"
              query={PROM_QUERIES.cpuPct}
              description="Node exporter host CPU load percentage"
              unit="%"
              color="hsl(var(--muted-foreground))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 11. System Memory Usage */}
            <NativePanelCard
              title="Host Memory Usage"
              query={PROM_QUERIES.memPct}
              description="Node exporter RAM utilization percentage"
              unit="%"
              color="hsl(var(--muted-foreground))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />

            {/* 12. PostgreSQL Connections */}
            <NativePanelCard
              title="PostgreSQL Active Backends"
              query={PROM_QUERIES.pgConnections}
              description="Concurrent client sessions connected to Postgres"
              unit="backends"
              color="hsl(var(--muted-foreground))"
              deployments={deployments}
              onOpenPrometheus={handleOpenInPrometheus}
              onOpenGrafana={handleOpenInGrafana}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Grafana */}
      {activeTab === 'grafana' && (
        <div className="space-y-4">
          <GrafanaFrame />
        </div>
      )}

      {/* Tab 3: Prometheus (Native Console or Embedded Web UI) */}
      {activeTab === 'prometheus' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex rounded-md border border-border bg-muted/60 p-0.5 text-xs shadow-xs">
              <button
                type="button"
                onClick={() => setPromMode('console')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors ${
                  promMode === 'console'
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Native PromQL Console</span>
              </button>
              <button
                type="button"
                onClick={() => setPromMode('embed')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-colors ${
                  promMode === 'embed'
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Embedded Web UI</span>
              </button>
            </div>

            <span className="text-xs text-muted-foreground hidden sm:inline font-mono">
              {promMode === 'console' ? '/prometheus/api/v1' : '/prometheus/graph'}
            </span>
          </div>

          {promMode === 'console' ? (
            <PromQueryConsole initialQuery={promConsoleQuery} />
          ) : (
            <PrometheusFrame initialQuery={promConsoleQuery} />
          )}
        </div>
      )}

      {/* Tab 4: Alerts */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <AlertsList />
        </div>
      )}

      {/* Tab 5: Targets */}
      {activeTab === 'targets' && (
        <div className="space-y-4">
          <TargetsTable />
        </div>
      )}
    </div>
  )
}
