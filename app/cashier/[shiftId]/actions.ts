'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createClient }   from '@/lib/supabase/server'
import { canCashierSubmit }            from '@/lib/cashier-progress'
import { getCashierSubmissionState }   from '@/lib/cashier-submission'
import { runStockReconciliation }      from '@/lib/dry-stock-runner'
import { savePosLines }                from '@/lib/pos-submission'
export type { PosNozzleLineInput }     from '@/lib/pos-submission'

type ActionResult = { error: string } | { success: true }

// ── saveCashierFuelPos ────────────────────────────────────────────────────────

export async function saveCashierFuelPos(
  shiftId: string,
  photoUrl: string | null,
  rawOcr: unknown,
  lines: PosNozzleLineInput[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await savePosLines(supabase, shiftId, photoUrl, rawOcr, lines)
  if (error) return { error }
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

  if (lines.length > 0) {
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
  }

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

// ── submitCashierShift ────────────────────────────────────────────────────────

export async function submitCashierShift(shiftId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, station_id')
    .eq('user_id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const { data: shiftCheck } = await supabase
    .from('shifts').select('id').eq('id', shiftId).eq('station_id', profile.station_id).single()
  if (!shiftCheck) return { error: 'Shift not found' }

  const state = await getCashierSubmissionState(shiftId)
  if (state.submitted) return { error: 'Shift already submitted' }
  if (!canCashierSubmit(state.progress)) {
    return { error: 'The fuel Z-report must be saved before submitting.' }
  }

  const { error: stampErr } = await supabase
    .from('shifts')
    .update({ cashier_submitted_at: new Date().toISOString(), cashier_id: profile.id })
    .eq('id', shiftId)
  if (stampErr) return { error: stampErr.message }

  const { error: reconErr } = await runStockReconciliation(shiftId)
  if (reconErr) {
    console.error('[submitCashierShift] dry stock reconciliation failed:', reconErr)
    await supabase
      .from('shifts')
      .update({ cashier_reconciliation_error: reconErr })
      .eq('id', shiftId)
  }

  redirect(`/cashier/${shiftId}/summary`)
}
