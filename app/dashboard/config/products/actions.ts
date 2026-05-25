'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertOwner } from '@/lib/auth-assert'
import { createSupabaseProductCatalogueRepository } from '@/lib/product-catalogue'
import { createSupabaseProductPriceWriter, setProductPrice } from '@/lib/product-pricing'

function makeRepo() {
  const db     = createAdminClient()
  const writer = createSupabaseProductPriceWriter(db)
  return createSupabaseProductCatalogueRepository(db, writer)
}

// ── Create product ─────────────────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  await assertOwner(await createClient())

  const stationId           = formData.get('station_id') as string
  const stock_code          = (formData.get('stock_code') as string)?.trim()
  const description         = (formData.get('description') as string)?.trim()
  const cost_price          = parseFloat(formData.get('cost_price') as string)
  const sell_price          = parseFloat(formData.get('sell_price') as string)
  const initial_stock_count = parseInt(formData.get('initial_stock_count') as string, 10)

  if (!stationId || !stock_code || !description ||
      isNaN(cost_price) || cost_price < 0 ||
      isNaN(sell_price) || sell_price < 0 ||
      isNaN(initial_stock_count) || initial_stock_count < 0) {
    return { error: 'All fields are required and must be valid non-negative numbers' }
  }

  const result = await makeRepo().createProduct(stationId, {
    stock_code, description, cost_price, sell_price, initial_stock_count,
  })

  if ('error' in result) return result

  revalidatePath(`/dashboard/config/products`)
  return { success: true }
}

// ── Update product details ─────────────────────────────────────────────────────

export async function updateProductDetails(formData: FormData) {
  await assertOwner(await createClient())

  const productId  = formData.get('product_id') as string
  const stock_code = (formData.get('stock_code') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  if (!productId || !stock_code || !description)
    return { error: 'Stock code and description are required' }

  const result = await makeRepo().updateProductDetails(productId, { stock_code, description })
  if (result.error) return result

  revalidatePath(`/dashboard/config/products`)
  return { success: true }
}

// ── Update product pricing ─────────────────────────────────────────────────────

export async function updateProductPricing(formData: FormData) {
  await assertOwner(await createClient())

  const productId = formData.get('product_id') as string
  const stationId = formData.get('station_id') as string
  const cost_price = parseFloat(formData.get('cost_price') as string)
  const sell_price = parseFloat(formData.get('sell_price') as string)
  const hasPrior   = formData.get('has_prior') === 'true'

  if (!productId || !stationId ||
      isNaN(cost_price) || cost_price < 0 ||
      isNaN(sell_price) || sell_price < 0) {
    return { error: 'Valid non-negative prices are required' }
  }

  const db     = createAdminClient()
  const writer = createSupabaseProductPriceWriter(db)
  await setProductPrice(writer, productId, stationId, cost_price, sell_price, new Date().toISOString(), hasPrior)

  revalidatePath(`/dashboard/config/products`)
  return { success: true }
}

// ── Deactivate product ─────────────────────────────────────────────────────────

export async function deactivateProduct(formData: FormData) {
  await assertOwner(await createClient())

  const productId = formData.get('product_id') as string
  if (!productId) return { error: 'Product ID required' }

  const result = await makeRepo().deactivateProduct(productId)
  if (result.error) return result

  revalidatePath(`/dashboard/config/products`)
  return { success: true }
}

// ── Reactivate product ─────────────────────────────────────────────────────────

export async function reactivateProduct(formData: FormData) {
  await assertOwner(await createClient())

  const productId = formData.get('product_id') as string
  if (!productId) return { error: 'Product ID required' }

  const result = await makeRepo().reactivateProduct(productId)
  if (result.error) return result

  revalidatePath(`/dashboard/config/products`)
  return { success: true }
}
