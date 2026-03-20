import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { CloseDipForm } from './CloseDipForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function CloseDipsPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('id, station_id, period, shift_date, status').eq('id', shiftId).single()
  if (!shift) notFound()

  if (!['open', 'pending_pos'].includes(shift.status)) redirect('/shift')

  const [{ data: tanks }, { data: closeDipReadings }, { data: pumps }, { data: closePumpReadings }, { data: posSubmission }] =
    await Promise.all([
      supabase.from('tanks').select('id, label, fuel_grade_id, capacity_litres')
        .eq('station_id', shift.station_id).order('label'),
      supabase.from('dip_readings').select('tank_id, litres')
        .eq('shift_id', shiftId).eq('type', 'close'),
      supabase.from('pumps').select('id').eq('station_id', shift.station_id),
      supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'close'),
      supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
    ])

  const progress = getCloseProgress(
    (pumps ?? []).map((p) => p.id),
    (closePumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (closeDipReadings ?? []).map((r) => r.tank_id),
    !!posSubmission
  )

  const dipMap = new Map((closeDipReadings ?? []).map((d) => [d.tank_id, d.litres]))

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Close — Dip readings</h1>
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
            <CloseDipForm
              shiftId={shiftId}
              tankId={tank.id}
              defaultLitres={dipMap.get(tank.id)?.toString() ?? ''}
            />
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/close/pumps`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Pump readings ({progress.pumps.done}/{progress.pumps.total})
        </Link>
        {progress.isReadyForPos && (
          <Link
            href={`/shift/${shiftId}/close/pos`}
            className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white"
          >
            POS Z-report
          </Link>
        )}
      </div>
    </main>
  )
}
