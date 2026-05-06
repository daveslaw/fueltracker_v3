-- Dry stock opening count baselines, set by owner per product per station.
-- Used as fallback when no prior closed shift exists for a station.

create table stock_baselines (
  id         uuid        primary key default gen_random_uuid(),
  station_id uuid        not null references stations(id) on delete cascade,
  product_id uuid        not null references products(id) on delete cascade,
  quantity   numeric(10, 3) not null check (quantity >= 0),
  set_at     timestamptz not null default now(),
  set_by     uuid        references auth.users(id) on delete set null,
  unique (station_id, product_id)
);

alter table stock_baselines enable row level security;

-- Owner: full CRUD
create policy "owner_stock_baselines_all" on stock_baselines
  for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );

-- Cashier and supervisor: read for their station
create policy "staff_stock_baselines_read" on stock_baselines
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and role in ('cashier', 'supervisor')
        and station_id = stock_baselines.station_id
    )
  );
