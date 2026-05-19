export const INVITABLE_ROLES = ['supervisor', 'cashier'] as const
export type InvitableRole = typeof INVITABLE_ROLES[number]
export type UserStatus = 'active' | 'inactive'

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

// ── getUserStatus ────────────────────────────────────────────────────────────

export function getUserStatus(profile: { is_active: boolean }): UserStatus {
  return profile.is_active ? 'active' : 'inactive'
}
