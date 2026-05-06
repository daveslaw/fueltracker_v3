export type ShiftPeriod = 'morning' | 'evening'
export type ShiftStatus = 'draft' | 'open' | 'pending_pos' | 'submitted' | 'approved' | 'flagged' | 'pending' | 'closed'
export type ShiftPart = 0 | 1 | 2

export type ShiftRow = {
  station_id: string
  period: ShiftPeriod
  shift_date: string
  status: ShiftStatus
  part: ShiftPart
}

export type ShiftProgress = {
  pumps: { done: number; total: number }
  tanks: { done: number; total: number }
  isComplete: boolean
}

// Statuses that block creating a new slot for the same (station, period, date, part)
const BLOCKING_STATUSES: ShiftStatus[] = ['pending', 'closed']

// ── canStartShift ─────────────────────────────────────────────────────────────

export function canStartShift(
  existing: ShiftRow[],
  stationId: string,
  period: ShiftPeriod,
  shiftDate: string,
  part: ShiftPart = 0
): boolean {
  return !existing.some(
    (s) =>
      s.station_id === stationId &&
      s.period === period &&
      s.shift_date === shiftDate &&
      s.part === part &&
      (BLOCKING_STATUSES as string[]).includes(s.status)
  )
}

// ── markFirstPartSplit ────────────────────────────────────────────────────────

export function markFirstPartSplit(
  shifts: ShiftRow[],
  stationId: string,
  period: ShiftPeriod,
  shiftDate: string
): ShiftRow[] {
  return shifts.map((s) => {
    if (
      s.station_id === stationId &&
      s.period === period &&
      s.shift_date === shiftDate &&
      s.part === 0
    ) {
      return { ...s, part: 1 as ShiftPart }
    }
    return s
  })
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

// ── computeShiftLabel ─────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<ShiftPeriod, string> = {
  morning: 'Morning',
  evening: 'Evening',
}

export function computeShiftLabel(period: ShiftPeriod, part: ShiftPart): string {
  const base = PERIOD_LABEL[period]
  return part === 0 ? base : `${base} Part ${part}`
}
