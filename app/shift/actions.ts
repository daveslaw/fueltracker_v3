'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canStartShift } from '@/lib/shift-open'
import { getCloseProgress, canSubmit } from '@/lib/shift-close'
import { runReconciliation } from '@/lib/reconciliation-runner'
import { canFlag, canOverride, validateFlagComment, validateOverride } from '@/lib/supervisor-review'
import { createDelivery, deleteDelivery as dbDeleteDelivery, validateDeliveryInput } from '@/lib/deliveries'
import type { ShiftRow, ShiftPeriod, ShiftStatus } from '@/lib/shift-open'

type ActionResult = { error: string } | { success: true }

// ── createShift ───────────────────────────────────────────────────────────────

export async function createShift(formData: FormData) {
  const supabase = await createClient()
  const station_id = formData.get('station_id') as string
  const period = formData.get('period') as ShiftPeriod
  const shift_date = new Date().toISOString().split('T')[0]

  // Resolve caller's profile id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!profile) return { error: 'User profile not found' }

  // Duplicate guard
  const { data: existing } = await supabase
    .from('shifts')
    .select('station_id, period, shift_date, status')
    .eq('station_id', station_id)
    .eq('shift_date', shift_date)

  if (!canStartShift((existing ?? []) as ShiftRow[], station_id, period, shift_date)) {
    return { error: `A ${period} shift for this station is already in progress today.` }
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({ station_id, period, shift_date, supervisor_id: profile.id, status: 'pending' })
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

  if (isNaN(meter_reading) || meter_reading < 0)
    return { error: 'Enter a valid meter reading' }

  const { error } = await supabase.from('pump_readings').upsert({
    shift_id: shiftId,
    pump_id: pumpId,
    type: 'close',
    meter_reading,
    photo_url,
    ocr_status,
  }, { onConflict: 'shift_id,pump_id,type' })
  if (error) return { error: error.message }

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

export type PosLineInput = {
  fuel_grade_id: string
  litres_sold: number
  revenue_zar: number
}

export async function savePosSubmission(
  shiftId: string,
  photoUrl: string | null,
  rawOcr: unknown,
  lines: PosLineInput[]
): Promise<ActionResult> {
  const supabase = await createClient()

  if (!lines.length) return { error: 'At least one grade line is required' }

  // Upsert the pos_submissions record
  const { data: submission, error: subErr } = await supabase
    .from('pos_submissions')
    .upsert({ shift_id: shiftId, photo_url: photoUrl, raw_ocr: rawOcr },
      { onConflict: 'shift_id' })
    .select('id')
    .single()
  if (subErr) return { error: subErr.message }

  // Replace all lines
  await supabase.from('pos_submission_lines').delete().eq('pos_submission_id', submission.id)

  const { error: linesErr } = await supabase.from('pos_submission_lines').insert(
    lines.map((l) => ({
      pos_submission_id: submission.id,
      fuel_grade_id: l.fuel_grade_id,
      litres_sold: l.litres_sold,
      revenue_zar: l.revenue_zar,
    }))
  )
  if (linesErr) return { error: linesErr.message }

  revalidatePath(`/shift/${shiftId}/close/pos`)
  return { success: true }
}

// ── submitShift ───────────────────────────────────────────────────────────────

export async function submitShift(shiftId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }
  if (!canSubmit(shift.status as ShiftStatus))
    return { error: 'Shift cannot be submitted from its current status' }

  // Validate all close readings present
  const [
    { data: pumps }, { data: closePumpReadings },
    { data: tanks }, { data: closeDipReadings },
    { data: posSubmission },
  ] = await Promise.all([
    supabase.from('pumps').select('id').eq('station_id', shift.station_id),
    supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id').eq('station_id', shift.station_id),
    supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
  ])

  const progress = getCloseProgress(
    (pumps ?? []).map((p) => p.id),
    (closePumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (closeDipReadings ?? []).map((r) => r.tank_id),
    !!posSubmission
  )

  if (!progress.isComplete) return { error: 'All close readings and POS submission are required before submitting.' }

  const submittedAt = new Date().toISOString()
  const { error } = await supabase
    .from('shifts').update({ status: 'closed', submitted_at: submittedAt }).eq('id', shiftId)
  if (error) return { error: error.message }

  // Run reconciliation server-side immediately after close
  await runReconciliation(shiftId)

  redirect(`/shift/${shiftId}/close/summary`)
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
  return { success: true }
}

// ── saveDelivery ──────────────────────────────────────────────────────────────

export async function saveDelivery(
  shiftId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const tankId          = (formData.get('tank_id') as string) ?? ''
  const litresReceived  = parseFloat(formData.get('litres_received') as string)
  const deliveryNoteUrl = (formData.get('delivery_note_url') as string) ?? ''

  const validation = validateDeliveryInput({ tankId, litresReceived, deliveryNoteUrl })
  if (!validation.valid) return { error: validation.error }

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'User profile not found' }

  const result = await createDelivery(supabase, {
    stationId:      shift.station_id,
    tankId,
    litresReceived,
    deliveryNoteUrl,
    recordedBy:     profile.id,
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

  const reading_id     = formData.get('reading_id') as string
  const reading_type   = formData.get('reading_type') as 'pump' | 'pos_line'
  const original_value = parseFloat(formData.get('original_value') as string)
  const override_value = parseFloat(formData.get('override_value') as string)
  const reason         = (formData.get('reason') as string) ?? ''

  if (!reading_id || !reading_type) return { error: 'Reading reference is required' }
  if (isNaN(original_value) || isNaN(override_value))
    return { error: 'Values must be valid numbers' }

  const validation = validateOverride({ value: override_value, reason })
  if (!validation.valid) return { error: validation.error }

  const { data: shift } = await supabase
    .from('shifts').select('status').eq('id', shiftId).single()
  if (!shift) return { error: 'Shift not found' }
  if (!canOverride(shift.status as ShiftStatus))
    return { error: 'Overrides are only allowed on closed shifts' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'User profile not found' }

  const { error } = await supabase.from('ocr_overrides').insert({
    shift_id:      shiftId,
    reading_id,
    reading_type,
    original_value,
    override_value,
    reason,
    overridden_by: profile.id,
  })
  if (error) return { error: error.message }

  await runReconciliation(shiftId)

  revalidatePath(`/shift/${shiftId}/close/summary`)
  return { success: true }
}

