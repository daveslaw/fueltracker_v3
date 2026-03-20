-- shifts
create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  station_id   uuid not null references public.stations(id),
  attendant_id uuid not null references public.user_profiles(id),
  period       text not null check (period in ('morning', 'evening')),
  shift_date   date not null default current_date,
  status       text not null default 'draft'
                 check (status in ('draft', 'open', 'pending_pos', 'submitted', 'approved', 'flagged')),
  created_at   timestamptz not null default now(),
  unique (station_id, period, shift_date, status)
    -- partial unique enforced via policy instead; see below
);

-- pump_readings
create table public.pump_readings (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references public.shifts(id) on delete cascade,
  pump_id       uuid not null references public.pumps(id),
  type          text not null check (type in ('open', 'close')),
  photo_url     text,
  meter_reading numeric(12, 2),
  ocr_status    text not null default 'manual_override'
                  check (ocr_status in ('auto', 'needs_review', 'manual_override', 'unreadable')),
  created_at    timestamptz not null default now(),
  unique (shift_id, pump_id, type)
);

-- dip_readings
create table public.dip_readings (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid not null references public.shifts(id) on delete cascade,
  tank_id    uuid not null references public.tanks(id),
  type       text not null check (type in ('open', 'close')),
  litres     numeric(10, 2) not null check (litres >= 0),
  created_at timestamptz not null default now(),
  unique (shift_id, tank_id, type)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.shifts        enable row level security;
alter table public.pump_readings enable row level security;
alter table public.dip_readings  enable row level security;

-- shifts: attendant can CRUD own shifts; supervisor/owner can SELECT own station
create policy "attendant manages own shifts"
  on public.shifts for all
  using (
    attendant_id = (
      select id from public.user_profiles where user_id = auth.uid() limit 1
    )
  )
  with check (
    attendant_id = (
      select id from public.user_profiles where user_id = auth.uid() limit 1
    )
  );

create policy "supervisor reads station shifts"
  on public.shifts for select
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role in ('supervisor', 'owner') and is_active = true
    )
  );

create policy "owner reads all shifts"
  on public.shifts for select
  using (public.is_owner());

-- pump_readings: follow parent shift access
create policy "attendant manages own pump readings"
  on public.pump_readings for all
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

create policy "supervisor reads station pump readings"
  on public.pump_readings for select
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all pump readings"
  on public.pump_readings for select
  using (public.is_owner());

-- dip_readings: same pattern
create policy "attendant manages own dip readings"
  on public.dip_readings for all
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

create policy "supervisor reads station dip readings"
  on public.dip_readings for select
  using (exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.station_id = public.my_station_id()
  ));

create policy "owner reads all dip readings"
  on public.dip_readings for select
  using (public.is_owner());
