import { describe, it, expect } from 'vitest'
import { hasManualEntry } from '../lib/pos-submission'
import type { PosNozzleLineInput } from '../lib/pos-submission'

const line = (ocr_status?: PosNozzleLineInput['ocr_status']): PosNozzleLineInput => ({
  pump_id: 'pump-1',
  litres_sold: 100,
  revenue_zar: 1700,
  ocr_status,
})

describe('hasManualEntry', () => {
  it('tracer bullet: all auto lines → false', () => {
    expect(hasManualEntry([line('auto'), line('auto')])).toBe(false)
  })

  it('any manual_override line → true', () => {
    expect(hasManualEntry([line('auto'), line('manual_override')])).toBe(true)
  })

  it('any unreadable line → true', () => {
    expect(hasManualEntry([line('auto'), line('unreadable')])).toBe(true)
  })

  it('undefined ocr_status defaults to auto → false', () => {
    expect(hasManualEntry([line(undefined)])).toBe(false)
  })

  it('empty array → false', () => {
    expect(hasManualEntry([])).toBe(false)
  })
})
