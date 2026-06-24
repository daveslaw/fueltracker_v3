import type { SupabaseClient } from '@supabase/supabase-js'
import { getShiftPeriod } from '@/lib/deliveries'
import { selectActivePriceAt } from '@/lib/pricing'
import type { PriceRow } from '@/lib/pricing'

export interface FuelControlRowInput {
  shift_id:             string
  shift_date:           string
  period:               'morning' | 'evening'
  part:                 number
  shift_type:           'standard' | 'price_change'
  status:               string
  is_flagged:           boolean
  has_maintenance_flag: boolean
  fuel_grade_id:        string
  started_at:           string
  opening_dip:          number | null
  closing_dip:          number | null
  deliveries_litres:    number
  delivery_note:        string | null
  driver_name:          string | null
  pos_litres:           number | null
}

export interface FuelControlShiftRow {
  shift_id:             string
  shift_date:           string
  period:               'morning' | 'evening'
  status:               string
  is_flagged:           boolean
  has_maintenance_flag: boolean
  fuel_grade_id:        string
  opening_dip:          number | null
  closing_dip:          number | null
  deliveries_litres:    number
  delivery_note:        string | null
  driver_name:          string | null
  pos_litres:           number | null
  dip_calc_litres:      number | null
  variance_litres:      number | null
  accumulated_variance: number | null
  sell_price:           number | null
  cost_price:           number | null
  gp_zar:               number | null
}

export type FuelControlReportRow =
  | { type: 'shift'; data: FuelControlShiftRow }
  | { type: 'price_change_impact'; shift_date: string; fuel_grade_id: string; closing_dip_litres: number; old_cost: number; new_cost: number; impact_zar: number }

export function buildFuelControlReportRows(
  inputs: FuelControlRowInput[],
  prices?: PriceRow[],
): FuelControlReportRow[] {
  const shiftRows = buildFuelControlRows(inputs, prices)

  // For each price_change Part 1, find the matching Part 2 (same grade + shift_date)
  // and record that an impact row should be inserted after the Part 1 index.
  const impactAfterIdx = new Map<number, FuelControlReportRow>()

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const row   = shiftRows[i]
    if (input.shift_type !== 'price_change' || input.part !== 1) continue
    if (row.closing_dip === null || !prices) continue

    const part2Idx = inputs.findIndex((inp, j) =>
      j > i &&
      inp.shift_type === 'price_change' &&
      inp.part === 2 &&
      inp.fuel_grade_id === input.fuel_grade_id &&
      inp.shift_date === input.shift_date,
    )
    if (part2Idx === -1) continue

    const part2Input  = inputs[part2Idx]
    const gradeRows   = prices.filter(p => p.fuel_grade_id === input.fuel_grade_id)
    const oldPrice    = selectActivePriceAt(gradeRows, input.started_at)
    const newPrice    = selectActivePriceAt(gradeRows, part2Input.started_at)
    if (!oldPrice || !newPrice) continue

    impactAfterIdx.set(i, {
      type:               'price_change_impact',
      shift_date:         input.shift_date,
      fuel_grade_id:      input.fuel_grade_id,
      closing_dip_litres: row.closing_dip,
      old_cost:           oldPrice.cost_per_litre,
      new_cost:           newPrice.cost_per_litre,
      impact_zar:         Math.round(row.closing_dip * (newPrice.cost_per_litre - oldPrice.cost_per_litre) * 100) / 100,
    })
  }

  const result: FuelControlReportRow[] = []
  for (let i = 0; i < shiftRows.length; i++) {
    result.push({ type: 'shift', data: shiftRows[i] })
    const impact = impactAfterIdx.get(i)
    if (impact) result.push(impact)
  }
  return result
}

export interface FuelControlDaySubtotal {
  shift_date:       string
  fuel_grade_id:    string
  total_deliveries: number
  total_pos_litres: number | null
  total_dip_calc:   number | null
  total_variance:   number | null
  total_gp:         number | null
}

