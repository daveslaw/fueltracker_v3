-- Issue #49: Three schema corrections.
--
-- 1. Convert products from shared-catalogue to per-station.
-- 2. Add dry_stock_pos_submissions table; rewire pos_dry_stock_lines FK.
-- 3. Add cashier_submitted_at to shifts.

-- ── 1. Products per-station ───────────────────────────────────────────────────

-- Remove the catalogue link from stations first (FK must go before table drop).
alter table stations drop column if exists catalogue_id cascade;

-- Attach station_id directly to products.
alter table products add column station_id uuid references stations(id) on delete cascade;

-- Mark station_id not-null after backfill (no rows exist in migrations; safe).
alter table products alter column station_id set not null;

-- Drop the old FK column and orphaned table.
alter table products drop column catalogue_id;
drop table if exists product_catalogues;

-- Replace RLS: owner full CRUD scoped to any station; station staff read-only.
drop policy if exists "owner_products_all"          on products;
drop policy if exists "station_user_products_select" on products;
-- policy "owner_catalogues_all" dropped via cascade above

create policy "owner_products_all" on products
  for all to authenticated
  using  (exists (select 1 from user_profiles where id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'owner'));

create policy "station_staff_products_select" on products
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and role in ('cashier', 'supervisor')
        and station_id = products.station_id
    )
  );

-- stock_baselines RLS references station_id on products — no change needed there.

-- ── 2. dry_stock_pos_submissions + rewire pos_dry_stock_lines ─────────────────

create table dry_stock_pos_submissions (
  id         uuid        primary key default gen_random_uuid(),
  shift_id   uuid        not null references shifts(id) on delete cascade,
  photo_url  text,
  ocr_status text        not null default 'pending'
                         check (ocr_status in ('pending', 'extracted', 'confirmed', 'manual', 'failed')),
  created_at timestamptz not null default now(),
  unique (shift_id)
);

alter table dry_stock_pos_submissions enable row level security;

create policy "cashier_dry_stock_pos_sub_insert" on dry_stock_pos_submissions
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = dry_stock_pos_submissions.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_dry_stock_pos_sub_update" on dry_stock_pos_submissions
  for update to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = dry_stock_pos_submissions.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "station_staff_dry_stock_pos_sub_select" on dry_stock_pos_submissions
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = dry_stock_pos_submissions.shift_id
      where up.id = auth.uid()
        and up.station_id = s.station_id
    )
  );

-- Rewire pos_dry_stock_lines: drop old FK, add new FK to dry_stock_pos_submissions.
alter table pos_dry_stock_lines
  add column dry_stock_pos_submission_id uuid references dry_stock_pos_submissions(id) on delete cascade;

-- Existing rows have no dry_stock_pos_submissions; make nullable initially, then
-- drop old column. (No prod data in migrations; safe.)
alter table pos_dry_stock_lines drop column pos_submission_id cascade;

alter table pos_dry_stock_lines
  alter column dry_stock_pos_submission_id set not null;

-- Unique constraint was on (pos_submission_id, product_id); recreate.
alter table pos_dry_stock_lines
  add constraint pos_dry_stock_lines_unique unique (dry_stock_pos_submission_id, product_id);

-- Update RLS policies on pos_dry_stock_lines to use new FK path.
drop policy if exists "cashier_dry_stock_lines_insert" on pos_dry_stock_lines;
drop policy if exists "cashier_dry_stock_lines_select" on pos_dry_stock_lines;
drop policy if exists "supervisor_dry_stock_lines_select" on pos_dry_stock_lines;

create policy "cashier_dry_stock_lines_insert" on pos_dry_stock_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join dry_stock_pos_submissions dsps on dsps.id = pos_dry_stock_lines.dry_stock_pos_submission_id
      join shifts s on s.id = dsps.shift_id
      where up.id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "station_staff_dry_stock_lines_select" on pos_dry_stock_lines
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join dry_stock_pos_submissions dsps on dsps.id = pos_dry_stock_lines.dry_stock_pos_submission_id
      join shifts s on s.id = dsps.shift_id
      where up.id = auth.uid()
        and up.station_id = s.station_id
    )
  );

create policy "owner_dry_stock_lines_select" on pos_dry_stock_lines
  for select to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role in ('supervisor', 'owner'))
  );

-- ── 3. cashier_submitted_at on shifts ────────────────────────────────────────

alter table shifts
  add column if not exists cashier_submitted_at timestamptz;
