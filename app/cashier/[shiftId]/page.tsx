import { createClient } from '@/lib/supabase/server'
import { notFound }     from 'next/navigation'
import { getCashierProgress, canCashierSubmit } from '@/lib/cashier-progress'
import { buildCashierSteps } from '@/lib/workflow-steps'
import { StepIndicator }     from '@/components/StepIndicator'
import { submitCashierShift } from './actions'

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0">
      <span
        aria-hidden
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold
          ${done ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-transparent'}`}
      >
        &#10003;
      </span>
      <span className={done ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
      <span className="ml-auto text-xs font-medium">
        {done
          ? <span className="text-green-700">Complete</span>
          : <span className="text-gray-400">Pending</span>}
      </span>
    </li>
  )
}

export default async function CashierHubPage({
  params,
}: {
  params: Promise<{ shiftId: string }>
}) {
  const { shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const stationId = profile?.station_id ?? ''

  const [
    { data: shift },
    { data: station },
    { data: fuelPos },
    { data: dryStockPos },
    { count: stockReadingCount },
    { count: activeProductCount },
  ] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, period, shift_date, status, cashier_submitted_at')
      .eq('id', shiftId)
      .eq('station_id', stationId)
      .single(),
    supabase
      .from('stations')
      .select('name')
      .eq('id', stationId)
      .single(),
    supabase
      .from('pos_submissions')
      .select('id')
      .eq('shift_id', shiftId)
      .limit(1),
    supabase
      .from('dry_stock_pos_submissions')
      .select('id')
      .eq('shift_id', shiftId)
      .limit(1),
    supabase
      .from('stock_readings')
      .select('id', { count: 'exact', head: true })
      .eq('shift_id', shiftId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('station_id', stationId)
      .eq('is_active', true),
  ])

  if (!shift) notFound()

  const progress = getCashierProgress({
    hasFuelPosSubmission: (fuelPos?.length ?? 0) > 0,
    hasDryStockPosSubmission: (dryStockPos?.length ?? 0) > 0,
    activeProductCount: activeProductCount ?? 0,
    stockReadingCount: stockReadingCount ?? 0,
  })
  const canSubmit = canCashierSubmit(progress) && !shift.cashier_submitted_at

  const periodLabel = shift.period === 'morning' ? 'Morning' : 'Evening'
  const steps = buildCashierSteps(shiftId, 'summary', progress)

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <StepIndicator steps={steps} currentIndex={3} />
      <div>
        <p className="text-sm text-gray-500">{station?.name}</p>
        <h1 className="text-2xl font-semibold">{periodLabel} Shift</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-1">Progress</h2>
        <ul className="rounded-lg border divide-y">
          <CheckItem label="Fuel POS Z-report" done={progress.fuelPos} />
          <CheckItem label="Dry stock POS Z-report" done={progress.stockPos} />
          <CheckItem label="Stock count" done={progress.stockCount} />
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-500">Sections</h2>
        <nav className="space-y-2">
          <a
            href={`/cashier/${shiftId}/fuel-pos`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
          >
            <span className="font-medium">Fuel POS Z-report</span>
            <span className="text-xs text-gray-400">&rsaquo;</span>
          </a>
          <a
            href={`/cashier/${shiftId}/stock-pos`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
          >
            <span className="font-medium">Dry stock POS Z-report</span>
            <span className="text-xs text-gray-400">&rsaquo;</span>
          </a>
          <a
            href={`/cashier/${shiftId}/stock-count`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
          >
            <span className="font-medium">Stock count</span>
            <span className="text-xs text-gray-400">&rsaquo;</span>
          </a>
        </nav>
      </section>

      {shift.cashier_submitted_at ? (
        <p className="text-sm text-green-700 font-medium text-center">
          Submitted {new Date(shift.cashier_submitted_at).toLocaleString('en-ZA')}
        </p>
      ) : (
        <form action={async (formData: FormData) => {
          'use server'
          const result = await submitCashierShift(shiftId)
          if (result && 'error' in result) {
            throw new Error(result.error)
          }
        }}>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit shift
          </button>
        </form>
      )}
    </main>
  )
}