export interface FuelControlMonthData {
  grades:    string[]
  rows:      FuelControlShiftRow[]
  subtotals: FuelControlDaySubtotal[]
}

export function buildFuelControlRows(
  inputs: FuelControlRowInput[],
  prices?: PriceRow[],
): FuelControlShiftRow[] {
  const accumulators = new Map<string, number>()

  return inputs.map(input => {
    const isPending = input.status === 'pending' || input.opening_dip === null || input.closing_dip === null || input.pos_litres === null

    if (isPending) {
      return {
        ...input,
        dip_calc_litres:      null,
        variance_litres:      null,
        accumulated_variance: null,
        sell_price:           null,
        cost_price:           null,
        gp_zar:               null,
      }
    }

    const dip_calc_litres = input.opening_dip! + input.deliveries_litres - input.closing_dip!
    const variance_litres = input.pos_litres! - dip_calc_litres

    const prev = accumulators.get(input.fuel_grade_id) ?? 0
    const accumulated_variance = prev + variance_litres
    accumulators.set(input.fuel_grade_id, accumulated_variance)

    let sell_price: number | null = null
    let cost_price: number | null = null
    let gp_zar:     number | null = null

    if (prices) {
      const gradePrice = prices.filter(p => p.fuel_grade_id === input.fuel_grade_id)
      const active = selectActivePriceAt(gradePrice, input.started_at)
      if (active) {
        sell_price = active.sell_price_per_litre
        cost_price = active.cost_per_litre
        gp_zar     = Math.round((sell_price - cost_price) * input.pos_litres! * 100) / 100
      }
    }

    return {
      ...input,
      dip_calc_litres,
      variance_litres,
      accumulated_variance,
      sell_price,
      cost_price,
      gp_zar,
    }
  })
}

export function buildDaySubtotals(rows: FuelControlShiftRow[]): FuelControlDaySubtotal[] {
  const map = new Map<string, FuelControlDaySubtotal>()

  for (const row of rows) {
    const key = `${row.shift_date}|${row.fuel_grade_id}`
    const existing = map.get(key)

    if (!existing) {
      map.set(key, {
        shift_date:       row.shift_date,
        fuel_grade_id:    row.fuel_grade_id,
        total_deliveries: row.deliveries_litres,
        total_pos_litres: row.pos_litres,
        total_dip_calc:   row.dip_calc_litres,
        total_variance:   row.variance_litres,
        total_gp:         row.gp_zar,
      })
    } else {
      existing.total_deliveries += row.deliveries_litres
      existing.total_pos_litres  = sumNullable(existing.total_pos_litres, row.pos_litres)
      existing.total_dip_calc    = sumNullable(existing.total_dip_calc,   row.dip_calc_litres)
      existing.total_variance    = sumNullable(existing.total_variance,   row.variance_litres)
      existing.total_gp          = sumNullable(existing.total_gp,         row.gp_zar)
    }
  }

  return Array.from(map.values())
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  return (a ?? 0) + (b ?? 0)
}

// ── aggregatePumpLinesToGradePos ──────────────────────────────────────────────
// Pure helper: sums pos_litres_sold from reconciliation_pump_lines grouped by
// (shift_id, fuel_grade_id). Used by getFuelControlMonth.

export function aggregatePumpLinesToGradePos(
  lines: { shift_id: string; fuel_grade_id: string; pos_litres_sold: number }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of lines) {
    const key = `${line.shift_id}|${line.fuel_grade_id}`
    map.set(key, (map.get(key) ?? 0) + line.pos_litres_sold)
  }
  return map
}

// ── GradeAgg / DeliveryInfo (exported for tests) ─────────────────────────────

export type GradeAgg     = { opening_dip: number; closing_dip: number; deliveries: number }
export type DeliveryInfo = { litres: number; notes: string[]; drivers: string[] }

// ── indexTankLinesByShiftGrade ────────────────────────────────────────────────
// Pure: sums opening_dip, closing_dip, and deliveries_received from reconciliation
// tank lines, keyed by `shiftId|grade`. Multiple tanks of the same grade are summed.

