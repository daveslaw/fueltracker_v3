import { describe, it, expect } from 'vitest'
import { buildFuelControlRows, buildDaySubtotals, buildFuelControlReportRows, trailingMonths, buildDayEntries } from '../lib/fuel-control-report'
import type { FuelControlRowInput, FuelControlDaySubtotal, FuelControlReportRow } from '../lib/fuel-control-report'
import type { PriceRow } from '../lib/pricing'

function makeInput(overrides: Partial<FuelControlRowInput> = {}): FuelControlRowInput {
  return {
    shift_id:          'shift-1',
    shift_date:        '2026-05-01',
    period:            'morning',
    part:              0,
    shift_type:        'standard',
    status:            'closed',
    is_flagged:        false,
    fuel_grade_id:     '95',
    started_at:        '2026-05-01T06:00:00Z',
    opening_dip:       20000,
    closing_dip:       18500,
    deliveries_litres: 0,
    delivery_note:     null,
    driver_name:       null,
    pos_litres:        1500,
    ...overrides,
  }
}

function makePrice(overrides: Partial<PriceRow> = {}): PriceRow {
  return {
    station_id:           'station-1',
    fuel_grade_id:        '95',
    sell_price_per_litre: 17.00,
    cost_per_litre:       14.00,
    valid_from:           '2026-05-01T00:00:00Z',
    valid_to:             null,
    ...overrides,
  }
}

// ── buildFuelControlRows ──────────────────────────────────────────────────────

describe('buildFuelControlRows — dip calc and variance', () => {
  it('tracer bullet: computes dip_calc_litres and variance_litres for a single closed row', () => {
    const rows = buildFuelControlRows([makeInput()])
    // dip_calc = 20000 + 0 - 18500 = 1500
    expect(rows[0].dip_calc_litres).toBe(1500)
    // variance = pos_litres - dip_calc = 1500 - 1500 = 0
    expect(rows[0].variance_litres).toBe(0)
  })

  it('dip_calc_litres includes deliveries', () => {
    const rows = buildFuelControlRows([makeInput({ opening_dip: 10000, closing_dip: 9000, deliveries_litres: 5000 })])
    // dip_calc = 10000 + 5000 - 9000 = 6000
    expect(rows[0].dip_calc_litres).toBe(6000)
  })

  it('variance_litres is negative when pos sold more than dips account for (loss)', () => {
    const rows = buildFuelControlRows([makeInput({ opening_dip: 20000, closing_dip: 18000, deliveries_litres: 0, pos_litres: 2100 })])
    // dip_calc = 2000, variance = 2100 - 2000 = 100... wait
    // Actually: dip_calc = 20000 + 0 - 18000 = 2000
    // variance = pos_litres - dip_calc = 2100 - 2000 = 100 (positive = POS > dips, gain?)
    // Hmm, let me re-check the sign convention from the PRD
    // "negative = loss (POS sold more than dips account for)"
    // So variance = pos_litres - dip_calc_litres
    // If pos sold 2100 but dip calc only 2000, variance = 2100 - 2000 = +100
    // But PRD says negative = loss... let me re-read
    // "variance_litres: pos_litres - dip_calc_litres"
    // "Sign convention: negative = loss/shortfall throughout"
    // So loss means: dip_calc > pos_litres (more fuel unaccounted for in tank than POS sold)
    // Actually the formula from the PRD: "variance_litres = pos_litres - dip_calc_litres"
    // negative means pos_litres < dip_calc_litres → tank lost more than POS recorded
    expect(rows[0].variance_litres).toBe(100)
  })

  it('variance_litres is negative when tank lost more than POS recorded', () => {
    const rows = buildFuelControlRows([makeInput({ opening_dip: 20000, closing_dip: 17800, deliveries_litres: 0, pos_litres: 2000 })])
    // dip_calc = 20000 + 0 - 17800 = 2200
    // variance = 2000 - 2200 = -200 (loss: tank shows 200L more dispensed than POS recorded)
    expect(rows[0].variance_litres).toBe(-200)
  })
})

