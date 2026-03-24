import { describe, it, expect } from 'vitest'
import { buildWeeklyReport, buildMonthlyReport } from '../lib/aggregate-reports'
import type { DayVarianceRow } from '../lib/aggregate-reports'

// --- fixtures ---
function day(date: string, overrides: Partial<DayVarianceRow> = {}): DayVarianceRow {
  return {
    date,
    morningStatus: 'approved',
    eveningStatus: 'approved',
    tankVarianceLitres: 0,
    gradeVarianceLitres: 0,
    revenueVarianceZar: 0,
    ...overrides,
  }
}

// ── buildWeeklyReport ─────────────────────────────────────────────────────

describe('buildWeeklyReport', () => {
  it('filters days to the given ISO week and sorts by date', () => {
    // 2025-W12: Mon 2025-03-17 – Sun 2025-03-23
    const days: DayVarianceRow[] = [
      day('2025-03-16'),  // W11 — excluded
      day('2025-03-17'),  // W12 Monday
      day('2025-03-19'),  // W12 Wednesday
      day('2025-03-24'),  // W13 — excluded
    ]
    const result = buildWeeklyReport(days, '2025-W12', 'station-1')
    expect(result.isoWeek).toBe('2025-W12')
    expect(result.stationId).toBe('station-1')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].date).toBe('2025-03-17')
    expect(result.rows[1].date).toBe('2025-03-19')
  })

  it('returns empty rows when no days fall in the week', () => {
    const result = buildWeeklyReport([day('2025-03-10')], '2025-W12', 'station-1')
    expect(result.rows).toHaveLength(0)
  })

  it('includes all 7 days when every day of the week has data', () => {
    const allWeekDays = ['2025-03-17', '2025-03-18', '2025-03-19', '2025-03-20', '2025-03-21', '2025-03-22', '2025-03-23']
    const result = buildWeeklyReport(allWeekDays.map(d => day(d)), '2025-W12', 'station-1')
    expect(result.rows).toHaveLength(7)
  })
})

// ── buildMonthlyReport ────────────────────────────────────────────────────

describe('buildMonthlyReport', () => {
  it('filters days to the given month and sorts by date', () => {
    const days: DayVarianceRow[] = [
      day('2025-02-28'),  // excluded
      day('2025-03-01'),
      day('2025-03-15'),
      day('2025-04-01'),  // excluded
    ]
    const result = buildMonthlyReport(days, '2025-03', 'station-1')
    expect(result.month).toBe('2025-03')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].date).toBe('2025-03-01')
    expect(result.rows[1].date).toBe('2025-03-15')
  })

  it('computes totals across all rows', () => {
    const days: DayVarianceRow[] = [
      day('2025-03-01', { tankVarianceLitres: 100, gradeVarianceLitres: 50, revenueVarianceZar: 1000 }),
      day('2025-03-02', { tankVarianceLitres: -20, gradeVarianceLitres: 10, revenueVarianceZar: -500 }),
    ]
    const result = buildMonthlyReport(days, '2025-03', 'station-1')
    expect(result.totals.tankVarianceLitres).toBe(80)
    expect(result.totals.gradeVarianceLitres).toBe(60)
    expect(result.totals.revenueVarianceZar).toBe(500)
  })

  it('returns zero totals and empty rows for a month with no data', () => {
    const result = buildMonthlyReport([], '2025-03', 'station-1')
    expect(result.rows).toHaveLength(0)
    expect(result.totals.tankVarianceLitres).toBe(0)
    expect(result.totals.revenueVarianceZar).toBe(0)
  })
})
