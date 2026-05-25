export interface ReconciliationInputs {
  tanks:        { id: string; fuel_grade_id: string }[]
  pumps:        { id: string; tank_id: string }[]
  openDips:     { tank_id: string; litres: number }[]
  closeDips:    { tank_id: string; litres: number }[]
  deliveries:   { tank_id: string; litres_received: number }[]
  pumpReadings: { pump_id: string; opening_reading: number; closing_reading: number }[]
  posLines:     { pump_id: string; litres_sold: number; revenue_zar: number }[]
  prices:       { fuel_grade_id: string; sell_price_per_litre: number }[]
}

export interface TankLine {
  tank_id:              string
  opening_dip:          number
  deliveries_received:  number
  meter_delta:          number  // Σ(close − open) for pumps mapped to this tank
  expected_closing_dip: number
  actual_closing_dip:   number
  variance_litres:      number  // actual − expected; negative = inventory loss
}

export interface PumpLine {
  pump_id:              string
  fuel_grade_id:        string  // denormalised from pump → tank
  meter_delta_litres:   number  // close_reading − open_reading for this pump
  pos_litres_sold:      number
  variance_litres:      number  // pos_litres_sold − meter_delta_litres; negative = unrecorded dispensing
  sell_price_per_litre: number
  expected_revenue_zar: number  // meter_delta_litres × sell_price_per_litre
  pos_revenue_zar:      number
  variance_zar:         number  // pos_revenue_zar − expected_revenue_zar; negative = revenue shortfall
}

export interface ReconciliationOutput {
  tankLines: TankLine[]
  pumpLines: PumpLine[]
}

// Pure function — no I/O. All inputs provided by caller; caller resolves DB reads and price snapshots.
export function computeReconciliation(inputs: ReconciliationInputs): ReconciliationOutput {
  const { tanks, pumps, openDips, closeDips, deliveries, pumpReadings, posLines, prices } = inputs

  const tankByPump    = new Map(pumps.map(p => [p.id, tanks.find(t => t.id === p.tank_id)]))
  const posLineByPump = new Map(posLines.map(l => [l.pump_id, l]))
  const priceByGrade  = new Map(prices.map(p => [p.fuel_grade_id, p.sell_price_per_litre]))

  // ── Tank lines (Formula 1) ────────────────────────────────────────────────
  // Expected Closing Dip = Opening Dip + Deliveries − Meter Delta (per tank)
  // variance_litres = actual − expected  (negative = loss)
  const tankLines: TankLine[] = tanks.map(t => {
    const openDip    = openDips.find(d => d.tank_id === t.id)?.litres ?? 0
    const closeDip   = closeDips.find(d => d.tank_id === t.id)?.litres ?? 0
    const received   = deliveries
      .filter(d => d.tank_id === t.id)
      .reduce((sum, d) => sum + d.litres_received, 0)
    const pumpIds    = pumps.filter(p => p.tank_id === t.id).map(p => p.id)
    const meterDelta = pumpReadings
      .filter(r => pumpIds.includes(r.pump_id))
      .reduce((sum, r) => sum + (r.closing_reading - r.opening_reading), 0)
    const expected   = openDip + received - meterDelta
    return {
      tank_id:              t.id,
      opening_dip:          openDip,
      deliveries_received:  received,
      meter_delta:          meterDelta,
      expected_closing_dip: expected,
      actual_closing_dip:   closeDip,
      variance_litres:      closeDip - expected,
    }
  })

  // ── Pump lines (Formula 2) ────────────────────────────────────────────────
  // One line per pump. Grade derived from pump → tank.
  // variance_litres = pos_litres_sold − meter_delta_litres  (negative = unrecorded dispensing)
  // expected_revenue_zar = meter_delta_litres × price_per_litre
  // variance_zar = pos_revenue_zar − expected_revenue_zar  (negative = shortfall)
  const pumpLines: PumpLine[] = pumps.map(p => {
    const tank          = tankByPump.get(p.id)
    const gradeId       = tank?.fuel_grade_id ?? ''
    const reading       = pumpReadings.find(r => r.pump_id === p.id)
    const meterDelta    = reading ? reading.closing_reading - reading.opening_reading : 0
    const posLine       = posLineByPump.get(p.id)
    const sold          = posLine?.litres_sold ?? 0
    const posRevenue    = posLine?.revenue_zar ?? 0
    const sellPrice     = priceByGrade.get(gradeId) ?? 0
    const expectedRev   = meterDelta * sellPrice
    return {
      pump_id:              p.id,
      fuel_grade_id:        gradeId,
      meter_delta_litres:   meterDelta,
      pos_litres_sold:      sold,
      variance_litres:      sold - meterDelta,
      sell_price_per_litre: sellPrice,
      expected_revenue_zar: expectedRev,
      pos_revenue_zar:      posRevenue,
      variance_zar:         posRevenue - expectedRev,
    }
  })

  return { tankLines, pumpLines }
}
