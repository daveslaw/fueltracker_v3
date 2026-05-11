## Problem Statement

Supervisors currently own the entire shift close workflow: pump meter readings, tank dips, and POS Z-report capture. This conflates two distinct jobs — fuel inventory (supervisor domain) and sales reconciliation (cashier domain). There is no way for a cashier to independently submit their POS and dry stock data, no dry stock capture pipeline at all, and no owner-facing dry stock variance reporting. The cashier role exists in the database but has no UI.

## Solution

Introduce a dedicated cashier workflow under `/cashier` where cashiers log into an existing supervisor-created shift, capture their fuel POS Z-report and dry stock Z-report (via Anthropic Vision OCR, two separate photos), enter closing stock counts, record stock deliveries, and submit their section independently. The supervisor's close flow is simplified to pumps and dips only. Owners gain a product catalogue config page and a separate dry stock variance report.

## User Stories

### Cashier — Landing & Shift Selection
1. As a cashier, I want to see a list of open shifts at my station when I log in, so that I can pick the shift I am working.
2. As a cashier, I want each shift card to show the station name, date, period (morning/evening), and my submission status (Not started / In progress / Submitted), so that I know at a glance what needs doing.
3. As a cashier, I want to be blocked from accessing supervisor or owner pages, so that I only see what is relevant to my role.
4. As a cashier, I want to see a "no open shifts" message when no pending shift exists for my station, so that I am not confused by an empty list.

### Cashier — Shift Hub
5. As a cashier, I want a shift hub page showing a progress checklist (Fuel Z-report, Dry Stock Z-report, Stock Count), so that I know which sections are complete and which remain.
6. As a cashier, I want to navigate freely between sections in any order, so that I can work in the sequence that suits my actual end-of-shift process.
7. As a cashier, I want each completed section to be marked visually on the checklist, so that I can confirm my progress before submitting.
8. As a cashier, I want a final Submit button that only becomes active when all three sections are complete, so that I cannot accidentally submit incomplete data.

### Cashier — Fuel Z-Report
9. As a cashier, I want to photograph my fuel POS Z-report printout, so that fuel sales data is captured without manual entry.
10. As a cashier, I want the system to extract fuel grade lines (grade, litres sold, revenue) from the photo using Anthropic Vision OCR, so that I only need to confirm rather than type values.
11. As a cashier, I want to review and override each extracted fuel line before saving, so that OCR errors do not silently corrupt reconciliation.
12. As a cashier, I want to save the fuel Z-report section independently, so that I can return to other sections without losing my OCR data.

### Cashier — Dry Stock Z-Report
13. As a cashier, I want to photograph my dry stock POS Z-report printout as a separate photo from the fuel Z-report, so that each report is captured clearly on its own.
14. As a cashier, I want the system to extract dry stock lines (product name, units sold, revenue) from the dry stock photo using Anthropic Vision OCR, so that I do not manually key in every product line.
15. As a cashier, I want extracted product names to be matched exactly to the station's product catalogue, so that reconciliation is tied to known products.
16. As a cashier, I want unrecognised OCR lines to be flagged, so that I am alerted to lines that did not match any catalogue product.
17. As a cashier, I want to map each unrecognised line to an existing catalogue product via a dropdown, so that no sales data is lost due to OCR name variation.
18. As a cashier, I want to review and override each matched line before saving, so that I can correct OCR errors on individual values.
19. As a cashier, I want to save the dry stock Z-report section independently, so that progress is preserved if I switch sections.

### Cashier — Stock Count & Deliveries
20. As a cashier, I want to see a list of all products in my station's catalogue with their system-derived opening counts, so that I have context before entering closing counts.
21. As a cashier, I want to enter a closing count for each product, so that physical stock variance can be calculated.
22. As a cashier, I want to record stock deliveries received during my shift (product, quantity, timestamp), so that deliveries are factored into the variance calculation.
23. As a cashier, I want to add multiple deliveries per product in the same section, so that I can record several restocking events in one go.
24. As a cashier, I want to save the stock count and deliveries independently, so that partial entry is not lost.

### Cashier — Submission & Summary
25. As a cashier, I want a single final submit action that locks all my data, so that there is a clear end-of-shift moment.
26. As a cashier, I want a read-only summary page after submission showing my submitted data and physical variance per product, so that I can see if anything looks wrong before leaving.
27. As a cashier, I want my submitted data to be locked after submit — only a supervisor can correct it via an override — so that the audit trail is protected.

### Supervisor — Simplified Close Flow
28. As a supervisor, I want my close workflow to cover pumps and dips only, so that I am not duplicating the cashier's POS capture work.
29. As a supervisor, I want my shift summary page to show a cashier status badge (Submitted / Pending), so that I know whether the cashier has finished before I close the shift.
30. As a supervisor, I want to be blocked from submitting the shift until the cashier has submitted, so that reconciliation always runs on complete data.

