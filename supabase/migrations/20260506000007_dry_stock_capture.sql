-- Issue #46: Dry stock capture tables.
-- pos_dry_stock_lines: OCR-extracted product sales lines from Z-report dry stock section.
-- stock_readings:      Cashier closing count per product per shift.
-- stock_deliveries:    Units received per product during a shift.

-- ── pos_dry_stock_lines ───────────────────────────────────────────────────────

create table pos_dry_stock_lines (
  id                uuid        primary key default gen_random_uuid(),
  pos_submission_id uuid        not null references pos_submissions(id) on delete cascade,
  product_id        uuid        not null references products(id) on delete restrict,
  units_sold        numeric(10, 3) not null check (units_sold >= 0),
  revenue_zar       numeric(12, 2) not null check (revenue_zar >= 0),
  ocr_status        text        not null default 'extracted'
                                check (ocr_status in ('extracted', 'confirmed', 'overridden', 'manual')),
  created_at        timestamptz not null default now(),
  unique (pos_submission_id, product_id)
);

alter table pos_dry_stock_lines enable row level security;

create policy "cashier_dry_stock_lines_insert" on pos_dry_stock_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join pos_submissions ps on ps.id = pos_dry_stock_lines.pos_submission_id
      join shifts s on s.id = ps.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_dry_stock_lines_select" on pos_dry_stock_lines
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join pos_submissions ps on ps.id = pos_dry_stock_lines.pos_submission_id
      join shifts s on s.id = ps.shift_id
      where up.id = auth.uid()
        and up.station_id = s.station_id
    )
  );

create policy "supervisor_dry_stock_lines_select" on pos_dry_stock_lines
  for select to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('supervisor', 'owner'))
  );

-- ── stock_readings ────────────────────────────────────────────────────────────

create table stock_readings (
  id          uuid           primary key default gen_random_uuid(),
  shift_id    uuid           not null references shifts(id) on delete cascade,
  product_id  uuid           not null references products(id) on delete restrict,
  closing_count numeric(10, 3) not null check (closing_count >= 0),
  recorded_by uuid           references auth.users(id) on delete set null,
  created_at  timestamptz    not null default now(),
  unique (shift_id, product_id)
);

alter table stock_readings enable row level security;

create policy "cashier_stock_readings_insert" on stock_readings
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = stock_readings.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_stock_readings_update" on stock_readings
  for update to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = stock_readings.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "station_staff_stock_readings_select" on stock_readings
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = stock_readings.shift_id
      where up.id = auth.uid()
        and up.station_id = s.station_id
    )
  );

create policy "owner_stock_readings_select" on stock_readings
  for select to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );

-- ── stock_deliveries ──────────────────────────────────────────────────────────

create table stock_deliveries (
  id          uuid           primary key default gen_random_uuid(),
  shift_id    uuid           not null references shifts(id) on delete cascade,
  station_id  uuid           not null references stations(id) on delete cascade,
  product_id  uuid           not null references products(id) on delete restrict,
  quantity    numeric(10, 3) not null check (quantity > 0),
  recorded_by uuid           references auth.users(id) on delete set null,
  created_at  timestamptz    not null default now()
);

alter table stock_deliveries enable row level security;

create policy "cashier_stock_deliveries_insert" on stock_deliveries
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and role = 'cashier'
        and station_id = stock_deliveries.station_id
    )
  );

create policy "cashier_stock_deliveries_delete" on stock_deliveries
  for delete to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and role = 'cashier'
        and station_id = stock_deliveries.station_id
    )
  );

create policy "station_staff_stock_deliveries_select" on stock_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and station_id = stock_deliveries.station_id
    )
  );

create policy "owner_stock_deliveries_select" on stock_deliveries
  for select to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'owner')
  );
