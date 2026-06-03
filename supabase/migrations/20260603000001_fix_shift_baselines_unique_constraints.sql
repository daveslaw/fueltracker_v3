-- Replace partial unique indexes on shift_baselines with regular unique constraints.
--
-- The Supabase JS upsert (onConflict: 'station_id,pump_id') generates:
--   ON CONFLICT (station_id, pump_id) DO UPDATE ...
-- PostgreSQL cannot target a partial unique index without its WHERE predicate,
-- so the upsert was silently failing with error 42P10.
--
-- Regular unique constraints have identical semantics here: PostgreSQL treats
-- NULL != NULL in unique checks, so multiple NULL pump_id rows (i.e. tank rows)
-- per station are still permitted.

drop index if exists public.shift_baselines_pump_unique;
drop index if exists public.shift_baselines_tank_unique;

alter table public.shift_baselines
  add constraint shift_baselines_pump_unique unique (station_id, pump_id);

alter table public.shift_baselines
  add constraint shift_baselines_tank_unique unique (station_id, tank_id);
