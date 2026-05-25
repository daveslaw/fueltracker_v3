-- ── POS and reconciliation: switch from grade-level to pump-level capture ────
--
-- pos_submission_lines: replace fuel_grade_id with pump_id
--   Fuel grade is derived at query time via pump → tank → fuel_grade_id.
--   Existing rows retain a nullable pump_id for historical compatibility.
--
-- reconciliation_pump_lines: new table replacing reconciliation_grade_lines
--   Grade totals are computed at query time by summing pump lines.
--
-- ocr_overrides: add nullable pump_id for pos_line type corrections.

-- ── pos_submission_lines ──────────────────────────────────────────────────────

alter table public.pos_submission_lines
  drop constraint pos_submission_lines_fuel_grade_id_fkey;

alter table public.pos_submission_lines
  drop constraint pos_submission_lines_pos_submission_id_fuel_grade_id_key;

alter table public.pos_submission_lines
  drop column fuel_grade_id;

alter table public.pos_submission_lines
  add column pump_id uuid references public.pumps(id) on delete restrict;

alter table public.pos_submission_lines
  add constraint pos_submission_lines_pos_submission_id_pump_id_key
  unique (pos_submission_id, pump_id);

comment on column public.pos_submission_lines.pump_id
  is 'pump that dispensed this fuel; grade derived via pump → tank → fuel_grade_id';

-- ── reconciliation_pump_lines (replaces reconciliation_grade_lines) ───────────

drop table public.reconciliation_grade_lines;

create table public.reconciliation_pump_lines (
  id                   uuid           primary key default gen_random_uuid(),
  reconciliation_id    uuid           not null references public.reconciliations(id) on delete cascade,
  pump_id              uuid           not null references public.pumps(id) on delete restrict,
  fuel_grade_id        text           not null references public.fuel_grades(id),
  meter_delta_litres   numeric(10, 2) not null,
  pos_litres_sold      numeric(10, 2) not null default 0,
  pos_revenue_zar      numeric(12, 2) not null default 0,
  variance_litres      numeric(10, 2) not null,
  sell_price_per_litre numeric(8, 4)  not null default 0,
  expected_revenue_zar numeric(14, 2) not null default 0,
  variance_zar         numeric(14, 2) not null default 0,
  unique (reconciliation_id, pump_id)
);

comment on column public.reconciliation_pump_lines.variance_litres
  is 'pos_litres_sold - meter_delta_litres; negative = unrecorded dispensing';

comment on column public.reconciliation_pump_lines.variance_zar
  is 'pos_revenue_zar - expected_revenue_zar; negative = revenue shortfall';

comment on column public.reconciliation_pump_lines.fuel_grade_id
  is 'denormalised from pump → tank for query convenience';

-- ── RLS: reconciliation_pump_lines mirrors reconciliation_grade_lines pattern ─

alter table public.reconciliation_pump_lines enable row level security;

create policy "service role writes pump lines"
  on public.reconciliation_pump_lines for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "attendant reads own pump lines"
  on public.reconciliation_pump_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    join public.user_profiles up on up.id = s.attendant_id
    where r.id = reconciliation_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station pump lines"
  on public.reconciliation_pump_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    where r.id = reconciliation_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all pump lines"
  on public.reconciliation_pump_lines for select
  using (public.is_owner());

-- ── ocr_overrides: add pump_id for pos_line corrections ──────────────────────

alter table public.ocr_overrides
  add column pump_id uuid references public.pumps(id) on delete restrict;

comment on column public.ocr_overrides.pump_id
  is 'for pos_line overrides: the pump whose POS line was corrected';
