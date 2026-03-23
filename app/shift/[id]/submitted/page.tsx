import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ShiftSubmittedPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  // Confirm shift is submitted
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()
  if (shift.status !== 'submitted') redirect(`/shift/${shiftId}/close/summary`)

  // Load reconciliation
  const { data: rec } = await supabase
    .from('reconciliations')
    .select('id, expected_revenue, pos_revenue, revenue_variance')
    .eq('shift_id', shiftId)
    .maybeSingle()

  const { data: tankLines } = rec
    ? await supabase
        .from('reconciliation_tank_lines')
        .select('tank_id, opening_dip, deliveries_received, pos_litres_sold, expected_closing_dip, actual_closing_dip, variance_litres')
        .eq('reconciliation_id', rec.id)
    : { data: [] }

  const { data: gradeLines } = rec
    ? await supabase
        .from('reconciliation_grade_lines')
        .select('fuel_grade_id, meter_delta, pos_litres_sold, variance_litres')
        .eq('reconciliation_id', rec.id)
    : { data: [] }

  // Load tank labels for display
  const { data: tanks } = await supabase
    .from('tanks')
    .select('id, label, fuel_grade_id')
    .eq('station_id', shift.station_id)

  const tankLabel = (tankId: string) =>
    tanks?.find(t => t.id === tankId)?.label ?? tankId

  const fmt = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtL = (n: number) => `${fmt(n)} L`
  const fmtR = (n: number) => `R ${fmt(n)}`

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-1">
        <div className="text-2xl font-bold">Shift Submitted</div>
        <div className="text-sm text-muted-foreground capitalize">
          {shift.period} shift · {shift.shift_date}
        </div>
      </div>

      {!rec && (
        <p className="text-sm text-muted-foreground text-center">
          Reconciliation is being processed.
        </p>
      )}

      {rec && (
        <>
          {/* Tank inventory */}
          <section className="space-y-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Tank Inventory
            </h2>
            <div className="border rounded-md divide-y text-sm">
              {(tankLines ?? []).map(line => (
                <div key={line.tank_id} className="px-4 py-3 space-y-1">
                  <div className="font-medium">{tankLabel(line.tank_id)}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                    <span>Opening dip</span><span className="text-right">{fmtL(line.opening_dip)}</span>
                    <span>Deliveries</span><span className="text-right">+{fmtL(line.deliveries_received)}</span>
                    <span>POS sold</span><span className="text-right">−{fmtL(line.pos_litres_sold)}</span>
                    <span>Expected closing</span><span className="text-right">{fmtL(line.expected_closing_dip)}</span>
                    <span>Actual closing</span><span className="text-right">{fmtL(line.actual_closing_dip)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold pt-1 border-t ${
                    line.variance_litres > 0 ? 'text-destructive' :
                    line.variance_litres < 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    <span>Variance</span>
                    <span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pump meter vs POS */}
          <section className="space-y-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Pump Meter vs POS
            </h2>
            <div className="border rounded-md divide-y text-sm">
              {(gradeLines ?? []).map(line => (
                <div key={line.fuel_grade_id} className="px-4 py-3 space-y-1">
                  <div className="font-medium">{line.fuel_grade_id}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                    <span>Meter delta</span><span className="text-right">{fmtL(line.meter_delta)}</span>
                    <span>POS sold</span><span className="text-right">{fmtL(line.pos_litres_sold)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold pt-1 border-t ${
                    line.variance_litres !== 0 ? 'text-destructive' : 'text-green-600'
                  }`}>
                    <span>Variance</span>
                    <span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Financial */}
          <section className="space-y-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Revenue
            </h2>
            <div className="border rounded-md text-sm divide-y">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-muted-foreground">Expected revenue</span>
                <span>{fmtR(rec.expected_revenue)}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-muted-foreground">POS reported</span>
                <span>{fmtR(rec.pos_revenue)}</span>
              </div>
              <div className={`px-4 py-3 flex justify-between font-semibold ${
                rec.revenue_variance > 0 ? 'text-destructive' :
                rec.revenue_variance < 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                <span>Variance</span>
                <span>{rec.revenue_variance > 0 ? '+' : ''}{fmtR(rec.revenue_variance)}</span>
              </div>
            </div>
          </section>
        </>
      )}

      <Link
        href="/shift"
        className="block w-full text-center bg-primary text-primary-foreground rounded-md py-3 font-medium"
      >
        Done
      </Link>
    </main>
  )
}
