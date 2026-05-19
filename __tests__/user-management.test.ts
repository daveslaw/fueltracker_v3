import { describe, it, expect } from 'vitest'
import { validateInvite, getUserStatus, buildInviteCallbackUrl, resolveCallbackRedirect, validatePasswordInput } from '@/lib/user-management'

// ── validateInvite ───────────────────────────────────────────────────────────

describe('validateInvite', () => {
  const validSupervisor = { email: 'bob@example.com', role: 'supervisor', station_id: 'some-uuid' }

  it('tracer bullet: valid supervisor invite returns null', () => {
    expect(validateInvite(validSupervisor)).toBeNull()
  })

  it('empty email returns error', () => {
    expect(validateInvite({ ...validSupervisor, email: '' })).toMatch(/email/)
  })

  it('invalid email format returns error', () => {
    expect(validateInvite({ ...validSupervisor, email: 'notanemail' })).toMatch(/email/)
  })

  it('missing role returns error', () => {
    expect(validateInvite({ ...validSupervisor, role: '' })).toMatch(/role/)
  })

  it('owner role returns error — owners cannot be invited', () => {
    expect(validateInvite({ ...validSupervisor, role: 'owner' })).toMatch(/role/)
  })

  it('cashier role is valid — returns null', () => {
    expect(validateInvite({ ...validSupervisor, role: 'cashier' })).toBeNull()
  })

  it('attendant role returns error — role has been retired', () => {
    expect(validateInvite({ ...validSupervisor, role: 'attendant' })).toMatch(/role/)
  })

  it('invalid role returns error', () => {
    expect(validateInvite({ ...validSupervisor, role: 'manager' })).toMatch(/role/)
  })

  it('missing station_id for supervisor returns error', () => {
    expect(validateInvite({ ...validSupervisor, station_id: '' })).toMatch(/station/)
  })
})

// ── buildInviteCallbackUrl ───────────────────────────────────────────────────

describe('buildInviteCallbackUrl', () => {
  it('tracer bullet: returns siteUrl + /auth/callback', () => {
    expect(buildInviteCallbackUrl('https://fueltracker-v3.vercel.app')).toBe(
      'https://fueltracker-v3.vercel.app/auth/callback'
    )
  })

  it('falls back to localhost:3000 when siteUrl is undefined', () => {
    expect(buildInviteCallbackUrl(undefined)).toBe('http://localhost:3000/auth/callback')
  })

  it('strips trailing slash from siteUrl', () => {
    expect(buildInviteCallbackUrl('https://fueltracker-v3.vercel.app/')).toBe(
      'https://fueltracker-v3.vercel.app/auth/callback'
    )
  })
})

// ── resolveCallbackRedirect ──────────────────────────────────────────────────

describe('resolveCallbackRedirect', () => {
  it('tracer bullet: valid code with no exchange error redirects to /set-password', () => {
    expect(resolveCallbackRedirect('some-code', false)).toBe('/set-password')
  })

  it('null code redirects to /login?error=invite-expired', () => {
    expect(resolveCallbackRedirect(null, false)).toBe('/login?error=invite-expired')
  })

  it('exchange failure redirects to /login?error=invite-expired', () => {
    expect(resolveCallbackRedirect('some-code', true)).toBe('/login?error=invite-expired')
  })
})

// ── validatePasswordInput ────────────────────────────────────────────────────

describe('validatePasswordInput', () => {
  it('tracer bullet: valid password returns null', () => {
    expect(validatePasswordInput('password123', 'password123')).toBeNull()
  })

  it('password shorter than 8 characters returns error', () => {
    expect(validatePasswordInput('short', 'short')).toMatch(/8/)
  })

  it('mismatched passwords return error', () => {
    expect(validatePasswordInput('password123', 'different1')).toMatch(/match/)
  })

  it('empty password returns error', () => {
    expect(validatePasswordInput('', '')).toMatch(/8/)
  })
})

// ── getUserStatus ────────────────────────────────────────────────────────────

describe('getUserStatus', () => {
  it('tracer bullet: active user returns "active"', () => {
    expect(getUserStatus({ is_active: true })).toBe('active')
  })

  it('inactive user returns "inactive"', () => {
    expect(getUserStatus({ is_active: false })).toBe('inactive')
  })
})
