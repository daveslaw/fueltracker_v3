-- Add cashier as a valid role in user_profiles.
-- Cashiers are station-scoped and route to /cashier dashboard.

alter table user_profiles
  drop constraint if exists user_profiles_role_check;

alter table user_profiles
  add constraint user_profiles_role_check
  check (role in ('owner', 'supervisor', 'cashier'));

-- RLS: cashier can read/write pos_submissions, pos_lines for their station.
-- Cashier cannot write pump_readings, dip_readings, or ocr_overrides.

-- pos_submissions: allow cashier insert/select for their station
create policy "cashier_pos_submissions_insert"
  on pos_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'cashier'
        and user_profiles.station_id = (
          select station_id from shifts where shifts.id = pos_submissions.shift_id
        )
    )
  );

create policy "cashier_pos_submissions_select"
  on pos_submissions
  for select
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'cashier'
        and user_profiles.station_id = (
          select station_id from shifts where shifts.id = pos_submissions.shift_id
        )
    )
  );
