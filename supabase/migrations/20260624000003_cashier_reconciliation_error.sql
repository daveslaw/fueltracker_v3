-- Surface dry stock reconciliation failure on cashier shift summary.
-- Nullable text; null means clean run or not yet submitted.
alter table shifts
  add column if not exists cashier_reconciliation_error text default null;
