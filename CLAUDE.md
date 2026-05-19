# FuelTracker v3 — Claude Code Guide

## Project Summary

Multi-station fuel inventory PWA for South African petrol stations. Supervisors capture shift close meter readings, tank dips, and POS Z-reports (OCR via Google Cloud Vision). Cashiers capture fuel POS totals, dry stock POS totals, and closing stock counts. Owners view cross-station variance reports and manage config. Three stations: Elegant Amaglug, Speedway, Truck Stop. Currency: ZAR.

## Tech Stack

Next.js 15 (App Router, Turbopack) · React 19 · TypeScript 5 (strict, `@/*` → root) · Supabase (Auth, Postgres/RLS, Storage) · Tailwind CSS v4 + shadcn/ui · Anthropic Vision API (pump OCR) · Google Cloud Vision API (POS OCR) · PWA (service worker + IndexedDB offline queue) · Recharts · Vitest + Testing Library

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (run once)
npm run test:watch   # Vitest watch mode
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
GOOGLE_CLOUD_VISION_API_KEY
```

## File Structure

```
app/
  (auth)/login/               # Login + server actions
  (auth)/set-password/        # Set/reset password + server actions
  auth/callback/              # OAuth callback route
  api/upload/                 # pump-photo, pos-photo, delivery-photo, dry-stock-photo routes
  shift/                      # Supervisor shift workflow
    actions.ts                # createShift, saveClosePumpReading, saveCloseDipReading,
                              #   savePosSubmission, submitShift, splitShift, flagShift,
                              #   unflagShift, createOverride, saveDelivery, deleteDelivery
    new/page.tsx
    [id]/close/pumps|dips|deliveries|summary/
    [id]/split/pumps|dips|pos|confirm/   # Split shift workflow (part 1 → part 2)
  cashier/                    # Cashier shift workflow
    [shiftId]/
      actions.ts              # saveCashierFuelPos, saveCashierDryStockPos,
                              #   saveCashierStockReading, saveCashierStockDelivery,
                              #   deleteCashierStockDelivery, submitCashierShift
      fuel-pos|stock-pos|stock-count|summary/
  dashboard/                  # Owner reports & config
    _components/              # DashboardNav, DashboardPoller
    actions.ts                # createShiftSlot
    config/                   # stations, tanks, pumps, pricing, baselines, products CRUD
    reports/                  # page.tsx=daily, weekly/, monthly/, dry-stock/, deliveries/
      export/route.ts         # CSV export endpoint
      deliveries/export/route.ts
    tank-trends/
    history/                  # Shift history list
    history/[id]/             # Shift history detail
    users/

components/                   # ServiceWorkerRegistrar, OfflineQueueProvider, Toaster,
                              #   ThemeProvider, SentryUserContext, fuel-control-table, etc.

lib/
  supabase/client.ts|server.ts|admin.ts
  ocr/                        # IImageRecogniser interface + Anthropic/Vision/fake implementations
                              #   parse-meter.ts, parse-pos.ts, ocr-service.ts, dry-stock-ocr.ts
  shift-open.ts               # canStartShift, canSplitShift, markFirstPartSplit, computeShiftLabel
  shift-close.ts              # getCloseProgress, canSubmit
  shift-baselines.ts          # Rolling baseline: prior closed shift → shift_baselines fallback
  reconciliation.ts           # Core fuel formulas
  reconciliation-runner.ts    # Orchestrates reconciliation on submit
  deliveries.ts               # Fuel delivery CRUD + getShiftPeriod + validateDeliveryInput
  delivery-report.ts          # getDeliveryReport — paginated list with totals + station subtotals
  pricing.ts                  # selectActivePriceAt
  owner-reports.ts            # buildStationDayStatus, countPendingShiftsPerStation,
                              #   buildFinancialLines, buildDailyFuelReport, isReportPartial
  aggregate-reports.ts        # Cross-station aggregation
  fuel-control-report.ts      # buildFuelControlRows, buildDaySubtotals, getFuelControlMonth
  stock-reconciliation.ts     # Dry stock variance formula
  dry-stock-runner.ts         # Orchestrates dry stock reconciliation on cashier submit
  cashier-progress.ts|cashier-submission.ts
  products.ts|product-catalogue.ts|product-pricing.ts
  stock-baselines.ts|stock-readings.ts
  station-config.ts           # Station/tank/pump/pricing config CRUD (use instead of raw Supabase)
  tank-trends.ts              # Tank trend calculations
  user-management.ts          # User CRUD utilities
  middleware-utils.ts         # Role-based routing helpers (used by middleware.ts)
  csv-export.ts
  idb-queue.ts|offline-queue.ts