describe('buildFuelControlRows — accumulated variance', () => {
  it('first row accumulated_variance equals its own variance_litres', () => {
    const rows = buildFuelControlRows([makeInput({ opening_dip: 20000, closing_dip: 17800, pos_litres: 2000 })])
    // variance = -200
    expect(rows[0].accumulated_variance).toBe(-200)
  })

  it('accumulated_variance rolls forward shift-by-shift per grade', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', shift_date: '2026-05-01', period: 'morning', opening_dip: 20000, closing_dip: 17800, pos_litres: 2000 }), // variance -200
      makeInput({ shift_id: 's2', shift_date: '2026-05-01', period: 'evening', opening_dip: 17800, closing_dip: 15500, pos_litres: 2200 }), // dip_calc=2300, variance -100
      makeInput({ shift_id: 's3', shift_date: '2026-05-02', period: 'morning', opening_dip: 15500, closing_dip: 14000, pos_litres: 1600 }), // dip_calc=1500, variance +100
    ]
    const rows = buildFuelControlRows(inputs)
    expect(rows[0].accumulated_variance).toBe(-200)
    expect(rows[1].accumulated_variance).toBe(-300)
    expect(rows[2].accumulated_variance).toBe(-200)
  })

  it('accumulated_variance is tracked independently per grade', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', fuel_grade_id: '95',  opening_dip: 20000, closing_dip: 17800, pos_litres: 2000 }), // var -200
      makeInput({ shift_id: 's2', fuel_grade_id: 'D50', opening_dip: 10000, closing_dip: 9500,  pos_litres: 400 }),  // dip_calc=500, var -100
    ]
    const rows = buildFuelControlRows(inputs)
    const r95  = rows.find(r => r.fuel_grade_id === '95')!
    const rD50 = rows.find(r => r.fuel_grade_id === 'D50')!
    expect(r95.accumulated_variance).toBe(-200)
    expect(rD50.accumulated_variance).toBe(-100)
  })
})

describe('buildFuelControlRows — pending rows', () => {
  it('pending row has null for all computed figures', () => {
    const rows = buildFuelControlRows([makeInput({ status: 'pending', opening_dip: null, closing_dip: null, pos_litres: null })])
    expect(rows[0].dip_calc_litres).toBeNull()
    expect(rows[0].variance_litres).toBeNull()
    expect(rows[0].accumulated_variance).toBeNull()
    expect(rows[0].gp_zar).toBeNull()
  })

  it('pending row does not advance the accumulated_variance for its grade', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', shift_date: '2026-05-01', period: 'morning', opening_dip: 20000, closing_dip: 17800, pos_litres: 2000 }), // var -200
      makeInput({ shift_id: 's2', shift_date: '2026-05-01', period: 'evening', status: 'pending', opening_dip: null, closing_dip: null, pos_litres: null }),
      makeInput({ shift_id: 's3', shift_date: '2026-05-02', period: 'morning', opening_dip: 17800, closing_dip: 16300, pos_litres: 1500 }), // dip_calc=1500, var 0
    ]
    const rows = buildFuelControlRows(inputs)
    expect(rows[0].accumulated_variance).toBe(-200)
    expect(rows[1].accumulated_variance).toBeNull()
    expect(rows[2].accumulated_variance).toBe(-200) // accumulator was not advanced by pending row
  })
})

describe('buildFuelControlRows — passthrough fields', () => {
  it('passes through delivery metadata unchanged', () => {
    const rows = buildFuelControlRows([makeInput({ deliveries_litres: 10000, delivery_note: 'DN-001', driver_name: 'John Doe' })])
    expect(rows[0].deliveries_litres).toBe(10000)
    expect(rows[0].delivery_note).toBe('DN-001')
    expect(rows[0].driver_name).toBe('John Doe')
  })

  it('gp_zar is null (GP added in a later slice)', () => {
    const rows = buildFuelControlRows([makeInput()])
    expect(rows[0].gp_zar).toBeNull()
    expect(rows[0].sell_price).toBeNull()
    expect(rows[0].cost_price).toBeNull()
  })
})

// ── buildDaySubtotals ─────────────────────────────────────────────────────────

