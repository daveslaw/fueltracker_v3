import { describe, it, expect } from 'vitest'
import { selectActivePriceAt } from '../lib/pricing'

const p = (price_per_litre: number, effective_from: string) => ({
  fuel_grade_id: '95',
  price_per_litre,
  effective_from,
})

describe('selectActivePriceAt', () => {
  it('returns the single price when its effective_from is before asOf', () => {
    const prices = [p(17.00, '2026-01-01T00:00:00Z')]
    expect(selectActivePriceAt(prices, '2026-03-23T08:00:00Z')).toBe(17.00)
  })

  it('returns the most recent price when multiple are before asOf', () => {
    const prices = [
      p(16.50, '2026-01-01T00:00:00Z'),
      p(17.00, '2026-02-01T00:00:00Z'),
      p(17.95, '2026-03-01T00:00:00Z'),
    ]
    expect(selectActivePriceAt(prices, '2026-03-23T08:00:00Z')).toBe(17.95)
  })

  it('ignores prices whose effective_from is after asOf', () => {
    const prices = [
      p(17.00, '2026-02-01T00:00:00Z'),
      p(21.95, '2026-04-01T00:00:00Z'), // future — must be ignored
    ]
    expect(selectActivePriceAt(prices, '2026-03-23T08:00:00Z')).toBe(17.00)
  })

  it('includes a price whose effective_from equals asOf exactly', () => {
    const asOf = '2026-03-23T08:00:00Z'
    const prices = [p(17.00, asOf)]
    expect(selectActivePriceAt(prices, asOf)).toBe(17.00)
  })

  it('returns null when no prices are applicable at asOf', () => {
    const prices = [p(17.00, '2026-04-01T00:00:00Z')] // all in the future
    expect(selectActivePriceAt(prices, '2026-03-23T08:00:00Z')).toBeNull()
  })

  it('returns null for an empty price list', () => {
    expect(selectActivePriceAt([], '2026-03-23T08:00:00Z')).toBeNull()
  })
})
