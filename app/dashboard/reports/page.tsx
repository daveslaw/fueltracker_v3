import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getFuelControlMonth,
  buildFuelControlReportRows,
  buildDaySubtotals,
  buildDayEntries,
  trailingMonths,
} from '@/lib/fuel-control-report'
import { FuelControlTable } from '@/components/fuel-control-table'

interface Props {
  searchParams: Promise<{ station?: string; month?: string }>
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
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
  const shiftRows  = reportRows
    .filter((r): r is Extract<typeof reportRows[0], { type: 'shift' }> => r.type === 'shift')
    .map(r => r.data)
  const subtotals  = buildDaySubtotals(shiftRows)
  const dayEntries = buildDayEntries(reportRows, grades, subtotals)

  const monthOptions = trailingMonths(selectedMonth, 23)

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-semibold mt-1">Fuel Control Report</h1>
          <div className="flex gap-3 mt-1">
            <Link href="/dashboard/reports/dry-stock"  className="text-xs text-blue-600 hover:underline">Dry Stock</Link>
            <Link href="/dashboard/reports/deliveries" className="text-xs text-blue-600 hover:underline">Deliveries</Link>
          </div>
        </div>
      </div>

      {/* Inline filter bar */}
      <form method="GET" action="/dashboard/reports" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
            {(stations ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Month</label>
          <select name="month" defaultValue={selectedMonth} className="border rounded px-2 py-1.5 text-sm">
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
      </form>

      {/* Variance legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> Loss</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" /> Overage</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" /> No variance</span>
      </div>

      {dayEntries.length === 0 && (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          No shifts found for {activeStation?.name} in {selectedMonth}.
        </div>
      )}

      {dayEntries.length > 0 && (
        <FuelControlTable
          entries={dayEntries}
          grades={grades}
          stationId={activeStationId}
        />
      )}
    </main>
  )
}
