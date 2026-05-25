import { describe, it, expect, vi } from 'vitest'
import {
  assemblePureInputs,
  runReconciliationWith,
  selectBestPriorShift,
} from '../lib/reconciliation-runner'
import type {
  ShiftDataBundle,
  ShiftDataRepository,
  ReconciliationWriter,
} from '../lib/reconciliation-runner'

// ── Fixture builder ────────────────────────────────────────────────────────────

function makeBundle(overrides: Partial<ShiftDataBundle> = {}): ShiftDataBundle {
  return {
    shift: {
      id:           'shift-1',
      station_id:   'station-1',
      period:       'morning',
      shift_date:   '2026-03-20',
      shift_type:   'standard',
      started_at:   '2026-03-20T06:00:00Z',
      submitted_at: '2026-03-20T08:00:00Z',
    },
    tanks:        [{ id: 'T1', fuel_grade_id: '95' }],
    pumps:        [{ id: 'P1', tank_id: 'T1' }],
    openDips:     [{ tank_id: 'T1', litres: 10000 }],
    closeDips:    [{ tank_id: 'T1', litres: 8000 }],
    pumpReadings: [
      { pump_id: 'P1', meter_reading: 50000, type: 'open' },
      { pump_id: 'P1', meter_reading: 52000, type: 'close' },
    ],
    posLines:   [{ pump_id: 'P1', litres_sold: 2000, revenue_zar: 34000 }],
    deliveries: [],
    priceRows:  [{ station_id: 'station-1', fuel_grade_id: '95', sell_price_per_litre: 17.00, cost_per_litre: 14.00, valid_from: '2026-01-01T00:00:00Z', valid_to: null }],
    ...overrides,
  }
}

// ── assemblePureInputs — pump pairing ─────────────────────────────────────────

describe('assemblePureInputs — pump pairing', () => {
  it('pairs matched open and close readings into a single entry', () => {
    const { inputs, warnings } = assemblePureInputs(makeBundle())
    expect(inputs.pumpReadings).toHaveLength(1)
    expect(inputs.pumpReadings[0]).toEqual({
      pump_id:          'P1',
      opening_reading:  50000,
      closing_reading:  52000,
    })
    expect(warnings.filter(w => w.code === 'PUMP_NO_CLOSE_READING')).toHaveLength(0)
  })

  it('excludes a pump with open but no close and emits PUMP_NO_CLOSE_READING', () => {
    const { inputs, warnings } = assemblePureInputs(makeBundle({
      pumpReadings: [
        { pump_id: 'P1', meter_reading: 50000, type: 'open' },
        // no close for P1
      ],
    }))
    expect(inputs.pumpReadings).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].code).toBe('PUMP_NO_CLOSE_READING')
    expect(warnings[0].detail).toContain('P1')
  })
})

// ── assemblePureInputs — delivery period filtering ────────────────────────────

describe('assemblePureInputs — delivery period filtering', () => {
  it('includes only pre-12:00 UTC deliveries for a morning shift', () => {
    const { inputs } = assemblePureInputs(makeBundle({
      shift: {
        id: 'shift-1', station_id: 'station-1', period: 'morning', shift_type: 'standard',
        shift_date: '2026-03-20', started_at: '2026-03-20T06:00:00Z', submitted_at: '2026-03-20T08:00:00Z',
      },
      deliveries: [
        { tank_id: 'T1', litres_received: 5000, delivered_at: '2026-03-20T06:00:00Z' }, // morning ✓
        { tank_id: 'T1', litres_received: 3000, delivered_at: '2026-03-20T14:00:00Z' }, // evening ✗
      ],
    }))
    expect(inputs.deliveries).toHaveLength(1)
    expect(inputs.deliveries[0].litres_received).toBe(5000)
  })

  it('includes only 12:00+ UTC deliveries for an evening shift', () => {
    const { inputs } = assemblePureInputs(makeBundle({
      shift: {
        id: 'shift-1', station_id: 'station-1', period: 'evening', shift_type: 'standard',
        shift_date: '2026-03-20', started_at: '2026-03-20T12:00:00Z', submitted_at: '2026-03-20T20:00:00Z',
      },
      deliveries: [
        { tank_id: 'T1', litres_received: 5000, delivered_at: '2026-03-20T06:00:00Z' }, // morning ✗
        { tank_id: 'T1', litres_received: 3000, delivered_at: '2026-03-20T14:00:00Z' }, // evening ✓
      ],
    }))
    expect(inputs.deliveries).toHaveLength(1)
    expect(inputs.deliveries[0].litres_received).toBe(3000)
  })
})

