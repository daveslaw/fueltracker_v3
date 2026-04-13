-- ── Shift Redesign Migration ──────────────────────────────────────────────────
-- Moves to a close-only model: supervisor captures readings at shift end only.
-- State machine simplifies to: pending → closed (is_flagged is a property).
-- Attendant role is retired; supervisor owns all shift data capture.
--
-- Steps:
--   1. Archive all existing shift rows
--   2. Clear the live shifts table (cascades to all related rows)
--   3. Update shifts schema for the new model
--   4. Create shift_baselines table
--   5. Replace attendant-based RLS policies with supervisor-based ones

-- ── 1. Create shifts_archive ─────────────────────────────────────────────────

create table public.shifts_archive (
  id            uuid,
  station_id    uuid,
  attendant_id  uuid,
  period        text,
  shift_date    date,
  status        text,
  created_at    timestamptz,
  submitted_at  timestamptz,
  flag_comment  text
);

insert into public.shifts_archive
  select id, station_id, attendant_id, period, shift_date,
         status, created_at, submitted_at, flag_comment
  from public.shifts;

-- ── 2. Clear live shifts (cascades to pump_readings, dip_readings, ────────────
--       pos_submissions, reconciliation_records, ocr_overrides, etc.)

delete from public.shifts;

-- ── 3. Update shifts schema ───────────────────────────────────────────────────

-- Drop the existing status check constraint
alter table public.shifts
  drop constraint shifts_status_check;

-- Drop the existing unique constraint (station_id, period, shift_date, status)
alter table public.shifts
  drop constraint shifts_station_id_period_shift_date_status_key;

-- attendant_id is retired in the new model; make nullable for schema hygiene
alter table public.shifts
  alter column attendant_id drop not null;

-- New status values: pending (awaiting supervisor close) and closed (complete)
alter table public.shifts
  add constraint shifts_status_check
    check (status in ('pending', 'closed')),
  alter column status set default 'pending';

-- supervisor_id replaces attendant_id as the acting user
alter table public.shifts
  add column supervisor_id uuid references public.user_profiles(id);

-- is_flagged: supervisor-raised discrepancy flag (property, not a state)
alter table public.shifts
  add column is_flagged boolean not null default false;

-- flag_comment already added in migration 0009 — no change needed

-- One shift per station/period/date (no duplicates regardless of status)
alter table public.shifts
  add constraint shifts_station_period_date_unique
    unique (station_id, period, shift_date);

-- ── 4. Create shift_baselines ─────────────────────────────────────────────────
-- Stores owner-set initial readings for the first shift at each station.
-- The reconciliation runner falls back to these when no prior closed shift exists.

create table public.shift_baselines (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references public.stations(id),
  pump_id       uuid references public.pumps(id),
  tank_id       uuid references public.tanks(id),
  reading_type  text not null check (reading_type in ('meter', 'dip')),
  value         numeric(12, 2) not null check (value >= 0),
  set_at        timestamptz not null default now(),
  set_by        uuid references public.user_profiles(id),
  constraint shift_baselines_pump_xor_tank
    check (
      (pump_id is not null and tank_id is null and reading_type = 'meter') or
      (tank_id is not null and pump_id is null and reading_type = 'dip')
    )
);

-- One baseline per pump or tank per station
create unique index shift_baselines_pump_unique
  on public.shift_baselines (station_id, pump_id)
  where pump_id is not null;

create unique index shift_baselines_tank_unique
  on public.shift_baselines (station_id, tank_id)
  where tank_id is not null;

alter table public.shift_baselines enable row level security;

create policy "owner manages shift baselines"
  on public.shift_baselines for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "supervisor reads station baselines"
  on public.shift_baselines for select
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'supervisor' and is_active = true
    )
  );

-- ── 5. Replace attendant-based RLS with supervisor-based ─────────────────────

-- shifts: drop old attendant + supervisor policies; replace with supervisor-owns
drop policy "attendant manages own shifts" on public.shifts;
drop policy "supervisor reads station shifts" on public.shifts;
drop policy "supervisor updates station shift status" on public.shifts;

create policy "supervisor manages station shifts"
  on public.shifts for all
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'supervisor' and is_active = true
    )
  )
  with check (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'supervisor' and is_active = true
    )
  );

-- pump_readings: drop attendant policy; add supervisor full-access policy
drop policy "attendant manages own pump readings" on public.pump_readings;

create policy "supervisor manages station pump readings"
  on public.pump_readings for all
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id
      and s.station_id = public.my_station_id()
      and exists (
        select 1 from public.user_profiles
        where user_id = auth.uid() and role = 'supervisor' and is_active = true
      )
  ))
  with check (exists (
    select 1 from public.shifts s
    where s.id = shift_id
      and s.station_id = public.my_station_id()
      and exists (
        select 1 from public.user_profiles
        where user_id = auth.uid() and role = 'supervisor' and is_active = true
      )
  ));

-- dip_readings: drop attendant policy; add supervisor full-access policy
drop policy "attendant manages own dip readings" on public.dip_readings;

create policy "supervisor manages station dip readings"
  on public.dip_readings for all
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id
      and s.station_id = public.my_station_id()
      and exists (
        select 1 from public.user_profiles
        where user_id = auth.uid() and role = 'supervisor' and is_active = true
      )
  ))
  with check (exists (
    select 1 from public.shifts s
    where s.id = shift_id
      and s.station_id = public.my_station_id()
      and exists (
        select 1 from public.user_profiles
        where user_id = auth.uid() and role = 'supervisor' and is_active = true
      )
  ));
