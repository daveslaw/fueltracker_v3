-- Surface assembly warnings from reconciliation runs.
-- Nullable jsonb array of { code, detail } objects; null means clean run.
alter table shifts
  add column if not exists reconciliation_warnings jsonb default null;
