import { describe, it, expect } from 'vitest'
import { buildFeedbackContext, validateFeedback } from '../lib/feedback'

const baseInputs = {
  stationName: 'Speedway',
  userName: 'John Doe',
  role: 'supervisor',
  shiftId: 'shift-123',
  route: '/shift/shift-123/close/pumps',
  deviceInfo: { userAgent: 'Mozilla/5.0', screenWidth: 390, screenHeight: 844 },
  recentErrors: [{ message: 'TypeError: x is undefined', timestamp: 1000 }],
  routeBreadcrumbs: ['/shift/new', '/shift/shift-123/close/pumps'],
}

describe('buildFeedbackContext', () => {
  it('tracer bullet: returns correct shape with all fields', () => {
    const ctx = buildFeedbackContext(baseInputs)
    expect(ctx.stationName).toBe('Speedway')
    expect(ctx.userName).toBe('John Doe')
    expect(ctx.role).toBe('supervisor')
    expect(ctx.shiftId).toBe('shift-123')
    expect(ctx.route).toBe('/shift/shift-123/close/pumps')
    expect(ctx.deviceInfo.userAgent).toBe('Mozilla/5.0')
    expect(ctx.deviceInfo.screenWidth).toBe(390)
    expect(ctx.deviceInfo.screenHeight).toBe(844)
    expect(ctx.recentErrors).toHaveLength(1)
    expect(ctx.recentErrors[0].message).toBe('TypeError: x is undefined')
    expect(ctx.routeBreadcrumbs).toEqual(['/shift/new', '/shift/shift-123/close/pumps'])
  })

  it('shiftId absent → null in output', () => {
    const { shiftId: _, ...withoutShift } = baseInputs
    const ctx = buildFeedbackContext(withoutShift)
    expect(ctx.shiftId).toBeNull()
  })

  it('stationName null passes through as null', () => {
    const ctx = buildFeedbackContext({ ...baseInputs, stationName: null })
    expect(ctx.stationName).toBeNull()
  })
})

describe('validateFeedback', () => {
  it('tracer bullet: accepts "Something is not working"', () => {
    const result = validateFeedback('Something is not working', null)
    expect(result.valid).toBe(true)
  })

  it('accepts "The numbers look wrong"', () => {
    expect(validateFeedback('The numbers look wrong', null).valid).toBe(true)
  })

  it('accepts "I don\'t understand this"', () => {
    expect(validateFeedback("I don't understand this", null).valid).toBe(true)
  })

  it('accepts "Other"', () => {
    expect(validateFeedback('Other', null).valid).toBe(true)
  })

  it('rejects an unknown category', () => {
    const result = validateFeedback('Something else entirely', null)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBeTruthy()
  })

  it('rejects a note longer than 500 characters', () => {
    const longNote = 'a'.repeat(501)
    const result = validateFeedback('Other', longNote)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBeTruthy()
  })

  it('accepts a note of exactly 500 characters', () => {
    const note = 'a'.repeat(500)
    expect(validateFeedback('Other', note).valid).toBe(true)
  })

  it('accepts a null note', () => {
    expect(validateFeedback('Other', null).valid).toBe(true)
  })

  it('accepts an empty string note', () => {
    expect(validateFeedback('Other', '').valid).toBe(true)
  })
})
