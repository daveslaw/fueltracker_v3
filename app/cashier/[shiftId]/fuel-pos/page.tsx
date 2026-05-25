import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCashierSubmissionState } from '@/lib/cashier-submission'
import { buildCashierSteps } from '@/lib/workflow-steps'
import { StepIndicator } from '@/components/StepIndicator'
import { FuelPosForm } from './FuelPosForm'

type Props = { params: Promise<{ shiftId: string }> }

export default async function CashierFuelPosPage({ params }: Props) {
  const { shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const stationId = profile?.station_id ?? ''

  const [state, { data: shift }] = await Promise.all([
    getCashierSubmissionState(shiftId),
    supabase.from('shifts')
      .select('id, period, shift_date, status')
      .eq('id', shiftId)
      .eq('station_id', stationId)
      .single(),
  ])

  if (!shift) notFound()
  if (state.submitted) redirect(`/cashier/${shiftId}`)

  // Load pumps joined to tanks for grade info, sorted numerically by label
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

  // Active price per grade (most recent valid_from with no valid_to or future valid_to)
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

  const periodLabel = shift.period === 'morning' ? 'Morning' : 'Evening'

  const progress = state.submitted ? { fuelPos: true, stockPos: true, stockCount: true } : state.progress
  const steps = buildCashierSteps(shiftId, 'fuel-pos', progress)

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <StepIndicator steps={steps} currentIndex={0} />

      <div>
        <h1 className="text-xl font-semibold">{periodLabel} shift — Fuel Z-report</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <FuelPosForm
        shiftId={shiftId}
        pumps={pumps}
        prices={prices}
        existingLines={existingLines}
        existingPhotoUrl={posSubmission?.photo_url ?? null}
      />
    </main>
  )
}
