import { describe, it, expect } from 'vitest'
import { getCashierProgress, canCashierSubmit } from '@/lib/cashier-progress'
import type { CashierProgressInput } from '@/lib/cashier-progress'

const complete: CashierProgressInput = {
  hasFuelPosSubmission: true,
  hasDryStockPosSubmission: true,
  activeProductCount: 3,
  stockReadingCount: 3,
}

// ── getCashierProgress ────────────────────────────────────────────────────────

describe('getCashierProgress', () => {
  it('tracer bullet: all sections complete → all flags true', () => {
    const progress = getCashierProgress(complete)
    expect(progress.fuelPos).toBe(true)
    expect(progress.stockPos).toBe(true)
    expect(progress.stockCount).toBe(true)
  })

  it('no fuel POS submission → fuelPos false', () => {
    const progress = getCashierProgress({ ...complete, hasFuelPosSubmission: false })
    expect(progress.fuelPos).toBe(false)
  })

  it('no dry stock POS submission → stockPos false', () => {
    const progress = getCashierProgress({ ...complete, hasDryStockPosSubmission: false })
    expect(progress.stockPos).toBe(false)
  })

  it('stock reading count less than active product count → stockCount false', () => {
    const progress = getCashierProgress({ ...complete, activeProductCount: 3, stockReadingCount: 2 })
    expect(progress.stockCount).toBe(false)
  })

  it('stock reading count equals active product count → stockCount true', () => {
    const progress = getCashierProgress({ ...complete, activeProductCount: 3, stockReadingCount: 3 })
    expect(progress.stockCount).toBe(true)
  })

  it('zero active products → stockCount true (nothing to count)', () => {
    const progress = getCashierProgress({ ...complete, activeProductCount: 0, stockReadingCount: 0 })
    expect(progress.stockCount).toBe(true)
  })

  it('all sections incomplete → all flags false', () => {
    const progress = getCashierProgress({
      hasFuelPosSubmission: false,
      hasDryStockPosSubmission: false,
      activeProductCount: 5,
      stockReadingCount: 0,
    })
    expect(progress.fuelPos).toBe(false)
    expect(progress.stockPos).toBe(false)
    expect(progress.stockCount).toBe(false)
  })
})

// ── canCashierSubmit ──────────────────────────────────────────────────────────

describe('canCashierSubmit', () => {
  it('tracer bullet: all sections complete → true', () => {
    const progress = getCashierProgress(complete)
    expect(canCashierSubmit(progress)).toBe(true)
  })

  it('fuelPos incomplete → false', () => {
    expect(canCashierSubmit({ fuelPos: false, stockPos: true, stockCount: true })).toBe(false)
  })

  it('stockPos incomplete → false', () => {
    expect(canCashierSubmit({ fuelPos: true, stockPos: false, stockCount: true })).toBe(false)
  })

  it('stockCount incomplete → false', () => {
    expect(canCashierSubmit({ fuelPos: true, stockPos: true, stockCount: false })).toBe(false)
  })

  it('all sections incomplete → false', () => {
    expect(canCashierSubmit({ fuelPos: false, stockPos: false, stockCount: false })).toBe(false)
  })

  it('two of three complete → false', () => {
    expect(canCashierSubmit({ fuelPos: true, stockPos: true, stockCount: false })).toBe(false)
    expect(canCashierSubmit({ fuelPos: true, stockPos: false, stockCount: true })).toBe(false)
    expect(canCashierSubmit({ fuelPos: false, stockPos: true, stockCount: true })).toBe(false)
  })
})
