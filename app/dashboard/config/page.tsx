import { getCachedStationTree } from '@/lib/station-config'
import { StationTree } from './StationTree'
import Link from 'next/link'

export default async function ConfigPage() {
  const tree = await getCachedStationTree()

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Station Config</h1>
        </div>
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