// ── assemblePureInputs — price_change delivery filtering ──────────────────────

describe('assemblePureInputs — price_change delivery filtering', () => {
  const part1Shift = {
    id: 'shift-p1', station_id: 'station-1', period: 'evening' as const, shift_type: 'price_change' as const,
    shift_date: '2026-05-07', started_at: '2026-05-07T18:00:00Z', submitted_at: '2026-05-08T00:00:00Z',
  }
  const part2Shift = {
    id: 'shift-p2', station_id: 'station-1', period: 'evening' as const, shift_type: 'price_change' as const,
    shift_date: '2026-05-07', started_at: '2026-05-08T00:00:00Z', submitted_at: '2026-05-08T06:00:00Z',
  }
  const beforeSplit  = { tank_id: 'T1', litres_received: 5000, delivered_at: '2026-05-07T21:00:00Z' }
  const afterSplit   = { tank_id: 'T1', litres_received: 2000, delivered_at: '2026-05-08T02:00:00Z' }
  const atSplit      = { tank_id: 'T1', litres_received: 3000, delivered_at: '2026-05-08T00:00:00Z' }

  it('tracer bullet: delivery before split timestamp goes to Part 1 only', () => {
    const { inputs } = assemblePureInputs(makeBundle({
      shift: part1Shift,
      deliveries: [beforeSplit, afterSplit],
    }))
    expect(inputs.deliveries).toHaveLength(1)
    expect(inputs.deliveries[0].litres_received).toBe(5000)
  })

  it('delivery after split timestamp goes to Part 2 only', () => {
    const { inputs } = assemblePureInputs(makeBundle({
      shift: part2Shift,
      deliveries: [beforeSplit, afterSplit],
    }))
    expect(inputs.deliveries).toHaveLength(1)
    expect(inputs.deliveries[0].litres_received).toBe(2000)
  })

  it('delivery exactly at split timestamp goes to Part 2, not Part 1', () => {
    const { inputs: part1Inputs } = assemblePureInputs(makeBundle({
      shift: part1Shift,
      deliveries: [atSplit],
    }))
    expect(part1Inputs.deliveries).toHaveLength(0)

    const { inputs: part2Inputs } = assemblePureInputs(makeBundle({
      shift: part2Shift,
      deliveries: [atSplit],
    }))
    expect(part2Inputs.deliveries).toHaveLength(1)
  })
})

// ── assemblePureInputs — price snapshot ───────────────────────────────────────

describe('assemblePureInputs — price snapshot', () => {
  it('emits STARTED_AT_NULL when started_at is null', () => {
    const { warnings } = assemblePureInputs(makeBundle({
      shift: {
        id: 'shift-1', station_id: 'station-1', period: 'morning',
        shift_date: '2026-03-20', started_at: null, submitted_at: null,
      },
    }))
    expect(warnings.some(w => w.code === 'STARTED_AT_NULL')).toBe(true)
  })

  it('emits PRICE_NOT_FOUND and defaults to 0 when no price row exists for a grade', () => {
    const { inputs, warnings } = assemblePureInputs(makeBundle({ priceRows: [] }))
    expect(inputs.prices[0].sell_price_per_litre).toBe(0)
    expect(warnings.some(w => w.code === 'PRICE_NOT_FOUND')).toBe(true)
  })
})

// ── assemblePureInputs — tank dip coverage ────────────────────────────────────

describe('assemblePureInputs — tank dip coverage', () => {
  it('emits TANK_MISSING_DIP when a tank has no open dip reading', () => {
    const { warnings } = assemblePureInputs(makeBundle({ openDips: [] }))
    const w = warnings.filter(w => w.code === 'TANK_MISSING_DIP')
    expect(w.length).toBeGreaterThanOrEqual(1)
    expect(w[0].detail).toContain('T1')
    expect(w[0].detail).toContain('open')
  })

  it('emits TANK_MISSING_DIP when a tank has no close dip reading', () => {
    const { warnings } = assemblePureInputs(makeBundle({ closeDips: [] }))
    const w = warnings.filter(w => w.code === 'TANK_MISSING_DIP')
    expect(w.length).toBeGreaterThanOrEqual(1)
    expect(w[0].detail).toContain('T1')
    expect(w[0].detail).toContain('close')
  })
})

