-- Migration: restructure fuel_prices for per-station date-range pricing
--
-- Breaking change:
--   - Wipes all existing fuel_prices rows (owner must re-enter with station scope)
--   - Adds station_id, cost_per_litre, valid_from, valid_to
--   - Drops effective_from and price_per_litre
--   - Adds started_at to shifts (used for price lookup instead of submitted_at)
--   - Renames price_per_litre → sell_price_per_litre in reconciliation_grade_lines

-- ── 1. shifts: add started_at ─────────────────────────────────────────────────

alter table shifts
  add column if not exists started_at timestamptz not null default now();

-- Backfill: set started_at from created_at for existing shifts
update shifts set started_at = created_at where started_at = now();

-- ── 2. fuel_prices: restructure ───────────────────────────────────────────────

-- Wipe existing rows — owner must re-enter with station scope and date ranges
truncate table fuel_prices;

-- Drop old columns
alter table fuel_prices
  drop column if exists price_per_litre,
  drop column if exists effective_from;

-- Add new columns
alter table fuel_prices
  add column station_id         uuid          not null references stations(id) on delete cascade,
  add column sell_price_per_litre numeric(8,4) not null check (sell_price_per_litre > 0),
  add column cost_per_litre      numeric(8,4) not null check (cost_per_litre > 0),
  add column valid_from          timestamptz  not null,
  add column valid_to            timestamptz;

-- Index for the price lookup: station + grade + valid_from
create index if not exists fuel_prices_station_grade_from
  on fuel_prices (station_id, fuel_grade_id, valid_from desc);

-- ── 3. reconciliation_grade_lines: rename price_per_litre ────────────────────

alter table reconciliation_grade_lines
  rename column price_per_litre to sell_price_per_litre;

-- ── 4. RLS: extend fuel_prices policies for station_id ───────────────────────

-- Drop existing policies if they exist (re-create with station scoping)
drop policy if exists "Owners can manage fuel_prices" on fuel_prices;
drop policy if exists "All authenticated users can read fuel_prices" on fuel_prices;

create policy "Owners can manage fuel_prices"
  on fuel_prices for all
  using (is_owner())
  with check (is_owner());

create policy "All authenticated users can read fuel_prices"
  on fuel_prices for select
  using (auth.role() = 'authenticated');
