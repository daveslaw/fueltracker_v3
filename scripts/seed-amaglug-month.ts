/**
 * scripts/seed-amaglug-month.ts
 *
 * Seeds one full month (April 2026) of complete shift data for Elegant Amaglug.
 * Creates: fuel prices, 10 dry-stock products, product prices, shift baselines,
 * stock baselines, 60 closed shifts (morning + evening × 30 days), all readings,
 * POS submissions, dry-stock POS, stock readings, 12 fuel deliveries, and full
 * reconciliation results for both fuel and dry stock.
 *
 * Prerequisites:
 *   - At least one active supervisor and one active cashier assigned to Amaglug
 *     (station_id = a1000000-0000-0000-0000-000000000001)
 *   - env vars: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/seed-amaglug-month.ts
 *
 * To pass .env.local vars on Windows PowerShell:
 *   $env:NEXT_PUBLIC_SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npx tsx scripts/seed-amaglug-month.ts
 */

import { createClient } from '@supabase/supabase-js'
import { runReconciliation }      from '../lib/reconciliation-runner'
import { runStockReconciliation } from '../lib/dry-stock-runner'

// ── Supabase ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Station / hardware constants ──────────────────────────────────────────────

const STATION_ID = 'a1000000-0000-0000-0000-000000000001'

const TANKS = [
  { id: 'a1100000-0000-0000-0000-000000000001', gradeId: '95',  capacity: 30000, label: 'Tank 1 – 95'  },
  { id: 'a1100000-0000-0000-0000-000000000002', gradeId: 'D10', capacity: 31000, label: 'Tank 2 – D10' },
  { id: 'a1100000-0000-0000-0000-000000000003', gradeId: 'D10', capacity: 31000, label: 'Tank 3 – D10' },
]

