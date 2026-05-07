import { describe, it, expect, vi } from 'vitest'
import {
  assembleStockInputs,
  runStockReconciliationWith,
} from '../lib/dry-stock-runner'
import type {
  StockDataBundle,
  StockDataRepository,
  StockWriter,
} from '../lib/dry-stock-runner'
import type { ProductPriceRow } from '../lib/product-pricing'

// ── Fixture builder ────────────────────────────────────────────────────────────

const DEFAULT_PRICE_ROW: ProductPriceRow = {
  product_id: 'prod-1',
  station_id: 'station-1',
  cost_price:  8.50,
  sell_price:  100,
  valid_from:  '2026-01-01T00:00:00Z',
  valid_to:    null,
}

function makeBundle(overrides: Partial<StockDataBundle> = {}): StockDataBundle {
  return {
    shift:            { id: 'shift-1', station_id: 'station-1', started_at: '2026-03-20T06:00:00Z' },
    products:         [{ id: 'prod-1' }],
    priceRows:        [DEFAULT_PRICE_ROW],
    openingCounts:    [{ product_id: 'prod-1', count: 10 }],
    closingCounts:    [{ product_id: 'prod-1', closing_count: 8 }],
    deliveries:       [],
    posDryStockLines: [{ product_id: 'prod-1', units_sold: 2 }],
    ...overrides,
  }
}

// ── assembleStockInputs ───────────────────────────────────────────────────────

describe('assembleStockInputs — tracer bullet', () => {
  it('maps bundle to StockReconciliationInput with correct fields', () => {
    // opening=10, deliveries=0, pos_sold=2 → expected=8, actual=8, variance=0
    const inputs = assembleStockInputs(makeBundle())

    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({
      productId:     'prod-1',
      openingCount:  10,
      deliveries:    0,
      posUnitsSold:  2,
      actualClosing: 8,
      sellPrice:     100,
    })
  })
})

