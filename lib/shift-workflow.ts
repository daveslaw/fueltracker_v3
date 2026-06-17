import { getCloseProgress, canSubmit } from '@/lib/shift-close'
import { hasPriceChangeDuringWindow } from '@/lib/pricing'
import { canSplitShift } from '@/lib/shift-open'
import { canOverride, validateOverride } from '@/lib/supervisor-review'
import { createClient } from '@/lib/supabase/server'
import type { ShiftStatus, ShiftPeriod } from '@/lib/shift-open'

// ── Shared result type ─────────────────────────────────────────────────────────

export type WorkflowResult = { error: string } | { success: true; warning?: string }

type Reconcile = (shiftId: string) => Promise<{ error?: string }>

// ── runShiftClose ──────────────────────────────────────────────────────────────

export interface ShiftCloseBundle {
  shift: {
    station_id: string
    status:     ShiftStatus
    part:       number
    started_at: string | null
  }
  cashierSubmitted: boolean
  pumpIds:          string[]
  closedPumpIds:    string[]
  tankIds:          string[]
  closedTankIds:    string[]
  priceWindows:     { valid_from: string }[]
}

export interface ShiftCloseRepository {
  loadCloseBundle(shiftId: string): Promise<ShiftCloseBundle | null>
  closeShift(shiftId: string, update: {
    submitted_at: string
    is_flagged?:  boolean
    flag_comment?: string
  }): Promise<{ error?: string }>
}

export async function runShiftCloseWith(
  shiftId:   string,
  repo:      ShiftCloseRepository,
  reconcile: Reconcile,
): Promise<WorkflowResult> {
  const bundle = await repo.loadCloseBundle(shiftId)
  if (!bundle) return { error: 'Shift not found' }

  const { shift, cashierSubmitted, pumpIds, closedPumpIds, tankIds, closedTankIds, priceWindows } = bundle

  if (!cashierSubmitted)
    return { error: 'Shift cannot be submitted: cashier must submit their shift first.' }

  if (!canSubmit(shift.status, true))
    return { error: 'Shift cannot be submitted in its current state.' }

  const progress = getCloseProgress(pumpIds, closedPumpIds, tankIds, closedTankIds, true, true)
  if (!progress.isComplete)
    return { error: 'All close readings and cashier submission are required before submitting.' }

  const submittedAt = new Date().toISOString()

  let autoFlag: { is_flagged: boolean; flag_comment: string } | undefined
  if (shift.part === 0 && shift.started_at) {
    if (hasPriceChangeDuringWindow(priceWindows, shift.started_at, submittedAt)) {
      autoFlag = {
        is_flagged:   true,
        flag_comment: 'Price change detected during shift window — consider splitting.',
      }
    }
  }

  const closeErr = await repo.closeShift(shiftId, { submitted_at: submittedAt, ...autoFlag })
  if (closeErr.error) return { error: closeErr.error }

  const { error: reconcileErr } = await reconcile(shiftId)
  if (reconcileErr) return { success: true, warning: `Shift closed but reconciliation failed: ${reconcileErr}` }

  return { success: true }
}

// ── runShiftOverride ───────────────────────────────────────────────────────────

export interface ShiftOverrideData {
  readingId:     string
  readingType:   'pump' | 'dip' | 'pos_line' | 'dry_stock_line' | 'stock_reading'
  fieldName:     string | null
  overrideValue: number
  originalValue: number
  reason:        string
  overriddenBy:  string
}

export interface ShiftOverrideRepository {
  loadOverrideBundle(shiftId: string): Promise<{ status: ShiftStatus } | null>
  applyMutation(data: ShiftOverrideData): Promise<{ error?: string }>
  insertAuditRecord(shiftId: string, data: ShiftOverrideData): Promise<{ error?: string }>
  setManualEntry(shiftId: string): Promise<{ error?: string }>
}

