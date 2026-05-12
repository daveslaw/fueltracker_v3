-- ═══════════════════════════════════════════════════════════════════════════
-- seed-amaglug-month.sql
--
-- Seeds April 2026 (60 shifts) for Elegant Amaglug directly in Supabase.
-- Paste this entire script into the Supabase SQL editor and click Run.
--
-- Prerequisites:
--   • At least one active supervisor + one active cashier assigned to Amaglug
--     (station_id = a1000000-0000-0000-0000-000000000001)
--   • All migrations applied
--
-- Safe to re-run: clears April 2026 shifts/deliveries/baselines first.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── Station ────────────────────────────────────────────────────────────────
  c_station_id    constant uuid   := 'a1000000-0000-0000-0000-000000000001';

  c_tank_ids      constant uuid[] := ARRAY[
    'a1100000-0000-0000-0000-000000000001'::uuid,   -- Tank 1: 95
    'a1100000-0000-0000-0000-000000000002'::uuid,   -- Tank 2: D10
    'a1100000-0000-0000-0000-000000000003'::uuid    -- Tank 3: D10
  ];
  c_tank_grades   constant text[]    := ARRAY['95', 'D10', 'D10'];
  c_tank_caps     constant numeric[] := ARRAY[30000, 31000, 31000];

  -- ── Fuel prices ────────────────────────────────────────────────────────────
  c_sell_95       constant numeric := 21.9500;
  c_sell_d10      constant numeric := 20.2100;
  c_cost_95       constant numeric := 19.5000;
  c_cost_d10      constant numeric := 17.8000;

  -- ── Products ───────────────────────────────────────────────────────────────
  c_codes     constant text[]    := ARRAY['RB-250','MON-500','SIM-125','LAY-100','FAN-2L',
                                          'COK-2L','CAS-1L','LS-20','CAD-90','STIM-23'];
  c_descs     constant text[]    := ARRAY['Red Bull 250ml','Monster Energy 500ml',
                                          'Simba Chips 125g','Lay''s Chips 100g','Fanta Orange 2L',
                                          'Coca-Cola 2L','Castrol GTX 1L','Lucky Strike 20s',
                                          'Cadbury Slab 90g','Stimorol Gum 23g'];
  c_costs     constant numeric[] := ARRAY[22,28,8,7,14,16,85,45,22,9]::numeric[];
  c_sells     constant numeric[] := ARRAY[35,42,13.99,12.99,22.99,24.99,129.99,64.99,34.99,14.99]::numeric[];
  c_base_sales constant int[]    := ARRAY[3,2,7,5,2,2,1,4,3,5];
  c_restock   constant int[]     := ARRAY[96,72,288,240,48,48,24,120,96,144];

  -- ── Initial simulation state ───────────────────────────────────────────────
  -- Pump meters at start of April 1 morning (18 pumps, 15 000 L apart)
  c_init_meters constant numeric[] := ARRAY[
    400000,415000,430000,445000,460000,475000,   -- pumps  1-6  (95)
    490000,505000,520000,535000,550000,565000,   -- pumps  7-12 (D10 tank2)
    580000,595000,610000,625000,640000,655000    -- pumps 13-18 (D10 tank3)
  ]::numeric[];
  -- Tank dip levels at start of April 1 morning
  c_init_dips   constant numeric[] := ARRAY[20000, 19500, 22000]::numeric[];
  -- Closing stock counts at start of April 1 morning
  c_init_stock  constant numeric[] := ARRAY[48,36,120,96,24,24,12,60,48,72]::numeric[];

  -- ── Mutable simulation state ───────────────────────────────────────────────
  v_meters     numeric[] := ARRAY[400000,415000,430000,445000,460000,475000,
                                  490000,505000,520000,535000,550000,565000,
                                  580000,595000,610000,625000,640000,655000]::numeric[];
  v_dips       numeric[] := ARRAY[20000, 19500, 22000]::numeric[];
  v_stock      numeric[] := ARRAY[48,36,120,96,24,24,12,60,48,72]::numeric[];

  -- Captured at shift start for reconciliation
  v_open_dips  numeric[] := ARRAY[0,0,0]::numeric[];
  v_open_stock numeric[] := ARRAY[0,0,0,0,0,0,0,0,0,0]::numeric[];

  -- Per-shift arrays
  v_deltas     numeric[] := ARRAY[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]::numeric[];
  v_units_arr  int[]     := ARRAY[0,0,0,0,0,0,0,0,0,0];

  -- ── User IDs ───────────────────────────────────────────────────────────────
  v_sup_id        uuid;     -- user_profiles.id  (profile UUID)
  v_sup_user_id   uuid;     -- user_profiles.user_id  (auth UUID)
  v_csh_id        uuid;
  v_csh_user_id   uuid;

  -- ── Product IDs ────────────────────────────────────────────────────────────
  v_pids       uuid[] := ARRAY[]::uuid[];
  v_tmp_uuid   uuid;

  -- ── Row IDs from INSERTs ───────────────────────────────────────────────────
  v_shift_id   uuid;
  v_pos_id     uuid;
  v_ds_id      uuid;
  v_rec_id     uuid;

  -- ── Loop / shift vars ──────────────────────────────────────────────────────
  v_day        int;
  v_period     text;
  v_pidx       int;
  v_date_str   text;
  v_started    timestamptz;
  v_submitted  timestamptz;
  v_is_restock boolean;

  -- ── Per-shift computed scalars ─────────────────────────────────────────────
  v_del_1      numeric := 0;
  v_del_2      numeric := 0;
  v_del_3      numeric := 0;
  v_95_delta   numeric;
  v_d10_delta  numeric;
  v_95_L       numeric;
  v_d10_L      numeric;
  v_95_rev     numeric;
  v_d10_rev    numeric;

  -- ── Inner-loop indices ─────────────────────────────────────────────────────
  i int;  t int;  p int;

  -- ── Scratch ────────────────────────────────────────────────────────────────
  v_tank_delta numeric;
  v_new_level  numeric;
  v_units      int;
  v_restock    int;