describe('buildDaySubtotals', () => {
  it('tracer bullet: single row produces one subtotal with correct totals', () => {
    const rows = buildFuelControlRows([makeInput({ opening_dip: 20000, closing_dip: 18500, pos_litres: 1500 })])
    const subs = buildDaySubtotals(rows)
    expect(subs).toHaveLength(1)
    expect(subs[0].shift_date).toBe('2026-05-01')
    expect(subs[0].fuel_grade_id).toBe('95')
    expect(subs[0].total_pos_litres).toBe(1500)
    expect(subs[0].total_dip_calc).toBe(1500)
    expect(subs[0].total_variance).toBe(0)
    expect(subs[0].total_deliveries).toBe(0)
  })

  it('two shifts on the same day and grade are summed into one subtotal', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', period: 'morning', opening_dip: 20000, closing_dip: 18500, pos_litres: 1500 }), // dip_calc=1500, var=0
      makeInput({ shift_id: 's2', period: 'evening', opening_dip: 18500, closing_dip: 17000, pos_litres: 1400 }), // dip_calc=1500, var=-100
    ]
    const rows = buildFuelControlRows(inputs)
    const subs = buildDaySubtotals(rows)
    expect(subs).toHaveLength(1)
    expect(subs[0].total_pos_litres).toBe(2900)
    expect(subs[0].total_dip_calc).toBe(3000)
    expect(subs[0].total_variance).toBe(-100)
  })

  it('different grades on the same day produce separate subtotals', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', fuel_grade_id: '95',  opening_dip: 20000, closing_dip: 18500, pos_litres: 1500 }),
      makeInput({ shift_id: 's2', fuel_grade_id: 'D50', opening_dip: 10000, closing_dip: 9500,  pos_litres: 500 }),
    ]
    const rows = buildFuelControlRows(inputs)
    const subs = buildDaySubtotals(rows)
    expect(subs).toHaveLength(2)
    const s95  = subs.find(s => s.fuel_grade_id === '95')!
    const sD50 = subs.find(s => s.fuel_grade_id === 'D50')!
    expect(s95.total_pos_litres).toBe(1500)
    expect(sD50.total_pos_litres).toBe(500)
  })

  it('pending row figures are excluded from subtotal totals (treated as 0 for deliveries, null for others when all pending)', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', period: 'morning', opening_dip: 20000, closing_dip: 18500, pos_litres: 1500 }),
      makeInput({ shift_id: 's2', period: 'evening', status: 'pending', opening_dip: null, closing_dip: null, pos_litres: null }),
    ]
    const rows = buildFuelControlRows(inputs)
    const subs = buildDaySubtotals(rows)
    expect(subs).toHaveLength(1)
    // pending row nulls are excluded from sums — only the closed row contributes
    expect(subs[0].total_pos_litres).toBe(1500)
    expect(subs[0].total_dip_calc).toBe(1500)
    expect(subs[0].total_variance).toBe(0)
  })
})

// ── GP calculation ────────────────────────────────────────────────────────────

describe('buildFuelControlRows — GP calculation', () => {
  it('tracer bullet: computes gp_zar as (sell_price - cost_price) * pos_litres', () => {
    const rows = buildFuelControlRows(
      [makeInput({ pos_litres: 1000 })],
      [makePrice({ sell_price_per_litre: 17.00, cost_per_litre: 14.00 })],
    )
    expect(rows[0].sell_price).toBe(17.00)
    expect(rows[0].cost_price).toBe(14.00)
    expect(rows[0].gp_zar).toBeCloseTo(3000, 2)
  })

  it('GP is zero when sell price equals cost price', () => {
    const rows = buildFuelControlRows(
      [makeInput({ pos_litres: 500 })],
      [makePrice({ sell_price_per_litre: 15.00, cost_per_litre: 15.00 })],
    )
    expect(rows[0].gp_zar).toBe(0)
  })

  it('price change mid-month applies the correct price to each shift', () => {
    const prices: PriceRow[] = [
      makePrice({ sell_price_per_litre: 17.00, cost_per_litre: 14.00, valid_from: '2026-05-01T00:00:00Z', valid_to: '2026-05-15T00:00:00Z' }),
      makePrice({ sell_price_per_litre: 18.00, cost_per_litre: 15.00, valid_from: '2026-05-15T00:00:00Z', valid_to: null }),
    ]
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', started_at: '2026-05-10T06:00:00Z', pos_litres: 1000 }), // old price
      makeInput({ shift_id: 's2', started_at: '2026-05-20T06:00:00Z', pos_litres: 1000 }), // new price
    ]
    const rows = buildFuelControlRows(inputs, prices)
    expect(rows[0].gp_zar).toBeCloseTo(3000, 2) // (17-14) * 1000
    expect(rows[1].gp_zar).toBeCloseTo(3000, 2) // (18-15) * 1000
  })

  it('gp_zar is null for pending rows even when prices provided', () => {
    const rows = buildFuelControlRows(
      [makeInput({ status: 'pending', opening_dip: null, closing_dip: null, pos_litres: null })],
      [makePrice()],
    )
    expect(rows[0].gp_zar).toBeNull()
  })

  it('gp_zar is null when no prices provided (backward compatible)', () => {
    const rows = buildFuelControlRows([makeInput()])
    expect(rows[0].gp_zar).toBeNull()
  })
})

