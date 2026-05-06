import type { ShiftStatus } from '@/lib/shift-open'

export type CloseProgress = {
  pumps: { done: number; total: number }
  tanks: { done: number; total: number }
  pos: boolean
  cashierPos: boolean     // cashier POS track: Z-report submitted by cashier
  dryStock: boolean       // cashier dry stock track: closing count submitted
  isReadyForPos: boolean  // all close pump + dip readings complete
  isComplete: boolean     // isReadyForPos + cashierPos + dryStock
}

// ── getCloseProgress ──────────────────────────────────────────────────────────

export function getCloseProgress(
  pumpIds: string[],
  completedClosePumpIds: string[],
  tankIds: string[],
  completedCloseTankIds: string[],
  hasCashierPosSubmission: boolean,
  hasDryStockComplete: boolean,
): CloseProgress {
  const pumpsDone = pumpIds.filter((id) => completedClosePumpIds.includes(id)).length
  const tanksDone = tankIds.filter((id) => completedCloseTankIds.includes(id)).length

  const isReadyForPos = pumpsDone === pumpIds.length && tanksDone === tankIds.length
  const isComplete = isReadyForPos && hasCashierPosSubmission && hasDryStockComplete

  return {
    pumps: { done: pumpsDone, total: pumpIds.length },
    tanks: { done: tanksDone, total: tankIds.length },
    pos: hasCashierPosSubmission,
    cashierPos: hasCashierPosSubmission,
    dryStock: hasDryStockComplete,
    isReadyForPos,
    isComplete,
  }
}

// ── resolveCloseStatus ────────────────────────────────────────────────────────

/**
 * Returns the shift status the system should auto-set based on close progress.
 * The `submitted` transition is always explicit (via submitShift action).
 */
export function resolveCloseStatus(
  progress: Pick<CloseProgress, 'isReadyForPos' | 'isComplete' | 'pos'>
): ShiftStatus {
  return progress.isComplete ? 'closed' : 'pending'
}

// ── canSubmit ─────────────────────────────────────────────────────────────────

const SUBMITTABLE_FROM = new Set<ShiftStatus>(['pending'])

/**
 * Guards the submit transition.
 * Shift must be in 'pending' and the cashier POS track must be complete.
 */
export function canSubmit(status: ShiftStatus, cashierPosComplete: boolean, dryStockComplete: boolean): boolean {
  return SUBMITTABLE_FROM.has(status) && cashierPosComplete && dryStockComplete
}
