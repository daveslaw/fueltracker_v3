-- ─────────────────────────────────────────────────────────────────────────────
-- FuelTracker v3 — March 2026 Test Data Seed
-- Covers all 3 stations × 2 shifts/day × 31 days = 186 closed shifts.
-- Includes realistic deliveries, reconciliation records, and 5 flagged shifts.
--
-- Run in Supabase SQL editor (or via psql). Idempotent — deletes existing
-- March 2026 shifts for these stations before inserting.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Fuel prices (effective 2026-03-01)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fuel_prices (id, fuel_grade_id, price_per_litre, effective_from)
VALUES
  (gen_random_uuid(), '95',  21.93, '2026-03-01 00:00:00+00'),
  (gen_random_uuid(), '93',  21.54, '2026-03-01 00:00:00+00'),
  (gen_random_uuid(), 'D10', 19.79, '2026-03-01 00:00:00+00'),
  (gen_random_uuid(), 'D50', 19.38, '2026-03-01 00:00:00+00')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Cleanup — remove any existing March 2026 shifts (cascades to all
-- child tables: pump_readings, dip_readings, pos_submissions, reconciliations,
-- deliveries, ocr_overrides)
-- ══════════════════════════════════════════════════════════════════════════════

DELETE FROM public.shifts
WHERE station_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001'
)
AND shift_date BETWEEN '2026-03-01' AND '2026-03-31';

-- Deliveries are not cascade-deleted with shifts, delete separately
DELETE FROM public.deliveries
WHERE station_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001'
)
AND delivered_at BETWEEN '2026-03-01 00:00:00+00' AND '2026-03-31 23:59:59+00';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Generate all shifts via PL/pgSQL
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── Station IDs ──────────────────────────────────────────────────────────
  STA_AMAG  constant uuid := 'a1000000-0000-0000-0000-000000000001';
  STA_SPEED constant uuid := 'b1000000-0000-0000-0000-000000000001';
  STA_TRUCK constant uuid := 'c1000000-0000-0000-0000-000000000001';

  -- ── Fuel prices (snapshot — must match Section 1 values) ─────────────────
  PRICE_95  constant numeric := 21.93;
  PRICE_93  constant numeric := 21.54;
  PRICE_D10 constant numeric := 19.79;
  PRICE_D50 constant numeric := 19.38;

  -- ── Running meter state (becomes opening of next shift) ───────────────────
  -- Elegant Amaglug: pumps 1-6=95/T1, 7-12=D10/T2, 13-18=D10/T3
  amag_meters  numeric[] := ARRAY[50100,50250,49800,50050,49900,50300,
                                   45200,45100,45400,45050,45300,45150,
                                   48300,48100,48500,48200,48050,48400];
  -- Speedway: 1-6=95/T1, 7-12=95/T2, 13-18=95/T3, 19-24=93/T4, 25-30=D50/T5, 31-36=D50/T6
  speed_meters numeric[] := ARRAY[102000,101500,103000,102500,101800,102200,
                                   98500, 99000, 98200, 99300, 98800, 99100,
                                   105000,104500,105500,104800,105200,104600,
                                   87000, 87500, 86800, 87200, 87800, 87100,
                                   93500, 94000, 93200, 94300, 93800, 94100,
                                   76000, 76500, 75800, 76300, 76800, 75600];
  -- Truck Stop: 1-2=D50/T1, 3-4=D50/T2, 5=D50/T3, 6-7=D50/T4
  truck_meters numeric[] := ARRAY[120500,121000,115200,115800,89300,134500,134000];

  -- ── Running dip state ────────────────────────────────────────────────────
  amag_dips  numeric[] := ARRAY[18000.0, 20000.0, 20000.0];
  speed_dips numeric[] := ARRAY[19000.0, 19000.0, 19000.0, 18000.0, 17000.0, 17000.0];
  truck_dips numeric[] := ARRAY[14000.0, 14000.0, 12000.0, 8000.0];

  -- ── Loop control ─────────────────────────────────────────────────────────
  day_num     int;
  cur_date    date;
  per         text;  -- 'morning' or 'evening'
  sub_at      timestamptz;
  i           int;

  -- ── Per-shift IDs ────────────────────────────────────────────────────────
  shift_a uuid;  pos_a uuid;  recon_a uuid;
  shift_b uuid;  pos_b uuid;  recon_b uuid;
  shift_c uuid;  pos_c uuid;  recon_c uuid;

  -- ── Per-pump working delta ────────────────────────────────────────────────
  d numeric;

  -- ── Tank-level pump delta sums ────────────────────────────────────────────
  td_a1 numeric; td_a2 numeric; td_a3 numeric;
  td_b1 numeric; td_b2 numeric; td_b3 numeric;
  td_b4 numeric; td_b5 numeric; td_b6 numeric;
  td_c1 numeric; td_c2 numeric; td_c3 numeric; td_c4 numeric;

  -- ── Opening dip snapshots (before state update) ───────────────────────────
  od_a1 numeric; od_a2 numeric; od_a3 numeric;
  od_b1 numeric; od_b2 numeric; od_b3 numeric;
  od_b4 numeric; od_b5 numeric; od_b6 numeric;
  od_c1 numeric; od_c2 numeric; od_c3 numeric; od_c4 numeric;

  -- ── Delivery amounts per tank ─────────────────────────────────────────────
  del_a1 numeric; del_a2 numeric; del_a3 numeric;
  del_b1 numeric; del_b2 numeric; del_b3 numeric;
  del_b4 numeric; del_b5 numeric; del_b6 numeric;
  del_c1 numeric; del_c2 numeric; del_c3 numeric; del_c4 numeric;

  -- ── Closing dip values ────────────────────────────────────────────────────
  cd_a1 numeric; cd_a2 numeric; cd_a3 numeric;
  cd_b1 numeric; cd_b2 numeric; cd_b3 numeric;
  cd_b4 numeric; cd_b5 numeric; cd_b6 numeric;
  cd_c1 numeric; cd_c2 numeric; cd_c3 numeric; cd_c4 numeric;

  -- ── Grade meter deltas ────────────────────────────────────────────────────
  gd_95_a  numeric; gd_D10_a numeric;
  gd_95_b  numeric; gd_93_b  numeric; gd_D50_b numeric;
  gd_D50_c numeric;

  -- ── POS litres and revenue ────────────────────────────────────────────────
  pl_95_a  numeric; pl_D10_a numeric;
  pr_95_a  numeric; pr_D10_a numeric;
  pl_95_b  numeric; pl_93_b  numeric; pl_D50_b numeric;
  pr_95_b  numeric; pr_93_b  numeric; pr_D50_b numeric;
  pl_D50_c numeric; pr_D50_c numeric;

  -- ── Flags ─────────────────────────────────────────────────────────────────
  flag_a bool; txt_a text;
  flag_b bool; txt_b text;
  flag_c bool; txt_c text;

