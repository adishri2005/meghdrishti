import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import {
  getCurrentDeployment,
  getDeployments,
} from '@/lib/api/endpoints/deployments'
import { BlueGreenDiagram } from '@/components/deployments/BlueGreenDiagram'
import { DeploymentTimeline } from '@/components/deployments/DeploymentTimeline'
import { ImpactPanel } from '@/components/deployments/ImpactPanel'
import { SkeletonCard } from '@/components/data/SkeletonCard'
import { toast } from 'sonner'
import type { DeploymentRecord } from '@/lib/api/types'

const DEPLOY_COMMANDS = [
  {
    title: 'Standard Blue/Green Release',
    cmd: 'make deploy VERSION=v1.2.0',
    desc: 'Spins up standby container, awaits healthy probe, atomically flips Nginx upstream.',
  },
  {
    title: 'Faulty Canary Injection (Report Demo)',
    cmd: 'make deploy-faulty',
    desc: 'Deploys version with artificial 5xx error rate to demonstrate automated rollback.',
  },
  {
    title: 'Manual Immediate Rollback',
    cmd: 'make rollback',
    desc: 'Instant zero-downtime cutover back to previous standby container.',
  },
  {
    title: 'Autonomous Failure Experiment',
    cmd: './scripts/failure_experiment.sh',
    desc: 'Simulates worker loss, DLQ saturation, and auto-healing recovery cycle.',
  },
]

export default function Deployments() {
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentRecord | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  // Fetch current active cluster state
  const {
    data: current,
    isLoading: loadingCurrent,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['deployments', 'current'],
    queryFn: getCurrentDeployment,
    staleTime: 15000,
  })

  // Fetch deployment history
  const {
    data: deployments = [],
    isLoading: loadingDeployments,
    refetch: refetchHistory,
    isFetching,
  } = useQuery({
    queryKey: ['deployments', 'history'],
    queryFn: () => getDeployments(20),
    staleTime: 15000,
  })

  // Select first deployment (or rolled back deployment) if none selected
  const activeDeployment =
    selectedDeployment ||
    deployments.find((d) => d.status === 'rolled_back') ||
    deployments[0] ||
    null

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    toast.success('Copied command to clipboard')
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const handleRefresh = () => {
    refetchCurrent()
    refetchHistory()
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div id="tour-deployments-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Deployments
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted/70 text-muted-foreground border border-border">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span>Blue/Green Routing</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upstream traffic control, release audit trail, and automated rollback forensics.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Cluster State Diagram */}
      {loadingCurrent ? (
        <SkeletonCard className="h-44 w-full" />
      ) : (
        <BlueGreenDiagram
          activeColor={current?.active_color || 'blue'}
          version={current?.version || 'v1.0.0'}
          uptimeSeconds={current?.uptime_seconds}
        />
      )}

      {/* Main Content Layout: Timeline on Left, Impact on Right */}
      <div id="tour-deployments-timeline" className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Timeline (Cols 1-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
            {loadingDeployments ? (
              <div className="space-y-3">
                <SkeletonCard className="h-20" />
                <SkeletonCard className="h-20" />
              </div>
            ) : deployments.length > 0 ? (
              <DeploymentTimeline
                deployments={deployments}
                selectedId={activeDeployment?.id}
                onSelectDeployment={(d) => setSelectedDeployment(d)}
              />
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No deployment history found.
              </div>
            )}
          </div>

          {/* How to Deploy Commands Card */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">
                Release Execution Reference
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Production deployments and rollbacks are executed via scripted CLI commands:
            </p>

            <div className="space-y-2">
              {DEPLOY_COMMANDS.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {item.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.cmd)}
                      className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors border border-border shadow-xs"
                      title="Copy command"
                      aria-label={`Copy ${item.title} command`}
                    >
                      {copiedCmd === item.cmd ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="rounded bg-surface border border-border px-2 py-1 font-mono text-[11px] text-foreground select-all">
                    <code>{item.cmd}</code>
                  </pre>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Impact Analysis Panel (Cols 6-12) */}
        <div className="lg:col-span-7 space-y-4">
          {activeDeployment ? (
            <ImpactPanel deployment={activeDeployment} />
          ) : (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              <AlertCircle className="h-7 w-7 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-xs font-medium text-foreground">Select a release from the timeline</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Inspect before, during, and after cutover telemetry.
              </p>
            </div>
          )}

          {/* Report Viva Tips Card */}
          <div className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3 shadow-xs">
            <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-medium text-foreground">
                Evaluation & Report Evidence Note
              </span>
              <p className="text-muted-foreground leading-relaxed">
                The before/during/after chart and comparative impact table above provide the verification evidence
                required for Project P75. When <code className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">make deploy-faulty</code> is run,
                the auto-rollback timeline item and recovery impact metrics can be captured directly for the project report.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
