import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SeverityBadge } from '@/components/data/SeverityBadge'

describe('<SeverityBadge />', () => {
  it('renders critical badge with ping pulse animation', () => {
    const { container } = render(<SeverityBadge severity="critical" />)
    expect(screen.getByText('critical')).toBeInTheDocument()
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })

  it('renders high, medium, and low severities correctly', () => {
    render(<SeverityBadge severity="high" />)
    expect(screen.getByText('high')).toBeInTheDocument()

    render(<SeverityBadge severity="medium" />)
    expect(screen.getByText('medium')).toBeInTheDocument()

    render(<SeverityBadge severity="low" />)
    expect(screen.getByText('low')).toBeInTheDocument()
  })
})
