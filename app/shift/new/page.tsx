import { createClient } from '@/lib/supabase/server'
import { createShift } from '../actions'
import { getShiftPeriod } from '@/lib/deliveries'

export default async function NewShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const currentPeriod = getShiftPeriod(new Date().toISOString())

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Start shift</h1>
      <form action={createShift} className="space-y-4">
        <input type="hidden" name="station_id" value={profile?.station_id ?? ''} />
        <div>
          <label className="block text-sm font-medium mb-1">Period</label>
          <select name="period" defaultValue={currentPeriod}
            className="w-full rounded border px-3 py-2 text-sm">
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <button type="submit"
          className="w-full rounded bg-black py-2 text-sm font-medium text-white">
          Begin close check
        </button>
      </form>
    </main>
  )
}
