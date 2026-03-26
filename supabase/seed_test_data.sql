-- ============================================================
-- FuelTracker v3 — Test Seed Data
-- ============================================================
-- Run this in the Supabase SQL Editor (service role access is
-- required for auth.users inserts and to bypass RLS).
--
-- Scenarios created:
--   A: Elegant Amaglug — morning 2026-03-24 — status: approved
--      Small tank variances (≤6.5 L), D10 delivery of 8 000 L
--   B: Speedway — evening 2026-03-24 — status: flagged
--      D50 Tank 6 variance = +680 L (reason for flag)
--
-- Fixed UUIDs used throughout so this script is idempotent.
-- ============================================================


-- ── 0. Cleanup (safe to re-run) ──────────────────────────────
-- Delete in reverse dependency order (children before parents).

delete from public.ocr_overrides
  where shift_id in (
    'cccccccc-cccc-cccc-cccc-000000000001',
    'cccccccc-cccc-cccc-cccc-000000000002'
  );

delete from public.reconciliation_grade_lines
  where reconciliation_id in (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-000000000002'
  );

delete from public.reconciliation_tank_lines
  where reconciliation_id in (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-000000000002'
  );

delete from public.reconciliations
  where id in (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-000000000002'
  );

delete from public.pos_submission_lines
  where pos_submission_id in (
    'ffffffff-ffff-ffff-ffff-000000000001',
    'ffffffff-ffff-ffff-ffff-000000000002'
  );

delete from public.pos_submissions
  where id in (
    'ffffffff-ffff-ffff-ffff-000000000001',
    'ffffffff-ffff-ffff-ffff-000000000002'
  );

delete from public.pump_readings
  where shift_id in (
    'cccccccc-cccc-cccc-cccc-000000000001',
    'cccccccc-cccc-cccc-cccc-000000000002'
  );

delete from public.dip_readings
  where shift_id in (
    'cccccccc-cccc-cccc-cccc-000000000001',
    'cccccccc-cccc-cccc-cccc-000000000002'
  );

delete from public.deliveries
  where id = 'eeeeeeee-eeee-eeee-eeee-000000000001';

delete from public.shifts
  where id in (
    'cccccccc-cccc-cccc-cccc-000000000001',
    'cccccccc-cccc-cccc-cccc-000000000002'
  );

delete from public.fuel_prices
  where id in (
    'dddddddd-dddd-dddd-dddd-000000000001',
    'dddddddd-dddd-dddd-dddd-000000000002',
    'dddddddd-dddd-dddd-dddd-000000000003',
    'dddddddd-dddd-dddd-dddd-000000000004'
  );

delete from public.user_profiles
  where id in (
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000003',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000004',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000005'
  );

delete from auth.users
  where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000004',
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000005'
  );


-- ── 1. Auth users ────────────────────────────────────────────
-- Password for all test accounts: TestPass123!

insert into auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  -- Attendant 1 — Elegant Amaglug
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'att.amaglug@test.ft',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  -- Supervisor 1 — Elegant Amaglug
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'sup.amaglug@test.ft',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  -- Attendant 2 — Speedway
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'att.speedway@test.ft',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  -- Supervisor 2 — Speedway
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'sup.speedway@test.ft',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  ),
  -- Owner
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner@test.ft',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );


-- ── 2. User profiles ─────────────────────────────────────────

insert into public.user_profiles (id, user_id, role, station_id, is_active) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'attendant',  'a1000000-0000-0000-0000-000000000001', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'supervisor', 'a1000000-0000-0000-0000-000000000001', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'attendant',  'b1000000-0000-0000-0000-000000000001', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000004', 'supervisor', 'b1000000-0000-0000-0000-000000000001', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005', 'owner',      null,                                  true);


-- ── 3. Fuel prices (effective 2026-03-01) ────────────────────

