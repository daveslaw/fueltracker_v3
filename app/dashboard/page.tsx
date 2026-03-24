import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildStationDayStatus } from '@/lib/owner-reports'
import { DashboardPoller } from './_components/DashboardPoller'

type Status = string

function StatusChip({ status }: { status: Status }) {
  const cls =
    status === 'approved'    ? 'bg-green-100 text-green-800' :
    status === 'flagged'     ? 'bg-red-100 text-red-800' :
    status === 'submitted'   ? 'bg-blue-100 text-blue-800' :
    status === 'not_started' ? 'bg-gray-100 text-gray-500' :
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
      .select('id, station_id, period, status')
      .eq('shift_date', today),
  ])

  const stationList = (stations ?? []).map(station => {
    const stationShifts = (todayShifts ?? [])
      .filter(s => s.station_id === station.id)
      .map(s => ({ period: s.period as 'morning' | 'evening', status: s.status as any }))
    return { ...station, dayStatus: buildStationDayStatus(stationShifts) }
  })

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <DashboardPoller />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owner Dashboard</h1>
        <span className="text-sm text-muted-foreground">{today}</span>
      </div>

      <nav className="flex gap-4 text-sm text-primary">
        <Link href="/dashboard/reports" className="underline">Daily report</Link>
        <Link href="/dashboard/reports/weekly" className="underline">Weekly</Link>
        <Link href="/dashboard/reports/monthly" className="underline">Monthly</Link>
        <Link href="/dashboard/tank-trends" className="underline">Tank trends</Link>
        <Link href="/dashboard/history" className="underline">Shift history</Link>
        <Link href="/dashboard/config" className="underline">Config</Link>
        <Link href="/dashboard/users" className="underline">Users</Link>
      </nav>

      {stationList.length === 0 && (
        <p className="text-sm text-muted-foreground">No stations configured.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stationList.map(station => (
          <div key={station.id} className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{station.name}</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Morning</span>
                <StatusChip status={station.dayStatus.morning} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Evening</span>
                <StatusChip status={station.dayStatus.evening} />
              </div>
            </div>
            <Link
              href={`/dashboard/reports?station=${station.id}&date=${today}`}
              className="block text-xs text-primary underline"
            >
              View daily report →
            </Link>
          </div>
        ))}
      </div>
    </main>
  )
}
