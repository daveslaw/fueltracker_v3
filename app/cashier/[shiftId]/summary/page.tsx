import { createClient }              from '@/lib/supabase/server'
import { notFound }                  from 'next/navigation'
import Link                          from 'next/link'
import { getCashierSubmissionState } from '@/lib/cashier-submission'

type Props = { params: Promise<{ shiftId: string }> }

const fmt  = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtR = (n: number) => `R ${fmt(n)}`

export default async function CashierSummaryPage({ params }: Props) {
  const { shiftId } = await params
  const supabase    = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const stationId = profile?.station_id ?? ''

  const [state, { data: shift }, { data: station }, { data: rec }, { data: posSubmission }] = await Promise.all([
    getCashierSubmissionState(shiftId),
    supabase.from('shifts')
      .select('id, period, shift_date')
      .eq('id', shiftId)
      .eq('station_id', stationId)
      .single(),
    supabase.from('stations').select('name').eq('id', stationId).single(),
    supabase.from('reconciliations').select('id').eq('shift_id', shiftId).maybeSingle(),
    supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
  ])

  if (!shift || !state.submitted) notFound()

  const [{ data: gradeLines }, { data: stockLines }, { data: products }] = await Promise.all([
    rec
      ? supabase.from('reconciliation_grade_lines')
          .select('fuel_grade_id, meter_delta, pos_litres_sold, variance_litres, sell_price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar')
          .eq('reconciliation_id', rec.id)
      : Promise.resolve({ data: [] as any[] }),
    rec
      ? supabase.from('reconciliation_stock_lines')
          .select('product_id, opening_count, deliveries_received, pos_units_sold, expected_closing_count, actual_closing_count, variance_units, variance_zar')
          .eq('reconciliation_id', rec.id)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('products').select('id, name').eq('station_id', stationId),
  ])

  const productName = (productId: string) =>
    products?.find(p => p.id === productId)?.name ?? productId

  const periodLabel = shift.period === 'morning' ? 'Morning' : 'Evening'

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <p className="text-sm text-gray-500">{station?.name}</p>
        <h1 className="text-2xl font-semibold">{periodLabel} Shift</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
        <p className="text-xs text-green-700 mt-1 font-medium">
          Submitted {new Date(state.submittedAt).toLocaleString('en-ZA')}
        </p>
      </div>

      {/* Fuel grade lines */}
      {(gradeLines ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fuel Sales</h2>
          <div className="border rounded-md divide-y text-sm">
            {(gradeLines ?? []).map(line => (
              <div key={line.fuel_grade_id} className="px-4 py-3 space-y-1">
                <div className="font-medium">{line.fuel_grade_id}</div>
                <div className="grid grid-cols-2 gap-x-4 text-gray-500 text-xs">
                  <span>POS litres</span><span className="text-right">{fmt(line.pos_litres_sold)} L</span>
                  <span>POS revenue</span><span className="text-right">{fmtR(line.pos_revenue_zar)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dry stock lines */}
      {(stockLines ?? []).length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dry Stock</h2>
          <div className="border rounded-md divide-y text-sm">
            {(stockLines ?? []).map(line => (
              <div key={line.product_id} className="px-4 py-3 space-y-1">
                <div className="font-medium">{productName(line.product_id)}</div>
                <div className="grid grid-cols-2 gap-x-4 text-gray-500 text-xs">
                  <span>Opening</span><span className="text-right">{fmt(line.opening_count)}</span>
                  <span>Deliveries</span><span className="text-right">+{fmt(line.deliveries_received)}</span>
                  <span>POS units sold</span><span className="text-right">−{fmt(line.pos_units_sold)}</span>
                  <span>Expected closing</span><span className="text-right">{fmt(line.expected_closing_count)}</span>
                  <span>Actual closing</span><span className="text-right">{fmt(line.actual_closing_count)}</span>
                </div>
                <div className={`flex justify-between font-semibold text-sm pt-1 border-t ${
                  line.variance_units < 0 ? 'text-red-600' :
                  line.variance_units > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  <span>Physical variance</span>
                  <span>
                    {line.variance_units > 0 ? '+' : ''}{fmt(line.variance_units)} units
                    {' '}({line.variance_zar > 0 ? '+' : ''}{fmtR(line.variance_zar)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-gray-400">Dry stock reconciliation pending.</p>
      )}

      <Link
        href={`/cashier/${shiftId}`}
        className="block w-full text-center rounded border py-2.5 text-sm font-medium"
      >
        Back
      </Link>
    </main>
  )
}
