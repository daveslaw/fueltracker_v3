export type UserRole = 'supervisor' | 'owner' | 'cashier'

export type UserProfile = {
  role: UserRole
  is_active: boolean
  station_id?: string | null
}

export type ActiveShift = { id: string } | null

const ROLE_HOME: Record<UserRole, string> = {
  supervisor: '/shift',
  owner: '/dashboard',
  cashier: '/cashier',
}

const TABLET_REDIRECT: Partial<Record<UserRole, (shiftId: string) => string>> = {
  cashier: (id) => `/cashier/${id}/fuel-pos`,
  supervisor: (id) => `/shift/${id}/close/summary`,
}

/**
 * Pure function: given an optional user profile, the requested path, and an
 * optional active shift for tablet smart routing, returns the redirect path or
 * null if the request should proceed.
 */
export function resolveRedirect(
  profile: UserProfile | null,
  requestedPath: string,
  activeShift?: ActiveShift
): string | null {
  if (!profile || !profile.is_active) return '/login'
  if (requestedPath === '/') {
    const tabletRedirect = TABLET_REDIRECT[profile.role]
    if (tabletRedirect && activeShift) return tabletRedirect(activeShift.id)
    return ROLE_HOME[profile.role]
  }

  // /setup is owner-only
  if (requestedPath === '/setup' || requestedPath.startsWith('/setup/')) {
    if (profile.role !== 'owner') return ROLE_HOME[profile.role]
    return null
  }

  // Owner can access all other workflows
  if (profile.role === 'owner') return null

  // Enforce each role's protected path prefix
  const home = ROLE_HOME[profile.role]
  const protectedPrefixes = Object.values(ROLE_HOME)
  const isProtected = protectedPrefixes.some((prefix) =>
    requestedPath === prefix || requestedPath.startsWith(prefix + '/')
  )
  if (isProtected && !requestedPath.startsWith(home)) return home

  return null
}
