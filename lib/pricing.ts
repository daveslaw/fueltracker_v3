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
  const asOfMs = new Date(asOf).getTime()

  const match = prices.find(p => {
    const fromMs = new Date(p.valid_from).getTime()
    const toMs   = p.valid_to ? new Date(p.valid_to).getTime() : null
    return fromMs <= asOfMs && (toMs === null || toMs > asOfMs)
  })

  return match
    ? { sell_price_per_litre: match.sell_price_per_litre, cost_per_litre: match.cost_per_litre }
    : null
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
  const newFromMs = new Date(newRow.valid_from).getTime()
  const newToMs   = newRow.valid_to ? new Date(newRow.valid_to).getTime() : null

  return existing.some(e => {
    const eFromMs = new Date(e.valid_from).getTime()
    const eToMs   = e.valid_to ? new Date(e.valid_to).getTime() : null

    // Existing ends at or before new starts → no overlap
    if (eToMs !== null && eToMs <= newFromMs) return false
    // New ends at or before existing starts → no overlap
    if (newToMs !== null && newToMs <= eFromMs) return false
    return true
  })
}
