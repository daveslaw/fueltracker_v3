## Problem Statement

The owner has no way to manage dry stock products from within the app. Products currently exist in the database but can only be created or modified via direct SQL. Additionally, product sell and cost prices are stored as static columns on the `products` table — meaning a price change today silently corrupts variance calculations on historical shifts if reconciliation is ever re-run.

## Solution

Build a product catalogue management screen under the owner's config area (`/dashboard/config/products`), and introduce a versioned `product_prices` table (mirroring how fuel prices work) so that reconciliation always resolves prices at the exact timestamp of the shift being reconciled.

## User Stories

1. As an owner, I want to see a list of all products at a selected station, so that I can review what is configured before making changes.
2. As an owner, I want to filter the product list by station, so that I can manage each station's catalogue independently.
3. As an owner, I want to see each product's stock code, description, current sell price, current cost price, and active status in the list, so that I can quickly assess the catalogue at a glance.
4. As an owner, I want to add a new product with a stock code, description, sell price, cost price, and initial stock baseline quantity, so that the cashier workflow is ready to use the product immediately.
5. As an owner, I want the initial stock baseline to be saved per station when I create a product, so that the cashier's opening count is correct from day one.
6. As an owner, I want to edit an existing product's stock code and description, so that I can correct mistakes or keep descriptions aligned with what appears on the POS Z-report.
7. As an owner, I want to update a product's sell price and cost price together in a single action, so that the new prices take effect immediately for all subsequent shifts.
8. As an owner, I want price changes to take effect immediately from the moment I save them, so that the current shift uses the correct price.
9. As an owner, I want historical shifts to always resolve the price that was active at the time of the shift, so that re-running reconciliation does not alter past variance figures.
10. As an owner, I want to deactivate a product that is no longer sold, so that it no longer appears in the cashier's stock count or POS capture forms.
11. As an owner, I want to reactivate a previously deactivated product, so that it returns to the cashier's workflow if stocking resumes.
12. As an owner, I want to see whether a product is active or inactive in the product list, so that I know which products are currently live.
13. As an owner, I want the product catalogue to be accessible from the Config screen, so that it is consistent with how other config (stations, tanks, fuel pricing) is managed.
14. As an owner, I want only owners to be able to create, edit, price, or deactivate products, so that station staff cannot alter the catalogue.
15. As a cashier, I want to see only active products in the stock count form, so that I am not asked to count products that are no longer sold.
16. As a cashier, I want to see only active products in the dry stock POS form, so that OCR matching and manual entry are not cluttered with inactive items.
17. As the system, I want to resolve each product's sell price at the shift's timestamp during dry stock reconciliation, so that variance calculations remain accurate regardless of subsequent price changes.

## Implementation Decisions

### Schema Changes

- **New table: `product_prices`** — columns: `id`, `station_id`, `product_id`, `cost_price`, `sell_price`, `valid_from` (defaults to now), `valid_to` (nullable), `set_by`. One row per price-change event. The current price for a product is the row where `valid_from <= now()` and `valid_to IS NULL`.
- **Migration path**: existing `cost_price` and `sell_price` values on `products` are seeded into `product_prices` as the initial price record (with `valid_from = now()`), then those columns are dropped from `products`.
- **`stock_baselines`** already exists and is already per station/product — no schema change needed. The product creation form will upsert into this table.
- RLS on `product_prices`: owner full CRUD; cashier and supervisor read-only scoped to their station.

### Modules

**`lib/product-pricing.ts`** (new)
- `getActivePriceAt(productId, stationId, at: Date)` — returns `{ cost_price, sell_price }` for the price record where `valid_from <= at AND (valid_to IS NULL OR valid_to > at)`. Returns null if none found.
- `setProductPrice(productId, stationId, costPrice, sellPrice)` — stamps `valid_to = now()` on the current open price record, then inserts a new record with `valid_from = now()`.
- Pure business logic; accepts a Supabase client as a dependency so it is testable with a mock.

