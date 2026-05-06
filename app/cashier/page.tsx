import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getCashierProgress, canCashierSubmit } from '@/lib/cashier-progress'

function periodLabel(period: string) {
  return period === 'morning' ? 'Morning' : 'Evening'
}

function shiftStatusBadge(shift: {
  cashier_submitted_at: string | null
  hasFuelPos: boolean
  hasDryStockPos: boolean
  stockReadingCount: number
  activeProductCount: number
}) {
  if (shift.cashier_submitted_at) {
    return (
      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
        Submitted
      </span>
    )
  }
  const progress = getCashierProgress({
    hasFuelPosSubmission: shift.hasFuelPos,
    hasDryStockPosSubmission: shift.hasDryStockPos,
    activeProductCount: shift.activeProductCount,
    stockReadingCount: shift.stockReadingCount,
  })
  const inProgress = progress.fuelPos || progress.stockPos || progress.stockCount
  if (inProgress && !canCashierSubmit(progress)) {
    return (
      <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
        In progress
      </span>
    )
  }
  return (
    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
      Not started
    </span>
  )
}

export default async function CashierHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const stationId = profile?.station_id ?? ''

  const [{ data: shiftsRaw }, { data: activeProducts }] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        id, period, shift_date, cashier_submitted_at,
        pos_submissions(id),
        dry_stock_pos_submissions(id),
        stock_readings(id)
      `)
      .eq('station_id', stationId)
      .eq('status', 'pending')
      .order('shift_date', { ascending: false })
      .order('period'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('station_id', stationId)
      .eq('is_active', true),
  ])

  const activeProductCount = activeProducts ?? 0

  const shifts = (shiftsRaw ?? []).map(s => ({
    id: s.id as string,
    period: s.period as string,
    shift_date: s.shift_date as string,
    cashier_submitted_at: s.cashier_submitted_at as string | null,
    hasFuelPos: Array.isArray(s.pos_submissions) && s.pos_submissions.length > 0,
    hasDryStockPos: Array.isArray(s.dry_stock_pos_submissions) && s.dry_stock_pos_submissions.length > 0,
    stockReadingCount: Array.isArray(s.stock_readings) ? s.stock_readings.length : 0,
    activeProductCount: typeof activeProductCount === 'number' ? activeProductCount : 0,
  }))

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Open Shifts</h1>

      {shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-gray-500">No open shifts at the moment.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shifts.map(s => (
            <li key={s.id}>
              <Link
                href={`/cashier/${s.id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{periodLabel(s.period)}</p>
                  <p className="text-sm text-gray-500">{s.shift_date}</p>
                </div>
                {shiftStatusBadge(s)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
