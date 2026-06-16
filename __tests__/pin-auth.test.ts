import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin, shouldLockout } from '@/lib/pin-auth'

describe('verifyPin', () => {
  it('tracer bullet: returns true when PIN matches its own hash', async () => {
    const hash = await hashPin('1234')
    expect(await verifyPin('1234', hash)).toBe(true)
  })

  it('returns false for a wrong PIN', async () => {
    const hash = await hashPin('1234')
    expect(await verifyPin('5678', hash)).toBe(false)
  })
})

describe('hashPin', () => {
  it('hash does not contain the original PIN as a substring', async () => {
    const hash = await hashPin('1234')
    expect(hash).not.toContain('1234')
  })
})

describe('shouldLockout', () => {
  it('returns false for 0 attempts', () => {
    expect(shouldLockout(0)).toBe(false)
  })

  it('returns false for 9 attempts', () => {
    expect(shouldLockout(9)).toBe(false)
  })

  it('returns true for 10 attempts', () => {
    expect(shouldLockout(10)).toBe(true)
  })

  it('returns true for attempts above the threshold', () => {
    expect(shouldLockout(11)).toBe(true)
  })
})
