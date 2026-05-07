import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductPriceRow = {
  product_id: string
  station_id: string
  cost_price: number
  sell_price: number
  valid_from: string       // ISO timestamp; inclusive
  valid_to:   string | null // ISO timestamp; exclusive. null = open-ended
}

export type ProductPriceResult = { cost_price: number; sell_price: number }

// ── Pure lookup ───────────────────────────────────────────────────────────────

/**
 * Given price rows for a product, returns the record active at `at`.
 * Rule: valid_from <= at AND (valid_to IS NULL OR valid_to > at)
 */
export function selectActiveProductPriceAt(
  rows: ProductPriceRow[],
  at: string,
): ProductPriceResult | null {
  const asOfMs = new Date(at).getTime()

  const match = rows.find(r => {
    const fromMs = new Date(r.valid_from).getTime()
    const toMs   = r.valid_to ? new Date(r.valid_to).getTime() : null
    return fromMs <= asOfMs && (toMs === null || toMs > asOfMs)
  })

  return match ? { cost_price: match.cost_price, sell_price: match.sell_price } : null
}

// ── Writer port ───────────────────────────────────────────────────────────────

export interface ProductPriceWriter {
  /** Stamps valid_to on the current open record (if one exists). */
  closeCurrentPrice(productId: string, stationId: string, closedAt: string): Promise<void>
  /** Inserts a new price record with valid_from = validFrom and valid_to = null. */
  insertPrice(productId: string, stationId: string, cost: number, sell: number, validFrom: string): Promise<void>
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Sets a new price for a product at a station, effective immediately.
 * Pass `hasPrior = true` when an existing open record should be closed first.
 * `now` defaults to the current UTC timestamp; injectable for testing.
 */
export async function setProductPrice(
  writer:    ProductPriceWriter,
  productId: string,
  stationId: string,
  costPrice: number,
  sellPrice: number,
  now       = new Date().toISOString(),
  hasPrior  = false,
): Promise<void> {
  if (hasPrior) {
    await writer.closeCurrentPrice(productId, stationId, now)
  }
  await writer.insertPrice(productId, stationId, costPrice, sellPrice, now)
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseProductPriceWriter(db: SupabaseClient): ProductPriceWriter {
  return {
    async closeCurrentPrice(productId, stationId, closedAt) {
      await db
        .from('product_prices')
        .update({ valid_to: closedAt })
        .eq('product_id', productId)
        .eq('station_id', stationId)
        .is('valid_to', null)
    },

    async insertPrice(productId, stationId, cost, sell, validFrom) {
      await db.from('product_prices').insert({
        product_id: productId,
        station_id: stationId,
        cost_price: cost,
        sell_price: sell,
        valid_from: validFrom,
      })
    },
  }
}