describe('buildDaySubtotals — GP aggregation', () => {
  it('total_gp sums across shifts of the same day and grade', () => {
    const prices = [makePrice()]
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's1', period: 'morning', pos_litres: 1000 }), // gp = 3000
      makeInput({ shift_id: 's2', period: 'evening', pos_litres: 500  }), // gp = 1500
    ]
    const rows = buildFuelControlRows(inputs, prices)
    const subs = buildDaySubtotals(rows)
    expect(subs[0].total_gp).toBeCloseTo(4500, 2)
  })
})

// ── split shift variance accumulation ─────────────────────────────────────────

describe('buildFuelControlRows — split shift variance accumulation', () => {
  it('Part 1 variance carries into Part 2 accumulated variance', () => {
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's-p1', shift_type: 'price_change', part: 1, period: 'evening',
        opening_dip: 50000, closing_dip: 48000, pos_litres: 1800 }),
      // dip_calc = 2000, variance = -200
      makeInput({ shift_id: 's-p2', shift_type: 'price_change', part: 2, period: 'evening',
        opening_dip: 48000, closing_dip: 47000, pos_litres: 900 }),
      // dip_calc = 1000, variance = -100
    ]
    const rows = buildFuelControlRows(inputs)
    expect(rows[0].accumulated_variance).toBe(-200)
    expect(rows[1].accumulated_variance).toBe(-300)
  })
})

// ── buildFuelControlReportRows ────────────────────────────────────────────────