export function indexTankLinesByShiftGrade(
  tankLines: Array<{
    tank_id:             string
    opening_dip:         number
    actual_closing_dip:  number
    deliveries_received: number
    reconciliations:     { shift_id: string }
  }>,
  tankGrade: Map<string, string>,
): Map<string, GradeAgg> {
  const map = new Map<string, GradeAgg>()
  for (const line of tankLines) {
    const grade = tankGrade.get(line.tank_id)
    if (!grade) continue
    const key      = `${line.reconciliations.shift_id}|${grade}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        opening_dip: Number(line.opening_dip),
        closing_dip: Number(line.actual_closing_dip),
        deliveries:  Number(line.deliveries_received),
      })
    } else {
      existing.opening_dip += Number(line.opening_dip)
      existing.closing_dip += Number(line.actual_closing_dip)
      existing.deliveries  += Number(line.deliveries_received)
    }
  }
  return map
}

// ── indexDeliveriesByDatePeriodGrade ─────────────────────────────────────────
// Pure: groups deliveries into a map keyed by `date|period|grade`.
// Multiple deliveries in the same bucket are summed; note numbers and driver
// names are accumulated into arrays for later joining.

export function indexDeliveriesByDatePeriodGrade(
  deliveries: Array<{
    delivered_at:         string
    delivery_note_number: string | null
    driver_name:          string | null
    litres_received:      number
    tank_id:              string
  }>,
  tankGrade: Map<string, string>,
): Map<string, DeliveryInfo> {
  const map = new Map<string, DeliveryInfo>()
  for (const d of deliveries) {
    const grade = tankGrade.get(d.tank_id)
    if (!grade) continue
    const date   = d.delivered_at.slice(0, 10)
    const period = getShiftPeriod(d.delivered_at)
    const key    = `${date}|${period}|${grade}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        litres:  Number(d.litres_received),
        notes:   d.delivery_note_number ? [d.delivery_note_number] : [],
        drivers: d.driver_name          ? [d.driver_name]          : [],
      })
    } else {
      existing.litres += Number(d.litres_received)
      if (d.delivery_note_number) existing.notes.push(d.delivery_note_number)
      if (d.driver_name)          existing.drivers.push(d.driver_name)
    }
  }
  return map
}

// ── assembleFuelControlInputs ─────────────────────────────────────────────────
// Pure: cross-joins shifts × grades and looks up rec + delivery data from the
// pre-built indexes to produce one FuelControlRowInput per (shift, grade) pair.

export function assembleFuelControlInputs(
  shifts: Array<{
    id:         string
    shift_date: string
    period:     'morning' | 'evening'
    part:       number
    shift_type: 'standard' | 'price_change'
    status:     string
    is_flagged: boolean
    started_at: string
  }>,
  grades:                     string[],
  recByShiftGrade:            Map<string, GradeAgg>,
  deliveryIndex:              Map<string, DeliveryInfo>,
  posLinesByShiftGrade:       Map<string, number>,
  maintenanceFlaggedShiftIds: Set<string>,
): FuelControlRowInput[] {
  const inputs: FuelControlRowInput[] = []

  for (const shift of shifts) {
    for (const grade of grades) {
      const isClosed = shift.status === 'closed'
      const recKey   = `${shift.id}|${grade}`
      const rec      = recByShiftGrade.get(recKey)
      const delKey   = `${shift.shift_date}|${shift.period}|${grade}`
      const del      = deliveryIndex.get(delKey)

      inputs.push({
        shift_id:             shift.id,
        shift_date:           shift.shift_date,
        period:               shift.period,
        part:                 shift.part ?? 0,
        shift_type:           shift.shift_type ?? 'standard',
        status:               shift.status,
        is_flagged:           shift.is_flagged ?? false,
        has_maintenance_flag: maintenanceFlaggedShiftIds.has(shift.id),
        fuel_grade_id:        grade,
        started_at:           shift.started_at,
        opening_dip:          isClosed && rec ? rec.opening_dip : null,
        closing_dip:          isClosed && rec ? rec.closing_dip : null,
        deliveries_litres:    isClosed && rec ? rec.deliveries  : (del?.litres ?? 0),
        delivery_note:        del ? del.notes.join(', ')   || null : null,
        driver_name:          del ? del.drivers.join(', ') || null : null,
        pos_litres:           isClosed ? (posLinesByShiftGrade.get(recKey) ?? null) : null,
      })
    }
  }

  return inputs
}

