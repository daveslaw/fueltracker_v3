'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error: string } | { success: true }

// ── saveCashierFuelPos ────────────────────────────────────────────────────────

export type FuelPosLineInput = {
  fuel_grade_id: string
  litres_sold: number
  revenue_zar: number
}

export async function saveCashierFuelPos(
  shiftId: string,
  photoUrl: string | null,
  rawOcr: unknown,
  lines: FuelPosLineInput[]
): Promise<ActionResult> {
  const supabase = await createClient()

  if (!lines.length) return { error: 'At least one grade line is required' }

  const { data: submission, error: subErr } = await supabase
    .from('pos_submissions')
    .upsert(
      { shift_id: shiftId, photo_url: photoUrl, raw_ocr: rawOcr },
      { onConflict: 'shift_id' }
    )
    .select('id')
    .single()
  if (subErr) return { error: subErr.message }

  await supabase.from('pos_submission_lines').delete().eq('pos_submission_id', submission.id)

  const { error: linesErr } = await supabase.from('pos_submission_lines').insert(
    lines.map(l => ({
      pos_submission_id: submission.id,
      fuel_grade_id: l.fuel_grade_id,
      litres_sold: l.litres_sold,
      revenue_zar: l.revenue_zar,
    }))
  )
  if (linesErr) return { error: linesErr.message }

  revalidatePath(`/cashier/${shiftId}`)
  return { success: true }
}

// ── saveCashierDryStockPos ─────────────────────────────────────────────────────

export type DryStockPosLineInput = {
  product_id: string
  units_sold: number
  revenue_zar: number
}

export async function saveCashierDryStockPos(
  shiftId: string,
  photoUrl: string | null,
  lines: DryStockPosLineInput[]
): Promise<ActionResult> {
  const supabase = await createClient()

  if (!lines.length) return { error: 'At least one product line is required' }

  const { data: submission, error: subErr } = await supabase
    .from('dry_stock_pos_submissions')
    .upsert(
      { shift_id: shiftId, photo_url: photoUrl, ocr_status: 'confirmed' },
      { onConflict: 'shift_id' }
    )
    .select('id')
    .single()
  if (subErr) return { error: subErr.message }

  await supabase.from('pos_dry_stock_lines').delete().eq('dry_stock_pos_submission_id', submission.id)

  const { error: linesErr } = await supabase.from('pos_dry_stock_lines').insert(
    lines.map(l => ({
      dry_stock_pos_submission_id: submission.id,
      product_id: l.product_id,
      units_sold: l.units_sold,
      revenue_zar: l.revenue_zar,
      ocr_status: 'confirmed',
    }))
  )
  if (linesErr) return { error: linesErr.message }

  revalidatePath(`/cashier/${shiftId}`)
  return { success: true }
}

// ── saveCashierStockReading ───────────────────────────────────────────────────

export async function saveCashierStockReading(
  shiftId: string,
  productId: string,
  closingCount: number
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('stock_readings').upsert(
    { shift_id: shiftId, product_id: productId, closing_count: closingCount },
    { onConflict: 'shift_id,product_id' }
  )
  if (error) return { error: error.message }

  revalidatePath(`/cashier/${shiftId}`)
  return { success: true }
}

// ── saveCashierStockDelivery ──────────────────────────────────────────────────

export async function saveCashierStockDelivery(
  shiftId: string,
  stationId: string,
  productId: string,
  quantity: number
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('stock_deliveries').insert({
    shift_id: shiftId,
    station_id: stationId,
    product_id: productId,
    quantity,
  })
  if (error) return { error: error.message }

  revalidatePath(`/cashier/${shiftId}/stock-count`)
  return { success: true }
}

// ── deleteCashierStockDelivery ────────────────────────────────────────────────

export async function deleteCashierStockDelivery(
  shiftId: string,
  deliveryId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('stock_deliveries').delete().eq('id', deliveryId)
  if (error) return { error: error.message }

  revalidatePath(`/cashier/${shiftId}/stock-count`)
  return { success: true }
}
