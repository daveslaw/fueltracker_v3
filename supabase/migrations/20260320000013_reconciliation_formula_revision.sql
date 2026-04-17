-- ── Reconciliation formula revision ──────────────────────────────────────────
--
-- Formula 1 (tank inventory): now uses pump meter delta instead of POS litres.
--   Expected Closing Dip = Opening Dip + Deliveries − Meter Delta (per tank)
--   variance_litres = actual − expected  (negative = loss)
--
-- Formula 2 (pump vs POS): now includes currency columns per grade.
--   expected_revenue_zar = meter_delta × price_per_litre
--   variance_zar = pos_revenue_zar − expected_revenue_zar  (negative = shortfall)
--
-- Formula 3 (station-level revenue): dropped. Replaced by per-grade columns above.
--
-- Sign convention: negative = loss/shortfall across all variances (reversed from prior).
--
-- Override fix: ocr_overrides gains field_name for pos_line overrides and 'dip'
--   as a valid reading_type so close dip readings can be corrected post-close.

-- ── reconciliation_tank_lines ─────────────────────────────────────────────────
-- Rename pos_litres_sold → meter_delta (Formula 1 no longer uses POS litres).
alter table public.reconciliation_tank_lines
  rename column pos_litres_sold to meter_delta;

comment on column public.reconciliation_tank_lines.meter_delta
  is 'sum of (close - open) for all pumps mapped to this tank';

comment on column public.reconciliation_tank_lines.variance_litres
  is 'actual_closing_dip - expected_closing_dip; negative = inventory loss';

-- ── reconciliation_grade_lines ────────────────────────────────────────────────
-- Add currency columns for Formula 2. Remove old variance comment.
alter table public.reconciliation_grade_lines
  add column price_per_litre      numeric(8, 4)  not null default 0,
  add column expected_revenue_zar numeric(14, 2) not null default 0,
  add column pos_revenue_zar      numeric(14, 2) not null default 0,
  add column variance_zar         numeric(14, 2) not null default 0;

comment on column public.reconciliation_grade_lines.variance_litres
  is 'pos_litres_sold - meter_delta; negative = unrecorded dispensing';

comment on column public.reconciliation_grade_lines.variance_zar
  is 'pos_revenue_zar - expected_revenue_zar; negative = revenue shortfall';

-- ── reconciliations ───────────────────────────────────────────────────────────
-- Drop station-level revenue totals — revenue is now per-grade on grade lines.
alter table public.reconciliations
  drop column expected_revenue,
  drop column pos_revenue,
  drop column revenue_variance;

-- ── ocr_overrides ─────────────────────────────────────────────────────────────
-- Add field_name for pos_line overrides (distinguishes litres_sold vs revenue_zar).
-- Extend reading_type to include 'dip' so close dip readings can be corrected.
alter table public.ocr_overrides
  add column field_name text;

alter table public.ocr_overrides
  drop constraint ocr_overrides_reading_type_check;

alter table public.ocr_overrides
  add constraint ocr_overrides_reading_type_check
  check (reading_type in ('pump', 'pos_line', 'dip'));

comment on column public.ocr_overrides.field_name
  is 'for pos_line overrides: which field was corrected — litres_sold or revenue_zar';
