import { describe, it, expect } from 'vitest'
import { validateInvite, getUserStatus } from '@/lib/user-management'

// ── validateInvite ───────────────────────────────────────────────────────────

describe('validateInvite', () => {
  const validAttendant = { email: 'jane@example.com', role: 'attendant', station_id: 'some-uuid' }
  const validSupervisor = { email: 'bob@example.com', role: 'supervisor', station_id: 'some-uuid' }

  it('tracer bullet: valid attendant invite returns null', () => {
    expect(validateInvite(validAttendant)).toBeNull()
  })

  it('valid supervisor invite returns null', () => {
    expect(validateInvite(validSupervisor)).toBeNull()
  })

  it('empty email returns error', () => {
    expect(validateInvite({ ...validAttendant, email: '' })).toMatch(/email/)
  })

  it('invalid email format returns error', () => {
    expect(validateInvite({ ...validAttendant, email: 'notanemail' })).toMatch(/email/)
  })

  it('missing role returns error', () => {
    expect(validateInvite({ ...validAttendant, role: '' })).toMatch(/role/)
  })

  it('owner role returns error — owners cannot be invited', () => {
    expect(validateInvite({ ...validAttendant, role: 'owner' })).toMatch(/role/)
  })

  it('invalid role returns error', () => {
    expect(validateInvite({ ...validAttendant, role: 'manager' })).toMatch(/role/)
  })

  it('missing station_id for attendant returns error', () => {
    expect(validateInvite({ ...validAttendant, station_id: '' })).toMatch(/station/)
  })

  it('missing station_id for supervisor returns error', () => {
    expect(validateInvite({ ...validSupervisor, station_id: '' })).toMatch(/station/)
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
