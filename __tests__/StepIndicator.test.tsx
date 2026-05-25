import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepIndicator } from '@/components/StepIndicator'

const steps = [
  { label: 'Pumps',      href: '/shift/1/close/pumps',      status: 'complete' as const },
  { label: 'Dips',       href: '/shift/1/close/dips',       status: 'current'  as const },
  { label: 'Deliveries', href: '/shift/1/close/deliveries', status: 'upcoming' as const },
  { label: 'Summary',    href: '/shift/1/close/summary',    status: 'upcoming' as const },
]

function renderIndicator(overrides: Partial<React.ComponentProps<typeof StepIndicator>> = {}) {
  return render(<StepIndicator steps={steps} currentIndex={1} {...overrides} />)
}

describe('StepIndicator', () => {
  // ── Tracer bullet ──────────────────────────────────────────────────────────

  it('completed step renders as a link to its href', () => {
    renderIndicator()
    const link = screen.getByRole('link', { name: /pumps/i })
    expect(link).toHaveAttribute('href', '/shift/1/close/pumps')
  })

  it('current step renders as plain text, not a link', () => {
    renderIndicator()
    expect(screen.queryByRole('link', { name: /dips/i })).not.toBeInTheDocument()
    expect(screen.getByText(/dips/i)).toBeInTheDocument()
  })

  it('upcoming step renders as text, not a link', () => {
    renderIndicator()
    expect(screen.queryByRole('link', { name: /deliveries/i })).not.toBeInTheDocument()
    expect(screen.getByText(/deliveries/i)).toBeInTheDocument()
  })

  it('prev arrow is absent when on the first step', () => {
    renderIndicator({ currentIndex: 0 })
    expect(screen.queryByRole('link', { name: /previous step/i })).not.toBeInTheDocument()
  })

  it('prev arrow links to the previous step href when not on the first step', () => {
    renderIndicator({ currentIndex: 1 })
    expect(screen.getByRole('link', { name: /previous step/i })).toHaveAttribute('href', '/shift/1/close/pumps')
  })

  it('next arrow is absent when on the last step', () => {
    renderIndicator({ currentIndex: steps.length - 1 })
    expect(screen.queryByRole('link', { name: /next step/i })).not.toBeInTheDocument()
  })

  it('next arrow links to the next step href when not on the last step', () => {
    renderIndicator({ currentIndex: 1 })
    expect(screen.getByRole('link', { name: /next step/i })).toHaveAttribute('href', '/shift/1/close/deliveries')
  })
})
