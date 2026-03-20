export const INVITABLE_ROLES = ['attendant', 'supervisor'] as const
export type InvitableRole = typeof INVITABLE_ROLES[number]
export type UserStatus = 'active' | 'pending' | 'inactive'

// ── validateInvite ───────────────────────────────────────────────────────────

export function validateInvite(input: {
  email: string
  role: string
  station_id: string
}): string | null {
  if (!input.email.trim()) return 'A valid email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'A valid email is required'
  if (!(INVITABLE_ROLES as readonly string[]).includes(input.role))
    return `Invalid role — must be one of: ${INVITABLE_ROLES.join(', ')}`
  if (!input.station_id) return 'A station must be assigned'
  return null
}

// ── getUserStatus ────────────────────────────────────────────────────────────

export function getUserStatus(profile: {
  is_active: boolean
  last_sign_in_at: string | null
}): UserStatus {
  if (!profile.is_active) return 'inactive'
  if (!profile.last_sign_in_at) return 'pending'
  return 'active'
}
