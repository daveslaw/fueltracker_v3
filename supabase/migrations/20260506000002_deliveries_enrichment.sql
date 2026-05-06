-- Migration: add delivery_note_number and driver_name to deliveries
--
-- delivery_note_number is required (not null) — existing rows are backfilled
-- with a placeholder so the constraint can be applied without data loss.
-- Unique constraint (station_id, delivery_note_number) prevents double-capture.

alter table deliveries
  add column if not exists delivery_note_number text,
  add column if not exists driver_name          text;

-- Backfill existing rows with a unique placeholder before applying NOT NULL
update deliveries
  set delivery_note_number = 'LEGACY-' || id::text
  where delivery_note_number is null;

alter table deliveries
  alter column delivery_note_number set not null;

create unique index if not exists deliveries_station_note_number_unique
  on deliveries (station_id, delivery_note_number);
