import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-utils'
import type { UserProfile } from '@/lib/middleware-utils'

describe('resolveRedirect', () => {
  // Tracer bullet: no session → /login
  it('redirects unauthenticated user to /login', () => {
    expect(resolveRedirect(null, '/shift')).toBe('/login')
  })

  it('redirects inactive user to /login regardless of role', () => {
    expect(resolveRedirect({ role: 'supervisor', is_active: false }, '/shift')).toBe('/login')
    expect(resolveRedirect({ role: 'owner', is_active: false }, '/dashboard')).toBe('/login')
  })

  describe('path guards — wrong role redirected to own home', () => {
    it('redirects supervisor away from /dashboard to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/dashboard')).toBe('/shift')
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

  describe('tablet smart routing from /', () => {
    it('tracer bullet: cashier with active shift is redirected to fuel-pos for that shift', () => {
      expect(
        resolveRedirect({ role: 'cashier', is_active: true }, '/', { id: 'shift-abc' })
      ).toBe('/cashier/shift-abc/fuel-pos')
    })

    it('cashier with no active shift falls back to /cashier', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/', null)).toBe('/cashier')
    })

    it('supervisor with active shift is redirected to close/summary for that shift', () => {
      expect(
        resolveRedirect({ role: 'supervisor', is_active: true }, '/', { id: 'shift-xyz' })
      ).toBe('/shift/shift-xyz/close/summary')
    })

    it('supervisor with no active shift falls back to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/', null)).toBe('/shift')
    })

    it('owner with active shift still goes to /dashboard — owners are unaffected', () => {
      expect(
        resolveRedirect({ role: 'owner', is_active: true }, '/', { id: 'shift-xyz' })
      ).toBe('/dashboard')
    })

    it('active shift is ignored for non-root paths', () => {
      expect(
        resolveRedirect({ role: 'cashier', is_active: true }, '/cashier', { id: 'shift-abc' })
      ).toBeNull()
    })
  })

  describe('role home redirects from /', () => {
    it('redirects active supervisor from / to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/')).toBe('/shift')
    })

    it('redirects active owner from / to /dashboard', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/')).toBe('/dashboard')
    })

    it('tracer bullet: redirects active cashier from / to /cashier', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/')).toBe('/cashier')
    })
  })

  describe('cashier path guards', () => {
    it('allows cashier on /cashier path', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/cashier')).toBeNull()
    })

    it('allows cashier on nested /cashier path', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/cashier/stock')).toBeNull()
    })

    it('redirects cashier away from /shift to /cashier', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/shift')).toBe('/cashier')
    })

    it('redirects cashier away from /dashboard to /cashier', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/dashboard')).toBe('/cashier')
    })

    it('redirects inactive cashier to /login', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: false }, '/cashier')).toBe('/login')
    })
  })

  describe('/setup — owner-only', () => {
    it('allows owner on /setup', () => {
      expect(resolveRedirect({ role: 'owner', is_active: true }, '/setup')).toBeNull()
    })

    it('redirects supervisor away from /setup to /shift', () => {
      expect(resolveRedirect({ role: 'supervisor', is_active: true }, '/setup')).toBe('/shift')
    })

    it('redirects cashier away from /setup to /cashier', () => {
      expect(resolveRedirect({ role: 'cashier', is_active: true }, '/setup')).toBe('/cashier')
    })

    it('unauthenticated user visiting /setup redirects to /login', () => {
      expect(resolveRedirect(null, '/setup')).toBe('/login')
    })
  })
})
