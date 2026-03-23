/**
 * runReconciliation — orchestrator (I/O layer).
 *
 * Reads all inputs from the database, calls the pure computeReconciliation function,
 * and persists the result. Uses the admin client so RLS is bypassed for writes.
 *
 * Call this after a shift transitions to 'submitted', and again whenever a delivery
 * is added or edited for a shift that is already submitted.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { computeReconciliation } from '@/lib/reconciliation'
import { selectActivePriceAt } from '@/lib/pricing'

export async function runReconciliation(shiftId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // ── 1. Load shift ──────────────────────────────────────────────────────────
  const { data: shift, error: shiftErr } = await admin
    .from('shifts')
    .select('id, station_id, period, shift_date, status, submitted_at')
    .eq('id', shiftId)
    .single()
  if (shiftErr || !shift) return { error: shiftErr?.message ?? 'Shift not found' }

  // ── 2. Station structure ────────────────────────────────────────────────────
  const [{ data: tanks }, { data: pumps }] = await Promise.all([
    admin.from('tanks').select('id, fuel_grade_id').eq('station_id', shift.station_id),
    admin.from('pumps').select('id, tank_id').eq('station_id', shift.station_id),
  ])
  if (!tanks?.length || !pumps?.length) return { error: 'Station has no tanks or pumps configured' }

  // ── 3. Readings for this shift ─────────────────────────────────────────────
  const [
    { data: openDips },
    { data: closeDips },
    { data: pumpReadings },
    { data: posSubmission },
  ] = await Promise.all([
    admin.from('dip_readings').select('tank_id, litres').eq('shift_id', shiftId).eq('type', 'open'),
    admin.from('dip_readings').select('tank_id, litres').eq('shift_id', shiftId).eq('type', 'close'),
    admin.from('pump_readings')
      .select('pump_id, meter_reading, type')
      .eq('shift_id', shiftId)
      .in('type', ['open', 'close']),
    admin.from('pos_submissions')
      .select('id')
      .eq('shift_id', shiftId)
      .maybeSingle(),
  ])

  const posLines = posSubmission
    ? (await admin
        .from('pos_submission_lines')
        .select('fuel_grade_id, litres_sold, revenue_zar')
        .eq('pos_submission_id', posSubmission.id)
      ).data ?? []
    : []

  // Pair up open/close pump readings into a single structure
  const openReadings  = (pumpReadings ?? []).filter(r => r.type === 'open')
  const closeReadings = (pumpReadings ?? []).filter(r => r.type === 'close')
  const pairedReadings = openReadings.flatMap(o => {
    const c = closeReadings.find(r => r.pump_id === o.pump_id)
    if (!c) return []
    return [{ pump_id: o.pump_id, opening_reading: o.meter_reading, closing_reading: c.meter_reading }]
  })

  // ── 4. Deliveries for this shift period ────────────────────────────────────
  // Morning = before 12:00 UTC; Evening = 12:00+ UTC.
  // Filter by station and date; period determined by timestamp hour.
  const dayStart = `${shift.shift_date}T00:00:00Z`
  const dayEnd   = `${shift.shift_date}T23:59:59Z`
  const { data: allDeliveries } = await admin
    .from('deliveries')
    .select('tank_id, litres_received, delivered_at')
    .eq('station_id', shift.station_id)
    .gte('delivered_at', dayStart)
    .lte('delivered_at', dayEnd)

  const deliveries = (allDeliveries ?? []).filter(d => {
    const hour = new Date(d.delivered_at).getUTCHours()
    return shift.period === 'morning' ? hour < 12 : hour >= 12
  })

  // ── 5. Fuel prices at time of shift submission ─────────────────────────────
  // Use submitted_at so historical re-runs (triggered by delivery edits) still
  // use the price that was active when the attendant submitted, not today's price.
  const priceAsOf = shift.submitted_at ?? new Date().toISOString()
  const gradeIds  = [...new Set(tanks.map(t => t.fuel_grade_id))]

  const { data: allPriceRows } = await admin
    .from('fuel_prices')
    .select('fuel_grade_id, price_per_litre, effective_from')
    .in('fuel_grade_id', gradeIds)

  const priceSnapshots = gradeIds.map(gradeId => {
    const rows = (allPriceRows ?? []).filter(r => r.fuel_grade_id === gradeId)
    return {
      fuel_grade_id:   gradeId,
      price_per_litre: selectActivePriceAt(rows, priceAsOf) ?? 0,
    }
  })

  // ── 6. Compute ─────────────────────────────────────────────────────────────
  const result = computeReconciliation({
    tanks:        tanks.map(t => ({ id: t.id, fuel_grade_id: t.fuel_grade_id })),
    pumps:        pumps.map(p => ({ id: p.id, tank_id: p.tank_id })),
    openDips:     (openDips ?? []).map(d => ({ tank_id: d.tank_id, litres: d.litres })),
    closeDips:    (closeDips ?? []).map(d => ({ tank_id: d.tank_id, litres: d.litres })),
    deliveries:   deliveries.map(d => ({ tank_id: d.tank_id, litres_received: d.litres_received })),
    pumpReadings: pairedReadings,
    posLines:     posLines.map(l => ({
      fuel_grade_id: l.fuel_grade_id,
      litres_sold:   l.litres_sold,
      revenue_zar:   l.revenue_zar,
    })),
    prices:       priceSnapshots,
  })

  // ── 7. Persist ─────────────────────────────────────────────────────────────
  // Upsert the reconciliation header
  const { data: rec, error: recErr } = await admin
    .from('reconciliations')
    .upsert({
      shift_id:         shiftId,
      expected_revenue: result.expectedRevenue,
      pos_revenue:      result.posRevenue,
      revenue_variance: result.revenueVariance,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'shift_id' })
    .select('id')
    .single()
  if (recErr) return { error: recErr.message }

  // Replace tank lines
  await admin.from('reconciliation_tank_lines').delete().eq('reconciliation_id', rec.id)
  const { error: tankErr } = await admin.from('reconciliation_tank_lines').insert(
    result.tankLines.map(l => ({ reconciliation_id: rec.id, ...l }))
  )
  if (tankErr) return { error: tankErr.message }

  // Replace grade lines
  await admin.from('reconciliation_grade_lines').delete().eq('reconciliation_id', rec.id)
  const { error: gradeErr } = await admin.from('reconciliation_grade_lines').insert(
    result.gradeLines.map(l => ({ reconciliation_id: rec.id, ...l }))
  )
  if (gradeErr) return { error: gradeErr.message }

  return {}
}
