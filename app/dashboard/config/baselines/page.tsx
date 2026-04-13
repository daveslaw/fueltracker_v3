import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseBaselinesRepository } from '@/lib/shift-baselines'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { savePumpBaseline, saveTankBaseline } from './actions'

type Props = { searchParams: Promise<{ station?: string }> }

export default async function BaselinesPage({ searchParams }: Props) {
  const { station: stationParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const { data: stations } = await supabase
    .from('stations').select('id, name').order('name')

  const selectedStation = stationParam ?? stations?.[0]?.id ?? ''

  const [{ data: pumps }, { data: tanks }] = await Promise.all([
    supabase.from('pumps').select('id, label').eq('station_id', selectedStation).order('label'),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', selectedStation).order('label'),
  ])

  const repo = createSupabaseBaselinesRepository(createAdminClient())
  const baselines = selectedStation ? await repo.getBaselines(selectedStation) : []

  const pumpBaseline = (pumpId: string) =>
    baselines.find(b => b.pump_id === pumpId)?.value ?? ''
  const tankBaseline = (tankId: string) =>
    baselines.find(b => b.tank_id === tankId)?.value ?? ''

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Opening Baselines</h1>
        <Link href="/dashboard/config" className="text-sm text-blue-600 underline">← Config</Link>
      </div>

      <p className="text-sm text-gray-500">
        Set initial meter readings and dip levels used when no prior closed shift exists for a station.
      </p>

      {/* Station selector */}
      <form method="GET" className="flex gap-3 items-center">
        <select name="station" defaultValue={selectedStation}
          onChange="this.form.submit()"
          className="rounded border px-3 py-2 text-sm">
          {(stations ?? []).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="rounded border px-3 py-2 text-sm">Select</button>
        </noscript>
      </form>

      {!selectedStation && (
        <p className="text-sm text-gray-400">No stations configured.</p>
      )}

      {selectedStation && (
        <div className="space-y-6">
          {/* Pump meter baselines */}
          <section className="space-y-3">
            <h2 className="font-semibold">Pump meter readings</h2>
            {(pumps ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No pumps configured for this station.</p>
            ) : (
              <div className="space-y-2">
                {(pumps ?? []).map(pump => {
                  const current = pumpBaseline(pump.id)
                  return (
                    <form key={pump.id} action={savePumpBaseline}
                      className="flex items-center gap-3 rounded border px-4 py-3">
                      <input type="hidden" name="station_id" value={selectedStation} />
                      <input type="hidden" name="pump_id" value={pump.id} />
                      <label className="flex-1 text-sm font-medium">{pump.label}</label>
                      <input
                        type="number"
                        name="value"
                        step="0.01"
                        min="0"
                        defaultValue={current !== '' ? Number(current) : undefined}
                        placeholder="e.g. 52000"
                        className="w-36 rounded border px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-400 w-4">L</span>
                      <button type="submit"
                        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">
                        Save
                      </button>
                    </form>
                  )
                })}
              </div>
            )}
          </section>

          {/* Tank dip baselines */}
          <section className="space-y-3">
            <h2 className="font-semibold">Tank dip levels</h2>
            {(tanks ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No tanks configured for this station.</p>
            ) : (
              <div className="space-y-2">
                {(tanks ?? []).map(tank => {
                  const current = tankBaseline(tank.id)
                  return (
                    <form key={tank.id} action={saveTankBaseline}
                      className="flex items-center gap-3 rounded border px-4 py-3">
                      <input type="hidden" name="station_id" value={selectedStation} />
                      <input type="hidden" name="tank_id" value={tank.id} />
                      <label className="flex-1 text-sm font-medium">
                        {tank.label}
                        <span className="ml-1 text-xs text-gray-400 font-normal">{tank.fuel_grade_id}</span>
                      </label>
                      <input
                        type="number"
                        name="value"
                        step="0.01"
                        min="0"
                        defaultValue={current !== '' ? Number(current) : undefined}
                        placeholder="e.g. 8000"
                        className="w-36 rounded border px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-400 w-4">L</span>
                      <button type="submit"
                        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">
                        Save
                      </button>
                    </form>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