insert into public.fuel_prices (id, fuel_grade_id, price_per_litre, effective_from, set_by) values
  ('dddddddd-dddd-dddd-dddd-000000000001', '95',  21.9300, '2026-03-01T00:00:00Z', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005'),
  ('dddddddd-dddd-dddd-dddd-000000000002', '93',  21.5400, '2026-03-01T00:00:00Z', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005'),
  ('dddddddd-dddd-dddd-dddd-000000000003', 'D10', 19.7900, '2026-03-01T00:00:00Z', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005'),
  ('dddddddd-dddd-dddd-dddd-000000000004', 'D50', 19.3800, '2026-03-01T00:00:00Z', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005');


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO A — Elegant Amaglug, morning, 2026-03-24 (approved)
--
-- Tanks / Pumps (from station seed):
--   Tank a1100000-...0001  95   Pumps 1-6  (a1200000-...0001..0006)
--   Tank a1100000-...0002  D10  Pumps 7-12 (a1200000-...0007..000c)
--   Tank a1100000-...0003  D10  Pumps 13-18(a1200000-...000d..0012)
--
-- D10 delivery of 8 000 L on Tank 2 at 09:15.
--
-- Pump-vs-POS variance: 0.00 L for both grades (meters match POS)
-- Tank inventory variances: 95 +6.20 L / D10 Tank2 +6.50 L / D10 Tank3 +3.40 L
-- Revenue variance: R2.34 loss (POS rounding)
-- ═══════════════════════════════════════════════════════════════

-- ── 4A. Shift ────────────────────────────────────────────────

insert into public.shifts (id, station_id, attendant_id, period, shift_date, status, submitted_at) values
  (
    'cccccccc-cccc-cccc-cccc-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
    'morning',
    '2026-03-24',
    'approved',
    '2026-03-24T14:32:00Z'
  );


-- ── 5A. Opening dip readings ─────────────────────────────────

insert into public.dip_readings (shift_id, tank_id, type, litres) values
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000001', 'open', 18500.00),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000002', 'open', 24000.00),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000003', 'open', 27000.00);


-- ── 6A. Opening pump readings ────────────────────────────────
-- ocr_status 'auto' = OCR extracted and attendant confirmed

insert into public.pump_readings (shift_id, pump_id, type, meter_reading, ocr_status) values
  -- Pumps 1-6 → Tank 1 (95)
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000001', 'open', 124856.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000002', 'open',  98234.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000003', 'open', 203451.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000004', 'open', 178920.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000005', 'open',  87340.00, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000006', 'open', 145678.90, 'auto'),
  -- Pumps 7-12 → Tank 2 (D10)
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000007', 'open', 211456.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000008', 'open', 156789.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000009', 'open',  98543.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000010', 'open', 302145.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000011', 'open',  74231.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000012', 'open', 189876.40, 'auto'),
  -- Pumps 13-18 → Tank 3 (D10)
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000013', 'open', 267834.50, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000014', 'open', 143290.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000015', 'open',  58732.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000016', 'open', 196451.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000017', 'open', 312098.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000018', 'open',  89567.40, 'auto');


-- ── 7A. Delivery (09:15, Tank 2 D10) ────────────────────────

insert into public.deliveries (id, station_id, tank_id, litres_received, delivered_at, recorded_by) values
  (
    'eeeeeeee-eeee-eeee-eeee-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000002',
    8000.00,
    '2026-03-24T09:15:00Z',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000002'  -- supervisor
  );


-- ── 8A. Closing pump readings ────────────────────────────────
-- Deltas: Pumps 1-6 (95) = 1 245.80 L total
--         Pumps 7-12 (D10 Tank2) = 1 100.00 L total
--         Pumps 13-18 (D10 Tank3) = 1 052.60 L total

insert into public.pump_readings (shift_id, pump_id, type, meter_reading, ocr_status) values
  -- Pumps 1-6 → Tank 1 (95)  [deltas: 185.40, 212.60, 198.20, 225.80, 198.90, 224.90]
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000001', 'close', 125041.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000002', 'close',  98446.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000003', 'close', 203650.00, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000004', 'close', 179146.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000005', 'close',  87538.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000006', 'close', 145903.80, 'auto'),
  -- Pumps 7-12 → Tank 2 (D10)  [deltas: 187.50, 176.30, 189.40, 198.70, 165.40, 182.70]
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000007', 'close', 211643.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000008', 'close', 156965.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000009', 'close',  98733.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000010', 'close', 302343.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000011', 'close',  74397.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000012', 'close', 190059.10, 'auto'),
  -- Pumps 13-18 → Tank 3 (D10)  [deltas: 178.60, 188.40, 172.90, 175.30, 163.80, 173.60]
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000013', 'close', 268013.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000014', 'close', 143479.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000015', 'close',  58905.00, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000016', 'close', 196626.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000017', 'close', 312262.50, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1200000-0000-0000-0000-000000000018', 'close',  89741.00, 'auto');


