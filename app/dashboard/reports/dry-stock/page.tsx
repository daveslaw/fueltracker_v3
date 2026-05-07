import { createClient } from '@/lib/supabase/server'
import Link             from 'next/link'

interface Props {
  searchParams: Promise<{ station?: string; from?: string; to?: string }>
}

const fmt  = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtR = (n: number) => `R ${fmt(Math.abs(n))}`

export default async function DryStockReportPage({ searchParams }: Props) {
  const { station: stationId, from, to } = await searchParams

  const supabase  = await createClient()
  const today     = new Date().toISOString().slice(0, 10)
  const sevenAgo  = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
  const selectedFrom    = from ?? sevenAgo
  const selectedTo      = to   ?? today

  const { data: stations } = await supabase.from('stations').select('id, name').order('name')

  // ── Data query ──────────────────────────────────────────────────────────────
  // Only run if a station is selected
  type StockRow = {
    id: string
    product_id: string
    opening_count: number
    deliveries_received: number
    pos_units_sold: number
    expected_closing_count: number
    actual_closing_count: number
    variance_units: number
    variance_zar: number
    reconciliations: {
      shift_id: string
      shifts: {
        shift_date: string
        period: string
        station_id: string
      }
    }
    products: { name: string }
  }

  let rows: StockRow[] = []
  if (stationId) {
    const { data } = await supabase
      .from('reconciliation_stock_lines')
      .select(`
        id,
        product_id,
        opening_count,
        deliveries_received,
        pos_units_sold,
        expected_closing_count,
        actual_closing_count,
        variance_units,
        variance_zar,
        reconciliations!inner (
          shift_id,
          shifts!inner (
            shift_date,
            period,
            station_id
          )
        ),
        products ( name )
      `)
      .filter('reconciliations.shifts.station_id', 'eq', stationId)
      .gte('reconciliations.shifts.shift_date', selectedFrom)
      .lte('reconciliations.shifts.shift_date', selectedTo)
      .order('reconciliations(shifts(shift_date))', { ascending: false })

    rows = (data ?? []) as unknown as StockRow[]
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dry Stock Variance</h1>
        <p className="text-sm text-gray-500">Physical variance per product per shift</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Station</label>
          <select
            name="station"
            defaultValue={stationId ?? ''}
            className="rounded border px-3 py-1.5 text-sm bg-white"
          >
            <option value="">— select —</option>
            {(stations ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={selectedFrom}
            className="rounded border px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={selectedTo}
            className="rounded border px-3 py-1.5 text-sm" />
        </div>
        <button type="submit"
          className="rounded bg-black px-4 py-1.5 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      {/* Table */}
      {!stationId ? (
        <p className="text-sm text-gray-400">Select a station to view the report.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No dry stock data for this station and date range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Shift</th>
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4 text-right">Opening</th>
                <th className="pb-2 pr-4 text-right">Deliveries</th>
                <th className="pb-2 pr-4 text-right">Sold</th>
                <th className="pb-2 pr-4 text-right">Expected</th>
                <th className="pb-2 pr-4 text-right">Actual</th>
                <th className="pb-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(row => {
                const shift = (row.reconciliations as any).shifts
                return (
                  <tr key={row.id} className="py-2">
                    <td className="py-2 pr-4 text-gray-600">{shift.shift_date}</td>
                    <td className="py-2 pr-4 capitalize text-gray-600">{shift.period}</td>
                    <td className="py-2 pr-4 font-medium">{(row.products as any)?.name ?? row.product_id}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{fmt(row.opening_count)}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{fmt(row.deliveries_received)}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{fmt(row.pos_units_sold)}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{fmt(row.expected_closing_count)}</td>
                    <td className="py-2 pr-4 text-right text-gray-600">{fmt(row.actual_closing_count)}</td>
                    <td className={`py-2 text-right font-semibold ${
                      row.variance_units < 0 ? 'text-red-600' :
                      row.variance_units > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {row.variance_units > 0 ? '+' : ''}{fmt(row.variance_units)}
                      {' '}
                      <span className="font-normal text-xs text-gray-500">
                        ({row.variance_zar > 0 ? '+' : ''}{fmtR(row.variance_zar)})
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link href="/dashboard/reports" className="text-sm text-blue-600 underline">
        Back to reports
      </Link>
    </main>
  )
}