BEGIN

  -- ── 1. Resolve users ────────────────────────────────────────────────────────
  SELECT id, user_id INTO v_sup_id, v_sup_user_id
    FROM user_profiles
   WHERE station_id = c_station_id AND role = 'supervisor' AND is_active = true
   LIMIT 1;
  IF v_sup_id IS NULL THEN
    RAISE EXCEPTION 'No active supervisor for Amaglug — create one first';
  END IF;

  SELECT id, user_id INTO v_csh_id, v_csh_user_id
    FROM user_profiles
   WHERE station_id = c_station_id AND role = 'cashier' AND is_active = true
   LIMIT 1;
  IF v_csh_id IS NULL THEN
    RAISE EXCEPTION 'No active cashier for Amaglug — create one first';
  END IF;

  RAISE NOTICE 'Users resolved: supervisor=%, cashier=%', v_sup_id, v_csh_id;

  -- ── 2. Clear April 2026 data ─────────────────────────────────────────────
  DELETE FROM shifts
   WHERE station_id = c_station_id
     AND shift_date BETWEEN '2026-04-01' AND '2026-04-30';

  DELETE FROM deliveries
   WHERE station_id = c_station_id
     AND delivered_at BETWEEN '2026-04-01T00:00:00Z' AND '2026-04-30T23:59:59Z';

  RAISE NOTICE 'Cleared existing April 2026 data';

  -- ── 3. Fuel prices (insert if missing) ──────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM fuel_prices
                  WHERE station_id = c_station_id AND fuel_grade_id = '95' AND valid_to IS NULL) THEN
    INSERT INTO fuel_prices (station_id, fuel_grade_id, sell_price_per_litre, cost_per_litre, valid_from, valid_to, set_by)
    VALUES (c_station_id, '95',  c_sell_95,  c_cost_95,  '2026-01-01T00:00:00Z', NULL, v_sup_user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fuel_prices
                  WHERE station_id = c_station_id AND fuel_grade_id = 'D10' AND valid_to IS NULL) THEN
    INSERT INTO fuel_prices (station_id, fuel_grade_id, sell_price_per_litre, cost_per_litre, valid_from, valid_to, set_by)
    VALUES (c_station_id, 'D10', c_sell_d10, c_cost_d10, '2026-01-01T00:00:00Z', NULL, v_sup_user_id);
  END IF;

  RAISE NOTICE 'Fuel prices done';

  -- ── 4. Products (upsert by stock_code) ──────────────────────────────────
  FOR p IN 1..10 LOOP
    SELECT id INTO v_tmp_uuid
      FROM products
     WHERE station_id = c_station_id AND stock_code = c_codes[p]
     LIMIT 1;

    IF v_tmp_uuid IS NULL THEN
      INSERT INTO products (station_id, stock_code, description, is_active)
      VALUES (c_station_id, c_codes[p], c_descs[p], true)
      RETURNING id INTO v_tmp_uuid;
    END IF;

    v_pids := array_append(v_pids, v_tmp_uuid);
  END LOOP;

  RAISE NOTICE 'Products done: % items', array_length(v_pids, 1);

  -- ── 5. Product prices (insert if missing) ────────────────────────────────
  FOR p IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM product_prices
                    WHERE product_id = v_pids[p] AND station_id = c_station_id AND valid_to IS NULL) THEN
      INSERT INTO product_prices (product_id, station_id, cost_price, sell_price, valid_from, valid_to, set_by)
      VALUES (v_pids[p], c_station_id, c_costs[p], c_sells[p], '2026-01-01T00:00:00Z', NULL, v_sup_user_id);
    END IF;
  END LOOP;

  RAISE NOTICE 'Product prices done';

  -- ── 6. Shift baselines (delete + re-insert) ───────────────────────────────
  DELETE FROM shift_baselines WHERE station_id = c_station_id;

  FOR i IN 1..18 LOOP
    INSERT INTO shift_baselines (station_id, pump_id, tank_id, reading_type, value, set_by)
    VALUES (c_station_id,
            ('a1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
            NULL, 'meter', c_init_meters[i], v_sup_id);
  END LOOP;

  FOR t IN 1..3 LOOP
    INSERT INTO shift_baselines (station_id, pump_id, tank_id, reading_type, value, set_by)
    VALUES (c_station_id, NULL, c_tank_ids[t], 'dip', c_init_dips[t], v_sup_id);
  END LOOP;

  RAISE NOTICE 'Shift baselines done';

  -- ── 7. Stock baselines (delete + re-insert) ───────────────────────────────
  DELETE FROM stock_baselines WHERE station_id = c_station_id;

  FOR p IN 1..10 LOOP
    INSERT INTO stock_baselines (station_id, product_id, quantity, set_by)
    VALUES (c_station_id, v_pids[p], c_init_stock[p], v_csh_user_id);
  END LOOP;

  RAISE NOTICE 'Stock baselines done';

  -- ── 8. Main loop: 30 days × 2 periods ─────────────────────────────────────
  RAISE NOTICE 'Starting shift loop…';

  FOR v_day IN 1..30 LOOP
    v_date_str := '2026-04-' || lpad(v_day::text, 2, '0');

    FOR v_pidx IN 1..2 LOOP
      v_period := CASE v_pidx WHEN 1 THEN 'morning' ELSE 'evening' END;

      -- Timestamps (SAST = UTC+2)
      IF v_period = 'morning' THEN
        v_started   := (v_date_str || 'T04:00:00Z')::timestamptz;
        v_submitted := (v_date_str || 'T12:00:00Z')::timestamptz;
      ELSE
        v_started   := (v_date_str || 'T12:00:00Z')::timestamptz;
        v_submitted := (v_date_str || 'T20:00:00Z')::timestamptz;
      END IF;

      -- Capture openings for reconciliation
      v_open_dips  := v_dips;
      v_open_stock := v_stock;

      -- ── Pump deltas ────────────────────────────────────────────────────────
      -- pumpIdx (0-based) maps to array index i (1-based)
      -- Grade: pumps 1-6 → 95 (base 160 L), pumps 7-18 → D10 (base 180 L)
      FOR i IN 1..18 LOOP
        v_deltas[i] := (CASE WHEN i <= 6 THEN 160 ELSE 180 END)
          + ((v_day * 11 + (i-1) * 17
             + CASE WHEN v_period = 'evening' THEN 37 ELSE 0 END) % 55);
      END LOOP;

      -- ── Fuel deliveries ────────────────────────────────────────────────────
      v_del_1 := 0;  v_del_2 := 0;  v_del_3 := 0;

      -- Tank 1 (95): days 6(m), 14(e), 22(m), 29(m)
      IF (v_period = 'morning' AND v_day IN (6, 22, 29))
      OR (v_period = 'evening' AND v_day = 14) THEN
        v_del_1     := 18000;
        v_dips[1]   := v_dips[1] + 18000;
        INSERT INTO deliveries
          (station_id, tank_id, litres_received, delivery_note_number, driver_name,
           delivery_note_url, delivered_at, recorded_by)
        VALUES (c_station_id, c_tank_ids[1], 18000,
          CASE v_day WHEN 6 THEN 'DN-2604-001' WHEN 14 THEN 'DN-2604-002'
                     WHEN 22 THEN 'DN-2604-003' WHEN 29 THEN 'DN-2604-004' END,
          CASE v_day WHEN 6 THEN 'Sipho Nkosi' WHEN 14 THEN 'Bongani Dlamini'
                     WHEN 22 THEN 'Sipho Nkosi'  WHEN 29 THEN 'Thabo Mokoena' END,
          NULL,
          (v_date_str || CASE WHEN v_period='morning' THEN 'T08:00:00Z' ELSE 'T14:00:00Z' END)::timestamptz,
          v_sup_id);
      END IF;

      -- Tank 2 (D10): days 5(e), 13(m), 20(e), 28(m)
      IF (v_period = 'evening' AND v_day IN (5, 20))
      OR (v_period = 'morning' AND v_day IN (13, 28)) THEN
        v_del_2   := 18000;
        v_dips[2] := v_dips[2] + 18000;
        INSERT INTO deliveries
          (station_id, tank_id, litres_received, delivery_note_number, driver_name,
           delivery_note_url, delivered_at, recorded_by)
        VALUES (c_station_id, c_tank_ids[2], 18000,
          CASE v_day WHEN 5  THEN 'DN-2604-005' WHEN 13 THEN 'DN-2604-006'
                     WHEN 20 THEN 'DN-2604-007' WHEN 28 THEN 'DN-2604-008' END,
          CASE v_day WHEN 5  THEN 'Thabo Mokoena' WHEN 13 THEN 'Sipho Nkosi'
                     WHEN 20 THEN 'Bongani Dlamini' WHEN 28 THEN 'Sipho Nkosi' END,
          NULL,
          (v_date_str || CASE WHEN v_period='morning' THEN 'T08:00:00Z' ELSE 'T14:00:00Z' END)::timestamptz,
          v_sup_id);
      END IF;

      -- Tank 3 (D10): days 7(m), 15(e), 23(m), 29(e)
      IF (v_period = 'morning' AND v_day IN (7, 23))
      OR (v_period = 'evening' AND v_day IN (15, 29)) THEN
        v_del_3   := 18000;
        v_dips[3] := v_dips[3] + 18000;
        INSERT INTO deliveries
          (station_id, tank_id, litres_received, delivery_note_number, driver_name,
           delivery_note_url, delivered_at, recorded_by)
        VALUES (c_station_id, c_tank_ids[3], 18000,
          CASE v_day WHEN 7  THEN 'DN-2604-009' WHEN 15 THEN 'DN-2604-010'
                     WHEN 23 THEN 'DN-2604-011' WHEN 29 THEN 'DN-2604-012' END,
          CASE v_day WHEN 7  THEN 'Bongani Dlamini' WHEN 15 THEN 'Thabo Mokoena'
                     WHEN 23 THEN 'Sipho Nkosi'       WHEN 29 THEN 'Bongani Dlamini' END,
          NULL,
          (v_date_str || CASE WHEN v_period='morning' THEN 'T08:00:00Z' ELSE 'T14:00:00Z' END)::timestamptz,
          v_sup_id);
      END IF;

      -- ── Closing dip per tank ───────────────────────────────────────────────
      -- Formula: new_level = (dip_after_delivery) − meter_delta + small_variance
      FOR t IN 1..3 LOOP
        v_tank_delta := 0;
        FOR i IN 1..18 LOOP
          IF (i - 1) / 6 + 1 = t THEN        -- integer division: pumps 1-6→1, 7-12→2, 13-18→3
            v_tank_delta := v_tank_delta + v_deltas[i];
          END IF;
        END LOOP;

        v_new_level := v_dips[t] - v_tank_delta
          + (((v_day * 31 + (t-1) * 19
             + CASE WHEN v_period = 'evening' THEN 11 ELSE 0 END) % 25) - 12);

        v_dips[t] := GREATEST(200, LEAST(c_tank_caps[t] - 100, ROUND(v_new_level, 2)));
      END LOOP;

      -- ── Update pump meters to closing values ───────────────────────────────
      FOR i IN 1..18 LOOP
        v_meters[i] := v_meters[i] + v_deltas[i];
      END LOOP;

      -- ── Grade-level aggregates for fuel POS ────────────────────────────────
      v_95_delta  := 0;  v_d10_delta := 0;
      FOR i IN 1..18 LOOP
        IF i <= 6 THEN v_95_delta  := v_95_delta  + v_deltas[i];
        ELSE            v_d10_delta := v_d10_delta + v_deltas[i];
        END IF;
      END LOOP;

      -- POS litres = meter delta + small variance (−4 to +4 L per grade)
      v_95_L  := ROUND((v_95_delta  + ((v_day*23 + 0  + CASE WHEN v_period='evening' THEN 7 ELSE 0 END) % 9 - 4))::numeric, 2);
      v_d10_L := ROUND((v_d10_delta + ((v_day*23 + 11 + CASE WHEN v_period='evening' THEN 7 ELSE 0 END) % 9 - 4))::numeric, 2);
      v_95_rev  := ROUND(v_95_L  * c_sell_95,  2);
      v_d10_rev := ROUND(v_d10_L * c_sell_d10, 2);

      -- ── Product sales and closing stock ───────────────────────────────────
      v_is_restock := (v_period = 'morning' AND v_day IN (8, 19));

      FOR p IN 1..10 LOOP
        v_units := c_base_sales[p]
          + ((v_day * 7 + (p-1) * 13
             + CASE WHEN v_period = 'evening' THEN 5 ELSE 0 END) % 4);
        v_units_arr[p] := v_units;
        v_restock := CASE WHEN v_is_restock THEN c_restock[p] ELSE 0 END;
        v_stock[p] := GREATEST(0, v_stock[p] + v_restock - v_units);
      END LOOP;

      -- ════════════════════════════════════════════════════════════════════════
      -- INSERT shift
      -- ════════════════════════════════════════════════════════════════════════
      INSERT INTO shifts
        (station_id, supervisor_id, period, shift_date, status, part,
         shift_type, started_at, submitted_at, cashier_submitted_at, is_flagged)
      VALUES
        (c_station_id, v_sup_id, v_period, v_date_str::date, 'closed', 0,
         'standard', v_started, v_submitted, v_submitted, false)
      RETURNING id INTO v_shift_id;

      -- ── Close pump readings (type='close') ────────────────────────────────
      FOR i IN 1..18 LOOP
        INSERT INTO pump_readings (shift_id, pump_id, type, meter_reading, ocr_status)
        VALUES (v_shift_id,
                ('a1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
                'close', v_meters[i], 'auto');
      END LOOP;

      -- ── Close dip readings (type='close') ─────────────────────────────────
      FOR t IN 1..3 LOOP
        INSERT INTO dip_readings (shift_id, tank_id, type, litres)
        VALUES (v_shift_id, c_tank_ids[t], 'close', v_dips[t]);
      END LOOP;

      -- ── Fuel POS submission + lines ───────────────────────────────────────
      INSERT INTO pos_submissions (shift_id, photo_url, raw_ocr)
      VALUES (v_shift_id, NULL, NULL)
      RETURNING id INTO v_pos_id;

      INSERT INTO pos_submission_lines (pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status)
      VALUES
        (v_pos_id, '95',  v_95_L,  v_95_rev,  'auto'),
        (v_pos_id, 'D10', v_d10_L, v_d10_rev, 'auto');

      -- ── Dry-stock POS submission + lines ──────────────────────────────────
      INSERT INTO dry_stock_pos_submissions (shift_id, photo_url, ocr_status)
      VALUES (v_shift_id, NULL, 'confirmed')
      RETURNING id INTO v_ds_id;

      FOR p IN 1..10 LOOP
        INSERT INTO pos_dry_stock_lines
          (dry_stock_pos_submission_id, product_id, units_sold, revenue_zar, ocr_status)
        VALUES
          (v_ds_id, v_pids[p],
           v_units_arr[p],
           ROUND(v_units_arr[p] * c_sells[p], 2),
           'confirmed');
      END LOOP;

      -- ── Stock deliveries (restock days 8 + 19, morning only) ─────────────
      IF v_is_restock THEN
        FOR p IN 1..10 LOOP
          INSERT INTO stock_deliveries (shift_id, station_id, product_id, quantity, recorded_by)
          VALUES (v_shift_id, c_station_id, v_pids[p], c_restock[p], v_csh_user_id);
        END LOOP;
      END IF;

      -- ── Closing stock readings ────────────────────────────────────────────
      FOR p IN 1..10 LOOP
        INSERT INTO stock_readings (shift_id, product_id, closing_count, recorded_by)
        VALUES (v_shift_id, v_pids[p], v_stock[p], v_csh_user_id);
      END LOOP;

      -- ════════════════════════════════════════════════════════════════════════
      -- Reconciliation (computed directly — correct for ALL shifts)
      -- ════════════════════════════════════════════════════════════════════════
      INSERT INTO reconciliations (shift_id, updated_at)
      VALUES (v_shift_id, v_submitted)
      RETURNING id INTO v_rec_id;

      -- Tank lines
      FOR t IN 1..3 LOOP
        v_tank_delta := 0;
        FOR i IN 1..18 LOOP
          IF (i - 1) / 6 + 1 = t THEN
            v_tank_delta := v_tank_delta + v_deltas[i];
          END IF;
        END LOOP;

        DECLARE
          v_delivery  numeric := CASE t WHEN 1 THEN v_del_1 WHEN 2 THEN v_del_2 ELSE v_del_3 END;
          v_expected  numeric := ROUND(v_open_dips[t] + v_delivery - v_tank_delta, 2);
        BEGIN
          INSERT INTO reconciliation_tank_lines
            (reconciliation_id, tank_id,
             opening_dip, deliveries_received, meter_delta,
             expected_closing_dip, actual_closing_dip, variance_litres)
          VALUES
            (v_rec_id, c_tank_ids[t],
             v_open_dips[t], v_delivery, ROUND(v_tank_delta, 2),
             v_expected, v_dips[t],
             ROUND(v_dips[t] - v_expected, 2));
        END;
      END LOOP;

      -- Grade lines
      INSERT INTO reconciliation_grade_lines
        (reconciliation_id, fuel_grade_id,
         meter_delta, pos_litres_sold, variance_litres,
         sell_price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar)
      VALUES
        (v_rec_id, '95',
         ROUND(v_95_delta, 2),  v_95_L,
         ROUND(v_95_L - v_95_delta, 2),
         c_sell_95,
         ROUND(v_95_delta  * c_sell_95,  2),  v_95_rev,
         ROUND(v_95_rev  - v_95_delta  * c_sell_95,  2)),
        (v_rec_id, 'D10',
         ROUND(v_d10_delta, 2), v_d10_L,
         ROUND(v_d10_L - v_d10_delta, 2),
         c_sell_d10,
         ROUND(v_d10_delta * c_sell_d10, 2),  v_d10_rev,
         ROUND(v_d10_rev - v_d10_delta * c_sell_d10, 2));

      -- Stock lines
      FOR p IN 1..10 LOOP
        DECLARE
          v_restock2    numeric := CASE WHEN v_is_restock THEN c_restock[p] ELSE 0 END;
          v_expected_s  numeric := ROUND(v_open_stock[p] + v_restock2 - v_units_arr[p], 3);
          v_var_units   numeric := ROUND(v_stock[p] - v_expected_s, 3);
        BEGIN
          INSERT INTO reconciliation_stock_lines
            (reconciliation_id, product_id,
             opening_count, deliveries_received, pos_units_sold,
             expected_closing_count, actual_closing_count,
             variance_units, variance_zar)
          VALUES
            (v_rec_id, v_pids[p],
             v_open_stock[p], v_restock2, v_units_arr[p],
             v_expected_s, v_stock[p],
             v_var_units,
             ROUND(v_var_units * c_sells[p], 2));
        END;
      END LOOP;

      RAISE NOTICE '  % % ✓', v_date_str, v_period;

    END LOOP; -- period
  END LOOP; -- day

  -- ── 9. Final tank levels ────────────────────────────────────────────────────
  RAISE NOTICE '';
  RAISE NOTICE '═══ Done — April 2026 seeded ═══';
  RAISE NOTICE 'Tank 1 (95)  final: % L  (%% %)',
    ROUND(v_dips[1]), ROUND(v_dips[1] / 30000.0 * 100);
  RAISE NOTICE 'Tank 2 (D10) final: % L  (%% %)',
    ROUND(v_dips[2]), ROUND(v_dips[2] / 31000.0 * 100);
  RAISE NOTICE 'Tank 3 (D10) final: % L  (%% %)',
    ROUND(v_dips[3]), ROUND(v_dips[3] / 31000.0 * 100);

END $$;