### Owner — Product Catalogue
31. As an owner, I want a top-level product catalogue config page at `/dashboard/config/products`, so that I can manage dry stock products for each station.
32. As an owner, I want to create products with a name, unit (e.g. bottle, pack), cost price, and selling price per station, so that the system can compute stock value and gross margin at the owner reporting level.
33. As an owner, I want to set an opening stock baseline per product per station separately from the product definition, so that the first shift's reconciliation has an opening count to work from.
34. As an owner, I want to edit existing products (name, unit, cost price, selling price), so that I can keep the catalogue accurate over time.
35. As an owner, I want to deactivate products that are no longer stocked, so that they stop appearing in cashier forms without deleting historical data.
36. As an owner, I want the opening baseline count to be used as the fallback when no prior shift closing count exists, so that the first shift at a station still reconciles correctly.

### Owner — Dry Stock Reporting
37. As an owner, I want a dedicated dry stock variance report at `/dashboard/reports/dry-stock`, so that fuel and dry stock reporting are clearly separated.
38. As an owner, I want to filter the dry stock report by station and date range, so that I can investigate specific periods or locations.
39. As an owner, I want to see physical variance per product per shift (opening + deliveries - units sold - closing), so that I can identify consistent stock losses.
40. As an owner, I want the report to show zero-variance lines as well as non-zero, so that I have a complete picture per shift.

## Implementation Decisions

### Schema Changes
- Add `cashier_submitted_at TIMESTAMPTZ` column to the `shifts` table via a new migration. No bypass column — supervisor is hard-blocked until cashier submits.
- Add a `product_catalogue` table: `station_id`, `name`, `unit`, `cost_price_zar`, `selling_price_zar`, `is_active`. Products are per-station; no shared catalogue concept.
- Add a `stock_baselines` table (mirrors `shift_baselines`): `station_id`, `product_id`, `quantity`, `set_at`, `set_by`. Owner-set initial opening count per product per station. Unique on `(station_id, product_id)`.
- Add a `stock_readings` table: one closing count row per product per shift. Unique on `(shift_id, product_id)`.
- Add a `stock_deliveries` table: `shift_id`, `station_id`, `product_id`, `quantity`, `recorded_by`, `created_at`.
- Add a `dry_stock_pos_submissions` table: one record per dry stock Z-report photo per shift, holding the photo URL and OCR status. Separate from `pos_submissions` (which covers the fuel Z-report).
- Add a `pos_dry_stock_lines` table: OCR-extracted product lines from dry stock Z-report. FK to `dry_stock_pos_submissions`. Fields: `product_id` (nullable for unmatched lines), `raw_name`, `units_sold`, `revenue_zar`, `overridden_units_sold`, `overridden_revenue_zar`.
- Add a `dry_stock_reconciliation_lines` table: `shift_id`, `product_id`, `opening_count`, `deliveries`, `units_sold`, `closing_count`, `variance_units`. Unique on `(shift_id, product_id)`.
- All tables have RLS policies: cashier reads/writes own station; owner reads all; supervisor reads own station.

### New Modules
- **`lib/cashier-progress.ts`** — Pure functions: `getCashierProgress(shiftId)` returning per-section completion flags (fuelPos, stockPos, stockCount); `canCashierSubmit(progress)` returning boolean. No side effects.
- **`lib/stock-baselines.ts`** — Port/adapter: `getStockBaselines(stationId)` returns opening count per product, preferring prior shift's closing count from `stock_readings` and falling back to `stock_baselines` table. Same interface pattern as `lib/shift-baselines.ts`.
- **`lib/dry-stock-reconciliation.ts`** — Pure: `calcDryStockVariance({ opening, deliveries, unitsSold, closing })` per product. `buildDryStockLines(products, readings, deliveries, posDryStockLines)` returns an array of reconciliation line objects.
- **`lib/product-catalogue.ts`** — CRUD: `getProducts(stationId)`, `upsertProduct(stationId, product)`, `deactivateProduct(productId)`. Mirrors `lib/station-config.ts` conventions.
- **`lib/ocr/dry-stock-ocr.ts`** — Anthropic Vision extraction for dry stock Z-report photo. Returns array of `{ rawName, unitsSold, revenueZar }`. Separate function and upload from fuel Z-report extraction.
- **`lib/stock-readings.ts`** — CRUD: `saveStockReading(shiftId, productId, closingCount)`, `saveStockDelivery(shiftId, productId, quantity)`, `getStockReadings(shiftId)`, `getStockDeliveries(shiftId)`.

### Modified Modules
- **`lib/shift-close.ts`** — Remove POS from supervisor progress tracking. Add `cashierSubmitted` flag derived from `cashier_submitted_at`. Update `canSubmit` to require `cashierSubmitted === true` — no bypass path.
- **`lib/reconciliation-runner.ts`** — POS lines now sourced from cashier's `pos_submissions` only (no supervisor POS step). Trigger dry stock reconciliation on cashier submit.
- **Supervisor POS route** — Deleted. The `/shift/[id]/close/pos/` route is removed; supervisor close flow is pumps -> dips -> summary only.

