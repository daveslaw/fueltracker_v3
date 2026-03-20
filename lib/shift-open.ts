export type ShiftPeriod = 'morning' | 'evening'
export type ShiftStatus = 'draft' | 'open' | 'pending_pos' | 'submitted' | 'approved' | 'flagged'

export type ShiftRow = {
  station_id: string
  period: ShiftPeriod
  shift_date: string
  status: ShiftStatus
}

export type ShiftProgress = {
  pumps: { done: number; total: number }
  tanks: { done: number; total: number }
  isComplete: boolean
}

// Statuses that block starting a new shift for the same slot
const BLOCKING_STATUSES: ShiftStatus[] = ['draft', 'open']

// ── canStartShift ─────────────────────────────────────────────────────────────

export function canStartShift(
  existing: ShiftRow[],
  stationId: string,
  period: ShiftPeriod,
  shiftDate: string
): boolean {
  return !existing.some(
    (s) =>
      s.station_id === stationId &&
      s.period === period &&
      s.shift_date === shiftDate &&
      (BLOCKING_STATUSES as string[]).includes(s.status)
  )
}

// ── getShiftProgress ──────────────────────────────────────────────────────────

export function getShiftProgress(
  pumpIds: string[],
  completedPumpIds: string[],
  tankIds: string[],
  completedTankIds: string[]
): ShiftProgress {
  const pumpsDone = pumpIds.filter((id) => completedPumpIds.includes(id)).length
  const tanksDone = tankIds.filter((id) => completedTankIds.includes(id)).length

  return {
    pumps: { done: pumpsDone, total: pumpIds.length },
    tanks: { done: tanksDone, total: tankIds.length },
    isComplete: pumpsDone === pumpIds.length && tanksDone === tankIds.length,
  }
}

// ── resolveShiftStatus ────────────────────────────────────────────────────────

export function resolveShiftStatus(progress: Pick<ShiftProgress, 'isComplete'>): ShiftStatus {
  return progress.isComplete ? 'open' : 'draft'
}
