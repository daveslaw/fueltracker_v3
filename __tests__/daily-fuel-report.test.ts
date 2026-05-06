import { describe, it, expect } from 'vitest'
import { buildDailyFuelReport } from '@/lib/owner-reports'
import type { DailyFuelGradeInput } from '@/lib/owner-reports'

function makeRow(overrides: Partial<DailyFuelGradeInput> = {}): DailyFuelGradeInput {
  return {
    date:              '2026-05-01',
    fuel_grade_id:     '95',
    opening_dip:       20000,
    deliveries_litres: 0,
    delivery_note:     null,
    driver_name:       null,
    pos_litres:        1000,
    variance_litres:   -50,
    cost_per_litre:    14.00,
    sell_price_per_litre: 17.00,
    ...overrides,
  }
}

// ── GP calculation ────────────────────────────────────────────────────────────

describe('buildDailyFuelReport — GP calculation', () => {
  it('tracer bullet: computes GP as (sell_price - cost_price) * litres_sold', () => {
    const rows = buildDailyFuelReport([makeRow({ pos_litres: 1000, sell_price_per_litre: 17.00, cost_per_litre: 14.00 })])
    expect(rows[0].gp_zar).toBeCloseTo(3000, 2)
  })

  it('GP is zero when sell_price equals cost_price', () => {
    const rows = buildDailyFuelReport([makeRow({ pos_litres: 500, sell_price_per_litre: 15.00, cost_per_litre: 15.00 })])
    expect(rows[0].gp_zar).toBe(0)
  })

  it('GP reflects negative margin when cost exceeds sell price', () => {
    const rows = buildDailyFuelReport([makeRow({ pos_litres: 200, sell_price_per_litre: 14.00, cost_per_litre: 15.00 })])
    expect(rows[0].gp_zar).toBeCloseTo(-200, 2)
  })
})

// ── Accumulated variance ──────────────────────────────────────────────────────

describe('buildDailyFuelReport — accumulated variance', () => {
  it('first day accumulated_variance equals its own variance_litres', () => {
    const rows = buildDailyFuelReport([makeRow({ variance_litres: -50 })])
    expect(rows[0].accumulated_variance).toBe(-50)
  })

  it('accumulated variance rolls forward day-by-day', () => {
    const inputs: DailyFuelGradeInput[] = [
      makeRow({ date: '2026-05-01', fuel_grade_id: '95', variance_litres: -50 }),
      makeRow({ date: '2026-05-02', fuel_grade_id: '95', variance_litres: -30 }),
      makeRow({ date: '2026-05-03', fuel_grade_id: '95', variance_litres:  20 }),
    ]
    const rows = buildDailyFuelReport(inputs)
    expect(rows[0].accumulated_variance).toBe(-50)
    expect(rows[1].accumulated_variance).toBe(-80)
    expect(rows[2].accumulated_variance).toBe(-60)
  })

  it('accumulated variance is tracked independently per grade', () => {
    const inputs: DailyFuelGradeInput[] = [
      makeRow({ date: '2026-05-01', fuel_grade_id: '95',  variance_litres: -50 }),
      makeRow({ date: '2026-05-01', fuel_grade_id: 'D50', variance_litres: -10 }),
      makeRow({ date: '2026-05-02', fuel_grade_id: '95',  variance_litres: -30 }),
      makeRow({ date: '2026-05-02', fuel_grade_id: 'D50', variance_litres:   5 }),
    ]
    const rows = buildDailyFuelReport(inputs)
    const find = (date: string, grade: string) =>
      rows.find(r => r.date === date && r.fuel_grade_id === grade)!

    expect(find('2026-05-01', '95').accumulated_variance).toBe(-50)
    expect(find('2026-05-02', '95').accumulated_variance).toBe(-80)
    expect(find('2026-05-01', 'D50').accumulated_variance).toBe(-10)
    expect(find('2026-05-02', 'D50').accumulated_variance).toBe(-5)
  })
})

// ── Zero-delivery day ─────────────────────────────────────────────────────────

describe('buildDailyFuelReport — zero-delivery day', () => {
  it('preserves null delivery_note and driver_name when no delivery occurred', () => {
    const rows = buildDailyFuelReport([makeRow({ deliveries_litres: 0, delivery_note: null, driver_name: null })])
    expect(rows[0].delivery_note).toBeNull()
    expect(rows[0].driver_name).toBeNull()
  })

  it('preserves delivery metadata when a delivery occurred', () => {
    const rows = buildDailyFuelReport([makeRow({ deliveries_litres: 10000, delivery_note: 'DN-001', driver_name: 'John Doe' })])
    expect(rows[0].delivery_note).toBe('DN-001')
    expect(rows[0].driver_name).toBe('John Doe')
  })
})

// ── Empty input ───────────────────────────────────────────────────────────────

describe('buildDailyFuelReport — edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(buildDailyFuelReport([])).toEqual([])
  })
})
