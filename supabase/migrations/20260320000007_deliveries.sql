-- deliveries: fuel receipts recorded by supervisors
create table public.deliveries (
  id                uuid primary key default gen_random_uuid(),
  station_id        uuid not null references public.stations(id) on delete cascade,
  tank_id           uuid not null references public.tanks(id),
  litres_received   numeric(10, 2) not null check (litres_received > 0),
  delivery_note_url text,
  delivered_at      timestamptz not null default now(),
  recorded_by       uuid references public.user_profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.deliveries (station_id, delivered_at desc);
create index on public.deliveries (tank_id, delivered_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.deliveries enable row level security;

-- Supervisors can create and edit deliveries at their own station
create policy "supervisor manages station deliveries"
  on public.deliveries for all
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

-- Owners can read all deliveries across all stations
create policy "owner reads all deliveries"
  on public.deliveries for select
  using (public.is_owner());

-- Owners can also create/edit deliveries (for corrections)
create policy "owner manages all deliveries"
  on public.deliveries for all
  using (public.is_owner())
  with check (public.is_owner());

-- Attendants have no access to deliveries
