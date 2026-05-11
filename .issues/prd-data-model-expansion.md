## Problem Statement

The current data model does not reflect several real-world business operations across the three fuel stations. Specifically:

1. **No cashier role exists** — a distinct employee handles POS Z-report scanning and dry stock inventory at shift end, but the system forces all shift data capture through the supervisor role.
2. **Dry stock (oil/lubricant products) is not tracked** — cashiers manually count shelf stock and reconcile it against POS sales, but this data lives only in spreadsheets.
3. **Fuel prices are station-agnostic** — each station charges different prices per grade, and prices can change mid-day, but the system stores a single universal price with no station scope and no end date.
4. **The shift model allows only two periods per day** — when a fuel price change occurs mid-shift, the correct operational response is to close the current shift and open a new one, but the system's hard `morning`/`evening` constraint prevents this.
5. **Deliveries lack key audit fields** — delivery note numbers and driver names are tracked in spreadsheets but not captured in the system.
6. **Cost price is not stored** — gross margin per grade and per product cannot be computed because only selling price is recorded.
7. **The owner reporting page does not match the existing manual reports** — the current spreadsheet-based reports include daily dip/delivery/sales/variance/GP per grade per station, monthly summaries with price change gain/loss, and an opening stock inventory snapshot valued at cost price.

## Solution

Expand the data model and reporting layer to fully capture the cashier workflow, dry stock inventory lifecycle, per-station versioned fuel prices with date ranges, flexible shift splitting, enriched delivery records, and gross margin data — enabling the owner dashboard reporting page to match the existing manual spreadsheet reports.

## User Stories

### Cashier Role

1. As an owner, I want to create user accounts with a cashier role, so that cashiers can log in and access only their shift workflow.
2. As a cashier, I want to see the current open shift at my station when I log in, so that I know which shift to close out.
3. As a cashier, I want to photograph the POS Z-report at shift end, so that the system can OCR and extract fuel sales lines for reconciliation.
4. As a cashier, I want to confirm or override OCR-extracted POS fuel sales lines, so that the data is accurate before the shift is submitted.
5. As a cashier, I want to photograph the dry stock section of the POS Z-report separately, so that product sales lines can be extracted and reconciled against my stock count.
6. As a cashier, I want to enter a closing stock count per product at shift end, so that the system can compute dry stock variance.
7. As a cashier, I want to record dry stock deliveries received during my shift, so that the stock reconciliation accounts for stock received.
8. As a supervisor, I want to see the cashier's POS and dry stock progress on the shift checklist, so that I know when both tracks are complete before I submit.
9. As a supervisor, I want to be blocked from submitting a shift until the cashier has completed their POS and dry stock tasks, so that reconciliation runs on complete data.
10. As an owner, I want to assign a cashier to a specific station, so that they only see shifts for their station.

### Dry Stock — Product Catalogue

11. As an owner, I want to create named product catalogues (e.g. "Total", "Elegant"), so that stations sharing the same supplier share a single product list.
12. As an owner, I want to assign each station to a product catalogue, so that cashiers at that station see the correct product list.
13. As an owner, I want to add products to a catalogue with stock code, description, cost price, and selling price, so that the system can compute stock value and gross margin.
14. As an owner, I want to deactivate a product, so that it no longer appears on the cashier's stock count form without deleting its history.
15. As an owner, I want to update product cost price and selling price, so that margin calculations stay accurate over time.

### Dry Stock — Baselines

16. As an owner, I want to set an opening stock baseline per product per station, so that the first shift's reconciliation has an opening count to work from.
17. As a system, I want to carry the closing stock count from one shift forward as the opening count for the next shift, so that no manual opening entry is required after the first shift.

### Dry Stock — Shift Capture

18. As a cashier, I want to see a list of all active products for my station's catalogue at shift end, so that I can enter a closing count for each.
19. As a cashier, I want to record units received per product as a delivery at shift end, so that the stock reconciliation is accurate.
20. As a cashier, I want the system to pre-fill the opening stock count from the prior shift's closing count, so that I only need to verify or correct it.

### Dry Stock — Reconciliation

