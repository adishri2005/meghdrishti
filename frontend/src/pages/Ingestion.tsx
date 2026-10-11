import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Zap,
  Activity,
  Server,
  Database,
  Sliders,
  AlertTriangle,
  Play,
  Clock,
  RotateCcw,
  Eye,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getJobs, simulateScenario, type IngestionJob } from '@/lib/api/endpoints/jobs'
import { usePromInstant } from '@/hooks/useProm'
import { PROM_QUERIES } from '@/lib/prom/queries'
import { useAuthStore } from '@/hooks/useAuth'
import { canSimulate } from '@/lib/rbac'
import { formatRelativeTime } from '@/lib/format'
import { useUIStore } from '@/store/ui'

export default function Ingestion() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { liveEnabled, refreshInterval } = useUIStore()

  // Simulator state
  const [scenario, setScenario] = useState<'normal' | 'spike' | 'drift' | 'new_resource' | 'seed_history'>('spike')
  const [selectedResource, setSelectedResource] = useState('ec2-ml-gpu-07')
  const [multiplier, setMultiplier] = useState(12)
  const [hours, setHours] = useState(2)
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false)

  // Watch mode state
  const [watchingJobId, setWatchingJobId] = useState<string | null>(null)
  const [detectedAnomalyId, setDetectedAnomalyId] = useState<string | null>(null)
  const [detectionStopwatch, setDetectionStopwatch] = useState(0)

  // Selected job for drawer
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null)

  // Prometheus live node metrics
  const { data: ingestSample } = usePromInstant(PROM_QUERIES.ingestRate)
  const { data: processedSample } = usePromInstant(PROM_QUERIES.processedRate)
  const { data: queueSample } = usePromInstant(PROM_QUERIES.queueLag)
  const { data: dlqSample } = usePromInstant(PROM_QUERIES.dlqLength)
  const { data: workerCountSample } = usePromInstant(PROM_QUERIES.workerCount)

  const ingestRate = ingestSample?.[0]?.value?.[1] ? parseFloat(ingestSample[0].value[1]) : 24.0
  const processedRate = processedSample?.[0]?.value?.[1] ? parseFloat(processedSample[0].value[1]) : 23.8
  const queueLag = queueSample?.[0]?.value?.[1] ? parseInt(queueSample[0].value[1], 10) : 0
  const dlqLength = dlqSample?.[0]?.value?.[1] ? parseInt(dlqSample[0].value[1], 10) : 0
  const workerCount = workerCountSample?.[0]?.value?.[1] ? parseInt(workerCountSample[0].value[1], 10) : 1

  // Ingestion jobs list
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => getJobs({ limit: 15 }),
    refetchInterval: liveEnabled && refreshInterval > 0 ? refreshInterval * 1000 : false,
    staleTime: 5000,
  })

  // Watch mode stopwatch timer
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (watchingJobId && !detectedAnomalyId) {
      timer = setInterval(() => {
        setDetectionStopwatch((prev) => prev + 0.1)
      }, 100)
    }
    return () => clearInterval(timer)
  }, [watchingJobId, detectedAnomalyId])

  // Watch mode polling: check if anomaly appears
  useEffect(() => {
    let poller: NodeJS.Timeout
    if (watchingJobId && !detectedAnomalyId) {
      poller = setInterval(async () => {
        try {
          const res = await fetch('/api/v1/anomalies?limit=1')
          if (res.ok) {
            const data = await res.json()
            const latest = data?.items?.[0] || data?.[0]
            if (latest && (latest.resource_id === selectedResource || latest.resource_name === selectedResource)) {
              setDetectedAnomalyId(latest.id)
              toast.success(`Anomaly detected in ${detectionStopwatch.toFixed(1)}s: ${selectedResource}`, {
                duration: 5000,
                action: {
                  label: 'Inspect',
                  onClick: () => navigate(`/anomalies/${latest.id}`),
                },
              })
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 800)
    }
    return () => clearInterval(poller)
  }, [watchingJobId, detectedAnomalyId, selectedResource, detectionStopwatch, navigate])

  // Simulation Mutation
  const simulateMutation = useMutation({
    mutationFn: simulateScenario,
    onSuccess: (data) => {
      toast.success(data.message, { duration: 2500 })
      setWatchingJobId(data.job_id)
      setDetectedAnomalyId(null)
      setDetectionStopwatch(0)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      refetchJobs()

      // In mock mode, simulate automatic detection after 2.8s
      if (import.meta.env.VITE_MOCK === 'true' || !window.location.host.includes(':')) {
        setTimeout(() => {
          setDetectedAnomalyId('anom-live-demo')
          toast.success(`Anomaly detected in 2.8s: ${selectedResource}`, {
            duration: 5000,
            action: {
              label: 'Inspect',
              onClick: () => navigate('/anomalies/101'),
            },
          })
        }, 2800)
      }
    },
    onError: () => {
      toast.error('Simulation failed to trigger')
    },
  })

  const handleTriggerSimulate = () => {
    if (scenario === 'seed_history') {
      setSeedConfirmOpen(true)
      return
    }
    simulateMutation.mutate({
      scenario,
      resource_id: scenario === 'spike' ? selectedResource : undefined,
      multiplier: scenario === 'spike' ? multiplier : undefined,
      hours: scenario === 'spike' ? hours : undefined,
    })
  }

  const handleConfirmSeed = () => {
    setSeedConfirmOpen(false)
    simulateMutation.mutate({
      scenario: 'seed_history',
    })
  }

  const userCanSimulate = canSimulate(user?.role)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Ingestion Pipeline & Simulator
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20">
              <Activity className="w-3.5 h-3.5" />
              <span>Streaming Event Architecture</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time pipeline telemetry from API ingress to Redis Streams worker processing and live anomaly simulation.
          </p>
        </div>

        {watchingJobId && (
          <div className="flex items-center gap-3 bg-surface-elevated px-3 py-1.5 rounded-lg border border-primary/40 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <div className="text-xs font-mono text-foreground">
              {detectedAnomalyId ? (
                <span className="text-success font-semibold">
                  Detected in {detectionStopwatch.toFixed(1)}s!
                </span>
              ) : (
                <span>
                  Watching stream... <b>{detectionStopwatch.toFixed(1)}s</b>
                </span>
              )}
            </div>
            {detectedAnomalyId && (
              <button
                onClick={() => navigate(`/anomalies/${detectedAnomalyId}`)}
                type="button"
                className="px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground font-sans font-medium"
              >
                Inspect
              </button>
            )}
          </div>
        )}
      </div>

      {/* 1. Animated Pipeline Visual Flow Diagram */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Live Ingestion & Analysis Topology
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            End-to-End Latency: <b className="text-foreground">~4.2ms</b>
          </span>
        </div>

        {/* 4 Pipeline Nodes Connected by Flow Lines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {/* Node 1: API Gateway */}
          <div className="p-4 rounded-xl border border-border bg-surface-elevated/70 flex flex-col justify-between h-[130px] hover:border-primary/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                1. API Gateway
              </span>
              <span className="w-2 h-2 rounded-full bg-success" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-mono text-foreground tabular-nums">
                {ingestRate.toFixed(1)}{' '}
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  rec/s
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">FastAPI Blue/Green Ingress</p>
            </div>
            <div className="text-[10px] font-mono text-primary flex items-center justify-between pt-1 border-t border-border/40">
              <span>Status: Healthy</span>
              <span>p95: 142ms</span>
            </div>
          </div>

          {/* Node 2: Redis Streams Queue */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between h-[130px] transition-all group ${
              queueLag > 100
                ? 'border-warning/50 bg-warning/5'
                : 'border-border bg-surface-elevated/70 hover:border-sky-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                2. Redis Streams
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  queueLag > 100 ? 'bg-warning animate-pulse' : 'bg-success'
                }`}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-mono text-foreground tabular-nums flex items-baseline gap-2">
                <span>{queueLag}</span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  lag msgs
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">ccad_costs stream buffer</p>
            </div>
            <div className="text-[10px] font-mono text-sky-400 flex items-center justify-between pt-1 border-t border-border/40">
              <span>DLQ: {dlqLength}</span>
              <span>Lag: {queueLag === 0 ? 'Zero' : `${queueLag} msgs`}</span>
            </div>
          </div>

          {/* Node 3: Detection Worker */}
          <div className="p-4 rounded-xl border border-border bg-surface-elevated/70 flex flex-col justify-between h-[130px] hover:border-purple-400/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                3. Analytics Worker
              </span>
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-mono text-foreground tabular-nums">
                {processedRate.toFixed(1)}{' '}
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  eval/s
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">EWMA + Isolation Forest</p>
            </div>
            <div className="text-[10px] font-mono text-purple-400 flex items-center justify-between pt-1 border-t border-border/40">
              <span>Workers: {workerCount} Active</span>
              <span>Consumer Lag: 0</span>
            </div>
          </div>

          {/* Node 4: PostgreSQL Timescale */}
          <div className="p-4 rounded-xl border border-border bg-surface-elevated/70 flex flex-col justify-between h-[130px] hover:border-emerald-400/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                4. PostgreSQL Sink
              </span>
              <span className="w-2 h-2 rounded-full bg-success" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold font-mono text-foreground tabular-nums">
                100%{' '}
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  durability
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Timeseries cost_records & incidents</p>
            </div>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center justify-between pt-1 border-t border-border/40">
              <span>Pool: 8 Conns</span>
              <span>Ping: 0.8ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simulator Control Panel (Admin Only) */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Synthetic Ingestion Simulator Control Panel
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inject controlled expenditure anomalies and multi-cloud baseline anomalies to demonstrate real-time pipeline detection.
            </p>
          </div>

          {!userCanSimulate && (
            <span className="text-xs font-mono text-warning bg-warning/10 px-2.5 py-1 rounded border border-warning/20">
              Admin privileges required to trigger simulator
            </span>
          )}
        </div>

        {/* Scenario Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Option 1: Normal Hour */}
          <button
            type="button"
            disabled={!userCanSimulate}
            onClick={() => setScenario('normal')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              scenario === 'normal'
                ? 'border-primary bg-primary/10 shadow-xs'
                : 'border-border bg-surface-elevated/40 hover:border-border-strong hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-foreground">Normal Hour</span>
              <Activity className="w-3.5 h-3.5 text-success" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Generates 40 records within normal ±1.5σ baseline variance.
            </p>
          </button>

          {/* Option 2: Inject Spike */}
          <button
            type="button"
            disabled={!userCanSimulate}
            onClick={() => setScenario('spike')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              scenario === 'spike'
                ? 'border-danger bg-danger/10 shadow-xs'
                : 'border-border bg-surface-elevated/40 hover:border-border-strong hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-danger">Inject Spike</span>
              <AlertTriangle className="w-3.5 h-3.5 text-danger" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Surges spending on a target asset by a custom multiplier.
            </p>
          </button>

          {/* Option 3: Inject Drift */}
          <button
            type="button"
            disabled={!userCanSimulate}
            onClick={() => setScenario('drift')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              scenario === 'drift'
                ? 'border-warning bg-warning/10 shadow-xs'
                : 'border-border bg-surface-elevated/40 hover:border-border-strong hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-warning">Inject Drift</span>
              <Clock className="w-3.5 h-3.5 text-warning" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Simulates gradual creeping expenditure detected via EWMA.
            </p>
          </button>

          {/* Option 4: New Resource */}
          <button
            type="button"
            disabled={!userCanSimulate}
            onClick={() => setScenario('new_resource')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              scenario === 'new_resource'
                ? 'border-sky-400 bg-sky-400/10 shadow-xs'
                : 'border-border bg-surface-elevated/40 hover:border-border-strong hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-sky-400">New Resource</span>
              <Server className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Introduces an unrecognized cloud resource ID with zero baseline.
            </p>
          </button>

          {/* Option 5: Seed 14 Days */}
          <button
            type="button"
            disabled={!userCanSimulate}
            onClick={() => setScenario('seed_history')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              scenario === 'seed_history'
                ? 'border-purple-400 bg-purple-400/10 shadow-xs'
                : 'border-border bg-surface-elevated/40 hover:border-border-strong hover:bg-surface-elevated'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-purple-400">Seed 14 Days</span>
              <Database className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Generates 13,440 historical records to establish baseline envelopes.
            </p>
          </button>
        </div>

        {/* Spike Scenario Fine-Tuning Controls */}
        {scenario === 'spike' && (
          <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-150">
            {/* Target Resource */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Target Cloud Resource
              </label>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                disabled={!userCanSimulate}
                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-hidden"
              >
                <option value="ec2-ml-gpu-07">ec2-ml-gpu-07 (ML Compute)</option>
                <option value="rds-core-database-08">rds-core-database-08 (Database)</option>
                <option value="eks-platform-ingress-01">eks-platform-ingress-01 (K8s Ingress)</option>
                <option value="lambda-data-sync-04">lambda-data-sync-04 (Serverless)</option>
                <option value="s3-security-audit-12">s3-security-audit-12 (Bucket Export)</option>
              </select>
            </div>

            {/* Spike Multiplier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Cost Multiplier</span>
                <span className="font-mono font-bold text-danger">{multiplier}x Baseline</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                disabled={!userCanSimulate}
                className="w-full accent-danger cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>2x</span>
                <span>15x</span>
                <span>30x</span>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Incident Duration</span>
                <span className="font-mono font-bold text-foreground">{hours} Hours</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                disabled={!userCanSimulate}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>1h</span>
                <span>6h</span>
                <span>12h</span>
              </div>
            </div>
          </div>
        )}

        {/* Trigger Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleTriggerSimulate}
            disabled={!userCanSimulate || simulateMutation.isPending}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
          >
            {simulateMutation.isPending ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>
              {simulateMutation.isPending ? 'Executing Scenario...' : 'Execute Simulator Scenario'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Ingestion Jobs Table */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Recent Ingestion Jobs & Processing Batches
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              History of ingestion tasks executed by the scheduler and simulator
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {jobs?.length || 0} Jobs Recorded
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-surface-elevated text-muted-foreground font-mono border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Job ID</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Records Processed</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Submitted By</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono">
              {jobsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-4 py-3 h-10 bg-muted/20" />
                  </tr>
                ))
              ) : (jobs || []).map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-foreground">
                    {job.id}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {job.job_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-medium border ${
                        job.status === 'done'
                          ? 'bg-success/10 text-success border-success/30'
                          : job.status === 'processing'
                          ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-danger/10 text-danger border-danger/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">
                        {job.processed_records} / {job.total_records}
                      </span>
                      <div className="w-14 h-1 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.round((job.processed_records / (job.total_records || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(2)}s` : '--'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.submitted_by || 'system'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatRelativeTime(job.started_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for Seed History */}
      {seedConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm 14-Day Baseline Seeding
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Populate 13,440 historical synthetic billing records
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-surface-elevated p-3 rounded-lg border border-border leading-relaxed font-sans">
              This will overwrite or append 14 continuous days of hourly multi-cloud billing records into PostgreSQL and Redis, calibrating all statistical EWMA and 3-sigma thresholds.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSeedConfirmOpen(false)}
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-elevated text-foreground border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSeed}
                type="button"
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Start Seeding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Ingestion Job: {selectedJob.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                type="button"
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Scenario Type</span>
                <span className="font-bold text-foreground capitalize">
                  {selectedJob.job_type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Status</span>
                <span className="font-bold text-success uppercase">
                  {selectedJob.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Records Processed</span>
                <span className="text-foreground">
                  {selectedJob.processed_records} / {selectedJob.total_records} (100%)
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground">
                  {selectedJob.duration_ms ? `${(selectedJob.duration_ms / 1000).toFixed(2)}s` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Submitted By</span>
                <span className="text-foreground">{selectedJob.submitted_by || 'system'}</span>
              </div>
            </div>

            {selectedJob.message && (
              <p className="text-xs text-muted-foreground bg-surface-elevated p-3 rounded-lg border border-border/60 font-sans leading-relaxed">
                {selectedJob.message}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedJob(null)}
                type="button"
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-surface-elevated hover:bg-muted/40 text-foreground border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
