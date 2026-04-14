import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { PumpCarousel } from './PumpCarousel'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function ClosePumpsPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()

  // Only pending shifts can have close readings entered
  if (shift.status !== 'pending') {
    redirect(`/shift/${shiftId}/close/summary`)
  }

  const [{ data: pumps }, { data: closePumpReadings }, { data: tanks }, { data: closeDipReadings }, { data: posSubmission }] =
    await Promise.all([
      supabase.from('pumps').select('id, label').eq('station_id', shift.station_id),
      supabase.from('pump_readings').select('pump_id, meter_reading')
        .eq('shift_id', shiftId).eq('type', 'close'),
      supabase.from('tanks').select('id').eq('station_id', shift.station_id),
      supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'close'),
      supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
    ])

  const sortedPumps = (pumps ?? []).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  )

  const progress = getCloseProgress(
    sortedPumps.map((p) => p.id),
    (closePumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (closeDipReadings ?? []).map((r) => r.tank_id),
    !!posSubmission
  )

  const readingMap = new Map((closePumpReadings ?? []).map((r) => [r.pump_id, r]))
  const carouselPumps = sortedPumps.map(p => ({
    id: p.id,
    label: p.label,
    defaultMeter: readingMap.get(p.id)?.meter_reading?.toString() ?? '',
  }))
  const savedPumpIds = (closePumpReadings ?? []).map(r => r.pump_id)

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold capitalize">{shift.period} shift — Close readings</h1>
        <p className="text-sm text-gray-500">{shift.shift_date} · Pump meters</p>
      </div>

      <PumpCarousel
        shiftId={shiftId}
        pumps={carouselPumps}
        initialSavedIds={savedPumpIds}
      />

      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/close/dips`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Dip readings ({progress.tanks.done}/{progress.tanks.total})
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
