-- Cashiers need read access to pending shifts at their station so the
-- cashier home page can list open shifts.

create policy "cashier reads station shifts"
  on public.shifts for select
  using (
    station_id = public.my_station_id()
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'cashier' and is_active = true
    )
  );
