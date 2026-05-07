import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCashierSubmissionState } from '@/lib/cashier-submission'
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

  const [state, { data: shift }] = await Promise.all([
    getCashierSubmissionState(shiftId),
    supabase.from('shifts')
      .select('id, period, shift_date, status')
      .eq('id', shiftId)
      .eq('station_id', profile?.station_id ?? '')
      .single(),
  ])

  if (!shift) notFound()
  if (state.submitted) redirect(`/cashier/${shiftId}`)

  const [{ data: fuelGrades }, { data: posSubmission }, { data: posLines }] = await Promise.all([
    supabase.from('fuel_grades').select('id, label').order('label'),
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
    supabase
      .from('pos_submission_lines')
      .select('fuel_grade_id, litres_sold, revenue_zar')
      .eq('pos_submission_id',
        (await supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle()).data?.id ?? ''
      ),
  ])

  const existingLines = (posLines ?? []).map(l => ({
    fuel_grade_id: l.fuel_grade_id,
    litres_sold: l.litres_sold?.toString() ?? '',
    revenue_zar: l.revenue_zar?.toString() ?? '',
  }))

  const periodLabel = shift.period === 'morning' ? 'Morning' : 'Evening'

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/cashier/${shiftId}`} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{periodLabel} shift — Fuel Z-report</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <FuelPosForm
        shiftId={shiftId}
        grades={fuelGrades ?? []}
        existingLines={existingLines}
        existingPhotoUrl={posSubmission?.photo_url ?? null}
      />
    </main>
  )
}
