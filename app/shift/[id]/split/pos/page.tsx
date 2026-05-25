import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SplitPosForm } from './SplitPosForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function SplitPosPage({ params }: Props) {
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

  const stationId = shift.station_id as string

  const { data: pumpsRaw } = await supabase
    .from('pumps')
    .select('id, label, tanks(fuel_grade_id)')
    .eq('station_id', stationId)
    .order('label')

  const pumps = (pumpsRaw ?? []).map(p => ({
    id: p.id,
    label: p.label as string,
    fuel_grade_id: (p.tanks as unknown as { fuel_grade_id: string } | null)?.fuel_grade_id ?? '',
  }))

  const gradeIds = [...new Set(pumps.map(p => p.fuel_grade_id).filter(Boolean))]

  const [{ data: posSubmission }, { data: priceRows }] = await Promise.all([
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
    gradeIds.length
      ? supabase.from('fuel_prices')
          .select('fuel_grade_id, sell_price_per_litre, valid_from, valid_to')
          .eq('station_id', stationId)
          .in('fuel_grade_id', gradeIds)
      : Promise.resolve({ data: [] }),
  ])

  const { data: posLines } = posSubmission
    ? await supabase
        .from('pos_submission_lines')
        .select('pump_id, litres_sold, revenue_zar')
        .eq('pos_submission_id', posSubmission.id)
    : { data: [] }

  const now = new Date().toISOString()
  const activePriceByGrade = new Map<string, number>()
  for (const row of (priceRows ?? [])) {
    if (row.valid_from <= now && (row.valid_to === null || row.valid_to > now)) {
      if (!activePriceByGrade.has(row.fuel_grade_id)) {
        activePriceByGrade.set(row.fuel_grade_id, row.sell_price_per_litre)
      }
    }
  }
  const prices = [...activePriceByGrade.entries()].map(([fuel_grade_id, price]) => ({
    fuel_grade_id,
    price,
  }))

  const existingLines = (posLines ?? []).map(l => ({
    pump_id: l.pump_id ?? '',
    litres_sold: l.litres_sold?.toString() ?? '',
    revenue_zar: l.revenue_zar?.toString() ?? '',
  })).filter(l => l.pump_id)

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Price change split — Part 1 close</p>
        <h1 className="text-xl font-semibold mt-1">Interim POS Z-report</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <SplitPosForm
        shiftId={shiftId}
        pumps={pumps}
        prices={prices}
        existingLines={existingLines}
        existingPhotoUrl={posSubmission?.photo_url ?? null}
      />

      <div className="flex gap-3">
        <Link
          href={`/shift/${shiftId}/split/dips`}
          className="flex-1 rounded border py-2 text-center text-sm font-medium"
        >
          Dip readings
        </Link>
        <Link
          href={`/shift/${shiftId}/split/confirm`}
          className="flex-1 rounded bg-black py-2 text-center text-sm font-medium text-white"
        >
          Review &amp; confirm
        </Link>
      </div>
    </main>
  )
}
