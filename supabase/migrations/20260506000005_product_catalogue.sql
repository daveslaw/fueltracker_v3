-- Dry stock product catalogue.
-- product_catalogues are shared; each station is linked to one catalogue.

create table product_catalogues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  catalogue_id uuid not null references product_catalogues(id) on delete cascade,
  stock_code text not null,
  description text not null,
  cost_price numeric(10, 2) not null check (cost_price >= 0),
  sell_price numeric(10, 2) not null check (sell_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (catalogue_id, stock_code)
);

-- Link each station to a catalogue (nullable — not all stations use dry stock).
alter table stations
  add column catalogue_id uuid references product_catalogues(id) on delete set null;

-- RLS

alter table product_catalogues enable row level security;
alter table products enable row level security;

-- Owner: full CRUD
create policy "owner_catalogues_all" on product_catalogues
  for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );

create policy "owner_products_all" on products
  for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );

-- Cashier + supervisor: read-only for their station's catalogue products
create policy "station_user_products_select" on products
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join stations s on s.id = up.station_id
      where up.id = auth.uid()
        and up.role in ('cashier', 'supervisor')
        and s.catalogue_id = products.catalogue_id
    )
  );

create policy "station_user_catalogues_select" on product_catalogues
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join stations s on s.id = up.station_id
      where up.id = auth.uid()
        and up.role in ('cashier', 'supervisor')
        and s.catalogue_id = product_catalogues.id
    )
  );
