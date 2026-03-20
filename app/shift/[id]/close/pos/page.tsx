import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { PosConfirmForm } from './PosConfirmForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function ClosePosPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('id, station_id, period, shift_date, status').eq('id', shiftId).single()
  if (!shift) notFound()

  if (!['open', 'pending_pos'].includes(shift.status)) redirect('/shift')

  const [
    { data: pumps }, { data: closePumpReadings },
    { data: tanks }, { data: closeDipReadings },
    { data: posSubmission }, { data: posLines },
    { data: fuelGrades },
  ] = await Promise.all([
    supabase.from('pumps').select('id').eq('station_id', shift.station_id),
    supabase.from('pump_readings').select('pump_id').eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id').eq('station_id', shift.station_id),
    supabase.from('dip_readings').select('tank_id').eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
    supabase.from('pos_submission_lines')
      .select('fuel_grade_id, litres_sold, revenue_zar')
      .eq('pos_submission_id',
        (await supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle()).data?.id ?? ''
      ),
    supabase.from('fuel_grades').select('id, label'),
  ])

  const progress = getCloseProgress(
    (pumps ?? []).map((p) => p.id),
    (closePumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (closeDipReadings ?? []).map((r) => r.tank_id),
    !!posSubmission
  )

  // Block access to POS page until close readings are complete
  if (!progress.isReadyForPos) redirect(`/shift/${shiftId}/close/pumps`)

  const existingLines = (posLines ?? []).map((l) => ({
    fuel_grade_id: l.fuel_grade_id,
    litres_sold: l.litres_sold?.toString() ?? '',
    revenue_zar: l.revenue_zar?.toString() ?? '',
  }))

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold capitalize">{shift.period} shift — POS Z-report</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <PosConfirmForm
        shiftId={shiftId}
        grades={fuelGrades ?? []}
        existingLines={existingLines}
        existingPhotoUrl={posSubmission?.photo_url ?? null}
      />

      {progress.isComplete && (
        <Link
          href={`/shift/${shiftId}/close/summary`}
          className="block w-full rounded border py-2 text-center text-sm font-medium"
        >
          Review &amp; submit shift
        </Link>
      )}
    </main>
  )
}