21. As a system, I want to compute expected closing stock as opening stock + deliveries minus POS units sold per product, so that variance can be identified automatically.
22. As a system, I want to compute stock variance in units and ZAR (at selling price) per product per shift, so that the owner can see the financial impact of discrepancies.
23. As a supervisor, I want to see dry stock variance per product on the shift summary page, so that I can flag or override as needed.
24. As an owner, I want dry stock reconciliation to re-run when a post-close override is submitted, so that corrected data flows through to variance figures.

### Fuel Prices — Per Station with Date Ranges

25. As an owner, I want to set a fuel price per grade per station with a valid-from and valid-to date, so that each station's price history is tracked independently.
26. As an owner, I want to enter both cost price and selling price per grade per station, so that gross margin per grade is computable.
27. As a system, I want to look up the fuel price active at the time a shift started, so that reconciliation uses the correct price regardless of subsequent changes.
28. As an owner, I want to be blocked from creating overlapping price ranges for the same grade and station, so that the price lookup is unambiguous.
29. As an owner, I want to view price history per grade per station, so that I can audit past pricing decisions.

### Shift Splitting for Price Changes

30. As a supervisor, I want to close a shift early when a fuel price change takes effect, so that all litres in that shift are reconciled against one price only.
31. As a supervisor, I want to open a new shift immediately after closing an early-terminated shift, so that fuel sales continue to be tracked under the new price.
32. As a system, I want to retroactively relabel the first split shift as "Morning Part 1" when a second shift opens for the same period, so that the report shows a clear pair.
33. As a supervisor, I want to see a shift labelled as "price change" type in the history, so that the reason for the extra shift is clear.
34. As an owner, I want the shift history to show "Morning Part 1 / Morning Part 2" or "Evening Part 1 / Evening Part 2" for split days, so that reports remain readable.
35. As a system, I want the unique constraint on shifts to allow multiple shifts per period per day per station when splits occur, so that price-change shifts can coexist without errors.

### Deliveries — Enrichment

36. As a supervisor, I want to enter a delivery note number when recording a fuel delivery, so that the delivery can be cross-referenced against supplier documentation.
37. As a supervisor, I want to enter the driver's name when recording a fuel delivery, so that the delivery audit trail is complete.
38. As a system, I want to reject a duplicate delivery note number for the same station, so that double-capture of the same delivery is prevented.
39. As an owner, I want to search and filter fuel deliveries by station, date range, and delivery note number, so that I can quickly locate specific delivery records.

### Owner Reporting — Daily Fuel Report

40. As an owner, I want to see a daily report per station showing opening dip, deliveries (note number and driver), POS sales, variance (dip-based vs POS), accumulated variance, and GP per grade, so that it matches the existing spreadsheet format.
41. As an owner, I want the daily report to show each grade in its own column, so that I can compare grade performance side by side.
42. As an owner, I want accumulated variance to roll forward day-by-day within a month, so that I can see if losses are growing or recovering.
43. As an owner, I want GP computed as litres sold multiplied by (selling price minus cost price) per grade per day, so that profitability is visible at a daily level.
44. As an owner, I want average daily sales per grade and total shown at the bottom of the monthly report, so that I can benchmark performance.

### Owner Reporting — Monthly Sales Summary

45. As an owner, I want a monthly sales summary page showing litres sold and GP per grade per station, so that I can see cross-station performance at a glance.
46. As an owner, I want a total GP row across all stations and grades, so that I can assess overall monthly profitability.
47. As an owner, I want a GAIN/LOSS row showing the financial impact of mid-month fuel price changes on tank stock at the time of the change, so that reported GP is adjusted for price change inventory effects.
48. As an owner, I want a "GP After Gain/Loss" total, so that the adjusted profitability figure is immediately visible.

### Owner Reporting — Inventory Snapshot

49. As an owner, I want a dashboard snapshot showing current fuel inventory per tank per station valued at cost price (litres multiplied by cost per litre), based on the most recent closed shift's closing dip, so that I know the monetary value of fuel in the ground.
50. As an owner, I want the inventory snapshot to show litres, cost price per litre, and total value per grade per station, so that I can assess stock position quickly.

### Owner Reporting — Price Change Impact

51. As a system, I want to compute price change gain/loss as the closing dip at the time of price change multiplied by (new price minus old price) per grade per station, so that the financial effect of price changes on inventory is captured.
52. As an owner, I want the monthly report to include price change gain/loss per station, so that the full picture of profitability is visible.

