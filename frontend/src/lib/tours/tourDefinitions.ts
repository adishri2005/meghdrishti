import type { DriveStep, Side } from 'driver.js'

/**
 * Tour definitions for every major page/route in Meghdrishti.
 * Each definition is an array of DriveStep objects, targeting DOM elements
 * by their `id` attribute (prefixed with `#tour-`).
 *
 * Naming convention: all tour-target IDs use the `tour-` prefix.
 */

// ─── Shared Styles ───────────────────────────────────────────────────────
const popoverClass = 'meghdrishti-tour-popover'

function step(
  element: string,
  title: string,
  description: string,
  side: Side = 'bottom',
  align: 'start' | 'center' | 'end' = 'center'
): DriveStep {
  return {
    element,
    popover: {
      title,
      description,
      side,
      align,
      popoverClass,
    },
  }
}

// ─── Welcome Tour (first-time visit) ────────────────────────────────────
export const welcomeTour: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to Meghdrishti',
      description:
        'Meghdrishti is your AI-powered FinOps control center for real-time cloud cost anomaly detection, monitoring, and multi-cloud spend governance. Let us give you a quick tour!',
      popoverClass,
    },
  },
  step(
    '#tour-sidebar-nav',
    'Navigation Sidebar',
    'Use the sidebar to navigate between modules: Overview, Anomalies, Costs, Resources, Ingestion, Monitoring, Logs, Deployments, and Settings.',
    'right',
    'start'
  ),
  step(
    '#tour-topbar',
    'Control Bar',
    'The top bar gives you quick access to the command palette, time range selector, live auto-refresh toggle, theme switch, and notifications.',
    'bottom',
    'center'
  ),
  step(
    '#tour-command-palette-trigger',
    'Command Palette',
    'Press Ctrl+K to instantly search, jump to pages, or run actions. It\'s your keyboard-first command center.',
    'bottom',
    'center'
  ),
  step(
    '#tour-time-range',
    'Global Time Range',
    'Control the time window for all dashboards and charts from here. Choose from preset ranges like Last 1h, 6h, 24h, or 7d.',
    'bottom',
    'end'
  ),
  step(
    '#tour-live-toggle',
    'Live Auto-Refresh',
    'Toggle real-time data streaming. When Live is on, dashboards automatically refresh at your chosen interval (5s, 10s, 30s, 1m).',
    'bottom',
    'end'
  ),
  step(
    '#tour-theme-toggle',
    'Theme Toggle',
    'Switch between Dark, Light, and System themes. Your preference is saved automatically.',
    'bottom',
    'end'
  ),
  step(
    '#tour-notifications',
    'Notifications',
    'View real-time system notifications, anomaly alerts, and deployment status updates here.',
    'bottom',
    'end'
  ),
  step(
    '#tour-user-panel',
    'User & Session',
    'Your account info, role (Admin/Operator/Viewer), and the active cluster status are shown here. Click the logout icon to sign out.',
    'right',
    'end'
  ),
]

// ─── Overview Tour ──────────────────────────────────────────────────────
export const overviewTour: DriveStep[] = [
  {
    popover: {
      title: 'Mission Control Overview',
      description:
        'This is your high-level dashboard. It aggregates KPIs, cost trends, anomaly detections, pipeline health, and deployment status — all in real time.',
      popoverClass,
    },
  },
  step(
    '#tour-overview-header',
    'Page Header & Quick Actions',
    'The header shows the page title with a "Live Telemetry" badge. Quick actions let you inject a synthetic cost spike, open the Simulator Studio, or launch Grafana.',
    'bottom',
    'start'
  ),
  step(
    '#tour-quick-spike',
    'Quick Spike Simulator',
    'Inject an instant 14.5x cost spike to test the end-to-end anomaly detection pipeline. The ingested data flows through the pipeline in real time.',
    'bottom',
    'start'
  ),
  step(
    '#tour-kpi-row',
    'KPI Cards',
    'Six key performance indicators at a glance: 24h Cost, Open Anomalies, Ingestion Rate, API Latency (p95), Queue Lag, and Detection Delay. Click any card to drill down.',
    'bottom',
    'center'
  ),
  step(
    '#tour-cost-chart',
    'Cloud Spend Over Time',
    'An interactive stacked area chart showing hourly cost breakdown by team, service, region, or resource type. Diamond markers show detected anomalies — click them to inspect.',
    'bottom',
    'start'
  ),
  step(
    '#tour-anomaly-feed',
    'Latest Anomalies Feed',
    'A live feed of the most recent anomaly detections. Shows severity, resource ID, root cause summary, observed vs expected cost, and a quick "Ack" button.',
    'left',
    'start'
  ),
  step(
    '#tour-top-spenders',
    'Top Cloud Spenders',
    'Ranked list of resources with the highest 24h expenditure. Click any resource to view its detailed cost profile and anomaly history.',
    'right',
    'start'
  ),
  step(
    '#tour-heatmap',
    'Spend Density Heatmap',
    'A heatmap visualizing hourly cost intensity across resources. Darker cells indicate higher spend — useful for spotting time-of-day patterns.',
    'bottom',
    'center'
  ),
  step(
    '#tour-pipeline-health',
    'Pipeline Health Charts',
    'Small-multiple charts showing Throughput (Ingest vs Process), Redis Queue Backlog, API Error Ratio, and Detection Delay. These track the health of the entire ingestion pipeline.',
    'top',
    'center'
  ),
]

