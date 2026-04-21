import { createClient } from '@/lib/supabase/server'
import { getShiftPeriod } from '@/lib/deliveries'
import { NewShiftForm } from './NewShiftForm'
import type { ShiftPeriod } from '@/lib/shift-open'

export default async function NewShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const currentPeriod = getShiftPeriod(new Date().toISOString()) as ShiftPeriod

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
