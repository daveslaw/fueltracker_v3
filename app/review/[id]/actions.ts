'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { runReconciliation } from '@/lib/reconciliation-runner'
import { canReview, validateOverride } from '@/lib/supervisor-review'
import type { ShiftStatus } from '@/lib/supervisor-review'

type ActionResult = { error: string } | { success: true }

// ── approveShift ───────────────────────────────────────────────────────────────

export async function approveShift(shiftId: string): Promise<void> {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('status').eq('id', shiftId).single()
  if (!shift || !canReview(shift.status as ShiftStatus, 'approve')) {
    return // guard; UI should prevent this path
  }

  await supabase
    .from('shifts')
    .update({ status: 'approved', flag_comment: null })
    .eq('id', shiftId)

  redirect('/review')
}

// ── flagShift ─────────────────────────────────────────────────────────────────

export async function flagShift(shiftId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const comment = (formData.get('flag_comment') as string)?.trim()

  if (!comment) return { error: 'A comment is required when flagging a shift' }

  const { data: shift } = await supabase
    .from('shifts').select('status').eq('id', shiftId).single()
  if (!shift || !canReview(shift.status as ShiftStatus, 'flag'))
    return { error: 'This shift cannot be flagged from its current status' }

  const { error } = await supabase
    .from('shifts')
    .update({ status: 'flagged', flag_comment: comment })
    .eq('id', shiftId)
  if (error) return { error: error.message }

  revalidatePath(`/review/${shiftId}`)
  return { success: true }
}

// ── createOverride ────────────────────────────────────────────────────────────

export async function createOverride(
  shiftId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const reading_id    = formData.get('reading_id') as string
  const reading_type  = formData.get('reading_type') as 'pump' | 'pos_line'
  const original_value = parseFloat(formData.get('original_value') as string)
  const override_value = parseFloat(formData.get('override_value') as string)
  const reason         = (formData.get('reason') as string) ?? ''

  if (!reading_id || !reading_type) return { error: 'Reading reference is required' }
  if (isNaN(original_value) || isNaN(override_value))
    return { error: 'Values must be valid numbers' }

  const validation = validateOverride({ value: override_value, reason })
  if (!validation.valid) return { error: validation.error }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'User profile not found' }

  const { error } = await supabase.from('ocr_overrides').insert({
    shift_id:       shiftId,
    reading_id,
    reading_type,
    original_value,
    override_value,
    reason,
    overridden_by:  profile.id,
  })
  if (error) return { error: error.message }

  // Re-run reconciliation with the updated value
  await runReconciliation(shiftId)

  revalidatePath(`/review/${shiftId}`)
  return { success: true }
}