export async function runShiftOverrideWith(
  shiftId:   string,
  data:      ShiftOverrideData,
  repo:      ShiftOverrideRepository,
  reconcile: Reconcile,
  options?:  { allowPending?: boolean },
): Promise<WorkflowResult> {
  const bundle = await repo.loadOverrideBundle(shiftId)
  if (!bundle) return { error: 'Shift not found' }

  if (!options?.allowPending && !canOverride(bundle.status))
    return { error: 'Overrides are only allowed on closed shifts' }

  const validation = validateOverride({
    value:        data.overrideValue,
    reason:       data.reason,
    reading_type: data.readingType,
    field_name:   data.fieldName,
  })
  if (!validation.valid) return { error: validation.error }

  const mutErr = await repo.applyMutation(data)
  if (mutErr.error) return { error: mutErr.error }

  if (data.readingType === 'pump' || data.readingType === 'pos_line') {
    const flagErr = await repo.setManualEntry(shiftId)
    if (flagErr.error) return { error: flagErr.error }
  }

  const auditErr = await repo.insertAuditRecord(shiftId, data)
  if (auditErr.error) return { error: auditErr.error }

  const { error: reconcileErr } = await reconcile(shiftId)
  if (reconcileErr) return { success: true, warning: `Override applied but reconciliation failed: ${reconcileErr}` }

  return { success: true }
}

export async function runShiftOverride(shiftId: string, data: ShiftOverrideData): Promise<WorkflowResult> {
  const { runReconciliation } = await import('@/lib/reconciliation-runner')
  const supabase = await createClient()

  const repo: ShiftOverrideRepository = {
    async loadOverrideBundle(id) {
      const { data: shift } = await supabase.from('shifts').select('status').eq('id', id).single()
      if (!shift) return null
      return { status: shift.status as ShiftStatus }
    },

    async applyMutation(d) {
      if (d.readingType === 'pump') {
        const { error } = await supabase
          .from('pump_readings')
          .update({ meter_reading: d.overrideValue })
          .eq('id', d.readingId)
          .eq('type', 'close')
        return { error: error?.message }
      }
      if (d.readingType === 'dip') {
        const { error } = await supabase
          .from('dip_readings')
          .update({ litres: d.overrideValue })
          .eq('id', d.readingId)
          .eq('type', 'close')
        return { error: error?.message }
      }
      if (d.readingType === 'dry_stock_line') {
        const { error } = await supabase
          .from('pos_dry_stock_lines')
          .update({ [d.fieldName!]: d.overrideValue })
          .eq('id', d.readingId)
        return { error: error?.message }
      }
      if (d.readingType === 'stock_reading') {
        const { error } = await supabase
          .from('stock_readings')
          .update({ closing_count: d.overrideValue })
          .eq('id', d.readingId)
        return { error: error?.message }
      }
      // pos_line
      const { error } = await supabase
        .from('pos_submission_lines')
        .update({ [d.fieldName!]: d.overrideValue })
        .eq('id', d.readingId)
      return { error: error?.message }
    },

    async insertAuditRecord(id, d) {
      const { error } = await supabase.from('ocr_overrides').insert({
        shift_id:       id,
        reading_id:     d.readingId,
        reading_type:   d.readingType,
        field_name:     d.fieldName,
        original_value: d.originalValue,
        override_value: d.overrideValue,
        reason:         d.reason,
        overridden_by:  d.overriddenBy,
      })
      return { error: error?.message }
    },

    async setManualEntry(id) {
      const { error } = await supabase
        .from('shifts')
        .update({ has_manual_entry: true })
        .eq('id', id)
      return { error: error?.message }
    },
  }

  return runShiftOverrideWith(shiftId, data, repo, runReconciliation)
}

// ── runShiftSplit ──────────────────────────────────────────────────────────────

export interface ShiftSplitBundle {
  id:            string
  station_id:    string
  period:        ShiftPeriod
  shift_date:    string
  supervisor_id: string
  status:        ShiftStatus
  part:          number
}

export interface ShiftSplitRepository {
  loadSplitBundle(shiftId: string): Promise<ShiftSplitBundle | null>
  closePart1(shiftId: string, now: string): Promise<{ error?: string }>
  createPart2(fields: Omit<ShiftSplitBundle, 'id' | 'status'>, now: string): Promise<{ id: string } | { error: string }>
}

