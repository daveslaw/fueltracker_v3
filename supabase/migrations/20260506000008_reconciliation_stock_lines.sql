-- Issue #47: Dry stock reconciliation results table.
-- Written by service role only; supervisor and owner can read.

create table reconciliation_stock_lines (
  id                     uuid           primary key default gen_random_uuid(),
  reconciliation_id      uuid           not null references reconciliations(id) on delete cascade,
  product_id             uuid           not null references products(id) on delete restrict,
  opening_count          numeric(10, 3) not null,
  deliveries_received    numeric(10, 3) not null default 0,
  pos_units_sold         numeric(10, 3) not null default 0,
  expected_closing_count numeric(10, 3) not null,
  actual_closing_count   numeric(10, 3) not null,
  variance_units         numeric(10, 3) not null,
  variance_zar           numeric(12, 2) not null,
  unique (reconciliation_id, product_id)
);

alter table reconciliation_stock_lines enable row level security;

-- Written by service role (reconciliation runner) — no authenticated insert policy needed.

create policy "supervisor_stock_lines_select" on reconciliation_stock_lines
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join reconciliations r on r.id = reconciliation_stock_lines.reconciliation_id
      join shifts s on s.id = r.shift_id
      where up.id = auth.uid()
        and up.station_id = s.station_id
        and up.role in ('supervisor', 'cashier')
    )
  );

create policy "owner_stock_lines_select" on reconciliation_stock_lines
  for select to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );
