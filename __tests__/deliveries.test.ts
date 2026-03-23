import { describe, it, expect } from 'vitest'
import { getShiftPeriod } from '../lib/deliveries'

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
