import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getShiftProgress } from '@/lib/shift-open'
import { DipForm } from './DipForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function DipsPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('id, station_id, period, shift_date').eq('id', shiftId).single()
  if (!shift) notFound()

  const [{ data: tanks }, { data: dipReadings }, { data: pumps }, { data: pumpReadings }] =
    await Promise.all([
      supabase.from('tanks').select('id, label, fuel_grade_id, capacity_litres')
        .eq('station_id', shift.station_id).order('label'),
      supabase.from('dip_readings').select('tank_id, litres')
        .eq('shift_id', shiftId).eq('type', 'open'),
      supabase.from('pumps').select('id').eq('station_id', shift.station_id),
      supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'open'),
    ])

  const progress = getShiftProgress(
    (pumps ?? []).map((p) => p.id),
    (pumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (dipReadings ?? []).map((r) => r.tank_id)
  )

  const dipMap = new Map((dipReadings ?? []).map((d) => [d.tank_id, d.litres]))

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dip readings</h1>
        <span className="text-sm text-gray-500">
          {progress.tanks.done}/{progress.tanks.total} tanks
        </span>
      </div>

      <ul className="space-y-4">
        {(tanks ?? []).map((tank) => (
          <li key={tank.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{tank.label}</span>
              <span className="text-xs text-gray-500">
                {tank.fuel_grade_id} · cap {tank.capacity_litres.toLocaleString()} L
              </span>
            </div>
            <DipForm
              shiftId={shiftId}
              tankId={tank.id}
              defaultLitres={dipMap.get(tank.id)?.toString() ?? ''}
            />
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Link href={`/shift/${shiftId}/pumps`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium">
          Pump readings ({progress.pumps.done}/{progress.pumps.total})
        </Link>
        {progress.isComplete && (
          <Link href={`/shift/${shiftId}/summary`}
            className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white">
            Review &amp; finalise
          </Link>
        )}
      </div>
    </main>
  )
}
