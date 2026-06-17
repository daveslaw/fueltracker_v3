'use server'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { buildShiftCloseSteps } from '@/lib/workflow-steps'
import { StepIndicator } from '@/components/StepIndicator'
import { canFlag, canOverride } from '@/lib/supervisor-review'
import { submitShift, flagShift, unflagShift, createOverride } from '../../../actions'
import { getShiftDeliveries } from '@/lib/deliveries'
import { AddDeliveryForm } from '../deliveries/AddDeliveryForm'
import { HandoffPrompt } from '@/components/HandoffPrompt'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

const fmt  = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtL = (n: number) => `${fmt(n)} L`
const fmtR = (n: number) => `R ${fmt(n)}`

export default async function CloseSummaryPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('id, station_id, period, shift_date, status, is_flagged, flag_comment, cashier_submitted_at')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()
  if (!['pending', 'closed'].includes(shift.status)) redirect('/shift')

  // ── Batch A: everything keyed on shiftId or station_id ───────────────────
  const [
    { data: station },
    { data: pumps }, { data: closePumpReadings },
    { data: tanks }, { data: closeDipReadings },
    shiftDeliveries,
    { data: rec },
  ] = await Promise.all([
    supabase.from('stations').select('name').eq('id', shift.station_id).single(),
    supabase.from('pumps').select('id, label').eq('station_id', shift.station_id).order('label'),
    supabase.from('pump_readings')
      .select('id, pump_id, meter_reading, maintenance_required, pumps(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('dip_readings')
      .select('id, tank_id, litres, tanks(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    getShiftDeliveries(supabase, {
      stationId: shift.station_id,
      shiftDate: shift.shift_date,
      period: shift.period as 'morning' | 'evening',
    }),
    supabase.from('reconciliations')
      .select('id')
      .eq('shift_id', shiftId)
      .maybeSingle(),
  ])

  // Dry stock complete = all active products for this station have a closing count
  const [{ data: activeProducts }, { data: stockReadings }] = await Promise.all([
    supabase.from('products').select('id').eq('station_id', shift.station_id).eq('is_active', true),
    supabase.from('stock_readings').select('product_id').eq('shift_id', shiftId),
  ])
  const productIds = (activeProducts ?? []).map(p => p.id)
  const readIds    = new Set((stockReadings ?? []).map(r => r.product_id))
  const hasDryStock = productIds.every(id => readIds.has(id))

  const progress = getCloseProgress(
    (pumps ?? []).map(p => p.id),
    (closePumpReadings ?? []).map(r => r.pump_id),
    (tanks ?? []).map(t => t.id),
    (closeDipReadings ?? []).map(r => r.tank_id),
    !!shift.cashier_submitted_at,
    hasDryStock,
  )
  const steps = buildShiftCloseSteps(shiftId, 'summary', progress)

  // ── Pending view: progress checklist + submit ─────────────────────────────
  if (shift.status === 'pending') {
    async function handleSubmit() {
      'use server'
      await submitShift(shiftId)
    }

    return (
      <main className="p-6 max-w-lg mx-auto space-y-6">
        <StepIndicator steps={steps} currentIndex={3} />
        <div>
          <h1 className="text-xl font-semibold">Review &amp; submit</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">
            {station?.name} · {shift.period} · {shift.shift_date}
          </p>
        </div>

        {/* Progress steps */}
        <section className="space-y-2 text-sm">
          <ProgressRow
            label="Pump readings"
            done={progress.pumps.done}
            total={progress.pumps.total}
            href={`/shift/${shiftId}/close/pumps`}
          />
          <ProgressRow
            label="Dip readings"
            done={progress.tanks.done}
            total={progress.tanks.total}
            href={`/shift/${shiftId}/close/dips`}
          />
          {/* Cashier status — read-only, not a supervisor step */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`text-lg ${shift.cashier_submitted_at ? 'text-green-600' : 'text-gray-300'}`}>
                {shift.cashier_submitted_at ? '✓' : '○'}
              </span>
              <span className={shift.cashier_submitted_at ? 'text-gray-800' : 'text-gray-500'}>
                Cashier
              </span>
            </div>
            <span className="text-xs font-medium">
              {shift.cashier_submitted_at
                ? <span className="text-green-700">Submitted</span>
                : <span className="text-gray-400">Pending</span>}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg text-gray-300">○</span>
              <span className="text-gray-500">Deliveries</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {shiftDeliveries.length} recorded
              </span>
              <Link href={`/shift/${shiftId}/close/deliveries`} className="text-xs text-blue-600 underline">
                Manage
              </Link>
            </div>
          </div>
        </section>

        {progress.isComplete ? (
          <form action={handleSubmit}>
            <button
              type="submit"
              className="w-full rounded bg-black py-3 text-sm font-medium text-white"
            >
              Submit &amp; close shift
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-400 text-center">
            Complete all steps above to submit.
          </p>
        )}
      </main>
    )
  }

  // ── Closed view: reconciliation results + flag + overrides + audit trail ──

  // ── Batch B: reconciliation lines + POS corrections + audit trail ──────────
  const { data: posSubmission } = await supabase
    .from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle()

  const [{ data: tankLines }, { data: pumpLines }, { data: posLines }, { data: overrides }] =
    await Promise.all([
      rec
        ? supabase.from('reconciliation_tank_lines')
            .select('tank_id, opening_dip, deliveries_received, meter_delta, expected_closing_dip, actual_closing_dip, variance_litres')
            .eq('reconciliation_id', rec.id)
        : Promise.resolve({ data: [] as any[] }),
      rec
        ? supabase.from('reconciliation_pump_lines')
            .select('pump_id, fuel_grade_id, meter_delta_litres, pos_litres_sold, variance_litres, sell_price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar')
            .eq('reconciliation_id', rec.id)
        : Promise.resolve({ data: [] as any[] }),
      posSubmission
        ? supabase.from('pos_submission_lines')
            .select('id, pump_id, litres_sold, revenue_zar')
            .eq('pos_submission_id', posSubmission.id)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('ocr_overrides')
        .select('id, reading_type, field_name, original_value, override_value, reason, created_at, user_profiles(full_name)')
        .eq('shift_id', shiftId)
        .order('created_at', { ascending: false }),
    ])

  const tankLabel = (tankId: string) =>
    tanks?.find(t => t.id === tankId)?.label ?? tankId

  async function handleFlag(formData: FormData) {
    'use server'
    await flagShift(shiftId, formData.get('comment') as string)
  }
  async function handleUnflag() {
    'use server'
    await unflagShift(shiftId)
  }
  async function handleOverride(formData: FormData) {
    'use server'
    await createOverride(shiftId, formData)
  }

  const isFlaggable = canFlag(shift.status as any)
  const isOverridable = canOverride(shift.status as any)

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <StepIndicator steps={steps} currentIndex={3} />
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Shift Closed</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              shift.cashier_submitted_at
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              Cashier: {shift.cashier_submitted_at ? 'Submitted' : 'Pending'}
            </span>
            {shift.is_flagged && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Flagged</span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 capitalize mt-0.5">
          {station?.name} · {shift.period} · {shift.shift_date}
        </p>
      </div>

      {/* Reconciliation */}
      {!rec && (
        <p className="text-sm text-gray-400">Reconciliation is being processed.</p>
      )}

      {rec && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Tank Inventory</h2>
            <div className="border rounded-md divide-y text-sm">
              {(tankLines ?? []).map(line => (
                <div key={line.tank_id} className="px-4 py-3 space-y-1">
                  <div className="font-medium">{tankLabel(line.tank_id)}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-gray-500 text-xs">
                    <span>Opening dip</span><span className="text-right">{fmtL(line.opening_dip)}</span>
                    <span>Deliveries</span><span className="text-right">+{fmtL(line.deliveries_received)}</span>
                    <span>Meter delta</span><span className="text-right">−{fmtL(line.meter_delta)}</span>
                    <span>Expected closing</span><span className="text-right">{fmtL(line.expected_closing_dip)}</span>
                    <span>Actual closing</span><span className="text-right">{fmtL(line.actual_closing_dip)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold text-sm pt-1 border-t ${
                    line.variance_litres < 0 ? 'text-red-600' :
                    line.variance_litres > 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    <span>Variance</span>
                    <span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Pump Meter vs POS — Revenue</h2>
            <PumpVarianceTable pumpLines={pumpLines ?? []} pumps={pumps ?? []} />
          </section>
        </>
      )}

      {/* Deliveries */}
      <section className="space-y-3">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Deliveries</h2>
        {shiftDeliveries.length > 0 ? (
          <div className="border rounded-md divide-y text-sm">
            {shiftDeliveries.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{tankLabel(d.tank_id)}</div>
                  <div className="text-xs text-gray-500">{fmtL(d.litres_received)}</div>
                </div>
                {d.delivery_note_url && (
                  <a href={d.delivery_note_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline">Receipt</a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No deliveries recorded.</p>
        )}

        <AddDeliveryForm shiftId={shiftId} tanks={tanks ?? []} />
      </section>

      {/* Pumps Requiring Maintenance */}
      {(() => {
        const maintenancePumps = (closePumpReadings ?? []).filter(r => r.maintenance_required)
        if (maintenancePumps.length === 0) return null
        return (
          <section className="space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Pumps Requiring Maintenance</h2>
            <div className="border border-amber-200 rounded-md divide-y divide-amber-100 text-sm bg-amber-50">
              {maintenancePumps.map(r => (
                <div key={r.pump_id} className="px-4 py-3 flex items-center gap-2 text-amber-800">
                  <span className="font-medium">{(r.pumps as unknown as { label: string })?.label ?? r.pump_id}</span>
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Flag / unflag */}
      {isFlaggable && (
        <section className="border rounded-md p-4 space-y-3">
          <h2 className="font-semibold text-sm">Flag this shift</h2>
          {shift.is_flagged ? (
            <>
              <p className="text-sm text-gray-600">{shift.flag_comment}</p>
              <form action={handleUnflag}>
                <button type="submit"
                  className="rounded border px-3 py-1.5 text-sm font-medium text-red-700 border-red-200 hover:bg-red-50">
                  Remove flag
                </button>
              </form>
            </>
          ) : (
            <form action={handleFlag} className="space-y-2">
              <textarea
                name="comment"
                rows={2}
                placeholder="Describe the discrepancy…"
                required
                className="w-full rounded border px-3 py-2 text-sm resize-none"
              />
              <button type="submit"
                className="rounded border px-3 py-1.5 text-sm font-medium text-red-700 border-red-200 hover:bg-red-50">
                Flag shift
              </button>
            </form>
          )}
        </section>
      )}

      {/* Corrections */}
      {isOverridable && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Correct a reading</h2>

          {(closePumpReadings ?? []).map(r => (
            <details key={r.pump_id} className="border rounded-md">
              <summary className="px-4 py-3 text-sm cursor-pointer flex justify-between items-center">
                <span>Pump: {(r.pumps as unknown as { label: string })?.label}</span>
                <span className="text-gray-500">{r.meter_reading} L</span>
              </summary>
              <form action={handleOverride} className="px-4 pb-4 pt-2 space-y-2 border-t">
                <input type="hidden" name="reading_id"     value={r.id} />
                <input type="hidden" name="reading_type"   value="pump" />
                <input type="hidden" name="original_value" value={r.meter_reading} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Corrected reading (L)</label>
                  <input type="number" name="override_value" step="0.01" min="0" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input type="text" name="reason" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <button type="submit"
                  className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">
                  Save correction
                </button>
              </form>
            </details>
          ))}

          {(closeDipReadings ?? []).map(r => (
            <details key={r.tank_id} className="border rounded-md">
              <summary className="px-4 py-3 text-sm cursor-pointer flex justify-between items-center">
                <span>Dip: {(r.tanks as unknown as { label: string })?.label}</span>
                <span className="text-gray-500">{fmtL(r.litres)}</span>
              </summary>
              <form action={handleOverride} className="px-4 pb-4 pt-2 space-y-2 border-t">
                <input type="hidden" name="reading_id"     value={r.id} />
                <input type="hidden" name="reading_type"   value="dip" />
                <input type="hidden" name="original_value" value={r.litres} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Corrected dip (L)</label>
                  <input type="number" name="override_value" step="0.01" min="0" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input type="text" name="reason" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <button type="submit"
                  className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">
                  Save correction
                </button>
              </form>
            </details>
          ))}

          {(posLines ?? []).map(l => (
            <details key={l.id} className="border rounded-md">
              <summary className="px-4 py-3 text-sm cursor-pointer flex justify-between items-center">
                <span>POS: {(pumps ?? []).find(p => p.id === l.pump_id)?.label ?? l.pump_id}</span>
                <span className="text-gray-500">{fmtL(l.litres_sold)} · {fmtR(l.revenue_zar)}</span>
              </summary>
              <form action={handleOverride} className="px-4 pb-4 pt-2 space-y-2 border-t">
                <input type="hidden" name="reading_id"        value={l.id} />
                <input type="hidden" name="reading_type"      value="pos_line" />
                <input type="hidden" name="original_litres"   value={l.litres_sold} />
                <input type="hidden" name="original_revenue"  value={l.revenue_zar} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Field to correct</label>
                  <select name="field_name" required
                    className="w-full rounded border px-3 py-1.5 text-sm bg-white">
                    <option value="">— select —</option>
                    <option value="litres_sold">Litres sold (current: {fmtL(l.litres_sold)})</option>
                    <option value="revenue_zar">Revenue (current: {fmtR(l.revenue_zar)})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Corrected value</label>
                  <input type="number" name="override_value" step="0.01" min="0" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason</label>
                  <input type="text" name="reason" required
                    className="w-full rounded border px-3 py-1.5 text-sm" />
                </div>
                <button type="submit"
                  className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">
                  Save correction
                </button>
              </form>
            </details>
          ))}
        </section>
      )}

      {/* Audit trail */}
      {(overrides ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Correction history</h2>
          <div className="border rounded-md divide-y text-sm">
            {(overrides ?? []).map(o => (
              <div key={o.id} className="px-4 py-3 space-y-0.5">
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="capitalize">
                    {o.reading_type} reading{(o as any).field_name ? ` — ${(o as any).field_name}` : ''}
                  </span>
                  <span>{(() => { const d = new Date(o.created_at); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })()}</span>
                </div>
                <div className="text-gray-700">
                  {o.original_value} → <span className="font-medium">{o.override_value}</span>
                </div>
                <div className="text-xs text-gray-500">{o.reason}</div>
                {(o.user_profiles as any)?.full_name && (
                  <div className="text-xs text-gray-400">By {(o.user_profiles as any).full_name}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Link href="/shift"
        className="block w-full text-center rounded border py-2.5 text-sm font-medium">
        Back to shifts
      </Link>

      <HandoffPrompt
        message="Shift complete. Sign out when done."
        ctaLabel="Sign out"
      />
    </main>
  )
}

// ── PumpVarianceTable ─────────────────────────────────────────────────────────

interface PumpLineRow {
  pump_id:              string
  fuel_grade_id:        string
  meter_delta_litres:   number
  pos_litres_sold:      number
  variance_litres:      number
  sell_price_per_litre: number
  expected_revenue_zar: number
  pos_revenue_zar:      number
  variance_zar:         number
}

function PumpVarianceTable({
  pumpLines,
  pumps,
}: {
  pumpLines: PumpLineRow[]
  pumps:     { id: string; label: string }[]
}) {
  const pumpLabel = (id: string) => pumps.find(p => p.id === id)?.label ?? id

  const sortedLines = [...pumpLines].sort((a, b) => {
    if (a.fuel_grade_id !== b.fuel_grade_id) return a.fuel_grade_id.localeCompare(b.fuel_grade_id)
    return pumpLabel(a.pump_id).localeCompare(pumpLabel(b.pump_id), undefined, { numeric: true, sensitivity: 'base' })
  })

  const grades = [...new Set(sortedLines.map(l => l.fuel_grade_id))]

  return (
    <div className="border rounded-md divide-y text-sm overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="px-3 py-2 text-left">Pump</th>
            <th className="px-3 py-2 text-left">Grade</th>
            <th className="px-3 py-2 text-right">Meter Δ (L)</th>
            <th className="px-3 py-2 text-right">POS (L)</th>
            <th className="px-3 py-2 text-right">Var (L)</th>
            <th className="px-3 py-2 text-right">POS Rev</th>
            <th className="px-3 py-2 text-right">Exp Rev</th>
            <th className="px-3 py-2 text-right">Var (ZAR)</th>
          </tr>
        </thead>
        <tbody>
          {grades.map(grade => {
            const gradeLines = sortedLines.filter(l => l.fuel_grade_id === grade)
            const subtotal = {
              meter_delta:   gradeLines.reduce((s, l) => s + l.meter_delta_litres,   0),
              pos_litres:    gradeLines.reduce((s, l) => s + l.pos_litres_sold,      0),
              var_litres:    gradeLines.reduce((s, l) => s + l.variance_litres,      0),
              pos_rev:       gradeLines.reduce((s, l) => s + l.pos_revenue_zar,      0),
              exp_rev:       gradeLines.reduce((s, l) => s + l.expected_revenue_zar, 0),
              var_zar:       gradeLines.reduce((s, l) => s + l.variance_zar,         0),
            }
            return (
              <>
                {gradeLines.map(l => (
                  <tr key={l.pump_id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{pumpLabel(l.pump_id)}</td>
                    <td className="px-3 py-2 text-gray-500">{l.fuel_grade_id}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.meter_delta_litres)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.pos_litres_sold)}</td>
                    <td className={`px-3 py-2 text-right ${l.variance_litres < 0 ? 'text-red-600' : l.variance_litres > 0 ? 'text-amber-600' : ''}`}>
                      {l.variance_litres > 0 ? '+' : ''}{fmt(l.variance_litres)}
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(l.pos_revenue_zar)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.expected_revenue_zar)}</td>
                    <td className={`px-3 py-2 text-right ${l.variance_zar < 0 ? 'text-red-600' : l.variance_zar > 0 ? 'text-amber-600' : ''}`}>
                      {l.variance_zar > 0 ? '+' : ''}{fmt(l.variance_zar)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-3 py-2 text-gray-600">{grade} total</td>
                  <td />
                  <td className="px-3 py-2 text-right">{fmt(subtotal.meter_delta)}</td>
                  <td className="px-3 py-2 text-right">{fmt(subtotal.pos_litres)}</td>
                  <td className={`px-3 py-2 text-right ${subtotal.var_litres < 0 ? 'text-red-600' : subtotal.var_litres > 0 ? 'text-amber-600' : ''}`}>
                    {subtotal.var_litres > 0 ? '+' : ''}{fmt(subtotal.var_litres)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(subtotal.pos_rev)}</td>
                  <td className="px-3 py-2 text-right">{fmt(subtotal.exp_rev)}</td>
                  <td className={`px-3 py-2 text-right ${subtotal.var_zar < 0 ? 'text-red-600' : subtotal.var_zar > 0 ? 'text-amber-600' : ''}`}>
                    {subtotal.var_zar > 0 ? '+' : ''}{fmt(subtotal.var_zar)}
                  </td>
                </tr>
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── ProgressRow ───────────────────────────────────────────────────────────────

function ProgressRow({
  label, done, total, href,
}: {
  label: string; done: number; total: number; href: string
}) {
  const complete = done === total
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`text-lg ${complete ? 'text-green-600' : 'text-gray-300'}`}>
          {complete ? '✓' : '○'}
        </span>
        <span className={complete ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{done}/{total}</span>
        {!complete && (
          <Link href={href} className="text-xs text-blue-600 underline">Go</Link>
        )}
      </div>
    </div>
  )
}
