import type { ShiftStatus } from './owner-reports'

export interface DayVarianceRow {
  date: string  // YYYY-MM-DD
  morningStatus: ShiftStatus | 'not_started'
  eveningStatus: ShiftStatus | 'not_started'
  tankVarianceLitres: number
  gradeVarianceLitres: number
  revenueVarianceZar: number
}

export interface WeeklyReport {
  isoWeek: string   // e.g. '2025-W12'
  stationId: string
  rows: DayVarianceRow[]
}

export interface MonthlyReport {
  month: string     // e.g. '2025-03'
  stationId: string
  rows: DayVarianceRow[]
  totals: {
    tankVarianceLitres: number
    gradeVarianceLitres: number
    revenueVarianceZar: number
  }
}

export interface RawShift {
  id: string
  shift_date: string
  period: string
  status: ShiftStatus
}

export interface RawReconciliation {
  shift_id: string
  reconciliation_tank_lines: Array<{ variance_litres: number }>
  reconciliation_pump_lines: Array<{ variance_litres: number; variance_zar: number }>
}

// ── ISO week helpers ──────────────────────────────────────────────────────

/** Returns the ISO week string (YYYY-Www) for a given YYYY-MM-DD date string. */
export function getISOWeekString(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  // ISO week: Thursday of the week determines the year
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const year = thu.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const week = 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Converts an ISO week string (YYYY-Www) to its Monday–Sunday date range. Returns null if malformed. */
export function isoWeekToDateRange(isoWeek: string): { startDate: string; endDate: string } | null {
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1])
  const weekNum = parseInt(m[2])
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNum - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  return {
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: weekEnd.toISOString().slice(0, 10),
  }
}

/** Converts a calendar month string (YYYY-MM) to its first/last date range. */
export function monthToDateRange(month: string): { startDate: string; endDate: string } {
  const [year, m] = month.split('-').map(Number)
  return {
    startDate: `${month}-01`,
    endDate: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10),
  }
}

// ── buildDayVarianceRows ──────────────────────────────────────────────────

/**
 * Assembles per-day variance rows from raw shift + reconciliation rows.
 * Tank variance comes from reconciliation_tank_lines (Formula 1); grade/revenue
 * variance is summed across reconciliation_pump_lines (Formula 2) since grade
 * totals are no longer stored separately (see migration 20260525000004).
 */
function buildDayVarianceRows(shifts: RawShift[], recs: RawReconciliation[]): DayVarianceRow[] {
  const dates = new Set(shifts.map(s => s.shift_date))

  return [...dates].map(date => {
    const dayShifts = shifts.filter(s => s.shift_date === date)

    let tankVar = 0, gradeVar = 0, revenueVar = 0
    for (const s of dayShifts) {
      const rec = recs.find(r => r.shift_id === s.id)
      if (!rec) continue
      tankVar    += (rec.reconciliation_tank_lines ?? []).reduce((sum, l) => sum + l.variance_litres, 0)
      gradeVar   += (rec.reconciliation_pump_lines ?? []).reduce((sum, l) => sum + l.variance_litres, 0)
      revenueVar += (rec.reconciliation_pump_lines ?? []).reduce((sum, l) => sum + (l.variance_zar ?? 0), 0)
    }

    return {
      date,
      morningStatus: (dayShifts.find(s => s.period === 'morning')?.status ?? 'not_started') as ShiftStatus | 'not_started',
      eveningStatus: (dayShifts.find(s => s.period === 'evening')?.status ?? 'not_started') as ShiftStatus | 'not_started',
      tankVarianceLitres:  Math.round(tankVar    * 100) / 100,
      gradeVarianceLitres: Math.round(gradeVar   * 100) / 100,
      revenueVarianceZar:  Math.round(revenueVar * 100) / 100,
    }
  })
}

// ── buildWeeklyReport ─────────────────────────────────────────────────────

export function buildWeeklyReport(
  shifts: RawShift[],
  recs: RawReconciliation[],
  isoWeek: string,
  stationId: string,
): WeeklyReport {
  const rows = buildDayVarianceRows(shifts, recs)
    .filter(d => getISOWeekString(d.date) === isoWeek)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { isoWeek, stationId, rows }
}

// ── buildMonthlyReport ────────────────────────────────────────────────────

export function buildMonthlyReport(
  shifts: RawShift[],
  recs: RawReconciliation[],
  month: string,
  stationId: string,
): MonthlyReport {
  const rows = buildDayVarianceRows(shifts, recs)
    .filter(d => d.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totals = rows.reduce(
    (acc, r) => ({
      tankVarianceLitres:  Math.round((acc.tankVarianceLitres  + r.tankVarianceLitres)  * 100) / 100,
      gradeVarianceLitres: Math.round((acc.gradeVarianceLitres + r.gradeVarianceLitres) * 100) / 100,
      revenueVarianceZar:  Math.round((acc.revenueVarianceZar  + r.revenueVarianceZar)  * 100) / 100,
    }),
    { tankVarianceLitres: 0, gradeVarianceLitres: 0, revenueVarianceZar: 0 },
  )

  return { month, stationId, rows, totals }
}