BEGIN
  FOR day_num IN 1..31 LOOP
    cur_date := make_date(2026, 3, day_num);

    FOREACH per IN ARRAY ARRAY['morning','evening'] LOOP
      sub_at := (cur_date::timestamp +
                 CASE WHEN per = 'morning'
                      THEN '11:45:00'::interval
                      ELSE '23:30:00'::interval
                 END) AT TIME ZONE 'UTC';

      -- ══════════════════════════════════════════════════════════════════════
      -- A: ELEGANT AMAGLUG
      -- Tanks: 1=95(T1), 2=D10(T2), 3=D10(T3)
      -- Pumps: 1-6→T1, 7-12→T2, 13-18→T3
      -- ══════════════════════════════════════════════════════════════════════

      shift_a := gen_random_uuid();

      -- Flag detection
      flag_a := false; txt_a := null;
      IF day_num = 7  AND per = 'evening' THEN
        flag_a := true;
        txt_a  := 'Tank 3 (D10) showing unexplained inventory loss of ~120 L. Requires investigation.';
      ELSIF day_num = 19 AND per = 'morning' THEN
        flag_a := true;
        txt_a  := 'Tank 2 (D10) dip variance of ~95 L. Possible slow leak or meter discrepancy.';
      END IF;

      INSERT INTO public.shifts
        (id, station_id, period, shift_date, status, submitted_at, is_flagged, flag_comment, supervisor_id, attendant_id, created_at)
      VALUES
        (shift_a, STA_AMAG, per, cur_date, 'closed', sub_at, flag_a, txt_a, null, null, sub_at);

      -- Pump readings (18 pumps) + accumulate tank deltas
      td_a1 := 0; td_a2 := 0; td_a3 := 0;
      FOR i IN 1..18 LOOP
        IF per = 'morning' THEN
          d := CASE WHEN i <= 6 THEN 36 ELSE 30 END
               + ((day_num * 7 + i * 13) % 16);
        ELSE
          d := CASE WHEN i <= 6 THEN 44 ELSE 38 END
               + ((day_num * 7 + i * 13) % 20);
        END IF;

        INSERT INTO public.pump_readings
          (id, shift_id, pump_id, type, meter_reading, ocr_status, created_at)
        VALUES
          (gen_random_uuid(), shift_a,
           ('a1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'open',  amag_meters[i],     'auto', sub_at),
          (gen_random_uuid(), shift_a,
           ('a1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'close', amag_meters[i] + d, 'auto', sub_at);

        IF    i <= 6  THEN td_a1 := td_a1 + d;
        ELSIF i <= 12 THEN td_a2 := td_a2 + d;
        ELSE               td_a3 := td_a3 + d;
        END IF;

        amag_meters[i] := amag_meters[i] + d;
      END LOOP;

      -- Snapshot open dips before mutation
      od_a1 := amag_dips[1]; od_a2 := amag_dips[2]; od_a3 := amag_dips[3];

      -- Delivery schedule (morning only)
      del_a1 := 0; del_a2 := 0; del_a3 := 0;
      IF per = 'morning' THEN
        IF day_num = 5  THEN del_a1 := 20000; END IF;
        IF day_num = 22 THEN del_a1 := 18000; END IF;
        IF day_num = 8  THEN del_a2 := 16000; END IF;
        IF day_num = 24 THEN del_a2 := 14000; END IF;
        IF day_num = 9  THEN del_a3 := 16000; END IF;

        IF del_a1 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_AMAG, 'a1100000-0000-0000-0000-000000000001',
             del_a1, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_a2 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_AMAG, 'a1100000-0000-0000-0000-000000000002',
             del_a2, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_a3 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_AMAG, 'a1100000-0000-0000-0000-000000000003',
             del_a3, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
      END IF;

      -- Compute close dips (normal noise ±2L; flagged shifts get large negatives)
      cd_a1 := od_a1 - td_a1 + del_a1 + ((day_num + 1) % 5) - 2;
      cd_a2 := od_a2 - td_a2 + del_a2 +
               CASE WHEN day_num = 19 AND per = 'morning' THEN -95
                    ELSE ((day_num + 2) % 5) - 2 END;
      cd_a3 := od_a3 - td_a3 + del_a3 +
               CASE WHEN day_num = 7  AND per = 'evening' THEN -120
                    ELSE ((day_num + 3) % 5) - 2 END;

      -- Dip readings
      INSERT INTO public.dip_readings (id, shift_id, tank_id, type, litres, created_at)
      VALUES
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000001', 'open',  od_a1, sub_at),
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000001', 'close', cd_a1, sub_at),
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000002', 'open',  od_a2, sub_at),
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000002', 'close', cd_a2, sub_at),
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000003', 'open',  od_a3, sub_at),
        (gen_random_uuid(), shift_a, 'a1100000-0000-0000-0000-000000000003', 'close', cd_a3, sub_at);

      -- Update dip state
      amag_dips[1] := cd_a1; amag_dips[2] := cd_a2; amag_dips[3] := cd_a3;

      -- Grade deltas
      gd_95_a  := td_a1;
      gd_D10_a := td_a2 + td_a3;

      -- POS lines (small noise on litres; small noise on revenue)
      pl_95_a  := gd_95_a  - ((day_num * 3 + 1) % 4);
      pl_D10_a := gd_D10_a - ((day_num * 3 + 2) % 4);
      pr_95_a  := round(pl_95_a  * PRICE_95,  2) - ((day_num * 2)     % 5);
      pr_D10_a := round(pl_D10_a * PRICE_D10, 2) - ((day_num * 2 + 1) % 5);

      pos_a := gen_random_uuid();
      INSERT INTO public.pos_submissions (id, shift_id, created_at)
      VALUES (pos_a, shift_a, sub_at);

      INSERT INTO public.pos_submission_lines
        (id, pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status, created_at)
      VALUES
        (gen_random_uuid(), pos_a, '95',  pl_95_a,  pr_95_a,  'auto', sub_at),
        (gen_random_uuid(), pos_a, 'D10', pl_D10_a, pr_D10_a, 'auto', sub_at);

      -- Reconciliation
      recon_a := gen_random_uuid();
      INSERT INTO public.reconciliations (id, shift_id, created_at, updated_at)
      VALUES (recon_a, shift_a, sub_at, sub_at);

      INSERT INTO public.reconciliation_tank_lines
        (id, reconciliation_id, tank_id,
         opening_dip, deliveries_received, meter_delta,
         expected_closing_dip, actual_closing_dip, variance_litres)
      VALUES
        (gen_random_uuid(), recon_a, 'a1100000-0000-0000-0000-000000000001',
         od_a1, del_a1, td_a1,
         od_a1 + del_a1 - td_a1, cd_a1,
         cd_a1 - (od_a1 + del_a1 - td_a1)),
        (gen_random_uuid(), recon_a, 'a1100000-0000-0000-0000-000000000002',
         od_a2, del_a2, td_a2,
         od_a2 + del_a2 - td_a2, cd_a2,
         cd_a2 - (od_a2 + del_a2 - td_a2)),
        (gen_random_uuid(), recon_a, 'a1100000-0000-0000-0000-000000000003',
         od_a3, del_a3, td_a3,
         od_a3 + del_a3 - td_a3, cd_a3,
         cd_a3 - (od_a3 + del_a3 - td_a3));

      INSERT INTO public.reconciliation_grade_lines
        (id, reconciliation_id, fuel_grade_id,
         meter_delta, pos_litres_sold, variance_litres,
         price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar)
      VALUES
        (gen_random_uuid(), recon_a, '95',
         gd_95_a, pl_95_a, pl_95_a - gd_95_a,
         PRICE_95, round(gd_95_a * PRICE_95, 2), pr_95_a,
         pr_95_a - round(gd_95_a * PRICE_95, 2)),
        (gen_random_uuid(), recon_a, 'D10',
         gd_D10_a, pl_D10_a, pl_D10_a - gd_D10_a,
         PRICE_D10, round(gd_D10_a * PRICE_D10, 2), pr_D10_a,
         pr_D10_a - round(gd_D10_a * PRICE_D10, 2));


      -- ════════════════════════════════════════════════════════════════════════
      -- B: SPEEDWAY
      -- Tanks: 1-3=95, 4=93, 5-6=D50
      -- Pumps: 1-6→T1, 7-12→T2, 13-18→T3, 19-24→T4, 25-30→T5, 31-36→T6
      -- ════════════════════════════════════════════════════════════════════════

      shift_b := gen_random_uuid();

      flag_b := false; txt_b := null;
      IF day_num = 14 AND per = 'morning' THEN
        flag_b := true;
        txt_b  := 'D50 revenue shortfall of ~R820. POS takings do not match meter dispensed.';
      ELSIF day_num = 28 AND per = 'evening' THEN
        flag_b := true;
        txt_b  := '95 revenue shortfall of ~R1150. Significant POS vs meter variance — supervisor to investigate.';
      END IF;

      INSERT INTO public.shifts
        (id, station_id, period, shift_date, status, submitted_at, is_flagged, flag_comment, supervisor_id, attendant_id, created_at)
      VALUES
        (shift_b, STA_SPEED, per, cur_date, 'closed', sub_at, flag_b, txt_b, null, null, sub_at);

      -- Pump readings (36 pumps)
      td_b1 := 0; td_b2 := 0; td_b3 := 0;
      td_b4 := 0; td_b5 := 0; td_b6 := 0;
      FOR i IN 1..36 LOOP
        IF per = 'morning' THEN
          d := CASE WHEN i <= 24 THEN 50 ELSE 42 END
               + ((day_num * 7 + i * 13) % 22);
        ELSE
          d := CASE WHEN i <= 24 THEN 60 ELSE 52 END
               + ((day_num * 7 + i * 13) % 25);
        END IF;

        INSERT INTO public.pump_readings
          (id, shift_id, pump_id, type, meter_reading, ocr_status, created_at)
        VALUES
          (gen_random_uuid(), shift_b,
           ('b1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'open',  speed_meters[i],     'auto', sub_at),
          (gen_random_uuid(), shift_b,
           ('b1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'close', speed_meters[i] + d, 'auto', sub_at);

        IF    i <= 6  THEN td_b1 := td_b1 + d;
        ELSIF i <= 12 THEN td_b2 := td_b2 + d;
        ELSIF i <= 18 THEN td_b3 := td_b3 + d;
        ELSIF i <= 24 THEN td_b4 := td_b4 + d;
        ELSIF i <= 30 THEN td_b5 := td_b5 + d;
        ELSE               td_b6 := td_b6 + d;
        END IF;

        speed_meters[i] := speed_meters[i] + d;
      END LOOP;

      od_b1 := speed_dips[1]; od_b2 := speed_dips[2]; od_b3 := speed_dips[3];
      od_b4 := speed_dips[4]; od_b5 := speed_dips[5]; od_b6 := speed_dips[6];

      -- Delivery schedule (morning only)
      del_b1 := 0; del_b2 := 0; del_b3 := 0;
      del_b4 := 0; del_b5 := 0; del_b6 := 0;
      IF per = 'morning' THEN
        IF day_num = 4  THEN del_b1 := 18000; del_b2 := 18000; END IF;
        IF day_num = 10 THEN del_b4 := 16000; END IF;
        IF day_num = 11 THEN del_b5 := 16000; del_b6 := 16000; END IF;
        IF day_num = 18 THEN del_b3 := 20000; END IF;
        IF day_num = 20 THEN del_b4 := 15000; END IF;
        IF day_num = 25 THEN del_b1 := 17000; del_b2 := 17000; END IF;
        IF day_num = 28 THEN del_b5 := 15000; del_b6 := 15000; END IF;

        -- Insert deliveries for any tank that received fuel
        IF del_b1 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000001',
             del_b1, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_b2 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000002',
             del_b2, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_b3 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000003',
             del_b3, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_b4 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000004',
             del_b4, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_b5 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000005',
             del_b5, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_b6 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_SPEED, 'b1100000-0000-0000-0000-000000000006',
             del_b6, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
      END IF;

      -- Compute close dips
      cd_b1 := od_b1 - td_b1 + del_b1 + ((day_num + 1) % 5) - 2;
      cd_b2 := od_b2 - td_b2 + del_b2 + ((day_num + 2) % 5) - 2;
      cd_b3 := od_b3 - td_b3 + del_b3 + ((day_num + 3) % 5) - 2;
      cd_b4 := od_b4 - td_b4 + del_b4 + ((day_num + 4) % 5) - 2;
      cd_b5 := od_b5 - td_b5 + del_b5 + ((day_num + 5) % 5) - 2;
      cd_b6 := od_b6 - td_b6 + del_b6 + ((day_num + 6) % 5) - 2;

      INSERT INTO public.dip_readings (id, shift_id, tank_id, type, litres, created_at)
      VALUES
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000001', 'open',  od_b1, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000001', 'close', cd_b1, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000002', 'open',  od_b2, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000002', 'close', cd_b2, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000003', 'open',  od_b3, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000003', 'close', cd_b3, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000004', 'open',  od_b4, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000004', 'close', cd_b4, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000005', 'open',  od_b5, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000005', 'close', cd_b5, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000006', 'open',  od_b6, sub_at),
        (gen_random_uuid(), shift_b, 'b1100000-0000-0000-0000-000000000006', 'close', cd_b6, sub_at);

      speed_dips[1] := cd_b1; speed_dips[2] := cd_b2; speed_dips[3] := cd_b3;
      speed_dips[4] := cd_b4; speed_dips[5] := cd_b5; speed_dips[6] := cd_b6;

      -- Grade deltas
      gd_95_b  := td_b1 + td_b2 + td_b3;
      gd_93_b  := td_b4;
      gd_D50_b := td_b5 + td_b6;

      -- POS (with flagged revenue shortfalls on specific shifts)
      pl_95_b  := gd_95_b  - ((day_num * 3 + 1) % 4);
      pl_93_b  := gd_93_b  - ((day_num * 3 + 2) % 4);
      pl_D50_b := gd_D50_b - ((day_num * 3 + 3) % 4);

      pr_95_b  := round(pl_95_b  * PRICE_95,  2) - ((day_num * 2)     % 7)
                  - CASE WHEN day_num = 28 AND per = 'evening' THEN 1150 ELSE 0 END;
      pr_93_b  := round(pl_93_b  * PRICE_93,  2) - ((day_num * 2 + 1) % 7);
      pr_D50_b := round(pl_D50_b * PRICE_D50, 2) - ((day_num * 2 + 2) % 7)
                  - CASE WHEN day_num = 14 AND per = 'morning' THEN 820 ELSE 0 END;

      pos_b := gen_random_uuid();
      INSERT INTO public.pos_submissions (id, shift_id, created_at)
      VALUES (pos_b, shift_b, sub_at);

      INSERT INTO public.pos_submission_lines
        (id, pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status, created_at)
      VALUES
        (gen_random_uuid(), pos_b, '95',  pl_95_b,  pr_95_b,  'auto', sub_at),
        (gen_random_uuid(), pos_b, '93',  pl_93_b,  pr_93_b,  'auto', sub_at),
        (gen_random_uuid(), pos_b, 'D50', pl_D50_b, pr_D50_b, 'auto', sub_at);

      recon_b := gen_random_uuid();
      INSERT INTO public.reconciliations (id, shift_id, created_at, updated_at)
      VALUES (recon_b, shift_b, sub_at, sub_at);

      INSERT INTO public.reconciliation_tank_lines
        (id, reconciliation_id, tank_id,
         opening_dip, deliveries_received, meter_delta,
         expected_closing_dip, actual_closing_dip, variance_litres)
      VALUES
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000001',
         od_b1, del_b1, td_b1, od_b1+del_b1-td_b1, cd_b1, cd_b1-(od_b1+del_b1-td_b1)),
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000002',
         od_b2, del_b2, td_b2, od_b2+del_b2-td_b2, cd_b2, cd_b2-(od_b2+del_b2-td_b2)),
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000003',
         od_b3, del_b3, td_b3, od_b3+del_b3-td_b3, cd_b3, cd_b3-(od_b3+del_b3-td_b3)),
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000004',
         od_b4, del_b4, td_b4, od_b4+del_b4-td_b4, cd_b4, cd_b4-(od_b4+del_b4-td_b4)),
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000005',
         od_b5, del_b5, td_b5, od_b5+del_b5-td_b5, cd_b5, cd_b5-(od_b5+del_b5-td_b5)),
        (gen_random_uuid(), recon_b, 'b1100000-0000-0000-0000-000000000006',
         od_b6, del_b6, td_b6, od_b6+del_b6-td_b6, cd_b6, cd_b6-(od_b6+del_b6-td_b6));

      INSERT INTO public.reconciliation_grade_lines
        (id, reconciliation_id, fuel_grade_id,
         meter_delta, pos_litres_sold, variance_litres,
         price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar)
      VALUES
        (gen_random_uuid(), recon_b, '95',
         gd_95_b, pl_95_b, pl_95_b-gd_95_b,
         PRICE_95, round(gd_95_b*PRICE_95,2), pr_95_b,
         pr_95_b-round(gd_95_b*PRICE_95,2)),
        (gen_random_uuid(), recon_b, '93',
         gd_93_b, pl_93_b, pl_93_b-gd_93_b,
         PRICE_93, round(gd_93_b*PRICE_93,2), pr_93_b,
         pr_93_b-round(gd_93_b*PRICE_93,2)),
        (gen_random_uuid(), recon_b, 'D50',
         gd_D50_b, pl_D50_b, pl_D50_b-gd_D50_b,
         PRICE_D50, round(gd_D50_b*PRICE_D50,2), pr_D50_b,
         pr_D50_b-round(gd_D50_b*PRICE_D50,2));


      -- ════════════════════════════════════════════════════════════════════════
      -- C: TRUCK STOP
      -- Tanks: 1-4 all D50
      -- Pumps: 1-2→T1, 3-4→T2, 5→T3, 6-7→T4
      -- ════════════════════════════════════════════════════════════════════════

      shift_c := gen_random_uuid();

      flag_c := false; txt_c := null;
      IF day_num = 24 AND per = 'evening' THEN
        flag_c := true;
        txt_c  := 'Tank 2 (D50) showing inventory loss of ~110 L. Possible meter or dip stick issue.';
      END IF;

      INSERT INTO public.shifts
        (id, station_id, period, shift_date, status, submitted_at, is_flagged, flag_comment, supervisor_id, attendant_id, created_at)
      VALUES
        (shift_c, STA_TRUCK, per, cur_date, 'closed', sub_at, flag_c, txt_c, null, null, sub_at);

      -- Pump readings (7 pumps)
      td_c1 := 0; td_c2 := 0; td_c3 := 0; td_c4 := 0;
      FOR i IN 1..7 LOOP
        IF per = 'morning' THEN
          d := 60 + ((day_num * 7 + i * 13) % 28);
        ELSE
          d := 77 + ((day_num * 7 + i * 13) % 30);
        END IF;

        INSERT INTO public.pump_readings
          (id, shift_id, pump_id, type, meter_reading, ocr_status, created_at)
        VALUES
          (gen_random_uuid(), shift_c,
           ('c1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'open',  truck_meters[i],     'auto', sub_at),
          (gen_random_uuid(), shift_c,
           ('c1200000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
           'close', truck_meters[i] + d, 'auto', sub_at);

        IF    i <= 2 THEN td_c1 := td_c1 + d;
        ELSIF i <= 4 THEN td_c2 := td_c2 + d;
        ELSIF i =  5 THEN td_c3 := td_c3 + d;
        ELSE               td_c4 := td_c4 + d;
        END IF;

        truck_meters[i] := truck_meters[i] + d;
      END LOOP;

      od_c1 := truck_dips[1]; od_c2 := truck_dips[2];
      od_c3 := truck_dips[3]; od_c4 := truck_dips[4];

      -- Delivery schedule (morning only)
      del_c1 := 0; del_c2 := 0; del_c3 := 0; del_c4 := 0;
      IF per = 'morning' THEN
        IF day_num = 6  THEN del_c1 := 12000; del_c2 := 12000; END IF;
        IF day_num = 13 THEN del_c3 := 10000; del_c4 :=  8000; END IF;
        IF day_num = 20 THEN del_c1 := 11000; del_c2 := 11000; END IF;
        IF day_num = 27 THEN del_c3 :=  9000; del_c4 :=  7000; END IF;

        IF del_c1 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_TRUCK, 'c1100000-0000-0000-0000-000000000001',
             del_c1, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_c2 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_TRUCK, 'c1100000-0000-0000-0000-000000000002',
             del_c2, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_c3 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_TRUCK, 'c1100000-0000-0000-0000-000000000003',
             del_c3, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
        IF del_c4 > 0 THEN
          INSERT INTO public.deliveries
            (id, station_id, tank_id, litres_received, delivered_at, recorded_by, created_at, updated_at)
          VALUES
            (gen_random_uuid(), STA_TRUCK, 'c1100000-0000-0000-0000-000000000004',
             del_c4, (cur_date::timestamp + '08:00:00'::interval) AT TIME ZONE 'UTC',
             null, sub_at, sub_at);
        END IF;
      END IF;

      -- Compute close dips
      cd_c1 := od_c1 - td_c1 + del_c1 + ((day_num + 1) % 5) - 2;
      cd_c2 := od_c2 - td_c2 + del_c2 +
               CASE WHEN day_num = 24 AND per = 'evening' THEN -110
                    ELSE ((day_num + 2) % 5) - 2 END;
      cd_c3 := od_c3 - td_c3 + del_c3 + ((day_num + 3) % 5) - 2;
      cd_c4 := od_c4 - td_c4 + del_c4 + ((day_num + 4) % 5) - 2;

      INSERT INTO public.dip_readings (id, shift_id, tank_id, type, litres, created_at)
      VALUES
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000001', 'open',  od_c1, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000001', 'close', cd_c1, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000002', 'open',  od_c2, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000002', 'close', cd_c2, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000003', 'open',  od_c3, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000003', 'close', cd_c3, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000004', 'open',  od_c4, sub_at),
        (gen_random_uuid(), shift_c, 'c1100000-0000-0000-0000-000000000004', 'close', cd_c4, sub_at);

      truck_dips[1] := cd_c1; truck_dips[2] := cd_c2;
      truck_dips[3] := cd_c3; truck_dips[4] := cd_c4;

      -- Grade delta (all D50)
      gd_D50_c := td_c1 + td_c2 + td_c3 + td_c4;

      -- POS
      pl_D50_c := gd_D50_c - ((day_num * 3 + 1) % 4);
      pr_D50_c := round(pl_D50_c * PRICE_D50, 2) - ((day_num * 2) % 7);

      pos_c := gen_random_uuid();
      INSERT INTO public.pos_submissions (id, shift_id, created_at)
      VALUES (pos_c, shift_c, sub_at);

      INSERT INTO public.pos_submission_lines
        (id, pos_submission_id, fuel_grade_id, litres_sold, revenue_zar, ocr_status, created_at)
      VALUES
        (gen_random_uuid(), pos_c, 'D50', pl_D50_c, pr_D50_c, 'auto', sub_at);

      recon_c := gen_random_uuid();
      INSERT INTO public.reconciliations (id, shift_id, created_at, updated_at)
      VALUES (recon_c, shift_c, sub_at, sub_at);

      INSERT INTO public.reconciliation_tank_lines
        (id, reconciliation_id, tank_id,
         opening_dip, deliveries_received, meter_delta,
         expected_closing_dip, actual_closing_dip, variance_litres)
      VALUES
        (gen_random_uuid(), recon_c, 'c1100000-0000-0000-0000-000000000001',
         od_c1, del_c1, td_c1, od_c1+del_c1-td_c1, cd_c1, cd_c1-(od_c1+del_c1-td_c1)),
        (gen_random_uuid(), recon_c, 'c1100000-0000-0000-0000-000000000002',
         od_c2, del_c2, td_c2, od_c2+del_c2-td_c2, cd_c2, cd_c2-(od_c2+del_c2-td_c2)),
        (gen_random_uuid(), recon_c, 'c1100000-0000-0000-0000-000000000003',
         od_c3, del_c3, td_c3, od_c3+del_c3-td_c3, cd_c3, cd_c3-(od_c3+del_c3-td_c3)),
        (gen_random_uuid(), recon_c, 'c1100000-0000-0000-0000-000000000004',
         od_c4, del_c4, td_c4, od_c4+del_c4-td_c4, cd_c4, cd_c4-(od_c4+del_c4-td_c4));

      INSERT INTO public.reconciliation_grade_lines
        (id, reconciliation_id, fuel_grade_id,
         meter_delta, pos_litres_sold, variance_litres,
         price_per_litre, expected_revenue_zar, pos_revenue_zar, variance_zar)
      VALUES
        (gen_random_uuid(), recon_c, 'D50',
         gd_D50_c, pl_D50_c, pl_D50_c-gd_D50_c,
         PRICE_D50, round(gd_D50_c*PRICE_D50,2), pr_D50_c,
         pr_D50_c-round(gd_D50_c*PRICE_D50,2));

    END LOOP; -- period
  END LOOP;   -- day
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run these after the script to confirm row counts)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- SELECT count(*) FROM public.shifts
--   WHERE shift_date BETWEEN '2026-03-01' AND '2026-03-31';
-- -- Expect: 186
--
-- -- -- Expect: 5
--
-- SELECT count(*) FROM public.reconciliations r
--   JOIN public.shifts s ON s.id = r.shift_id
--   WHERE s.shift_date BETWEEN '2026-03-01' AND '2026-03-31';
-- -- Expect: 186
--
-- SELECT s.name, count(*) FROM public.shifts sh
--   JOIN public.stations s ON s.id = sh.station_id
--   WHERE sh.shift_date BETWEEN '2026-03-01' AND '2026-03-31'
--   GROUP BY s.name ORDER BY s.name;
-- -- Expect: Elegant Amaglug=62, Speedway=62, Truck Stop=62
--
-- SELECT count(*) FROM public.deliveries
--   WHERE delivered_at BETWEEN '2026-03-01' AND '2026-03-31 23:59:59+00';
-- -- Expect: 24
