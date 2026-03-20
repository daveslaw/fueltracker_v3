import type { ShiftStatus } from '@/lib/shift-open'

export type CloseProgress = {
  pumps: { done: number; total: number }
  tanks: { done: number; total: number }
  pos: boolean
  isReadyForPos: boolean  // all close pump + dip readings complete
  isComplete: boolean     // isReadyForPos + POS submitted
}

// ── getCloseProgress ──────────────────────────────────────────────────────────

export function getCloseProgress(
  pumpIds: string[],
  completedClosePumpIds: string[],
  tankIds: string[],
  completedCloseTankIds: string[],
  hasPosSubmission: boolean
): CloseProgress {
  const pumpsDone = pumpIds.filter((id) => completedClosePumpIds.includes(id)).length
  const tanksDone = tankIds.filter((id) => completedCloseTankIds.includes(id)).length

  const isReadyForPos = pumpsDone === pumpIds.length && tanksDone === tankIds.length
  const isComplete = isReadyForPos && hasPosSubmission

  return {
    pumps: { done: pumpsDone, total: pumpIds.length },
    tanks: { done: tanksDone, total: tankIds.length },
    pos: hasPosSubmission,
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
  return progress.isReadyForPos ? 'pending_pos' : 'open'
}
