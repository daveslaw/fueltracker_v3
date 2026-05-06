import { describe, it, expect } from 'vitest'
import { canStartShift, getShiftProgress, resolveShiftStatus, computeShiftLabel, markFirstPartSplit } from '@/lib/shift-open'
import type { ShiftRow } from '@/lib/shift-open'

// ── canStartShift ─────────────────────────────────────────────────────────────

describe('canStartShift', () => {
  const today = '2026-03-20'
  const station = 'station-1'

  const pending: ShiftRow = { station_id: station, period: 'morning', shift_date: today, status: 'pending', part: 0 }
  const closed: ShiftRow  = { station_id: station, period: 'morning', shift_date: today, status: 'closed', part: 0 }

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

  it('part-0 pending exists → cannot start part-0 again', () => {
    expect(canStartShift([pending], station, 'morning', today, 0)).toBe(false)
  })

  it('part-1 closed exists → can start part-2', () => {
    const part1Closed: ShiftRow = { ...closed, part: 1 }
    expect(canStartShift([part1Closed], station, 'morning', today, 2)).toBe(true)
  })

  it('part-1 pending exists → cannot start part-1 again', () => {
    const part1Pending: ShiftRow = { ...pending, part: 1 }
    expect(canStartShift([part1Pending], station, 'morning', today, 1)).toBe(false)
  })

  it('part-1 pending exists → can still start part-2', () => {
    const part1Pending: ShiftRow = { ...pending, part: 1 }
    expect(canStartShift([part1Pending], station, 'morning', today, 2)).toBe(true)
  })
})

// ── markFirstPartSplit ────────────────────────────────────────────────────────

describe('markFirstPartSplit', () => {
  const today = '2026-03-20'
  const station = 'station-1'

  const shift0: ShiftRow = { station_id: station, period: 'morning', shift_date: today, status: 'closed', part: 0 }

  it('tracer bullet: part-0 shift becomes part-1', () => {
    const result = markFirstPartSplit([shift0], station, 'morning', today)
    expect(result[0].part).toBe(1)
  })

  it('only mutates matching station/period/date', () => {
    const other: ShiftRow = { station_id: 'other', period: 'morning', shift_date: today, status: 'closed', part: 0 }
    const result = markFirstPartSplit([shift0, other], station, 'morning', today)
    expect(result[0].part).toBe(1)
    expect(result[1].part).toBe(0)
  })

  it('does not mutate a shift that is already part-1', () => {
    const shift1: ShiftRow = { ...shift0, part: 1 }
    const result = markFirstPartSplit([shift1], station, 'morning', today)
    expect(result[0].part).toBe(1)
  })

  it('returns new array (does not mutate input)', () => {
    const input = [shift0]
    const result = markFirstPartSplit(input, station, 'morning', today)
    expect(input[0].part).toBe(0)
    expect(result[0].part).toBe(1)
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

// ── computeShiftLabel ─────────────────────────────────────────────────────────

describe('computeShiftLabel', () => {
  it('tracer bullet: morning part 0 → "Morning"', () => {
    expect(computeShiftLabel('morning', 0)).toBe('Morning')
  })

  it('morning part 1 → "Morning Part 1"', () => {
    expect(computeShiftLabel('morning', 1)).toBe('Morning Part 1')
  })

  it('morning part 2 → "Morning Part 2"', () => {
    expect(computeShiftLabel('morning', 2)).toBe('Morning Part 2')
  })

  it('evening part 0 → "Evening"', () => {
    expect(computeShiftLabel('evening', 0)).toBe('Evening')
  })

  it('evening part 1 → "Evening Part 1"', () => {
    expect(computeShiftLabel('evening', 1)).toBe('Evening Part 1')
  })

  it('evening part 2 → "Evening Part 2"', () => {
    expect(computeShiftLabel('evening', 2)).toBe('Evening Part 2')
  })
})
