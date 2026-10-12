import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/Button'

describe('Button component', () => {
  it('renders children with default primary styles', () => {
    render(<Button>Deploy Service</Button>)
    const btn = screen.getByRole('button', { name: /deploy service/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Submit</Button>)
    const btn = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('handles loading state with aria-busy and disabled', () => {
    render(<Button isLoading>Saving Changes</Button>)
    const btn = screen.getByRole('button', { name: /saving changes/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled Action</Button>)
    const btn = screen.getByRole('button', { name: /disabled action/i })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('supports custom variant and size classes', () => {
    render(<Button variant="destructive" size="sm">Delete Resource</Button>)
    const btn = screen.getByRole('button', { name: /delete resource/i })
    expect(btn.className).toContain('bg-destructive')
    expect(btn.className).toContain('text-[11px]')
  })
})
