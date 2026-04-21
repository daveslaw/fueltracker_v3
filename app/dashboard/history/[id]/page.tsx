import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildFinancialLines } from '@/lib/owner-reports'
import { selectActivePriceAt } from '@/lib/pricing'
import { canFlag, canOverride } from '@/lib/supervisor-review'
import { flagShift, unflagShift, createOverride } from '@/app/shift/actions'

interface Props { params: Promise<{ id: string }> }

function fmtL(n: number) { return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L' }
function fmtR(n: number) { return 'R ' + Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmt(n: number)  { return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function VarianceRow({ label, v, unit }: { label: string; v: number; unit: 'L' | 'R' }) {
  const cls = v > 0 ? 'text-destructive' : v < 0 ? 'text-amber-600' : 'text-green-600'
  const sign = v > 0 ? '+' : ''
  return (
    <div className={`flex justify-between font-semibold border-t mt-1 pt-1 ${cls}`}>
      <span>{label}</span>
      <span>{sign}{unit === 'R' ? fmtR(v) : fmtL(v)}</span>
    </div>
  )
}

export default async function ShiftAuditPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('role, is_active').eq('user_id', user.id).single()
  if (!profile?.is_active || profile.role !== 'owner') redirect('/login')

  const { data: shift } = await supabase
    .from('shifts')
    .select(`
      id, period, shift_date, status, submitted_at, is_flagged, flag_comment,
      station_id,
      stations ( name ),
      user_profiles!supervisor_id ( email )
    `)
    .eq('id', shiftId)
    .single()
  if (!shift) notFound()

  const [
    { data: pumps },
    { data: tanks },
    { data: pumpReadings },
    { data: dipReadings },
    { data: posSubmission },
    { data: rec },
    { data: overrides },
    { data: allPrices },
  ] = await Promise.all([
    supabase.from('pumps').select('id, label, tank_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('pump_readings').select('id, pump_id, type, meter_reading, photo_url, ocr_status').eq('shift_id', shiftId),
    supabase.from('dip_readings').select('id, tank_id, type, litres').eq('shift_id', shiftId),
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
    supabase.from('reconciliations')
      .select('id, expected_revenue, pos_revenue, revenue_variance, reconciliation_tank_lines(*), reconciliation_grade_lines(*)')
      .eq('shift_id', shiftId).maybeSingle(),
    supabase.from('ocr_overrides').select('id, reading_id, reading_type, original_value, override_value, reason, created_at, user_profiles!overridden_by(full_name)').eq('shift_id', shiftId),
    supabase.from('fuel_prices').select('fuel_grade_id, price_per_litre, effective_from').order('effective_from'),
  ])

  const posLines = posSubmission
    ? (await supabase.from('pos_submission_lines')
        .select('id, fuel_grade_id, litres_sold, revenue_zar, ocr_status')
        .eq('pos_submission_id', posSubmission.id)).data ?? []
    : []

  const gradeIds = [...new Set(posLines.map((l: any) => l.fuel_grade_id as string))]
  const prices = gradeIds.map(gid => ({
    fuel_grade_id: gid,
    price_per_litre: selectActivePriceAt(
      (allPrices ?? []).filter(p => p.fuel_grade_id === gid),
      shift.submitted_at ?? shift.shift_date,
    ) ?? 0,
  }))
  const financial = posLines.length > 0 ? buildFinancialLines(posLines as any, prices) : null

  const tankLabel = (id: string) => (tanks ?? []).find(t => t.id === id)?.label ?? id
  const overriddenIds = new Set((overrides ?? []).map(o => o.reading_id))

  const isFlaggable = canFlag(shift.status as any)
  const isOverridable = canOverride(shift.status as any)

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

  const ss = shift as any

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/history" className="text-xs text-muted-foreground hover:underline">← Shift history</Link>
          <h1 className="text-xl font-semibold mt-1 capitalize">{shift.period} shift · {shift.shift_date}</h1>
          <p className="text-sm text-muted-foreground">
            {ss.stations?.name} · {ss.user_profiles?.email ?? '—'}
          </p>
          {shift.submitted_at && (
            <p className="text-xs text-muted-foreground">
              Submitted: {(() => { const d = new Date(shift.submitted_at); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })()}
            </p>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded capitalize ${
          shift.status === 'approved' ? 'bg-green-100 text-green-800' :
          shift.status === 'flagged'  ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>{shift.status}</span>
      </div>

      {shift.flag_comment && (
        <div className="border border-red-200 bg-red-50 rounded px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Flagged: </span>{shift.flag_comment}
        </div>
      )}

      {/* Pump readings */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pump readings</h2>
        <div className="border rounded-md divide-y text-sm">
          {(pumps ?? []).map(pump => {
            const open  = (pumpReadings ?? []).find(r => r.pump_id === pump.id && r.type === 'open')
            const close = (pumpReadings ?? []).find(r => r.pump_id === pump.id && r.type === 'close')
            const isOverridden = (close && overriddenIds.has(close.id)) || (open && overriddenIds.has(open.id))
            return (
              <div key={pump.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pump.label}</span>
                  {isOverridden && <span className="text-xs text-amber-600">overridden</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                  <span>Open</span>
                  <span className="text-right flex items-center justify-end gap-2">
                    {open ? fmt(open.meter_reading) : '—'}
                    {open?.photo_url && (
                      <a href={open.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">photo</a>
                    )}
                  </span>
                  <span>Close</span>
                  <span className="text-right flex items-center justify-end gap-2">
                    {close ? fmt(close.meter_reading) : '—'}
                    {close?.photo_url && (
                      <a href={close.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">photo</a>
                    )}
                  </span>
                </div>
                {isOverridable && close && (
                  <details className="mt-2 border-t pt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Edit close reading</summary>
                    <form action={handleOverride} className="pt-2 space-y-2">
                      <input type="hidden" name="reading_id" value={close.id} />
                      <input type="hidden" name="reading_type" value="pump" />
                      <input type="hidden" name="original_value" value={close.meter_reading} />
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Corrected reading</label>
                        <input type="number" name="override_value" step="0.01" min="0" required className="w-full rounded border px-3 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                        <input type="text" name="reason" required className="w-full rounded border px-3 py-1.5 text-sm" />
                      </div>
                      <button type="submit" className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">Save correction</button>
                    </form>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Dip readings */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Dip readings</h2>
        <div className="border rounded-md divide-y text-sm">
          {(tanks ?? []).map(tank => {
            const open  = (dipReadings ?? []).find(r => r.tank_id === tank.id && r.type === 'open')
            const close = (dipReadings ?? []).find(r => r.tank_id === tank.id && r.type === 'close')
            return (
              <div key={tank.id} className="px-4 py-3">
                <div className="font-medium">{tank.label} ({tank.fuel_grade_id})</div>
                <div className="grid grid-cols-2 gap-x-4 text-muted-foreground text-sm mt-1">
                  <span>Open</span><span className="text-right">{open ? fmtL(open.litres) : '—'}</span>
                  <span>Close</span><span className="text-right">{close ? fmtL(close.litres) : '—'}</span>
                </div>
                {isOverridable && close && (
                  <details className="mt-2 border-t pt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Edit close reading</summary>
                    <form action={handleOverride} className="pt-2 space-y-2">
                      <input type="hidden" name="reading_id" value={close.id} />
                      <input type="hidden" name="reading_type" value="dip" />
                      <input type="hidden" name="original_value" value={close.litres} />
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Corrected dip (L)</label>
                        <input type="number" name="override_value" step="0.01" min="0" required className="w-full rounded border px-3 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                        <input type="text" name="reason" required className="w-full rounded border px-3 py-1.5 text-sm" />
                      </div>
                      <button type="submit" className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">Save correction</button>
                    </form>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* POS Z-report */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">POS Z-report</h2>
        {!posSubmission
          ? <p className="text-sm text-muted-foreground">No POS submission.</p>
          : (
            <div className="border rounded-md text-sm divide-y">
              {posSubmission.photo_url && (
                <div className="px-4 py-3">
                  <a href={posSubmission.photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                    View Z-report photo
                  </a>
                </div>
              )}
              {posLines.map((line: any) => (
                <div key={line.id} className="px-4 py-3">
                  <div className="flex justify-between">
                    <span className={`font-medium ${overriddenIds.has(line.id) ? 'text-amber-600' : ''}`}>
                      {line.fuel_grade_id}{overriddenIds.has(line.id) ? ' (overridden)' : ''}
                    </span>
                    <span>{fmtL(line.litres_sold)} · {fmtR(line.revenue_zar)}</span>
                  </div>
                  {isOverridable && (
                    <details className="mt-2 border-t pt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Edit POS line</summary>
                      <form action={handleOverride} className="pt-2 space-y-2">
                        <input type="hidden" name="reading_id" value={line.id} />
                        <input type="hidden" name="reading_type" value="pos_line" />
                        <input type="hidden" name="original_litres" value={line.litres_sold} />
                        <input type="hidden" name="original_revenue" value={line.revenue_zar} />
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Field to correct</label>
                          <select name="field_name" required className="w-full rounded border px-3 py-1.5 text-sm bg-white">
                            <option value="">— select —</option>
                            <option value="litres_sold">Litres sold (current: {fmtL(line.litres_sold)})</option>
                            <option value="revenue_zar">Revenue (current: {fmtR(line.revenue_zar)})</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Corrected value</label>
                          <input type="number" name="override_value" step="0.01" min="0" required className="w-full rounded border px-3 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                          <input type="text" name="reason" required className="w-full rounded border px-3 py-1.5 text-sm" />
                        </div>
                        <button type="submit" className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white">Save correction</button>
                      </form>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </section>

      {/* Reconciliation */}
      {rec && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Reconciliation</h2>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Formula 1 — Tank Inventory</p>
            <div className="border rounded-md divide-y text-sm">
              {((rec as any).reconciliation_tank_lines ?? []).map((line: any) => (
                <div key={line.id} className="px-4 py-3">
                  <div className="font-medium mb-1">{tankLabel(line.tank_id)}</div>
                  <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                    <span>Opening</span><span className="text-right">{fmtL(line.opening_dip)}</span>
                    <span>Deliveries</span><span className="text-right">+{fmtL(line.deliveries_received)}</span>
                    <span>POS sold</span><span className="text-right">−{fmtL(line.pos_litres_sold)}</span>
                    <span>Expected</span><span className="text-right">{fmtL(line.expected_closing_dip)}</span>
                    <span>Actual</span><span className="text-right">{fmtL(line.actual_closing_dip)}</span>
                  </div>
                  <VarianceRow label="Variance" v={line.variance_litres} unit="L" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Formula 2 — Pump Meter vs POS</p>
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
                  {((rec as any).reconciliation_grade_lines ?? []).map((line: any) => {
                    const v = line.variance_litres
                    const cls = v > 0 ? 'text-destructive' : v < 0 ? 'text-amber-600' : 'text-green-600'
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2 font-medium">{line.fuel_grade_id}</td>
                        <td className="px-3 py-2 text-right">{fmtL(line.meter_delta)}</td>
                        <td className="px-3 py-2 text-right">{fmtL(line.pos_litres_sold)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${cls}`}>{v > 0 ? '+' : ''}{fmtL(v)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {financial && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Financial</p>
              <div className="border rounded-md text-sm overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-muted-foreground text-xs">
                      <th className="text-left px-3 py-2">Grade</th>
                      <th className="text-right px-3 py-2">Litres</th>
                      <th className="text-right px-3 py-2">Price/L</th>
                      <th className="text-right px-3 py-2">Expected</th>
                      <th className="text-right px-3 py-2">POS</th>
                      <th className="text-right px-3 py-2">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {financial.lines.map(line => {
                      const v = line.variance_zar
                      const cls = v > 0 ? 'text-destructive' : v < 0 ? 'text-amber-600' : 'text-green-600'
                      return (
                        <tr key={line.fuel_grade_id}>
                          <td className="px-3 py-2 font-medium">{line.fuel_grade_id}</td>
                          <td className="px-3 py-2 text-right">{fmtL(line.litres_sold)}</td>
                          <td className="px-3 py-2 text-right">R {line.price_per_litre.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{fmtR(line.expected_revenue_zar)}</td>
                          <td className="px-3 py-2 text-right">{fmtR(line.pos_revenue_zar)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${cls}`}>{v > 0 ? '+' : ''}{fmtR(v)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="px-3 py-2" colSpan={3}>Total</td>
                      <td className="px-3 py-2 text-right">{fmtR(financial.totals.expected_revenue_zar)}</td>
                      <td className="px-3 py-2 text-right">{fmtR(financial.totals.pos_revenue_zar)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${financial.totals.variance_zar > 0 ? 'text-destructive' : financial.totals.variance_zar < 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {financial.totals.variance_zar > 0 ? '+' : ''}{fmtR(financial.totals.variance_zar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Flag / unflag */}
      {isFlaggable && (
        <section className="border rounded-md p-4 space-y-3">
          <h2 className="text-sm font-medium">Flag this shift</h2>
          {shift.is_flagged ? (
            <>
              <p className="text-sm text-muted-foreground">{shift.flag_comment}</p>
              <form action={handleUnflag}>
                <button type="submit" className="rounded border px-3 py-1.5 text-sm font-medium text-red-700 border-red-200 hover:bg-red-50">
                  Remove flag
                </button>
              </form>
            </>
          ) : (
            <form action={handleFlag} className="space-y-2">
              <textarea name="comment" rows={2} placeholder="Describe the discrepancy…" required
                className="w-full rounded border px-3 py-2 text-sm resize-none" />
              <button type="submit" className="rounded border px-3 py-1.5 text-sm font-medium text-red-700 border-red-200 hover:bg-red-50">
                Flag shift
              </button>
            </form>
          )}
        </section>
      )}

      {/* Override audit trail */}
      {(overrides?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Override history</h2>
          <div className="border rounded-md divide-y text-sm">
            {(overrides ?? []).map(o => (
              <div key={o.id} className="px-4 py-3 space-y-0.5">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{o.reading_type} reading</span>
                  <span>{fmt(o.original_value)} → {fmt(o.override_value)}</span>
                </div>
                <div className="text-muted-foreground text-xs italic">{o.reason}</div>
                <div className="text-muted-foreground text-xs">
                  {(() => { const d = new Date(o.created_at); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })()}
                  {(o as any).user_profiles?.full_name && ` · ${(o as any).user_profiles.full_name}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
