import { describe, it, expect } from 'vitest'
import type { StockReadingsRepository } from '@/lib/stock-readings'

// ── In-memory fake ─────────────────────────────────────────────────────────────

type StoredReading = { id: string; shift_id: string; product_id: string; closing_count: number }
type StoredDelivery = { id: string; shift_id: string; station_id: string; product_id: string; quantity: number }

function makeInMemoryRepo(): StockReadingsRepository & {
  _readings: StoredReading[]
  _deliveries: StoredDelivery[]
} {
  const readings: StoredReading[] = []
  const deliveries: StoredDelivery[] = []
  let nextId = 1

  return {
    _readings: readings,
    _deliveries: deliveries,

    async saveStockReading(shiftId, productId, closingCount) {
      const idx = readings.findIndex(r => r.shift_id === shiftId && r.product_id === productId)
      const row: StoredReading = { id: String(nextId++), shift_id: shiftId, product_id: productId, closing_count: closingCount }
      if (idx >= 0) readings[idx] = row
      else readings.push(row)
      return {}
    },

    async saveStockDelivery(shiftId, stationId, productId, quantity) {
      deliveries.push({ id: String(nextId++), shift_id: shiftId, station_id: stationId, product_id: productId, quantity })
      return {}
    },

    async deleteStockDelivery(deliveryId) {
      const idx = deliveries.findIndex(d => d.id === deliveryId)
      if (idx >= 0) deliveries.splice(idx, 1)
      return {}
    },

    async getStockReadings(shiftId) {
      return readings.filter(r => r.shift_id === shiftId)
    },

    async getStockDeliveries(shiftId) {
      return deliveries.filter(d => d.shift_id === shiftId)
    },
  }
}

// ── saveStockReading ──────────────────────────────────────────────────────────

describe('saveStockReading', () => {
  it('tracer bullet: stores a closing count for a product', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockReading('shift-1', 'product-1', 24)

    const readings = await repo.getStockReadings('shift-1')
    expect(readings).toHaveLength(1)
    expect(readings[0]).toMatchObject({ shift_id: 'shift-1', product_id: 'product-1', closing_count: 24 })
  })

  it('overwrites an existing reading for the same shift + product', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockReading('shift-1', 'product-1', 24)
    await repo.saveStockReading('shift-1', 'product-1', 30)

    const readings = await repo.getStockReadings('shift-1')
    expect(readings).toHaveLength(1)
    expect(readings[0].closing_count).toBe(30)
  })

  it('stores separate readings for different products', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockReading('shift-1', 'product-1', 24)
    await repo.saveStockReading('shift-1', 'product-2', 12)

    const readings = await repo.getStockReadings('shift-1')
    expect(readings).toHaveLength(2)
  })

  it('returns no error on success', async () => {
    const repo = makeInMemoryRepo()
    const result = await repo.saveStockReading('shift-1', 'product-1', 10)
    expect(result.error).toBeUndefined()
  })
})

// ── saveStockDelivery ─────────────────────────────────────────────────────────

describe('saveStockDelivery', () => {
  it('tracer bullet: records a delivery for a product', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 48)

    const deliveries = await repo.getStockDeliveries('shift-1')
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({ shift_id: 'shift-1', product_id: 'product-1', quantity: 48 })
  })

  it('allows multiple deliveries per product in the same shift', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 24)
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 12)

    const deliveries = await repo.getStockDeliveries('shift-1')
    expect(deliveries).toHaveLength(2)
  })

  it('returns no error on success', async () => {
    const repo = makeInMemoryRepo()
    const result = await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 10)
    expect(result.error).toBeUndefined()
  })
})

// ── deleteStockDelivery ───────────────────────────────────────────────────────

describe('deleteStockDelivery', () => {
  it('removes a delivery by id', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 24)
    const [delivery] = await repo.getStockDeliveries('shift-1')

    await repo.deleteStockDelivery(delivery.id)
    const remaining = await repo.getStockDeliveries('shift-1')
    expect(remaining).toHaveLength(0)
  })

  it('does not affect other deliveries', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 24)
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 12)
    const [first] = await repo.getStockDeliveries('shift-1')

    await repo.deleteStockDelivery(first.id)
    const remaining = await repo.getStockDeliveries('shift-1')
    expect(remaining).toHaveLength(1)
  })

  it('returns no error on success', async () => {
    const repo = makeInMemoryRepo()
    const result = await repo.deleteStockDelivery('nonexistent')
    expect(result.error).toBeUndefined()
  })
})

// ── getStockReadings ──────────────────────────────────────────────────────────

describe('getStockReadings', () => {
  it('returns empty array when no readings exist for shift', async () => {
    const repo = makeInMemoryRepo()
    expect(await repo.getStockReadings('shift-1')).toEqual([])
  })

  it('returns only readings for the requested shift', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockReading('shift-1', 'product-1', 24)
    await repo.saveStockReading('shift-2', 'product-1', 99)

    const readings = await repo.getStockReadings('shift-1')
    expect(readings).toHaveLength(1)
    expect(readings[0].closing_count).toBe(24)
  })
})

// ── getStockDeliveries ────────────────────────────────────────────────────────

describe('getStockDeliveries', () => {
  it('returns empty array when no deliveries exist for shift', async () => {
    const repo = makeInMemoryRepo()
    expect(await repo.getStockDeliveries('shift-1')).toEqual([])
  })

  it('returns only deliveries for the requested shift', async () => {
    const repo = makeInMemoryRepo()
    await repo.saveStockDelivery('shift-1', 'station-1', 'product-1', 24)
    await repo.saveStockDelivery('shift-2', 'station-1', 'product-1', 99)

    const deliveries = await repo.getStockDeliveries('shift-1')
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].quantity).toBe(24)
  })
})
