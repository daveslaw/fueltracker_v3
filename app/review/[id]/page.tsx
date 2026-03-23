import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canReview } from '@/lib/supervisor-review'
import type { ShiftStatus } from '@/lib/supervisor-review'
import { ApproveButton } from './ApproveButton'
import { FlagForm } from './FlagForm'
import { OverrideForm } from './OverrideForm'

interface Props { params: Promise<{ id: string }> }

export default async function ShiftDetailPage({ params }: Props) {
  const { id: shiftId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single()
  if (!profile?.is_active || !['supervisor', 'owner'].includes(profile.role ?? ''))
    redirect('/login')

  // ── Load shift + all related data ─────────────────────────────────────────
  const { data: shift } = await supabase
    .from('shifts')
    .select(`
      id, period, shift_date, status, submitted_at, flag_comment,
      station_id,
      stations ( name ),
      user_profiles!attendant_id ( first_name, last_name )
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
    { data: deliveries },
    { data: overrides },
  ] = await Promise.all([
    supabase.from('pumps').select('id, label, tank_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('tanks').select('id, label, fuel_grade_id').eq('station_id', shift.station_id).order('label'),
    supabase.from('pump_readings').select('id, pump_id, type, meter_reading, photo_url, ocr_status').eq('shift_id', shiftId),
    supabase.from('dip_readings').select('tank_id, type, litres').eq('shift_id', shiftId),
    supabase.from('pos_submissions').select('id, photo_url').eq('shift_id', shiftId).maybeSingle(),
    supabase.from('reconciliations')
      .select('id, expected_revenue, pos_revenue, revenue_variance, reconciliation_tank_lines(*), reconciliation_grade_lines(*)')
      .eq('shift_id', shiftId).maybeSingle(),
    supabase.from('deliveries')
      .select('id, tank_id, litres_received, delivered_at, delivery_note_url')
      .eq('station_id', shift.station_id)
      .eq('shift_date' as any, shift.shift_date),  // approximate — filtered client-side
    supabase.from('ocr_overrides').select('id, reading_id, reading_type, original_value, override_value, reason, created_at').eq('shift_id', shiftId),
  ])

  const posLines = posSubmission
    ? (await supabase.from('pos_submission_lines')
        .select('id, fuel_grade_id, litres_sold, revenue_zar, ocr_status')
        .eq('pos_submission_id', posSubmission.id)).data ?? []
    : []

  const pumpLabel = (id: string) => pumps?.find(p => p.id === id)?.label ?? id
  const tankLabel = (id: string) => tanks?.find(t => t.id === id)?.label ?? id
  const overriddenIds = new Set((overrides ?? []).map(o => o.reading_id))

  const fmt  = (n: number) => n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtL = (n: number) => `${fmt(n)} L`
  const fmtR = (n: number) => `R ${fmt(Math.abs(n))}`

  const s = shift as any
  const canApprove = canReview(shift.status as ShiftStatus, 'approve')
  const canFlag    = canReview(shift.status as ShiftStatus, 'flag')

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/review" className="text-xs text-muted-foreground hover:underline">
            ← Back to review
          </Link>
          <h1 className="text-xl font-semibold mt-1 capitalize">
            {shift.period} shift · {shift.shift_date}
          </h1>
          <p className="text-sm text-muted-foreground">
            {s.stations?.name} · {s.user_profiles?.first_name} {s.user_profiles?.last_name}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded capitalize ${
          shift.status === 'approved' ? 'bg-green-100 text-green-800' :
          shift.status === 'flagged'  ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {shift.status}
        </span>
      </div>

      {shift.flag_comment && (
        <div className="border border-red-200 bg-red-50 rounded-md px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Flagged: </span>{shift.flag_comment}
        </div>
      )}

      {/* Approve / Flag actions */}
      {(canApprove || canFlag) && (
        <div className="flex gap-3">
          {canApprove && <ApproveButton shiftId={shiftId} />}
          {canFlag    && <FlagForm shiftId={shiftId} />}
        </div>
      )}

      {/* Pump readings */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pump readings</h2>
        <div className="border rounded-md divide-y text-sm">
          {(pumps ?? []).map(pump => {
            const open  = pumpReadings?.find(r => r.pump_id === pump.id && r.type === 'open')
            const close = pumpReadings?.find(r => r.pump_id === pump.id && r.type === 'close')
            return (
              <div key={pump.id} className="px-4 py-3 space-y-1">
                <div className="font-medium">{pump.label}</div>
                <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                  <span>Open</span>
                  <span className="text-right flex items-center justify-end gap-2">
                    {open ? fmt(open.meter_reading) : '—'}
                    {open?.photo_url && <a href={open.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">photo</a>}
                  </span>
                  <span>Close</span>
                  <span className="text-right flex items-center justify-end gap-2">
                    {close ? fmt(close.meter_reading) : '—'}
                    {close?.photo_url && <a href={close.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">photo</a>}
                  </span>
                </div>
                {close && !overriddenIds.has(close.id) && (
                  <OverrideForm
                    shiftId={shiftId}
                    readingId={close.id}
                    readingType="pump"
                    currentValue={close.meter_reading}
                    label={`Override close reading for ${pump.label}`}
                  />
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
            const open  = dipReadings?.find(r => r.tank_id === tank.id && r.type === 'open')
            const close = dipReadings?.find(r => r.tank_id === tank.id && r.type === 'close')
            return (
              <div key={tank.id} className="px-4 py-3">
                <div className="font-medium">{tank.label} ({tank.fuel_grade_id})</div>
                <div className="grid grid-cols-2 gap-x-4 text-muted-foreground text-sm mt-1">
                  <span>Open</span><span className="text-right">{open ? fmtL(open.litres) : '—'}</span>
                  <span>Close</span><span className="text-right">{close ? fmtL(close.litres) : '—'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* POS Z-report */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">POS Z-report</h2>
        {!posSubmission && <p className="text-sm text-muted-foreground">No POS submission.</p>}
        {posSubmission && (
          <div className="border rounded-md text-sm divide-y">
            {posSubmission.photo_url && (
              <div className="px-4 py-3">
                <a href={posSubmission.photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                  View Z-report photo
                </a>
              </div>
            )}
            {posLines.map(line => (
              <div key={line.id} className="px-4 py-3 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{line.fuel_grade_id}</span>
                  <span>{fmtL(line.litres_sold)} · R {fmt(line.revenue_zar)}</span>
                </div>
                {!overriddenIds.has(line.id) && (
                  <OverrideForm
                    shiftId={shiftId}
                    readingId={line.id}
                    readingType="pos_line"
                    currentValue={line.litres_sold}
                    label={`Override litres sold for ${line.fuel_grade_id}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Deliveries */}
      {(deliveries?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Deliveries</h2>
          <div className="border rounded-md divide-y text-sm">
            {(deliveries ?? []).map(d => (
              <div key={d.id} className="px-4 py-3">
                <div className="flex justify-between">
                  <span className="font-medium">{tankLabel(d.tank_id)}</span>
                  <span>{fmtL(d.litres_received)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(d.delivered_at).toLocaleString('en-ZA')}</div>
                {d.delivery_note_url && (
                  <a href={d.delivery_note_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                    Delivery note
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reconciliation */}
      {rec && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Reconciliation</h2>

          {/* Tank lines */}
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
                <div className={`flex justify-between font-semibold border-t mt-1 pt-1 ${
                  line.variance_litres > 0 ? 'text-destructive' : line.variance_litres < 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  <span>Variance</span><span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Grade lines */}
          <div className="border rounded-md divide-y text-sm">
            {((rec as any).reconciliation_grade_lines ?? []).map((line: any) => (
              <div key={line.id} className="px-4 py-3">
                <div className="font-medium mb-1">{line.fuel_grade_id}</div>
                <div className="grid grid-cols-2 gap-x-4 text-muted-foreground">
                  <span>Meter delta</span><span className="text-right">{fmtL(line.meter_delta)}</span>
                  <span>POS sold</span><span className="text-right">{fmtL(line.pos_litres_sold)}</span>
                </div>
                <div className={`flex justify-between font-semibold border-t mt-1 pt-1 ${
                  line.variance_litres !== 0 ? 'text-destructive' : 'text-green-600'
                }`}>
                  <span>Variance</span><span>{line.variance_litres > 0 ? '+' : ''}{fmtL(line.variance_litres)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue */}
          <div className="border rounded-md divide-y text-sm">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-muted-foreground">Expected revenue</span><span>{fmtR(rec.expected_revenue)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-muted-foreground">POS reported</span><span>{fmtR(rec.pos_revenue)}</span>
            </div>
            <div className={`px-4 py-3 flex justify-between font-semibold ${
              rec.revenue_variance > 0 ? 'text-destructive' : rec.revenue_variance < 0 ? 'text-amber-600' : 'text-green-600'
            }`}>
              <span>Revenue variance</span>
              <span>{rec.revenue_variance > 0 ? '+' : ''}{fmtR(rec.revenue_variance)}</span>
            </div>
          </div>
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
                <div className="text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString('en-ZA')}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