-- ── 9A. Closing dip readings ─────────────────────────────────
-- Expected vs actual:
--   Tank 1 (95):  18500 - 1245.80        = 17254.20 expected | 17248.00 actual → +6.20 L loss
--   Tank 2 (D10): 24000 + 8000 - 1100.00 = 30900.00 expected | 30893.50 actual → +6.50 L loss
--   Tank 3 (D10): 27000 - 1052.60        = 25947.40 expected | 25944.00 actual → +3.40 L loss

insert into public.dip_readings (shift_id, tank_id, type, litres) values
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000001', 'close', 17248.00),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000002', 'close', 30893.50),
  ('cccccccc-cccc-cccc-cccc-000000000001', 'a1100000-0000-0000-0000-000000000003', 'close', 25944.00);


-- ── 10A. POS submission + lines ──────────────────────────────
-- 95:  1 245.80 L × R21.93 = R27 320.39 expected | POS reports R27 318.00 → R2.39 revenue loss
-- D10: 2 152.60 L × R19.79 = R42 599.95 expected | POS reports R42 600.00 → R0.05 revenue gain

insert into public.pos_submissions (id, shift_id) values
  ('ffffffff-ffff-ffff-ffff-000000000001', 'cccccccc-cccc-cccc-cccc-000000000001');

insert into public.pos_submission_lines (pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status) values
  ('ffffffff-ffff-ffff-ffff-000000000001', '95',  1245.80, 27318.00, 'auto'),
  ('ffffffff-ffff-ffff-ffff-000000000001', 'D10', 2152.60, 42600.00, 'auto');


-- ── 11A. Reconciliation ──────────────────────────────────────
-- expected_revenue  = (1245.80 × 21.93) + (2152.60 × 19.79) = 27320.39 + 42599.95 = 69920.34
-- pos_revenue       = 27318.00 + 42600.00                                           = 69918.00
-- revenue_variance  = 69920.34 - 69918.00                                           =     2.34

insert into public.reconciliations (id, shift_id, expected_revenue, pos_revenue, revenue_variance) values
  ('11111111-1111-1111-1111-000000000001', 'cccccccc-cccc-cccc-cccc-000000000001', 69920.34, 69918.00, 2.34);

-- Tank lines (Formula 1)
insert into public.reconciliation_tank_lines
  (reconciliation_id, tank_id, opening_dip, deliveries_received, pos_litres_sold, expected_closing_dip, actual_closing_dip, variance_litres)
values
  -- Tank 1 (95)
  ('11111111-1111-1111-1111-000000000001', 'a1100000-0000-0000-0000-000000000001', 18500.00,    0.00, 1245.80, 17254.20, 17248.00,  6.20),
  -- Tank 2 (D10) — includes 8 000 L delivery
  ('11111111-1111-1111-1111-000000000001', 'a1100000-0000-0000-0000-000000000002', 24000.00, 8000.00, 1100.00, 30900.00, 30893.50,  6.50),
  -- Tank 3 (D10)
  ('11111111-1111-1111-1111-000000000001', 'a1100000-0000-0000-0000-000000000003', 27000.00,    0.00, 1052.60, 25947.40, 25944.00,  3.40);

-- Grade lines (Formula 2)
insert into public.reconciliation_grade_lines
  (reconciliation_id, fuel_grade_id, meter_delta, pos_litres_sold, variance_litres)
values
  ('11111111-1111-1111-1111-000000000001', '95',  1245.80, 1245.80, 0.00),
  ('11111111-1111-1111-1111-000000000001', 'D10', 2152.60, 2152.60, 0.00);


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO B — Speedway, evening, 2026-03-24 (flagged)
--
-- Tanks / Pumps (from station seed):
--   Tank b1100000-...0001  95   Pumps  1-6  (b1200000-...0001..0006)
--   Tank b1100000-...0002  95   Pumps  7-12 (b1200000-...0007..000c)
--   Tank b1100000-...0003  95   Pumps 13-18 (b1200000-...000d..0012)
--   Tank b1100000-...0004  93   Pumps 19-24 (b1200000-...0013..0018)
--   Tank b1100000-...0005  D50  Pumps 25-30 (b1200000-...0019..001e)
--   Tank b1100000-...0006  D50  Pumps 31-36 (b1200000-...001f..0024)
--
-- Pump-vs-POS variance: 0.00 L across all grades
-- D50 Tank 6 variance = +680 L loss — flagged for investigation
-- Revenue variance: R0.00 (POS figures are correct)
-- ═══════════════════════════════════════════════════════════════

-- ── 4B. Shift ────────────────────────────────────────────────

