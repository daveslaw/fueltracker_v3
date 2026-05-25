-- Fix cashier RLS policies for dry stock tables.
-- The policies in 20260506000007_dry_stock_capture.sql and
-- 20260506000009_schema_corrections.sql used `up.id = auth.uid()`
-- but user_profiles.id is the profile UUID; the auth UUID lives in
-- user_profiles.user_id. This caused all cashier INSERT/UPDATE WITH CHECK
-- conditions to always fail for the dry stock capture workflow.

-- ── stock_readings ────────────────────────────────────────────────────────────

drop policy if exists "cashier_stock_readings_insert" on stock_readings;
drop policy if exists "cashier_stock_readings_update" on stock_readings;
drop policy if exists "station_staff_stock_readings_select" on stock_readings;
drop policy if exists "owner_stock_readings_select" on stock_readings;

create policy "cashier_stock_readings_insert" on stock_readings
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = stock_readings.shift_id
      where up.user_id = auth.uid()
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
      where up.user_id = auth.uid()
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
      where up.user_id = auth.uid()
        and up.station_id = s.station_id
    )
  );

create policy "owner_stock_readings_select" on stock_readings
  for select to authenticated
  using (
    exists (select 1 from user_profiles where user_id = auth.uid() and role = 'owner')
  );

-- ── stock_deliveries ──────────────────────────────────────────────────────────

drop policy if exists "cashier_stock_deliveries_insert" on stock_deliveries;
drop policy if exists "cashier_stock_deliveries_delete" on stock_deliveries;
drop policy if exists "station_staff_stock_deliveries_select" on stock_deliveries;
drop policy if exists "owner_stock_deliveries_select" on stock_deliveries;

create policy "cashier_stock_deliveries_insert" on stock_deliveries
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles
      where user_id = auth.uid()
        and role = 'cashier'
        and station_id = stock_deliveries.station_id
    )
  );

create policy "cashier_stock_deliveries_delete" on stock_deliveries
  for delete to authenticated
  using (
    exists (
      select 1 from user_profiles
      where user_id = auth.uid()
        and role = 'cashier'
        and station_id = stock_deliveries.station_id
    )
  );

create policy "station_staff_stock_deliveries_select" on stock_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where user_id = auth.uid()
        and station_id = stock_deliveries.station_id
    )
  );

create policy "owner_stock_deliveries_select" on stock_deliveries
  for select to authenticated
  using (
    exists (select 1 from user_profiles where user_id = auth.uid() and role = 'owner')
  );

-- ── dry_stock_pos_submissions ─────────────────────────────────────────────────

drop policy if exists "cashier_dry_stock_pos_sub_insert" on dry_stock_pos_submissions;
drop policy if exists "cashier_dry_stock_pos_sub_update" on dry_stock_pos_submissions;
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

-- ── pos_dry_stock_lines ───────────────────────────────────────────────────────

drop policy if exists "cashier_dry_stock_lines_insert" on pos_dry_stock_lines;
drop policy if exists "station_staff_dry_stock_lines_select" on pos_dry_stock_lines;
drop policy if exists "owner_dry_stock_lines_select" on pos_dry_stock_lines;

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
  using (
    exists (select 1 from user_profiles where user_id = auth.uid() and role in ('supervisor', 'owner'))
  );