// ── Data fetch (server-only, not unit tested) ─────────────────────────────────

export async function getFuelControlMonth(
  db: SupabaseClient,
  stationId: string,
  year: number,
  month: number,
): Promise<{ inputs: FuelControlRowInput[]; grades: string[]; prices: PriceRow[] }> {
  const mm       = String(month).padStart(2, '0')
  const firstDay = `${year}-${mm}-01`
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10) // last day of month

  const [
    { data: shifts },
    { data: tanks },
    { data: deliveries },
    { data: allPrices },
  ] = await Promise.all([
    db.from('shifts')
      .select('id, shift_date, period, part, shift_type, status, is_flagged, started_at')
      .eq('station_id', stationId)
      .gte('shift_date', firstDay)
      .lte('shift_date', lastDay)
      .order('shift_date')
      .order('part'),
    db.from('tanks')
      .select('id, fuel_grade_id')
      .eq('station_id', stationId),
    db.from('deliveries')
      .select('delivered_at, delivery_note_number, driver_name, litres_received, tank_id')
      .eq('station_id', stationId)
      .gte('delivered_at', `${firstDay}T00:00:00Z`)
      .lte('delivered_at', `${lastDay}T23:59:59Z`),
    db.from('fuel_prices')
      .select('station_id, fuel_grade_id, sell_price_per_litre, cost_per_litre, valid_from, valid_to')
      .eq('station_id', stationId)
      .order('valid_from'),
  ])

  const periodOrder = { morning: 0, evening: 1 }
  const allShifts = (shifts ?? []).sort((a, b) => {
    if (a.shift_date !== b.shift_date) return (a.shift_date as string).localeCompare(b.shift_date as string)
    const pa = periodOrder[(a.period as keyof typeof periodOrder)] ?? 0
    const pb = periodOrder[(b.period as keyof typeof periodOrder)] ?? 0
    if (pa !== pb) return pa - pb
    return ((a.part as number) ?? 0) - ((b.part as number) ?? 0)
  })
  const allTanks      = tanks      ?? []
  const allDeliveries = deliveries ?? []
  const allPriceRows  = (allPrices ?? []) as PriceRow[]

  // grade order: stable — derived from tank list, deduplicated
  const grades = [...new Set(allTanks.map(t => t.fuel_grade_id as string))]

  const tankGrade = new Map<string, string>(allTanks.map(t => [t.id as string, t.fuel_grade_id as string]))

  const allShiftIds    = allShifts.map(s => s.id as string)
  const closedShiftIds = allShifts.filter(s => s.status === 'closed').map(s => s.id as string)

  // fetch shifts that have at least one close pump reading flagged for maintenance
  const maintenanceFlaggedShiftIds = new Set<string>()
  if (allShiftIds.length > 0) {
    const { data: maintReadings } = await db
      .from('pump_readings')
      .select('shift_id')
      .in('shift_id', allShiftIds)
      .eq('type', 'close')
      .eq('maintenance_required', true)
    for (const r of maintReadings ?? []) {
      maintenanceFlaggedShiftIds.add(r.shift_id as string)
    }
  }

  // fetch reconciliation tank lines + pump lines for closed shifts
  const recTankLines: Array<{
    reconciliation_id: string
    tank_id:           string
    opening_dip:       number
    actual_closing_dip: number
    deliveries_received: number
    reconciliations:   { shift_id: string }
  }> = []

  const posLinesByShiftGrade = new Map<string, number>()

  if (closedShiftIds.length > 0) {
    const { data: recs } = await db
      .from('reconciliations')
      .select('id, shift_id')
      .in('shift_id', closedShiftIds)

    if (recs && recs.length > 0) {
      const recIds       = recs.map(r => r.id as string)
      const recById      = new Map(recs.map(r => [r.id as string, r]))
      const recShiftById = new Map(recs.map(r => [r.id as string, r.shift_id as string]))

      const [{ data: tankLineRows }, { data: pumpLineRows }] = await Promise.all([
        db.from('reconciliation_tank_lines')
          .select('reconciliation_id, tank_id, opening_dip, actual_closing_dip, deliveries_received')
          .in('reconciliation_id', recIds),
        db.from('reconciliation_pump_lines')
          .select('reconciliation_id, fuel_grade_id, pos_litres_sold')
          .in('reconciliation_id', recIds),
      ])

      for (const line of tankLineRows ?? []) {
        recTankLines.push({
          ...line,
          reconciliations: recById.get(line.reconciliation_id as string)!,
        })
      }

      posLinesByShiftGrade = aggregatePumpLinesToGradePos(
        (pumpLineRows ?? []).flatMap(line => {
          const shift_id = recShiftById.get(line.reconciliation_id as string)
          return shift_id
            ? [{ shift_id, fuel_grade_id: line.fuel_grade_id as string, pos_litres_sold: Number(line.pos_litres_sold) }]
            : []
        }),
      )
    }
  }

  const recByShiftGrade = indexTankLinesByShiftGrade(recTankLines, tankGrade)
  const deliveryIndex   = indexDeliveriesByDatePeriodGrade(allDeliveries as any, tankGrade)
  const inputs          = assembleFuelControlInputs(
    allShifts as any,
    grades,
    recByShiftGrade,
    deliveryIndex,
    posLinesByShiftGrade,
    maintenanceFlaggedShiftIds,
  )

  return { inputs, grades, prices: allPriceRows }
}

