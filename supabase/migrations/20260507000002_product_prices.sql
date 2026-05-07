-- Issue #60: Versioned pricing for dry stock products.
--
-- 1. Create product_prices table (mirrors fuel_prices versioning pattern).
-- 2. Seed one open-ended price record per existing product from current
--    products.cost_price / products.sell_price values.
-- 3. Drop cost_price and sell_price columns from products.
-- 4. RLS: owner full CRUD; cashier/supervisor read-only scoped to their station.

-- ── 1. product_prices ─────────────────────────────────────────────────────────

create table product_prices (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references products(id) on delete cascade,
  station_id uuid        not null references stations(id) on delete cascade,
  cost_price numeric(10, 2) not null check (cost_price >= 0),
  sell_price numeric(10, 2) not null check (sell_price >= 0),
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,
  set_by     uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Lookup index: product + station, most-recent first
create index product_prices_product_station_from
  on product_prices (product_id, station_id, valid_from desc);

-- ── 2. Seed from existing products ───────────────────────────────────────────

insert into product_prices (product_id, station_id, cost_price, sell_price, valid_from)
select id, station_id, cost_price, sell_price, now()
from products;

-- ── 3. Drop static price columns from products ────────────────────────────────

alter table products drop column cost_price;
alter table products drop column sell_price;

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

alter table product_prices enable row level security;

create policy "owner_product_prices_all" on product_prices
  for all to authenticated
  using  (public.is_owner())
  with check (public.is_owner());

create policy "station_staff_product_prices_select" on product_prices
  for select to authenticated
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from user_profiles
      where user_id = auth.uid()
        and role in ('cashier', 'supervisor')
        and is_active = true
    )
  );
