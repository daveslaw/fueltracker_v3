import { describe, it, expect } from 'vitest'
import type { StockBaselinesRepository, StockBaselineRow } from '@/lib/stock-baselines'
import { resolveOpeningCount } from '@/lib/stock-baselines'

// ── In-memory fake ─────────────────────────────────────────────────────────────

function makeInMemoryRepo(): StockBaselinesRepository & { _rows: StockBaselineRow[] } {
  const rows: StockBaselineRow[] = []

  return {
    _rows: rows,

    async upsertStockBaseline(stationId, productId, quantity) {
      const idx = rows.findIndex(r => r.station_id === stationId && r.product_id === productId)
      const row: StockBaselineRow = { station_id: stationId, product_id: productId, quantity }
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      return {}
    },

    async getStockBaselines(stationId) {
      return rows.filter(r => r.station_id === stationId)
    },
  }
}

// ── upsertStockBaseline ───────────────────────────────────────────────────────

describe('upsertStockBaseline', () => {
  it('tracer bullet: stores a baseline for a product', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertStockBaseline('station-1', 'product-1', 48)

    const baselines = await repo.getStockBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0]).toMatchObject({ product_id: 'product-1', quantity: 48 })
  })

  it('overwrites an existing baseline for the same product', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertStockBaseline('station-1', 'product-1', 48)
    await repo.upsertStockBaseline('station-1', 'product-1', 60)

    const baselines = await repo.getStockBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0].quantity).toBe(60)
  })

  it('stores separate baselines for different products', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertStockBaseline('station-1', 'product-1', 48)
    await repo.upsertStockBaseline('station-1', 'product-2', 24)

    const baselines = await repo.getStockBaselines('station-1')
    expect(baselines).toHaveLength(2)
  })
})

// ── getStockBaselines ─────────────────────────────────────────────────────────

describe('getStockBaselines', () => {
  it('returns empty array when no baselines set for station', async () => {
    const repo = makeInMemoryRepo()
    expect(await repo.getStockBaselines('station-1')).toEqual([])
  })

  it('returns only baselines for the requested station', async () => {
    const repo = makeInMemoryRepo()
    await repo.upsertStockBaseline('station-1', 'product-1', 48)
    await repo.upsertStockBaseline('station-2', 'product-1', 99)

    const baselines = await repo.getStockBaselines('station-1')
    expect(baselines).toHaveLength(1)
    expect(baselines[0].quantity).toBe(48)
  })
})

// ── resolveOpeningCount ───────────────────────────────────────────────────────

describe('resolveOpeningCount', () => {
  it('tracer bullet: returns prior shift closing count when available', () => {
    const priorCounts = new Map([['product-1', 30]])
    const baselines: StockBaselineRow[] = [{ station_id: 'station-1', product_id: 'product-1', quantity: 48 }]

    const result = resolveOpeningCount('product-1', priorCounts, baselines)
    expect(result).toBe(30)
  })

  it('falls back to stock baseline when no prior shift count exists', () => {
    const priorCounts = new Map<string, number>()
    const baselines: StockBaselineRow[] = [{ station_id: 'station-1', product_id: 'product-1', quantity: 48 }]

    const result = resolveOpeningCount('product-1', priorCounts, baselines)
    expect(result).toBe(48)
  })

  it('returns null when neither prior count nor baseline exists', () => {
    const priorCounts = new Map<string, number>()
    const baselines: StockBaselineRow[] = []

    const result = resolveOpeningCount('product-1', priorCounts, baselines)
    expect(result).toBeNull()
  })

  it('returns null when priorCounts is null and no baseline exists', () => {
    const result = resolveOpeningCount('product-1', null, [])
    expect(result).toBeNull()
  })

  it('uses baseline when priorCounts is null but baseline exists', () => {
    const baselines: StockBaselineRow[] = [{ station_id: 'station-1', product_id: 'product-1', quantity: 12 }]
    const result = resolveOpeningCount('product-1', null, baselines)
    expect(result).toBe(12)
  })
})
