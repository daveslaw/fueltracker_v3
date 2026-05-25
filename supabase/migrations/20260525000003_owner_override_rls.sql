-- Owner override RLS: add UPDATE policies so owners can actually mutate
-- pump_readings, dip_readings, pos_submission_lines, and shifts.has_manual_entry
-- when applying post-close corrections via the shift history page.
--
-- Without these, applyMutation silently affected 0 rows (RLS filter, no error),
-- the audit record was still inserted, but the reading was never changed.

-- pump_readings: owner can update any reading (not scoped to station_id because
-- pump_readings has no direct station_id column; shift join provides the scope
-- but owners see all stations anyway).
create policy "owner updates pump readings"
  on public.pump_readings for update
  using (public.is_owner())
  with check (public.is_owner());

-- dip_readings: same pattern
create policy "owner updates dip readings"
  on public.dip_readings for update
  using (public.is_owner())
  with check (public.is_owner());

-- pos_submission_lines: owner can update (litres_sold, revenue_zar for POS overrides)
create policy "owner updates pos submission lines"
  on public.pos_submission_lines for update
  using (public.is_owner())
  with check (public.is_owner());

-- shifts: owner can update has_manual_entry (set by setManualEntry after override)
create policy "owner updates shift flags"
  on public.shifts for update
  using (public.is_owner())
  with check (public.is_owner());