### Cashier Route Tree
- `/cashier` — shift list with status badges
- `/cashier/[shiftId]/` — shift hub with progress checklist
- `/cashier/[shiftId]/fuel-pos` — fuel Z-report photo upload, Anthropic Vision OCR, confirm/override
- `/cashier/[shiftId]/stock-pos` — dry stock Z-report photo upload, Anthropic Vision OCR, line matching, override
- `/cashier/[shiftId]/stock-count` — closing counts per product + inline delivery recording
- `/cashier/[shiftId]/summary` — read-only post-submit results with physical variance per product

### Owner Route Additions
- `/dashboard/config/products` — product catalogue CRUD per station (top-level config section alongside pricing and baselines); includes opening baseline entry per product
- `/dashboard/reports/dry-stock` — dry stock variance report with station and date filters

### OCR
- Both Z-reports use the Anthropic Vision API, consistent with pump meter OCR.
- Fuel and dry stock Z-reports are photographed and uploaded separately; each has its own upload route and OCR function.
- Dry stock OCR extraction is a separate function from fuel extraction in `lib/ocr/dry-stock-ocr.ts`.
- Unrecognised lines (no exact catalogue name match) are surfaced to the cashier for manual mapping via a catalogue product dropdown.

### Cashier Submission Lock
- On cashier final submit: `cashier_submitted_at` is stamped on the shift; all cashier data becomes read-only in the UI.
- Post-submit corrections go through the existing `createOverride` server action (supervisor only).
- There is no supervisor bypass — the supervisor is hard-blocked from submitting the shift until `cashier_submitted_at` is set.

### Opening Baseline Resolution
- `lib/stock-baselines.ts` checks for a prior closed shift's `stock_readings` closing counts first.
- Falls back to the `stock_baselines` table (owner-configured) if no prior shift exists.
- Same port/adapter pattern as `lib/shift-baselines.ts`. Owner sets baselines via the products config page UI; they are stored in a separate `stock_baselines` table, not inline on `product_catalogue`.

## Testing Decisions

Good tests verify external behaviour through the module's public interface only — they do not assert on internal implementation details, private functions, or database query structure. Each test should describe a scenario a domain expert would recognise.

### Modules to Test (unit, Vitest)

- **`lib/cashier-progress.ts`** — Given various combinations of section completion (fuelPos done, stockPos done, stockCount done), assert correct `canCashierSubmit` result and per-section flags. No database calls needed.
- **`lib/stock-baselines.ts`** — Given a mock repository, assert that prior shift closing counts are preferred over the `stock_baselines` fallback; assert fallback behaviour when no prior shift exists.
- **`lib/dry-stock-reconciliation.ts`** — Given known opening counts, deliveries, units sold, and closing counts, assert correct physical variance per product. Edge cases: zero deliveries, zero units sold, negative variance, zero variance.
- **`lib/product-catalogue.ts`** — Given a mock Supabase client, assert that `getProducts` returns only active products for the correct station; assert upsert and deactivate behaviour.
- **`lib/ocr/dry-stock-ocr.ts`** — Given mock Anthropic Vision API responses, assert correct extraction of product name, units sold, and revenue per line. Assert graceful handling of partial or malformed responses.
- **`lib/stock-readings.ts`** — Given a mock Supabase client, assert save and retrieval of stock readings and deliveries per shift.
- **`lib/shift-close.ts`** (modified) — Assert that `canSubmit` returns false when `cashierSubmitted` is false; returns true only when cashier has submitted. No bypass path exists.
- **`lib/reconciliation-runner.ts`** (modified) — Assert that POS lines are sourced from cashier submission only; assert dry stock reconciliation lines are written on cashier submit.

Prior art for test style: `__tests__/reconciliation.test.ts`, `__tests__/shift-close.test.ts`, `__tests__/shift-baselines.test.ts`.

## Out of Scope

- Financial variance on the cashier summary page (cost/selling price x variance) — owner reporting only.
- Supervisor bypass of the cashier submission requirement — supervisor is hard-blocked.
- Supervisor retaining a POS capture fallback path.
- Shared product catalogues across stations (products are per-station).
- Fuzzy OCR name matching to catalogue products (exact match only; unrecognised lines handled manually by cashier).
- Dry stock data included in the existing daily/weekly/monthly fuel reports.
- E2E tests.

## Further Notes

- The cashier role already exists in the database with RLS policies scoped to `pos_submissions` and dry stock tables. Middleware routing to `/cashier` is already configured.
- The fuel Z-report and dry stock Z-report are separate physical printouts and separate photo uploads — they are not two sections of the same image. The `dry_stock_pos_submissions` table is therefore separate from `pos_submissions`.
- The opening baseline port/adapter in `lib/stock-baselines.ts` should be structurally identical to `lib/shift-baselines.ts` to keep the pattern consistent and navigable.
- Dry stock reconciliation is intentionally separate from fuel reconciliation — different tables, triggered at cashier submit rather than supervisor submit.
- The supervisor POS route should be deleted, not hidden — removing dead routes reduces confusion and keeps the route tree accurate.
- Cost price on products enables gross margin reporting at the owner level (`dry_stock_reconciliation_lines` can be extended with `variance_zar_at_cost` in a future slice if needed).
