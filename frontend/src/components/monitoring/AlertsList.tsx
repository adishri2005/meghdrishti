import { useState, useEffect, useMemo } from 'react'
import { Bell, AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react'
import { promClient } from '@/lib/prom/client'
import { formatTimestamp } from '@/lib/format'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import type { PromAlert, PromRuleGroup, PromRule } from '@/lib/prom/queries'

export function AlertsList() {
  const [alerts, setAlerts] = useState<PromAlert[]>([])
  const [rules, setRules] = useState<PromRuleGroup[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filterState, setFilterState] = useState<'all' | 'firing' | 'pending' | 'inactive'>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState<number>(0)

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.allSettled([promClient.alerts(), promClient.rules()])
      .then(([alertsRes, rulesRes]) => {
        if (!active) return
        if (alertsRes.status === 'fulfilled') {
          setAlerts(alertsRes.value || [])
        }
        if (rulesRes.status === 'fulfilled') {
          setRules(rulesRes.value || [])
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  // Flatten rules into alerting rules
  const allAlertRules = useMemo(() => {
    const list: Array<PromRule & { groupName: string }> = []
    rules.forEach((g) => {
      g.rules.forEach((r) => {
        if (r.type === 'alerting') {
          list.push({ ...r, groupName: g.name })
        }
      })
    })
    return list
  }, [rules])

  const firingCount = useMemo(() => alerts.filter((a) => a.state === 'firing').length, [alerts])
  const pendingCount = useMemo(() => alerts.filter((a) => a.state === 'pending').length, [alerts])

  const filteredRules = useMemo(() => {
    return allAlertRules.filter((r) => {
      const state = r.state || 'inactive'
      if (filterState !== 'all' && state !== filterState) return false
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const name = (r.name || '').toLowerCase()
        const queryExpr = (r.query || '').toLowerCase()
        const summary = (r.annotations?.summary || '').toLowerCase()
        if (!name.includes(query) && !queryExpr.includes(query) && !summary.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [allAlertRules, filterState, searchTerm])

  return (
    <div className="space-y-4">
      {/* Alert KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={`rounded-xl border p-4 flex items-center justify-between transition-all ${
            firingCount > 0
              ? 'border-danger/40 bg-danger/5 shadow-md shadow-danger/10'
              : 'border-border bg-card'
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Firing Alerts
            </span>
            <div className={`text-2xl font-bold font-mono mt-1 ${firingCount > 0 ? 'text-danger animate-pulse' : 'text-foreground'}`}>
              {loading ? '...' : firingCount}
            </div>
          </div>
          <Bell className={`h-6 w-6 ${firingCount > 0 ? 'text-danger' : 'text-muted-foreground'}`} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Alerts
            </span>
            <div className="text-2xl font-bold font-mono text-warning mt-1">
              {loading ? '...' : pendingCount}
            </div>
          </div>
          <AlertTriangle className="h-6 w-6 text-warning" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configured Rules
            </span>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {loading ? '...' : allAlertRules.length}
            </div>
          </div>
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search alert name or query..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-48 sm:w-64 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterState('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterState === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({allAlertRules.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('firing')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterState === 'firing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Firing ({firingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('pending')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterState === 'pending' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterState('inactive')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filterState === 'inactive' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts & Rules Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Alert Name</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">PromQL Expression</th>
                <th className="px-4 py-3">Summary / Annotation</th>
                <th className="px-4 py-3">Active Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRules.length > 0 ? (
                filteredRules.map((rule, idx) => {
                  const state = rule.state || 'inactive'
                  const isFiring = state === 'firing'
                  const isPending = state === 'pending'
                  const severity = (rule.labels?.severity as any) || 'medium'
                  
                  // Match active alert instance if available
                  const activeAlert = alerts.find((a) => a.labels.alertname === rule.name)

                  return (
                    <tr
                      key={`${rule.name}-${idx}`}
                      className={`hover:bg-surface/50 transition-colors ${
                        isFiring ? 'bg-danger/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isFiring
                              ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse'
                              : isPending
                              ? 'bg-warning/20 text-warning border border-warning/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isFiring ? 'bg-danger' : isPending ? 'bg-warning' : 'bg-muted-foreground'
                            }`}
                          />
                          {state}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                        <div>{rule.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{rule.groupName}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={severity} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground max-w-xs truncate">
                        <span title={rule.query}>{rule.query}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-sm">
                        <div className="text-foreground">{rule.annotations?.summary || '-'}</div>
                        {rule.annotations?.description && (
                          <div className="text-[11px] text-muted-foreground truncate">{rule.annotations.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        {activeAlert?.activeAt ? formatTimestamp(new Date(activeAlert.activeAt).getTime()) : '-'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? 'Loading alerting rules...' : 'No alerts match criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
