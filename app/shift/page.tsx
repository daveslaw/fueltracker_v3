import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ShiftHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, station_id')
    .eq('user_id', user!.id)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const { data: todayShifts } = await supabase
    .from('shifts')
    .select('id, period, status, created_at')
    .eq('station_id', profile?.station_id ?? '')
    .eq('shift_date', today)
    .order('created_at')

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <Link href="/shift/new"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Start shift
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500">Today</h2>
        {!todayShifts?.length ? (
          <p className="text-sm text-gray-400">No shifts started today.</p>
        ) : (
          <ul className="space-y-2">
            {todayShifts.map((s) => (
              <li key={s.id}>
                <Link href={`/shift/${s.id}/pumps`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50">
                  <span className="capitalize font-medium">{s.period}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{s.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
