import { describe, it, expect } from 'vitest'
import { isActiveOwner } from '@/lib/auth-assert'

describe('isActiveOwner', () => {
  it('tracer bullet: null profile returns false', () => {
    expect(isActiveOwner(null)).toBe(false)
  })

  it('inactive owner returns false', () => {
    expect(isActiveOwner({ role: 'owner', is_active: false })).toBe(false)
  })

  it('active supervisor returns false', () => {
    expect(isActiveOwner({ role: 'supervisor', is_active: true })).toBe(false)
  })

  it('active cashier returns false', () => {
    expect(isActiveOwner({ role: 'cashier', is_active: true })).toBe(false)
  })

  it('active owner returns true', () => {
    expect(isActiveOwner({ role: 'owner', is_active: true })).toBe(true)
  })
})
