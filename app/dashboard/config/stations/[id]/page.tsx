import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FUEL_GRADE_IDS } from '@/lib/station-config'
import { StationForm } from '../../StationForm'
import { TankForm } from '../../TankForm'
import { PumpForm } from '../../PumpForm'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ addTank?: string; addPump?: string; editTank?: string }>
}

export default async function StationDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const [{ data: station }, { data: tanks }, { data: pumps }] = await Promise.all([
    supabase.from('stations').select('*').eq('id', id).single(),
    supabase.from('tanks').select('*').eq('station_id', id).order('label'),
    supabase.from('pumps').select('*').eq('station_id', id).order('label'),
  ])

  if (!station) notFound()

  const editingTank = sp.editTank ? tanks?.find((t) => t.id === sp.editTank) : null

  return (
    <main className="p-6 max-w-lg mx-auto space-y-8">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Edit Station</h1>
        <StationForm station={station} />
      </section>

      {sp.addTank && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Add Tank</h2>
          <TankForm stationId={id} gradeIds={[...FUEL_GRADE_IDS]} />
        </section>
      )}

      {editingTank && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Edit Tank</h2>
          <TankForm stationId={id} gradeIds={[...FUEL_GRADE_IDS]} tank={editingTank} />
        </section>
      )}

      {sp.addPump && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Add Pump</h2>
          <PumpForm stationId={id} tanks={tanks ?? []} />
        </section>
      )}

      {/* Existing tanks summary */}
      <section className="space-y-2">
        <h2 className="text-base font-medium text-gray-700">
          Tanks ({tanks?.length ?? 0}) · Pumps ({pumps?.length ?? 0})
        </h2>
        <ul className="space-y-1 text-sm">
          {tanks?.map((tank) => (
            <li key={tank.id} className="flex justify-between">
              <span>{tank.label} <span className="text-gray-400">({tank.fuel_grade_id})</span></span>
              <a href={`?editTank=${tank.id}`} className="text-blue-600 hover:underline text-xs">Edit</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
