'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canStartShift } from '@/lib/shift-open'
import { canFlag, validateFlagComment } from '@/lib/supervisor-review'
import { runReconciliation } from '@/lib/reconciliation-runner'
import { createDelivery, deleteDelivery as dbDeleteDelivery, validateDeliveryInput } from '@/lib/deliveries'
import { assertOwner } from '@/lib/auth-assert'
import { runShiftClose, runShiftSplit, runShiftOverride } from '@/lib/shift-workflow'
import type { ShiftOverrideData } from '@/lib/shift-workflow'
import type { ShiftRow, ShiftPeriod, ShiftStatus } from '@/lib/shift-open'
import { savePosLines } from '@/lib/pos-submission'
export type { PosNozzleLineInput } from '@/lib/pos-submission'

type ActionResult = { error: string } | { success: true; warning?: string }

// ── getCallerProfileId ────────────────────────────────────────────────────────

async function getCallerProfileId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  return profile?.id ?? null
}

// ── createShift ───────────────────────────────────────────────────────────────

export async function createShift(formData: FormData) {
  const supabase = await createClient()
  const station_id = formData.get('station_id') as string
  const period = formData.get('period') as ShiftPeriod
  const shift_date = new Date().toISOString().split('T')[0]

  const profileId = await getCallerProfileId(supabase)
  if (!profileId) redirect('/login')

  // Duplicate guard
  const { data: existing } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status, part')
    .eq('station_id', station_id)
    .eq('shift_date', shift_date)

  if (!canStartShift((existing ?? []) as ShiftRow[], station_id, period, shift_date)) {
    const existingShift = (existing ?? []).find(
      s => s.period === period && (s.status === 'pending' || s.status === 'closed')
    )
    return {
      error: `A ${period} shift for this station is already in progress today.`,
      existingShiftId: existingShift?.id ?? null,
      existingShiftStatus: existingShift?.status ?? null,
    }
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({ station_id, period, shift_date, supervisor_id: profileId, status: 'pending' })
    .select('id')
    .single()
  if (error) return { error: error.message }

  redirect(`/shift/${shift.id}/close/pumps`)
}

// ── saveClosePumpReading ──────────────────────────────────────────────────────

export async function saveClosePumpReading(
  shiftId: string,
  pumpId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const meter_reading = parseFloat(formData.get('meter_reading') as string)
  const photo_url = (formData.get('photo_url') as string) || null
  const ocr_status = (formData.get('ocr_status') as string) || 'manual_override'
  const maintenance_required = formData.get('maintenance_required') === 'on'

  if (isNaN(meter_reading) || meter_reading < 0)
    return { error: 'Enter a valid meter reading' }

  const { error } = await supabase.from('pump_readings').upsert({
    shift_id: shiftId,
    pump_id: pumpId,
    type: 'close',
    meter_reading,
    photo_url,
    ocr_status,
    maintenance_required,
  }, { onConflict: 'shift_id,pump_id,type' })
  if (error) return { error: error.message }

  if (ocr_status !== 'auto') {
    await supabase.from('shifts').update({ has_manual_entry: true }).eq('id', shiftId)
  }

  revalidatePath(`/shift/${shiftId}/close/pumps`)
  return { success: true }
}

// ── saveCloseDipReading ───────────────────────────────────────────────────────

export async function saveCloseDipReading(
  shiftId: string,
  tankId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const litres = parseFloat(formData.get('litres') as string)

  if (isNaN(litres) || litres < 0) return { error: 'Enter a valid dip reading (litres)' }

  const { error } = await supabase.from('dip_readings').upsert({
    shift_id: shiftId,
    tank_id: tankId,
    type: 'close',
    litres,
  }, { onConflict: 'shift_id,tank_id,type' })
  if (error) return { error: error.message }

  revalidatePath(`/shift/${shiftId}/close/dips`)
  return { success: true }
}

// ── savePosSubmission ─────────────────────────────────────────────────────────

export async function savePosSubmission(
  shiftId: string,
  photoUrl: string | null,
  rawOcr: unknown,
  lines: PosNozzleLineInput[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await savePosLines(supabase, shiftId, photoUrl, rawOcr, lines)
  if (error) return { error }
  revalidatePath(`/shift/${shiftId}/close/pos`)
  return { success: true }
}

// ── submitShift ───────────────────────────────────────────────────────────────

export async function submitShift(shiftId: string): Promise<ActionResult> {
  const result = await runShiftClose(shiftId)
  if ('error' in result) return result
  redirect(`/shift/${shiftId}/close/summary`)
}

// ── splitShift ────────────────────────────────────────────────────────────────

export async function splitShift(
  shiftId: string
): Promise<{ error: string } | { part2ShiftId: string }> {
  const result = await runShiftSplit(shiftId)
  if ('error' in result) return result
  revalidatePath(`/shift/${shiftId}/close/summary`)
  return { part2ShiftId: result.part2ShiftId }
}

// ── flagShift ─────────────────────────────────────────────────────────────────

export async function flagShift(shiftId: string, comment: string): Promise<ActionResult> {
  const commentResult = validateFlagComment(comment)
  if (!commentResult.valid) return { error: commentResult.error }

  const supabase = await createClient()
  const { data: shift } = await supabase
    .from('shifts').select('status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }
  if (!canFlag(shift.status as ShiftStatus)) return { error: 'Only closed shifts can be flagged' }

  const { error } = await supabase
    .from('shifts')
    .update({ is_flagged: true, flag_comment: comment.trim() })
    .eq('id', shiftId)
  if (error) return { error: error.message }

  revalidatePath(`/shift/${shiftId}/close/summary`)
  revalidatePath(`/dashboard/history/${shiftId}`)
  return { success: true }
}

// ── unflagShift ───────────────────────────────────────────────────────────────

export async function unflagShift(shiftId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: shift } = await supabase
    .from('shifts').select('status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }
  if (!canFlag(shift.status as ShiftStatus)) return { error: 'Only closed shifts can be unflagged' }

  const { error } = await supabase
    .from('shifts')
    .update({ is_flagged: false, flag_comment: null })
    .eq('id', shiftId)
  if (error) return { error: error.message }

  revalidatePath(`/shift/${shiftId}/close/summary`)
  revalidatePath(`/dashboard/history/${shiftId}`)
  return { success: true }
}

// ── saveDelivery ──────────────────────────────────────────────────────────────

export async function saveDelivery(
  shiftId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const tankId             = (formData.get('tank_id') as string) ?? ''
  const litresReceived     = parseFloat(formData.get('litres_received') as string)
  const deliveryNoteUrl    = (formData.get('delivery_note_url') as string) ?? ''
  const deliveryNoteNumber = (formData.get('delivery_note_number') as string) ?? ''
  const driverName         = (formData.get('driver_name') as string) || null

  const validation = validateDeliveryInput({ tankId, litresReceived, deliveryNoteUrl, deliveryNoteNumber })
  if (!validation.valid) return { error: validation.error }

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }

  const profileId = await getCallerProfileId(supabase)
  if (!profileId) return { error: 'Not authenticated' }

  const result = await createDelivery(supabase, {
    stationId:          shift.station_id,
    tankId,
    litresReceived,
    deliveryNoteUrl,
    deliveryNoteNumber,
    driverName,
    recordedBy:         profileId,
  })
  if (result.error) return { error: result.error }

  // Re-run reconciliation if the shift is already closed
  if (shift.status === 'closed') {
    await runReconciliation(shiftId)
  }

  revalidatePath(`/shift/${shiftId}/close/deliveries`)
  revalidatePath(`/shift/${shiftId}/close/summary`)
  return { success: true }
}

// ── deleteDelivery ────────────────────────────────────────────────────────────

export async function deleteDelivery(
  deliveryId: string,
  shiftId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }
  if (shift.status !== 'pending') return { error: 'Deliveries can only be removed from pending shifts' }

  const result = await dbDeleteDelivery(supabase, {
    deliveryId,
    stationId: shift.station_id,
  })
  if (result.error) return { error: result.error }

  revalidatePath(`/shift/${shiftId}/close/deliveries`)
  return { success: true }
}

// ── createOverride ────────────────────────────────────────────────────────────

export async function createOverride(
  shiftId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  await assertOwner(supabase)

  const reading_id   = formData.get('reading_id') as string
  const reading_type = formData.get('reading_type') as 'pump' | 'dip' | 'pos_line'
  const field_name   = (formData.get('field_name') as string) || null
  const override_value = parseFloat(formData.get('override_value') as string)
  const reason         = (formData.get('reason') as string) ?? ''

  if (!reading_id || !reading_type) return { error: 'Reading reference is required' }
  if (isNaN(override_value)) return { error: 'Values must be valid numbers' }

  // pos_line forms submit original_litres / original_revenue instead of a single original_value
  const original_value = reading_type === 'pos_line'
    ? parseFloat(formData.get(field_name === 'revenue_zar' ? 'original_revenue' : 'original_litres') as string)
    : parseFloat(formData.get('original_value') as string)

  const profileId = await getCallerProfileId(supabase)
  if (!profileId) return { error: 'Not authenticated' }

  const data: ShiftOverrideData = {
    readingId:     reading_id,
    readingType:   reading_type,
    fieldName:     field_name,
    overrideValue: override_value,
    originalValue: original_value,
    reason,
    overriddenBy:  profileId,
  }

  const result = await runShiftOverride(shiftId, data)
  if ('error' in result) return result

  revalidatePath(`/shift/${shiftId}/close/summary`)
  revalidatePath(`/dashboard/history/${shiftId}`)
  return { success: true }
}

