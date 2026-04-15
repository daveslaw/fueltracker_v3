import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildFinancialLines, isReportPartial } from '@/lib/owner-reports'
import { selectActivePriceAt } from '@/lib/pricing'

interface Props {
  searchParams: Promise<{ station?: string; date?: string }>
}

function VarianceCell({ v, unit }: { v: number; unit: 'L' | 'R' }) {
  const cls =
    v > 0 ? 'text-destructive' :
    v < 0 ? 'text-amber-600' :
    'text-green-600'
  const sign = v > 0 ? '+' : ''
  const fmt = (n: number) => Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className={`font-semibold ${cls}`}>{sign}{unit === 'R' ? 'R ' : ''}{fmt(v)}{unit === 'L' ? ' L' : ''}</span>
}

function fmtL(n: number) { return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L' }
function fmtR(n: number) { return 'R ' + Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default async function DailyReportPage({ searchParams }: Props) {
  const { station: stationId, date } = await searchParams

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = date ?? today

  const { data: stations } = await supabase.from('stations').select('id, name').order('name')

  // Default to first station if none selected
  const activeStationId = stationId ?? stations?.[0]?.id
  if (!activeStationId) {
    return <main className="max-w-3xl mx-auto p-4"><p className="text-muted-foreground text-sm">No stations configured.</p></main>
  }
  const activeStation = (stations ?? []).find(s => s.id === activeStationId)

  // Load shifts for this station + date
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, period, status, submitted_at')
    .eq('station_id', activeStationId)
    .eq('shift_date', selectedDate)

  const shiftIds = (shifts ?? []).map(s => s.id)

  // Load all related data in parallel
  const [
    { data: tanks },
    recsResult,
    posSubsResult,
    { data: allPrices },
  ] = await Promise.all([
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', activeStationId).order('label'),
    shiftIds.length > 0
      ? supabase.from('reconciliations')
          .select('shift_id, expected_revenue, pos_revenue, revenue_variance, reconciliation_tank_lines(*), reconciliation_grade_lines(*)')
          .in('shift_id', shiftIds)
      : Promise.resolve({ data: [] as any[] }),
    shiftIds.length > 0
      ? supabase.from('pos_submissions').select('id, shift_id').in('shift_id', shiftIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('fuel_prices').select('fuel_grade_id, price_per_litre, effective_from').order('effective_from'),
  ])

  const recs = recsResult.data ?? []
  const posSubs = posSubsResult.data ?? []

  const posSubIds = posSubs.map((ps: any) => ps.id)
  const { data: allPosLines } = posSubIds.length > 0
    ? await supabase.from('pos_submission_lines')
        .select('pos_submission_id, fuel_grade_id, litres_sold, revenue_zar')
        .in('pos_submission_id', posSubIds)
    : { data: [] as any[] }

  const tankLabel = (id: string) => (tanks ?? []).find(t => t.id === id)?.label ?? id

  const periods = ['morning', 'evening'] as const
  const sections = periods.map(period => {
    const s = (shifts ?? []).find(sh => sh.period === period)
    const status = (s?.status ?? 'not_started') as string
    const partial = isReportPartial(status as any)

    if (!s || !recs) return { period, status, partial, rec: null, financial: null }

    const rec = recs.find((r: any) => r.shift_id === s.id) ?? null
    if (!rec) return { period, status, partial, rec: null, financial: null }

    const posSub = posSubs.find((ps: any) => ps.shift_id === s.id)
    const posLines = posSub
      ? (allPosLines ?? []).filter((pl: any) => pl.pos_submission_id === posSub.id)
      : []

    const gradeIds = [...new Set(posLines.map((l: any) => l.fuel_grade_id as string))]
    const prices = gradeIds.map(gid => ({
      fuel_grade_id: gid,
      price_per_litre: selectActivePriceAt(
        (allPrices ?? []).filter(p => p.fuel_grade_id === gid),
        s.submitted_at ?? selectedDate,
      ) ?? 0,
    }))

    const financial = buildFinancialLines(posLines, prices)
    return { period, status, partial, rec, financial }
  })

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-semibold mt-1">Daily Report</h1>
          <p className="text-sm text-muted-foreground">{activeStation?.name}</p>
        </div>
      </div>

      {/* Picker form */}
      <form method="GET" action="/dashboard/reports" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={activeStationId} className="border rounded px-2 py-1.5 text-sm">
            {(stations ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <input type="date" name="date" defaultValue={selectedDate} max={today} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
        <a
          href={`/dashboard/reports/export?type=daily&station=${activeStationId}&date=${selectedDate}`}
          className="rounded border px-4 py-1.5 text-sm"
        >
          Export CSV
        </a>
      </form>

      {sections.map(({ period, status, partial, rec, financial }) => (
        <section key={period} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold capitalize">{period} shift</h2>
            <span className={`text-xs px-2 py-0.5 rounded capitalize ${
              status === 'approved'    ? 'bg-green-100 text-green-800' :
              status === 'flagged'     ? 'bg-red-100 text-red-800' :
              status === 'submitted'   ? 'bg-blue-100 text-blue-800' :
              status === 'not_started' ? 'bg-gray-100 text-gray-500' :
                                         'bg-yellow-100 text-yellow-800'
            }`}>{status.replace(/_/g, ' ')}</span>
          </div>

          {partial && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Partial data — shift not yet submitted.
            </div>
          )}

          {!rec && !partial && (
            <p className="text-sm text-muted-foreground">No reconciliation data.</p>
          )}

          {rec && (
            <>
              {/* Formula 1: Tank inventory */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Formula 1 — Tank Inventory</h3>
                <div className="border rounded-md divide-y text-sm">
                  {((rec as any).reconciliation_tank_lines ?? []).map((line: any) => (
                    <div key={line.id} className="px-4 py-3">
                      <div className="font-medium mb-1">{tankLabel(line.tank_id)}</div>
                      <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                        <span>Opening dip</span><span className="text-right">{fmtL(line.opening_dip)}</span>
                        <span>Deliveries</span><span className="text-right">+{fmtL(line.deliveries_received)}</span>
                        <span>POS sold</span><span className="text-right">−{fmtL(line.pos_litres_sold)}</span>
                        <span>Expected closing</span><span className="text-right">{fmtL(line.expected_closing_dip)}</span>
                        <span>Actual closing</span><span className="text-right">{fmtL(line.actual_closing_dip)}</span>
                      </div>
                      <div className="flex justify-between border-t mt-1 pt-1">
                        <span className="text-muted-foreground">Variance</span>
                        <VarianceCell v={line.variance_litres} unit="L" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formula 2: Pump meter vs POS */}
              <div className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Formula 2 — Pump Meter vs POS</h3>
                <div className="border rounded-md text-sm overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-muted-foreground text-xs">
                        <th className="text-left px-3 py-2">Grade</th>
                        <th className="text-right px-3 py-2">Meter delta</th>
                        <th className="text-right px-3 py-2">POS sold</th>
                        <th className="text-right px-3 py-2">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {((rec as any).reconciliation_grade_lines ?? []).map((line: any) => (
                        <tr key={line.id}>
                          <td className="px-3 py-2 font-medium">{line.fuel_grade_id}</td>
                          <td className="px-3 py-2 text-right">{fmtL(line.meter_delta)}</td>
                          <td className="px-3 py-2 text-right">{fmtL(line.pos_litres_sold)}</td>
                          <td className="px-3 py-2 text-right"><VarianceCell v={line.variance_litres} unit="L" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial */}
              {financial && (
                <div className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Financial</h3>
                  <div className="border rounded-md text-sm overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-muted-foreground text-xs">
                          <th className="text-left px-3 py-2">Grade</th>
                          <th className="text-right px-3 py-2">Litres sold</th>
                          <th className="text-right px-3 py-2">Price/L</th>
                          <th className="text-right px-3 py-2">Expected (ZAR)</th>
                          <th className="text-right px-3 py-2">POS (ZAR)</th>
                          <th className="text-right px-3 py-2">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {financial.lines.map(line => (
                          <tr key={line.fuel_grade_id}>
                            <td className="px-3 py-2 font-medium">{line.fuel_grade_id}</td>
                            <td className="px-3 py-2 text-right">{fmtL(line.litres_sold)}</td>
                            <td className="px-3 py-2 text-right">R {line.price_per_litre.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{fmtR(line.expected_revenue_zar)}</td>
                            <td className="px-3 py-2 text-right">{fmtR(line.pos_revenue_zar)}</td>
                            <td className="px-3 py-2 text-right"><VarianceCell v={line.variance_zar} unit="R" /></td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold bg-muted/30">
                          <td className="px-3 py-2" colSpan={3}>Total</td>
                          <td className="px-3 py-2 text-right">{fmtR(financial.totals.expected_revenue_zar)}</td>
                          <td className="px-3 py-2 text-right">{fmtR(financial.totals.pos_revenue_zar)}</td>
                          <td className="px-3 py-2 text-right"><VarianceCell v={financial.totals.variance_zar} unit="R" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      ))}
    </main>
  )
}
