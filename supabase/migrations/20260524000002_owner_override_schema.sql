-- Extend ocr_overrides.reading_type to support dry stock correction types.
-- Add owner UPDATE policies on pos_dry_stock_lines and stock_readings.

-- 1. Extend reading_type check constraint
alter table public.ocr_overrides
  drop constraint ocr_overrides_reading_type_check;

alter table public.ocr_overrides
  add constraint ocr_overrides_reading_type_check
  check (reading_type in ('pump', 'dip', 'pos_line', 'dry_stock_line', 'stock_reading'));

-- 2. Owner UPDATE on pos_dry_stock_lines
create policy "owner_dry_stock_lines_update" on pos_dry_stock_lines
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 3. Owner UPDATE on stock_readings
create policy "owner_stock_readings_update" on stock_readings
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());
