/**
 * runReconciliation — orchestrator (I/O layer).
 *
 * Reads all inputs from the database, assembles them into ReconciliationInputs,
 * calls the pure computeReconciliation function, and persists the result.
 *
 * Call this after a shift transitions to 'submitted', and again whenever a delivery
 * is added or edited for a shift that is already submitted.
 *
 * Architecture:
 *   loadBundle (private, I/O)  →  assemblePureInputs (pure, exported)
 *     →  computeReconciliation (pure, lib/reconciliation.ts)
 *       →  ReconciliationWriter.persist (I/O, injected)
 */

import { createAdminClient }      from '@/lib/supabase/admin'
import { computeReconciliation }  from '@/lib/reconciliation'
import { selectActivePriceAt }    from '@/lib/pricing'
import { getShiftPeriod }         from '@/lib/deliveries'
import type { PriceRow }          from '@/lib/pricing'
import type {
  ReconciliationInputs,
  ReconciliationOutput,
} from '@/lib/reconciliation'
import type { SupabaseClient }    from '@supabase/supabase-js'

// ── Raw data bundle ────────────────────────────────────────────────────────────
// Exactly what the loader fetches — no transforms applied yet.

export interface ShiftDataBundle {
  shift: {
    id:           string
    station_id:   string
    period:       'morning' | 'evening'
    shift_date:   string        // YYYY-MM-DD
    submitted_at: string | null // ISO timestamp; null if shift not yet submitted
  }
  tanks:        { id: string; fuel_grade_id: string }[]
  pumps:        { id: string; tank_id: string }[]
  openDips:     { tank_id: string; litres: number }[]
  closeDips:    { tank_id: string; litres: number }[]
  pumpReadings: { pump_id: string; meter_reading: number; type: 'open' | 'close' }[]
  posLines:     { fuel_grade_id: string; litres_sold: number; revenue_zar: number }[]
  deliveries:   { tank_id: string; litres_received: number; delivered_at: string }[]
  priceRows:    PriceRow[]      // all versioned rows for relevant grades; period filtering in assembly
  repositoryWarnings?: AssemblyWarning[]  // warnings emitted during I/O (e.g. missing baseline)
}

// ── Assembly warning ───────────────────────────────────────────────────────────
// Emitted when assembly encounters silent failure modes. Never throws.
// Logged by runReconciliationWith; surface to supervisors in a future PR.

