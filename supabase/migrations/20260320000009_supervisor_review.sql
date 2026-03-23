-- ── ocr_overrides: audit trail for post-submission value corrections ──────────
-- reading_type: 'pump' = pump_readings row; 'pos_line' = pos_submission_lines row
create table public.ocr_overrides (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts(id) on delete cascade,
  reading_id     uuid not null,   -- FK to pump_readings.id or pos_submission_lines.id
  reading_type   text not null check (reading_type in ('pump', 'pos_line')),
  original_value numeric(14, 2) not null,
  override_value numeric(14, 2) not null,
  reason         text not null,
  overridden_by  uuid not null references public.user_profiles(id),
  created_at     timestamptz not null default now()
);

create index on public.ocr_overrides (shift_id);

-- ── RLS for ocr_overrides ─────────────────────────────────────────────────────

alter table public.ocr_overrides enable row level security;

-- Supervisors can create overrides for shifts at their station
create policy "supervisor creates overrides"
  on public.ocr_overrides for insert
  with check (
    exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.station_id = public.my_station_id()
    )
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'supervisor' and is_active = true
    )
  );

create policy "supervisor reads station overrides"
  on public.ocr_overrides for select
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all overrides"
  on public.ocr_overrides for select
  using (public.is_owner());

create policy "owner creates overrides"
  on public.ocr_overrides for insert
  with check (public.is_owner());

-- ── Grant supervisors UPDATE on shifts for approve/flag transitions ────────────
-- Current policy only allows SELECT for supervisors. We need targeted UPDATE
-- for status + flagging note only.
create policy "supervisor updates station shift status"
  on public.shifts for update
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

-- ── Add flag_comment column to shifts ────────────────────────────────────────
alter table public.shifts
  add column flag_comment text;
