import { describe, it, expect } from 'vitest'
import {
  buildStationDayStatus,
  buildFinancialLines,
  isReportPartial,
  countPendingShiftsPerStation,
} from '../lib/owner-reports'

// --- fixtures ---
const shift = (period: 'morning' | 'evening', status: string) => ({ period, status }) as { period: 'morning' | 'evening'; status: import('../lib/owner-reports').ShiftStatus }
const posLine = (fuel_grade_id: string, litres_sold: number, revenue_zar: number) => ({ fuel_grade_id, litres_sold, revenue_zar })
const price = (fuel_grade_id: string, price_per_litre: number) => ({ fuel_grade_id, price_per_litre })

// ── buildStationDayStatus ──────────────────────────────────────────────────

describe('buildStationDayStatus', () => {
  it('returns not_started for both periods when no shifts exist', () => {
    const result = buildStationDayStatus([])
    expect(result.morning).toBe('not_started')
    expect(result.evening).toBe('not_started')
  })

  it('reflects the status of the matching period shift', () => {
    const result = buildStationDayStatus([shift('morning', 'submitted')])
    expect(result.morning).toBe('submitted')
    expect(result.evening).toBe('not_started')
  })

  it('handles both periods present', () => {
    const result = buildStationDayStatus([
      shift('morning', 'approved'),
      shift('evening', 'flagged'),
    ])
    expect(result.morning).toBe('approved')
    expect(result.evening).toBe('flagged')
  })
})

// ── buildFinancialLines ──────────────────────────────────────────────────

describe('buildFinancialLines', () => {
  it('computes expected revenue, pos revenue, and variance for a single grade', () => {
    const result = buildFinancialLines(
      [posLine('95', 2000, 33000)],
      [price('95', 17.00)],
    )
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].expected_revenue_zar).toBe(34000)
    expect(result.lines[0].pos_revenue_zar).toBe(33000)
    expect(result.lines[0].variance_zar).toBe(1000)
  })

  it('sums totals across multiple grades', () => {
    const result = buildFinancialLines(
      [posLine('95', 1000, 17000), posLine('D50', 500, 9000)],
      [price('95', 17.00), price('D50', 19.00)],
    )
    // 95: expected=17000, pos=17000, var=0
    // D50: expected=9500, pos=9000, var=500
    expect(result.totals.expected_revenue_zar).toBe(26500)
    expect(result.totals.pos_revenue_zar).toBe(26000)
    expect(result.totals.variance_zar).toBe(500)
  })

  it('uses 0 price_per_litre when grade has no price entry', () => {
    const result = buildFinancialLines(
      [posLine('93', 500, 8000)],
      [],
    )
    expect(result.lines[0].price_per_litre).toBe(0)
    expect(result.lines[0].expected_revenue_zar).toBe(0)
    expect(result.lines[0].variance_zar).toBe(-8000)
  })

  it('returns empty lines and zero totals for empty posLines', () => {
    const result = buildFinancialLines([], [price('95', 17)])
    expect(result.lines).toHaveLength(0)
    expect(result.totals.expected_revenue_zar).toBe(0)
    expect(result.totals.variance_zar).toBe(0)
  })
})

// ── countPendingShiftsPerStation ──────────────────────────────────────────

describe('countPendingShiftsPerStation', () => {
  it('tracer bullet: one pending shift → count of 1 for its station', () => {
    const shifts = [{ station_id: 'station-1', status: 'pending' as const }]
    const counts = countPendingShiftsPerStation(shifts)
    expect(counts['station-1']).toBe(1)
  })

  it('no shifts → empty object', () => {
    expect(countPendingShiftsPerStation([])).toEqual({})
  })

  it('closed shift is not counted', () => {
    const shifts = [{ station_id: 'station-1', status: 'closed' as const }]
    const counts = countPendingShiftsPerStation(shifts)
    expect(counts['station-1']).toBeUndefined()
  })

  it('two pending shifts at the same station → count of 2', () => {
    const shifts = [
      { station_id: 'station-1', status: 'pending' as const },
      { station_id: 'station-1', status: 'pending' as const },
    ]
    expect(countPendingShiftsPerStation(shifts)['station-1']).toBe(2)
  })

  it('pending shifts at different stations are counted independently', () => {
    const shifts = [
      { station_id: 'station-1', status: 'pending' as const },
      { station_id: 'station-2', status: 'pending' as const },
      { station_id: 'station-2', status: 'closed' as const },
    ]
    const counts = countPendingShiftsPerStation(shifts)
    expect(counts['station-1']).toBe(1)
    expect(counts['station-2']).toBe(1)
  })
})

// ── isReportPartial ──────────────────────────────────────────────────────

describe('isReportPartial', () => {
  it('returns false for complete statuses', () => {
    expect(isReportPartial('submitted')).toBe(false)
    expect(isReportPartial('approved')).toBe(false)
    expect(isReportPartial('flagged')).toBe(false)
  })

  it('returns true for in-progress statuses', () => {
    expect(isReportPartial('draft')).toBe(true)
    expect(isReportPartial('open')).toBe(true)
    expect(isReportPartial('pending_pos')).toBe(true)
  })

  it('returns true when shift has not started', () => {
    expect(isReportPartial('not_started')).toBe(true)
  })
})
