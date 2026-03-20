-- fuel_grades: lookup table, seeded
create table public.fuel_grades (
  id    text primary key,  -- '95', '93', 'D10', 'D50'
  label text not null
);

insert into public.fuel_grades (id, label) values
  ('95',  'Petrol 95'),
  ('93',  'Petrol 93'),
  ('D10', 'Diesel 10ppm'),
  ('D50', 'Diesel 50ppm');

-- stations
create table public.stations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

-- tanks
create table public.tanks (
  id             uuid primary key default gen_random_uuid(),
  station_id     uuid not null references public.stations(id) on delete cascade,
  label          text not null,
  fuel_grade_id  text not null references public.fuel_grades(id),
  capacity_litres numeric(10,2) not null check (capacity_litres > 0),
  created_at     timestamptz not null default now()
);

-- pumps
create table public.pumps (
  id         uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  tank_id    uuid not null references public.tanks(id),
  label      text not null,
  created_at timestamptz not null default now()
);

-- add station_id FK to user_profiles now that stations table exists
alter table public.user_profiles
  add constraint user_profiles_station_id_fkey
  foreign key (station_id) references public.stations(id) on delete set null;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.stations   enable row level security;
alter table public.tanks      enable row level security;
alter table public.pumps      enable row level security;
alter table public.fuel_grades enable row level security;

-- fuel_grades: readable by all authenticated users
create policy "authenticated users read fuel grades"
  on public.fuel_grades for select
  using (auth.role() = 'authenticated');

-- helper: is the caller an active owner?
create or replace function public.is_owner()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

-- helper: station the caller belongs to
create or replace function public.my_station_id()
returns uuid language sql security definer as $$
  select station_id from public.user_profiles
  where user_id = auth.uid()
    and is_active = true
  limit 1;
$$;

-- stations
create policy "owner crud stations"
  on public.stations for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "staff select own station"
  on public.stations for select
  using (id = public.my_station_id());

-- tanks
create policy "owner crud tanks"
  on public.tanks for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "staff select own station tanks"
  on public.tanks for select
  using (station_id = public.my_station_id());

-- pumps
create policy "owner crud pumps"
  on public.pumps for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "staff select own station pumps"
  on public.pumps for select
  using (station_id = public.my_station_id());
