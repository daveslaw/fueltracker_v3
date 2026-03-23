export interface ReconciliationInputs {
  tanks:        { id: string; fuel_grade_id: string }[]
  pumps:        { id: string; tank_id: string }[]
  openDips:     { tank_id: string; litres: number }[]
  closeDips:    { tank_id: string; litres: number }[]
  deliveries:   { tank_id: string; litres_received: number }[]
  pumpReadings: { pump_id: string; opening_reading: number; closing_reading: number }[]
  posLines:     { fuel_grade_id: string; litres_sold: number; revenue_zar: number }[]
  prices:       { fuel_grade_id: string; price_per_litre: number }[]
}

export interface TankLine {
  tank_id:              string
  opening_dip:          number
  deliveries_received:  number
  pos_litres_sold:      number
  expected_closing_dip: number
  actual_closing_dip:   number
  variance_litres:      number  // expected − actual; positive = loss
}

export interface GradeLine {
  fuel_grade_id:  string
  meter_delta:    number
  pos_litres_sold: number
  variance_litres: number  // meter_delta − pos_litres_sold
}

export interface ReconciliationOutput {
  tankLines:       TankLine[]
  gradeLines:      GradeLine[]
  expectedRevenue: number
  posRevenue:      number
  revenueVariance: number  // expected − pos
}

// Pure function — no I/O. All inputs provided by caller; caller resolves DB reads and price snapshots.
export function computeReconciliation(inputs: ReconciliationInputs): ReconciliationOutput {
  const { tanks, pumps, openDips, closeDips, deliveries, pumpReadings, posLines, prices } = inputs

  // Index helpers
  const posLineByGrade = new Map(posLines.map(l => [l.fuel_grade_id, l]))
  const priceByGrade   = new Map(prices.map(p => [p.fuel_grade_id, p.price_per_litre]))

  // ── Tank lines ────────────────────────────────────────────────────────────
  const tankLines: TankLine[] = tanks.map(t => {
    const openDip   = openDips.find(d => d.tank_id === t.id)?.litres ?? 0
    const closeDip  = closeDips.find(d => d.tank_id === t.id)?.litres ?? 0
    const received  = deliveries
      .filter(d => d.tank_id === t.id)
      .reduce((sum, d) => sum + d.litres_received, 0)
    const sold      = posLineByGrade.get(t.fuel_grade_id)?.litres_sold ?? 0
    const expected  = openDip + received - sold
    return {
      tank_id:              t.id,
      opening_dip:          openDip,
      deliveries_received:  received,
      pos_litres_sold:      sold,
      expected_closing_dip: expected,
      actual_closing_dip:   closeDip,
      variance_litres:      expected - closeDip,
    }
  })

  // ── Grade lines ───────────────────────────────────────────────────────────
  // Derive the set of grades that have at least one pump
  const gradeIds = [...new Set(tanks.map(t => t.fuel_grade_id))]
  const tanksByGrade = new Map(
    gradeIds.map(g => [g, tanks.filter(t => t.fuel_grade_id === g).map(t => t.id)])
  )

  const gradeLines: GradeLine[] = gradeIds.map(gradeId => {
    const tankIds     = tanksByGrade.get(gradeId) ?? []
    const pumpIds     = pumps.filter(p => tankIds.includes(p.tank_id)).map(p => p.id)
    const meterDelta  = pumpReadings
      .filter(r => pumpIds.includes(r.pump_id))
      .reduce((sum, r) => sum + (r.closing_reading - r.opening_reading), 0)
    const sold        = posLineByGrade.get(gradeId)?.litres_sold ?? 0
    return {
      fuel_grade_id:   gradeId,
      meter_delta:     meterDelta,
      pos_litres_sold: sold,
      variance_litres: meterDelta - sold,
    }
  })

  // ── Financial ─────────────────────────────────────────────────────────────
  const expectedRevenue = posLines.reduce((sum, l) => {
    const p = priceByGrade.get(l.fuel_grade_id) ?? 0
    return sum + l.litres_sold * p
  }, 0)
  const posRevenue = posLines.reduce((sum, l) => sum + l.revenue_zar, 0)

  return {
    tankLines,
    gradeLines,
    expectedRevenue,
    posRevenue,
    revenueVariance: expectedRevenue - posRevenue,
  }
}
