import { describe, it, expect } from 'vitest'
import { getCloseProgress, resolveCloseStatus, canSubmit } from '@/lib/shift-close'

// ── getCloseProgress ──────────────────────────────────────────────────────────

describe('getCloseProgress', () => {
  const pumps = ['p1', 'p2', 'p3']
  const tanks = ['t1', 't2']

  it('tracer bullet: nothing done → 0/3 pumps, 0/2 tanks, no pos, not ready', () => {
    const p = getCloseProgress(pumps, [], tanks, [], false, false)
    expect(p.pumps).toEqual({ done: 0, total: 3 })
    expect(p.tanks).toEqual({ done: 0, total: 2 })
    expect(p.pos).toBe(false)
    expect(p.isReadyForPos).toBe(false)
    expect(p.isComplete).toBe(false)
  })

  it('all close pump + dip readings done, no POS → ready for POS, not complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1', 't2'], false, false)
    expect(p.isReadyForPos).toBe(true)
    expect(p.isComplete).toBe(false)
    expect(p.pos).toBe(false)
  })

  it('all close readings done + cashier POS + dry stock complete → complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1', 't2'], true, true)
    expect(p.isReadyForPos).toBe(true)
    expect(p.pos).toBe(true)
    expect(p.isComplete).toBe(true)
  })

  it('some pumps done but not all → not ready for POS', () => {
    const p = getCloseProgress(pumps, ['p1'], tanks, ['t1', 't2'], false, false)
    expect(p.pumps).toEqual({ done: 1, total: 3 })
    expect(p.isReadyForPos).toBe(false)
  })

  it('all pumps done but tanks incomplete → not ready for POS', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1'], false, false)
    expect(p.isReadyForPos).toBe(false)
  })

  it('POS submitted but close readings incomplete → not complete', () => {
    const p = getCloseProgress(pumps, ['p1'], tanks, ['t1', 't2'], true, false)
    expect(p.isComplete).toBe(false)
  })

  it('station with no pumps + all tanks done → ready for POS', () => {
    const p = getCloseProgress([], [], tanks, ['t1', 't2'], false, false)
    expect(p.isReadyForPos).toBe(true)
  })

  it('counts only ids present in both lists', () => {
    // Only p1 and p2 have been recorded (p3 missing)
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p99'], tanks, ['t1', 't2'], false, false)
    expect(p.pumps).toEqual({ done: 2, total: 3 })
    expect(p.isReadyForPos).toBe(false)
  })
})

// ── resolveCloseStatus ────────────────────────────────────────────────────────

describe('resolveCloseStatus', () => {
  it('close readings incomplete → pending (no auto-advance)', () => {
    expect(resolveCloseStatus({ isReadyForPos: false, isComplete: false, pos: false }))
      .toBe('pending')
  })

  it('all close pump + dip readings done, no POS yet → pending (still waiting on POS)', () => {
    expect(resolveCloseStatus({ isReadyForPos: true, isComplete: false, pos: false }))
      .toBe('pending')
  })

  it('all close readings + POS done → closed', () => {
    expect(resolveCloseStatus({ isReadyForPos: true, isComplete: true, pos: true }))
      .toBe('closed')
  })
})

// ── canSubmit ─────────────────────────────────────────────────────────────────

describe('canSubmit', () => {
  it('allows submit from pending with cashier POS and dry stock complete', () => expect(canSubmit('pending', true, true)).toBe(true))
  it('blocks submit from closed',                                          () => expect(canSubmit('closed', true, true)).toBe(false))
  it('blocks submit from draft',                                           () => expect(canSubmit('draft', true, true)).toBe(false))
  it('blocks submit from submitted',                                       () => expect(canSubmit('submitted', true, true)).toBe(false))
  it('blocks submit when cashier POS incomplete',                          () => expect(canSubmit('pending', false, true)).toBe(false))
  it('blocks submit when dry stock incomplete',                            () => expect(canSubmit('pending', true, false)).toBe(false))
})

// ── getCloseProgress — cashier POS track ─────────────────────────────────────

describe('getCloseProgress — cashier POS track', () => {
  const pumps = ['p1', 'p2']
  const tanks = ['t1']

  it('tracer bullet: cashierPos false when cashier POS not submitted', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2'], tanks, ['t1'], false, false)
    expect(p.cashierPos).toBe(false)
    expect(p.isComplete).toBe(false)
  })

  it('isComplete false when supervisor readings done and cashier POS submitted but dry stock missing', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2'], tanks, ['t1'], true, false)
    expect(p.cashierPos).toBe(true)
    expect(p.isComplete).toBe(false)
  })

  it('isComplete false when supervisor readings incomplete even if cashier tracks done', () => {
    const p = getCloseProgress(pumps, ['p1'], tanks, ['t1'], true, true)
    expect(p.isComplete).toBe(false)
  })
})

// ── getCloseProgress — dry stock track ───────────────────────────────────────

describe('getCloseProgress — dry stock track', () => {
  const pumps = ['p1', 'p2']
  const tanks = ['t1']

  it('tracer bullet: dryStock false when dry stock not complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2'], tanks, ['t1'], true, false)
    expect(p.dryStock).toBe(false)
    expect(p.isComplete).toBe(false)
  })

  it('isComplete true when supervisor readings, cashier POS, and dry stock all complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2'], tanks, ['t1'], true, true)
    expect(p.dryStock).toBe(true)
    expect(p.isComplete).toBe(true)
  })

  it('isComplete false when cashier POS done but dry stock incomplete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2'], tanks, ['t1'], true, false)
    expect(p.isComplete).toBe(false)
  })
})
