# Meghdrishti Design System & Frontend Architecture

> **Elevated, Minimalist Cloud FinOps Platform**  
> Inspired by the craft and restraint of Linear, Vercel, Stripe, and Things 3.

---

## 1. Design Philosophy

The Meghdrishti redesign transforms a cluttered operational dashboard into a calm, intentional, high-density mission control. The guiding tenets are:

1. **Content Over Decoration**:
   - Eliminated distracting background dot grids, rainbow badge palettes, loud glow borders, and heavy drop shadows.
   - Information hierarchy is established through precise typography, whitespace, and subtle 1px border dividers.
2. **Predictable Semantic Palette**:
   - Colors are strictly purposeful:
     - **Primary (Teal/Emerald)**: Interactive accents, primary actions, and system health.
     - **Severity (Low, Medium, High, Critical)**: High-contrast, WCAG AA compliant muted badge fills with tinted borders and sharp text.
     - **Neutrals**: Warm slate/zinc scales engineered in HSL custom properties for flawless light and dark mode pairing.
3. **Data Density & Readability**:
   - Monospace tabular numbers (`font-mono tabular-nums`) across all financial, latency, and sample metrics to prevent visual jitter.
   - Compact navigation (48px Topbar, 64px/240px Sidebar) maximizing vertical viewport real estate for data tables, time series, and anomaly feeds.
4. **Motion with Restraint**:
   - Micro-transitions restricted to 150ms–200ms easing (`cubic-bezier(0.16, 1, 0.3, 1)`).
   - Strict adherence to `@media (prefers-reduced-motion: reduce)`.

---

## 2. Design Tokens Architecture

All color tokens are exposed via CSS custom properties (`hsl(var(--token))`) and mapped in `tailwind.config.ts`.

### 2.1 Neutral Surfaces & Borders

| Token | Light Mode (HSL) | Dark Mode (HSL) | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `210 20% 98%` | `216 28% 6.5%` | App base canvas |
| `--surface` | `0 0% 100%` | `216 26% 8.5%` | Cards, tables, modal bodies |
| `--surface-elevated` | `210 20% 96%` | `216 24% 11.5%` | Popovers, active pills, table headers |
| `--border` | `214 20% 88%` | `216 20% 15%` | Subtle container and card borders |
| `--muted` | `210 18% 92%` | `216 20% 13%` | Pill backgrounds, inactive controls |
| `--muted-foreground` | `215 16% 46%` | `215 16% 60%` | Secondary descriptions, timestamps |
| `--foreground` | `222 47% 11%` | `210 24% 96%` | Primary text and headings |

### 2.2 Semantic Status & Severities

| Token | HSL Value | Background Class | Text Class | Border Class |
| :--- | :--- | :--- | :--- | :--- |
| `success` | `152 68% 42%` | `bg-success/10` | `text-success` | `border-success/25` |
| `warning` | `38 92% 50%` | `bg-warning/10` | `text-warning` | `border-warning/25` |
| `danger` | `0 72% 51%` | `bg-danger/10` | `text-danger` | `border-danger/25` |
| `info` | `210 92% 55%` | `bg-info/10` | `text-info` | `border-info/25` |
| `severity-critical` | `0 72% 51%` | `bg-severity-critical/10` | `text-severity-critical` | `border-severity-critical/30` |
| `severity-high` | `24 94% 53%` | `bg-severity-high/10` | `text-severity-high` | `border-severity-high/30` |
| `severity-medium` | `38 92% 50%` | `bg-severity-medium/10` | `text-severity-medium` | `border-severity-medium/30` |
| `severity-low` | `210 80% 56%` | `bg-severity-low/10` | `text-severity-low` | `border-severity-low/30` |

---

## 3. Typography Hierarchy

