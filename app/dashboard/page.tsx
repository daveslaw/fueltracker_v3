import { createClient } from '@/lib/supabase/server'
import { pickLatestClosedShiftPerStation, buildStationInventoryLines, buildOwnerDashboardStations } from '@/lib/owner-reports'
import { DashboardPoller } from './_components/DashboardPoller'
import { createShiftSlot } from './actions'
import { signOut } from '@/app/(auth)/login/actions'

function formatZAR(amount: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatLitres(litres: number) {
  return new Intl.NumberFormat('en-ZA').format(Math.round(litres))
}

function formatCostPerLitre(price: number) {
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(price)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: stations },
    { data: todayShifts },
    { data: closedShifts },
    { data: fuelPrices },
    { data: fuelGrades },
  ] = await Promise.all([
    supabase.from('stations').select('id, name').order('name'),
    supabase.from('shifts')
      .select('id, station_id, period, status, is_flagged, flag_comment')
      .eq('shift_date', today),
    supabase.from('shifts')
      .select('id, station_id, shift_date, period')
      .eq('status', 'closed')
      .order('shift_date', { ascending: false }),
    supabase.from('fuel_prices')
      .select('station_id, fuel_grade_id, cost_per_litre')
      .is('valid_to', null),
    supabase.from('fuel_grades').select('id, label'),
  ])

  const latestClosedShiftId = pickLatestClosedShiftPerStation(closedShifts ?? [])

  const shiftIds = Object.values(latestClosedShiftId)
  const { data: dipReadings } = shiftIds.length > 0
    ? await supabase
        .from('dip_readings')
        .select('shift_id, litres, tanks(fuel_grade_id)')
        .in('shift_id', shiftIds)
        .eq('type', 'close')
    : { data: [] as Array<{ shift_id: string; litres: number; tanks: { fuel_grade_id: string } | null }> }

  const inventoryByStation = buildStationInventoryLines(
    stations ?? [],
    latestClosedShiftId,
    dipReadings ?? [],
    fuelPrices ?? [],
    fuelGrades ?? [],
  )

  const stationList = buildOwnerDashboardStations(stations ?? [], todayShifts ?? [], inventoryByStation)

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <DashboardPoller />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owner Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{today}</span>
          <form action={signOut}>
            <button type="submit"
              className="rounded border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Log out
            </button>
          </form>
        </div>
      </div>

{stationList.length === 0 && (
        <p className="text-sm text-gray-400">No stations configured.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stationList.map(station => {
          const totalValue = station.inventory?.reduce((sum, l) => sum + l.valueZar, 0) ?? 0
          return (
            <div key={station.id}
              className={`border rounded-lg p-4 space-y-3 ${station.flaggedShifts.length > 0 ? 'border-red-300 bg-red-50' : ''}`}>

              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{station.name}</h2>
                {station.pendingCount > 0 && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    {station.pendingCount} pending
                  </span>
                )}
              </div>

              {station.flaggedShifts.map(s => (
                <div key={s.id} className="text-xs text-red-700 bg-red-100 rounded px-2 py-1.5 space-y-0.5">
                  <div className="font-medium capitalize">&#9873; {s.period} shift flagged</div>
                  {s.flag_comment && <div className="text-red-600">{s.flag_comment}</div>}
                </div>
              ))}

              {station.inventory && station.inventory.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b">
                      <th className="text-left pb-1 font-medium pr-2 border-r border-gray-200">Grade</th>
                      <th className="text-right pb-1 font-medium px-2 border-r border-gray-200">Litres</th>
                      <th className="text-right pb-1 font-medium px-2 border-r border-gray-200">Cost/L</th>
                      <th className="text-right pb-1 font-medium pl-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {station.inventory.map(line => (
                      <tr key={line.gradeId}>
                        <td className="py-1 pr-2 border-r border-gray-200">{line.gradeLabel}</td>
                        <td className="py-1 px-2 text-right tabular-nums border-r border-gray-200">{formatLitres(line.litres)}</td>
                        <td className="py-1 px-2 text-right tabular-nums border-r border-gray-200">{formatCostPerLitre(line.costPerLitre)}</td>
                        <td className="py-1 pl-2 text-right tabular-nums">{formatZAR(line.valueZar)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td colSpan={3} className="pt-1.5 text-gray-500 text-xs">Total</td>
                      <td className="pt-1.5 text-right tabular-nums">{formatZAR(totalValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-xs text-gray-400">No closed shift data.</p>
              )}


            </div>
          )
        })}
      </div>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm">Create shift slot</h2>
        <p className="text-xs text-gray-500">
          Pre-create a morning or evening slot so supervisors can begin the close check.
        </p>
        <form action={createShiftSlot as unknown as (f: FormData) => Promise<void>} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Station</label>
            <select name="station_id" required className="rounded border px-3 py-1.5 text-sm">
              <option value="">Select…</option>
              {(stations ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period</label>
            <select name="period" className="rounded border px-3 py-1.5 text-sm">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" name="shift_date" defaultValue={today} required lang="en-ZA"
              className="rounded border px-3 py-1.5 text-sm" />
          </div>
          <button type="submit"
            className="rounded bg-black px-4 py-1.5 text-sm font-medium text-white">
            Create
          </button>
        </form>
      </section>
    </main>
  )
}
