import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { finalizeShiftOpen } from '../../actions'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function SummaryPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()

  if (shift.status === 'open') redirect('/shift')

  const [{ data: station }, { data: pumpReadings }, { data: dipReadings }] = await Promise.all([
    supabase.from('stations').select('name').eq('id', shift.station_id).single(),
    supabase.from('pump_readings')
      .select('pump_id, meter_reading, pumps(label)')
      .eq('shift_id', shiftId).eq('type', 'open'),
    supabase.from('dip_readings')
      .select('tank_id, litres, tanks(label, fuel_grade_id)')
      .eq('shift_id', shiftId).eq('type', 'open'),
  ])

  async function handleFinalize() {
    'use server'
    const result = await finalizeShiftOpen(shiftId)
    if ('success' in result) redirect('/shift')
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Shift summary</h1>
      <div className="text-sm text-gray-500 space-y-0.5">
        <p><span className="font-medium text-gray-800">{station?.name}</span></p>
        <p className="capitalize">{shift.period} · {shift.shift_date}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Pump meter readings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Pump</th>
              <th className="py-1">Reading (L)</th>
            </tr>
          </thead>
          <tbody>
            {(pumpReadings ?? []).map((r) => (
              <tr key={r.pump_id} className="border-b">
                <td className="py-1 pr-4">{(r.pumps as { label: string })?.label}</td>
                <td className="py-1">{r.meter_reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Dip readings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Tank</th>
              <th className="py-1 pr-4">Grade</th>
              <th className="py-1">Litres</th>
            </tr>
          </thead>
          <tbody>
            {(dipReadings ?? []).map((r) => {
              const tank = r.tanks as { label: string; fuel_grade_id: string }
              return (
                <tr key={r.tank_id} className="border-b">
                  <td className="py-1 pr-4">{tank?.label}</td>
                  <td className="py-1 pr-4">{tank?.fuel_grade_id}</td>
                  <td className="py-1">{r.litres}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="flex gap-3">
        <Link href={`/shift/${shiftId}/pumps`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium">
          Back
        </Link>
        <form action={handleFinalize} className="flex-1">
          <button type="submit"
            className="w-full rounded bg-black py-2 text-sm font-medium text-white">
            Confirm &amp; open shift
          </button>
        </form>
      </div>
    </main>
  )
}
