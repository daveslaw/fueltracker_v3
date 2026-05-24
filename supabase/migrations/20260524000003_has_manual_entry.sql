-- Add has_manual_entry flag to shifts.
-- Set by server actions when a pump reading, POS submission line, or override
-- is saved with a non-auto OCR status. Write-once — never reset to false.

alter table shifts
  add column has_manual_entry boolean not null default false;
