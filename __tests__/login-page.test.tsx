import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'
import { getStationId } from '@/lib/station-device'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/station-device', () => ({
  getStationId: vi.fn(),
}))

vi.mock('@/components/UserPicker', () => ({
  UserPicker: () => <div data-testid="user-picker" />,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { setSession: vi.fn() } }),
}))

vi.mock('@/app/(auth)/login/actions', () => ({
  signInWithPassword: vi.fn(),
  resetPassword: vi.fn(),
}))

function mockBoundDevice(stationId: string | null) {
  vi.mocked(getStationId).mockReturnValue(stationId)
}

describe('LoginPage', () => {
  // ── Tracer bullet ──────────────────────────────────────────────────────────

  it('renders the User Picker with an "Owner login" control on a bound device', async () => {
    mockBoundDevice('station-1')
    render(<LoginPage />)

    expect(await screen.findByTestId('user-picker')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /owner login/i })).toBeInTheDocument()
  })

  it('shows the password form and hides the User Picker after clicking "Owner login"', async () => {
    mockBoundDevice('station-1')
    const user = userEvent.setup()
    render(<LoginPage />)

    await screen.findByTestId('user-picker')
    await user.click(screen.getByRole('button', { name: /owner login/i }))

    expect(screen.queryByTestId('user-picker')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('returns to the User Picker after clicking "Back to staff picker"', async () => {
    mockBoundDevice('station-1')
    const user = userEvent.setup()
    render(<LoginPage />)

    await screen.findByTestId('user-picker')
    await user.click(screen.getByRole('button', { name: /owner login/i }))
    await user.click(screen.getByRole('button', { name: /back to staff picker/i }))

    expect(await screen.findByTestId('user-picker')).toBeInTheDocument()
  })

  it('renders the password form directly with no back link on an unbound device', async () => {
    mockBoundDevice(null)
    render(<LoginPage />)

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByTestId('user-picker')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to staff picker/i })).not.toBeInTheDocument()
  })
})
