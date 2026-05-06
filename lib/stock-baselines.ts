import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StockBaselineRow = {
  station_id: string
  product_id: string
  quantity:   number
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface StockBaselinesRepository {
  /** Store or replace the opening stock count for a product at a station. */
  upsertStockBaseline(stationId: string, productId: string, quantity: number): Promise<{ error?: string }>

  /** Return all stock baseline rows for a station. */
  getStockBaselines(stationId: string): Promise<StockBaselineRow[]>
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseStockBaselinesRepository(db: SupabaseClient): StockBaselinesRepository {
  return {
    async upsertStockBaseline(stationId, productId, quantity) {
      const { error } = await db.from('stock_baselines').upsert(
        {
          station_id: stationId,
          product_id: productId,
          quantity,
          set_at:     new Date().toISOString(),
        },
        { onConflict: 'station_id,product_id' }
      )
      return error ? { error: error.message } : {}
    },

    async getStockBaselines(stationId) {
      const { data } = await db
        .from('stock_baselines')
        .select('station_id, product_id, quantity')
        .eq('station_id', stationId)
      return (data ?? []) as StockBaselineRow[]
    },
  }
}

// ── Resolver (pure) ───────────────────────────────────────────────────────────

/**
 * Resolves the opening stock count for a product for a shift.
 * Priority: prior closed shift's closing_count → owner-set stock_baselines → null.
 */
export function resolveOpeningCount(
  productId: string,
  priorClosingCounts: Map<string, number> | null,
  stockBaselines: StockBaselineRow[],
): number | null {
  if (priorClosingCounts != null) {
    const prior = priorClosingCounts.get(productId)
    if (prior !== undefined) return prior
  }
  const baseline = stockBaselines.find(b => b.product_id === productId)
  return baseline?.quantity ?? null
}
