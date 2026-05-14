import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PumpCarousel } from '../../close/pumps/PumpCarousel'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function SplitPumpsPage({ params }: Props) {
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

  const [{ data: pumps }, { data: closePumpReadings }] = await Promise.all([
    supabase.from('pumps').select('id, label').eq('station_id', shift.station_id),
    supabase.from('pump_readings').select('pump_id, meter_reading')
      .eq('shift_id', shiftId).eq('type', 'close'),
  ])

  const sortedPumps = (pumps ?? []).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  )
  const readingMap = new Map((closePumpReadings ?? []).map((r) => [r.pump_id, r]))
  const carouselPumps = sortedPumps.map(p => ({
    id: p.id,
    label: p.label,
    defaultMeter: readingMap.get(p.id)?.meter_reading?.toString() ?? '',
  }))
  const savedPumpIds = (closePumpReadings ?? []).map(r => r.pump_id)
  const pumpsDone = savedPumpIds.length

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Price change split — Part 1 close</p>
        <h1 className="text-xl font-semibold capitalize mt-1">{shift.period} shift · Pump meters</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <PumpCarousel
        shiftId={shiftId}
        pumps={carouselPumps}
        initialSavedIds={savedPumpIds}
      />

      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/split/dips`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Dip readings
        </Link>
        {pumpsDone === sortedPumps.length && sortedPumps.length > 0 && (
          <Link
            href={`/shift/${shiftId}/split/dips`}
            className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white"
          >
            Next: Dips
          </Link>
        )}
      </div>
    </main>
  )
}
