import { describe, it, expect, vi } from 'vitest'
import { selectActiveProductPriceAt, setProductPrice } from '../lib/product-pricing'
import type { ProductPriceRow, ProductPriceWriter } from '../lib/product-pricing'

const makeRow = (overrides: Partial<ProductPriceRow> = {}): ProductPriceRow => ({
  product_id: 'prod-1',
  station_id: 'station-1',
  cost_price:  8.50,
  sell_price:  12.00,
  valid_from:  '2026-01-01T00:00:00Z',
  valid_to:    null,
  ...overrides,
})

// ── selectActiveProductPriceAt ────────────────────────────────────────────────

describe('selectActiveProductPriceAt — tracer bullet', () => {
  it('returns cost and sell price for a timestamp within an open-ended record', () => {
    const rows = [makeRow()]
    expect(selectActiveProductPriceAt(rows, '2026-03-01T08:00:00Z')).toEqual({
      cost_price: 8.50,
      sell_price: 12.00,
    })
  })
})

describe('selectActiveProductPriceAt — boundary conditions', () => {
  it('valid_from boundary is inclusive', () => {
    const validFrom = '2026-03-01T00:00:00Z'
    const rows = [makeRow({ valid_from: validFrom })]
    expect(selectActiveProductPriceAt(rows, validFrom)).toEqual({
      cost_price: 8.50,
      sell_price: 12.00,
    })
  })

  it('valid_to boundary is exclusive — timestamp equal to valid_to returns null', () => {
    const validTo = '2026-06-01T00:00:00Z'
    const rows = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: validTo })]
    expect(selectActiveProductPriceAt(rows, validTo)).toBeNull()
  })

  it('returns null for a timestamp before valid_from', () => {
    const rows = [makeRow({ valid_from: '2026-04-01T00:00:00Z', valid_to: null })]
    expect(selectActiveProductPriceAt(rows, '2026-03-01T00:00:00Z')).toBeNull()
  })

  it('returns null for a timestamp after valid_to', () => {
    const rows = [makeRow({ valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-03-01T00:00:00Z' })]
    expect(selectActiveProductPriceAt(rows, '2026-04-01T00:00:00Z')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(selectActiveProductPriceAt([], '2026-03-01T00:00:00Z')).toBeNull()
  })
})

describe('selectActiveProductPriceAt — versioned history', () => {
  it('returns the record whose range covers the given timestamp when two records exist', () => {
    const rows = [
      makeRow({ cost_price: 8.50, sell_price: 12.00, valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-04-01T00:00:00Z' }),
      makeRow({ cost_price: 9.00, sell_price: 13.00, valid_from: '2026-04-01T00:00:00Z', valid_to: null }),
    ]
    expect(selectActiveProductPriceAt(rows, '2026-02-15T00:00:00Z')).toEqual({ cost_price: 8.50, sell_price: 12.00 })
    expect(selectActiveProductPriceAt(rows, '2026-05-01T00:00:00Z')).toEqual({ cost_price: 9.00, sell_price: 13.00 })
  })
})

// ── setProductPrice ───────────────────────────────────────────────────────────

function makeMockWriter(): ProductPriceWriter & {
  closeCurrentPrice: ReturnType<typeof vi.fn>
  insertPrice: ReturnType<typeof vi.fn>
} {
  return {
    closeCurrentPrice: vi.fn().mockResolvedValue(undefined),
    insertPrice:       vi.fn().mockResolvedValue(undefined),
  }
}

describe('setProductPrice — no prior record', () => {
  it('does not call closeCurrentPrice, inserts a new price record', async () => {
    const writer = makeMockWriter()
    const now = '2026-05-07T10:00:00Z'

    await setProductPrice(writer, 'prod-1', 'station-1', 8.50, 12.00, now)

    expect(writer.insertPrice).toHaveBeenCalledOnce()
    expect(writer.insertPrice).toHaveBeenCalledWith('prod-1', 'station-1', 8.50, 12.00, now)
    expect(writer.closeCurrentPrice).not.toHaveBeenCalled()
  })
})

describe('setProductPrice — existing open record', () => {
  it('closes the current record then inserts a new one', async () => {
    const writer = makeMockWriter()
    const now = '2026-05-07T10:00:00Z'

    await setProductPrice(writer, 'prod-1', 'station-1', 9.00, 13.00, now, true)

    expect(writer.closeCurrentPrice).toHaveBeenCalledOnce()
    expect(writer.closeCurrentPrice).toHaveBeenCalledWith('prod-1', 'station-1', now)
    expect(writer.insertPrice).toHaveBeenCalledOnce()
    expect(writer.insertPrice).toHaveBeenCalledWith('prod-1', 'station-1', 9.00, 13.00, now)
  })

  it('closes before inserting — close is called before insert', async () => {
    const callOrder: string[] = []
    const writer: ProductPriceWriter = {
      closeCurrentPrice: vi.fn().mockImplementation(async () => { callOrder.push('close') }),
      insertPrice:       vi.fn().mockImplementation(async () => { callOrder.push('insert') }),
    }

    await setProductPrice(writer, 'prod-1', 'station-1', 9.00, 13.00, '2026-05-07T10:00:00Z', true)

    expect(callOrder).toEqual(['close', 'insert'])
  })
})
