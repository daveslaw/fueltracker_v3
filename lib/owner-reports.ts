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
  fuel_grade_id: string
  price_per_litre: number
}

export interface FinancialLine {
  fuel_grade_id: string
  litres_sold: number
  price_per_litre: number
  expected_revenue_zar: number
  pos_revenue_zar: number
  variance_zar: number
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
  const priceMap = new Map(prices.map(p => [p.fuel_grade_id, p.price_per_litre]))

  const lines: FinancialLine[] = posLines.map(pl => {
    const price_per_litre = priceMap.get(pl.fuel_grade_id) ?? 0
    const expected = Math.round(pl.litres_sold * price_per_litre * 100) / 100
    return {
      fuel_grade_id: pl.fuel_grade_id,
      litres_sold: pl.litres_sold,
      price_per_litre,
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

// ── isReportPartial ───────────────────────────────────────────────────────

const COMPLETE_STATUSES: Array<ShiftStatus | 'not_started'> = ['submitted', 'approved', 'flagged']

export function isReportPartial(status: ShiftStatus | 'not_started'): boolean {
  return !COMPLETE_STATUSES.includes(status)
}
