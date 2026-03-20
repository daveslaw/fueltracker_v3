import { createClient } from '@/lib/supabase/server'
import { createShift } from '../actions'

export default async function NewShiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const { data: stations } = await supabase
    .from('stations').select('id, name').order('name')

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Start shift</h1>
      <form action={createShift} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Station</label>
          <select name="station_id" defaultValue={profile?.station_id ?? ''}
            className="w-full rounded border px-3 py-2 text-sm">
            <option value="">Select station…</option>
            {stations?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Period</label>
          <select name="period" className="w-full rounded border px-3 py-2 text-sm">
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <button type="submit"
          className="w-full rounded bg-black py-2 text-sm font-medium text-white">
          Begin
        </button>
      </form>
    </main>
  )
}
