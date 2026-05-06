import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StockReadingRow = {
  id: string
  shift_id: string
  product_id: string
  closing_count: number
}

export type StockDeliveryRow = {
  id: string
  shift_id: string
  station_id: string
  product_id: string
  quantity: number
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface StockReadingsRepository {
  saveStockReading(shiftId: string, productId: string, closingCount: number): Promise<{ error?: string }>
  saveStockDelivery(shiftId: string, stationId: string, productId: string, quantity: number): Promise<{ error?: string }>
  deleteStockDelivery(deliveryId: string): Promise<{ error?: string }>
  getStockReadings(shiftId: string): Promise<StockReadingRow[]>
  getStockDeliveries(shiftId: string): Promise<StockDeliveryRow[]>
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseStockReadingsRepository(db: SupabaseClient): StockReadingsRepository {
  return {
    async saveStockReading(shiftId, productId, closingCount) {
      const { error } = await db.from('stock_readings').upsert(
        { shift_id: shiftId, product_id: productId, closing_count: closingCount },
        { onConflict: 'shift_id,product_id' }
      )
      return error ? { error: error.message } : {}
    },

    async saveStockDelivery(shiftId, stationId, productId, quantity) {
      const { error } = await db.from('stock_deliveries').insert({
        shift_id: shiftId,
        station_id: stationId,
        product_id: productId,
        quantity,
      })
      return error ? { error: error.message } : {}
    },

    async deleteStockDelivery(deliveryId) {
      const { error } = await db.from('stock_deliveries').delete().eq('id', deliveryId)
      return error ? { error: error.message } : {}
    },

    async getStockReadings(shiftId) {
      const { data } = await db
        .from('stock_readings')
        .select('id, shift_id, product_id, closing_count')
        .eq('shift_id', shiftId)
      return (data ?? []) as StockReadingRow[]
    },

    async getStockDeliveries(shiftId) {
      const { data } = await db
        .from('stock_deliveries')
        .select('id, shift_id, station_id, product_id, quantity')
        .eq('shift_id', shiftId)
      return (data ?? []) as StockDeliveryRow[]
    },
  }
}
