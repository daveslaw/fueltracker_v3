# FuelTracker v3 — Claude Code Guide

## Project Summary

Multi-station fuel inventory PWA for South African petrol stations. Supervisors capture shift close meter readings, tank dips, and POS Z-reports (with OCR via Google Cloud Vision). Cashiers capture fuel POS totals, dry stock POS totals, and closing stock counts. Owners view cross-station variance reports and manage config. Three stations: Elegant Amaglug, Speedway, Truck Stop. Currency: ZAR.

## Tech Stack

- **Next.js 15** — App Router, Server Actions, Turbopack
- **React 19** — Client components where needed
- **TypeScript 5** — Strict mode, path alias `@/*` → root
- **Supabase** — Auth, Postgres with RLS, Storage (photos)
- **Tailwind CSS v4** + **shadcn/ui** — Styling and UI primitives
- **Anthropic Vision API** — OCR for pump meter readings
- **Google Cloud Vision API** — OCR for POS Z-reports
- **PWA** — Service worker (`public/sw.js`) + IndexedDB offline queue
- **Recharts** — Tank level trend charts
- **Vitest** + **Testing Library** — Unit and integration tests

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
fueltracker_v3/
│
├── app/                            # Next.js App Router
│   ├── (auth)/login/               # Login page + server actions
│   ├── api/upload/                 # Photo upload API routes
│   │   ├── pump-photo/route.ts
│   │   ├── pos-photo/route.ts
│   │   ├── delivery-photo/route.ts
│   │   └── dry-stock-photo/route.ts
│   │
│   ├── shift/                      # Supervisor shift workflow
│   │   ├── page.tsx                # Shift list — auto-redirects to current period or lists pending/closed
│   │   ├── actions.ts              # createShift, saveClosePumpReading, saveCloseDipReading,
│   │   │                           #   savePosSubmission, submitShift, flagShift, unflagShift,
│   │   │                           #   createOverride, saveDelivery, deleteDelivery
│   │   ├── new/page.tsx            # Period selector (station auto-filled from profile)
│   │   └── [id]/close/
│   │       ├── pumps/              # Close: pump meter capture + OCR
│   │       ├── dips/               # Close: tank dip entry
│   │       ├── pos/                # POS Z-report photo + OCR confirm
│   │       ├── deliveries/         # Fuel deliveries capture (per shift)
│   │       └── summary/            # Progress (pending) or reconciliation results (closed)
│   │                               #   Includes flag/unflag and correction forms
│   │
│   ├── cashier/                    # Cashier shift workflow
│   │   ├── page.tsx                # Cashier shift list / redirect
│   │   ├── layout.tsx
│   │   └── [shiftId]/
│   │       ├── page.tsx            # Cashier shift overview + progress checklist
│   │       ├── actions.ts          # saveCashierFuelPos, saveCashierDryStockPos,
│   │       │                       #   saveCashierStockReading, saveCashierStockDelivery,
│   │       │                       #   deleteCashierStockDelivery, submitCashierShift
│   │       ├── fuel-pos/           # Fuel POS Z-report entry
│   │       ├── stock-pos/          # Dry stock POS totals entry
│   │       ├── stock-count/        # Physical stock count per product
│   │       └── summary/            # Cashier reconciliation results
│   │
│   ├── dashboard/                  # Owner reports & config
│   │   ├── page.tsx                # Cross-station status, pending counts, flagged alerts,
│   │   │                           #   create shift slot form
│   │   ├── actions.ts              # createShiftSlot server action
│   │   ├── config/                 # Station / tank / pump / pricing / baselines / products CRUD
│   │   │   ├── page.tsx            # Station tree + links to Baselines, Fuel pricing, Products
│   │   │   ├── stations/
│   │   │   ├── pricing/
│   │   │   ├── baselines/          # Opening baseline meter/dip values per station
│   │   │   │   ├── page.tsx
│   │   │   │   ├── actions.ts      # savePumpBaseline, saveTankBaseline
│   │   │   │   └── StationSelect.tsx
│   │   │   ├── products/           # Dry stock product catalogue CRUD
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── StationForm.tsx
│   │   │   ├── TankForm.tsx
│   │   │   ├── PumpForm.tsx
│   │   │   ├── StationTree.tsx
│   │   │   └── actions.ts
│   │   ├── reports/                # Variance and delivery reports
│   │   │   ├── page.tsx            # Daily fuel variance (Formula 1 & 2 + financial)
│   │   │   ├── weekly/page.tsx
│   │   │   ├── monthly/page.tsx
│   │   │   ├── dry-stock/page.tsx  # Dry stock variance report
│   │   │   ├── deliveries/         # Fuel deliveries report (date range + station filter)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── DeliveriesTable.tsx   # Client component — table + photo modal state
│   │   │   │   ├── DeliveryPhotoModal.tsx # Client component — lightbox with delivery details
│   │   │   │   └── export/route.ts        # CSV export
│   │   │   └── export/route.ts     # Daily/weekly/monthly CSV export
│   │   ├── tank-trends/            # Tank level chart (Recharts)
│   │   ├── history/                # Shift audit trail browser
│   │   └── users/                  # User invite / role assign / deactivate
│   │
│   ├── layout.tsx                  # Root layout (auth, offline queue, toaster)
│   └── page.tsx                    # Landing / role-based redirect
│
├── components/                     # Global UI components
│   ├── ServiceWorkerRegistrar.tsx  # PWA service worker setup
│   ├── OfflineQueueProvider.tsx    # Offline queue context
│   ├── FailedSyncBanner.tsx        # Failed sync notification
│   ├── PendingBadge.tsx            # Pending items count
│   ├── Spinner.tsx                 # Loading spinner
│   └── Toaster.tsx                 # Toast notifications
│
├── lib/                            # Business logic (no React)
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client (SSR cookies)
│   │   └── admin.ts                # Service role client (bypasses RLS)
│   ├── ocr/
│   │   ├── ocr-service.ts          # Pump meter + POS extraction logic
│   │   ├── vision-client.ts        # Google Cloud Vision API wrapper
│   │   └── dry-stock-ocr.ts        # Dry stock Z-report OCR extraction
│   ├── middleware-utils.ts         # Auth guard helpers
│   ├── station-config.ts           # Station/tank/pump/grade CRUD
│   ├── shift-open.ts               # canStartShift guard (blocks on pending/closed)
│   ├── shift-close.ts              # getCloseProgress, canSubmit
│   ├── shift-baselines.ts          # Port/adapter: rolling baseline from prior closed shift
│   │                               #   or shift_baselines table fallback
│   ├── reconciliation.ts           # Core fuel formulas (tank variance, pump vs POS)
│   ├── reconciliation-runner.ts    # Orchestrates fuel reconciliation on submit
│   ├── supervisor-review.ts        # canFlag, canOverride, validateFlagComment
│   ├── deliveries.ts               # Fuel delivery CRUD + getShiftPeriod + validateDeliveryInput
│   ├── delivery-report.ts          # getDeliveryReport — paginated delivery list with totals
│   │                               #   and per-station subtotals (owner report query layer)
│   ├── pricing.ts                  # Versioned fuel prices (selectActivePriceAt)
│   ├── tank-trends.ts              # Tank level time-series queries
│   ├── owner-reports.ts            # buildStationDayStatus, countPendingShiftsPerStation,
│   │                               #   buildFinancialLines, isReportPartial
│   ├── aggregate-reports.ts        # Cross-station aggregation
│   ├── user-management.ts          # Invite / assign / deactivate
│   ├── csv-export.ts               # reportRowsToCsv, buildCsvFilename, formatDeliveriesCSV
│   ├── products.ts                 # Product type + getActiveProducts
│   ├── product-catalogue.ts        # Product CRUD (create, update, deactivate)
│   ├── product-pricing.ts          # Versioned dry stock prices (selectActiveProductPriceAt)
│   ├── stock-baselines.ts          # Opening stock count baselines per station
│   ├── stock-readings.ts           # Cashier closing stock count CRUD
│   ├── stock-reconciliation.ts     # Dry stock variance formula (units + revenue)
│   ├── dry-stock-runner.ts         # Orchestrates dry stock reconciliation on cashier submit
│   ├── cashier-progress.ts         # getCashierProgress — completion state for cashier checklist
│   ├── cashier-submission.ts       # buildCashierSubmissionState — submitted vs in-progress
│   ├── idb-queue.ts                # IndexedDB offline queue (browser)
│   └── offline-queue.ts            # Enqueue / drain logic
│
├── supabase/migrations/            # Apply in order with: supabase db push
│   ├── 20260319000001_user_profiles.sql
│   ├── 20260320000001_station_config.sql
│   ├── 20260320000002_station_seed.sql    # Seeds 3 stations
│   ├── 20260320000003_shifts.sql
│   ├── 20260320000004_shift_close.sql
│   ├── 20260320000005_pos_ocr_status.sql
│   ├── 20260320000006_reconciliation.sql
│   ├── 20260320000007_deliveries.sql
│   ├── 20260320000008_shifts_submitted_at.sql
│   ├── 20260320000009_supervisor_review.sql
│   ├── 20260320000010_shift_redesign.sql
│   ├── 20260320000011_user_profile_email.sql
│   ├── 20260320000012_indexes.sql
│   ├── 20260320000013_reconciliation_formula_revision.sql  # Revised formulas + override schema
│   ├── 20260506000001_fuel_prices_per_station.sql          # Per-station fuel price versioning
│   ├── 20260506000002_deliveries_enrichment.sql            # delivery_note_number + driver_name
│   ├── 20260506000003_shift_splitting.sql                  # Cashier/supervisor shift split
│   ├── 20260506000004_cashier_role.sql                     # cashier role + RLS
│   ├── 20260506000005_product_catalogue.sql                # products table
│   ├── 20260506000006_stock_baselines.sql                  # stock_baselines table
│   ├── 20260506000007_dry_stock_capture.sql                # stock_readings + dry stock POS tables
│   ├── 20260506000008_reconciliation_stock_lines.sql       # stock reconciliation result tables
│   ├── 20260506000009_schema_corrections.sql
│   ├── 20260507000001_cashier_shifts_rls.sql               # Cashier RLS policies
│   └── 20260507000002_product_prices.sql                   # Versioned product prices table
│
├── __tests__/                      # Vitest unit tests
│   ├── reconciliation.test.ts      # Fuel Formula 1 & 2, financial calc
│   ├── reconciliation-runner.test.ts
│   ├── ocr-service.test.ts
│   ├── ocr-service-pos.test.ts     # POS Z-report OCR extraction
│   ├── dry-stock-ocr.test.ts       # Dry stock OCR extraction
│   ├── aggregate-reports.test.ts   # Cross-station aggregation
│   ├── csv-export.test.ts          # CSV formatting + formatDeliveriesCSV
│   ├── deliveries.test.ts          # Delivery CRUD + validation
│   ├── delivery-report.test.ts     # getDeliveryReport — pagination, totals, subtotals
│   ├── middleware.test.ts          # Auth guard routing
│   ├── shift-open.test.ts          # canStartShift (pending/closed blocking)
│   ├── shift-close.test.ts
│   ├── shift-baselines.test.ts
│   ├── supervisor-review.test.ts   # canFlag, canOverride, validateFlagComment
│   ├── owner-reports.test.ts       # countPendingShiftsPerStation, buildStationDayStatus
│   ├── station-config.test.ts
│   ├── user-management.test.ts
│   ├── pricing.test.ts
│   ├── tank-trends.test.ts
│   ├── offline-queue.test.ts
│   ├── products.test.ts            # getActiveProducts
│   ├── product-catalogue.test.ts   # Product CRUD
│   ├── product-pricing.test.ts     # selectActiveProductPriceAt
│   ├── stock-baselines.test.ts
│   ├── stock-readings.test.ts
│   ├── stock-reconciliation.test.ts # Dry stock variance formula
│   ├── dry-stock-runner.test.ts
│   ├── cashier-progress.test.ts    # getCashierProgress
│   ├── cashier-submission.test.ts  # buildCashierSubmissionState
│   ├── daily-fuel-report.test.ts
│   ├── inventory-snapshot.test.ts
│   └── price-change-impact.test.ts
│
├── public/
│   ├── manifest.json               # PWA manifest
│   └── sw.js                       # Service worker (offline sync)
│
├── scripts/
│   └── backfill-reconciliation.ts  # One-off: wipe + re-run reconciliation for all closed shifts
│                                   #   Run with: npx tsx scripts/backfill-reconciliation.ts
│                                   #   Required after applying migration 000013
├── middleware.ts                   # Auth guard + role-based routing
├── PRD.md                          # Full product requirements
└── .issues/                        # Development slices/epics
```

## Architecture

### Roles
| Role | Access |
|---|---|
| `supervisor` | Create and close fuel shifts, capture pump/dip/POS readings, record deliveries, flag shifts, submit overrides |
| `cashier` | Capture fuel POS totals, dry stock POS totals, physical stock counts; submit cashier shifts |
| `owner` | Cross-station reports, config, user management, create shift slots |

### Shift State Machine
```
pending → closed
```
- Shifts are created as `pending` (by supervisor via `/shift/new` or by owner via dashboard)
- Shift moves to `closed` only when supervisor explicitly submits via `submitShift`
- `is_flagged` is a boolean field on `closed` shifts — set/cleared independently of status
- Duplicate guard: `canStartShift` in `lib/shift-open.ts` blocks if a `pending` or `closed` shift already exists for the same station/period/date
- Cashier shifts are a separate concept — cashier submits via `submitCashierShift`

### Fuel Reconciliation (runs on supervisor shift submit)
- **Formula 1 — Tank Inventory (per tank):** `Expected Closing Dip = Opening Dip + Deliveries − Meter Delta`
  - Meter Delta = Σ(close − open) for all pumps whose `tank_id` matches this tank
  - `variance_litres = actual − expected` (negative = inventory loss)
- **Formula 2 — Pump vs POS (per grade):**
  - `variance_litres = pos_litres_sold − meter_delta` (negative = unrecorded dispensing)
  - `expected_revenue_zar = meter_delta × price_per_litre`
  - `variance_zar = pos_revenue_zar − expected_revenue_zar` (negative = revenue shortfall)
- **Sign convention:** negative = loss/shortfall across all variances.
- Revenue is per-grade on `reconciliation_grade_lines` — no station-level revenue total.
- Re-runs automatically on override (`createOverride`) or post-close delivery.
- `createOverride` mutates the source reading table before inserting into `ocr_overrides` (audit trail). Supports `reading_type` of `'pump'`, `'dip'`, or `'pos_line'`.
- Opening baseline comes from prior closed shift; falls back to `shift_baselines` table.

### Dry Stock Reconciliation (runs on cashier shift submit)
- `lib/stock-reconciliation.ts` — pure formula: `variance = actual_closing − (opening + deliveries − pos_units_sold)`
- `lib/dry-stock-runner.ts` — orchestrator: loads bundle, calls formula, persists results
- Opening baseline comes from prior cashier shift; falls back to `stock_baselines` table.

### Rolling Baseline
- `lib/shift-baselines.ts` — port/adapter for fuel opening values (pump meters + tank dips)
- `lib/stock-baselines.ts` — opening stock counts per product per station

### Offline-First PWA
1. Photos captured → stored in IndexedDB as blobs
2. Form data queued in IndexedDB via `lib/idb-queue.ts`
3. On reconnect: queue drains — photos upload to Supabase Storage first, then readings submitted via Server Actions
4. `OfflineQueueProvider` exposes pending count and sync status to the UI

### OCR Pipeline
1. Photo uploaded via `app/api/upload/pump-photo/route.ts`, `pos-photo/route.ts`, or `dry-stock-photo/route.ts`
2. `lib/ocr/vision-client.ts` — Anthropic Vision for pump meters; Google Cloud Vision for POS Z-reports
3. `lib/ocr/ocr-service.ts` / `dry-stock-ocr.ts` extract values
4. UI presents extracted value for confirmation or override

## Database Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Auth roles (supervisor/cashier/owner) and station assignment |
| `stations` | Station config |
| `tanks` | Tank capacity and fuel grade |
| `pumps` | Pump numbers and tank mapping |
| `fuel_grades` | 95, 93, D10, D50 |
| `pump_tank_mappings` | Pump → tank associations |
| `shifts` | Shift records with state |
| `pump_readings` | Opening/closing meter per pump |
| `dip_readings` | Tank dip levels per shift |
| `pos_submissions` | Fuel Z-report per shift |
| `pos_lines` | OCR-extracted fuel sales lines |
| `reconciliation_records` | Per-shift fuel reconciliation summary |
| `reconciliation_tank_lines` | Per-tank inventory variance lines |
| `reconciliation_grade_lines` | Per-grade pump vs POS variance lines |
| `deliveries` | Fuel deliveries by tank (delivery_note_number, driver_name) |
| `ocr_overrides` | Audit trail of post-close override corrections |
| `shift_baselines` | Fallback opening meter/dip values per station |
| `fuel_prices` | Versioned ZAR/litre per grade, per station |
| `products` | Dry stock product catalogue (stock_code, description, prices) |
| `product_prices` | Versioned cost/sell prices per product per station |
| `stock_baselines` | Fallback opening stock counts per product per station |
| `stock_readings` | Cashier closing stock counts per product per shift |
| `reconciliation_stock_lines` | Per-product dry stock variance results |

RLS policies scope all data to `station_id` via `user_profiles`. Use `lib/supabase/admin.ts` (service role) only for server-side operations that need to bypass RLS.

## Key Patterns

**Server Actions** are co-located with route segments in `actions.ts` files. Use `lib/supabase/server.ts` inside server actions and Server Components.

**Supabase clients:**
- `lib/supabase/server.ts` — SSR (cookies, Server Components, Server Actions)
- `lib/supabase/client.ts` — Browser (Client Components)
- `lib/supabase/admin.ts` — Service role (bypasses RLS, server-only)

**Auth guard:** `middleware.ts` intercepts all routes, checks session and role from `user_profiles`, redirects to `/login` or correct dashboard. Helper logic in `lib/middleware-utils.ts`.

**Config mutations** go through `lib/station-config.ts` (not raw Supabase calls in components).

**Shift summary page (`/shift/[id]/close/summary`)** branches on status:
- `pending`: progress checklist + submit button
- `closed`: reconciliation tables, flag/unflag controls, `<details>` correction forms (zero-JS)

**`lib/supervisor-review.ts`** pure functions:
- `canFlag(status)` — true only for `closed` shifts
- `canOverride(status)` — true only for `closed` shifts
- `validateFlagComment(comment)` — returns `{ valid, error? }`
- `validateOverride({ value, reason, reading_type, field_name? })`

**`lib/owner-reports.ts`** pure functions:
- `buildStationDayStatus(shifts)` — returns `{ morning, evening }` status strings
- `countPendingShiftsPerStation(shifts)` — returns `Record<stationId, count>`

**`lib/delivery-report.ts`** — `getDeliveryReport(db, params)` fetches paginated delivery rows with pre-joined station/tank/user fields, plus totalCount, totalLitres, totalPages, and per-station subtotals. Owner-only. Used by the deliveries report page and CSV export route.

## Testing

```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode
```

Tests are in `__tests__/`. Vitest + jsdom + Testing Library. No E2E tests.

## Deployment

- **Frontend:** Vercel — push to `main` triggers deploy
- **Database:** Supabase Cloud — apply migrations with `supabase db push`
- **Storage:** Supabase Storage buckets for shift photos, delivery note photos, and dry stock photos
