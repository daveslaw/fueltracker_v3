import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, unmountComponentAtNode } from 'react-dom'
import { act } from 'react'
import { render as tlRender } from '@testing-library/react'
import { SentryUserContext } from '@/components/SentryUserContext'

vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
}))

import * as Sentry from '@sentry/nextjs'

beforeEach(() => {
  vi.mocked(Sentry.setUser).mockClear()
})

describe('SentryUserContext', () => {
  // ── Tracer bullet ──────────────────────────────────────────────────────────

  it('calls Sentry.setUser with id, role, and stationId on mount', () => {
    tlRender(
      <SentryUserContext userId="u1" role="supervisor" stationId="station-1" />
    )
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'u1',
      role: 'supervisor',
      stationId: 'station-1',
    })
  })

  it('converts null stationId to undefined', () => {
    tlRender(
      <SentryUserContext userId="u1" role="owner" stationId={null} />
    )
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'u1',
      role: 'owner',
      stationId: undefined,
    })
  })

  it('calls Sentry.setUser(null) when unmounted', () => {
    const { unmount } = tlRender(
      <SentryUserContext userId="u1" role="cashier" stationId="station-2" />
    )
    vi.mocked(Sentry.setUser).mockClear()
    unmount()
    expect(Sentry.setUser).toHaveBeenCalledWith(null)
  })

  it('re-calls Sentry.setUser when props change', () => {
    const { rerender } = tlRender(
      <SentryUserContext userId="u1" role="supervisor" stationId="station-1" />
    )
    vi.mocked(Sentry.setUser).mockClear()
    rerender(
      <SentryUserContext userId="u1" role="supervisor" stationId="station-2" />
    )
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'u1',
      role: 'supervisor',
      stationId: 'station-2',
    })
  })
})
