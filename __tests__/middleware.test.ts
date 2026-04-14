import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-utils'
import type { UserProfile } from '@/lib/middleware-utils'

describe('resolveRedirect', () => {
  // Tracer bullet: no session → /login
  it('redirects unauthenticated user to /login', () => {
    expect(resolveRedirect(null, '/shift')).toBe('/login')
  })

  it('redirects inactive user to /login regardless of role', () => {
    expect(resolveRedirect({ role: 'attendant', is_active: false }, '/shift')).toBe('/login')
    expect(resolveRedirect({ role: 'owner', is_active: false }, '/dashboard')).toBe('/login')
  })

  describe('path guards — wrong role redirected to own home', () => {
    it('redirects attendant away from /dashboard to /shift', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/dashboard')).toBe('/shift')
    })

    it('redirects supervisor away from /dashboard to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/dashboard')).toBe('/shift')
    })

    it('allows attendant on /shift path', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/shift')).toBeNull()
    })

    it('allows supervisor on /shift path', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/shift')).toBeNull()
    })

    it('allows supervisor on nested /shift path', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/shift/abc/close/pumps')).toBeNull()
    })

    it('allows owner on /dashboard path', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/dashboard')).toBeNull()
    })
  })

  describe('role home redirects from /', () => {
    it('redirects active attendant from / to /shift', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/')).toBe('/shift')
    })

    it('redirects active supervisor from / to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/')).toBe('/shift')
    })

    it('redirects active owner from / to /dashboard', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/')).toBe('/dashboard')
    })
  })
})
