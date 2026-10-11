import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Key, Plus, Copy, Check, AlertTriangle, RefreshCw, X } from 'lucide-react'
import { getApiClients, createApiClient } from '@/lib/api/endpoints/admin'
import { formatDateTime } from '@/lib/format'
import { StatusDot } from '@/components/data/StatusDot'
import { toast } from 'sonner'
import type { ApiClientRecord } from '@/lib/api/types'

export function ApiClientsPanel() {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [clientName, setClientName] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [newKeyData, setNewKeyData] = useState<{ name: string; key: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<boolean>(false)

  const {
    data: clients = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'api-clients'],
    queryFn: getApiClients,
    staleTime: 30000,
  })

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim()) {
      toast.error('Client name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await createApiClient({ name: clientName.trim() })
      setShowCreateModal(false)
      setClientName('')
      setNewKeyData({ name: res.name, key: res.api_key })
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to create API client')
    } finally {
      setSubmitting(false)
    }
  }

  const copyKeyToClipboard = () => {
    if (!newKeyData) return
    navigator.clipboard.writeText(newKeyData.key)
    setCopiedKey(true)
    toast.success('API key copied to clipboard')
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Machine-to-Machine API Clients
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage programmatic API tokens for Prometheus, pipelines, and CI/CD agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground"
            title="Refresh Clients"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate Client Token</span>
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-elevated text-muted-foreground font-semibold">
            <tr>
              <th className="px-4 py-2.5">Client Name</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground font-sans">
                  Loading API clients...
                </td>
              </tr>
            ) : clients.length > 0 ? (
              clients.map((c: ApiClientRecord) => (
                <tr key={c.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-foreground font-sans flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-primary" />
                    {c.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-sans">
                      <StatusDot status={c.is_active ? 'success' : 'neutral'} />
                      <span className="text-[11px] text-muted-foreground">
                        {c.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {c.created_at ? formatDateTime(c.created_at) : 'System default'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground font-sans">
                  No programmatic API clients configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Create API Client</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Client Name / Service</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. cloudwatch-forwarder"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Identifies the external caller in security audit logs.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  <span>{submitting ? 'Generating...' : 'Generate Secret Key'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret Key Revealed ONCE Modal */}
      {newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-warning/40 bg-card p-6 shadow-2xl space-y-4 ring-1 ring-warning/30">
            <div className="flex items-center gap-2.5 text-warning border-b border-border pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  New API Key Generated: {newKeyData.name}
                </h3>
                <span className="text-xs text-warning">
                  Copy this key now. It will never be shown again!
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">API Token:</span>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 font-mono text-xs text-primary">
                <span className="flex-1 select-all break-all">{newKeyData.key}</span>
                <button
                  type="button"
                  onClick={copyKeyToClipboard}
                  className="inline-flex items-center gap-1 rounded bg-background px-2.5 py-1 text-xs text-foreground hover:bg-surface-elevated border border-border shrink-0"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Only a SHA-256 hash of this key is saved in PostgreSQL. Pass this token in the{' '}
              <code className="font-mono text-primary font-semibold">X-API-Key</code> request header
              for authenticated service calls.
            </p>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setNewKeyData(null)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                I have securely saved this key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
