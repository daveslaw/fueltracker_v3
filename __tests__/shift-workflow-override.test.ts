import { describe, it, expect, vi } from 'vitest'
import { runShiftOverrideWith } from '../lib/shift-workflow'
import type { ShiftOverrideData, ShiftOverrideRepository } from '../lib/shift-workflow'

// ── Fixture builder ────────────────────────────────────────────────────────────

function makeData(overrides: Partial<ShiftOverrideData> = {}): ShiftOverrideData {
  return {
    readingId:     'reading-1',
    readingType:   'pump',
    fieldName:     null,
    overrideValue: 52500,
    originalValue: 52000,
    reason:        'Corrected OCR misread',
    overriddenBy:  'profile-1',
    ...overrides,
  }
}

function makeRepo(overrides: Partial<ShiftOverrideRepository> = {}): ShiftOverrideRepository {
  return {
    loadOverrideBundle: async () => ({ status: 'closed' }),
    applyMutation:      async () => ({}),
    insertAuditRecord:  async () => ({}),
    setManualEntry:     async () => ({}),
    ...overrides,
  }
}

const noopReconcile = async () => ({})

// ── runShiftOverrideWith ───────────────────────────────────────────────────────

describe('runShiftOverrideWith — happy path', () => {
  it('returns success on a valid pump override', async () => {
    const result = await runShiftOverrideWith('shift-1', makeData(), makeRepo(), noopReconcile)
    expect(result).toEqual({ success: true })
  })
})

describe('runShiftOverrideWith — shift not found', () => {
  it('returns error when bundle is null', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => null })
    const result = await runShiftOverrideWith('missing', makeData(), repo, noopReconcile)
    expect(result).toEqual({ error: 'Shift not found' })
  })
})

describe('runShiftOverrideWith — canOverride guard', () => {
  it('returns error when shift is pending (not closed)', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'pending' }) })
    const result = await runShiftOverrideWith('shift-1', makeData(), repo, noopReconcile)
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/closed/i)
  })
})

describe('runShiftOverrideWith — validateOverride', () => {
  it('returns error when overrideValue is negative', async () => {
    const result = await runShiftOverrideWith('shift-1', makeData({ overrideValue: -1 }), makeRepo(), noopReconcile)
    expect('error' in result).toBe(true)
  })

  it('returns error when reason is empty', async () => {
    const result = await runShiftOverrideWith('shift-1', makeData({ reason: '  ' }), makeRepo(), noopReconcile)
    expect('error' in result).toBe(true)
  })

  it('returns error for pos_line override with invalid fieldName', async () => {
    const result = await runShiftOverrideWith(
      'shift-1',
      makeData({ readingType: 'pos_line', fieldName: 'bad_field' }),
      makeRepo(),
      noopReconcile,
    )
    expect('error' in result).toBe(true)
  })
})

describe('runShiftOverrideWith — applyMutation routing', () => {
  it('calls applyMutation with pump readingType', async () => {
    const applyMutation = vi.fn(async () => ({}))
    await runShiftOverrideWith('shift-1', makeData({ readingType: 'pump' }), makeRepo({ applyMutation }), noopReconcile)
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ readingType: 'pump' }))
  })

  it('calls applyMutation with dip readingType', async () => {
    const applyMutation = vi.fn(async () => ({}))
    await runShiftOverrideWith('shift-1', makeData({ readingType: 'dip' }), makeRepo({ applyMutation }), noopReconcile)
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ readingType: 'dip' }))
  })

  it('calls applyMutation with pos_line readingType and fieldName', async () => {
    const applyMutation = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'pos_line', fieldName: 'litres_sold' })
    await runShiftOverrideWith('shift-1', data, makeRepo({ applyMutation }), noopReconcile)
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ readingType: 'pos_line', fieldName: 'litres_sold' }))
  })

  it('calls applyMutation with dry_stock_line readingType and fieldName', async () => {
    const applyMutation = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'dry_stock_line', fieldName: 'units_sold' })
    await runShiftOverrideWith('shift-1', data, makeRepo({ applyMutation }), noopReconcile)
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ readingType: 'dry_stock_line', fieldName: 'units_sold' }))
  })

  it('calls applyMutation with stock_reading readingType', async () => {
    const applyMutation = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'stock_reading', fieldName: null })
    await runShiftOverrideWith('shift-1', data, makeRepo({ applyMutation }), noopReconcile)
    expect(applyMutation).toHaveBeenCalledWith(expect.objectContaining({ readingType: 'stock_reading' }))
  })
})

