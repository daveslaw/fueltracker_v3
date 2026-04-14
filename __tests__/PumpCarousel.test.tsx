import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock ClosePumpCaptureForm — real form makes network calls.
// Renders a "Save" button that fires onSaved when clicked.
vi.mock('@/app/shift/[id]/close/pumps/ClosePumpCaptureForm', () => ({
  ClosePumpCaptureForm: ({
    pumpId,
    onSaved,
  }: {
    pumpId: string
    onSaved?: () => void
  }) => (
    <button data-testid={`save-${pumpId}`} onClick={onSaved}>
      Save
    </button>
  ),
}))

import { PumpCarousel } from '@/app/shift/[id]/close/pumps/PumpCarousel'

const pumps = [
  { id: 'p1', label: 'Pump 1', defaultMeter: '' },
  { id: 'p2', label: 'Pump 2', defaultMeter: '' },
  { id: 'p3', label: 'Pump 3', defaultMeter: '' },
]

function renderCarousel(
  overrides: Partial<React.ComponentProps<typeof PumpCarousel>> = {}
) {
  return render(
    <PumpCarousel
      shiftId="shift-1"
      pumps={pumps}
      initialSavedIds={[]}
      {...overrides}
    />
  )
}

function currentPumpLabel() {
  return screen.getByTestId('current-pump-label').textContent
}

// ── Tracer bullet ─────────────────────────────────────────────────────────────

describe('PumpCarousel', () => {
  it('displays the first pump on mount', () => {
    renderCarousel()
    expect(currentPumpLabel()).toBe('Pump 1')
  })

  // ── Initial positioning ───────────────────────────────────────────────────

  it('starts on the first unsaved pump when some are already saved', () => {
    renderCarousel({ initialSavedIds: ['p1', 'p2'] })
    expect(currentPumpLabel()).toBe('Pump 3')
  })

  it('starts on pump 0 when all pumps are already saved', () => {
    renderCarousel({ initialSavedIds: ['p1', 'p2', 'p3'] })
    expect(currentPumpLabel()).toBe('Pump 1')
  })

  // ── Navigation ────────────────────────────────────────────────────────────

  it('Next button advances to the next pump', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(currentPumpLabel()).toBe('Pump 2')
  })

  it('Previous button goes back to the prior pump', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(currentPumpLabel()).toBe('Pump 1')
  })

  it('Previous button is disabled on the first pump', () => {
    renderCarousel()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  it('Next button is disabled on the last pump', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('dot buttons navigate directly to a pump', async () => {
    renderCarousel()
    const dots = screen.getAllByTitle(/^Pump \d+$/)
    await userEvent.click(dots[2]) // click "Pump 3" dot
    expect(currentPumpLabel()).toBe('Pump 3')
  })

  // ── Auto-advance on save ──────────────────────────────────────────────────

  it('auto-advances to the next unsaved pump after saving', async () => {
    renderCarousel()
    await userEvent.click(screen.getByTestId('save-p1'))
    expect(currentPumpLabel()).toBe('Pump 2')
  })

  it('does not advance past the last pump after saving the last one', async () => {
    renderCarousel()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByTestId('save-p3'))
    expect(currentPumpLabel()).toBe('Pump 3')
  })

  it('skips already-saved pumps when auto-advancing', async () => {
    // p2 is pre-saved — saving p1 should jump to p3
    renderCarousel({ initialSavedIds: ['p2'] })
    await userEvent.click(screen.getByTestId('save-p1'))
    expect(currentPumpLabel()).toBe('Pump 3')
  })

  // ── Progress and saved state ──────────────────────────────────────────────

  it('shows progress counter reflecting initial saved count', () => {
    renderCarousel({ initialSavedIds: ['p1'] })
    expect(screen.getByText('1/3 saved')).toBeInTheDocument()
  })

  it('increments the progress counter after saving a pump', async () => {
    renderCarousel()
    await userEvent.click(screen.getByTestId('save-p1'))
    expect(screen.getByText('1/3 saved')).toBeInTheDocument()
  })

  it('shows Saved badge on the current pump when it is already saved', () => {
    // all saved → carousel starts at index 0 (p1) which is saved → badge visible
    renderCarousel({ initialSavedIds: ['p1', 'p2', 'p3'] })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('shows Saved badge after saving the current pump', async () => {
    renderCarousel()
    await userEvent.click(screen.getByTestId('save-p1'))
    // navigate back to p1 to see its badge
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})
