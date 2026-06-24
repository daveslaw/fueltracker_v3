import { describe, it, expect } from 'vitest'
import { validateInvite, getUserStatus, buildInviteCallbackUrl, resolveCallbackRedirect, validatePasswordInput, validateFullName, validatePin, generateUsername, buildSyntheticEmail, validateCreateStationUser } from '@/lib/user-management'

// ── validateInvite ───────────────────────────────────────────────────────────

describe('validateInvite', () => {
  const validSupervisor = { email: 'bob@example.com', role: 'supervisor', station_id: 'some-uuid', full_name: 'Bob Smith' }

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

  it('missing full_name returns error', () => {
    expect(validateInvite({ ...validSupervisor, full_name: '' })).toMatch(/name/)
  })

  it('whitespace-only full_name returns error', () => {
    expect(validateInvite({ ...validSupervisor, full_name: '   ' })).toMatch(/name/)
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

// ── validateFullName ─────────────────────────────────────────────────────────

describe('validateFullName', () => {
  it('tracer bullet: valid name returns null', () => {
    expect(validateFullName('Maria Sithole')).toBeNull()
  })

  it('empty string returns error', () => {
    expect(validateFullName('')).toMatch(/name/)
  })

  it('whitespace-only string returns error', () => {
    expect(validateFullName('   ')).toMatch(/name/)
  })
})

// ── validatePin ──────────────────────────────────────────────────────────────

describe('validatePin', () => {
  it('tracer bullet: valid 4-digit numeric PIN returns null', () => {
    expect(validatePin('1234')).toBeNull()
  })

  it('non-numeric input returns error', () => {
    expect(validatePin('12ab')).toMatch(/digit/)
  })

  it('fewer than 4 digits returns error', () => {
    expect(validatePin('123')).toMatch(/4/)
  })

  it('more than 4 digits returns error', () => {
    expect(validatePin('12345')).toMatch(/4/)
  })

  it('empty string returns error', () => {
    expect(validatePin('')).toMatch(/4/)
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

// ── generateUsername ─────────────────────────────────────────────────────────

describe('generateUsername', () => {
  it('tracer bullet: full name with no collisions returns firstname.lastname', () => {
    expect(generateUsername('Thabo Nkosi', [])).toBe('thabo.nkosi')
  })

  it('single name with no collisions returns just the name', () => {
    expect(generateUsername('Thabo', [])).toBe('thabo')
  })

  it('collision with base username appends suffix 2', () => {
    expect(generateUsername('Thabo Nkosi', ['thabo.nkosi'])).toBe('thabo.nkosi2')
  })

  it('collision with base and 2 appends suffix 3', () => {
    expect(generateUsername('Thabo Nkosi', ['thabo.nkosi', 'thabo.nkosi2'])).toBe('thabo.nkosi3')
  })

  it('strips non-alpha characters and returns lowercase', () => {
    expect(generateUsername("O'Brien Connor", [])).toBe('obrien.connor')
  })

  it('extra whitespace between names is ignored', () => {
    expect(generateUsername('  Maria  Sithole  ', [])).toBe('maria.sithole')
  })
})

// ── buildSyntheticEmail ──────────────────────────────────────────────────────

describe('buildSyntheticEmail', () => {
  it('tracer bullet: username@fueltracker.internal', () => {
    expect(buildSyntheticEmail('thabo.nkosi')).toBe('thabo.nkosi@fueltracker.internal')
  })
})

// ── validateCreateStationUser ────────────────────────────────────────────────

describe('validateCreateStationUser', () => {
  const valid = {
    full_name: 'Thabo Nkosi',
    role: 'supervisor',
    station_id: 'some-uuid',
    pin: '1234',
    pin_confirm: '1234',
    username: 'thabo.nkosi',
  }

  it('tracer bullet: valid input returns null', () => {
    expect(validateCreateStationUser(valid)).toBeNull()
  })

  it('missing full_name returns error', () => {
    expect(validateCreateStationUser({ ...valid, full_name: '' })).toMatch(/name/)
  })

  it('whitespace-only full_name returns error', () => {
    expect(validateCreateStationUser({ ...valid, full_name: '   ' })).toMatch(/name/)
  })

  it('invalid role returns error', () => {
    expect(validateCreateStationUser({ ...valid, role: 'owner' })).toMatch(/role/)
  })

  it('missing station_id returns error', () => {
    expect(validateCreateStationUser({ ...valid, station_id: '' })).toMatch(/station/)
  })

  it('invalid PIN returns error', () => {
    expect(validateCreateStationUser({ ...valid, pin: '12x4' })).toMatch(/digit/)
  })

  it('PIN mismatch returns error', () => {
    expect(validateCreateStationUser({ ...valid, pin_confirm: '9999' })).toMatch(/match/)
  })

  it('empty username returns error', () => {
    expect(validateCreateStationUser({ ...valid, username: '' })).toMatch(/username/)
  })
})
