import type { ShiftStatus, ShiftPeriod } from '@/lib/shift-open'
export type { ShiftStatus, ShiftPeriod }

// ── buildStationDayStatus ─────────────────────────────────────────────────

export interface StationDayStatus {
  morning: ShiftStatus | 'not_started'
  evening: ShiftStatus | 'not_started'
}

export function buildStationDayStatus(
  shifts: Array<{ period: ShiftPeriod; status: ShiftStatus }>,
): StationDayStatus {
  const find = (period: ShiftPeriod) =>
    shifts.find(s => s.period === period)?.status ?? 'not_started'
  return { morning: find('morning'), evening: find('evening') }
}

// ── buildFinancialLines ───────────────────────────────────────────────────

export interface PosLine {
  fuel_grade_id: string
  litres_sold: number
  revenue_zar: number
}

export interface FuelPrice {
  fuel_grade_id:        string
  sell_price_per_litre: number
}

export interface FinancialLine {
  fuel_grade_id:        string
  litres_sold:          number
  sell_price_per_litre: number
  expected_revenue_zar: number
  pos_revenue_zar:      number
  variance_zar:         number
}

export interface FinancialTotals {
  expected_revenue_zar: number
  pos_revenue_zar: number
  variance_zar: number
}

export interface FinancialReport {
  lines: FinancialLine[]
  totals: FinancialTotals
}

export function buildFinancialLines(
  posLines: PosLine[],
  prices: FuelPrice[],
): FinancialReport {
  const priceMap = new Map(prices.map(p => [p.fuel_grade_id, p.sell_price_per_litre]))

  const lines: FinancialLine[] = posLines.map(pl => {
    const sell_price_per_litre = priceMap.get(pl.fuel_grade_id) ?? 0
    const expected = Math.round(pl.litres_sold * sell_price_per_litre * 100) / 100
    return {
      fuel_grade_id: pl.fuel_grade_id,
      litres_sold: pl.litres_sold,
      sell_price_per_litre,
      expected_revenue_zar: expected,
      pos_revenue_zar: pl.revenue_zar,
      variance_zar: Math.round((expected - pl.revenue_zar) * 100) / 100,
    }
  })

  const totals: FinancialTotals = lines.reduce(
    (acc, l) => ({
      expected_revenue_zar: Math.round((acc.expected_revenue_zar + l.expected_revenue_zar) * 100) / 100,
      pos_revenue_zar: Math.round((acc.pos_revenue_zar + l.pos_revenue_zar) * 100) / 100,
      variance_zar: Math.round((acc.variance_zar + l.variance_zar) * 100) / 100,
    }),
    { expected_revenue_zar: 0, pos_revenue_zar: 0, variance_zar: 0 },
  )

  return { lines, totals }
}

// ── countPendingShiftsPerStation ──────────────────────────────────────────

/**
 * Given a list of shift rows from any number of stations, returns a map of
 * station_id → count of shifts with status 'pending'.
 * Used by the owner dashboard to show outstanding shift slots per station.
 */
export function countPendingShiftsPerStation(
  shifts: Array<{ station_id: string; status: string }>
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of shifts) {
    if (s.status === 'pending') {
      counts[s.station_id] = (counts[s.station_id] ?? 0) + 1
    }
  }
  return counts
}

// ── buildDailyFuelReport ──────────────────────────────────────────────────

export interface DailyFuelGradeInput {
  date:                 string
  fuel_grade_id:        string
  opening_dip:          number
  deliveries_litres:    number
  delivery_note:        string | null
  driver_name:          string | null
  pos_litres:           number
  variance_litres:      number
  cost_per_litre:       number
  sell_price_per_litre: number
}

export interface DailyFuelGradeRow extends DailyFuelGradeInput {
  accumulated_variance: number
  gp_zar:              number
}

export function buildDailyFuelReport(inputs: DailyFuelGradeInput[]): DailyFuelGradeRow[] {
  const accumulators = new Map<string, number>()

  return inputs.map(row => {
    const acc = (accumulators.get(row.fuel_grade_id) ?? 0) + row.variance_litres
    accumulators.set(row.fuel_grade_id, acc)

    const gp_zar = Math.round((row.sell_price_per_litre - row.cost_per_litre) * row.pos_litres * 100) / 100

    return { ...row, accumulated_variance: acc, gp_zar }
  })
}

// ── computePriceChangeImpact ──────────────────────────────────────────────

export interface PriceChangeBoundary {
  station_id:         string
  fuel_grade_id:      string
  closing_dip_litres: number
  old_cost_per_litre: number
  new_cost_per_litre: number
}

export interface PriceChangeImpactRow {
  station_id:    string
  fuel_grade_id: string
  impact_zar:    number
}

/**
 * Gain/loss from a fuel cost price change.
 * Formula: closing_dip_litres × (new_cost - old_cost) per boundary.
 * Positive = inventory gain; negative = inventory loss.
 */
export function computePriceChangeImpact(boundaries: PriceChangeBoundary[]): PriceChangeImpactRow[] {
  return boundaries.map(b => ({
    station_id:    b.station_id,
    fuel_grade_id: b.fuel_grade_id,
    impact_zar:    Math.round(b.closing_dip_litres * (b.new_cost_per_litre - b.old_cost_per_litre) * 100) / 100,
  }))
}

// ── buildInventorySnapshot ────────────────────────────────────────────────

export interface InventorySnapshotInput {
  station_id:         string
  fuel_grade_id:      string
  closing_dip_litres: number
  cost_per_litre:     number
}

export interface InventorySnapshotRow {
  station_id:     string
  fuel_grade_id:  string
  litres:         number
  cost_per_litre: number
  total_value_zar: number
}

export function buildInventorySnapshot(inputs: InventorySnapshotInput[]): InventorySnapshotRow[] {
  return inputs.map(row => ({
    station_id:      row.station_id,
    fuel_grade_id:   row.fuel_grade_id,
    litres:          row.closing_dip_litres,
    cost_per_litre:  row.cost_per_litre,
    total_value_zar: Math.round(row.closing_dip_litres * row.cost_per_litre * 100) / 100,
  }))
}

// ── isReportPartial ───────────────────────────────────────────────────────

const COMPLETE_STATUSES: Array<ShiftStatus | 'not_started'> = ['submitted', 'approved', 'flagged', 'closed']

export function isReportPartial(status: ShiftStatus | 'not_started'): boolean {
  return !COMPLETE_STATUSES.includes(status)
}
