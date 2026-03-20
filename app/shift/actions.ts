'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canStartShift, getShiftProgress, resolveShiftStatus } from '@/lib/shift-open'
import { getCloseProgress, resolveCloseStatus } from '@/lib/shift-close'
import type { ShiftRow, ShiftPeriod } from '@/lib/shift-open'

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
    .insert({ station_id, period, shift_date, attendant_id: profile.id, status: 'draft' })
    .select('id')
    .single()
  if (error) return { error: error.message }

  redirect(`/shift/${shift.id}/pumps`)
}

// ── savePumpReading ───────────────────────────────────────────────────────────

export async function savePumpReading(
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
    type: 'open',
    meter_reading,
    photo_url,
    ocr_status,
  }, { onConflict: 'shift_id,pump_id,type' })
  if (error) return { error: error.message }

  await updateShiftStatus(shiftId)
  revalidatePath(`/shift/${shiftId}/pumps`)
  return { success: true }
}

// ── saveDipReading ────────────────────────────────────────────────────────────

export async function saveDipReading(
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
    type: 'open',
    litres,
  }, { onConflict: 'shift_id,tank_id,type' })
  if (error) return { error: error.message }

  await updateShiftStatus(shiftId)
  revalidatePath(`/shift/${shiftId}/dips`)
  return { success: true }
}

// ── finalizeShiftOpen ─────────────────────────────────────────────────────────

export async function finalizeShiftOpen(shiftId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Recompute progress to confirm completeness
  const [{ data: pumps }, { data: pumpReadings }, { data: tanks }, { data: dipReadings }] =
    await Promise.all([
      supabase.from('pumps').select('id').eq('station_id',
        (await supabase.from('shifts').select('station_id').eq('id', shiftId).single()).data?.station_id ?? ''
      ),
      supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'open'),
      supabase.from('tanks').select('id').eq('station_id',
        (await supabase.from('shifts').select('station_id').eq('id', shiftId).single()).data?.station_id ?? ''
      ),
      supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'open'),
    ])

  const progress = getShiftProgress(
    (pumps ?? []).map((p) => p.id),
    (pumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (dipReadings ?? []).map((r) => r.tank_id)
  )

  if (!progress.isComplete) return { error: 'Not all readings are complete.' }

  const { error } = await supabase
    .from('shifts').update({ status: 'open' }).eq('id', shiftId)
  if (error) return { error: error.message }

  revalidatePath(`/shift/${shiftId}/summary`)
  return { success: true }
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

  await updateCloseStatus(shiftId)
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

  await updateCloseStatus(shiftId)
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
  if (!['open', 'pending_pos'].includes(shift.status))
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

  const { error } = await supabase
    .from('shifts').update({ status: 'submitted' }).eq('id', shiftId)
  if (error) return { error: error.message }

  redirect('/shift')
}

// ── internal: keep draft/open status in sync after each save ─────────────────

async function updateShiftStatus(shiftId: string) {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift || !['draft', 'open'].includes(shift.status)) return

  const [{ data: pumps }, { data: pumpReadings }, { data: tanks }, { data: dipReadings }] =
    await Promise.all([
      supabase.from('pumps').select('id').eq('station_id', shift.station_id),
      supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'open'),
      supabase.from('tanks').select('id').eq('station_id', shift.station_id),
      supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'open'),
    ])

  const progress = getShiftProgress(
    (pumps ?? []).map((p) => p.id),
    (pumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (dipReadings ?? []).map((r) => r.tank_id)
  )

  const newStatus = resolveShiftStatus(progress)
  if (newStatus !== shift.status) {
    await supabase.from('shifts').update({ status: newStatus }).eq('id', shiftId)
  }
}

// ── internal: auto-advance status during close flow ──────────────────────────

async function updateCloseStatus(shiftId: string) {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('station_id, status').eq('id', shiftId).single()
  if (!shift || !['open', 'pending_pos'].includes(shift.status)) return

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

  const newStatus = resolveCloseStatus(progress)
  if (newStatus !== shift.status) {
    await supabase.from('shifts').update({ status: newStatus }).eq('id', shiftId)
  }
}
