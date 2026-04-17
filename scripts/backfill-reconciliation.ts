/**
 * backfill-reconciliation.ts
 *
 * One-off script: wipe all reconciliation records and re-run reconciliation
 * for every closed shift under the revised formulas (migration 000013).
 *
 * Run AFTER applying supabase/migrations/20260320000013_reconciliation_formula_revision.sql.
 *
 * Usage:
 *   npx tsx scripts/backfill-reconciliation.ts
 *
 * Required env vars (same as the app):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { runReconciliation } from '../lib/reconciliation-runner'

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function main() {
  // 1. Wipe existing reconciliation records.
  //    reconciliation_tank_lines and reconciliation_grade_lines cascade automatically.
  console.log('Wiping existing reconciliation records…')
  const { error: wipeErr } = await db.from('reconciliations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (wipeErr) {
    console.error('Failed to wipe reconciliations:', wipeErr.message)
    process.exit(1)
  }
  console.log('Wipe complete.')

  // 2. Fetch all closed shifts in chronological order.
  //    Process morning before evening within the same date so the rolling baseline resolves correctly.
  const { data: shifts, error: shiftsErr } = await db
    .from('shifts')
    .select('id, station_id, shift_date, period')
    .eq('status', 'closed')
    .order('shift_date', { ascending: true })
    .order('period',     { ascending: true })  // 'evening' > 'morning' alphabetically — correct order

  if (shiftsErr) {
    console.error('Failed to fetch closed shifts:', shiftsErr.message)
    process.exit(1)
  }

  if (!shifts?.length) {
    console.log('No closed shifts found. Nothing to backfill.')
    return
  }

  console.log(`Re-running reconciliation for ${shifts.length} closed shift(s)…`)

  let succeeded = 0
  let failed    = 0

  for (const shift of shifts) {
    const { error } = await runReconciliation(shift.id)
    if (error) {
      console.error(`  FAIL  shift ${shift.id} (${shift.shift_date} ${shift.period}): ${error}`)
      failed++
    } else {
      console.log(`  OK    shift ${shift.id} (${shift.shift_date} ${shift.period})`)
      succeeded++
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