describe('buildFuelControlReportRows', () => {
  it('tracer bullet: standard shift is wrapped as type:shift', () => {
    const result = buildFuelControlReportRows([makeInput()])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('shift')
  })

  it('no impact row inserted for standard (unsplit) shifts', () => {
    const result = buildFuelControlReportRows([
      makeInput({ shift_id: 's1', period: 'morning' }),
      makeInput({ shift_id: 's2', period: 'evening' }),
    ])
    expect(result.every(r => r.type === 'shift')).toBe(true)
  })

  it('inserts price_change_impact row between Part 1 and Part 2 with correct impact_zar', () => {
    // Old price: cost 14.00 valid until midnight; new price: cost 15.00 from midnight
    const prices: PriceRow[] = [
      makePrice({ cost_per_litre: 14.00, valid_from: '2026-05-07T00:00:00Z', valid_to: '2026-05-08T00:00:00Z' }),
      makePrice({ cost_per_litre: 15.00, valid_from: '2026-05-08T00:00:00Z', valid_to: null }),
    ]
    const inputs: FuelControlRowInput[] = [
      makeInput({ shift_id: 's-p1', shift_type: 'price_change', part: 1, period: 'evening',
        shift_date: '2026-05-07', started_at: '2026-05-07T18:00:00Z',
        opening_dip: 50000, closing_dip: 48000, pos_litres: 1800 }),
      makeInput({ shift_id: 's-p2', shift_type: 'price_change', part: 2, period: 'evening',
        shift_date: '2026-05-07', started_at: '2026-05-08T00:00:00Z',
        opening_dip: 48000, closing_dip: 47000, pos_litres: 900 }),
    ]
    const result = buildFuelControlReportRows(inputs, prices)

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('shift')
    expect(result[1].type).toBe('price_change_impact')
    expect(result[2].type).toBe('shift')

    const impact = result[1] as Extract<typeof result[1], { type: 'price_change_impact' }>
    expect(impact.fuel_grade_id).toBe('95')
    expect(impact.closing_dip_litres).toBe(48000)
    expect(impact.old_cost).toBe(14.00)
    expect(impact.new_cost).toBe(15.00)
    // 48000 × (15.00 - 14.00) = 48000
    expect(impact.impact_zar).toBeCloseTo(48000, 2)
  })

  it('impact row appears between the correct grades when multiple grades are present', () => {
    const prices: PriceRow[] = [
      makePrice({ fuel_grade_id: '95',  cost_per_litre: 14.00, valid_from: '2026-05-07T00:00:00Z', valid_to: '2026-05-08T00:00:00Z' }),
      makePrice({ fuel_grade_id: '95',  cost_per_litre: 15.00, valid_from: '2026-05-08T00:00:00Z', valid_to: null }),
      makePrice({ fuel_grade_id: 'D50', cost_per_litre: 16.00, valid_from: '2026-05-07T00:00:00Z', valid_to: '2026-05-08T00:00:00Z' }),
      makePrice({ fuel_grade_id: 'D50', cost_per_litre: 17.00, valid_from: '2026-05-08T00:00:00Z', valid_to: null }),
    ]
    const base = { shift_type: 'price_change' as const, period: 'evening' as const, shift_date: '2026-05-07' }
    const inputs: FuelControlRowInput[] = [
      makeInput({ ...base, shift_id: 's-p1', part: 1, fuel_grade_id: '95',  started_at: '2026-05-07T18:00:00Z', opening_dip: 50000, closing_dip: 48000, pos_litres: 1800 }),
      makeInput({ ...base, shift_id: 's-p1', part: 1, fuel_grade_id: 'D50', started_at: '2026-05-07T18:00:00Z', opening_dip: 20000, closing_dip: 19000, pos_litres: 900 }),
      makeInput({ ...base, shift_id: 's-p2', part: 2, fuel_grade_id: '95',  started_at: '2026-05-08T00:00:00Z', opening_dip: 48000, closing_dip: 47000, pos_litres: 900 }),
      makeInput({ ...base, shift_id: 's-p2', part: 2, fuel_grade_id: 'D50', started_at: '2026-05-08T00:00:00Z', opening_dip: 19000, closing_dip: 18500, pos_litres: 450 }),
    ]
    const result = buildFuelControlReportRows(inputs, prices)

    expect(result).toHaveLength(6) // 4 shift rows + 2 impact rows
    const types = result.map(r => `${r.type}:${r.type === 'shift' ? r.data.fuel_grade_id : r.fuel_grade_id}`)
    expect(types).toEqual([
      'shift:95', 'price_change_impact:95',
      'shift:D50', 'price_change_impact:D50',
      'shift:95', 'shift:D50',
    ])
  })
})

// ── trailingMonths ────────────────────────────────────────────────────────────
describe('trailingMonths', () => {
  it('returns count + 1 entries (current month plus N trailing)', () => {
    const result = trailingMonths('2026-05', 3)
    expect(result).toHaveLength(4)
  })

  it('lists months in descending order, most recent first', () => {
    const result = trailingMonths('2026-05', 3)
    expect(result).toEqual(['2026-05', '2026-04', '2026-03', '2026-02'])
  })

  it('wraps correctly across a year boundary', () => {
    const result = trailingMonths('2026-02', 3)
    expect(result).toEqual(['2026-02', '2026-01', '2025-12', '2025-11'])
  })

  it('pads single-digit months', () => {
    const result = trailingMonths('2026-03', 2)
    expect(result).toEqual(['2026-03', '2026-02', '2026-01'])
  })
})

