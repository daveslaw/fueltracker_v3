import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { ShiftStatus } from '@/lib/shift-open'

function shiftHref(id: string, status: ShiftStatus): string {
  switch (status) {
    case 'draft':       return `/shift/${id}/pumps`
    case 'open':        return `/shift/${id}/close/pumps`
    case 'pending_pos': return `/shift/${id}/close/pos`
    default:            return `/shift/${id}/close/summary`
  }
}

function statusLabel(status: ShiftStatus): string {
  switch (status) {
    case 'draft':       return 'Open in progress'
    case 'open':        return 'Close in progress'
    case 'pending_pos': return 'Awaiting POS'
    case 'submitted':   return 'Submitted'
    case 'approved':    return 'Approved'
    case 'flagged':     return 'Flagged'
  }
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
                <Link
                  href={shiftHref(s.id, s.status as ShiftStatus)}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
                >
                  <span className="capitalize font-medium">{s.period}</span>
                  <span className="text-xs text-gray-500">{statusLabel(s.status as ShiftStatus)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