**`lib/product-catalogue.ts`** (modify)
- Remove `cost_price` and `sell_price` from `upsertProduct` input — prices are now managed via `product-pricing.ts`.
- `createProduct(stationId, input)` — inserts product row and calls `setProductPrice` for the initial price in a single operation.
- `updateProductDetails` — updates `stock_code` and `description` only.
- `deactivateProduct` and `reactivateProduct` remain as soft-delete toggles.

**`lib/dry-stock-runner.ts`** (modify)
- Replace `products.sell_price` column fetch with a call to `getActivePriceAt(productId, stationId, shiftTimestamp)` for each product when computing `variance_zar`.
- If no price is found for a product at the shift timestamp, log a warning and use `0` (zero variance) rather than crashing.

**`/dashboard/config/products` page** (new)
- Station selector at top (same pattern as `/dashboard/config/baselines`).
- Product list table: stock code, description, current sell price, current cost price, active badge, Edit / Deactivate buttons.
- "Add product" form: stock code, description, cost price, sell price, initial stock count (baseline).
- "Edit" form: stock code and description only.
- "Update pricing" form: cost price and sell price together.
- "Deactivate / Reactivate" toggle button.
- All mutations via server actions in co-located `actions.ts`.

### Architectural Decisions

- Price versioning follows the exact same pattern as `lib/pricing.ts` (fuel) — `getActivePriceAt` is the single lookup contract used by reconciliation.
- Products are per-station (not shared across stations).
- Price changes take effect immediately (`valid_from = now()`); no future-dating.
- Deactivation is soft-delete only — `is_active = false`. No hard delete to preserve reconciliation audit trail.
- OCR matching for dry stock POS continues to use `products.description` as the match key.
- Owner-only access enforced at the server action level (role check) and via RLS.

## Testing Decisions

Good tests verify observable external behaviour — given inputs, assert outputs — without asserting internal implementation details like which Supabase method was called.

**`lib/product-pricing.ts`**
- `getActivePriceAt` returns the correct price when a single price record exists.
- `getActivePriceAt` returns the correct historical price when multiple versions exist and `at` falls between two `valid_from` dates.
- `getActivePriceAt` returns `null` when no price exists for the product.
- `setProductPrice` closes the current open record (`valid_to = now()`) and inserts a new one.
- `setProductPrice` works correctly when no prior price record exists (first-time set).

Prior art: `__tests__/pricing.test.ts` (fuel price versioning tests).

**`lib/product-catalogue.ts`**
- `createProduct` inserts a product row and seeds an initial price record.
- `updateProductDetails` updates `stock_code` and `description` without touching prices.
- `deactivateProduct` sets `is_active = false`.
- `reactivateProduct` sets `is_active = true`.

Prior art: `__tests__/station-config.test.ts`.

**`lib/dry-stock-runner.ts`**
- Reconciliation uses the versioned price at the shift timestamp, not the current product price.
- Reconciliation produces `variance_zar = 0` when no price is found for a product, without throwing.

Prior art: `__tests__/reconciliation-runner.test.ts`.

## Out of Scope

- Price history view per product in the UI (versioned records are written but only the current price is displayed).
- Cost price usage in reporting or margin analysis — `cost_price` is stored and versioned but not surfaced in any report in this PRD.
- Bulk import of products via CSV.
- Supervisor or cashier access to product management.
- Hard deletion of products.
- Future-dated price changes (prices always take effect immediately).
- Dry stock stock baseline management as a standalone config screen — baselines are set only at product creation time in this PRD.

## Further Notes

- The `product_catalogues` table was created and then dropped in an earlier migration — it no longer exists in the live database. The `products` table is authoritative and already per-station.
- The existing `lib/product-catalogue.ts` has a `ProductCatalogueRepository` interface and a Supabase adapter already defined — the new UI and actions should wire up to this existing port rather than bypass it.
- The dry stock reconciliation runner currently reads `products.sell_price` directly. After this change, it must call `getActivePriceAt` with the shift's `started_at` timestamp. The `started_at` column already exists on `shifts`.
