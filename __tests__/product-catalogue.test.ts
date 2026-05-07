import { describe, it, expect, vi } from 'vitest'
import { createSupabaseProductCatalogueRepository } from '../lib/product-catalogue'
import type { ProductPriceWriter } from '../lib/product-pricing'

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeMockWriter(): ProductPriceWriter & {
  closeCurrentPrice: ReturnType<typeof vi.fn>
  insertPrice: ReturnType<typeof vi.fn>
} {
  return {
    closeCurrentPrice: vi.fn().mockResolvedValue(undefined),
    insertPrice:       vi.fn().mockResolvedValue(undefined),
  }
}

function makeMockDb(singleResult = { data: { id: 'new-prod-uuid' }, error: null }) {
  const chain = {
    select:  vi.fn(),
    insert:  vi.fn(),
    update:  vi.fn(),
    upsert:  vi.fn(),
    eq:      vi.fn(),
    order:   vi.fn(),
    single:  vi.fn().mockResolvedValue(singleResult),
  }
  const fluent = ['select', 'insert', 'update', 'upsert', 'eq', 'order'] as const
  fluent.forEach(k => (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain))
  const db = { from: vi.fn().mockReturnValue(chain) }
  return { db, chain }
}

// ── createProduct ─────────────────────────────────────────────────────────────

describe('createProduct — tracer bullet', () => {
  it('inserts a product row and returns its id', async () => {
    const { db } = makeMockDb({ data: { id: 'new-prod-uuid' }, error: null })
    const repo = createSupabaseProductCatalogueRepository(db as never, makeMockWriter())

    const result = await repo.createProduct('station-1', {
      stock_code: 'CHIP001', description: 'Lays Chips',
      cost_price: 8.50, sell_price: 12.00, initial_stock_count: 24,
    })

    expect('error' in result).toBe(false)
    expect((result as { id: string }).id).toBe('new-prod-uuid')
  })

  it('seeds a price record via the writer using the new product id', async () => {
    const { db } = makeMockDb({ data: { id: 'new-prod-uuid' }, error: null })
    const writer = makeMockWriter()
    const repo = createSupabaseProductCatalogueRepository(db as never, writer)

    await repo.createProduct('station-1', {
      stock_code: 'CHIP001', description: 'Lays Chips',
      cost_price: 8.50, sell_price: 12.00, initial_stock_count: 24,
    })

    expect(writer.insertPrice).toHaveBeenCalledOnce()
    expect(writer.insertPrice).toHaveBeenCalledWith(
      'new-prod-uuid', 'station-1', 8.50, 12.00, expect.any(String),
    )
  })

  it('upserts the opening stock baseline with correct station, product, and quantity', async () => {
    const { db, chain } = makeMockDb({ data: { id: 'new-prod-uuid' }, error: null })
    ;(chain.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    const repo = createSupabaseProductCatalogueRepository(db as never, makeMockWriter())

    await repo.createProduct('station-1', {
      stock_code: 'CHIP001', description: 'Lays Chips',
      cost_price: 8.50, sell_price: 12.00, initial_stock_count: 24,
    })

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ station_id: 'station-1', product_id: 'new-prod-uuid', quantity: 24 }),
      expect.anything(),
    )
  })

  it('returns an error and does not call writer when product insert fails', async () => {
    const { db } = makeMockDb({ data: null, error: { message: 'duplicate stock_code' } })
    const writer = makeMockWriter()
    const repo = createSupabaseProductCatalogueRepository(db as never, writer)

    const result = await repo.createProduct('station-1', {
      stock_code: 'CHIP001', description: 'Lays Chips',
      cost_price: 8.50, sell_price: 12.00, initial_stock_count: 24,
    })

    expect((result as { error: string }).error).toBe('duplicate stock_code')
    expect(writer.insertPrice).not.toHaveBeenCalled()
  })
})

// ── updateProductDetails ──────────────────────────────────────────────────────

describe('updateProductDetails', () => {
  it('updates stock_code and description without touching the price writer', async () => {
    const { db, chain } = makeMockDb()
    ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    const writer = makeMockWriter()
    const repo = createSupabaseProductCatalogueRepository(db as never, writer)

    const result = await repo.updateProductDetails('prod-1', {
      stock_code: 'CHIP002', description: 'Lays Chips BBQ',
    })

    expect(result.error).toBeUndefined()
    expect(chain.update).toHaveBeenCalledWith({ stock_code: 'CHIP002', description: 'Lays Chips BBQ' })
    expect(writer.insertPrice).not.toHaveBeenCalled()
    expect(writer.closeCurrentPrice).not.toHaveBeenCalled()
  })
})

// ── deactivateProduct ─────────────────────────────────────────────────────────

describe('deactivateProduct', () => {
  it('sets is_active to false', async () => {
    const { db, chain } = makeMockDb()
    ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    const repo = createSupabaseProductCatalogueRepository(db as never, makeMockWriter())

    const result = await repo.deactivateProduct('prod-1')

    expect(result.error).toBeUndefined()
    expect(chain.update).toHaveBeenCalledWith({ is_active: false })
  })
})

// ── reactivateProduct ─────────────────────────────────────────────────────────

describe('reactivateProduct', () => {
  it('sets is_active to true', async () => {
    const { db, chain } = makeMockDb()
    ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    const repo = createSupabaseProductCatalogueRepository(db as never, makeMockWriter())

    const result = await repo.reactivateProduct('prod-1')

    expect(result.error).toBeUndefined()
    expect(chain.update).toHaveBeenCalledWith({ is_active: true })
  })
})
