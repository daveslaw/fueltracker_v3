import { createClient } from '@/lib/supabase/server'
import { getShiftPeriod } from '@/lib/deliveries'
import { NewShiftForm } from './NewShiftForm'
import { redirect } from 'next/navigation'
import type { ShiftPeriod } from '@/lib/shift-open'

export default async function NewShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const currentPeriod = getShiftPeriod(new Date().toISOString()) as ShiftPeriod

  const { data: todayShifts } = await supabase
    .from('shifts')
    .select('id, period, status')
    .eq('station_id', profile?.station_id ?? '')
    .eq('shift_date', today)

  const currentPending = (todayShifts ?? []).find(
    s => s.period === currentPeriod && s.status === 'pending'
  )
  if (currentPending) redirect(`/shift/${currentPending.id}/close/pumps`)

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Create shift</h1>
      <NewShiftForm
        stationId={profile?.station_id ?? ''}
        currentPeriod={currentPeriod}
      />
    </main>
  )
}
