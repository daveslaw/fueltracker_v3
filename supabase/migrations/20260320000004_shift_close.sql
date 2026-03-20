-- pos_submissions: one per shift, holds the Z-report photo + raw OCR output
create table public.pos_submissions (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid not null references public.shifts(id) on delete cascade unique,
  photo_url  text,
  raw_ocr    jsonb,
  created_at timestamptz not null default now()
);

-- pos_submission_lines: one row per fuel grade confirmed by attendant
create table public.pos_submission_lines (
  id                  uuid primary key default gen_random_uuid(),
  pos_submission_id   uuid not null references public.pos_submissions(id) on delete cascade,
  fuel_grade_id       text not null references public.fuel_grades(id),
  litres_sold         numeric(10, 2) not null check (litres_sold >= 0),
  revenue_zar         numeric(12, 2) not null check (revenue_zar >= 0),
  created_at          timestamptz not null default now(),
  unique (pos_submission_id, fuel_grade_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.pos_submissions      enable row level security;
alter table public.pos_submission_lines enable row level security;

-- pos_submissions: attendant can manage own; supervisor/owner can select
create policy "attendant manages own pos submissions"
  on public.pos_submissions for all
  using (exists (
    select 1 from public.shifts s
    join public.user_profiles up on up.id = s.attendant_id
    where s.id = shift_id and up.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.shifts s
    join public.user_profiles up on up.id = s.attendant_id
    where s.id = shift_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station pos submissions"
  on public.pos_submissions for select
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all pos submissions"
  on public.pos_submissions for select
  using (public.is_owner());

-- pos_submission_lines: inherit parent access
create policy "attendant manages own pos lines"
  on public.pos_submission_lines for all
  using (exists (
    select 1 from public.pos_submissions ps
    join public.shifts s on s.id = ps.shift_id
    join public.user_profiles up on up.id = s.attendant_id
    where ps.id = pos_submission_id and up.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.pos_submissions ps
    join public.shifts s on s.id = ps.shift_id
    join public.user_profiles up on up.id = s.attendant_id
    where ps.id = pos_submission_id and up.user_id = auth.uid()
  ));

create policy "supervisor reads station pos lines"
  on public.pos_submission_lines for select
  using (exists (
    select 1 from public.pos_submissions ps
    join public.shifts s on s.id = ps.shift_id
    where ps.id = pos_submission_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all pos lines"
  on public.pos_submission_lines for select
  using (public.is_owner());
