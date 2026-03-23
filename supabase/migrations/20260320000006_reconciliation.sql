-- ── fuel_prices: versioned selling price per grade ───────────────────────────
-- Each row is a price change event. The active price for a shift is the latest
-- row with effective_from <= shift submitted_at.
create table public.fuel_prices (
  id             uuid primary key default gen_random_uuid(),
  fuel_grade_id  text not null references public.fuel_grades(id),
  price_per_litre numeric(8, 4) not null check (price_per_litre > 0),
  effective_from timestamptz not null default now(),
  set_by         uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index on public.fuel_prices (fuel_grade_id, effective_from desc);

-- ── reconciliations: one record per submitted shift ───────────────────────────
create table public.reconciliations (
  id                uuid primary key default gen_random_uuid(),
  shift_id          uuid not null references public.shifts(id) on delete cascade unique,
  expected_revenue  numeric(14, 2) not null,
  pos_revenue       numeric(14, 2) not null,
  revenue_variance  numeric(14, 2) not null,  -- expected - pos_revenue
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── reconciliation_tank_lines: per-tank inventory reconciliation ──────────────
create table public.reconciliation_tank_lines (
  id                    uuid primary key default gen_random_uuid(),
  reconciliation_id     uuid not null references public.reconciliations(id) on delete cascade,
  tank_id               uuid not null references public.tanks(id),
  opening_dip           numeric(10, 2) not null,
  deliveries_received   numeric(10, 2) not null default 0,
  pos_litres_sold       numeric(10, 2) not null default 0,
  expected_closing_dip  numeric(10, 2) not null,
  actual_closing_dip    numeric(10, 2) not null,
  variance_litres       numeric(10, 2) not null,  -- expected - actual (positive = loss)
  unique (reconciliation_id, tank_id)
);

-- ── reconciliation_grade_lines: pump-meter vs POS per grade ──────────────────
create table public.reconciliation_grade_lines (
  id                uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.reconciliations(id) on delete cascade,
  fuel_grade_id     text not null references public.fuel_grades(id),
  meter_delta       numeric(10, 2) not null,  -- sum of (close - open) across pumps for grade
  pos_litres_sold   numeric(10, 2) not null,
  variance_litres   numeric(10, 2) not null,  -- meter_delta - pos_litres_sold
  unique (reconciliation_id, fuel_grade_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.fuel_prices             enable row level security;
alter table public.reconciliations         enable row level security;
alter table public.reconciliation_tank_lines  enable row level security;
alter table public.reconciliation_grade_lines enable row level security;

-- fuel_prices: owner writes, all authenticated read
create policy "owner manages fuel prices"
  on public.fuel_prices for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "authenticated reads fuel prices"
  on public.fuel_prices for select
  using (auth.role() = 'authenticated');

-- reconciliations: attendant reads own shift; supervisor reads station; owner reads all
create policy "attendant reads own reconciliation"
  on public.reconciliations for select
  using (exists (
    select 1 from public.shifts s
    join public.user_profiles up on up.id = s.attendant_id
    where s.id = shift_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station reconciliations"
  on public.reconciliations for select
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all reconciliations"
  on public.reconciliations for select
  using (public.is_owner());

-- service role writes reconciliations (called from server actions with admin client)
create policy "service role writes reconciliations"
  on public.reconciliations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- tank lines: inherit from reconciliation via service role + select for station/owner
create policy "service role writes tank lines"
  on public.reconciliation_tank_lines for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "attendant reads own tank lines"
  on public.reconciliation_tank_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    join public.user_profiles up on up.id = s.attendant_id
    where r.id = reconciliation_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station tank lines"
  on public.reconciliation_tank_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    where r.id = reconciliation_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all tank lines"
  on public.reconciliation_tank_lines for select
  using (public.is_owner());

-- grade lines: same pattern
create policy "service role writes grade lines"
  on public.reconciliation_grade_lines for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "attendant reads own grade lines"
  on public.reconciliation_grade_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    join public.user_profiles up on up.id = s.attendant_id
    where r.id = reconciliation_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station grade lines"
  on public.reconciliation_grade_lines for select
  using (exists (
    select 1 from public.reconciliations r
    join public.shifts s on s.id = r.shift_id
    where r.id = reconciliation_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all grade lines"
  on public.reconciliation_grade_lines for select
  using (public.is_owner());
