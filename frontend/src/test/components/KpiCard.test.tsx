import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KpiCard } from '@/components/data/KpiCard'

describe('<KpiCard />', () => {
  it('renders label, numeric value, and unit', () => {
    render(
      <KpiCard
        label="Cost (Last 24h)"
        value="$1,234.56"
        trendDelta={12.4}
        trendSuffix="vs prior 24h"
      />
    )

    expect(screen.getByText('Cost (Last 24h)')).toBeInTheDocument()
    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
    expect(screen.getByText(/12\.4%/)).toBeInTheDocument()
  })

  it('renders loading state skeleton', () => {
    const { container } = render(
      <KpiCard
        label="Ingestion Rate"
        value={50}
        isLoading={true}
      />
    )

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
