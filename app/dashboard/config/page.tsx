import { createClient } from '@/lib/supabase/server'
import { buildStationTree } from '@/lib/station-config'
import { StationTree } from './StationTree'
import Link from 'next/link'

export default async function ConfigPage() {
  const supabase = await createClient()

  const [{ data: stations }, { data: tanks }, { data: pumps }] = await Promise.all([
    supabase.from('stations').select('id, name, address').order('name'),
    supabase.from('tanks').select('id, station_id, label, fuel_grade_id, capacity_litres').order('label'),
    supabase.from('pumps').select('id, station_id, tank_id, label').order('label'),
  ])

  const tree = buildStationTree(stations ?? [], tanks ?? [], pumps ?? [])

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Station Config</h1>
        <Link
          href="/dashboard/config/stations/new"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Add station
        </Link>
      </div>

      {tree.length === 0 ? (
        <p className="text-sm text-gray-500">No stations configured yet.</p>
      ) : (
        <StationTree tree={tree} />
      )}
    </main>
  )
}
