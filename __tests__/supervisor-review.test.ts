import { describe, it, expect } from 'vitest'
import { canFlag, canOverride, validateOverride, validateFlagComment } from '../lib/supervisor-review'

describe('canFlag', () => {
  it('closed shift can be flagged', () => {
    expect(canFlag('closed')).toBe(true)
  })

  it('pending shift cannot be flagged (not yet closed)', () => {
    expect(canFlag('pending')).toBe(false)
  })

  it('already-flagged closed shift can be unflagged (same guard)', () => {
    // canFlag guards both flag and unflag — only closed shifts
    expect(canFlag('closed')).toBe(true)
  })

  it('old submitted status cannot be flagged', () => {
    expect(canFlag('submitted')).toBe(false)
  })

  it('old approved status cannot be flagged', () => {
    expect(canFlag('approved')).toBe(false)
  })
})

describe('canOverride', () => {
  it('tracer bullet: closed shift can be overridden', () => {
    expect(canOverride('closed')).toBe(true)
  })

  it('pending shift cannot be overridden (not yet closed)', () => {
    expect(canOverride('pending')).toBe(false)
  })

  it('old submitted status cannot be overridden', () => {
    expect(canOverride('submitted')).toBe(false)
  })
})

describe('validateFlagComment', () => {
  it('tracer bullet: non-empty comment → valid', () => {
    expect(validateFlagComment('Pump 3 meter looked unusual')).toEqual({ valid: true })
  })

  it('empty string → invalid', () => {
    const result = validateFlagComment('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only → invalid', () => {
    expect(validateFlagComment('   ').valid).toBe(false)
  })
})

describe('validateOverride', () => {
  it('valid: non-negative value and non-empty reason', () => {
    const result = validateOverride({ value: 52000, reason: 'Misread digit' })
    expect(result).toEqual({ valid: true })
  })

  it('valid: value of zero is allowed', () => {
    const result = validateOverride({ value: 0, reason: 'Pump not used' })
    expect(result).toEqual({ valid: true })
  })

  it('invalid: negative value', () => {
    const result = validateOverride({ value: -1, reason: 'Typo' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('invalid: empty reason', () => {
    const result = validateOverride({ value: 52000, reason: '' })
    expect(result.valid).toBe(false)
  })

  it('invalid: whitespace-only reason', () => {
    const result = validateOverride({ value: 52000, reason: '   ' })
    expect(result.valid).toBe(false)
  })
})
