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
