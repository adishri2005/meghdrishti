import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
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
    element: (
      <PageSuspense>
        <Login />
      </PageSuspense>
    ),
  },
  {
    path: '/forbidden',
    element: (
      <PageSuspense>
        <Forbidden />
      </PageSuspense>
    ),
  },
  {
    path: '/',
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
