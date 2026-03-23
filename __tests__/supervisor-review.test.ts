import { describe, it, expect } from 'vitest'
import { canReview, validateOverride } from '../lib/supervisor-review'

describe('canReview', () => {
  // ── valid approve transitions ──────────────────────────────────────────────
  it('submitted → approve is allowed', () => {
    expect(canReview('submitted', 'approve')).toBe(true)
  })

  it('flagged → approve is allowed', () => {
    expect(canReview('flagged', 'approve')).toBe(true)
  })

  // ── valid flag transitions ─────────────────────────────────────────────────
  it('submitted → flag is allowed', () => {
    expect(canReview('submitted', 'flag')).toBe(true)
  })

  it('approved → flag is allowed (post-approval issue)', () => {
    expect(canReview('approved', 'flag')).toBe(true)
  })

  // ── invalid transitions ────────────────────────────────────────────────────
  it('draft → approve is not allowed', () => {
    expect(canReview('draft', 'approve')).toBe(false)
  })

  it('open → approve is not allowed', () => {
    expect(canReview('open', 'approve')).toBe(false)
  })

  it('pending_pos → flag is not allowed', () => {
    expect(canReview('pending_pos', 'flag')).toBe(false)
  })

  it('approved → approve is not allowed (already approved)', () => {
    expect(canReview('approved', 'approve')).toBe(false)
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
