import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveOpeningCount } from '@/lib/stock-baselines'
import { StockCountForm } from './StockCountForm'

type Props = { params: Promise<{ shiftId: string }> }

export default async function CashierStockCountPage({ params }: Props) {
  const { shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('station_id')
    .eq('user_id', user!.id)
    .single()

  const stationId = profile?.station_id ?? ''

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, period, shift_date, status, cashier_submitted_at')
    .eq('id', shiftId)
    .eq('station_id', stationId)
    .single()

  if (!shift) notFound()
  if (shift.cashier_submitted_at) redirect(`/cashier/${shiftId}`)

  // Find prior closed shift for this station to resolve opening counts
  const { data: priorShiftData } = await supabase
    .from('shifts')
    .select('id')
    .eq('station_id', stationId)
    .eq('status', 'closed')
    .lt('shift_date', shift.shift_date)
    .order('shift_date', { ascending: false })
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()

  let priorClosingCounts: Map<string, number> | null = null
  if (priorShiftData?.id) {
    const { data: priorReadings } = await supabase
      .from('stock_readings')
      .select('product_id, closing_count')
      .eq('shift_id', priorShiftData.id)
    if (priorReadings?.length) {
      priorClosingCounts = new Map(priorReadings.map(r => [r.product_id, r.closing_count]))
    }
  }

  const [
    { data: products },
    { data: stockBaselinesRaw },
    { data: currentReadings },
    { data: deliveries },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, stock_code, description')
      .eq('station_id', stationId)
      .eq('is_active', true)
      .order('stock_code'),
    supabase
      .from('stock_baselines')
      .select('station_id, product_id, quantity')
      .eq('station_id', stationId),
    supabase
      .from('stock_readings')
      .select('product_id, closing_count')
      .eq('shift_id', shiftId),
    supabase
      .from('stock_deliveries')
      .select('id, product_id, quantity')
      .eq('shift_id', shiftId),
  ])

  const stockBaselines = (stockBaselinesRaw ?? []).map(b => ({
    station_id: b.station_id,
    product_id: b.product_id,
    quantity: b.quantity,
  }))

  const readingsByProduct = new Map(
    (currentReadings ?? []).map(r => [r.product_id, r.closing_count])
  )

  const productRows = (products ?? []).map(p => ({
    id: p.id,
    stock_code: p.stock_code,
    description: p.description,
    openingCount: resolveOpeningCount(p.id, priorClosingCounts, stockBaselines),
    closingCount: readingsByProduct.get(p.id) ?? null,
    deliveries: (deliveries ?? [])
      .filter(d => d.product_id === p.id)
      .map(d => ({ id: d.id, quantity: d.quantity })),
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
        <h1 className="text-xl font-semibold">{periodLabel} shift — Stock count</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      {productRows.length === 0 ? (
        <p className="text-sm text-gray-500">No active products configured for this station.</p>
      ) : (
        <StockCountForm
          shiftId={shiftId}
          stationId={stationId}
          products={productRows}
        />
      )}
    </main>
  )
}
