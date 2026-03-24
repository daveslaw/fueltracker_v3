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

// ── ISO week helpers ──────────────────────────────────────────────────────

/** Returns the ISO week string (YYYY-Www) for a given YYYY-MM-DD date string. */
function getISOWeekString(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  // ISO week: Thursday of the week determines the year
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const year = thu.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const week = 1 + Math.round(((thu.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

// ── buildWeeklyReport ─────────────────────────────────────────────────────

export function buildWeeklyReport(
  days: DayVarianceRow[],
  isoWeek: string,
  stationId: string,
): WeeklyReport {
  const rows = days
    .filter(d => getISOWeekString(d.date) === isoWeek)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { isoWeek, stationId, rows }
}

// ── buildMonthlyReport ────────────────────────────────────────────────────

export function buildMonthlyReport(
  days: DayVarianceRow[],
  month: string,
  stationId: string,
): MonthlyReport {
  const rows = days
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
