-- Cashiers need UPDATE on shifts to stamp cashier_submitted_at when submitting.
-- Without this policy the update silently affects 0 rows and the shift is never
-- marked as submitted.

create policy "cashier stamps shift submission"
  on public.shifts for update
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'cashier' and is_active = true
    )
  )
  with check (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'cashier' and is_active = true
    )
  );
