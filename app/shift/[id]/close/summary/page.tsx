'use server'

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCloseProgress } from '@/lib/shift-close'
import { canFlag, canOverride } from '@/lib/supervisor-review'
import { submitShift, flagShift, unflagShift, createOverride } from '../../../actions'
import { getShiftDeliveries } from '@/lib/deliveries'
import { AddDeliveryForm } from '../deliveries/AddDeliveryForm'
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
    .select('id, station_id, period, shift_date, status, is_flagged, flag_comment')
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()
  if (!['pending', 'closed'].includes(shift.status)) redirect('/shift')

  // ── Batch A: everything keyed on shiftId or station_id ───────────────────
  const [
    { data: station },
    { data: pumps }, { data: closePumpReadings },
    { data: tanks }, { data: closeDipReadings },
    { data: posSubmission },
    shiftDeliveries,
    { data: rec },
  ] = await Promise.all([
    supabase.from('stations').select('name').eq('id', shift.station_id).single(),
    supabase.from('pumps').select('id, label').eq('station_id', shift.station_id).order('label'),
    supabase.from('pump_readings')
      .select('id, pump_id, meter_reading, pumps(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('dip_readings')
      .select('id, tank_id, litres, tanks(label)')
      .eq('shift_id', shiftId).eq('type', 'close'),
    supabase.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
    getShiftDeliveries(supabase, {
      stationId: shift.station_id,
      shiftDate: shift.shift_date,
      period: shift.period as 'morning' | 'evening',
    }),
    supabase.from('reconciliations')
      .select('id, expected_revenue, pos_revenue, revenue_variance')
      .eq('shift_id', shiftId)
      .maybeSingle(),
  ])

  const progress = getCloseProgress(
    (pumps ?? []).map(p => p.id),
    (closePumpReadings ?? []).map(r => r.pump_id),
    (tanks ?? []).map(t => t.id),
    (closeDipReadings ?? []).map(r => r.tank_id),
    !!posSubmission
  )

  // ── Pending view: progress checklist + submit ─────────────────────────────
  if (shift.status === 'pending') {
    async function handleSubmit() {
      'use server'
      await submitShift(shiftId)
    }

    return (
      <main className="p-6 max-w-lg mx-auto space-y-6">
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
          <ProgressRow
            label="POS Z-report"
            done={progress.pos ? 1 : 0}
            total={1}
            href={`/shift/${shiftId}/close/pos`}
          />
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

  // ── Batch B: keyed on rec.id / posSubmission.id (both known after Batch A) ─
  const [{ data: tankLines }, { data: gradeLines }, { data: posLines }, { data: overrides }] =
    await Promise.all([
      rec
        ? supabase.from('reconciliation_tank_lines')
            .select('tank_id, opening_dip, deliveries_received, pos_litres_sold, expected_closing_dip, actual_closing_dip, variance_litres')
            .eq('reconciliation_id', rec.id)
        : Promise.resolve({ data: [] as any[] }),
      rec
        ? supabase.from('reconciliation_grade_lines')
            .select('fuel_grade_id, meter_delta, pos_litres_sold, variance_litres')
            .eq('reconciliation_id', rec.id)
        : Promise.resolve({ data: [] as any[] }),
      posSubmission
        ? supabase.from('pos_submission_lines')
            .select('id, fuel_grade_id, litres_sold, revenue_zar')
            .eq('pos_submission_id', posSubmission.id)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('ocr_overrides')
        .select('id, reading_type, original_value, override_value, reason, created_at, user_profiles(full_name)')
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
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Shift Closed</h1>
          {shift.is_flagged && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Flagged</span>
          )}
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
                    <span>POS sold</span><span className="text-right">−{fmtL(line.pos_litres_sold)}</span>
                    <span>Expected closing</span><span className="text-right">{fmtL(line.expected_closing_dip)}</span>
                    <span>Actual closing</span><span className="text-right">{fmtL(line.actual_closing_dip)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold text-sm pt-1 border-t ${
                    line.variance_litres > 0 ? 'text-red-600' :
                    line.variance_litres < 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    <span>Variance</span>
                    <span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Pump Meter vs POS</h2>
            <div className="border rounded-md divide-y text-sm">
              {(gradeLines ?? []).map(line => (
                <div key={line.fuel_grade_id} className="px-4 py-3 space-y-1">
                  <div className="font-medium">{line.fuel_grade_id}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-gray-500 text-xs">
                    <span>Meter delta</span><span className="text-right">{fmtL(line.meter_delta)}</span>
                    <span>POS sold</span><span className="text-right">{fmtL(line.pos_litres_sold)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold text-sm pt-1 border-t ${
                    line.variance_litres !== 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    <span>Variance</span>
                    <span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Revenue</h2>
            <div className="border rounded-md divide-y text-sm">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-gray-500">Expected</span><span>{fmtR(rec.expected_revenue)}</span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-gray-500">POS reported</span><span>{fmtR(rec.pos_revenue)}</span>
              </div>
              <div className={`px-4 py-3 flex justify-between font-semibold ${
                rec.revenue_variance > 0 ? 'text-red-600' :
                rec.revenue_variance < 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                <span>Variance</span>
                <span>{rec.revenue_variance > 0 ? '+' : ''}{fmtR(rec.revenue_variance)}</span>
              </div>
            </div>
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

          {(posLines ?? []).map(l => (
            <details key={l.id} className="border rounded-md">
              <summary className="px-4 py-3 text-sm cursor-pointer flex justify-between items-center">
                <span>POS: {l.fuel_grade_id}</span>
                <span className="text-gray-500">{l.litres_sold} L</span>
              </summary>
              <form action={handleOverride} className="px-4 pb-4 pt-2 space-y-2 border-t">
                <input type="hidden" name="reading_id"     value={l.id} />
                <input type="hidden" name="reading_type"   value="pos_line" />
                <input type="hidden" name="original_value" value={l.litres_sold} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Corrected litres sold</label>
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
                  <span className="capitalize">{o.reading_type} reading</span>
                  <span>{new Date(o.created_at).toLocaleString('en-ZA')}</span>
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
    </main>
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
