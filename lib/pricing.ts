export interface PriceRow {
  fuel_grade_id:  string
  price_per_litre: number
  effective_from: string
}

/**
 * Pure function. Given a list of versioned price rows for a single grade,
 * returns the price_per_litre that was active at `asOf`, or null if none applies.
 *
 * Mirrors the SQL: WHERE effective_from <= asOf ORDER BY effective_from DESC LIMIT 1
 */
export function selectActivePriceAt(
  prices: PriceRow[],
  asOf: string
): number | null {
  const asOfMs = new Date(asOf).getTime()

  const applicable = prices
    .filter(p => new Date(p.effective_from).getTime() <= asOfMs)
    .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())

  return applicable.length > 0 ? applicable[0].price_per_litre : null
}
