import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserPlus, Users, Shield, RefreshCw, X } from 'lucide-react'
import { getUsers, registerUser } from '@/lib/api/endpoints/admin'
import { formatDateTime } from '@/lib/format'
import { StatusDot } from '@/components/data/StatusDot'
import { toast } from 'sonner'
import type { UserRecord } from '@/lib/api/types'

export function UsersPanel() {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [role, setRole] = useState<'admin' | 'analyst'>('analyst')
  const [submitting, setSubmitting] = useState<boolean>(false)

  const {
    data: users = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
    staleTime: 30000,
  })

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Empty', color: 'bg-muted' }
    let score = 0
    if (pass.length >= 8) score += 1
    if (/[A-Z]/.test(pass)) score += 1
    if (/[0-9]/.test(pass)) score += 1
    if (/[^A-Za-z0-9]/.test(pass)) score += 1

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-danger' }
    if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-warning' }
    return { score: 3, label: 'Strong', color: 'bg-success' }
  }

  const strength = getPasswordStrength(password)

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required')
      return
    }

    setSubmitting(true)
    try {
      await registerUser({ username: username.trim(), password, role })
      toast.success(`User '${username}' created successfully`)
      setShowCreateModal(false)
      setUsername('')
      setPassword('')
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            User Access Management
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure system operator credentials and role assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground"
            title="Refresh Users"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-elevated text-muted-foreground font-semibold">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading user records...
                </td>
              </tr>
            ) : (
              users.map((u: UserRecord) => (
                <tr key={u.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-foreground font-mono">
                    {u.username}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Shield className="h-2.5 w-2.5" />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={u.is_active ? 'success' : 'neutral'} />
                      <span className="text-[11px] text-muted-foreground">
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {u.created_at ? formatDateTime(u.created_at) : 'System provisioned'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Create User Account</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. devops-lead"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                />

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Strength:</span>
                      <span className="font-semibold text-foreground">{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-muted'}`} />
                      <div className={`h-full flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-muted'}`} />
                      <div className={`h-full flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-muted'}`} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="analyst">Analyst (Read-only observation)</option>
                  <option value="admin">Administrator (Full control)</option>
                </select>
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
                  <span>{submitting ? 'Registering...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
