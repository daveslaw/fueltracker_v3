import { selectActiveAt, hasChangeInWindow, hasRangeOverlap } from './validity-window'

export interface PriceRow {
  station_id:           string
  fuel_grade_id:        string
  sell_price_per_litre: number
  cost_per_litre:       number
  valid_from:           string       // ISO timestamp; inclusive
  valid_to:             string | null // ISO timestamp; exclusive. null = open-ended
}

/**
 * Pure function. Given price rows pre-filtered to a single station and grade,
 * returns the sell and cost prices active at `asOf`, or null if none applies.
 *
 * Lookup rule: valid_from <= asOf AND (valid_to IS NULL OR valid_to > asOf)
 */
export function selectActivePriceAt(
  prices: PriceRow[],
  asOf: string,
): { sell_price_per_litre: number; cost_per_litre: number } | null {
  const match = selectActiveAt(prices, asOf)
  return match
    ? { sell_price_per_litre: match.sell_price_per_litre, cost_per_litre: match.cost_per_litre }
    : null
}

/**
 * Pure function. Returns true if any price row has a valid_from strictly
 * between startedAt (exclusive) and submittedAt (exclusive).
 */
export function hasPriceChangeDuringWindow(
  prices: Pick<PriceRow, 'valid_from'>[],
  startedAt: string,
  submittedAt: string,
): boolean {
  return hasChangeInWindow(prices, startedAt, submittedAt)
}

/**
 * Pure function. Returns true if `newRow` overlaps any row in `existing`.
 *
 * Two ranges overlap when one starts before the other ends.
 * valid_to is exclusive, so adjacent ranges (new.valid_from == existing.valid_to) do NOT overlap.
 */
export function hasPriceRangeOverlap(
  existing: Pick<PriceRow, 'valid_from' | 'valid_to'>[],
  newRow:   Pick<PriceRow, 'valid_from' | 'valid_to'>,
): boolean {
  return hasRangeOverlap(existing, newRow)
}
