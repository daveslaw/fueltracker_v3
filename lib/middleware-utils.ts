export type UserRole = 'attendant' | 'supervisor' | 'owner'

export type UserProfile = {
  role: UserRole
  is_active: boolean
}

const ROLE_HOME: Record<UserRole, string> = {
  attendant: '/shift',
  supervisor: '/shift',
  owner: '/dashboard',
}

/**
 * Pure function: given an optional user profile and the requested path,
 * returns the path to redirect to, or null if the request should proceed.
 */
export function resolveRedirect(
  profile: UserProfile | null,
  requestedPath: string
): string | null {
  if (!profile || !profile.is_active) return '/login'
  if (requestedPath === '/') return ROLE_HOME[profile.role]

  // Owner can access all workflows
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
