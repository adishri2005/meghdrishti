import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { driver, type Driver, type Config } from 'driver.js'
import 'driver.js/dist/driver.css'
import {
  TOUR_DEFINITIONS,
  routeToTourId,
  type TourId,
} from '@/lib/tours/tourDefinitions'

const STORAGE_KEY = 'meghdrishti-completed-tours'
const FIRST_VISIT_KEY = 'meghdrishti-first-visit-done'

function getCompletedTours(): Set<TourId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('costguard-completed-tours')
    if (raw) return new Set(JSON.parse(raw))
  } catch {
    // ignore
  }
  return new Set()
}

function markTourCompleted(tourId: TourId) {
  const completed = getCompletedTours()
  completed.add(tourId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]))
}

function isFirstVisit(): boolean {
  return !localStorage.getItem(FIRST_VISIT_KEY) && !localStorage.getItem('costguard-first-visit-done')
}

function markFirstVisitDone() {
  localStorage.setItem(FIRST_VISIT_KEY, 'true')
}

/**
 * Returns a unified driver.js config with Meghdrishti theming.
 */
function getDriverConfig(onComplete?: () => void): Config {
  return {
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 8,
    stageRadius: 12,
    popoverOffset: 12,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Finish ✓',
    onDestroyStarted: () => {
      onComplete?.()
    },
  }
}

/**
 * Custom hook that manages driver.js guided tours.
 *
 * - Auto-launches the welcome tour on first visit (after 1.5s delay)
 * - Provides `startTour(tourId)` to manually trigger any tour
 * - Provides `startPageTour()` to trigger the tour for the current page
 * - Tracks completed tours in localStorage to avoid repeating
 * - Cleans up the driver instance on unmount
 */
export function useTour() {
  const driverRef = useRef<Driver | null>(null)
  const location = useLocation()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [])

  /**
   * Start a specific tour by ID.
   */
  const startTour = useCallback((tourId: TourId) => {
    // Destroy any running tour
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }

    const definition = TOUR_DEFINITIONS[tourId]
    if (!definition) return

    const driverInstance = driver(
      getDriverConfig(() => {
        markTourCompleted(tourId)
        driverInstance.destroy()
        driverRef.current = null
      })
    )

    driverRef.current = driverInstance
    driverInstance.setSteps(definition.steps)

    // Small delay to ensure DOM elements are rendered
    requestAnimationFrame(() => {
      driverInstance.drive()
    })
  }, [])

  /**
   * Start the tour for the current page route.
   */
  const startPageTour = useCallback(() => {
    const tourId = routeToTourId(location.pathname)
    startTour(tourId)
  }, [location.pathname, startTour])

  /**
   * Start the welcome tour (for first-time users).
   */
  const startWelcomeTour = useCallback(() => {
    startTour('welcome')
    markFirstVisitDone()
  }, [startTour])

  /**
   * Auto-launch welcome tour on first visit.
   */
  useEffect(() => {
    if (isFirstVisit() && location.pathname === '/') {
      const timer = setTimeout(() => {
        startWelcomeTour()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Check if a tour has been completed.
   */
  const isTourCompleted = useCallback((tourId: TourId): boolean => {
    return getCompletedTours().has(tourId)
  }, [])

  /**
   * Reset all completed tours (for testing/debugging).
   */
  const resetAllTours = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(FIRST_VISIT_KEY)
  }, [])

  /**
   * Get the current page's tour ID.
   */
  const currentTourId = routeToTourId(location.pathname)

  /**
   * Check if any tour is currently active.
   */
  const isTourActive = driverRef.current?.isActive() ?? false

  return {
    startTour,
    startPageTour,
    startWelcomeTour,
    isTourCompleted,
    resetAllTours,
    currentTourId,
    isTourActive,
    currentTourTitle: TOUR_DEFINITIONS[currentTourId]?.title ?? 'Tour',
  }
}
