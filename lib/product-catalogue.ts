import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '@/lib/products'
import type { ProductPriceWriter } from '@/lib/product-pricing'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateProductInput = {
  stock_code:          string
  description:         string
  cost_price:          number
  sell_price:          number
  initial_stock_count: number
}

export type UpdateProductInput = {
  stock_code:  string
  description: string
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface ProductCatalogueRepository {
  /** Returns all active products for a station ordered by stock_code. */
  getProducts(stationId: string): Promise<Product[]>

  /** Creates a product, seeds its initial price, and sets the opening baseline. */
  createProduct(stationId: string, input: CreateProductInput): Promise<{ id: string } | { error: string }>

  /** Updates stock_code and description only — does not touch pricing. */
  updateProductDetails(productId: string, input: UpdateProductInput): Promise<{ error?: string }>

  /** Marks a product as inactive so it no longer appears in cashier forms. */
  deactivateProduct(productId: string): Promise<{ error?: string }>

  /** Marks a previously deactivated product as active again. */
  reactivateProduct(productId: string): Promise<{ error?: string }>
}

// ── Supabase adapter ──────────────────────────────────────────────────────────

export function createSupabaseProductCatalogueRepository(
  db:     SupabaseClient,
  writer: ProductPriceWriter,
): ProductCatalogueRepository {
  return {
    async getProducts(stationId) {
      const { data } = await db
        .from('products')
        .select('id, station_id, stock_code, description, is_active')
        .eq('station_id', stationId)
        .eq('is_active', true)
        .order('stock_code')
      return (data ?? []) as Product[]
    },

    async createProduct(stationId, input) {
      const { data, error } = await db
        .from('products')
        .insert({ station_id: stationId, stock_code: input.stock_code, description: input.description })
        .select('id')
        .single()

      if (error || !data) return { error: error?.message ?? 'Insert failed' }

      const productId = (data as { id: string }).id
      const now = new Date().toISOString()

      await writer.insertPrice(productId, stationId, input.cost_price, input.sell_price, now)

      await db
        .from('stock_baselines')
        .upsert(
          { station_id: stationId, product_id: productId, quantity: input.initial_stock_count },
          { onConflict: 'station_id,product_id' },
        )

      return { id: productId }
    },

    async updateProductDetails(productId, input) {
      const { error } = await db
        .from('products')
        .update({ stock_code: input.stock_code, description: input.description })
        .eq('id', productId)
      return error ? { error: error.message } : {}
    },

    async deactivateProduct(productId) {
      const { error } = await db
        .from('products')
        .update({ is_active: false })
        .eq('id', productId)
      return error ? { error: error.message } : {}
    },

    async reactivateProduct(productId) {
      const { error } = await db
        .from('products')
        .update({ is_active: true })
        .eq('id', productId)
      return error ? { error: error.message } : {}
    },
  }
}
