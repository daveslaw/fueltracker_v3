import { createClient } from '@/lib/supabase/server'
import { getCashierProgress } from '@/lib/cashier-progress'
import type { CashierProgress, CashierProgressInput } from '@/lib/cashier-progress'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CashierSubmissionState =
  | { submitted: false; progress: CashierProgress }
  | { submitted: true; submittedAt: string }

// ── Pure helper (exported for testing) ───────────────────────────────────────

export function buildCashierSubmissionState(
  cashierSubmittedAt: string | null,
  progressInput: CashierProgressInput,
): CashierSubmissionState {
  if (cashierSubmittedAt) return { submitted: true, submittedAt: cashierSubmittedAt }
  return { submitted: false, progress: getCashierProgress(progressInput) }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCashierSubmissionState(shiftId: string): Promise<CashierSubmissionState> {
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('cashier_submitted_at, station_id')
    .eq('id', shiftId)
    .single()

  if (!shift) throw new Error(`Shift ${shiftId} not found`)

  if (shift.cashier_submitted_at) {
    return { submitted: true, submittedAt: shift.cashier_submitted_at }
  }

  const [
    { data: fuelPos },
    { data: dryStockPos },
    { count: stockReadingCount },
    { count: activeProductCount },
  ] = await Promise.all([
    supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).limit(1),
    supabase.from('dry_stock_pos_submissions').select('id').eq('shift_id', shiftId).limit(1),
    supabase.from('stock_readings').select('id', { count: 'exact', head: true }).eq('shift_id', shiftId),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('station_id', shift.station_id).eq('is_active', true),
  ])

  return buildCashierSubmissionState(null, {
    hasFuelPosSubmission:     (fuelPos?.length ?? 0) > 0,
    hasDryStockPosSubmission: (dryStockPos?.length ?? 0) > 0,
    activeProductCount:       activeProductCount ?? 0,
    stockReadingCount:        stockReadingCount ?? 0,
  })
}
