/**
 * runStockReconciliation — orchestrator for dry stock reconciliation.
 *
 * Mirrors the architecture of reconciliation-runner.ts:
 *   loadBundle (I/O)  →  assembleStockInputs (pure)
 *     →  computeStockReconciliation (pure, lib/stock-reconciliation.ts)
 *       →  StockWriter.persist (I/O, injected)
 */

import { createAdminClient }              from '@/lib/supabase/admin'
import { computeStockReconciliation }     from '@/lib/stock-reconciliation'
import type { StockLine }                 from '@/lib/stock-reconciliation'
import type { StockReconciliationInput }  from '@/lib/stock-reconciliation'
import type { SupabaseClient }            from '@supabase/supabase-js'

// ── Raw data bundle ────────────────────────────────────────────────────────────

export interface StockDataBundle {
  shift:           { id: string; station_id: string }
  products:        { id: string; sell_price: number }[]
  openingCounts:   { product_id: string; count: number }[]
  closingCounts:   { product_id: string; closing_count: number }[]
  deliveries:      { product_id: string; quantity: number }[]
  posDryStockLines:{ product_id: string; units_sold: number }[]
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface StockDataRepository {
  loadBundle(shiftId: string): Promise<StockDataBundle | { error: string }>
}

export interface StockWriter {
  persist(shiftId: string, lines: StockLine[]): Promise<{ error?: string }>
}

// ── Pure assembly (exported for unit tests) ───────────────────────────────────

export function assembleStockInputs(bundle: StockDataBundle): StockReconciliationInput[] {
  return bundle.products.map(product => {
    const opening = bundle.openingCounts.find(o => o.product_id === product.id)
    const closing = bundle.closingCounts.find(c => c.product_id === product.id)
    const posLine = bundle.posDryStockLines.find(p => p.product_id === product.id)
    const deliveriesTotal = bundle.deliveries
      .filter(d => d.product_id === product.id)
      .reduce((sum, d) => sum + d.quantity, 0)

    return {
      productId:     product.id,
      openingCount:  opening?.count ?? 0,
      deliveries:    deliveriesTotal,
      posUnitsSold:  posLine?.units_sold ?? 0,
      actualClosing: closing?.closing_count ?? 0,
      sellPrice:     product.sell_price,
    }
  })
}

// ── Supabase adapters ─────────────────────────────────────────────────────────

export function createSupabaseStockRepository(db: SupabaseClient): StockDataRepository {
  return {
    async loadBundle(shiftId) {
      // ── 1. Shift ──────────────────────────────────────────────────────────
      const { data: shift, error: shiftErr } = await db
        .from('shifts')
        .select('id, station_id, shift_date')
        .eq('id', shiftId)
        .single()
      if (shiftErr || !shift) return { error: shiftErr?.message ?? 'Shift not found' }

      // ── 2. Products for this station ─────────────────────────────────────
      const { data: products } = await db
        .from('products')
        .select('id, sell_price')
        .eq('station_id', shift.station_id)
        .eq('is_active', true)
      if (!products?.length) return { error: 'No active products configured for this station' }

      // ── 3. Closing counts for this shift ──────────────────────────────────
      const { data: closingCounts } = await db
        .from('stock_readings')
        .select('product_id, closing_count')
        .eq('shift_id', shiftId)

      // ── 4. Opening counts: prior shift's closing counts or stock_baselines ─
      const { data: prevShift } = await db
        .from('shifts')
        .select('id')
        .eq('station_id', shift.station_id)
        .eq('status', 'closed')
        .lt('shift_date', shift.shift_date)
        .order('shift_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      let openingCounts: { product_id: string; count: number }[] = []
      if (prevShift) {
        const { data: prevReadings } = await db
          .from('stock_readings')
          .select('product_id, closing_count')
          .eq('shift_id', prevShift.id)
        openingCounts = (prevReadings ?? []).map(r => ({ product_id: r.product_id, count: r.closing_count }))
      } else {
        const { data: baselines } = await db
          .from('stock_baselines')
          .select('product_id, quantity')
          .eq('station_id', shift.station_id)
        openingCounts = (baselines ?? []).map(b => ({ product_id: b.product_id, count: b.quantity }))
      }

      // ── 5. Stock deliveries for this shift ────────────────────────────────
      const { data: deliveries } = await db
        .from('stock_deliveries')
        .select('product_id, quantity')
        .eq('shift_id', shiftId)

      // ── 6. POS dry stock lines via dry_stock_pos_submissions ──────────────
      const { data: submission } = await db
        .from('dry_stock_pos_submissions')
        .select('id')
        .eq('shift_id', shiftId)
        .maybeSingle()

      const posDryStockLines = submission
        ? (await db
            .from('pos_dry_stock_lines')
            .select('product_id, units_sold')
            .eq('dry_stock_pos_submission_id', submission.id)
          ).data ?? []
        : []

      return {
        shift,
        products:         (products ?? []) as { id: string; sell_price: number }[],
        openingCounts,
        closingCounts:    (closingCounts ?? []) as { product_id: string; closing_count: number }[],
        deliveries:       (deliveries ?? []) as { product_id: string; quantity: number }[],
        posDryStockLines: posDryStockLines as { product_id: string; units_sold: number }[],
      }
    },
  }
}

export function createSupabaseStockWriter(db: SupabaseClient): StockWriter {
  return {
    async persist(shiftId, lines) {
      // Upsert reconciliation header (shared with fuel reconciliation)
      const { data: rec, error: recErr } = await db
        .from('reconciliations')
        .upsert({ shift_id: shiftId, updated_at: new Date().toISOString() }, { onConflict: 'shift_id' })
        .select('id')
        .single()
      if (recErr) return { error: recErr.message }

      // Replace stock lines
      await db.from('reconciliation_stock_lines').delete().eq('reconciliation_id', rec.id)
      if (lines.length === 0) return {}
      const { error } = await db.from('reconciliation_stock_lines').insert(
        lines.map(l => ({ reconciliation_id: rec.id, ...l }))
      )
      return error ? { error: error.message } : {}
    },
  }
}

// ── Composable orchestrator ───────────────────────────────────────────────────

export async function runStockReconciliationWith(
  shiftId:    string,
  repository: StockDataRepository,
  writer:     StockWriter,
): Promise<{ error?: string }> {
  const bundleOrError = await repository.loadBundle(shiftId)
  if ('error' in bundleOrError) return bundleOrError

  const inputs = assembleStockInputs(bundleOrError)
  const lines  = computeStockReconciliation(inputs)
  return writer.persist(shiftId, lines)
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function runStockReconciliation(shiftId: string): Promise<{ error?: string }> {
  const db = createAdminClient()
  return runStockReconciliationWith(
    shiftId,
    createSupabaseStockRepository(db),
    createSupabaseStockWriter(db),
  )
}