## Implementation Decisions

### Schema Changes

- **`user_profiles.role`**: Add `'cashier'` as a valid role value alongside `'supervisor'` and `'owner'`.
- **`shifts`**: Add `cashier_id uuid` (FK to `user_profiles`), `part smallint not null default 0 check (part in (0, 1, 2))`, `shift_type text not null default 'standard' check (shift_type in ('standard', 'price_change'))`, and `started_at timestamptz not null default now()`. Replace the unique constraint `(station_id, period, shift_date)` with `(station_id, shift_date, period, part)`. When a second shift opens for the same period, the application retroactively sets the first shift's `part` from 0 to 1 and the new shift opens with `part = 2`.
- **`fuel_prices`**: Breaking change — wipe existing rows and restructure: add `station_id uuid not null`, add `cost_per_litre numeric(8,4) not null`, replace `effective_from` with `valid_from timestamptz not null` and `valid_to timestamptz nullable`. Price lookup: `valid_from <= shift.started_at AND (valid_to IS NULL OR valid_to > shift.started_at)`.
- **`deliveries`**: Add `delivery_note_number text not null` with unique constraint `(station_id, delivery_note_number)`. Add `driver_name text`.
- **`stations`**: Add `catalogue_id uuid references product_catalogues(id)`.
- **New `product_catalogues`**: `id uuid`, `name text not null`.
- **New `products`**: `id uuid`, `catalogue_id uuid not null`, `stock_code text`, `description text not null`, `cost_price numeric(10,4) not null`, `sell_price numeric(10,4) not null`, `is_active boolean not null default true`, `created_at timestamptz`.
- **New `stock_baselines`**: Owner-set initial closing count per product per station. Pattern mirrors `shift_baselines`. Fields: `station_id`, `product_id`, `quantity numeric(10,2)`, `set_at`, `set_by`. Unique on `(station_id, product_id)`.
- **New `stock_readings`**: Cashier closing count per product per shift. Fields: `shift_id`, `product_id`, `closing_count numeric(10,2)`. Unique on `(shift_id, product_id)`.
- **New `stock_deliveries`**: Units received per product, recorded by cashier at shift end. Fields: `shift_id`, `station_id`, `product_id`, `quantity numeric(10,2)`, `recorded_by`, `created_at`.
- **New `pos_dry_stock_lines`**: OCR-extracted product sales from the dry stock section of the Z-report. Fields: `pos_submission_id`, `product_id`, `units_sold numeric(10,2)`, `revenue_zar numeric(14,2)`, `ocr_status`.
- **New `reconciliation_stock_lines`**: Per-product dry stock variance. Fields: `reconciliation_id`, `product_id`, `opening_count`, `deliveries_received`, `pos_units_sold`, `expected_closing_count`, `actual_closing_count`, `variance_units`, `variance_zar` (at selling price). Unique on `(reconciliation_id, product_id)`.

### Module Design

- **Shift module**: Extended to support `cashier_id`, `part`, `shift_type`, `started_at`. The shift-open guard (`canStartShift`) is updated to handle the new unique constraint and the retroactive part-update logic for splits.
- **Shift close progress module**: Extended to include a cashier track (POS done + dry stock count done) alongside the existing supervisor track (pumps done + dips done). Supervisor cannot submit until both tracks are green.
- **Fuel price module**: Replaces the existing single-price-per-grade lookup with a per-station, date-range-aware lookup keyed on `(station_id, fuel_grade_id, shift.started_at)`.
- **Product catalogue module**: New — CRUD for `product_catalogues` and `products`. Owner-only writes. Cashier and supervisor read for their station's catalogue.
- **Dry stock baseline module**: New — mirrors the `shift_baselines` port/adapter pattern. `getStockBaselines(stationId)` returns all product baselines for a station. `upsertStockBaseline(stationId, productId, quantity)` sets/updates a baseline. Falls back to baseline when no prior closed shift exists.
- **Dry stock reconciliation module**: New — formula: `expected_closing = opening + deliveries - pos_units_sold`; `variance_units = actual_closing - expected_closing`; `variance_zar = variance_units * sell_price`. Runs as part of the existing reconciliation runner on shift submit, override, or post-close delivery.
- **OCR service**: Extended to extract dry stock product lines from the Z-report in addition to existing fuel grade lines.
- **Owner reports module**: Extended to produce: daily per-grade dip/delivery/sales/variance/GP report; monthly summary with price change gain/loss; inventory snapshot at cost price.
- **Price change gain/loss**: Computed at report time — no stored table. Query: closing dip at the shift boundary where the price changed multiplied by (new_price - old_price) per grade per station.

