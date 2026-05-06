import { describe, it, expect } from 'vitest'
import { selectActivePriceAt, hasPriceRangeOverlap } from '../lib/pricing'
import type { PriceRow } from '../lib/pricing'

const makeRow = (overrides: Partial<PriceRow> = {}): PriceRow => ({
  station_id:           'station-1',
  fuel_grade_id:        '95',
  sell_price_per_litre: 21.95,
  cost_per_litre:       18.00,
  valid_from:           '2026-01-01T00:00:00Z',
  valid_to:             '2026-06-01T00:00:00Z',
  ...overrides,
})

// ── selectActivePriceAt ────────────────────────────────────────────────────────

describe('selectActivePriceAt', () => {
  it('returns sell and cost prices for a timestamp within the valid range', () => {
    const prices = [makeRow()]
    expect(selectActivePriceAt(prices, '2026-03-01T08:00:00Z')).toEqual({
      sell_price_per_litre: 21.95,
      cost_per_litre: 18.00,
    })
  })

  it('valid_from boundary is inclusive', () => {
    const validFrom = '2026-03-01T00:00:00Z'
    const prices = [makeRow({ valid_from: validFrom })]
    expect(selectActivePriceAt(prices, validFrom)).toEqual({
      sell_price_per_litre: 21.95,
      cost_per_litre: 18.00,
    })
  })

  it('valid_to boundary is exclusive — timestamp equal to valid_to returns null', () => {
    const validTo = '2026-06-01T00:00:00Z'
    const prices = [makeRow({ valid_to: validTo })]
    expect(selectActivePriceAt(prices, validTo)).toBeNull()
  })

  it('open-ended row (valid_to = null) matches any timestamp after valid_from', () => {
    const prices = [makeRow({ valid_to: null })]
    expect(selectActivePriceAt(prices, '2099-01-01T00:00:00Z')).toEqual({
      sell_price_per_litre: 21.95,
      cost_per_litre: 18.00,
    })
  })

  it('returns null for a timestamp before valid_from', () => {
    const prices = [makeRow({ valid_from: '2026-04-01T00:00:00Z', valid_to: null })]
    expect(selectActivePriceAt(prices, '2026-03-01T08:00:00Z')).toBeNull()
  })

  it('returns null for a timestamp after valid_to', () => {
    const prices = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-03-01T00:00:00Z' })]
    expect(selectActivePriceAt(prices, '2026-04-01T00:00:00Z')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(selectActivePriceAt([], '2026-03-01T08:00:00Z')).toBeNull()
  })
})

// ── hasPriceRangeOverlap ───────────────────────────────────────────────────────

describe('hasPriceRangeOverlap', () => {
  it('returns false when new range starts after existing range ends', () => {
    const existing = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-03-01T00:00:00Z' })]
    const newRow   = makeRow({ valid_from: '2026-03-01T00:00:00Z', valid_to: null })
    expect(hasPriceRangeOverlap(existing, newRow)).toBe(false)
  })

  it('returns false for adjacent ranges (new valid_from == existing valid_to)', () => {
    const existing = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-04-01T00:00:00Z' })]
    const newRow   = makeRow({ valid_from: '2026-04-01T00:00:00Z', valid_to: null })
    expect(hasPriceRangeOverlap(existing, newRow)).toBe(false)
  })

  it('returns true when ranges overlap', () => {
    const existing = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-06-01T00:00:00Z' })]
    const newRow   = makeRow({ valid_from: '2026-03-01T00:00:00Z', valid_to: null })
    expect(hasPriceRangeOverlap(existing, newRow)).toBe(true)
  })

  it('returns false when open-ended existing row ends before new row starts (caller closes it first)', () => {
    const existing = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-04-01T00:00:00Z' })]
    const newRow   = makeRow({ valid_from: '2026-04-01T00:00:00Z', valid_to: null })
    expect(hasPriceRangeOverlap(existing, newRow)).toBe(false)
  })

  it('returns true when an open-ended existing row overlaps the new row', () => {
    const existing = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: null })]
    const newRow   = makeRow({ valid_from: '2026-03-01T00:00:00Z', valid_to: null })
    expect(hasPriceRangeOverlap(existing, newRow)).toBe(true)
  })
})