Fonts are loaded locally via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` for zero external network dependency and crisp subpixel rendering.

- **Display & Headings**: `font-sans` (`Geist Variable`, `-apple-system`, `sans-serif`)
  - `h1`: `text-lg sm:text-xl font-semibold tracking-tight`
  - `h2`: `text-base font-semibold tracking-tight`
  - `h3`: `text-sm font-medium tracking-normal`
- **Body & Labels**: `text-xs sm:text-sm text-foreground`
- **Captions & Metadata**: `text-[11px] text-muted-foreground`
- **Metrics, IDs & Hashes**: `font-mono text-xs tabular-nums tracking-tight`

---

## 4. Layout & Spacing Rhythm

### 4.1 Shell Layout
- **Topbar**: Fixed `h-12` (48px) compact bar featuring:
  - Mobile hamburger trigger (hidden on `lg:` viewports).
  - Environment badges (Live/Demo indicator).
  - Quick Search trigger (`⌘K`).
  - Refresh interval segmented selector (`Off`, `10s`, `30s`, `60s`).
  - Real-time connection indicator (SSE live pulse dot).
  - Light/Dark theme toggle.
  - User profile dropdown with RBAC role indicators.
- **Sidebar**:
  - Desktop: Collapsible between `w-60` (240px expanded) and `w-16` (64px collapsed).
  - Mobile: Slide-over drawer with backdrop blur and touch overlay.
  - Navigation links: Monochromatic icons with subtle left-border active indicator (`border-l-2 border-primary`).
- **Status Strip**: Understated system health banner with collapsed toggle to preserve vertical space.

### 4.2 Spacing
- Layout padding: `p-4 sm:p-6` with maximum content constraint `max-w-[1600px] mx-auto`.
- Component gap: `gap-3` and `gap-4` adhering to the 4px base increment grid.

---

## 5. Core Component Design

### 5.1 KPI Cards (`KpiCard.tsx`)
- Mono-tone iconography housed in `p-2 rounded-lg bg-muted/60 text-muted-foreground`.
- Tabular metric values with optional trend badges (`+X%` / `-X%`).
- Micro-sparkline integration seamlessly blending with the card baseline.

### 5.2 Severity Badges (`SeverityBadge.tsx`)
- Micro-sized (`text-[10px] font-mono px-2 py-0.5 rounded-md`).
- Pill styling combining 10% opacity fills, 25% opacity matching borders, and high-contrast foreground text.
- Pulsing dot indicators on `critical` and `high` alerts.

### 5.3 Charts & Visualizations
- Shared theme token provider (`chartTheme.ts`) ensuring ECharts and SVG sparklines automatically sync with CSS custom properties.
- Fullscreen expand modal support (`ChartCard.tsx`) with instant CSV export and timeframe toggles.

### 5.4 Data Tables
- Sticky table headers with subtle background fills (`bg-surface-elevated`).
- Hover highlights (`hover:bg-muted/20`).
- Truncated IDs with copy-to-clipboard micro-actions.

---

## 6. Accessibility & Responsiveness

1. **High Contrast**: Text contrast ratios meet or exceed WCAG 2.1 AA standards for both light (`#0f172a` on `#f8fafc`) and dark (`#f1f5f9` on `#0c1015`) themes.
2. **Keyboard Navigation**: Universal `:focus-visible` ring (`ring-2 ring-ring ring-offset-1`) on buttons, inputs, links, and select elements.
3. **Responsive Breakpoints**:
   - `xs` (360px–640px): Full mobile layout with slide-over drawer navigation and stacked KPI cards.
   - `md` (768px): 2-column metric cards and inline search bars.
   - `lg` (1024px+): Expanded sidebar and multi-panel FinOps analytics.
4. **Motion Safety**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

## 7. Hard Constraints & API Integrity Verification

- **Backend**: Zero changes to Python FastAPI services, SQLite/PostgreSQL schemas, Alembic migrations, Prometheus/Grafana configs, Docker containers, or Nginx configs.
- **API Contracts**: All request payloads, response schemas, and query parameters remain 100% identical.
- **Build Verification**:
  - `tsc -b`: 0 errors
  - `vite build`: Clean production bundle output
  - `vitest run`: 6 test suites passed, 28/28 tests passing
