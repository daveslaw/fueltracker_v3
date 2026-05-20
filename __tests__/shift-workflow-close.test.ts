import { describe, it, expect, vi } from 'vitest'
import { runShiftCloseWith } from '../lib/shift-workflow'
import type { ShiftCloseBundle, ShiftCloseRepository } from '../lib/shift-workflow'

// ── Fixture builder ────────────────────────────────────────────────────────────

function makeBundle(overrides: Partial<ShiftCloseBundle> = {}): ShiftCloseBundle {
  return {
    shift: {
      station_id: 'station-1',
      status:     'pending',
      part:       0,
      started_at: '2026-05-20T06:00:00Z',
    },
    cashierSubmitted: true,
    pumpIds:          ['p1', 'p2'],
    closedPumpIds:    ['p1', 'p2'],
    tankIds:          ['t1'],
    closedTankIds:    ['t1'],
    priceWindows:     [],
    ...overrides,
  }
}

function makeRepo(overrides: Partial<ShiftCloseRepository> = {}): ShiftCloseRepository {
  return {
    loadCloseBundle: async () => makeBundle(),
    closeShift:      async () => ({}),
    ...overrides,
  }
}

const noopReconcile = async () => ({})

// ── runShiftCloseWith ─────────────────────────────────────────────────────────

describe('runShiftCloseWith — happy path', () => {
  it('returns success when all conditions are met', async () => {
    const result = await runShiftCloseWith('shift-1', makeRepo(), noopReconcile)
    expect(result).toEqual({ success: true })
  })
})

describe('runShiftCloseWith — shift not found', () => {
  it('returns error when bundle is null', async () => {
    const repo = makeRepo({ loadCloseBundle: async () => null })
    const result = await runShiftCloseWith('missing', repo, noopReconcile)
    expect(result).toEqual({ error: 'Shift not found' })
  })
})

describe('runShiftCloseWith — cashier not submitted', () => {
  it('returns error when cashierSubmitted is false', async () => {
    const repo = makeRepo({ loadCloseBundle: async () => makeBundle({ cashierSubmitted: false }) })
    const result = await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/cashier/i)
  })
})

describe('runShiftCloseWith — status not pending', () => {
  it('returns error when shift is already closed', async () => {
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({ shift: { station_id: 'station-1', status: 'closed', part: 0, started_at: '2026-05-20T06:00:00Z' } }),
    })
    const result = await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
  })
})

describe('runShiftCloseWith — incomplete readings', () => {
  it('returns error when pump readings are incomplete', async () => {
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({ closedPumpIds: ['p1'] }), // missing p2
    })
    const result = await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/readings/i)
  })

  it('returns error when tank dip readings are incomplete', async () => {
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({ closedTankIds: [] }), // missing t1
    })
    const result = await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/readings/i)
  })
})

describe('runShiftCloseWith — price-change auto-flag', () => {
  it('calls closeShift with is_flagged:true when price changes in window (part 0)', async () => {
    const captured: Parameters<ShiftCloseRepository['closeShift']>[] = []
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({
        shift: { station_id: 'station-1', status: 'pending', part: 0, started_at: '2026-05-20T06:00:00Z' },
        priceWindows: [{ valid_from: '2026-05-20T07:00:00Z' }], // within window
      }),
      closeShift: async (id, update) => { captured.push([id, update]); return {} },
    })
    await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect(captured[0][1].is_flagged).toBe(true)
    expect(captured[0][1].flag_comment).toMatch(/price change/i)
  })

  it('does NOT set auto-flag when part !== 0 (already a split shift)', async () => {
    const captured: Parameters<ShiftCloseRepository['closeShift']>[] = []
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({
        shift: { station_id: 'station-1', status: 'pending', part: 1, started_at: '2026-05-20T06:00:00Z' },
        priceWindows: [{ valid_from: '2026-05-20T07:00:00Z' }],
      }),
      closeShift: async (id, update) => { captured.push([id, update]); return {} },
    })
    await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect(captured[0][1].is_flagged).toBeUndefined()
  })

  it('does NOT set auto-flag when no price change in window', async () => {
    const captured: Parameters<ShiftCloseRepository['closeShift']>[] = []
    const repo = makeRepo({
      loadCloseBundle: async () => makeBundle({
        priceWindows: [{ valid_from: '2026-05-19T00:00:00Z' }], // before shift started
      }),
      closeShift: async (id, update) => { captured.push([id, update]); return {} },
    })
    await runShiftCloseWith('shift-1', repo, noopReconcile)
    expect(captured[0][1].is_flagged).toBeUndefined()
  })
})

describe('runShiftCloseWith — reconciliation failure', () => {
  it('returns success with warning when reconciliation fails after close', async () => {
    const failingReconcile = async () => ({ error: 'DB timeout' })
    const result = await runShiftCloseWith('shift-1', makeRepo(), failingReconcile)
    expect('success' in result).toBe(true)
    expect((result as { success: true; warning?: string }).warning).toMatch(/reconciliation failed/i)
  })
})
