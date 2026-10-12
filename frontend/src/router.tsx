import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { SkeletonCard } from '@/components/data/SkeletonCard'

const Login = lazy(() => import('@/pages/Login'))
const Overview = lazy(() => import('@/pages/Overview'))
const Anomalies = lazy(() => import('@/pages/Anomalies'))
const Costs = lazy(() => import('@/pages/Costs'))
const Resources = lazy(() => import('@/pages/Resources'))
const ResourceDetail = lazy(() => import('@/pages/ResourceDetail'))
const Ingestion = lazy(() => import('@/pages/Ingestion'))
const MonitoringHub = lazy(() => import('@/pages/Monitoring/Hub'))
const AppLogs = lazy(() => import('@/pages/Logs/AppLogs'))
const AuditLogs = lazy(() => import('@/pages/Logs/AuditLogs'))
const Deployments = lazy(() => import('@/pages/Deployments'))
const Settings = lazy(() => import('@/pages/Settings'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Forbidden = lazy(() => import('@/pages/Forbidden'))

function RouteErrorBoundary() {
  const error = useRouteError()
  let errorMessage = 'An unexpected application error occurred.'
  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`
  } else if (error instanceof Error) {
    errorMessage = error.message
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background animate-in fade-in">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-6 space-y-4 shadow-sm text-center">
        <div className="w-9 h-9 rounded-md bg-danger/10 text-danger flex items-center justify-center mx-auto border border-danger/25">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Application Encountered an Error</h2>
          <p className="text-xs text-muted-foreground mt-1">
            An unhandled runtime exception was caught by the boundary.
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-md border border-border text-left break-all">
          {errorMessage}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => window.location.reload()}
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            Reload Page
          </button>
          <a
            href="/"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-muted text-foreground border border-border transition-colors shadow-xs"
          >
            Back to Overview
          </a>
        </div>
      </div>
    </div>
  )
}

function SuspenseFallback() {
  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-md" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>
      <SkeletonCard className="h-96" />
    </div>
  )
}

function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    errorElement: <RouteErrorBoundary />,
    element: (
      <PageSuspense>
        <Login />
      </PageSuspense>
    ),
  },
  {
    path: '/forbidden',
    errorElement: <RouteErrorBoundary />,
    element: (
      <PageSuspense>
        <Forbidden />
      </PageSuspense>
    ),
  },
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <PageSuspense>
            <Overview />
          </PageSuspense>
        ),
      },
      {
        path: 'anomalies',
        element: (
          <PageSuspense>
            <Anomalies />
          </PageSuspense>
        ),
      },
      {
        path: 'anomalies/:id',
        element: (
          <PageSuspense>
            <Anomalies />
          </PageSuspense>
        ),
      },
      {
        path: 'costs',
        element: (
          <PageSuspense>
            <Costs />
          </PageSuspense>
        ),
      },
      {
        path: 'resources',
        element: (
          <PageSuspense>
            <Resources />
          </PageSuspense>
        ),
      },
      {
        path: 'resources/:id',
        element: (
          <PageSuspense>
            <ResourceDetail />
          </PageSuspense>
        ),
      },
      {
        path: 'ingestion',
        element: (
          <PageSuspense>
            <Ingestion />
          </PageSuspense>
        ),
      },
      {
        path: 'monitoring/*',
        element: (
          <PageSuspense>
            <MonitoringHub />
          </PageSuspense>
        ),
      },
      {
        path: 'logs/app',
        element: (
          <PageSuspense>
            <AppLogs />
          </PageSuspense>
        ),
      },
      {
        path: 'logs/audit',
        element: (
          <PageSuspense>
            <AuditLogs />
          </PageSuspense>
        ),
      },
      {
        path: 'logs',
        element: <Navigate to="/logs/app" replace />,
      },
      {
        path: 'deployments',
        element: (
          <PageSuspense>
            <Deployments />
          </PageSuspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <PageSuspense>
            <Settings />
          </PageSuspense>
        ),
      },
      {
        path: '*',
        element: (
          <PageSuspense>
            <NotFound />
          </PageSuspense>
        ),
      },
    ],
  },
])
