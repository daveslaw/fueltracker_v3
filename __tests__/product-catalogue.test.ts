import { describe, it, expect } from 'vitest'
import type { ProductCatalogueRepository, ProductInput } from '@/lib/product-catalogue'

// ── In-memory fake ────────────────────────────────────────────────────────────

type StoredProduct = {
  id: string
  station_id: string
  stock_code: string
  description: string
  cost_price: number
  sell_price: number
  is_active: boolean
}

function makeInMemoryRepo(): ProductCatalogueRepository & { _products: StoredProduct[] } {
  const products: StoredProduct[] = []
  let nextId = 1

  return {
    _products: products,

    async getProducts(stationId) {
      return products.filter(p => p.station_id === stationId && p.is_active)
    },

    async upsertProduct(stationId, input) {
      const existing = products.find(p => p.id === input.id)
      if (existing) {
        Object.assign(existing, { ...input, station_id: stationId })
        return {}
      }
      products.push({
        id: input.id ?? String(nextId++),
        station_id: stationId,
        stock_code: input.stock_code,
        description: input.description,
        cost_price: input.cost_price,
        sell_price: input.sell_price,
        is_active: true,
      })
      return {}
    },

    async deactivateProduct(productId) {
      const product = products.find(p => p.id === productId)
      if (product) product.is_active = false
      return {}
    },
  }
}

// ── getProducts ───────────────────────────────────────────────────────────────

describe('getProducts', () => {
  it('tracer bullet: returns active products for the station', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })
    await repo.upsertProduct('station-1', { stock_code: 'WATER-500', description: 'Water 500ml', cost_price: 5.0, sell_price: 9.0 })

    const products = await repo.getProducts('station-1')
    expect(products).toHaveLength(2)
  })

  it('excludes deactivated products', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })
    const products = await repo.getProducts('station-1')
    await repo.deactivateProduct(products[0].id)

    const active = await repo.getProducts('station-1')
    expect(active).toHaveLength(0)
  })

  it('excludes products from other stations', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })
    await repo.upsertProduct('station-2', { stock_code: 'CHIPS-100', description: 'Chips 100g', cost_price: 6.0, sell_price: 11.0 })

    const products = await repo.getProducts('station-1')
    expect(products).toHaveLength(1)
    expect(products[0].stock_code).toBe('COKE-500')
  })

  it('returns empty list when no products exist for station', async () => {
    const repo = makeInMemoryRepo()
    const products = await repo.getProducts('station-1')
    expect(products).toHaveLength(0)
  })
})

// ── upsertProduct ─────────────────────────────────────────────────────────────

describe('upsertProduct', () => {
  it('creates a new product', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })

    const products = await repo.getProducts('station-1')
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({ stock_code: 'COKE-500', sell_price: 14.0 })
  })

  it('updates an existing product when id is provided', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })

    const [product] = await repo.getProducts('station-1')
    await repo.upsertProduct('station-1', { id: product.id, stock_code: 'COKE-500', description: 'Coke 500ml UPDATED', cost_price: 9.0, sell_price: 15.0 })

    const updated = await repo.getProducts('station-1')
    expect(updated).toHaveLength(1)
    expect(updated[0].description).toBe('Coke 500ml UPDATED')
    expect(updated[0].sell_price).toBe(15.0)
  })

  it('returns no error on success', async () => {
    const repo = makeInMemoryRepo()
    const result = await repo.upsertProduct('station-1', { stock_code: 'X', description: 'Y', cost_price: 1, sell_price: 2 })
    expect(result.error).toBeUndefined()
  })
})

// ── deactivateProduct ─────────────────────────────────────────────────────────

describe('deactivateProduct', () => {
  it('removes product from active list', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke 500ml', cost_price: 8.5, sell_price: 14.0 })
    const [product] = await repo.getProducts('station-1')

    await repo.deactivateProduct(product.id)
    const active = await repo.getProducts('station-1')
    expect(active).toHaveLength(0)
  })

  it('does not affect other products', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertProduct('station-1', { stock_code: 'COKE-500', description: 'Coke', cost_price: 8.5, sell_price: 14.0 })
    await repo.upsertProduct('station-1', { stock_code: 'WATER-500', description: 'Water', cost_price: 5.0, sell_price: 9.0 })

    const products = await repo.getProducts('station-1')
    await repo.deactivateProduct(products[0].id)

    const active = await repo.getProducts('station-1')
    expect(active).toHaveLength(1)
  })

  it('returns no error on success', async () => {
    const repo = makeInMemoryRepo()
    const result = await repo.deactivateProduct('nonexistent-id')
    expect(result.error).toBeUndefined()
  })
})
