import { describe, it, expect } from 'vitest'
import { buildShiftCloseSteps, buildCashierSteps } from '@/lib/workflow-steps'
import type { CloseProgress } from '@/lib/shift-close'
import type { CashierProgress } from '@/lib/cashier-progress'

const cashierAllDone: CashierProgress = { fuelPos: true, stockPos: true, stockCount: true }
const cashierNothingDone: CashierProgress = { fuelPos: false, stockPos: false, stockCount: false }

const allDone: CloseProgress = {
  pumps: { done: 2, total: 2 },
  tanks: { done: 3, total: 3 },
  pos: true,
  cashierPos: true,
  dryStock: true,
  isReadyForPos: true,
  isComplete: true,
}

const nothingDone: CloseProgress = {
  pumps: { done: 0, total: 2 },
  tanks: { done: 0, total: 3 },
  pos: false,
  cashierPos: false,
  dryStock: false,
  isReadyForPos: false,
  isComplete: false,
}

// ── buildCashierSteps ──────────────────────────────────────────────────────────

describe('buildCashierSteps', () => {
  it('the current page always has status current (tracer bullet)', () => {
    const steps = buildCashierSteps('shift-1', 'fuel-pos', cashierNothingDone)
    expect(steps[0].status).toBe('current')
  })

  it('fuel-pos step is complete when fuelPos is true', () => {
    const steps = buildCashierSteps('shift-1', 'stock-pos', cashierAllDone)
    expect(steps[0].status).toBe('complete')
  })

  it('fuel-pos step is upcoming when fuelPos is false', () => {
    const steps = buildCashierSteps('shift-1', 'stock-pos', cashierNothingDone)
    expect(steps[0].status).toBe('upcoming')
  })

  it('stock-pos step is always complete (navigable) regardless of progress', () => {
    expect(buildCashierSteps('s', 'fuel-pos', cashierAllDone)[1].status).toBe('complete')
    expect(buildCashierSteps('s', 'fuel-pos', cashierNothingDone)[1].status).toBe('complete')
  })

  it('stock-count step is always complete (navigable) regardless of progress', () => {
    expect(buildCashierSteps('s', 'fuel-pos', cashierAllDone)[2].status).toBe('complete')
    expect(buildCashierSteps('s', 'fuel-pos', cashierNothingDone)[2].status).toBe('complete')
  })

  it('summary step is always complete', () => {
    const steps = buildCashierSteps('shift-1', 'fuel-pos', cashierNothingDone)
    expect(steps[3].status).toBe('complete')
  })

  it('hrefs include the shiftId', () => {
    const steps = buildCashierSteps('abc-123', 'fuel-pos', cashierNothingDone)
    expect(steps[0].href).toBe('/cashier/abc-123/fuel-pos')
    expect(steps[3].href).toBe('/cashier/abc-123/summary')
  })
})

// ── buildShiftCloseSteps ───────────────────────────────────────────────────────

describe('buildShiftCloseSteps', () => {
  it('the current page always has status current (tracer bullet)', () => {
    const steps = buildShiftCloseSteps('shift-1', 'pumps', nothingDone)
    expect(steps[0].status).toBe('current')
  })

  it('pumps step is complete when all pump readings are saved', () => {
    const steps = buildShiftCloseSteps('shift-1', 'dips', allDone)
    expect(steps[0].status).toBe('complete')
  })

  it('pumps step is upcoming when pump readings are incomplete', () => {
    const steps = buildShiftCloseSteps('shift-1', 'dips', nothingDone)
    expect(steps[0].status).toBe('upcoming')
  })

  it('dips step is complete when all dip readings are saved', () => {
    const steps = buildShiftCloseSteps('shift-1', 'pumps', allDone)
    expect(steps[1].status).toBe('complete')
  })

  it('dips step is upcoming when dip readings are incomplete', () => {
    const steps = buildShiftCloseSteps('shift-1', 'pumps', nothingDone)
    expect(steps[1].status).toBe('upcoming')
  })

  it('deliveries step is always complete', () => {
    const steps = buildShiftCloseSteps('shift-1', 'pumps', nothingDone)
    expect(steps[2].status).toBe('complete')
  })

  it('summary step is always complete', () => {
    const steps = buildShiftCloseSteps('shift-1', 'pumps', nothingDone)
    expect(steps[3].status).toBe('complete')
  })

  it('hrefs include the shiftId', () => {
    const steps = buildShiftCloseSteps('abc-123', 'pumps', nothingDone)
    expect(steps[0].href).toBe('/shift/abc-123/close/pumps')
    expect(steps[3].href).toBe('/shift/abc-123/close/summary')
  })
})