export interface DaySummary {
  total_deliveries: number
  total_pos_litres: number | null
  total_dip_calc:   number | null
  total_variance:   number | null
  total_gp:         number | null
}

export interface GradeGroup {
  grade: string
  rows:  FuelControlReportRow[]
}

export interface DayEntry {
  date:             string
  allGradesSummary: DaySummary
  gradeGroups:      GradeGroup[]
}

export function buildDayEntries(
  reportRows: FuelControlReportRow[],
  grades: string[],
  subtotals: FuelControlDaySubtotal[],
): DayEntry[] {
  const dates = [...new Set(
    reportRows
      .filter((r): r is Extract<FuelControlReportRow, { type: 'shift' }> => r.type === 'shift')
      .map(r => r.data.shift_date)
  )].sort()

  return dates.map(date => {
    const dateSubs = subtotals.filter(s => s.shift_date === date)

    const allGradesSummary: DaySummary = {
      total_deliveries: dateSubs.reduce((acc, s) => acc + s.total_deliveries, 0),
      total_pos_litres: dateSubs.reduce<number | null>((acc, s) => sumNullable(acc, s.total_pos_litres), null),
      total_dip_calc:   dateSubs.reduce<number | null>((acc, s) => sumNullable(acc, s.total_dip_calc),   null),
      total_variance:   dateSubs.reduce<number | null>((acc, s) => sumNullable(acc, s.total_variance),   null),
      total_gp:         dateSubs.reduce<number | null>((acc, s) => sumNullable(acc, s.total_gp),         null),
    }

    const gradeGroups: GradeGroup[] = grades.map(grade => ({
      grade,
      rows: reportRows.filter(r =>
        r.type === 'shift'
          ? r.data.fuel_grade_id === grade && r.data.shift_date === date
          : r.fuel_grade_id === grade && r.shift_date === date
      ),
    }))

    return { date, allGradesSummary, gradeGroups }
  })
}

export function trailingMonths(current: string, count: number): string[] {
  const [y, m] = current.split('-').map(Number)
  const result: string[] = []
  for (let i = 0; i <= count; i++) {
    const d = new Date(y, m - 1 - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}
