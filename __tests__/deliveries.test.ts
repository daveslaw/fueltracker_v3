import { describe, it, expect } from 'vitest'
import { getShiftPeriod, validateDeliveryInput } from '../lib/deliveries'

describe('getShiftPeriod', () => {
  it('returns morning for a timestamp before 12:00 UTC', () => {
    expect(getShiftPeriod('2026-03-23T06:00:00Z')).toBe('morning')
  })

  it('returns evening for a timestamp at or after 12:00 UTC', () => {
    expect(getShiftPeriod('2026-03-23T12:00:00Z')).toBe('evening')
  })

  it('returns morning for 00:00 UTC (midnight)', () => {
    expect(getShiftPeriod('2026-03-23T00:00:00Z')).toBe('morning')
  })

  it('returns morning for 11:59 UTC', () => {
    expect(getShiftPeriod('2026-03-23T11:59:59Z')).toBe('morning')
  })

  it('returns evening for 23:59 UTC', () => {
    expect(getShiftPeriod('2026-03-23T23:59:59Z')).toBe('evening')
  })
})

describe('validateDeliveryInput', () => {
  const valid = {
    tankId: 'tank-1',
    litresReceived: 5000,
    deliveryNoteUrl: 'https://storage.example.com/receipt.jpg',
  }

  it('tracer bullet: valid inputs return { valid: true }', () => {
    expect(validateDeliveryInput(valid)).toEqual({ valid: true })
  })

  it('litresReceived of 0 is invalid', () => {
    const result = validateDeliveryInput({ ...valid, litresReceived: 0 })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('negative litresReceived is invalid', () => {
    const result = validateDeliveryInput({ ...valid, litresReceived: -1 })
    expect(result.valid).toBe(false)
  })

  it('empty tankId is invalid', () => {
    const result = validateDeliveryInput({ ...valid, tankId: '' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only tankId is invalid', () => {
    const result = validateDeliveryInput({ ...valid, tankId: '   ' })
    expect(result.valid).toBe(false)
  })

  it('empty deliveryNoteUrl is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteUrl: '' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toBeTruthy()
  })

  it('whitespace-only deliveryNoteUrl is invalid', () => {
    const result = validateDeliveryInput({ ...valid, deliveryNoteUrl: '   ' })
    expect(result.valid).toBe(false)
  })
})
