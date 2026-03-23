-- Add submitted_at timestamp to shifts.
-- Set by the server action at the moment of submission; used by the
-- reconciliation engine to look up the price active at that exact moment.
alter table public.shifts
  add column submitted_at timestamptz;
