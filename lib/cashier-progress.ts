// ── Types ─────────────────────────────────────────────────────────────────────

export type CashierProgressInput = {
  hasFuelPosSubmission: boolean
  hasDryStockPosSubmission: boolean
  activeProductCount: number
  stockReadingCount: number
}

export type CashierProgress = {
  fuelPos: boolean
  stockPos: boolean
  stockCount: boolean
}

// ── Pure functions ────────────────────────────────────────────────────────────

export function getCashierProgress(input: CashierProgressInput): CashierProgress {
  return {
    fuelPos: input.hasFuelPosSubmission,
    stockPos: input.hasDryStockPosSubmission,
    stockCount:
      input.activeProductCount === 0 ||
      input.stockReadingCount >= input.activeProductCount,
  }
}

export function canCashierSubmit(progress: CashierProgress): boolean {
  return progress.fuelPos && progress.stockPos && progress.stockCount
}