middleware.ts                 # Auth guard + role-based routing
supabase/migrations/          # Apply in order with: supabase db push
scripts/backfill-reconciliation.ts  # npx tsx scripts/backfill-reconciliation.ts (post-migration 000013)
docs/DATA_MODEL.md            # Full database schema reference
docs/pump_tank_configuration.md
```

## Architecture

### Roles

| Role | Access |
|---|---|
| `supervisor` | Create/close fuel shifts, capture readings, record deliveries, flag shifts, submit overrides |
| `cashier` | Capture fuel POS totals, dry stock POS/stock counts, submit cashier shifts |
| `owner` | Cross-station reports, config, user management, create shift slots |

### Shift State Machine

```
pending → closed
```

- `is_flagged` is a boolean on closed shifts — not a separate status
- `canStartShift` blocks if a pending or closed shift already exists for the same station/period/date
- Cashiers work on the same `shifts` record as the supervisor — the cashier workflow (fuel POS, dry stock POS, stock counts) captures data against an existing shift and sets `cashier_submitted_at` on completion. There is no separate cashier shift table or `cashier_id` FK.

### Shift Splitting

A shift can be split mid-way (e.g. supervisor handover). `canSplitShift` guards eligibility. `splitShift` server action closes part 1 and creates part 2 with opening readings carried over. The split workflow lives at `/shift/[id]/split/pumps|dips|pos|confirm`. `shifts.part` (1 or 2) and `computeShiftLabel` identify each part in the UI.

### Fuel Reconciliation (runs on supervisor shift submit)

- **Formula 1 — Tank Inventory (per tank):** `Expected Closing Dip = Opening Dip + Deliveries − Meter Delta`. `variance_litres = actual − expected` (negative = loss)
- **Formula 2 — Pump vs POS (per grade):** `variance_litres = pos_litres_sold − meter_delta`. `variance_zar = pos_revenue_zar − (meter_delta × price_per_litre)` (negative = shortfall)
- Sign convention: negative = loss/shortfall throughout
- Re-runs on `createOverride` or post-close delivery
- `createOverride` mutates the source table then inserts into `ocr_overrides` (audit trail). Supports `reading_type`: `'pump'`, `'dip'`, `'pos_line'`
- Opening baseline: prior closed shift → `shift_baselines` table fallback

### Dry Stock Reconciliation (runs on cashier shift submit)

`variance = actual_closing − (opening + deliveries − pos_units_sold)`. Opening baseline: prior cashier shift → `stock_baselines` fallback.

## Database

See `docs/DATA_MODEL.md` for the full schema. Key tables: `shifts`, `pump_readings`, `dip_readings`, `pos_submissions`, `pos_submission_lines`, `reconciliations`, `reconciliation_tank_lines`, `reconciliation_grade_lines`, `deliveries`, `fuel_prices`, `products`, `stock_readings`, `reconciliation_stock_lines`, `shift_baselines`, `stock_baselines`.

RLS policies scope all data to `station_id` via `user_profiles`. Use `lib/supabase/admin.ts` (service role) only server-side when RLS must be bypassed.

## Key Patterns

**Supabase clients:** `server.ts` in Server Components/Actions · `client.ts` in Client Components · `admin.ts` server-only (bypasses RLS)

**Server Actions** are co-located with route segments in `actions.ts` files.

**Config mutations** go through `lib/station-config.ts` — not raw Supabase calls in components.

**Shift summary page** (`/shift/[id]/close/summary`) branches on status: `pending` → checklist + submit; `closed` → reconciliation tables + flag/unflag + `<details>` correction forms (zero-JS).

**Pure library functions** (no side effects, testable in isolation):
- `lib/supervisor-review.ts` — `canFlag`, `canOverride`, `validateFlagComment`, `validateOverride`
- `lib/owner-reports.ts` — `buildStationDayStatus`, `countPendingShiftsPerStation`, `buildFinancialLines`, `isReportPartial`
- `lib/fuel-control-report.ts` — `buildFuelControlRows`, `buildDaySubtotals`
- `lib/reconciliation.ts` — core fuel variance formulas
- `lib/pricing.ts` — `selectActivePriceAt`

## Testing

```bash
npm test             # Run all tests once
npm run test:watch   # Watch mode
```

Tests in `__tests__/`. Vitest + jsdom + Testing Library. No E2E tests. Test pure functions with fixture data — no mocking Supabase.

## Deployment

- **Frontend:** Vercel — push to `main` triggers deploy
- **Database:** Supabase Cloud — `supabase db push`
- **Storage:** Supabase Storage (shift photos, delivery note photos, dry stock photos)
