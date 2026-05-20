import { describe, it, expect, vi } from 'vitest'
import { runShiftSplitWith } from '../lib/shift-workflow'
import type { ShiftSplitBundle, ShiftSplitRepository } from '../lib/shift-workflow'

// ── Fixture builder ────────────────────────────────────────────────────────────

function makeBundle(overrides: Partial<ShiftSplitBundle> = {}): ShiftSplitBundle {
  return {
    id:           'shift-1',
    station_id:   'station-1',
    period:       'morning',
    shift_date:   '2026-05-20',
    supervisor_id: 'super-1',
    status:       'pending',
    part:         0,
    ...overrides,
  }
}

function makeRepo(overrides: Partial<ShiftSplitRepository> = {}): ShiftSplitRepository {
  return {
    loadSplitBundle: async () => makeBundle(),
    closePart1:      async () => ({}),
    createPart2:     async () => ({ id: 'shift-2' }),
    ...overrides,
  }
}

const noopReconcile = async () => ({})

// ── runShiftSplitWith ─────────────────────────────────────────────────────────

describe('runShiftSplitWith — happy path', () => {
  it('returns part2ShiftId on full success', async () => {
    const result = await runShiftSplitWith('shift-1', makeRepo(), noopReconcile)
    expect(result).toEqual({ part2ShiftId: 'shift-2' })
  })
})

describe('runShiftSplitWith — shift not found', () => {
  it('returns error when bundle is null', async () => {
    const repo = makeRepo({ loadSplitBundle: async () => null })
    const result = await runShiftSplitWith('missing', repo, noopReconcile)
    expect(result).toEqual({ error: 'Shift not found' })
  })
})

describe('runShiftSplitWith — canSplitShift guard', () => {
  it('returns error when shift is already closed', async () => {
    const repo = makeRepo({ loadSplitBundle: async () => makeBundle({ status: 'closed' }) })
    const result = await runShiftSplitWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
  })

  it('returns error when shift is already a split part (part !== 0)', async () => {
    const repo = makeRepo({ loadSplitBundle: async () => makeBundle({ part: 1 }) })
    const result = await runShiftSplitWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
  })
})

describe('runShiftSplitWith — closePart1 failure', () => {
  it('returns error when closePart1 fails', async () => {
    const repo = makeRepo({ closePart1: async () => ({ error: 'DB write failed' }) })
    const result = await runShiftSplitWith('shift-1', repo, noopReconcile)
    expect(result).toEqual({ error: 'DB write failed' })
  })
})

describe('runShiftSplitWith — reconciliation failure', () => {
  it('returns part2ShiftId with warning when reconciliation fails', async () => {
    const failReconcile = async () => ({ error: 'connection lost' })
    const result = await runShiftSplitWith('shift-1', makeRepo(), failReconcile)
    expect('part2ShiftId' in result).toBe(true)
    expect((result as { part2ShiftId: string; warning?: string }).warning).toMatch(/reconciliation failed/i)
  })

  it('calls createPart2 even when reconciliation fails', async () => {
    const createPart2 = vi.fn(async () => ({ id: 'shift-2' }))
    const repo = makeRepo({ createPart2 })
    await runShiftSplitWith('shift-1', repo, async () => ({ error: 'timeout' }))
    expect(createPart2).toHaveBeenCalledOnce()
  })
})