insert into public.shifts (id, station_id, attendant_id, period, shift_date, status, submitted_at, flag_comment) values
  (
    'cccccccc-cccc-cccc-cccc-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-000000000003',
    'evening',
    '2026-03-24',
    'flagged',
    '2026-03-24T22:47:00Z',
    'D50 Tank 6 shows 680 L unaccounted loss. Possible meter fault on Pump 35 or delivery note discrepancy. Requires physical investigation.'
  );


-- ── 5B. Opening dip readings ─────────────────────────────────

insert into public.dip_readings (shift_id, tank_id, type, litres) values
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000001', 'open', 21400.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000002', 'open', 19800.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000003', 'open', 17200.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000004', 'open', 20100.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000005', 'open', 16500.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000006', 'open', 18750.00);


-- ── 6B. Opening pump readings ────────────────────────────────

insert into public.pump_readings (shift_id, pump_id, type, meter_reading, ocr_status) values
  -- Pumps 1-6 → Tank 1 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000001', 'open', 287234.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000002', 'open', 134567.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000003', 'open',  56789.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000004', 'open', 201345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000005', 'open', 167890.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000006', 'open',  98456.70, 'auto'),
  -- Pumps 7-12 → Tank 2 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000007', 'open', 145678.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000008', 'open',  92345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000009', 'open', 178234.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000010', 'open',  67890.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000011', 'open', 213456.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000012', 'open', 124567.80, 'auto'),
  -- Pumps 13-18 → Tank 3 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000013', 'open',  89345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000014', 'open', 167234.50, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000015', 'open', 234567.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000016', 'open',  78901.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000017', 'open', 145678.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000018', 'open', 112345.60, 'auto'),
  -- Pumps 19-24 → Tank 4 (93)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000019', 'open', 145234.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000020', 'open',  89678.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000021', 'open', 178345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000022', 'open', 234567.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000023', 'open',  67890.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000024', 'open', 156789.20, 'auto'),
  -- Pumps 25-30 → Tank 5 (D50)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000025', 'open', 334567.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000026', 'open', 289345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000027', 'open', 367890.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000028', 'open', 245678.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000029', 'open', 412456.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000030', 'open', 298234.50, 'auto'),
  -- Pumps 31-36 → Tank 6 (D50)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000031', 'open', 278345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000032', 'open', 334678.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000033', 'open', 256789.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000034', 'open', 389345.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000035', 'open', 223456.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000036', 'open', 367890.30, 'auto');


-- ── 8B. Closing pump readings ────────────────────────────────
-- 95  Tank1: 155+162+158+160+157+158 = 950 L
-- 95  Tank2: 159+155+163+157+158+158 = 950 L
-- 95  Tank3: 156+159+154+157+156+158 = 940 L  → total 95: 2 840 L
-- 93  Tank4: 187+186+188+186+187+186 = 1 120 L
-- D50 Tank5: 141+140+140+140+139+140 = 840 L
-- D50 Tank6: 141+140+140+140+139+140 = 840 L  → total D50: 1 680 L

insert into public.pump_readings (shift_id, pump_id, type, meter_reading, ocr_status) values
  -- Pumps 1-6 → Tank 1 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000001', 'close', 287389.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000002', 'close', 134729.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000003', 'close',  56947.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000004', 'close', 201505.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000005', 'close', 168047.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000006', 'close',  98614.70, 'auto'),
  -- Pumps 7-12 → Tank 2 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000007', 'close', 145837.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000008', 'close',  92500.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000009', 'close', 178397.10, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000010', 'close',  68047.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000011', 'close', 213614.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000012', 'close', 124725.80, 'auto'),
  -- Pumps 13-18 → Tank 3 (95)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000013', 'close',  89501.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000014', 'close', 167393.50, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000015', 'close', 234721.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000016', 'close',  79058.20, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000017', 'close', 145834.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000018', 'close', 112503.60, 'auto'),
  -- Pumps 19-24 → Tank 4 (93)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000019', 'close', 145421.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000020', 'close',  89864.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000021', 'close', 178533.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000022', 'close', 234753.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000023', 'close',  68077.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000024', 'close', 156975.20, 'auto'),
  -- Pumps 25-30 → Tank 5 (D50)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000025', 'close', 334708.80, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000026', 'close', 289485.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000027', 'close', 368030.30, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000028', 'close', 245818.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000029', 'close', 412595.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000030', 'close', 298374.50, 'auto'),
  -- Pumps 31-36 → Tank 6 (D50)
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000031', 'close', 278486.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000032', 'close', 334818.90, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000033', 'close', 256929.40, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000034', 'close', 389485.60, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000035', 'close', 223595.70, 'auto'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1200000-0000-0000-0000-000000000036', 'close', 368030.30, 'auto');


