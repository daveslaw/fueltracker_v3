import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StockPosForm } from './StockPosForm'

type Props = { params: Promise<{ shiftId: string }> }

export default async function CashierStockPosPage({ params }: Props) {
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

  const [{ data: products }, { data: submission }, { data: existingLines }] = await Promise.all([
    supabase
      .from('products')
      .select('id, stock_code, description')
      .eq('station_id', stationId)
      .eq('is_active', true)
      .order('stock_code'),
    supabase
      .from('dry_stock_pos_submissions')
      .select('id, photo_url')
      .eq('shift_id', shiftId)
      .maybeSingle(),
    supabase
      .from('pos_dry_stock_lines')
      .select('product_id, units_sold, revenue_zar')
      .eq('dry_stock_pos_submission_id',
        (await supabase.from('dry_stock_pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle()).data?.id ?? ''
      ),
  ])

  const savedLines = (existingLines ?? []).map(l => ({
    product_id: l.product_id,
    units_sold: l.units_sold?.toString() ?? '',
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
        <h1 className="text-xl font-semibold">{periodLabel} shift — Dry stock Z-report</h1>
        <p className="text-sm text-gray-500">{shift.shift_date}</p>
      </div>

      <StockPosForm
        shiftId={shiftId}
        products={products ?? []}
        savedLines={savedLines}
        existingPhotoUrl={submission?.photo_url ?? null}
      />
    </main>
  )
}
