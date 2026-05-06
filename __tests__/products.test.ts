import { describe, it, expect } from 'vitest'
import { getActiveProducts } from '@/lib/products'
import type { Product } from '@/lib/products'

const base: Product = {
  id: 'p1',
  station_id: 'station-1',
  stock_code: 'COKE-500',
  description: 'Coke 500ml',
  cost_price: 8.5,
  sell_price: 14.0,
  is_active: true,
}

describe('getActiveProducts', () => {
  it('tracer bullet: all active → all returned', () => {
    const products = [base, { ...base, id: 'p2', stock_code: 'WATER-500' }]
    expect(getActiveProducts(products)).toHaveLength(2)
  })

  it('deactivated product is excluded', () => {
    const inactive: Product = { ...base, id: 'p2', is_active: false }
    const result = getActiveProducts([base, inactive])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('all inactive → empty list', () => {
    const inactive = [{ ...base, is_active: false }]
    expect(getActiveProducts(inactive)).toHaveLength(0)
  })

  it('empty input → empty output', () => {
    expect(getActiveProducts([])).toHaveLength(0)
  })
})
