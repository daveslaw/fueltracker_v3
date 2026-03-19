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

    it('redirects attendant away from /review to /shift', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/review')).toBe('/shift')
    })

    it('redirects supervisor away from /dashboard to /review', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/dashboard')).toBe('/review')
    })

    it('allows attendant on /shift path', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/shift')).toBeNull()
    })

    it('allows supervisor on /review path', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/review')).toBeNull()
    })

    it('allows owner on /dashboard path', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/dashboard')).toBeNull()
    })
  })

  describe('role home redirects from /', () => {
    it('redirects active attendant from / to /shift', () => {
      expect(resolveRedirect({ role: 'attendant', is_active: true }, '/')).toBe('/shift')
    })

    it('redirects active supervisor from / to /review', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/')).toBe('/review')
    })

    it('redirects active owner from / to /dashboard', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/')).toBe('/dashboard')
    })
  })
})
