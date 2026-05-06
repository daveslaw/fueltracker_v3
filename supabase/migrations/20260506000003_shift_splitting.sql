-- Shift splitting: support multiple parts per period when a fuel price change requires splitting.
-- Adds part, shift_type, started_at columns and replaces the unique constraint.

alter table shifts
  add column part smallint not null default 0 check (part in (0, 1, 2)),
  add column shift_type text not null default 'standard' check (shift_type in ('standard', 'price_change')),
  add column started_at timestamptz not null default now();

-- Replace the existing unique constraint (station_id, period, shift_date) with one that includes part.
alter table shifts
  drop constraint if exists shifts_station_id_period_shift_date_key;

alter table shifts
  add constraint shifts_station_id_shift_date_period_part_key
  unique (station_id, shift_date, period, part);
