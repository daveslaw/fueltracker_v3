export const INVITABLE_ROLES = ['supervisor', 'cashier'] as const
export type InvitableRole = typeof INVITABLE_ROLES[number]
export type UserStatus = 'active' | 'inactive'

// ── validateInvite ───────────────────────────────────────────────────────────

export function validateInvite(input: {
  email: string
  role: string
  station_id: string
  full_name: string
}): string | null {
  if (!input.full_name || !input.full_name.trim()) return 'A full name is required'
  if (!input.email.trim()) return 'A valid email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return 'A valid email is required'
  if (!(INVITABLE_ROLES as readonly string[]).includes(input.role))
    return `Invalid role — must be one of: ${INVITABLE_ROLES.join(', ')}`
  if (!input.station_id) return 'A station must be assigned'
  return null
}

// ── buildInviteCallbackUrl ───────────────────────────────────────────────────

export function buildInviteCallbackUrl(siteUrl?: string): string {
  const base = (siteUrl ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/auth/callback`
}

// ── resolveCallbackRedirect ──────────────────────────────────────────────────

export function resolveCallbackRedirect(code: string | null, exchangeFailed: boolean): string {
  if (!code || exchangeFailed) return '/login?error=invite-expired'
  return '/set-password'
}

// ── validatePasswordInput ────────────────────────────────────────────────────

export function validatePasswordInput(password: string, confirm: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

// ── validateFullName ─────────────────────────────────────────────────────────

export function validateFullName(name: string): string | null {
  if (!name || !name.trim()) return 'A full name is required'
  return null
}

// ── validatePin ──────────────────────────────────────────────────────────────

export function validatePin(pin: string): string | null {
  if (!pin || pin.length !== 4) return 'PIN must be exactly 4 digits'
  if (!/^\d{4}$/.test(pin)) return 'PIN must contain only digits'
  return null
}

// ── getUserStatus ────────────────────────────────────────────────────────────

export function getUserStatus(profile: { is_active: boolean }): UserStatus {
  return profile.is_active ? 'active' : 'inactive'
}

// ── generateUsername ─────────────────────────────────────────────────────────

export function generateUsername(fullName: string, existingUsernames: string[]): string {
  const parts = fullName.trim().split(/\s+/).map((p) => p.replace(/[^a-z]/gi, '').toLowerCase()).filter(Boolean)
  const base = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] ?? ''

  if (!existingUsernames.includes(base)) return base

  let suffix = 2
  while (existingUsernames.includes(`${base}${suffix}`)) suffix++
  return `${base}${suffix}`
}

// ── buildSyntheticEmail ──────────────────────────────────────────────────────

export function buildSyntheticEmail(username: string): string {
  return `${username}@fueltracker.internal`
}

// ── validateCreateStationUser ────────────────────────────────────────────────

export function validateCreateStationUser(input: {
  full_name: string
  role: string
  station_id: string
  pin: string
  pin_confirm: string
  username: string
}): string | null {
  if (!input.full_name || !input.full_name.trim()) return 'A full name is required'
  if (!(INVITABLE_ROLES as readonly string[]).includes(input.role))
    return `Invalid role — must be one of: ${INVITABLE_ROLES.join(', ')}`
  if (!input.station_id) return 'A station must be assigned'
  const pinError = validatePin(input.pin)
  if (pinError) return pinError
  if (input.pin !== input.pin_confirm) return 'PINs do not match'
  if (!input.username || !input.username.trim()) return 'A username is required'
  return null
}
