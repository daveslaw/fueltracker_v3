import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ConfirmSplitButton } from './ConfirmSplitButton'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function SplitConfirmPage({ params }: Props) {
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

  const [
    { data: pumps },
    { data: closePumpReadings },
    { data: tanks },
    { data: closeDipReadings },
    { data: posSubmission },
    { data: fuelGrades },
  ] = await Promise.all([
    supabase.from('pumps').select('id, label').eq('station_id', shift.station_id),
    supabase.from('pump_readings').select('pump_id, meter_reading')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id, label, fuel_grade_id')
      .eq('station_id', shift.station_id).order('label'),
    supabase.from('dip_readings').select('tank_id, litres')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
    supabase.from('fuel_grades').select('id, label'),
  ])

  const { data: posLines } = posSubmission
    ? await supabase
        .from('pos_submission_lines')
        .select('fuel_grade_id, litres_sold, revenue_zar')
        .eq('pos_submission_id', posSubmission.id)
    : { data: [] }

  const pumpReadingMap = new Map((closePumpReadings ?? []).map(r => [r.pump_id, r.meter_reading]))
  const dipMap = new Map((closeDipReadings ?? []).map(d => [d.tank_id, d.litres]))
  const gradeMap = new Map((fuelGrades ?? []).map(g => [g.id, g.label]))

  const sortedPumps = (pumps ?? []).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  )

  const pumpsDone   = (closePumpReadings ?? []).length
  const dipsDone    = (closeDipReadings ?? []).length
  const posLinesDone = (posLines ?? []).length

  const readyToSplit = pumpsDone === sortedPumps.length && dipsDone === (tanks ?? []).length && posLinesDone > 0

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Price change split — Part 1 close</p>
        <h1 className="text-xl font-semibold mt-1">Review &amp; confirm</h1>
        <p className="text-sm text-gray-500">{shift.shift_date} · {shift.period}</p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pump readings</h2>
          <span className="text-xs text-gray-500">{pumpsDone}/{sortedPumps.length}</span>
        </div>
        {sortedPumps.length === 0 ? (
          <p className="text-xs text-gray-400">No pumps configured.</p>
        ) : (
          <ul className="divide-y rounded border text-sm">
            {sortedPumps.map(pump => (
              <li key={pump.id} className="flex justify-between px-3 py-2">
                <span>{pump.label}</span>
                {pumpReadingMap.has(pump.id)
                  ? <span className="font-medium">{pumpReadingMap.get(pump.id)?.toLocaleString()}</span>
                  : <span className="text-red-500 text-xs">Missing</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/shift/${shiftId}/split/pumps`} className="text-xs text-blue-600 hover:underline">
          Edit pump readings
        </Link>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Dip readings</h2>
          <span className="text-xs text-gray-500">{dipsDone}/{(tanks ?? []).length}</span>
        </div>
        {(tanks ?? []).length === 0 ? (
          <p className="text-xs text-gray-400">No tanks configured.</p>
        ) : (
          <ul className="divide-y rounded border text-sm">
            {(tanks ?? []).map(tank => (
              <li key={tank.id} className="flex justify-between px-3 py-2">
                <span>{tank.label} <span className="text-gray-400 text-xs">({tank.fuel_grade_id})</span></span>
                {dipMap.has(tank.id)
                  ? <span className="font-medium">{dipMap.get(tank.id)?.toLocaleString()} L</span>
                  : <span className="text-red-500 text-xs">Missing</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/shift/${shiftId}/split/dips`} className="text-xs text-blue-600 hover:underline">
          Edit dip readings
        </Link>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">POS Z-report</h2>
          <span className="text-xs text-gray-500">{posLinesDone} line{posLinesDone !== 1 ? 's' : ''}</span>
        </div>
        {posLinesDone === 0 ? (
          <p className="text-xs text-red-500">No POS lines saved yet.</p>
        ) : (
          <ul className="divide-y rounded border text-sm">
            {(posLines ?? []).map(line => (
              <li key={line.fuel_grade_id} className="flex justify-between px-3 py-2">
                <span>{gradeMap.get(line.fuel_grade_id) ?? line.fuel_grade_id}</span>
                <span className="font-medium">
                  {line.litres_sold?.toLocaleString()} L · R{line.revenue_zar?.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/shift/${shiftId}/split/pos`} className="text-xs text-blue-600 hover:underline">
          Edit Z-report
        </Link>
      </section>

      {!readyToSplit && (
        <p className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          All pump readings, dip readings, and at least one POS line are required before splitting.
        </p>
      )}

      <div className="pt-2">
        {readyToSplit
          ? <ConfirmSplitButton shiftId={shiftId} />
          : (
            <button
              disabled
              className="w-full rounded bg-amber-600 py-3 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
            >
              Confirm split — close Part 1
            </button>
          )
        }
      </div>

      <p className="text-xs text-gray-400 text-center">
        Confirming will close Part 1 and open Part 2 at the new price. You will continue capturing the rest of this shift on Part 2.
      </p>
    </main>
  )
}
