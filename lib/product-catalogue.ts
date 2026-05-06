import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '@/lib/products'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductInput = {
  id?: string
  stock_code: string
  description: string
  cost_price: number
  sell_price: number
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface ProductCatalogueRepository {
  /** Returns all active products for a station. */
  getProducts(stationId: string): Promise<Product[]>

  /** Creates a new product or updates an existing one (when input.id is set). */
  upsertProduct(stationId: string, input: ProductInput): Promise<{ error?: string }>

  /** Marks a product as inactive so it no longer appears in cashier forms. */
  deactivateProduct(productId: string): Promise<{ error?: string }>
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseProductCatalogueRepository(db: SupabaseClient): ProductCatalogueRepository {
  return {
    async getProducts(stationId) {
      const { data } = await db
        .from('products')
        .select('id, station_id, stock_code, description, cost_price, sell_price, is_active')
        .eq('station_id', stationId)
        .eq('is_active', true)
        .order('stock_code')
      return (data ?? []) as Product[]
    },

    async upsertProduct(stationId, input) {
      const row = {
        station_id: stationId,
        stock_code: input.stock_code,
        description: input.description,
        cost_price: input.cost_price,
        sell_price: input.sell_price,
        ...(input.id ? { id: input.id } : {}),
      }
      const { error } = await db.from('products').upsert(row, { onConflict: 'id' })
      return error ? { error: error.message } : {}
    },

    async deactivateProduct(productId) {
      const { error } = await db.from('products').update({ is_active: false }).eq('id', productId)
      return error ? { error: error.message } : {}
    },
  }
}
