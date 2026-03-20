import { describe, it, expect } from 'vitest'
import { getCloseProgress, resolveCloseStatus } from '@/lib/shift-close'

// ── getCloseProgress ──────────────────────────────────────────────────────────

describe('getCloseProgress', () => {
  const pumps = ['p1', 'p2', 'p3']
  const tanks = ['t1', 't2']

  it('tracer bullet: nothing done → 0/3 pumps, 0/2 tanks, no pos, not ready', () => {
    const p = getCloseProgress(pumps, [], tanks, [], false)
    expect(p.pumps).toEqual({ done: 0, total: 3 })
    expect(p.tanks).toEqual({ done: 0, total: 2 })
    expect(p.pos).toBe(false)
    expect(p.isReadyForPos).toBe(false)
    expect(p.isComplete).toBe(false)
  })

  it('all close pump + dip readings done, no POS → ready for POS, not complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1', 't2'], false)
    expect(p.isReadyForPos).toBe(true)
    expect(p.isComplete).toBe(false)
    expect(p.pos).toBe(false)
  })

  it('all close readings done + POS submitted → complete', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1', 't2'], true)
    expect(p.isReadyForPos).toBe(true)
    expect(p.pos).toBe(true)
    expect(p.isComplete).toBe(true)
  })

  it('some pumps done but not all → not ready for POS', () => {
    const p = getCloseProgress(pumps, ['p1'], tanks, ['t1', 't2'], false)
    expect(p.pumps).toEqual({ done: 1, total: 3 })
    expect(p.isReadyForPos).toBe(false)
  })

  it('all pumps done but tanks incomplete → not ready for POS', () => {
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1'], false)
    expect(p.isReadyForPos).toBe(false)
  })

  it('POS submitted but close readings incomplete → not complete', () => {
    const p = getCloseProgress(pumps, ['p1'], tanks, ['t1', 't2'], true)
    expect(p.isComplete).toBe(false)
  })

  it('station with no pumps + all tanks done → ready for POS', () => {
    const p = getCloseProgress([], [], tanks, ['t1', 't2'], false)
    expect(p.isReadyForPos).toBe(true)
  })

  it('counts only ids present in both lists', () => {
    // Only p1 and p2 have been recorded (p3 missing)
    const p = getCloseProgress(pumps, ['p1', 'p2', 'p99'], tanks, ['t1', 't2'], false)
    expect(p.pumps).toEqual({ done: 2, total: 3 })
    expect(p.isReadyForPos).toBe(false)
  })
})

// ── resolveCloseStatus ────────────────────────────────────────────────────────

describe('resolveCloseStatus', () => {
  it('close readings incomplete → open (no status change)', () => {
    expect(resolveCloseStatus({ isReadyForPos: false, isComplete: false, pos: false }))
      .toBe('open')
  })

  it('all close pump + dip readings done, no POS yet → pending_pos', () => {
    expect(resolveCloseStatus({ isReadyForPos: true, isComplete: false, pos: false }))
      .toBe('pending_pos')
  })

  it('all close readings + POS done → pending_pos (submit is explicit, not auto)', () => {
    expect(resolveCloseStatus({ isReadyForPos: true, isComplete: true, pos: true }))
      .toBe('pending_pos')
  })
})
