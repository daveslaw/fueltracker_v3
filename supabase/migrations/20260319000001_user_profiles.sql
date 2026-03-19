-- user_profiles: extends auth.users with role and station assignment
create table public.user_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('attendant', 'supervisor', 'owner')),
  station_id   uuid, -- FK to stations added in Slice 2 migration
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (user_id)
);

-- RLS
alter table public.user_profiles enable row level security;

-- owner can read all profiles
create policy "owner reads all profiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid()
        and up.role = 'owner'
        and up.is_active = true
    )
  );

-- every authenticated user can read their own profile
create policy "users read own profile"
  on public.user_profiles for select
  using (user_id = auth.uid());