-- ── 9B. Closing dip readings ─────────────────────────────────
-- Tank 1 (95):  21400 - 950  = 20450 expected | 20421 actual → +29.00 L loss
-- Tank 2 (95):  19800 - 950  = 18850 expected | 18846 actual →  +4.00 L loss
-- Tank 3 (95):  17200 - 940  = 16260 expected | 16293 actual → -33.00 L gain
-- Tank 4 (93):  20100 - 1120 = 18980 expected | 18981 actual →  -1.00 L gain
-- Tank 5 (D50): 16500 - 840  = 15660 expected | 15680 actual → -20.00 L gain
-- Tank 6 (D50): 18750 - 840  = 17910 expected | 17230 actual → +680.00 L LOSS ← flagged

insert into public.dip_readings (shift_id, tank_id, type, litres) values
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000001', 'close', 20421.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000002', 'close', 18846.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000003', 'close', 16293.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000004', 'close', 18981.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000005', 'close', 15680.00),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'b1100000-0000-0000-0000-000000000006', 'close', 17230.00);


-- ── 10B. POS submission + lines ──────────────────────────────
-- 95:  2840 L × R21.93 = R62 281.20
-- 93:  1120 L × R21.54 = R24 124.80
-- D50: 1680 L × R19.38 = R32 558.40

insert into public.pos_submissions (id, shift_id) values
  ('ffffffff-ffff-ffff-ffff-000000000002', 'cccccccc-cccc-cccc-cccc-000000000002');

insert into public.pos_submission_lines (pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status) values
  ('ffffffff-ffff-ffff-ffff-000000000002', '95',  2840.00, 62281.20, 'auto'),
  ('ffffffff-ffff-ffff-ffff-000000000002', '93',  1120.00, 24124.80, 'auto'),
  ('ffffffff-ffff-ffff-ffff-000000000002', 'D50', 1680.00, 32558.40, 'auto');


-- ── 11B. Reconciliation ──────────────────────────────────────
-- expected_revenue = 62281.20 + 24124.80 + 32558.40 = 118964.40
-- pos_revenue      = 62281.20 + 24124.80 + 32558.40 = 118964.40
-- revenue_variance = 0.00  (POS figures are correct; D50 loss is physical, not financial)

insert into public.reconciliations (id, shift_id, expected_revenue, pos_revenue, revenue_variance) values
  ('11111111-1111-1111-1111-000000000002', 'cccccccc-cccc-cccc-cccc-000000000002', 118964.40, 118964.40, 0.00);

-- Tank lines (Formula 1)
insert into public.reconciliation_tank_lines
  (reconciliation_id, tank_id, opening_dip, deliveries_received, pos_litres_sold, expected_closing_dip, actual_closing_dip, variance_litres)
values
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000001', 21400.00, 0, 950.00,  20450.00, 20421.00,   29.00),
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000002', 19800.00, 0, 950.00,  18850.00, 18846.00,    4.00),
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000003', 17200.00, 0, 940.00,  16260.00, 16293.00,  -33.00),
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000004', 20100.00, 0, 1120.00, 18980.00, 18981.00,   -1.00),
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000005', 16500.00, 0, 840.00,  15660.00, 15680.00,  -20.00),
  ('11111111-1111-1111-1111-000000000002', 'b1100000-0000-0000-0000-000000000006', 18750.00, 0, 840.00,  17910.00, 17230.00,  680.00);  -- ← flag trigger

-- Grade lines (Formula 2)
insert into public.reconciliation_grade_lines
  (reconciliation_id, fuel_grade_id, meter_delta, pos_litres_sold, variance_litres)
values
  ('11111111-1111-1111-1111-000000000002', '95',  2840.00, 2840.00, 0.00),
  ('11111111-1111-1111-1111-000000000002', '93',  1120.00, 1120.00, 0.00),
  ('11111111-1111-1111-1111-000000000002', 'D50', 1680.00, 1680.00, 0.00);


-- ── Done ─────────────────────────────────────────────────────
-- Test accounts (password: TestPass123!):
--   att.amaglug@test.ft  — attendant, Elegant Amaglug
--   sup.amaglug@test.ft  — supervisor, Elegant Amaglug
--   att.speedway@test.ft — attendant, Speedway
--   sup.speedway@test.ft — supervisor, Speedway
--   owner@test.ft        — owner, all stations
