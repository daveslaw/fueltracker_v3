import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { submitShift } from '../../../actions'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function CloseSummaryPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts').select('id, station_id, period, shift_date, status').eq('id', shiftId).single()
  if (!shift) notFound()

  if (!['open', 'pending_pos'].includes(shift.status)) redirect('/shift')

  const [
    { data: station },
    { data: pumps }, { data: closePumpReadings },
    { data: tanks }, { data: closeDipReadings },
    { data: posSubmission },
  ] = await Promise.all([
    supabase.from('stations').select('name').eq('id', shift.station_id).single(),
    supabase.from('pumps').select('id, label').eq('station_id', shift.station_id).order('label'),
    supabase.from('pump_readings')
      .select('pump_id, meter_reading, pumps(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id, label').eq('station_id', shift.station_id).order('label'),
    supabase.from('dip_readings')
      .select('tank_id, litres, tanks(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
  ])

  const progress = getCloseProgress(
    (pumps ?? []).map((p) => p.id),
    (closePumpReadings ?? []).map((r) => r.pump_id),
    (tanks ?? []).map((t) => t.id),
    (closeDipReadings ?? []).map((r) => r.tank_id),
    !!posSubmission
  )

  if (!progress.isComplete) redirect(`/shift/${shiftId}/close/pumps`)

  // Load POS lines
  const { data: posLines } = posSubmission
    ? await supabase.from('pos_submission_lines')
        .select('fuel_grade_id, litres_sold, revenue_zar')
        .eq('pos_submission_id', posSubmission.id)
    : { data: [] }

  async function handleSubmit() {
    'use server'
    await submitShift(shiftId)
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Review &amp; submit shift</h1>
      <div className="text-sm text-gray-500 space-y-0.5">
        <p><span className="font-medium text-gray-800">{station?.name}</span></p>
        <p className="capitalize">{shift.period} · {shift.shift_date}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Closing pump readings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Pump</th>
              <th className="py-1">Reading (L)</th>
            </tr>
          </thead>
          <tbody>
            {(closePumpReadings ?? []).map((r) => (
              <tr key={r.pump_id} className="border-b">
                <td className="py-1 pr-4">{(r.pumps as { label: string })?.label}</td>
                <td className="py-1">{r.meter_reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Closing dip readings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Tank</th>
              <th className="py-1">Litres</th>
            </tr>
          </thead>
          <tbody>
            {(closeDipReadings ?? []).map((r) => (
              <tr key={r.tank_id} className="border-b">
                <td className="py-1 pr-4">{(r.tanks as { label: string })?.label}</td>
                <td className="py-1">{r.litres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">POS sales (Z-report)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Grade</th>
              <th className="py-1 pr-4">Litres sold</th>
              <th className="py-1">Revenue (ZAR)</th>
            </tr>
          </thead>
          <tbody>
            {(posLines ?? []).map((l) => (
              <tr key={l.fuel_grade_id} className="border-b">
                <td className="py-1 pr-4">{l.fuel_grade_id}</td>
                <td className="py-1 pr-4">{l.litres_sold}</td>
                <td className="py-1">R {Number(l.revenue_zar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/close/pos`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Back
        </Link>
        <form action={handleSubmit} className="flex-1">
          <button
            type="submit"
            className="w-full rounded bg-black py-2 text-sm font-medium text-white"
          >
            Submit shift
          </button>
        </form>
      </div>
    </main>
  )
}