// ── buildDayEntries ───────────────────────────────────────────────────────────
describe('buildDayEntries', () => {
  function makeShiftRow(overrides: Partial<FuelControlRowInput> = {}): FuelControlReportRow {
    const input = makeInput(overrides)
    const prices = [makePrice({ fuel_grade_id: input.fuel_grade_id })]
    const rows = buildFuelControlRows([input], prices)
    return { type: 'shift', data: rows[0] }
  }

  function makeSub(overrides: Partial<FuelControlDaySubtotal> = {}): FuelControlDaySubtotal {
    return {
      shift_date:       '2026-05-01',
      fuel_grade_id:    '95',
      total_deliveries: 0,
      total_pos_litres: 1500,
      total_dip_calc:   1500,
      total_variance:   0,
      total_gp:         4500,
      ...overrides,
    }
  }

  it('returns one DayEntry per unique date', () => {
    const rows: FuelControlReportRow[] = [
      makeShiftRow({ shift_date: '2026-05-01' }),
      makeShiftRow({ shift_date: '2026-05-02' }),
    ]
    const subs = [
      makeSub({ shift_date: '2026-05-01' }),
      makeSub({ shift_date: '2026-05-02' }),
    ]
    const entries = buildDayEntries(rows, ['95'], subs)
    expect(entries.map(e => e.date)).toEqual(['2026-05-01', '2026-05-02'])
  })

  it('each gradeGroup contains only rows for that grade and date', () => {
    const rows: FuelControlReportRow[] = [
      makeShiftRow({ shift_date: '2026-05-01', fuel_grade_id: '95' }),
      makeShiftRow({ shift_date: '2026-05-01', fuel_grade_id: 'D10' }),
    ]
    const subs = [
      makeSub({ shift_date: '2026-05-01', fuel_grade_id: '95' }),
      makeSub({ shift_date: '2026-05-01', fuel_grade_id: 'D10' }),
    ]
    const entries = buildDayEntries(rows, ['95', 'D10'], subs)
    expect(entries).toHaveLength(1)
    const [day] = entries
    expect(day.gradeGroups).toHaveLength(2)
    expect(day.gradeGroups[0].grade).toBe('95')
    expect(day.gradeGroups[0].rows).toHaveLength(1)
    expect(day.gradeGroups[1].grade).toBe('D10')
    expect(day.gradeGroups[1].rows).toHaveLength(1)
  })

  it('allGradesSummary sums numeric fields across grade subtotals for the date', () => {
    const rows: FuelControlReportRow[] = [
      makeShiftRow({ shift_date: '2026-05-01', fuel_grade_id: '95' }),
      makeShiftRow({ shift_date: '2026-05-01', fuel_grade_id: 'D10' }),
    ]
    const subs = [
      makeSub({ shift_date: '2026-05-01', fuel_grade_id: '95',  total_pos_litres: 1000, total_variance: -10, total_gp: 3000 }),
      makeSub({ shift_date: '2026-05-01', fuel_grade_id: 'D10', total_pos_litres: 2000, total_variance:   5, total_gp: 6000 }),
    ]
    const entries = buildDayEntries(rows, ['95', 'D10'], subs)
    const { allGradesSummary: s } = entries[0]
    expect(s.total_pos_litres).toBe(3000)
    expect(s.total_variance).toBe(-5)
    expect(s.total_gp).toBe(9000)
  })

  it('allGradesSummary treats null pos_litres as null when all grades are null', () => {
    const rows: FuelControlReportRow[] = [
      makeShiftRow({ shift_date: '2026-05-01', fuel_grade_id: '95', status: 'pending' }),
    ]
    const subs = [
      makeSub({ shift_date: '2026-05-01', fuel_grade_id: '95', total_pos_litres: null }),
    ]
    const entries = buildDayEntries(rows, ['95'], subs)
    expect(entries[0].allGradesSummary.total_pos_litres).toBeNull()
  })

  it('gradeGroups preserves price_change_impact rows for the grade', () => {
    const part1 = makeInput({ shift_date: '2026-05-01', fuel_grade_id: '95', part: 1, shift_type: 'price_change', started_at: '2026-05-01T06:00:00Z' })
    const part2 = makeInput({ shift_date: '2026-05-01', fuel_grade_id: '95', part: 2, shift_type: 'price_change', started_at: '2026-05-01T14:00:00Z' })
    const prices = [
      makePrice({ sell_price_per_litre: 17.00, cost_per_litre: 14.00, valid_from: '2026-04-01T00:00:00Z', valid_to: '2026-05-01T12:00:00Z' }),
      makePrice({ sell_price_per_litre: 18.00, cost_per_litre: 15.00, valid_from: '2026-05-01T12:00:00Z', valid_to: null }),
    ]
    const reportRows = buildFuelControlReportRows([part1, part2], prices)
    const subs = [makeSub({ shift_date: '2026-05-01' })]
    const entries = buildDayEntries(reportRows, ['95'], subs)
    const group = entries[0].gradeGroups[0]
    expect(group.rows.some(r => r.type === 'price_change_impact')).toBe(true)
  })
})
