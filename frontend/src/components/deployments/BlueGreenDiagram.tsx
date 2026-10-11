import { ArrowRight, Server, ShieldCheck, Zap } from 'lucide-react'
import { StatusDot } from '@/components/data/StatusDot'
import { formatDuration } from '@/lib/format'

interface BlueGreenDiagramProps {
  activeColor: 'blue' | 'green'
  version: string
  uptimeSeconds?: number
}

export function BlueGreenDiagram({
  activeColor,
  version,
  uptimeSeconds = 86400,
}: BlueGreenDiagramProps) {
  const isBlueActive = activeColor === 'blue'
  const isGreenActive = activeColor === 'green'

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-6">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Zero-Downtime Blue/Green Cluster State
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active upstream routed seamlessly via reverse proxy gateway with atomic upstream switching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            Active Container:
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider ${
              isBlueActive
                ? 'bg-info/10 text-info border border-info/30'
                : 'bg-success/10 text-success border border-success/30'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isBlueActive ? 'bg-info animate-pulse' : 'bg-success animate-pulse'
              }`}
            />
            {activeColor} cluster
          </span>
        </div>
      </div>

      {/* Visual Topology Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
        {/* Nginx Ingress Node (Cols 1-2) */}
        <div className="md:col-span-2 rounded-xl border border-border bg-surface p-4 flex flex-col items-center justify-center text-center space-y-2 shadow-xs">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Nginx Gateway</h3>
            <span className="text-[11px] font-mono text-muted-foreground">Reverse Proxy & Auth Router</span>
          </div>
          <div className="rounded-md bg-background px-2.5 py-1 text-[11px] font-mono text-primary border border-border">
            100% traffic &rarr; {activeColor.toUpperCase()}
          </div>
        </div>

        {/* Traffic Direction Indicator (Col 3) */}
        <div className="hidden md:flex md:col-span-1 flex-col items-center justify-center space-y-3">
          <div className={`transition-opacity duration-300 ${isBlueActive ? 'opacity-100' : 'opacity-20'}`}>
            <div className="flex items-center gap-1 text-[10px] font-mono text-info font-bold">
              <span>Traffic</span>
              <ArrowRight className="h-3 w-3 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className={`transition-opacity duration-300 ${isGreenActive ? 'opacity-100' : 'opacity-20'}`}>
            <div className="flex items-center gap-1 text-[10px] font-mono text-success font-bold">
              <span>Traffic</span>
              <ArrowRight className="h-3 w-3 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Environments Cluster Stack (Cols 4-7) */}
        <div className="md:col-span-4 space-y-3">
          {/* Blue Target Card */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              isBlueActive
                ? 'border-info/50 bg-info/5 shadow-md shadow-info/5 ring-1 ring-info/30'
                : 'border-border bg-surface/50 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2.5 ${
                    isBlueActive ? 'bg-info/20 text-info' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Blue Environment</span>
                    <span className="text-xs font-mono font-medium text-muted-foreground">
                      (api_blue:8000)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span>Version: <strong className="text-foreground">{isBlueActive ? version : 'v1.0.0'}</strong></span>
                    <span>•</span>
                    <span>Uptime: {isBlueActive ? formatDuration(uptimeSeconds) : 'Standby'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    isBlueActive
                      ? 'bg-info/20 text-info border border-info/40'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <StatusDot status={isBlueActive ? 'info' : 'neutral'} pulse={isBlueActive} />
                  {isBlueActive ? 'ACTIVE (100%)' : 'STANDBY (HOT)'}
                </span>
              </div>
            </div>
          </div>

          {/* Green Target Card */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              isGreenActive
                ? 'border-success/50 bg-success/5 shadow-md shadow-success/5 ring-1 ring-success/30'
                : 'border-border bg-surface/50 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2.5 ${
                    isGreenActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Green Environment</span>
                    <span className="text-xs font-mono font-medium text-muted-foreground">
                      (api_green:8000)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span>Version: <strong className="text-foreground">{isGreenActive ? version : 'v1.1.0'}</strong></span>
                    <span>•</span>
                    <span>Uptime: {isGreenActive ? formatDuration(uptimeSeconds) : 'Standby'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    isGreenActive
                      ? 'bg-success/20 text-success border border-success/40'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <StatusDot status={isGreenActive ? 'success' : 'neutral'} pulse={isGreenActive} />
                  {isGreenActive ? 'ACTIVE (100%)' : 'STANDBY (HOT)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
