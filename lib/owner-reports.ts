import type { ShiftStatus, ShiftPeriod, ShiftPart } from '@/lib/shift-open'
import { computeShiftLabel } from '@/lib/shift-open'
export type { ShiftStatus, ShiftPeriod }

// ── buildStationDayStatus ─────────────────────────────────────────────────

export interface EveningEntry {
  part:   ShiftPart
  status: ShiftStatus | 'not_started'
  label:  string
}

export interface StationDayStatus {
  morning: ShiftStatus | 'not_started'
  evening: EveningEntry[]
}

export function buildStationDayStatus(
  shifts: Array<{ period: ShiftPeriod; status: ShiftStatus; part: ShiftPart }>,
): StationDayStatus {
  const morning = shifts.find(s => s.period === 'morning')?.status ?? 'not_started'

  const eveningShifts = shifts
    .filter(s => s.period === 'evening')
    .sort((a, b) => a.part - b.part)

  const evening: EveningEntry[] = eveningShifts.length
    ? eveningShifts.map(s => ({
        part:   s.part,
        status: s.status,
        label:  computeShiftLabel('evening', s.part),
      }))
    : [{ part: 0, status: 'not_started', label: 'Evening' }]

  return { morning, evening }
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

// ── pickLatestClosedShiftPerStation ────────────────────────────────────────

/**
 * Given closed shifts across any number of stations, returns the most
 * recently closed shift id per station — evening beats morning on the same date.
 * Used by the owner dashboard to find the shift whose closing dip readings
 * represent current tank inventory.
 */
export function pickLatestClosedShiftPerStation(
  closedShifts: Array<{ id: string; station_id: string; shift_date: string; period: string }>,
): Record<string, string> {
  const periodValue: Record<string, number> = { evening: 1, morning: 0 }
  const sorted = [...closedShifts].sort((a, b) => {
    if (a.shift_date !== b.shift_date) return b.shift_date.localeCompare(a.shift_date)
    return (periodValue[b.period] ?? 0) - (periodValue[a.period] ?? 0)
  })

  const result: Record<string, string> = {}
  for (const shift of sorted) {
    if (!result[shift.station_id]) {
      result[shift.station_id] = shift.id
    }
  }
  return result
}

// ── buildStationInventoryLines ─────────────────────────────────────────────

export interface InventoryLine {
  gradeId: string
  gradeLabel: string
  litres: number
  costPerLitre: number
  valueZar: number
}

/**
 * Builds current tank inventory lines per station from each station's latest
 * closing dip readings, joined against active fuel prices and grade labels.
 */
export function buildStationInventoryLines(
  stations: Array<{ id: string; name: string }>,
  latestClosedShiftId: Record<string, string>,
  dipReadings: Array<{
    shift_id: string
    litres: number
    tanks: { fuel_grade_id: string } | Array<{ fuel_grade_id: string }> | null
  }>,
  prices: Array<{ station_id: string; fuel_grade_id: string; cost_per_litre: number }>,
  grades: Array<{ id: string; label: string }>,
): Record<string, InventoryLine[]> {
  const gradeLabels: Record<string, string> = Object.fromEntries(grades.map(g => [g.id, g.label]))
  const result: Record<string, InventoryLine[]> = {}

  for (const station of stations) {
    const shiftId = latestClosedShiftId[station.id]
    if (!shiftId) continue

    const gradeMap: Record<string, number> = {}
    for (const dip of dipReadings.filter(d => d.shift_id === shiftId)) {
      const tank = Array.isArray(dip.tanks) ? dip.tanks[0] : dip.tanks
      const gradeId = tank?.fuel_grade_id
      if (!gradeId) continue
      gradeMap[gradeId] = (gradeMap[gradeId] ?? 0) + Number(dip.litres)
    }

    const stationPrices = prices.filter(p => p.station_id === station.id)
    const inputs: InventorySnapshotInput[] = Object.entries(gradeMap).map(([gradeId, litres]) => ({
      station_id: station.id,
      fuel_grade_id: gradeId,
      closing_dip_litres: litres,
      cost_per_litre: Number(stationPrices.find(p => p.fuel_grade_id === gradeId)?.cost_per_litre ?? 0),
    }))

    result[station.id] = buildInventorySnapshot(inputs)
      .map(row => ({
        gradeId: row.fuel_grade_id,
        gradeLabel: gradeLabels[row.fuel_grade_id] ?? row.fuel_grade_id,
        litres: row.litres,
        costPerLitre: row.cost_per_litre,
        valueZar: row.total_value_zar,
      }))
      .sort((a, b) => a.gradeId.localeCompare(b.gradeId))
  }

  return result
}

// ── buildOwnerDashboardStations ────────────────────────────────────────────

export interface OwnerDashboardStation {
  id: string
  name: string
  pendingCount: number
  flaggedShifts: Array<{ id: string; period: string; flag_comment: string | null }>
  inventory: InventoryLine[] | null
}

/**
 * Combines today's pending counts, flagged shifts, and inventory snapshots
 * into the per-station view model rendered on the owner dashboard.
 */
export function buildOwnerDashboardStations(
  stations: Array<{ id: string; name: string }>,
  todayShifts: Array<{ id: string; station_id: string; period: string; is_flagged: boolean; flag_comment: string | null; status: string }>,
  inventoryByStation: Record<string, InventoryLine[]>,
): OwnerDashboardStation[] {
  const pendingCounts = countPendingShiftsPerStation(todayShifts)

  return stations.map(station => ({
    id: station.id,
    name: station.name,
    pendingCount: pendingCounts[station.id] ?? 0,
    flaggedShifts: todayShifts.filter(s => s.station_id === station.id && s.is_flagged),
    inventory: inventoryByStation[station.id] ?? null,
  }))
}