describe('runShiftOverrideWith — audit record', () => {
  it('calls insertAuditRecord with the overriddenBy value passed in', async () => {
    const insertAuditRecord = vi.fn(async () => ({}))
    const data = makeData({ overriddenBy: 'profile-xyz' })
    await runShiftOverrideWith('shift-1', data, makeRepo({ insertAuditRecord }), noopReconcile)
    expect(insertAuditRecord).toHaveBeenCalledWith('shift-1', expect.objectContaining({ overriddenBy: 'profile-xyz' }))
  })
})

describe('runShiftOverrideWith — reconciliation failure', () => {
  it('returns success with warning when reconciliation fails after override', async () => {
    const failReconcile = async () => ({ error: 'timeout' })
    const result = await runShiftOverrideWith('shift-1', makeData(), makeRepo(), failReconcile)
    expect('success' in result).toBe(true)
    expect((result as { success: true; warning?: string }).warning).toMatch(/reconciliation failed/i)
  })
})

describe('runShiftOverrideWith — allowPending flag', () => {
  it('tracer bullet: allowPending: true succeeds on a pending shift', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'pending' }) })
    const result = await runShiftOverrideWith('shift-1', makeData(), repo, noopReconcile, { allowPending: true })
    expect(result).toEqual({ success: true })
  })

  it('allowPending: true also succeeds on a closed shift', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'closed' }) })
    const result = await runShiftOverrideWith('shift-1', makeData(), repo, noopReconcile, { allowPending: true })
    expect(result).toEqual({ success: true })
  })

  it('without allowPending, pending shift still returns error (existing guard preserved)', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'pending' }) })
    const result = await runShiftOverrideWith('shift-1', makeData(), repo, noopReconcile)
    expect('error' in result).toBe(true)
  })

  it('allowPending: true still validates override data (negative value rejected)', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'pending' }) })
    const result = await runShiftOverrideWith('shift-1', makeData({ overrideValue: -1 }), repo, noopReconcile, { allowPending: true })
    expect('error' in result).toBe(true)
  })

  it('allowPending: true + reconciliation failure → success with warning', async () => {
    const repo = makeRepo({ loadOverrideBundle: async () => ({ status: 'pending' }) })
    const failReconcile = async () => ({ error: 'timeout' })
    const result = await runShiftOverrideWith('shift-1', makeData(), repo, failReconcile, { allowPending: true })
    expect('success' in result).toBe(true)
    expect((result as { success: true; warning?: string }).warning).toMatch(/reconciliation failed/i)
  })
})

// ── setManualEntry — pump and pos_line triggers ────────────────────────────────

describe('runShiftOverrideWith — setManualEntry called for pump and pos_line', () => {
  it('tracer bullet: calls setManualEntry for pump readingType', async () => {
    const setManualEntry = vi.fn(async () => ({}))
    await runShiftOverrideWith('shift-1', makeData({ readingType: 'pump' }), makeRepo({ setManualEntry }), noopReconcile)
    expect(setManualEntry).toHaveBeenCalledWith('shift-1')
  })

  it('calls setManualEntry for pos_line readingType', async () => {
    const setManualEntry = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'pos_line', fieldName: 'litres_sold' })
    await runShiftOverrideWith('shift-1', data, makeRepo({ setManualEntry }), noopReconcile)
    expect(setManualEntry).toHaveBeenCalledWith('shift-1')
  })

  it('does NOT call setManualEntry for dip readingType', async () => {
    const setManualEntry = vi.fn(async () => ({}))
    await runShiftOverrideWith('shift-1', makeData({ readingType: 'dip' }), makeRepo({ setManualEntry }), noopReconcile)
    expect(setManualEntry).not.toHaveBeenCalled()
  })

  it('does NOT call setManualEntry for dry_stock_line readingType', async () => {
    const setManualEntry = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'dry_stock_line', fieldName: 'units_sold' })
    await runShiftOverrideWith('shift-1', data, makeRepo({ setManualEntry }), noopReconcile)
    expect(setManualEntry).not.toHaveBeenCalled()
  })

  it('does NOT call setManualEntry for stock_reading readingType', async () => {
    const setManualEntry = vi.fn(async () => ({}))
    const data = makeData({ readingType: 'stock_reading', fieldName: null })
    await runShiftOverrideWith('shift-1', data, makeRepo({ setManualEntry }), noopReconcile)
    expect(setManualEntry).not.toHaveBeenCalled()
  })

  it('returns error when setManualEntry fails', async () => {
    const setManualEntry = vi.fn(async () => ({ error: 'db write failed' }))
    const result = await runShiftOverrideWith('shift-1', makeData({ readingType: 'pump' }), makeRepo({ setManualEntry }), noopReconcile)
    expect(result).toEqual({ error: 'db write failed' })
  })
})
