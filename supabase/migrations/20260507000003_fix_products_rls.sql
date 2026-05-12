-- Fix RLS policies introduced in 20260506000009_schema_corrections.sql.
-- All three policy groups used `id = auth.uid()` against user_profiles, but
-- user_profiles.id is the profile's own UUID — the auth UUID lives in user_id.
-- Also aligns owner policies with the is_owner() / my_station_id() helpers used
-- in later migrations (20260507000002).

-- ── 1. products ───────────────────────────────────────────────────────────────

drop policy if exists "owner_products_all"             on products;
drop policy if exists "station_staff_products_select"  on products;

create policy "owner_products_all" on products
  for all to authenticated
  using  (public.is_owner())
  with check (public.is_owner());

create policy "station_staff_products_select" on products
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

-- ── 2. dry_stock_pos_submissions ─────────────────────────────────────────────

drop policy if exists "cashier_dry_stock_pos_sub_insert"       on dry_stock_pos_submissions;
drop policy if exists "cashier_dry_stock_pos_sub_update"       on dry_stock_pos_submissions;
drop policy if exists "station_staff_dry_stock_pos_sub_select" on dry_stock_pos_submissions;

create policy "cashier_dry_stock_pos_sub_insert" on dry_stock_pos_submissions
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = dry_stock_pos_submissions.shift_id
      where up.user_id = auth.uid()
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
      where up.user_id = auth.uid()
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
      where up.user_id = auth.uid()
        and up.station_id = s.station_id
    )
  );

-- ── 3. pos_dry_stock_lines ────────────────────────────────────────────────────

drop policy if exists "cashier_dry_stock_lines_insert"       on pos_dry_stock_lines;
drop policy if exists "station_staff_dry_stock_lines_select" on pos_dry_stock_lines;
drop policy if exists "owner_dry_stock_lines_select"         on pos_dry_stock_lines;

create policy "cashier_dry_stock_lines_insert" on pos_dry_stock_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join dry_stock_pos_submissions dsps on dsps.id = pos_dry_stock_lines.dry_stock_pos_submission_id
      join shifts s on s.id = dsps.shift_id
      where up.user_id = auth.uid()
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
      where up.user_id = auth.uid()
        and up.station_id = s.station_id
    )
  );

create policy "owner_dry_stock_lines_select" on pos_dry_stock_lines
  for select to authenticated
  using (public.is_owner());
