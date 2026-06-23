import { describe, it, expect } from 'vitest'
import { buildWeeklyReport, buildMonthlyReport, isoWeekToDateRange, monthToDateRange } from '../lib/aggregate-reports'
import type { RawShift, RawReconciliation } from '../lib/aggregate-reports'

// --- fixtures ---
let nextId = 0
function shift(date: string, overrides: Partial<RawShift> = {}): RawShift {
  return {
    id: `shift-${nextId++}`,
    shift_date: date,
    period: 'morning',
    status: 'approved',
    ...overrides,
  }
}
function recFor(s: RawShift, opts: { tank?: number; gradeVariance?: number; revenueVariance?: number } = {}): RawReconciliation {
  return {
    shift_id: s.id,
    reconciliation_tank_lines: opts.tank !== undefined ? [{ variance_litres: opts.tank }] : [],
    reconciliation_pump_lines: (opts.gradeVariance !== undefined || opts.revenueVariance !== undefined)
      ? [{ variance_litres: opts.gradeVariance ?? 0, variance_zar: opts.revenueVariance ?? 0 }]
      : [],
  }
}

// ── buildWeeklyReport ─────────────────────────────────────────────────────

describe('buildWeeklyReport', () => {
  it('filters days to the given ISO week and sorts by date', () => {
    // 2025-W12: Mon 2025-03-17 – Sun 2025-03-23
    const shifts: RawShift[] = [
      shift('2025-03-16'),  // W11 — excluded
      shift('2025-03-17'),  // W12 Monday
      shift('2025-03-19'),  // W12 Wednesday
      shift('2025-03-24'),  // W13 — excluded
    ]
    const result = buildWeeklyReport(shifts, [], '2025-W12', 'station-1')
    expect(result.isoWeek).toBe('2025-W12')
    expect(result.stationId).toBe('station-1')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].date).toBe('2025-03-17')
    expect(result.rows[1].date).toBe('2025-03-19')
  })

  it('returns empty rows when no days fall in the week', () => {
    const result = buildWeeklyReport([shift('2025-03-10')], [], '2025-W12', 'station-1')
    expect(result.rows).toHaveLength(0)
  })

  it('includes all 7 days when every day of the week has data', () => {
    const allWeekDays = ['2025-03-17', '2025-03-18', '2025-03-19', '2025-03-20', '2025-03-21', '2025-03-22', '2025-03-23']
    const result = buildWeeklyReport(allWeekDays.map(d => shift(d)), [], '2025-W12', 'station-1')
    expect(result.rows).toHaveLength(7)
  })

  it('sums tank variance from reconciliation_tank_lines and grade/revenue from reconciliation_pump_lines', () => {
    const s = shift('2025-03-17')
    const rec = recFor(s, { tank: -50, gradeVariance: 10, revenueVariance: -200 })
    const result = buildWeeklyReport([s], [rec], '2025-W12', 'station-1')
    expect(result.rows[0].tankVarianceLitres).toBe(-50)
    expect(result.rows[0].gradeVarianceLitres).toBe(10)
    expect(result.rows[0].revenueVarianceZar).toBe(-200)
  })

  it('sums variance across both shifts on the same day', () => {
    const morning = shift('2025-03-17', { period: 'morning' })
    const evening = shift('2025-03-17', { period: 'evening' })
    const recs = [
      recFor(morning, { tank: -10, gradeVariance: 5, revenueVariance: 100 }),
      recFor(evening, { tank: -15, gradeVariance: 5, revenueVariance: -50 }),
    ]
    const result = buildWeeklyReport([morning, evening], recs, '2025-W12', 'station-1')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].tankVarianceLitres).toBe(-25)
    expect(result.rows[0].gradeVarianceLitres).toBe(10)
    expect(result.rows[0].revenueVarianceZar).toBe(50)
    expect(result.rows[0].morningStatus).toBe('approved')
    expect(result.rows[0].eveningStatus).toBe('approved')
  })
})

// ── buildMonthlyReport ────────────────────────────────────────────────────

describe('buildMonthlyReport', () => {
  it('filters days to the given month and sorts by date', () => {
    const shifts: RawShift[] = [
      shift('2025-02-28'),  // excluded
      shift('2025-03-01'),
      shift('2025-03-15'),
      shift('2025-04-01'),  // excluded
    ]
    const result = buildMonthlyReport(shifts, [], '2025-03', 'station-1')
    expect(result.month).toBe('2025-03')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].date).toBe('2025-03-01')
    expect(result.rows[1].date).toBe('2025-03-15')
  })

  it('computes totals across all rows', () => {
    const s1 = shift('2025-03-01')
    const s2 = shift('2025-03-02')
    const recs = [
      recFor(s1, { tank: 100, gradeVariance: 50, revenueVariance: 1000 }),
      recFor(s2, { tank: -20, gradeVariance: 10, revenueVariance: -500 }),
    ]
    const result = buildMonthlyReport([s1, s2], recs, '2025-03', 'station-1')
    expect(result.totals.tankVarianceLitres).toBe(80)
    expect(result.totals.gradeVarianceLitres).toBe(60)
    expect(result.totals.revenueVarianceZar).toBe(500)
  })

  it('returns zero totals and empty rows for a month with no data', () => {
    const result = buildMonthlyReport([], [], '2025-03', 'station-1')
    expect(result.rows).toHaveLength(0)
    expect(result.totals.tankVarianceLitres).toBe(0)
    expect(result.totals.revenueVarianceZar).toBe(0)
  })
})

// ── isoWeekToDateRange ────────────────────────────────────────────────────

describe('isoWeekToDateRange', () => {
  it('converts an ISO week to its Monday–Sunday range', () => {
    expect(isoWeekToDateRange('2025-W12')).toEqual({ startDate: '2025-03-17', endDate: '2025-03-23' })
  })

  it('returns null for a malformed week string', () => {
    expect(isoWeekToDateRange('not-a-week')).toBeNull()
  })
})

// ── monthToDateRange ──────────────────────────────────────────────────────

describe('monthToDateRange', () => {
  it('converts a month to its first/last date range', () => {
    expect(monthToDateRange('2025-03')).toEqual({ startDate: '2025-03-01', endDate: '2025-03-31' })
  })

  it('handles a leap-year February', () => {
    expect(monthToDateRange('2024-02')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' })
  })
})