export interface AssemblyWarning {
  code:   'PUMP_NO_CLOSE_READING' | 'SUBMITTED_AT_NULL' | 'PRICE_NOT_FOUND' | 'TANK_MISSING_DIP' | 'NO_PRIOR_SHIFT_BASELINE'
  detail: string
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface ShiftDataRepository {
  loadBundle(shiftId: string): Promise<ShiftDataBundle | { error: string }>
}

export interface ReconciliationWriter {
  persist(shiftId: string, result: ReconciliationOutput): Promise<{ error?: string }>
}

// ── Pure assembly (exported for unit tests) ───────────────────────────────────

export function assemblePureInputs(
  bundle: ShiftDataBundle,
): { inputs: ReconciliationInputs; warnings: AssemblyWarning[] } {
  const warnings: AssemblyWarning[] = [...(bundle.repositoryWarnings ?? [])]

  // Pair open/close pump readings by pump_id.
  // A pump with an open reading but no close is excluded and warned.
  const openPR  = bundle.pumpReadings.filter(r => r.type === 'open')
  const closePR = bundle.pumpReadings.filter(r => r.type === 'close')
  const pumpReadings = openPR.flatMap(o => {
    const c = closePR.find(r => r.pump_id === o.pump_id)
    if (!c) {
      warnings.push({
        code:   'PUMP_NO_CLOSE_READING',
        detail: `pump_id ${o.pump_id} has an open reading but no close reading`,
      })
      return []
    }
    return [{ pump_id: o.pump_id, opening_reading: o.meter_reading, closing_reading: c.meter_reading }]
  })

  // Filter deliveries to this shift's period using the canonical shared function.
  // Replaces the inline `hour < 12` duplication that existed in the previous version.
  const deliveries = bundle.deliveries
    .filter(d => getShiftPeriod(d.delivered_at) === bundle.shift.period)
    .map(d => ({ tank_id: d.tank_id, litres_received: d.litres_received }))

  // Price snapshot at submitted_at.
  // Falls back to current time only if submitted_at is null (edge case: re-run on unsubmitted shift).
  if (bundle.shift.submitted_at === null) {
    warnings.push({
      code:   'SUBMITTED_AT_NULL',
      detail: 'shift.submitted_at is null; prices resolved against current time — historical accuracy not guaranteed',
    })
  }
  const priceAsOf = bundle.shift.submitted_at ?? new Date().toISOString()
  const gradeIds  = [...new Set(bundle.tanks.map(t => t.fuel_grade_id))]
  const prices = gradeIds.map(gradeId => {
    const rows  = bundle.priceRows.filter(r => r.fuel_grade_id === gradeId)
    const price = selectActivePriceAt(rows, priceAsOf)
    if (price === null) {
      warnings.push({
        code:   'PRICE_NOT_FOUND',
        detail: `no active price found for grade ${gradeId} at ${priceAsOf}; defaulting to 0`,
      })
    }
    return { fuel_grade_id: gradeId, price_per_litre: price ?? 0 }
  })

  // Check that every tank has both an open and close dip reading.
  for (const tank of bundle.tanks) {
    const hasOpen  = bundle.openDips.some(d => d.tank_id === tank.id)
    const hasClose = bundle.closeDips.some(d => d.tank_id === tank.id)
    if (!hasOpen) {
      warnings.push({
        code:   'TANK_MISSING_DIP',
        detail: `tank_id ${tank.id} has no open dip reading; defaulting to 0L`,
      })
    }
    if (!hasClose) {
      warnings.push({
        code:   'TANK_MISSING_DIP',
        detail: `tank_id ${tank.id} has no close dip reading; defaulting to 0L`,
      })
    }
  }

  return {
    inputs: {
      tanks:        bundle.tanks,
      pumps:        bundle.pumps,
      openDips:     bundle.openDips,
      closeDips:    bundle.closeDips,
      deliveries,
      pumpReadings,
      posLines:     bundle.posLines,
      prices,
    },
    warnings,
  }
}

// ── Supabase adapters (production implementations of the ports) ───────────────

export function createSupabaseRepository(db: SupabaseClient): ShiftDataRepository {
  return {
    async loadBundle(shiftId) {
      // ── 1. Shift ──────────────────────────────────────────────────────────
      const { data: shift, error: shiftErr } = await db
        .from('shifts')
        .select('id, station_id, period, shift_date, status, submitted_at')
        .eq('id', shiftId)
        .single()
      if (shiftErr || !shift) return { error: shiftErr?.message ?? 'Shift not found' }

      // ── 2. Station structure ─────────────────────────────────────────────
      const [{ data: tanks }, { data: pumps }] = await Promise.all([
        db.from('tanks').select('id, fuel_grade_id').eq('station_id', shift.station_id),
        db.from('pumps').select('id, tank_id').eq('station_id', shift.station_id),
      ])
      if (!tanks?.length || !pumps?.length)
        return { error: 'Station has no tanks or pumps configured' }

      // ── 3. Current shift close readings + POS ────────────────────────────
      const [
        { data: closeDips },
        { data: closePumpReadings },
        { data: posSubmission },
      ] = await Promise.all([
        db.from('dip_readings').select('tank_id, litres').eq('shift_id', shiftId).eq('type', 'close'),
        db.from('pump_readings')
          .select('pump_id, meter_reading')
          .eq('shift_id', shiftId)
          .eq('type', 'close'),
        db.from('pos_submissions').select('id').eq('shift_id', shiftId).maybeSingle(),
      ])

      // ── 4. Opening baseline: previous closed shift → station baselines ────
      // Rolling model: the previous shift's close readings are this shift's open.
      const repositoryWarnings: AssemblyWarning[] = []

      const { data: prevShift } = await db
        .from('shifts')
        .select('id')
        .eq('station_id', shift.station_id)
        .eq('status', 'closed')
        .lt('shift_date', shift.shift_date)
        .order('shift_date', { ascending: false })
        .order('period',     { ascending: false }) // evening > morning within same date
        .limit(1)
        .maybeSingle()

      let openDips:         { tank_id: string; litres: number }[] = []
      let openPumpReadings: { pump_id: string; meter_reading: number; type: 'open' | 'close' }[] = []

      if (prevShift) {
        const [{ data: prevDips }, { data: prevPumps }] = await Promise.all([
          db.from('dip_readings')
            .select('tank_id, litres')
            .eq('shift_id', prevShift.id)
            .eq('type', 'close'),
          db.from('pump_readings')
            .select('pump_id, meter_reading')
            .eq('shift_id', prevShift.id)
            .eq('type', 'close'),
        ])
        openDips         = prevDips  ?? []
        openPumpReadings = (prevPumps ?? []).map(r => ({ ...r, type: 'open' as const }))
      } else {
        // Fall back to owner-set station baselines
        const { data: baselines } = await db
          .from('shift_baselines')
          .select('pump_id, tank_id, reading_type, value')
          .eq('station_id', shift.station_id)

        if (!baselines?.length) {
          repositoryWarnings.push({
            code:   'NO_PRIOR_SHIFT_BASELINE',
            detail: `No prior closed shift and no station baseline found for station ${shift.station_id}; opening readings will default to 0`,
          })
        } else {
          openDips = baselines
            .filter(b => b.reading_type === 'dip' && b.tank_id)
            .map(b => ({ tank_id: b.tank_id!, litres: b.value }))
          openPumpReadings = baselines
            .filter(b => b.reading_type === 'meter' && b.pump_id)
            .map(b => ({ pump_id: b.pump_id!, meter_reading: b.value, type: 'open' as const }))
        }
      }

      const pumpReadings = [
        ...openPumpReadings,
        ...(closePumpReadings ?? []).map(r => ({ ...r, type: 'close' as const })),
      ]

      const posLines = posSubmission
        ? (await db
            .from('pos_submission_lines')
            .select('fuel_grade_id, litres_sold, revenue_zar')
            .eq('pos_submission_id', posSubmission.id)
          ).data ?? []
        : []

      // ── 5. Deliveries for the shift day (unfiltered by period) ───────────
      // Period filtering happens in assemblePureInputs via getShiftPeriod().
      const dayStart = `${shift.shift_date}T00:00:00Z`
      const dayEnd   = `${shift.shift_date}T23:59:59Z`
      const { data: deliveries } = await db
        .from('deliveries')
        .select('tank_id, litres_received, delivered_at')
        .eq('station_id', shift.station_id)
        .gte('delivered_at', dayStart)
        .lte('delivered_at', dayEnd)

      // ── 6. Fuel prices (all versions for relevant grades) ────────────────
      const gradeIds = [...new Set(tanks.map(t => t.fuel_grade_id))]
      const { data: priceRows } = await db
        .from('fuel_prices')
        .select('fuel_grade_id, price_per_litre, effective_from')
        .in('fuel_grade_id', gradeIds)

      return {
        shift,
        tanks,
        pumps,
        openDips,
        closeDips:          (closeDips ?? []),
        pumpReadings:       pumpReadings as ShiftDataBundle['pumpReadings'],
        posLines:           (posLines   ?? []),
        deliveries:         (deliveries ?? []),
        priceRows:          (priceRows  ?? []),
        repositoryWarnings: repositoryWarnings.length ? repositoryWarnings : undefined,
      }
    },
  }
}

export function createSupabaseWriter(db: SupabaseClient): ReconciliationWriter {
  return {
    async persist(shiftId, result) {
      // Upsert reconciliation header
      const { data: rec, error: recErr } = await db
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

      // TODO: wrap these three writes in a Postgres RPC for atomicity (#19)

      // Replace tank lines
      await db.from('reconciliation_tank_lines').delete().eq('reconciliation_id', rec.id)
      const { error: tankErr } = await db.from('reconciliation_tank_lines').insert(
        result.tankLines.map(l => ({ reconciliation_id: rec.id, ...l }))
      )
      if (tankErr) return { error: tankErr.message }

      // Replace grade lines
      await db.from('reconciliation_grade_lines').delete().eq('reconciliation_id', rec.id)
      const { error: gradeErr } = await db.from('reconciliation_grade_lines').insert(
        result.gradeLines.map(l => ({ reconciliation_id: rec.id, ...l }))
      )
      if (gradeErr) return { error: gradeErr.message }

      return {}
    },
  }
}

// ── Composable orchestrator ───────────────────────────────────────────────────

export async function runReconciliationWith(
  shiftId:    string,
  repository: ShiftDataRepository,
  writer:     ReconciliationWriter,
): Promise<{ error?: string }> {
  const bundleOrError = await repository.loadBundle(shiftId)
  if ('error' in bundleOrError) return bundleOrError

  const { inputs, warnings } = assemblePureInputs(bundleOrError)
  if (warnings.length > 0) {
    console.warn('[reconciliation-runner] assembly warnings for shift', shiftId, warnings)
  }

  const result = computeReconciliation(inputs)
  return writer.persist(shiftId, result)
}

// ── Public entry point (unchanged signature — all existing callers stay the same) ──

export async function runReconciliation(shiftId: string): Promise<{ error?: string }> {
  const db = createAdminClient()
  return runReconciliationWith(
    shiftId,
    createSupabaseRepository(db),
    createSupabaseWriter(db),
  )
}
