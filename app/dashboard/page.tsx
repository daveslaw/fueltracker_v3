import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildStationDayStatus, countPendingShiftsPerStation } from '@/lib/owner-reports'
import { DashboardPoller } from './_components/DashboardPoller'
import { createShiftSlot } from './actions'
import { signOut } from '@/app/(auth)/login/actions'

type Status = string

function StatusChip({ status }: { status: Status }) {
  const cls =
    status === 'closed'     ? 'bg-green-100 text-green-800' :
    status === 'pending'    ? 'bg-yellow-100 text-yellow-800' :
    status === 'not_started'? 'bg-gray-100 text-gray-500' :
    // legacy statuses (archived shifts visible in history)
    status === 'approved'   ? 'bg-green-100 text-green-800' :
    status === 'flagged'    ? 'bg-red-100 text-red-800' :
    status === 'submitted'  ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
  return (
    <span className={`text-xs px-2 py-0.5 rounded capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: stations }, { data: todayShifts }] = await Promise.all([
    supabase.from('stations').select('id, name').order('name'),
    supabase.from('shifts')
      .select('id, station_id, period, status, is_flagged, flag_comment')
      .eq('shift_date', today),
  ])

  const pendingCounts = countPendingShiftsPerStation(todayShifts ?? [])

  const stationList = (stations ?? []).map(station => {
    const stationShifts = (todayShifts ?? [])
      .filter(s => s.station_id === station.id)
      .map(s => ({ period: s.period as 'morning' | 'evening', status: s.status as any }))
    const flaggedShifts = (todayShifts ?? [])
      .filter(s => s.station_id === station.id && s.is_flagged)
    return {
      ...station,
      dayStatus: buildStationDayStatus(stationShifts),
      pendingCount: pendingCounts[station.id] ?? 0,
      flaggedShifts,
    }
  })

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

      <nav className="flex flex-wrap gap-4 text-sm text-blue-600">
        <Link href="/dashboard/reports" className="underline">Daily report</Link>
        <Link href="/dashboard/reports/weekly" className="underline">Weekly</Link>
        <Link href="/dashboard/reports/monthly" className="underline">Monthly</Link>
        <Link href="/dashboard/tank-trends" className="underline">Tank trends</Link>
        <Link href="/dashboard/history" className="underline">Shift history</Link>
        <Link href="/dashboard/config" className="underline">Config</Link>
        <Link href="/dashboard/users" className="underline">Users</Link>
      </nav>

      {stationList.length === 0 && (
        <p className="text-sm text-gray-400">No stations configured.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stationList.map(station => (
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

            {/* Flagged shift alerts */}
            {station.flaggedShifts.map(s => (
              <div key={s.id} className="text-xs text-red-700 bg-red-100 rounded px-2 py-1.5 space-y-0.5">
                <div className="font-medium capitalize">⚑ {s.period} shift flagged</div>
                {s.flag_comment && <div className="text-red-600">{s.flag_comment}</div>}
              </div>
            ))}

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Morning</span>
                <StatusChip status={station.dayStatus.morning} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Evening</span>
                <StatusChip status={station.dayStatus.evening} />
              </div>
            </div>

            <Link
              href={`/dashboard/reports?station=${station.id}&date=${today}`}
              className="block text-xs text-blue-600 underline"
            >
              View daily report →
            </Link>
          </div>
        ))}
      </div>

      {/* Create shift slots */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm">Create shift slot</h2>
        <p className="text-xs text-gray-500">
          Pre-create a morning or evening slot so supervisors can begin the close check.
        </p>
        <form action={createShiftSlot} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Station</label>
            <select name="station_id" required
              className="rounded border px-3 py-1.5 text-sm">
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
            <input type="date" name="shift_date" defaultValue={today} required
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
