import { useState, type ReactNode } from 'react'
import { HelpCircle, ChevronDown, RotateCcw, Map, Compass } from 'lucide-react'
import {
  RiShieldLine,
  RiDashboardLine,
  RiAlarmWarningLine,
  RiMoneyDollarCircleLine,
  RiFlashlightLine,
  RiRadarLine,
  RiServerLine,
  RiRocketLine,
  RiSettings3Line,
} from 'react-icons/ri'
import { useTour } from '@/hooks/useTour'
import type { TourId } from '@/lib/tours/tourDefinitions'

const TOUR_MENU_ITEMS: { id: TourId; label: string; icon: ReactNode }[] = [
  { id: 'welcome', label: 'Welcome Tour', icon: <RiShieldLine className="w-4 h-4" /> },
  { id: 'overview', label: 'Overview Dashboard', icon: <RiDashboardLine className="w-4 h-4" /> },
  { id: 'anomalies', label: 'Anomaly Detection', icon: <RiAlarmWarningLine className="w-4 h-4" /> },
  { id: 'costs', label: 'Cost Explorer', icon: <RiMoneyDollarCircleLine className="w-4 h-4" /> },
  { id: 'ingestion', label: 'Ingestion Studio', icon: <RiFlashlightLine className="w-4 h-4" /> },
  { id: 'monitoring', label: 'Monitoring Hub', icon: <RiRadarLine className="w-4 h-4" /> },
  { id: 'resources', label: 'Resource Inventory', icon: <RiServerLine className="w-4 h-4" /> },
  { id: 'deployments', label: 'Deployments', icon: <RiRocketLine className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <RiSettings3Line className="w-4 h-4" /> },
]

export function TourButton() {
  const { startTour, startPageTour, resetAllTours, currentTourId, currentTourTitle } = useTour()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleStartCurrent = () => {
    setMenuOpen(false)
    startPageTour()
  }

  const handleStartTour = (tourId: TourId) => {
    setMenuOpen(false)
    startTour(tourId)
  }

  const handleReset = () => {
    resetAllTours()
    setMenuOpen(false)
  }

  return (
    <div className="relative" id="tour-help-button">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1 p-1.5 rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
        title="Guided Tours & Help"
        aria-label="Open guided tours menu"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <ChevronDown className="w-2.5 h-2.5" />
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-popover text-popover-foreground border border-border shadow-lg z-50 py-1.5 animate-in fade-in zoom-in-95">
            {/* Current Page Tour */}
            <div className="px-3 pt-1 pb-1.5">
              <button
                type="button"
                onClick={handleStartCurrent}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <Compass className="w-4 h-4" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Tour This Page</span>
                  <span className="text-[10px] text-primary/70 font-mono">
                    {currentTourTitle}
                  </span>
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/60 mx-3 my-1" />

            {/* Header */}
            <div className="px-3 py-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Map className="w-3 h-3" />
                <span>All Tours</span>
              </div>
            </div>

            {/* Tour List */}
            <div className="max-h-[280px] overflow-y-auto px-1.5">
              {TOUR_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleStartTour(item.id)}
                  className={`w-full text-left px-3 py-1.5 mx-0 text-xs flex items-center gap-2.5 rounded-md hover:bg-muted/50 transition-colors ${
                    currentTourId === item.id
                      ? 'text-foreground font-medium bg-muted/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="w-5 flex items-center justify-center shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                  {currentTourId === item.id && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-border/60 mx-3 my-1" />

            {/* Reset */}
            <div className="px-1.5 pb-0.5">
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Tours</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