// ─── Anomalies Tour ─────────────────────────────────────────────────────
export const anomaliesTour: DriveStep[] = [
  {
    popover: {
      title: 'Anomaly Detection Center',
      description:
        'This page shows all statistical outliers detected by the anomaly engine across your cloud resources. Filter, search, and take bulk actions on anomalies.',
      popoverClass,
    },
  },
  step(
    '#tour-anomalies-header',
    'Page Header & Bulk Actions',
    'The header shows the page title and provides bulk action buttons: "Acknowledge All" marks all open anomalies as seen, "Resolve All" closes them.',
    'bottom',
    'start'
  ),
  step(
    '#tour-bulk-acknowledge',
    'Acknowledge All',
    'One-click to acknowledge all open anomalies. The count badge shows how many open anomalies remain. Requires Operator or Admin role.',
    'bottom',
    'start'
  ),
  step(
    '#tour-bulk-resolve',
    'Resolve All',
    'One-click to resolve all anomalies at once. This marks them as closed/handled. Available for Operators and Admins.',
    'bottom',
    'start'
  ),
  step(
    '#tour-severity-chips',
    'Severity Quick Filters',
    'Click these chips to filter by severity level. Each shows the real-time count of open anomalies for that severity: Critical, High, Medium, Low.',
    'bottom',
    'center'
  ),
  step(
    '#tour-anomalies-filter-bar',
    'Filter & Search Bar',
    'Use the search box to filter by resource ID. Toggle between status tabs (All, Open, Acknowledged, Resolved). Reset filters to return to defaults.',
    'bottom',
    'center'
  ),
  step(
    '#tour-anomalies-table',
    'Anomaly Table',
    'The main data table lists all anomalies with severity, resource ID, type, expected vs actual cost, z-score, detection time, and status. Click any row to open the detail drawer.',
    'top',
    'center'
  ),
]

// ─── Costs Tour ─────────────────────────────────────────────────────────
export const costsTour: DriveStep[] = [
  {
    popover: {
      title: 'Cost Explorer',
      description:
        'Dive deep into cloud spend analytics with interactive charts, breakdowns, and comparisons. Analyze costs by team, service, region, or resource type.',
      popoverClass,
    },
  },
  step(
    '#tour-costs-header',
    'Cost Explorer Header',
    'The header provides chart type selection (Stacked, Lines, Bars), grouping options (Team, Service, Region, Resource Type), and export controls.',
    'bottom',
    'start'
  ),
  step(
    '#tour-costs-summary-cards',
    'Cost Summary Cards',
    'Top-level KPI cards showing Total Spend, Average Daily, Peak Day, and Trend Delta. Each card includes a mini sparkline for context.',
    'bottom',
    'center'
  ),
  step(
    '#tour-costs-main-chart',
    'Main Cost Chart',
    'The primary cost visualization — toggle between stacked area, line, and bar chart views. Group by team, service, region, or resource type to see different breakdowns.',
    'bottom',
    'center'
  ),
  step(
    '#tour-costs-breakdown',
    'Cost Breakdown Panel',
    'Detailed per-group breakdown with percentage shares, trend deltas, and sparklines. Click any row to drill into that group\'s cost history.',
    'top',
    'center'
  ),
]

// ─── Ingestion Tour ─────────────────────────────────────────────────────
export const ingestionTour: DriveStep[] = [
  {
    popover: {
      title: 'Ingestion & Simulator Studio',
      description:
        'Control the data ingestion pipeline, simulate cost scenarios, and monitor job processing in real time. This is where you test anomaly detection end-to-end.',
      popoverClass,
    },
  },
  step(
    '#tour-ingestion-header',
    'Ingestion Dashboard',
    'The header shows the current pipeline status with real-time metrics from Prometheus: records ingested, processing rate, queue depth, and error counts.',
    'bottom',
    'start'
  ),
  step(
    '#tour-ingestion-kpis',
    'Pipeline KPI Cards',
    'Real-time pipeline metrics: Records Ingested, Processing Rate, Redis Queue Depth, and Pipeline Errors. These update live when auto-refresh is enabled.',
    'bottom',
    'center'
  ),
  step(
    '#tour-simulator-panel',
    'Scenario Simulator',
    'Configure and launch simulated cost scenarios: Spike (sudden cost surge), Drift (gradual increase), New Resource (provision a new cloud resource), or Seed History (backfill data).',
    'bottom',
    'center'
  ),
  step(
    '#tour-jobs-table',
    'Job History',
    'View all ingestion jobs with their status (Processing, Done, Failed), scenario type, resource, duration, and records affected. Click any job to inspect its details.',
    'top',
    'center'
  ),
]

