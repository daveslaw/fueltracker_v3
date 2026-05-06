// ── Types ─────────────────────────────────────────────────────────────────────

export interface StockReconciliationInput {
  productId:     string
  openingCount:  number
  deliveries:    number   // units received during the shift
  posUnitsSold:  number
  actualClosing: number
  sellPrice:     number   // ZAR per unit (from products.sell_price)
}

export interface StockLine {
  product_id:             string
  opening_count:          number
  deliveries_received:    number
  pos_units_sold:         number
  expected_closing_count: number
  actual_closing_count:   number
  variance_units:         number  // actual − expected; negative = loss
  variance_zar:           number  // variance_units × sell_price; negative = revenue shortfall
}

// ── Pure function ─────────────────────────────────────────────────────────────

/**
 * Computes dry stock variance per product.
 *
 * Formula:
 *   expected_closing = opening + deliveries − pos_units_sold
 *   variance_units   = actual_closing − expected_closing  (negative = loss)
 *   variance_zar     = variance_units × sell_price
 *
 * No I/O — all inputs provided by caller.
 */
export function computeStockReconciliation(inputs: StockReconciliationInput[]): StockLine[] {
  return inputs.map(input => {
    const expected      = input.openingCount + input.deliveries - input.posUnitsSold
    const varianceUnits = input.actualClosing - expected
    return {
      product_id:             input.productId,
      opening_count:          input.openingCount,
      deliveries_received:    input.deliveries,
      pos_units_sold:         input.posUnitsSold,
      expected_closing_count: expected,
      actual_closing_count:   input.actualClosing,
      variance_units:         varianceUnits,
      variance_zar:           Math.round(varianceUnits * input.sellPrice * 100) / 100,
    }
  })
}
