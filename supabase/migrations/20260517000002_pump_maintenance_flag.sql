alter table pump_readings
  add column if not exists maintenance_required boolean not null default false;