### RLS

- Cashier policies follow the same station-scoping pattern as supervisor policies (`station_id = my_station_id()`).
- Cashier can read/write: `pos_submissions`, `pos_lines`, `pos_dry_stock_lines`, `stock_readings`, `stock_deliveries`.
- Cashier cannot write: `pump_readings`, `dip_readings`, shift submit action, `ocr_overrides`.

### Shift Label Convention

- `period in ('morning', 'evening')` — preserved as a constrained enum.
- `part`: 0 = no split (display: "Morning" or "Evening"); 1 = first of a split pair (display: "Morning Part 1"); 2 = second of a split pair (display: "Morning Part 2").
- Display label is computed by the application from `(period, part)` — not stored as a free-text field.

### Fuel Price Lookup

- The reconciliation runner and revenue calculations use `shift.started_at` to look up `fuel_prices` where `station_id = shift.station_id AND fuel_grade_id = X AND valid_from <= started_at AND (valid_to IS NULL OR valid_to > started_at)`.
- Existing `fuel_prices` rows will be wiped and re-entered by the owner with station scope and date ranges.

## Testing Decisions

Good tests verify external behaviour — inputs in, outputs out — without asserting on internal implementation. They do not mock the module under test, only its dependencies.

**Modules to test:**

- **Fuel price lookup**: Given a station, grade, and timestamp, assert the correct price row is returned. Test boundary conditions: price exactly at `valid_from`, price exactly at `valid_to`, no price found, overlapping ranges rejected.
- **Dry stock baseline resolver**: Given a station with no prior closed shift, assert it returns the owner-set baseline. Given a prior closed shift, assert it returns that shift's closing count.
- **Dry stock reconciliation formula**: Given opening count, deliveries, POS units sold, and closing count, assert `variance_units` and `variance_zar` are correct. Test negative variance (loss) and zero variance.
- **Shift label computation**: Given `(period, part)` combinations, assert the correct display label is produced.
- **`canStartShift` guard (updated)**: Assert it blocks when a `pending` shift exists for the same `(station_id, shift_date, period, part)`. Assert it allows a part-2 shift when only a part-1 closed shift exists.
- **`canSubmit` progress check (updated)**: Assert that a shift with a complete supervisor track but incomplete cashier track returns false. Assert true only when both tracks are complete.
- **Price change gain/loss computation**: Given a closing dip at price change time and a price delta, assert the correct gain/loss ZAR value.

Prior art for test structure: `reconciliation.test.ts`, `shift-baselines.test.ts`, `shift-close.test.ts`.

## Out of Scope

- Parking income tracking (Truck Stop parking bay) — explicitly excluded.
- Dry stock automated reconciliation against supplier invoices — manual count only.
- Multi-cashier shifts — one cashier per shift only.
- Cashier ability to submit shifts — supervisor submits; cashier completes their track only.
- E2E or browser tests.
- Mobile-native dry stock barcode scanning.
- Automated price change notifications to supervisors.

## Further Notes

- The backfill script (`scripts/backfill-reconciliation.ts`) will need to be re-run after the fuel price migration, since all existing reconciliation records reference the old price model.
- The `fuel_prices` migration is destructive — existing rows will be wiped. Owner must re-enter all station prices with date ranges after applying the migration.
- The dry stock OCR section of the Z-report is physically separate from the fuel section on the same slip. The OCR pipeline will need to distinguish between the two sections during extraction.
- Gross margin (GP) for reporting is always computed as `(sell_price - cost_price) * litres_or_units_sold` — it is not stored, only derived at query time.
- Price change gain/loss is a reporting computation only — no new table is required. It derives from the closing dip at the shift boundary where the price changed, joined to the price change delta.