export async function runShiftSplitWith(
  shiftId:   string,
  repo:      ShiftSplitRepository,
  reconcile: Reconcile,
): Promise<{ error: string } | { part2ShiftId: string; warning?: string }> {
  const bundle = await repo.loadSplitBundle(shiftId)
  if (!bundle) return { error: 'Shift not found' }

  if (!canSplitShift(bundle)) return { error: 'Shift cannot be split in its current state' }

  const now = new Date().toISOString()

  const closeErr = await repo.closePart1(shiftId, now)
  if (closeErr.error) return { error: closeErr.error }

  const { error: reconcileErr } = await reconcile(shiftId)
  const warning = reconcileErr
    ? `Shift closed but reconciliation failed: ${reconcileErr}`
    : undefined

  const part2 = await repo.createPart2(
    {
      station_id:    bundle.station_id,
      period:        bundle.period,
      shift_date:    bundle.shift_date,
      supervisor_id: bundle.supervisor_id,
      part:          2,
    },
    now,
  )
  if ('error' in part2) return { error: part2.error }

  return { part2ShiftId: part2.id, ...(warning ? { warning } : {}) }
}

export async function runShiftSplit(shiftId: string): Promise<{ error: string } | { part2ShiftId: string; warning?: string }> {
  const { runReconciliation } = await import('@/lib/reconciliation-runner')
  const supabase = await createClient()

  const repo: ShiftSplitRepository = {
    async loadSplitBundle(id) {
      const { data: shift } = await supabase
        .from('shifts')
        .select('id,station_id,period,shift_date,supervisor_id,status,part')
        .eq('id', id)
        .single()
      if (!shift) return null
      return shift as ShiftSplitBundle
    },

    async closePart1(id, now) {
      const { error } = await supabase
        .from('shifts')
        .update({ part: 1, shift_type: 'price_change', status: 'closed', submitted_at: now })
        .eq('id', id)
      return { error: error?.message }
    },

    async createPart2(fields, now) {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          station_id:    fields.station_id,
          period:        fields.period,
          shift_date:    fields.shift_date,
          supervisor_id: fields.supervisor_id,
          part:          2,
          shift_type:    'price_change',
          status:        'pending',
          started_at:    now,
        })
        .select('id')
        .single()
      if (error) return { error: error.message }
      return { id: data.id }
    },
  }

  return runShiftSplitWith(shiftId, repo, runReconciliation)
}

export async function runShiftClose(shiftId: string): Promise<WorkflowResult> {
  const { runReconciliation } = await import('@/lib/reconciliation-runner')
  const { getCashierSubmissionState } = await import('@/lib/cashier-submission')
  const supabase = await createClient()

  const repo: ShiftCloseRepository = {
    async loadCloseBundle(id) {
      const { data: shift } = await supabase
        .from('shifts')
        .select('station_id,status,part,started_at')
        .eq('id', id)
        .single()
      if (!shift) return null

      const [
        { data: pumps },
        { data: closePumps },
        { data: tanks },
        { data: closeDips },
        { data: prices },
        cashierState,
      ] = await Promise.all([
        supabase.from('pumps').select('id').eq('station_id', shift.station_id),
        supabase.from('pump_readings').select('pump_id').eq('shift_id', id).eq('type', 'close'),
        supabase.from('tanks').select('id').eq('station_id', shift.station_id),
        supabase.from('dip_readings').select('tank_id').eq('shift_id', id).eq('type', 'close'),
        supabase.from('fuel_prices').select('valid_from').eq('station_id', shift.station_id),
        getCashierSubmissionState(id),
      ])

      return {
        shift: {
          station_id: shift.station_id,
          status:     shift.status as ShiftStatus,
          part:       shift.part,
          started_at: shift.started_at,
        },
        cashierSubmitted: cashierState.submitted,
        pumpIds:          (pumps ?? []).map(p => p.id),
        closedPumpIds:    (closePumps ?? []).map(r => r.pump_id),
        tankIds:          (tanks ?? []).map(t => t.id),
        closedTankIds:    (closeDips ?? []).map(r => r.tank_id),
        priceWindows:     prices ?? [],
      }
    },

    async closeShift(id, update) {
      const { error } = await supabase
        .from('shifts')
        .update({
          status:       'closed',
          submitted_at: update.submitted_at,
          ...(update.is_flagged   !== undefined ? { is_flagged:   update.is_flagged }   : {}),
          ...(update.flag_comment !== undefined ? { flag_comment: update.flag_comment } : {}),
        })
        .eq('id', id)
      return { error: error?.message }
    },
  }

  return runShiftCloseWith(shiftId, repo, runReconciliation)
}
