import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getShiftPeriod } from '@/lib/deliveries'
import type { ShiftPeriod } from '@/lib/shift-open'
import { signOut } from '@/app/(auth)/login/actions'

function periodLabel(period: ShiftPeriod) {
  return period === 'morning' ? 'Morning' : 'Evening'
}

export default async function ShiftHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, station_id')
    .eq('user_id', user!.id)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const currentPeriod = getShiftPeriod(new Date().toISOString()) as ShiftPeriod

  const { data: todayShifts } = await supabase
    .from('shifts')
    .select('id, period, status, is_flagged')
    .eq('station_id', profile?.station_id ?? '')
    .eq('shift_date', today)
    .order('period')

  // Auto-redirect to the current period's pending shift if one exists
  const currentPending = (todayShifts ?? []).find(
    s => s.period === currentPeriod && s.status === 'pending'
  )
  if (currentPending) redirect(`/shift/${currentPending.id}/close/pumps`)

  const pendingShifts  = (todayShifts ?? []).filter(s => s.status === 'pending')
  const closedShifts   = (todayShifts ?? []).filter(s => s.status === 'closed')

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <div className="flex items-center gap-2">
          <Link href="/shift/new"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            Start shift
          </Link>
          <form action={signOut}>
            <button type="submit"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Log out
            </button>
          </form>
        </div>
      </div>

      <p className="text-sm text-gray-500">{today} — {periodLabel(currentPeriod)} period</p>

      {todayShifts?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="text-sm text-gray-500">No shifts for today yet.</p>
          <Link href="/shift/new"
            className="inline-block rounded bg-black px-4 py-2 text-sm font-medium text-white">
            Create shift
          </Link>
        </div>
      )}

      {pendingShifts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">In progress</h2>
          <ul className="space-y-2">
            {pendingShifts.map(s => (
              <li key={s.id}>
                <Link
                  href={`/shift/${s.id}/close/pumps`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                >
                  <span className="font-medium capitalize">{s.period}</span>
                  <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">Pending</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {closedShifts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">Closed today</h2>
          <ul className="space-y-2">
            {closedShifts.map(s => (
              <li key={s.id}>
                <Link
                  href={`/shift/${s.id}/close/summary`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                >
                  <span className="font-medium capitalize">{s.period}</span>
                  <div className="flex items-center gap-2">
                    {s.is_flagged && (
                      <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">Flagged</span>
                    )}
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">Closed</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
