import type { StationNode } from '@/lib/station-config'
import Link from 'next/link'

export function StationTree({ tree }: { tree: StationNode[] }) {
  return (
    <div className="space-y-6">
      {tree.map((station) => (
        <div key={station.id} className="rounded-lg border p-4 space-y-3">
          {/* Station header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">{station.name}</h2>
              {station.address && (
                <p className="text-sm text-gray-500">{station.address}</p>
              )}
            </div>
            <Link
              href={`/dashboard/config/stations/${station.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Edit
            </Link>
          </div>

          {/* Tanks */}
          {station.tanks.length === 0 ? (
            <p className="text-sm text-gray-400 pl-4">No tanks — add one below</p>
          ) : (
            <ul className="space-y-2 pl-4 border-l">
              {station.tanks.map((tank) => (
                <li key={tank.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {tank.label}
                      <span className="ml-2 text-xs text-gray-500">
                        {tank.fuel_grade_id} · {tank.capacity_litres.toLocaleString()} L
                      </span>
                    </span>
                    <Link
                      href={`/dashboard/config/stations/${station.id}?editTank=${tank.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>

                  {/* Pumps */}
                  {tank.pumps.length > 0 && (
                    <ul className="mt-1 pl-4 flex flex-wrap gap-2">
                      {tank.pumps.map((pump) => (
                        <li
                          key={pump.id}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                        >
                          {pump.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Per-station actions */}
          <div className="flex gap-3 pt-1 text-sm">
            <Link
              href={`/dashboard/config/stations/${station.id}?addTank=1`}
              className="text-blue-600 hover:underline"
            >
              + Add tank
            </Link>
            <Link
              href={`/dashboard/config/stations/${station.id}?addPump=1`}
              className="text-blue-600 hover:underline"
            >
              + Add pump
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
