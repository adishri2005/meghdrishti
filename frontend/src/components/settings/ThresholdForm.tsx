import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sliders,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  Lock,
  X,
} from 'lucide-react'
import {
  ThresholdsSchema,
  type Thresholds,
} from '@/lib/api/types'
import { DEFAULT_THRESHOLDS } from '@/lib/api/endpoints/config'
import { toast } from 'sonner'

interface ThresholdFormProps {
  initialThresholds: Thresholds
  isReadOnly?: boolean
  onSave: (thresholds: Thresholds) => Promise<void>
}

export function ThresholdForm({
  initialThresholds,
  isReadOnly = false,
  onSave,
}: ThresholdFormProps) {
  const [showDiffDialog, setShowDiffDialog] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<Thresholds>({
    resolver: zodResolver(ThresholdsSchema),
    defaultValues: initialThresholds,
  })

  const formValues = watch()

  // Find changed fields between initial and current form values
  const getDiffs = () => {
    const diffs: Array<{ field: string; oldVal: any; newVal: any }> = []

    // Detection fields
    Object.keys(initialThresholds.detection).forEach((k) => {
      const key = k as keyof typeof initialThresholds.detection
      const oldV = initialThresholds.detection[key]
      const newV = formValues.detection?.[key]
      if (oldV !== newV) {
        diffs.push({ field: `detection.${key}`, oldVal: oldV, newVal: newV })
      }
    })

    // Severity fields
    const severities = ['critical', 'high', 'medium'] as const
    severities.forEach((s) => {
      if (initialThresholds.severity[s]?.z !== formValues.severity?.[s]?.z) {
        diffs.push({
          field: `severity.${s}.z`,
          oldVal: initialThresholds.severity[s]?.z,
          newVal: formValues.severity?.[s]?.z,
        })
      }
      if (initialThresholds.severity[s]?.pct !== formValues.severity?.[s]?.pct) {
        diffs.push({
          field: `severity.${s}.pct`,
          oldVal: initialThresholds.severity[s]?.pct,
          newVal: formValues.severity?.[s]?.pct,
        })
      }
    })

    return diffs
  }

  const handleResetDefaults = () => {
    reset(DEFAULT_THRESHOLDS)
    toast.info('Reset thresholds to factory defaults')
  }

  const onSubmitConfirm = async () => {
    setSaving(true)
    try {
      await onSave(formValues)
      setShowDiffDialog(false)
      toast.success('Successfully saved detection thresholds')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update thresholds')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3 text-warning">
          <Lock className="h-5 w-5 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold block text-foreground">Analyst View (Read-Only)</span>
            Threshold modifications are restricted to users with administrator privileges.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(() => setShowDiffDialog(true))} className="space-y-6">
        {/* Statistical Spike Parameters */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Statistical Spike Detection Parameters
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configures z-score sensitivity and EWMA dynamic baseline learning rates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Z-Score Threshold */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-foreground">
                  Z-Score Threshold (&sigma;)
                </label>
                <span className="font-mono text-primary font-bold">
                  {formValues.detection?.z_threshold} &sigma;
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.1"
                disabled={isReadOnly}
                {...register('detection.z_threshold', { valueAsNumber: true })}
                className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer disabled:opacity-40"
              />
              <p className="text-[11px] text-muted-foreground">
                Number of standard deviations above baseline before an anomaly triggers (Default: 3.0&sigma;).
              </p>
            </div>

            {/* Percent Jump Threshold */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-foreground">
                  Minimum Percentage Jump (%)
                </label>
                <span className="font-mono text-primary font-bold">
                  +{formValues.detection?.pct_jump_threshold}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                disabled={isReadOnly}
                {...register('detection.pct_jump_threshold', { valueAsNumber: true })}
                className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer disabled:opacity-40"
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum relative increase above expected mean cost (Default: +50%).
              </p>
            </div>

            {/* EWMA Alpha Smoothing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-foreground">
                  EWMA Learning Factor (&alpha;)
                </label>
                <span className="font-mono text-primary font-bold">
                  {formValues.detection?.ewma_alpha}
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                disabled={isReadOnly}
                {...register('detection.ewma_alpha', { valueAsNumber: true })}
                className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer disabled:opacity-40"
              />
              <p className="text-[11px] text-muted-foreground">
                Weight assigned to recent samples vs historical baseline (Default: 0.20).
              </p>
            </div>

            {/* Minimum Samples */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-foreground">
                  Minimum Baseline Samples
                </label>
                <span className="font-mono text-primary font-bold">
                  {formValues.detection?.min_samples} records
                </span>
              </div>
              <input
                type="number"
                min="5"
                max="100"
                disabled={isReadOnly}
                {...register('detection.min_samples', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
              />
              <p className="text-[11px] text-muted-foreground">
                Required observation count before baseline statistics activate (Default: 10).
              </p>
            </div>
          </div>
        </div>

        {/* Severity Classification Thresholds Table */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Severity Classification Matrix
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Maps deviation magnitudes to incident severity tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Severity Level</th>
                  <th className="px-4 py-2.5">Minimum Z-Score (&sigma;)</th>
                  <th className="px-4 py-2.5">Minimum Cost Increase (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Critical */}
                <tr>
                  <td className="px-4 py-3 font-semibold text-danger flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    CRITICAL
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      disabled={isReadOnly}
                      {...register('severity.critical.z', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="5"
                      disabled={isReadOnly}
                      {...register('severity.critical.pct', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                </tr>

                {/* High */}
                <tr>
                  <td className="px-4 py-3 font-semibold text-orange-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    HIGH
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      disabled={isReadOnly}
                      {...register('severity.high.z', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="5"
                      disabled={isReadOnly}
                      {...register('severity.high.pct', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                </tr>

                {/* Medium */}
                <tr>
                  <td className="px-4 py-3 font-semibold text-warning flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    MEDIUM
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      disabled={isReadOnly}
                      {...register('severity.medium.z', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="5"
                      disabled={isReadOnly}
                      {...register('severity.medium.pct', { valueAsNumber: true })}
                      className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-foreground disabled:opacity-40"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Button Bar */}
        {!isReadOnly && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Factory Defaults</span>
            </button>

            <button
              type="submit"
              disabled={!isDirty || Object.keys(errors).length > 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              <span>Preview & Save Changes</span>
            </button>
          </div>
        )}
      </form>

      {/* Diff Preview Confirmation Modal */}
      {showDiffDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h3 className="text-base font-bold text-foreground">
                  Confirm Threshold Changes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiffDialog(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Review parameters being modified. All changes are audit-logged with caller identity:
            </p>

            <div className="rounded-lg border border-border bg-surface max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-border bg-surface-elevated text-muted-foreground font-sans">
                  <tr>
                    <th className="px-3 py-2">Parameter</th>
                    <th className="px-3 py-2 text-right">Current Value</th>
                    <th className="px-3 py-2 text-right">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getDiffs().map((d, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-foreground font-sans">{d.field}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground line-through">
                        {String(d.oldVal)}
                      </td>
                      <td className="px-3 py-2 text-right text-primary font-bold">
                        {String(d.newVal)}
                      </td>
                    </tr>
                  ))}
                  {getDiffs().length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground font-sans">
                        No changes detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiffDialog(false)}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || getDiffs().length === 0}
                onClick={onSubmitConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{saving ? 'Applying...' : 'Confirm & Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
