-- Fix cashier RLS policies for pos_submissions and pos_submission_lines.
-- The policies in 20260506000004_cashier_role.sql used `user_profiles.id = auth.uid()`
-- but user_profiles.id is the profile UUID; the auth UUID lives in user_profiles.user_id.
-- This caused the INSERT WITH CHECK to always fail for cashiers saving fuel Z-reports.
-- Also adds missing UPDATE policy (needed when cashier re-saves) and policies on
-- pos_submission_lines (INSERT + DELETE needed by saveCashierFuelPos).

drop policy if exists "cashier_pos_submissions_insert" on pos_submissions;
drop policy if exists "cashier_pos_submissions_select" on pos_submissions;

create policy "cashier_pos_submissions_insert" on pos_submissions
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = pos_submissions.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_pos_submissions_update" on pos_submissions
  for update to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = pos_submissions.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_pos_submissions_select" on pos_submissions
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join shifts s on s.id = pos_submissions.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

-- pos_submission_lines: cashier needs INSERT (write lines) and DELETE (clear before re-save)
create policy "cashier_pos_submission_lines_insert" on pos_submission_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from user_profiles up
      join pos_submissions ps on ps.id = pos_submission_lines.pos_submission_id
      join shifts s on s.id = ps.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_pos_submission_lines_delete" on pos_submission_lines
  for delete to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join pos_submissions ps on ps.id = pos_submission_lines.pos_submission_id
      join shifts s on s.id = ps.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );

create policy "cashier_pos_submission_lines_select" on pos_submission_lines
  for select to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join pos_submissions ps on ps.id = pos_submission_lines.pos_submission_id
      join shifts s on s.id = ps.shift_id
      where up.user_id = auth.uid()
        and up.role = 'cashier'
        and up.station_id = s.station_id
    )
  );
