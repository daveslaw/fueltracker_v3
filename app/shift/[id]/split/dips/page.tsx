import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CloseDipForm } from '../../close/dips/CloseDipForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function SplitDipsPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status, part')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()

  if (shift.status !== 'pending' || shift.part !== 0) {
    return (
      <main className="p-6 max-w-lg mx-auto">
        <p className="text-sm text-red-600">
          This shift cannot be split. It must be pending and unsplit (part 0).
        </p>
      </main>
    )
  }

  const [{ data: tanks }, { data: closeDipReadings }] = await Promise.all([
    supabase.from('tanks').select('id, label, fuel_grade_id, capacity_litres')
      .eq('station_id', shift.station_id).order('label'),
    supabase.from('dip_readings').select('tank_id, litres')
      .eq('shift_id', shiftId).eq('type', 'close'),
  ])

  const dipMap = new Map((closeDipReadings ?? []).map((d) => [d.tank_id, d.litres]))
  const dipsDone = (closeDipReadings ?? []).length
  const dipsTotal = (tanks ?? []).length

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Price change split — Part 1 close</p>
          <h1 className="text-xl font-semibold mt-1">Dip readings</h1>
        </div>
        <span className="text-sm text-gray-500">{dipsDone}/{dipsTotal} tanks</span>
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
          href={`/shift/${shiftId}/split/pumps`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Pump readings
        </Link>
        <Link
          href={`/shift/${shiftId}/split/pos`}
          className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white"
        >
          Next: POS Z-report
        </Link>
      </div>
    </main>
  )
}
