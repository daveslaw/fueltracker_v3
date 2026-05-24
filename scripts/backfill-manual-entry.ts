/**
 * backfill-manual-entry.ts
 *
 * One-off script: find all existing shifts that have at least one pump_reading
 * or pos_submission_line with ocr_status != 'auto', and set has_manual_entry = true
 * on those shifts.
 *
 * Run AFTER applying supabase/migrations/20260524000003_has_manual_entry.sql.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx scripts/backfill-manual-entry.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function main() {
  const shiftIds = new Set<string>()

  // 1. Collect shift IDs from pump_readings with non-auto OCR status.
  console.log('Scanning pump_readings for non-auto ocr_status…')
  const { data: pumpRows, error: pumpErr } = await db
    .from('pump_readings')
    .select('shift_id')
    .neq('ocr_status', 'auto')

  if (pumpErr) {
    console.error('Failed to scan pump_readings:', pumpErr.message)
    process.exit(1)
  }
  for (const row of pumpRows ?? []) shiftIds.add(row.shift_id)
  console.log(`  pump_readings: ${pumpRows?.length ?? 0} non-auto row(s)`)

  // 2. Collect shift IDs from pos_submission_lines via pos_submissions join.
  console.log('Scanning pos_submission_lines for non-auto ocr_status…')
  const { data: posRows, error: posErr } = await db
    .from('pos_submission_lines')
    .select('pos_submission_id, pos_submissions!inner(shift_id)')
    .neq('ocr_status', 'auto')

  if (posErr) {
    console.error('Failed to scan pos_submission_lines:', posErr.message)
    process.exit(1)
  }
  for (const row of posRows ?? []) {
    const sub = row.pos_submissions as { shift_id: string } | null
    if (sub?.shift_id) shiftIds.add(sub.shift_id)
  }
  console.log(`  pos_submission_lines: ${posRows?.length ?? 0} non-auto row(s)`)

  if (shiftIds.size === 0) {
    console.log('\nNo shifts need updating. Done.')
    return
  }

  // 3. Batch-update affected shifts.
  console.log(`\nSetting has_manual_entry = true on ${shiftIds.size} shift(s)…`)
  const { error: updateErr } = await db
    .from('shifts')
    .update({ has_manual_entry: true })
    .in('id', Array.from(shiftIds))

  if (updateErr) {
    console.error('Failed to update shifts:', updateErr.message)
    process.exit(1)
  }

  console.log(`Done. ${shiftIds.size} shift(s) updated.`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
