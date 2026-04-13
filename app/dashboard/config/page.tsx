export const dynamic = 'force-dynamic'

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
        <div className="flex gap-2">
          <Link
            href="/dashboard/config/baselines"
            className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Baselines
          </Link>
          <Link
            href="/dashboard/config/pricing"
            className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Fuel pricing
          </Link>
          <Link
            href="/dashboard/config/stations/new"
            className="rounded border border-gray-300 dark:border-gray-600 bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Add station
          </Link>
        </div>
      </div>

      {tree.length === 0 ? (
        <p className="text-sm text-gray-500">No stations configured yet.</p>
      ) : (
        <StationTree tree={tree} />
      )}
    </main>
  )
}
