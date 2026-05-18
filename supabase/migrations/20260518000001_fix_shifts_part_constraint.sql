-- The shift_splitting migration (20260506000003) tried to drop
-- "shifts_station_id_period_shift_date_key" but the constraint added by
-- shift_redesign was actually named "shifts_station_period_date_unique".
-- The IF EXISTS swallowed the mismatch, so the old constraint was never removed.
-- This migration drops the stale constraint so split shifts (part 1 + part 2 on
-- the same date/period) can be inserted without violating the unique check.

alter table public.shifts
  drop constraint if exists shifts_station_period_date_unique;
