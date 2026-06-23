import { describe, it, expect } from 'vitest'
import {
  buildStationDayStatus,
  buildFinancialLines,
  isReportPartial,
  countPendingShiftsPerStation,
  pickLatestClosedShiftPerStation,
  buildStationInventoryLines,
  buildOwnerDashboardStations,
} from '../lib/owner-reports'
import type { ShiftStatus } from '../lib/owner-reports'

// --- fixtures ---
const shift = (period: 'morning' | 'evening', status: string, part = 0) =>
  ({ period, status, part }) as { period: 'morning' | 'evening'; status: ShiftStatus; part: 0 | 1 | 2 }
const posLine = (fuel_grade_id: string, litres_sold: number, revenue_zar: number) => ({ fuel_grade_id, litres_sold, revenue_zar })
const price = (fuel_grade_id: string, sell_price_per_litre: number) => ({ fuel_grade_id, sell_price_per_litre })

// ── buildStationDayStatus ──────────────────────────────────────────────────

describe('buildStationDayStatus', () => {
  it('returns not_started for morning and a single not_started evening entry when no shifts exist', () => {
    const result = buildStationDayStatus([])
    expect(result.morning).toBe('not_started')
    expect(result.evening).toHaveLength(1)
    expect(result.evening[0]).toEqual({ part: 0, status: 'not_started', label: 'Evening' })
  })

  it('tracer bullet: standard evening shift returns a single evening entry labelled Evening', () => {
    const result = buildStationDayStatus([shift('evening', 'closed')])
    expect(result.evening).toHaveLength(1)
    expect(result.evening[0]).toEqual({ part: 0, status: 'closed', label: 'Evening' })
  })

  it('morning status is unaffected by evening shift', () => {
    const result = buildStationDayStatus([shift('morning', 'submitted')])
    expect(result.morning).toBe('submitted')
    expect(result.evening[0].status).toBe('not_started')
  })

  it('split night: Part 1 closed and Part 2 pending produce two evening entries with correct labels', () => {
    const result = buildStationDayStatus([
      shift('morning', 'closed'),
      shift('evening', 'closed', 1),
      shift('evening', 'pending', 2),
    ])
    expect(result.morning).toBe('closed')
    expect(result.evening).toHaveLength(2)
    expect(result.evening[0]).toEqual({ part: 1, status: 'closed',  label: 'Evening Part 1' })
    expect(result.evening[1]).toEqual({ part: 2, status: 'pending', label: 'Evening Part 2' })
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

  it('uses 0 sell_price_per_litre when grade has no price entry', () => {
    const result = buildFinancialLines(
      [posLine('93', 500, 8000)],
      [],
    )
    expect(result.lines[0].sell_price_per_litre).toBe(0)
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

// ── pickLatestClosedShiftPerStation ───────────────────────────────────────

describe('pickLatestClosedShiftPerStation', () => {
  it('picks the only closed shift for a station', () => {
    const result = pickLatestClosedShiftPerStation([
      { id: 'shift-1', station_id: 'station-1', shift_date: '2026-06-20', period: 'morning' },
    ])
    expect(result['station-1']).toBe('shift-1')
  })

  it('evening beats morning on the same date', () => {
    const result = pickLatestClosedShiftPerStation([
      { id: 'morning-shift', station_id: 'station-1', shift_date: '2026-06-20', period: 'morning' },
      { id: 'evening-shift', station_id: 'station-1', shift_date: '2026-06-20', period: 'evening' },
    ])
    expect(result['station-1']).toBe('evening-shift')
  })

  it('a later date beats an earlier date regardless of period', () => {
    const result = pickLatestClosedShiftPerStation([
      { id: 'old-evening', station_id: 'station-1', shift_date: '2026-06-19', period: 'evening' },
      { id: 'new-morning', station_id: 'station-1', shift_date: '2026-06-20', period: 'morning' },
    ])
    expect(result['station-1']).toBe('new-morning')
  })

  it('tracks stations independently', () => {
    const result = pickLatestClosedShiftPerStation([
      { id: 'shift-a', station_id: 'station-1', shift_date: '2026-06-20', period: 'morning' },
      { id: 'shift-b', station_id: 'station-2', shift_date: '2026-06-19', period: 'evening' },
    ])
    expect(result['station-1']).toBe('shift-a')
    expect(result['station-2']).toBe('shift-b')
  })

  it('returns an empty object for no closed shifts', () => {
    expect(pickLatestClosedShiftPerStation([])).toEqual({})
  })
})

// ── buildStationInventoryLines ────────────────────────────────────────────

describe('buildStationInventoryLines', () => {
  const stations = [{ id: 'station-1', name: 'Elegant Amaglug' }]
  const grades = [{ id: '95', label: 'Petrol 95' }, { id: 'D50', label: 'Diesel 50' }]
  const prices = [
    { station_id: 'station-1', fuel_grade_id: '95', cost_per_litre: 14.00 },
    { station_id: 'station-1', fuel_grade_id: 'D50', cost_per_litre: 16.00 },
  ]

  it('builds inventory lines from dip readings, joined to grade labels and prices', () => {
    const result = buildStationInventoryLines(
      stations,
      { 'station-1': 'shift-1' },
      [{ shift_id: 'shift-1', litres: 10000, tanks: { fuel_grade_id: '95' } }],
      prices,
      grades,
    )
    expect(result['station-1']).toHaveLength(1)
    expect(result['station-1'][0]).toEqual({
      gradeId: '95', gradeLabel: 'Petrol 95', litres: 10000, costPerLitre: 14.00, valueZar: 140000,
    })
  })

  it('sums litres across multiple tanks of the same grade', () => {
    const result = buildStationInventoryLines(
      stations,
      { 'station-1': 'shift-1' },
      [
        { shift_id: 'shift-1', litres: 6000, tanks: { fuel_grade_id: '95' } },
        { shift_id: 'shift-1', litres: 4000, tanks: { fuel_grade_id: '95' } },
      ],
      prices,
      grades,
    )
    expect(result['station-1'][0].litres).toBe(10000)
  })

  it('ignores dip readings for shifts other than the latest closed one', () => {
    const result = buildStationInventoryLines(
      stations,
      { 'station-1': 'shift-2' },
      [{ shift_id: 'shift-1', litres: 10000, tanks: { fuel_grade_id: '95' } }],
      prices,
      grades,
    )
    expect(result['station-1']).toEqual([])
  })

  it('handles the Supabase nested-select array shape for tanks', () => {
    const result = buildStationInventoryLines(
      stations,
      { 'station-1': 'shift-1' },
      [{ shift_id: 'shift-1', litres: 10000, tanks: [{ fuel_grade_id: '95' }] }],
      prices,
      grades,
    )
    expect(result['station-1'][0].gradeId).toBe('95')
  })

  it('skips stations with no latest closed shift', () => {
    const result = buildStationInventoryLines(stations, {}, [], prices, grades)
    expect(result['station-1']).toBeUndefined()
  })

  it('sorts lines by grade id', () => {
    const result = buildStationInventoryLines(
      stations,
      { 'station-1': 'shift-1' },
      [
        { shift_id: 'shift-1', litres: 5000, tanks: { fuel_grade_id: 'D50' } },
        { shift_id: 'shift-1', litres: 5000, tanks: { fuel_grade_id: '95' } },
      ],
      prices,
      grades,
    )
    expect(result['station-1'].map(l => l.gradeId)).toEqual(['95', 'D50'])
  })
})

// ── buildOwnerDashboardStations ────────────────────────────────────────────

describe('buildOwnerDashboardStations', () => {
  const stations = [{ id: 'station-1', name: 'Elegant Amaglug' }]

  it('combines pending count, flagged shifts, and inventory for a station', () => {
    const todayShifts = [
      { id: 'shift-1', station_id: 'station-1', period: 'morning', is_flagged: true, flag_comment: 'Tank var', status: 'closed' },
      { id: 'shift-2', station_id: 'station-1', period: 'evening', is_flagged: false, flag_comment: null, status: 'pending' },
    ]
    const inventory = { 'station-1': [{ gradeId: '95', gradeLabel: 'Petrol 95', litres: 1000, costPerLitre: 14, valueZar: 14000 }] }

    const result = buildOwnerDashboardStations(stations, todayShifts, inventory)
    expect(result).toHaveLength(1)
    expect(result[0].pendingCount).toBe(1)
    expect(result[0].flaggedShifts).toHaveLength(1)
    expect(result[0].flaggedShifts[0].id).toBe('shift-1')
    expect(result[0].inventory).toEqual(inventory['station-1'])
  })

  it('returns null inventory for a station with no snapshot', () => {
    const result = buildOwnerDashboardStations(stations, [], {})
    expect(result[0].inventory).toBeNull()
  })

  it('returns zero pending count and no flagged shifts when station has none today', () => {
    const result = buildOwnerDashboardStations(stations, [], {})
    expect(result[0].pendingCount).toBe(0)
    expect(result[0].flaggedShifts).toHaveLength(0)
  })
})
