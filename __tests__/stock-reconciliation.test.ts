import { describe, it, expect } from 'vitest'
import { computeStockReconciliation } from '@/lib/stock-reconciliation'

describe('computeStockReconciliation', () => {
  it('tracer bullet: zero variance — actual matches expected', () => {
    const result = computeStockReconciliation([{
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    5,
      posUnitsSold:  3,
      actualClosing: 12,  // 10 + 5 - 3 = 12
      sellPrice:     150,
    }])

    expect(result).toHaveLength(1)
    expect(result[0].product_id).toBe('prod-1')
    expect(result[0].expected_closing_count).toBe(12)
    expect(result[0].variance_units).toBe(0)
    expect(result[0].variance_zar).toBe(0)
  })

  it('negative variance — stock missing (loss)', () => {
    const result = computeStockReconciliation([{
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    0,
      posUnitsSold:  3,
      actualClosing: 6,   // expected 7, actual 6 → -1
      sellPrice:     200,
    }])

    expect(result[0].expected_closing_count).toBe(7)
    expect(result[0].variance_units).toBe(-1)
    expect(result[0].variance_zar).toBe(-200)
  })

  it('positive variance — surplus (more stock than expected)', () => {
    const result = computeStockReconciliation([{
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    5,
      posUnitsSold:  2,
      actualClosing: 14,  // expected 13, actual 14 → +1
      sellPrice:     150,
    }])

    expect(result[0].variance_units).toBe(1)
    expect(result[0].variance_zar).toBe(150)
  })

  it('multiple products computed independently', () => {
    const result = computeStockReconciliation([
      { productId: 'prod-1', openingCount: 10, deliveries: 0, posUnitsSold: 2, actualClosing: 8, sellPrice: 100 },
      { productId: 'prod-2', openingCount: 5,  deliveries: 3, posUnitsSold: 1, actualClosing: 6, sellPrice: 200 },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].product_id).toBe('prod-1')
    expect(result[0].variance_units).toBe(0)   // 10 + 0 - 2 = 8 = actual
    expect(result[1].product_id).toBe('prod-2')
    expect(result[1].variance_units).toBe(-1)  // 5 + 3 - 1 = 7, actual 6 → -1
    expect(result[1].variance_zar).toBe(-200)
  })

  it('re-run with changed posUnitsSold produces updated figures', () => {
    const base = { productId: 'prod-1', openingCount: 10, deliveries: 0, sellPrice: 100 }

    const first  = computeStockReconciliation([{ ...base, posUnitsSold: 3, actualClosing: 7 }])
    expect(first[0].variance_units).toBe(0)    // expected 7, actual 7

    const second = computeStockReconciliation([{ ...base, posUnitsSold: 4, actualClosing: 7 }])
    expect(second[0].variance_units).toBe(1)   // expected 6, actual 7 → +1
  })

  it('passes through all fields to output', () => {
    const result = computeStockReconciliation([{
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    5,
      posUnitsSold:  3,
      actualClosing: 12,
      sellPrice:     150,
    }])

    const line = result[0]
    expect(line.opening_count).toBe(10)
    expect(line.deliveries_received).toBe(5)
    expect(line.pos_units_sold).toBe(3)
    expect(line.actual_closing_count).toBe(12)
  })

  it('variance_zar rounded to 2 decimal places', () => {
    const result = computeStockReconciliation([{
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    0,
      posUnitsSold:  3,
      actualClosing: 6,  // variance = -1
      sellPrice:     19.99,
    }])

    expect(result[0].variance_zar).toBe(-19.99)
  })

  it('returns empty array for empty input', () => {
    expect(computeStockReconciliation([])).toEqual([])
  })
})
