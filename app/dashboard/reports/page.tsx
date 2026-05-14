import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFuelControlMonth, buildFuelControlReportRows, buildDaySubtotals } from '@/lib/fuel-control-report'
import type { FuelControlShiftRow, FuelControlDaySubtotal, FuelControlReportRow } from '@/lib/fuel-control-report'

interface Props {
  searchParams: Promise<{ station?: string; month?: string }>
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function adjacentMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtL(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' L'
}

function fmtR(n: number | null): string {
  if (n === null) return '—'
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function VarCell({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  const cls = v < 0 ? 'text-destructive' : v > 0 ? 'text-amber-600' : 'text-green-600'
  const sign = v > 0 ? '+' : ''
  return (
    <span className={`font-semibold ${cls}`}>
      {sign}{v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L
    </span>
  )
}

function ShiftRow({ row, stationId }: { row: FuelControlShiftRow; stationId: string }) {
  const isPending = row.status === 'pending'
  const label = row.period === 'morning' ? 'AM' : 'PM'

  const dateCell = isPending
    ? <span className="text-muted-foreground">{row.shift_date} {label}</span>
    : <Link href={`/dashboard/history/${row.shift_id}`} className="underline text-primary">{row.shift_date} {label}</Link>

  return (
    <tr className="divide-x">
      <td className="px-3 py-2 whitespace-nowrap">
        {dateCell}
        {isPending && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">pending</span>}
        {row.is_flagged && <span className="ml-2 text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">flagged</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.opening_dip)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.closing_dip)}</td>
      <td className="px-3 py-2">
        {row.deliveries_litres > 0 ? (
          <div>
            <span className="tabular-nums">{fmtL(row.deliveries_litres)}</span>
            {row.delivery_note && <span className="block text-xs text-muted-foreground">{row.delivery_note}</span>}
            {row.driver_name   && <span className="block text-xs text-muted-foreground">{row.driver_name}</span>}
          </div>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.pos_litres)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtL(row.dip_calc_litres)}</td>
      <td className="px-3 py-2 text-right"><VarCell v={row.variance_litres} /></td>
      <td className="px-3 py-2 text-right"><VarCell v={row.accumulated_variance} /></td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtR(row.gp_zar)}</td>
    </tr>
  )
}

function PriceChangeImpactRow({ row }: { row: Extract<FuelControlReportRow, { type: 'price_change_impact' }> }) {
  const cls = row.impact_zar >= 0 ? 'text-green-700' : 'text-destructive'
  return (
    <tr className="bg-amber-50 text-xs divide-x italic">
      <td className="px-3 py-1.5 text-amber-800" colSpan={5}>
        Price change impact — {fmtL(row.closing_dip_litres)} closing dip
        &nbsp;· old cost {fmtR(row.old_cost)}/L → new cost {fmtR(row.new_cost)}/L
      </td>
      <td className="px-3 py-1.5" colSpan={3} />
      <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${cls}`}>
        {row.impact_zar > 0 ? '+' : ''}{fmtR(row.impact_zar)}
      </td>
    </tr>
  )
}

function SubtotalRow({ sub }: { sub: FuelControlDaySubtotal }) {
  return (
    <tr className="bg-muted/40 font-medium text-sm divide-x">
      <td className="px-3 py-1.5 text-muted-foreground" colSpan={3}>Day total — {sub.shift_date}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{fmtL(sub.total_deliveries > 0 ? sub.total_deliveries : null)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{fmtL(sub.total_pos_litres)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{fmtL(sub.total_dip_calc)}</td>
      <td className="px-3 py-1.5 text-right"><VarCell v={sub.total_variance} /></td>
      <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{fmtR(sub.total_gp)}</td>
    </tr>
  )
}

export default async function FuelControlReportPage({ searchParams }: Props) {
  const { station: stationParam, month: monthParam } = await searchParams

  const supabase = await createClient()
  const selectedMonth = monthParam ?? currentMonth()
  const [year, month] = selectedMonth.split('-').map(Number)

  const { data: stations } = await supabase.from('stations').select('id, name').order('name')
  const activeStationId = stationParam ?? stations?.[0]?.id
  if (!activeStationId) {
    return (
      <main className="max-w-5xl mx-auto p-4">
        <p className="text-muted-foreground text-sm">No stations configured.</p>
      </main>
    )
  }
  const activeStation = (stations ?? []).find(s => s.id === activeStationId)

  const { inputs, grades, prices } = await getFuelControlMonth(supabase, activeStationId, year, month)
  const reportRows = buildFuelControlReportRows(inputs, prices)
  const shiftRows  = reportRows.filter((r): r is Extract<FuelControlReportRow, { type: 'shift' }> => r.type === 'shift').map(r => r.data)
  const subtotals  = buildDaySubtotals(shiftRows)

  const prevMonth = adjacentMonth(selectedMonth, -1)
  const nextMonth = adjacentMonth(selectedMonth,  1)

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-semibold mt-1">Fuel Control Report</h1>
          <div className="flex gap-3 mt-1">
            <Link href="/dashboard/reports/weekly"    className="text-xs text-blue-600 hover:underline">Weekly</Link>
            <Link href="/dashboard/reports/monthly"   className="text-xs text-blue-600 hover:underline">Monthly</Link>
            <Link href="/dashboard/reports/dry-stock" className="text-xs text-blue-600 hover:underline">Dry Stock</Link>
            <Link href="/dashboard/reports/deliveries" className="text-xs text-blue-600 hover:underline">Deliveries</Link>
          </div>
          <p className="text-sm text-muted-foreground">{activeStation?.name}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <form method="GET" action="/dashboard/reports" className="flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Station</label>
            <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
              {(stations ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <input type="hidden" name="month" value={selectedMonth} />
          <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
        </form>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/reports?station=${activeStationId}&month=${prevMonth}`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            ←
          </Link>
          <span className="text-sm font-medium w-24 text-center">{selectedMonth}</span>
          <Link
            href={`/dashboard/reports?station=${activeStationId}&month=${nextMonth}`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            →
          </Link>
        </div>
      </div>

      {reportRows.length === 0 && (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          No shifts found for {activeStation?.name} in {selectedMonth}.
        </div>
      )}

      {grades.map(grade => {
        const gradeReportRows = reportRows.filter(r =>
          r.type === 'shift' ? r.data.fuel_grade_id === grade : r.fuel_grade_id === grade
        )
        const gradeSubs = subtotals.filter(s => s.fuel_grade_id === grade)
        const dates     = [...new Set(
          gradeReportRows.filter(r => r.type === 'shift').map(r => r.data.shift_date)
        )].sort()

        if (gradeReportRows.length === 0) return null

        return (
          <section key={grade} className="space-y-1">
            <h2 className="text-base font-semibold">{grade}</h2>
            <div className="border rounded-md text-sm overflow-x-auto">
              <table className="w-full divide-y">
                <thead className="bg-muted/30">
                  <tr className="text-xs text-muted-foreground divide-x">
                    <th className="text-left px-3 py-2">Shift</th>
                    <th className="text-right px-3 py-2">Opening dip</th>
                    <th className="text-right px-3 py-2">Closing dip</th>
                    <th className="text-left px-3 py-2">Deliveries</th>
                    <th className="text-right px-3 py-2">POS litres</th>
                    <th className="text-right px-3 py-2">Dip-calc litres</th>
                    <th className="text-right px-3 py-2">Variance</th>
                    <th className="text-right px-3 py-2">Acc. variance</th>
                    <th className="text-right px-3 py-2">GP (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dates.map(date => {
                    const dayReportRows = gradeReportRows.filter(r =>
                      r.type === 'shift' ? r.data.shift_date === date : r.shift_date === date
                    )
                    const sub = gradeSubs.find(s => s.shift_date === date)
                    return (
                      <>
                        {dayReportRows.map((row, i) =>
                          row.type === 'shift'
                            ? <ShiftRow key={row.data.shift_id} row={row.data} stationId={activeStationId} />
                            : <PriceChangeImpactRow key={`impact-${date}-${i}`} row={row} />
                        )}
                        {sub && <SubtotalRow key={`sub-${date}`} sub={sub} />}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </main>
  )
}
