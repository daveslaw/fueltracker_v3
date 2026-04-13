import { describe, it, expect } from 'vitest'
import { canStartShift, getShiftProgress, resolveShiftStatus } from '@/lib/shift-open'
import type { ShiftRow } from '@/lib/shift-open'

// ── canStartShift ─────────────────────────────────────────────────────────────

describe('canStartShift', () => {
  const today = '2026-03-20'
  const station = 'station-1'

  const pending: ShiftRow = { station_id: station, period: 'morning', shift_date: today, status: 'pending' }
  const closed: ShiftRow  = { station_id: station, period: 'morning', shift_date: today, status: 'closed' }

  it('tracer bullet: no existing shifts → can start', () => {
    expect(canStartShift([], station, 'morning', today)).toBe(true)
  })

  it('pending slot for same station/period/date → cannot start', () => {
    expect(canStartShift([pending], station, 'morning', today)).toBe(false)
  })

  it('closed slot for same station/period/date → cannot start', () => {
    expect(canStartShift([closed], station, 'morning', today)).toBe(false)
  })

  it('pending slot for different period → can start', () => {
    const eveningPending: ShiftRow = { ...pending, period: 'evening' }
    expect(canStartShift([eveningPending], station, 'morning', today)).toBe(true)
  })

  it('pending slot for different station → can start', () => {
    const otherStation: ShiftRow = { ...pending, station_id: 'station-2' }
    expect(canStartShift([otherStation], station, 'morning', today)).toBe(true)
  })

  it('pending slot for different date → can start', () => {
    const yesterday: ShiftRow = { ...pending, shift_date: '2026-03-19' }
    expect(canStartShift([yesterday], station, 'morning', today)).toBe(true)
  })
})

// ── getShiftProgress ──────────────────────────────────────────────────────────

describe('getShiftProgress', () => {
  const pumps  = ['p1', 'p2', 'p3']
  const tanks  = ['t1', 't2']

  it('tracer bullet: nothing done → 0/3 pumps, 0/2 tanks, not complete', () => {
    const progress = getShiftProgress(pumps, [], tanks, [])
    expect(progress.pumps).toEqual({ done: 0, total: 3 })
    expect(progress.tanks).toEqual({ done: 0, total: 2 })
    expect(progress.isComplete).toBe(false)
  })

  it('some pumps done → partial progress', () => {
    const progress = getShiftProgress(pumps, ['p1'], tanks, [])
    expect(progress.pumps).toEqual({ done: 1, total: 3 })
    expect(progress.isComplete).toBe(false)
  })

  it('all pumps done but no tanks → not complete', () => {
    const progress = getShiftProgress(pumps, ['p1', 'p2', 'p3'], tanks, [])
    expect(progress.pumps).toEqual({ done: 3, total: 3 })
    expect(progress.isComplete).toBe(false)
  })

  it('all pumps and all tanks done → complete', () => {
    const progress = getShiftProgress(pumps, ['p1', 'p2', 'p3'], tanks, ['t1', 't2'])
    expect(progress.isComplete).toBe(true)
  })

  it('no pumps in station (edge case) + all tanks done → complete', () => {
    const progress = getShiftProgress([], [], tanks, ['t1', 't2'])
    expect(progress.isComplete).toBe(true)
  })
})

// ── resolveShiftStatus ────────────────────────────────────────────────────────

describe('resolveShiftStatus', () => {
  it('incomplete progress → draft', () => {
    expect(resolveShiftStatus({ isComplete: false })).toBe('draft')
  })

  it('complete progress → open', () => {
    expect(resolveShiftStatus({ isComplete: true })).toBe('open')
  })
})