// Pumps 0-5 → Tank 1 (95), 6-11 → Tank 2 (D10), 12-17 → Tank 3 (D10)
const PUMPS = Array.from({ length: 18 }, (_, i) => ({
  id: `a1200000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  tankId: TANKS[i < 6 ? 0 : i < 12 ? 1 : 2].id,
}))

// ── Fuel prices ───────────────────────────────────────────────────────────────

const FUEL_PRICES = [
  { gradeId: '95',  sell: 21.9500, cost: 19.5000 },
  { gradeId: 'D10', sell: 20.2100, cost: 17.8000 },
]

// ── Dry-stock products ────────────────────────────────────────────────────────

const PRODUCTS = [
  { code: 'RB-250',  desc: 'Red Bull 250ml',        cost: 22.00, sell: 35.00 },
  { code: 'MON-500', desc: 'Monster Energy 500ml',  cost: 28.00, sell: 42.00 },
  { code: 'SIM-125', desc: 'Simba Chips 125g',      cost:  8.00, sell: 13.99 },
  { code: 'LAY-100', desc: "Lay's Chips 100g",      cost:  7.00, sell: 12.99 },
  { code: 'FAN-2L',  desc: 'Fanta Orange 2L',       cost: 14.00, sell: 22.99 },
  { code: 'COK-2L',  desc: 'Coca-Cola 2L',          cost: 16.00, sell: 24.99 },
  { code: 'CAS-1L',  desc: 'Castrol GTX 1L',        cost: 85.00, sell:129.99 },
  { code: 'LS-20',   desc: 'Lucky Strike 20s',      cost: 45.00, sell: 64.99 },
  { code: 'CAD-90',  desc: 'Cadbury Slab 90g',      cost: 22.00, sell: 34.99 },
  { code: 'STIM-23', desc: 'Stimorol Gum 23g',      cost:  9.00, sell: 14.99 },
]

// Base units sold per shift per product (deterministic noise added below)
const PRODUCT_BASE_SALES = [3, 2, 7, 5, 2, 2, 1, 4, 3, 5]

// Stock levels to restock to on delivery days
const STOCK_DELIVERY_DAYS = [8, 19] // morning shifts on these days
const RESTOCK_QTYS        = [96, 72, 288, 240, 48, 48, 24, 120, 96, 144]

// ── Fuel delivery schedule ────────────────────────────────────────────────────
// period: 'morning' → delivered_at = 08:00 UTC (= 10am SAST); 'evening' → 14:00 UTC

const FUEL_DELIVERIES: {
  day: number; period: 'morning' | 'evening'
  tankIdx: number; litres: number; note: string; driver: string
}[] = [
  // Tank 1 – 95 (4 × 18 000 L)
  { day:  6, period: 'morning', tankIdx: 0, litres: 18000, note: 'DN-2604-001', driver: 'Sipho Nkosi'      },
  { day: 14, period: 'evening', tankIdx: 0, litres: 18000, note: 'DN-2604-002', driver: 'Bongani Dlamini'  },
  { day: 22, period: 'morning', tankIdx: 0, litres: 18000, note: 'DN-2604-003', driver: 'Sipho Nkosi'      },
  { day: 29, period: 'morning', tankIdx: 0, litres: 18000, note: 'DN-2604-004', driver: 'Thabo Mokoena'    },
  // Tank 2 – D10 (4 × 18 000 L)
  { day:  5, period: 'evening', tankIdx: 1, litres: 18000, note: 'DN-2604-005', driver: 'Thabo Mokoena'    },
  { day: 13, period: 'morning', tankIdx: 1, litres: 18000, note: 'DN-2604-006', driver: 'Sipho Nkosi'      },
  { day: 20, period: 'evening', tankIdx: 1, litres: 18000, note: 'DN-2604-007', driver: 'Bongani Dlamini'  },
  { day: 28, period: 'morning', tankIdx: 1, litres: 18000, note: 'DN-2604-008', driver: 'Sipho Nkosi'      },
  // Tank 3 – D10 (4 × 18 000 L)
  { day:  7, period: 'morning', tankIdx: 2, litres: 18000, note: 'DN-2604-009', driver: 'Bongani Dlamini'  },
  { day: 15, period: 'evening', tankIdx: 2, litres: 18000, note: 'DN-2604-010', driver: 'Thabo Mokoena'    },
  { day: 23, period: 'morning', tankIdx: 2, litres: 18000, note: 'DN-2604-011', driver: 'Sipho Nkosi'      },
  { day: 29, period: 'evening', tankIdx: 2, litres: 18000, note: 'DN-2604-012', driver: 'Bongani Dlamini'  },
]

// ── Simulation helpers ────────────────────────────────────────────────────────

// Litres dispensed per pump per shift — deterministic but varied.
// pumpIdx 0-5 (95 grade): base 160L; pumpIdx 6-17 (D10): base 180L.
function pumpDelta(pumpIdx: number, day: number, period: 'morning' | 'evening'): number {
  const base  = pumpIdx < 6 ? 160 : 180
  const noise = (day * 11 + pumpIdx * 17 + (period === 'evening' ? 37 : 0)) % 55
  return base + noise
}

// Tank inventory variance (litres) — small, realistic noise.
function tankVariance(tankIdx: number, day: number, period: 'morning' | 'evening'): number {
  return ((day * 31 + tankIdx * 19 + (period === 'evening' ? 11 : 0)) % 25) - 12
}

// POS vs meter variance (litres) per grade — very small.
function posVariance(gradeIdx: number, day: number, period: 'morning' | 'evening'): number {
  return ((day * 23 + gradeIdx * 11 + (period === 'evening' ? 7 : 0)) % 9) - 4
}

// Units sold per product per shift.
function productSales(productIdx: number, day: number, period: 'morning' | 'evening'): number {
  const base  = PRODUCT_BASE_SALES[productIdx]
  const noise = (day * 7 + productIdx * 13 + (period === 'evening' ? 5 : 0)) % 4
  return base + noise
}

// ISO timestamp helpers (all SAST = UTC+2)
function shiftStartedAt(dateStr: string, period: 'morning' | 'evening'): string {
  // morning: 06:00 SAST = 04:00 UTC; evening: 14:00 SAST = 12:00 UTC
  return `${dateStr}T${period === 'morning' ? '04' : '12'}:00:00.000Z`
}
function shiftSubmittedAt(dateStr: string, period: 'morning' | 'evening'): string {
  // morning: 14:00 SAST = 12:00 UTC; evening: 22:00 SAST = 20:00 UTC
  return `${dateStr}T${period === 'morning' ? '12' : '20'}:00:00.000Z`
}
function deliveryTimestamp(dateStr: string, period: 'morning' | 'evening'): string {
  // morning: 08:00 UTC (< 12, so getShiftPeriod → 'morning'); evening: 14:00 UTC (≥ 12 → 'evening')
  return `${dateStr}T${period === 'morning' ? '08' : '14'}:00:00.000Z`
}

// ── Abort on error ────────────────────────────────────────────────────────────

function die(context: string, detail: unknown): never {
  console.error(`\n✗ ${context}`, detail)
  process.exit(1)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log(' seed-amaglug-month  ·  April 2026  ·  60 shifts   ')
  console.log('═══════════════════════════════════════════════════\n')

  // ── 1. Resolve users ──────────────────────────────────────────────────────
  console.log('→ Resolving station users…')
  const { data: profiles, error: profErr } = await db
    .from('user_profiles')
    .select('id, user_id, role, email')
    .eq('station_id', STATION_ID)
    .eq('is_active', true)
    .in('role', ['supervisor', 'cashier'])

  if (profErr) die('user_profiles query', profErr.message)
  if (!profiles?.length) die('No users', 'Create an active supervisor and cashier for Amaglug first.')

  const supervisor = profiles.find((p: { role: string }) => p.role === 'supervisor')
  const cashier    = profiles.find((p: { role: string }) => p.role === 'cashier')

  if (!supervisor) die('Missing supervisor', 'Create an active supervisor for Amaglug first.')
  if (!cashier)    die('Missing cashier',    'Create an active cashier for Amaglug first.')

  console.log(`   Supervisor: ${supervisor.email ?? supervisor.id}`)
  console.log(`   Cashier:    ${cashier.email ?? cashier.id}\n`)

  // ── 2. Clear April 2026 data for Amaglug ─────────────────────────────────
  console.log('→ Clearing existing April 2026 data for Amaglug…')

  const { error: delShifts } = await db
    .from('shifts')
    .delete()
    .eq('station_id', STATION_ID)
    .gte('shift_date', '2026-04-01')
    .lte('shift_date', '2026-04-30')
  if (delShifts) die('Delete shifts', delShifts.message)

  const { error: delDels } = await db
    .from('deliveries')
    .delete()
    .eq('station_id', STATION_ID)
    .gte('delivered_at', '2026-04-01T00:00:00Z')
    .lte('delivered_at', '2026-04-30T23:59:59Z')
  if (delDels) die('Delete deliveries', delDels.message)

  console.log('   Done.\n')

  // ── 3. Fuel prices ────────────────────────────────────────────────────────
  console.log('→ Seeding fuel prices…')

  for (const fp of FUEL_PRICES) {
    const { data: existing } = await db
      .from('fuel_prices')
      .select('id')
      .eq('station_id', STATION_ID)
      .eq('fuel_grade_id', fp.gradeId)
      .is('valid_to', null)
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const { error } = await db.from('fuel_prices').insert({
        station_id:            STATION_ID,
        fuel_grade_id:         fp.gradeId,
        sell_price_per_litre:  fp.sell,
        cost_per_litre:        fp.cost,
        valid_from:            '2026-01-01T00:00:00.000Z',
        valid_to:              null,
        set_by:                supervisor.user_id,
      })
      if (error) die(`Insert fuel price ${fp.gradeId}`, error.message)
      console.log(`   Inserted ${fp.gradeId}: R${fp.sell}/L`)
    } else {
      console.log(`   ${fp.gradeId}: price already exists, skipping`)
    }
  }
  console.log()

  // ── 4. Products ───────────────────────────────────────────────────────────
  console.log('→ Seeding products…')

  const { data: existingProducts } = await db
    .from('products')
    .select('id, stock_code')
    .eq('station_id', STATION_ID)

  const existingCodes = new Set((existingProducts ?? []).map((p: { stock_code: string }) => p.stock_code))
  const productIdMap: Record<string, string> = {}

  // Populate map from existing products
  for (const ep of (existingProducts ?? [])) {
    productIdMap[(ep as { stock_code: string; id: string }).stock_code] = (ep as { id: string }).id
  }

  // Insert missing products
  for (const p of PRODUCTS) {
    if (existingCodes.has(p.code)) {
      console.log(`   ${p.code}: already exists, skipping`)
      continue
    }
    const { data, error } = await db
      .from('products')
      .insert({ station_id: STATION_ID, stock_code: p.code, description: p.desc, is_active: true })
      .select('id')
      .single()
    if (error) die(`Insert product ${p.code}`, error.message)
    productIdMap[p.code] = (data as { id: string }).id
    console.log(`   Inserted ${p.code}: ${p.desc}`)
  }
  console.log()

  // ── 5. Product prices ─────────────────────────────────────────────────────
  console.log('→ Seeding product prices…')

  for (const p of PRODUCTS) {
    const productId = productIdMap[p.code]
    if (!productId) continue

    const { data: existingPrice } = await db
      .from('product_prices')
      .select('id')
      .eq('product_id', productId)
      .eq('station_id', STATION_ID)
      .is('valid_to', null)
      .limit(1)
      .maybeSingle()

    if (!existingPrice) {
      const { error } = await db.from('product_prices').insert({
        product_id:  productId,
        station_id:  STATION_ID,
        cost_price:  p.cost,
        sell_price:  p.sell,
        valid_from:  '2026-01-01T00:00:00.000Z',
        valid_to:    null,
        set_by:      supervisor.user_id,
      })
      if (error) die(`Insert product price ${p.code}`, error.message)
      console.log(`   Inserted price for ${p.code}: R${p.sell}`)
    } else {
      console.log(`   ${p.code}: price already exists, skipping`)
    }
  }
  console.log()

  // ── 6. Shift baselines ────────────────────────────────────────────────────
  console.log('→ Seeding shift baselines (pump meters + tank dips)…')

  const INITIAL_PUMP_METERS: Record<string, number> = {}
  PUMPS.forEach((p, i) => { INITIAL_PUMP_METERS[p.id] = 400000 + i * 15000 })

  const INITIAL_DIPS: Record<string, number> = {
    [TANKS[0].id]: 20000, // 95 tank:   67% of 30 000 L
    [TANKS[1].id]: 19500, // D10 tank2: 63% of 31 000 L
    [TANKS[2].id]: 22000, // D10 tank3: 71% of 31 000 L
  }

  // shift_baselines uses partial unique indexes — upsert via onConflict doesn't work with them.
  // Delete + re-insert is safe since these are config, not transactional data.
  await db.from('shift_baselines').delete().eq('station_id', STATION_ID)

  const pumpBaselineRows = Object.entries(INITIAL_PUMP_METERS).map(([pumpId, value]) => ({
    station_id:   STATION_ID,
    pump_id:      pumpId,
    tank_id:      null,
    reading_type: 'meter',
    value,
    set_by:       supervisor.id,
  }))
  const { error: pbErr } = await db.from('shift_baselines').insert(pumpBaselineRows)
  if (pbErr) die('Insert pump baselines', pbErr.message)

  const tankBaselineRows = Object.entries(INITIAL_DIPS).map(([tankId, value]) => ({
    station_id:   STATION_ID,
    pump_id:      null,
    tank_id:      tankId,
    reading_type: 'dip',
    value,
    set_by:       supervisor.id,
  }))
  const { error: tbErr } = await db.from('shift_baselines').insert(tankBaselineRows)
  if (tbErr) die('Insert tank baselines', tbErr.message)

  console.log(`   ${PUMPS.length} pump baselines + ${TANKS.length} tank baselines inserted.\n`)

  // ── 7. Stock baselines ────────────────────────────────────────────────────
  console.log('→ Seeding stock baselines…')

  const INITIAL_STOCK: Record<string, number> = {
    'RB-250': 48, 'MON-500': 36, 'SIM-125': 120, 'LAY-100': 96,
    'FAN-2L': 24, 'COK-2L': 24,  'CAS-1L': 12,   'LS-20': 60,
    'CAD-90': 48, 'STIM-23': 72,
  }

  await db.from('stock_baselines').delete().eq('station_id', STATION_ID)

  const stockBaselineRows = Object.entries(INITIAL_STOCK)
    .filter(([code]) => productIdMap[code])
    .map(([code, qty]) => ({
      station_id:  STATION_ID,
      product_id:  productIdMap[code],
      quantity:    qty,
      set_by:      cashier.user_id,
    }))
  const { error: sbErr } = await db.from('stock_baselines').insert(stockBaselineRows)
  if (sbErr) die('Insert stock baselines', sbErr.message)
  console.log(`   ${stockBaselineRows.length} stock baselines inserted.\n`)

  // ── 8. Simulate the month ─────────────────────────────────────────────────
  console.log('→ Seeding 60 shifts (April 1–30, morning + evening)…\n')

  // Mutable simulation state
  const pumpMeter  = { ...INITIAL_PUMP_METERS }
  const tankLevel  = { ...INITIAL_DIPS } as Record<string, number>
  const stockLevel = { ...INITIAL_STOCK } as Record<string, number>

  const periods: ('morning' | 'evening')[] = ['morning', 'evening']

  for (let day = 1; day <= 30; day++) {
    const dateStr = `2026-04-${String(day).padStart(2, '0')}`

    for (const period of periods) {
      process.stdout.write(`   ${dateStr} ${period.padEnd(7)} `)

      // ── a. Compute per-pump deltas for this shift ──────────────────────
      const shiftDeltas: Record<string, number> = {}
      for (let i = 0; i < PUMPS.length; i++) {
        shiftDeltas[PUMPS[i].id] = pumpDelta(i, day, period)
      }

      // ── b. Compute closing pump meter values ───────────────────────────
      const closingMeters: Record<string, number> = {}
      for (const pump of PUMPS) {
        pumpMeter[pump.id] += shiftDeltas[pump.id]
        closingMeters[pump.id] = Math.round(pumpMeter[pump.id] * 100) / 100
      }

      // ── c. Fuel deliveries for this shift ──────────────────────────────
      const shiiftDeliveries = FUEL_DELIVERIES.filter(
        d => d.day === day && d.period === period
      )

      // Apply deliveries to tank levels
      for (const del of shiiftDeliveries) {
        tankLevel[TANKS[del.tankIdx].id] += del.litres
      }

      // ── d. Compute closing dip values per tank ─────────────────────────
      const closingDips: Record<string, number> = {}
      for (let t = 0; t < TANKS.length; t++) {
        const tank    = TANKS[t]
        const pumpsForTank = PUMPS.filter(p => p.tankId === tank.id)
        const delta   = pumpsForTank.reduce((s, p) => s + shiftDeltas[p.id], 0)
        const newLevel = tankLevel[tank.id] - delta + tankVariance(t, day, period)
        const clamped  = Math.max(200, Math.min(tank.capacity - 100, newLevel))
        closingDips[tank.id] = Math.round(clamped * 100) / 100
        tankLevel[tank.id]   = closingDips[tank.id]
      }

      // ── e. Compute POS lines per grade ────────────────────────────────
      const gradeDeltas: Record<string, number> = {}
      for (const tank of TANKS) {
        const pumpsForTank = PUMPS.filter(p => p.tankId === tank.id)
        const delta = pumpsForTank.reduce((s, p) => s + shiftDeltas[p.id], 0)
        gradeDeltas[tank.gradeId] = (gradeDeltas[tank.gradeId] ?? 0) + delta
      }

      const posLines: { gradeId: string; litresSold: number; revenueZar: number }[] = []
      let gradeIdx = 0
      for (const [gradeId, meterDelta] of Object.entries(gradeDeltas)) {
        const price     = FUEL_PRICES.find(fp => fp.gradeId === gradeId)!.sell
        const litres    = Math.round((meterDelta + posVariance(gradeIdx, day, period)) * 100) / 100
        const revenue   = Math.round(litres * price * 100) / 100
        posLines.push({ gradeId, litresSold: litres, revenueZar: revenue })
        gradeIdx++
      }

      // ── f. Compute product sales for this shift ───────────────────────
      const productSalesQty: Record<string, number> = {}
      for (let pi = 0; pi < PRODUCTS.length; pi++) {
        const code = PRODUCTS[pi].code
        productSalesQty[code] = productSales(pi, day, period)
      }

      // Restock on delivery days (morning shift only)
      const isRestockDay = period === 'morning' && STOCK_DELIVERY_DAYS.includes(day)

      // Compute closing stock counts
      const closingStock: Record<string, number> = {}
      for (let pi = 0; pi < PRODUCTS.length; pi++) {
        const code     = PRODUCTS[pi].code
        const restock  = isRestockDay ? RESTOCK_QTYS[pi] : 0
        const sold     = productSalesQty[code]
        const newLevel = stockLevel[code] + restock - sold
        closingStock[code] = Math.max(0, newLevel)
        stockLevel[code]   = closingStock[code]
      }

      // ── g. Insert shift ───────────────────────────────────────────────
      const startedAt   = shiftStartedAt(dateStr, period)
      const submittedAt = shiftSubmittedAt(dateStr, period)

      const { data: shift, error: shiftErr } = await db
        .from('shifts')
        .insert({
          station_id:           STATION_ID,
          supervisor_id:        supervisor.id,
          period,
          shift_date:           dateStr,
          status:               'closed',
          part:                 0,
          shift_type:           'standard',
          started_at:           startedAt,
          submitted_at:         submittedAt,
          cashier_submitted_at: submittedAt,
          is_flagged:           false,
        })
        .select('id')
        .single()
      if (shiftErr) die(`Insert shift ${dateStr} ${period}`, shiftErr.message)
      const shiftId = (shift as { id: string }).id

      // ── h. Close pump readings ────────────────────────────────────────
      const pumpReadingRows = PUMPS.map(pump => ({
        shift_id:       shiftId,
        pump_id:        pump.id,
        type:           'close',
        meter_reading:  closingMeters[pump.id],
        ocr_status:     'auto',
      }))
      const { error: prErr } = await db.from('pump_readings').insert(pumpReadingRows)
      if (prErr) die(`Insert pump readings ${dateStr} ${period}`, prErr.message)

      // ── i. Close dip readings ─────────────────────────────────────────
      const dipReadingRows = TANKS.map(tank => ({
        shift_id:  shiftId,
        tank_id:   tank.id,
        type:      'close',
        litres:    closingDips[tank.id],
      }))
      const { error: drErr } = await db.from('dip_readings').insert(dipReadingRows)
      if (drErr) die(`Insert dip readings ${dateStr} ${period}`, drErr.message)

      // ── j. Fuel deliveries ────────────────────────────────────────────
      for (const del of shiiftDeliveries) {
        const { error: delErr } = await db.from('deliveries').insert({
          station_id:           STATION_ID,
          tank_id:              TANKS[del.tankIdx].id,
          litres_received:      del.litres,
          delivery_note_number: del.note,
          driver_name:          del.driver,
          delivery_note_url:    null,
          delivered_at:         deliveryTimestamp(dateStr, del.period),
          recorded_by:          supervisor.id,
        })
        if (delErr) die(`Insert delivery ${del.note}`, delErr.message)
      }

      // ── k. Fuel POS submission + lines ────────────────────────────────
      const { data: posSubmission, error: posSubErr } = await db
        .from('pos_submissions')
        .insert({ shift_id: shiftId, photo_url: null, raw_ocr: null })
        .select('id')
        .single()
      if (posSubErr) die(`Insert pos_submission ${dateStr} ${period}`, posSubErr.message)
      const posSubmissionId = (posSubmission as { id: string }).id

      const posLineRows = posLines.map(l => ({
        pos_submission_id: posSubmissionId,
        fuel_grade_id:     l.gradeId,
        litres_sold:       l.litresSold,
        revenue_zar:       l.revenueZar,
        ocr_status:        'auto',
      }))
      const { error: posLinesErr } = await db.from('pos_submission_lines').insert(posLineRows)
      if (posLinesErr) die(`Insert pos_submission_lines ${dateStr} ${period}`, posLinesErr.message)

      // ── l. Dry-stock POS submission + lines ──────────────────────────
      const { data: dsPosSubmission, error: dsPosErr } = await db
        .from('dry_stock_pos_submissions')
        .insert({ shift_id: shiftId, photo_url: null, ocr_status: 'confirmed' })
        .select('id')
        .single()
      if (dsPosErr) die(`Insert dry_stock_pos_submission ${dateStr} ${period}`, dsPosErr.message)
      const dsPosId = (dsPosSubmission as { id: string }).id

      const dsLineRows = PRODUCTS.map(p => ({
        dry_stock_pos_submission_id: dsPosId,
        product_id:                  productIdMap[p.code],
        units_sold:                  productSalesQty[p.code],
        revenue_zar:                 Math.round(productSalesQty[p.code] * p.sell * 100) / 100,
        ocr_status:                  'confirmed',
      }))
      const { error: dsLinesErr } = await db.from('pos_dry_stock_lines').insert(dsLineRows)
      if (dsLinesErr) die(`Insert pos_dry_stock_lines ${dateStr} ${period}`, dsLinesErr.message)

      // ── m. Stock deliveries (restock day) ─────────────────────────────
      if (isRestockDay) {
        const stockDelRows = PRODUCTS.map((p, pi) => ({
          shift_id:    shiftId,
          station_id:  STATION_ID,
          product_id:  productIdMap[p.code],
          quantity:    RESTOCK_QTYS[pi],
          recorded_by: cashier.user_id,
        }))
        const { error: sdErr } = await db.from('stock_deliveries').insert(stockDelRows)
        if (sdErr) die(`Insert stock_deliveries ${dateStr} ${period}`, sdErr.message)
      }

      // ── n. Closing stock readings ─────────────────────────────────────
      const stockReadingRows = PRODUCTS.map(p => ({
        shift_id:      shiftId,
        product_id:    productIdMap[p.code],
        closing_count: closingStock[p.code],
        recorded_by:   cashier.user_id,
      }))
      const { error: srErr } = await db.from('stock_readings').insert(stockReadingRows)
      if (srErr) die(`Insert stock_readings ${dateStr} ${period}`, srErr.message)

      // ── o. Fuel reconciliation ────────────────────────────────────────
      const { error: recErr } = await runReconciliation(shiftId)
      if (recErr) {
        console.warn(`\n   ⚠ Fuel reconciliation warning ${dateStr} ${period}: ${recErr}`)
      }

      // ── p. Stock reconciliation ───────────────────────────────────────
      const { error: stockRecErr } = await runStockReconciliation(shiftId)
      if (stockRecErr) {
        console.warn(`\n   ⚠ Stock reconciliation warning ${dateStr} ${period}: ${stockRecErr}`)
      }

      const deliveryNote = shiiftDeliveries.length
        ? ` + ${shiiftDeliveries.length} delivery`
        : ''
      const restockNote  = isRestockDay ? ' + restock' : ''
      console.log(`✓${deliveryNote}${restockNote}`)
    }
  }

  // ── 9. Summary ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════')
  console.log(' Done! Summary:')
  console.log(`   Shifts:             60 (30 days × morning + evening)`)
  console.log(`   Fuel deliveries:    12 (4 per tank × 3 tanks)`)
  console.log(`   Stock restocks:     ${STOCK_DELIVERY_DAYS.length} (days ${STOCK_DELIVERY_DAYS.join(', ')})`)
  console.log(`   Products:           ${PRODUCTS.length}`)
  console.log(`   Fuel prices:        2 (95 + D10)`)
  console.log('\n   Final tank levels:')
  for (const tank of TANKS) {
    const pct = Math.round((tankLevel[tank.id] / tank.capacity) * 100)
    console.log(`     ${tank.label.padEnd(14)}: ${String(Math.round(tankLevel[tank.id])).padStart(6)} L  (${pct}%)`)
  }
  console.log('\n   Final stock levels:')
  for (const p of PRODUCTS) {
    console.log(`     ${p.code.padEnd(8)}: ${String(stockLevel[p.code]).padStart(4)} units`)
  }
  console.log('═══════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('\nUnexpected error:', err)
  process.exit(1)
})