describe('assembleStockInputs — versioned price lookup', () => {
  it('resolves sellPrice from priceRows at shift.started_at', () => {
    const inputs = assembleStockInputs(makeBundle({
      priceRows: [{ ...DEFAULT_PRICE_ROW, sell_price: 55 }],
    }))
    expect(inputs[0].sellPrice).toBe(55)
  })

  it('uses the price active at shift.started_at, not a newer price', () => {
    const bundle = makeBundle({
      shift: { id: 'shift-1', station_id: 'station-1', started_at: '2026-02-01T06:00:00Z' },
      priceRows: [
        { ...DEFAULT_PRICE_ROW, sell_price: 80, valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-03-01T00:00:00Z' },
        { ...DEFAULT_PRICE_ROW, sell_price: 120, valid_from: '2026-03-01T00:00:00Z', valid_to: null },
      ],
    })
    const inputs = assembleStockInputs(bundle)
    expect(inputs[0].sellPrice).toBe(80)
  })

  it('defaults sellPrice to 0 when no price record exists for the product', () => {
    const bundle = makeBundle({ priceRows: [] })
    const inputs = assembleStockInputs(bundle)
    expect(inputs[0].sellPrice).toBe(0)
  })

  it('does not throw when price record is missing — produces variance_zar of 0', () => {
    const bundle = makeBundle({
      priceRows:        [],
      openingCounts:    [{ product_id: 'prod-1', count: 10 }],
      closingCounts:    [{ product_id: 'prod-1', closing_count: 8 }],
      posDryStockLines: [{ product_id: 'prod-1', units_sold: 2 }],
    })
    expect(() => assembleStockInputs(bundle)).not.toThrow()
    const inputs = assembleStockInputs(bundle)
    expect(inputs[0].sellPrice).toBe(0)
  })
})

describe('assembleStockInputs — opening count resolution', () => {
  it('uses opening count from openingCounts for each product', () => {
    const inputs = assembleStockInputs(makeBundle({
      openingCounts: [{ product_id: 'prod-1', count: 25 }],
    }))
    expect(inputs[0].openingCount).toBe(25)
  })

  it('defaults opening count to 0 when product has no entry in openingCounts', () => {
    const inputs = assembleStockInputs(makeBundle({ openingCounts: [] }))
    expect(inputs[0].openingCount).toBe(0)
  })
})

describe('assembleStockInputs — deliveries', () => {
  it('sums deliveries for the matching product', () => {
    const inputs = assembleStockInputs(makeBundle({
      deliveries: [
        { product_id: 'prod-1', quantity: 6 },
        { product_id: 'prod-1', quantity: 4 },
      ],
    }))
    expect(inputs[0].deliveries).toBe(10)
  })

  it('defaults deliveries to 0 for a product with no delivery rows', () => {
    const bundle = makeBundle({
      products:         [{ id: 'prod-1' }, { id: 'prod-2' }],
      priceRows:        [
        DEFAULT_PRICE_ROW,
        { ...DEFAULT_PRICE_ROW, product_id: 'prod-2' },
      ],
      openingCounts:    [{ product_id: 'prod-1', count: 5 }, { product_id: 'prod-2', count: 3 }],
      closingCounts:    [{ product_id: 'prod-1', closing_count: 5 }, { product_id: 'prod-2', closing_count: 3 }],
      deliveries:       [{ product_id: 'prod-1', quantity: 2 }],
      posDryStockLines: [],
    })
    const inputs = assembleStockInputs(bundle)
    expect(inputs.find(i => i.productId === 'prod-2')!.deliveries).toBe(0)
  })

  it('does not include deliveries for a different product', () => {
    const inputs = assembleStockInputs(makeBundle({
      deliveries: [{ product_id: 'prod-OTHER', quantity: 99 }],
    }))
    expect(inputs[0].deliveries).toBe(0)
  })
})

describe('assembleStockInputs — POS units sold', () => {
  it('uses pos units sold from posDryStockLines', () => {
    const inputs = assembleStockInputs(makeBundle({
      posDryStockLines: [{ product_id: 'prod-1', units_sold: 7 }],
    }))
    expect(inputs[0].posUnitsSold).toBe(7)
  })

  it('defaults posUnitsSold to 0 when no POS line for product', () => {
    const inputs = assembleStockInputs(makeBundle({ posDryStockLines: [] }))
    expect(inputs[0].posUnitsSold).toBe(0)
  })
})

describe('assembleStockInputs — actual closing count', () => {
  it('defaults actualClosing to 0 when no stock reading for product', () => {
    const inputs = assembleStockInputs(makeBundle({ closingCounts: [] }))
    expect(inputs[0].actualClosing).toBe(0)
  })
})

describe('assembleStockInputs — multiple products', () => {
  it('returns one input per product', () => {
    const bundle = makeBundle({
      products:         [{ id: 'prod-1' }, { id: 'prod-2' }],
      priceRows:        [
        DEFAULT_PRICE_ROW,
        { ...DEFAULT_PRICE_ROW, product_id: 'prod-2', sell_price: 200 },
      ],
      openingCounts:    [{ product_id: 'prod-1', count: 10 }, { product_id: 'prod-2', count: 5 }],
      closingCounts:    [{ product_id: 'prod-1', closing_count: 8 }, { product_id: 'prod-2', closing_count: 5 }],
      posDryStockLines: [{ product_id: 'prod-1', units_sold: 2 }],
    })
    const inputs = assembleStockInputs(bundle)
    expect(inputs).toHaveLength(2)
    expect(inputs.map(i => i.productId)).toContain('prod-1')
    expect(inputs.map(i => i.productId)).toContain('prod-2')
  })
})

// ── runStockReconciliationWith ────────────────────────────────────────────────

describe('runStockReconciliationWith', () => {
  it('returns error and does not call persist when repository fails', async () => {
    const failingRepo: StockDataRepository = {
      loadBundle: async () => ({ error: 'DB timeout' }),
    }
    const persist = vi.fn()
    const writer: StockWriter = { persist }

    const result = await runStockReconciliationWith('shift-1', failingRepo, writer)

    expect(result.error).toBe('DB timeout')
    expect(persist).not.toHaveBeenCalled()
  })

  it('calls persist with correct stock lines on happy path', async () => {
    const repo: StockDataRepository = {
      loadBundle: async () => makeBundle(),
    }
    const captured: Parameters<StockWriter['persist']>[] = []
    const writer: StockWriter = {
      persist: async (shiftId, lines) => {
        captured.push([shiftId, lines])
        return {}
      },
    }

    const result = await runStockReconciliationWith('shift-1', repo, writer)

    expect(result.error).toBeUndefined()
    expect(captured).toHaveLength(1)
    const [capturedShiftId, lines] = captured[0]
    expect(capturedShiftId).toBe('shift-1')
    // opening=10, deliveries=0, pos_sold=2 → expected=8, actual=8, variance=0
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('prod-1')
    expect(lines[0].variance_units).toBe(0)
  })

  it('returns persist error when writer fails', async () => {
    const repo: StockDataRepository = {
      loadBundle: async () => makeBundle(),
    }
    const writer: StockWriter = {
      persist: async () => ({ error: 'insert failed' }),
    }

    const result = await runStockReconciliationWith('shift-1', repo, writer)
    expect(result.error).toBe('insert failed')
  })
})
