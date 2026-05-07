import { describe, it, expect } from 'vitest'
import { buildCashierSubmissionState } from '../lib/cashier-submission'

// ── buildCashierSubmissionState ───────────────────────────────────────────────

describe('buildCashierSubmissionState — submitted branch', () => {
  it('tracer bullet: non-null timestamp → submitted: true with submittedAt', () => {
    const state = buildCashierSubmissionState('2026-05-07T08:00:00Z', {
      hasFuelPosSubmission: true,
      hasDryStockPosSubmission: true,
      activeProductCount: 3,
      stockReadingCount: 3,
    })
    expect(state.submitted).toBe(true)
    if (state.submitted) expect(state.submittedAt).toBe('2026-05-07T08:00:00Z')
  })

  it('submitted: true even when progress input would be incomplete', () => {
    const state = buildCashierSubmissionState('2026-05-07T08:00:00Z', {
      hasFuelPosSubmission: false,
      hasDryStockPosSubmission: false,
      activeProductCount: 5,
      stockReadingCount: 0,
    })
    expect(state.submitted).toBe(true)
  })
})

describe('buildCashierSubmissionState — not submitted branch', () => {
  it('tracer bullet: null timestamp → submitted: false with correct progress', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: true,
      hasDryStockPosSubmission: true,
      activeProductCount: 3,
      stockReadingCount: 3,
    })
    expect(state.submitted).toBe(false)
    if (!state.submitted) {
      expect(state.progress.fuelPos).toBe(true)
      expect(state.progress.stockPos).toBe(true)
      expect(state.progress.stockCount).toBe(true)
    }
  })

  it('fuelPos false when no fuel POS submission', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: false,
      hasDryStockPosSubmission: true,
      activeProductCount: 3,
      stockReadingCount: 3,
    })
    if (!state.submitted) expect(state.progress.fuelPos).toBe(false)
  })

  it('stockPos false when no dry stock POS submission', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: true,
      hasDryStockPosSubmission: false,
      activeProductCount: 3,
      stockReadingCount: 3,
    })
    if (!state.submitted) expect(state.progress.stockPos).toBe(false)
  })

  it('stockCount true when activeProductCount is 0 (nothing to count)', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: true,
      hasDryStockPosSubmission: true,
      activeProductCount: 0,
      stockReadingCount: 0,
    })
    if (!state.submitted) expect(state.progress.stockCount).toBe(true)
  })

  it('stockCount false when stock readings are incomplete', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: true,
      hasDryStockPosSubmission: true,
      activeProductCount: 5,
      stockReadingCount: 3,
    })
    if (!state.submitted) expect(state.progress.stockCount).toBe(false)
  })

  it('all sections incomplete → all progress flags false', () => {
    const state = buildCashierSubmissionState(null, {
      hasFuelPosSubmission: false,
      hasDryStockPosSubmission: false,
      activeProductCount: 5,
      stockReadingCount: 0,
    })
    if (!state.submitted) {
      expect(state.progress.fuelPos).toBe(false)
      expect(state.progress.stockPos).toBe(false)
      expect(state.progress.stockCount).toBe(false)
    }
  })
})