// ── assemblePureInputs — repository warnings pass-through ────────────────────

describe('assemblePureInputs — repository warnings pass-through', () => {
  it('merges NO_PRIOR_SHIFT_BASELINE from repositoryWarnings into output warnings', () => {
    const bundle = makeBundle({
      repositoryWarnings: [{
        code:   'NO_PRIOR_SHIFT_BASELINE',
        detail: 'No prior closed shift and no station baseline found for station-1',
      }],
    })
    const { warnings } = assemblePureInputs(bundle)
    const w = warnings.filter(w => w.code === 'NO_PRIOR_SHIFT_BASELINE')
    expect(w).toHaveLength(1)
    expect(w[0].detail).toContain('station-1')
  })

  it('produces no extra warnings when repositoryWarnings is absent', () => {
    const bundle = makeBundle()
    // repositoryWarnings not set — should not cause errors or extra warnings
    const { warnings } = assemblePureInputs(bundle)
    expect(warnings.filter(w => w.code === 'NO_PRIOR_SHIFT_BASELINE')).toHaveLength(0)
  })
})

// ── selectBestPriorShift — baseline candidate selection ───────────────────────

describe('selectBestPriorShift', () => {
  it('returns null for an empty candidate list', () => {
    expect(selectBestPriorShift([])).toBeNull()
  })

  it('returns the only candidate when there is one', () => {
    const candidate = { id: 'shift-1', shift_date: '2026-03-20', period: 'evening', part: 0 }
    expect(selectBestPriorShift([candidate])?.id).toBe('shift-1')
  })

  it('prefers Part 2 over Part 1 when shift_date and period match', () => {
    const part1 = { id: 'shift-p1', shift_date: '2026-03-20', period: 'evening', part: 1 }
    const part2 = { id: 'shift-p2', shift_date: '2026-03-20', period: 'evening', part: 2 }
    expect(selectBestPriorShift([part1, part2])?.id).toBe('shift-p2')
    expect(selectBestPriorShift([part2, part1])?.id).toBe('shift-p2')
  })

  it('prefers a later shift_date over an earlier one regardless of period and part', () => {
    const older  = { id: 'older',  shift_date: '2026-03-19', period: 'evening', part: 2 }
    const newer  = { id: 'newer',  shift_date: '2026-03-20', period: 'morning', part: 0 }
    expect(selectBestPriorShift([older, newer])?.id).toBe('newer')
  })

  it('prefers evening over morning on the same date when parts are equal', () => {
    const morning = { id: 'morning', shift_date: '2026-03-20', period: 'morning', part: 0 }
    const evening = { id: 'evening', shift_date: '2026-03-20', period: 'evening', part: 0 }
    expect(selectBestPriorShift([morning, evening])?.id).toBe('evening')
  })
})

// ── runReconciliationWith — orchestration ─────────────────────────────────────

describe('runReconciliationWith', () => {
  it('returns error and does not call persist when the repository fails', async () => {
    const failingRepo: ShiftDataRepository = {
      loadBundle: async () => ({ error: 'DB connection refused' }),
    }
    const persist = vi.fn()
    const writer: ReconciliationWriter = { persist }

    const result = await runReconciliationWith('shift-1', failingRepo, writer)

    expect(result.error).toBe('DB connection refused')
    expect(persist).not.toHaveBeenCalled()
  })

  it('calls persist exactly once with a non-zero revenue result on happy path', async () => {
    const repo: ShiftDataRepository = {
      loadBundle: async () => makeBundle(),
    }
    const captured: Parameters<ReconciliationWriter['persist']>[] = []
    const writer: ReconciliationWriter = {
      persist: async (shiftId, result) => {
        captured.push([shiftId, result])
        return {}
      },
    }

    const result = await runReconciliationWith('shift-1', repo, writer)

    expect(result.error).toBeUndefined()
    expect(captured).toHaveLength(1)
    const [, reconciliationResult] = captured[0]
    // Pump P1 (grade 95): meter_delta=2000L × R17.00 = R34,000 expected; POS revenue=R34,000 → variance=0
    const pumpLine = reconciliationResult.pumpLines.find(l => l.pump_id === 'P1')!
    expect(pumpLine.expected_revenue_zar).toBe(34000)
    expect(pumpLine.pos_revenue_zar).toBe(34000)
    expect(pumpLine.variance_zar).toBe(0)
  })
})