// ─── Monitoring Tour ────────────────────────────────────────────────────
export const monitoringTour: DriveStep[] = [
  {
    popover: {
      title: 'Monitoring Hub',
      description:
        'Comprehensive infrastructure monitoring with native charts, embedded Grafana dashboards, Prometheus console, alert rules, and scrape target status.',
      popoverClass,
    },
  },
  step(
    '#tour-monitoring-tabs',
    'Monitoring Tabs',
    'Switch between monitoring views: Native Charts (built-in), Grafana (embedded dashboards), Prometheus Console (direct PromQL), Alert Rules, and Scrape Targets.',
    'bottom',
    'center'
  ),
]

// ─── Resources Tour ─────────────────────────────────────────────────────
export const resourcesTour: DriveStep[] = [
  {
    popover: {
      title: 'Resource Inventory',
      description:
        'Browse and manage all monitored cloud resources. View cost breakdowns, anomaly counts, and health status per resource.',
      popoverClass,
    },
  },
  step(
    '#tour-resources-header',
    'Resources Header',
    'The header shows the total resource count and provides search and filter controls.',
    'bottom',
    'start'
  ),
  step(
    '#tour-resources-table',
    'Resource Table',
    'Each row shows a resource with its ID, type, team, 24h cost, anomaly count, and status. Click any resource to view its detailed profile.',
    'top',
    'center'
  ),
]

// ─── Deployments Tour ───────────────────────────────────────────────────
export const deploymentsTour: DriveStep[] = [
  {
    popover: {
      title: 'Blue/Green Deployments',
      description:
        'Manage and monitor your zero-downtime Blue/Green deployment pipeline. Track deployment history, active clusters, and rollback capabilities.',
      popoverClass,
    },
  },
  step(
    '#tour-deployments-header',
    'Deployments Header',
    'Shows the current active cluster (Blue/Green), version, and deployment controls.',
    'bottom',
    'start'
  ),
  step(
    '#tour-deployments-timeline',
    'Deployment Timeline',
    'A chronological view of all deployments with status (Active, Rolled Back, Pending), version numbers, and timestamps.',
    'top',
    'center'
  ),
]

// ─── Settings Tour ──────────────────────────────────────────────────────
export const settingsTour: DriveStep[] = [
  {
    popover: {
      title: 'System Settings',
      description:
        'Configure Meghdrishti behavior: anomaly detection thresholds, notification preferences, team management, and system configuration. Admin access required.',
      popoverClass,
    },
  },
  step(
    '#tour-settings-tabs',
    'Settings Sections',
    'Navigate between settings categories: Detection (thresholds & sensitivity), Notifications (channels & rules), Teams (user & team management), and System (global config).',
    'bottom',
    'center'
  ),
]

// ─── Route → Tour Mapping ───────────────────────────────────────────────
export type TourId =
  | 'welcome'
  | 'overview'
  | 'anomalies'
  | 'costs'
  | 'ingestion'
  | 'monitoring'
  | 'resources'
  | 'deployments'
  | 'settings'

export const TOUR_DEFINITIONS: Record<TourId, { title: string; steps: DriveStep[] }> = {
  welcome: { title: 'Welcome to Meghdrishti', steps: welcomeTour },
  overview: { title: 'Overview Dashboard', steps: overviewTour },
  anomalies: { title: 'Anomaly Detection', steps: anomaliesTour },
  costs: { title: 'Cost Explorer', steps: costsTour },
  ingestion: { title: 'Ingestion Studio', steps: ingestionTour },
  monitoring: { title: 'Monitoring Hub', steps: monitoringTour },
  resources: { title: 'Resource Inventory', steps: resourcesTour },
  deployments: { title: 'Deployments', steps: deploymentsTour },
  settings: { title: 'Settings', steps: settingsTour },
}

/**
 * Maps a route pathname to its corresponding tour ID.
 */
export function routeToTourId(pathname: string): TourId {
  const clean = pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
  switch (clean) {
    case '':
      return 'overview'
    case 'anomalies':
      return 'anomalies'
    case 'costs':
      return 'costs'
    case 'ingestion':
      return 'ingestion'
    case 'monitoring':
      return 'monitoring'
    case 'resources':
      return 'resources'
    case 'deployments':
      return 'deployments'
    case 'settings':
      return 'settings'
    default:
      return 'overview'
  }
}
