# FuelTracker v3 — Claude Code Guide

## Project Summary

Multi-station fuel inventory PWA for South African petrol stations. Supervisors capture shift close meter readings, tank dips, and POS Z-reports (with OCR via Google Cloud Vision). Owners view cross-station variance reports and manage config. Three stations: Elegant Amaglug, Speedway, Truck Stop. Currency: ZAR.

## Tech Stack

- **Next.js 15** — App Router, Server Actions, Turbopack
- **React 19** — Client components where needed
- **TypeScript 5** — Strict mode, path alias `@/*` → root
- **Supabase** — Auth, Postgres with RLS, Storage (photos)
- **Tailwind CSS v4** + **shadcn/ui** — Styling and UI primitives
- **Google Cloud Vision API** — OCR for pump meters and POS Z-reports
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
GOOGLE_CLOUD_VISION_API_KEY
```

Copy `.env.local.example` → `.env.local` and fill in values.

## File Structure

```
fueltracker_v3/
│
├── app/                            # Next.js App Router
│   ├── (auth)/login/               # Login page + server actions
│   ├── api/upload/                 # Photo upload API routes
│   │   ├── pump-photo/route.ts
│   │   └── pos-photo/route.ts
│   │
│   ├── shift/                      # Supervisor shift workflow
│   │   ├── page.tsx                # Shift list — auto-redirects to current period or lists pending/closed
│   │   ├── actions.ts              # createShift, saveClosePumpReading, saveCloseDipReading,
│   │   │                           #   savePosSubmission, submitShift, flagShift, unflagShift,
│   │   │                           #   createOverride
│   │   ├── new/page.tsx            # Period selector (station auto-filled from profile)
│   │   └── [id]/close/
│   │       ├── pumps/              # Close: pump meter capture + OCR
│   │       ├── dips/               # Close: tank dip entry
│   │       ├── pos/                # POS Z-report photo + OCR confirm
│   │       └── summary/            # Progress (pending) or reconciliation results (closed)
│   │                               #   Includes flag/unflag and correction forms
│   │
│   ├── dashboard/                  # Owner reports & config
│   │   ├── page.tsx                # Cross-station status, pending counts, flagged alerts,
│   │   │                           #   create shift slot form
│   │   ├── actions.ts              # createShiftSlot server action
│   │   ├── config/                 # Station / tank / pump / pricing / baselines CRUD
│   │   │   ├── page.tsx            # Station tree + links to Baselines and Fuel pricing
│   │   │   ├── stations/
│   │   │   ├── pricing/
│   │   │   ├── baselines/          # Opening baseline meter/dip values per station
│   │   │   │   ├── page.tsx
│   │   │   │   ├── actions.ts      # savePumpBaseline, saveTankBaseline
│   │   │   │   └── StationSelect.tsx
│   │   │   ├── StationForm.tsx
│   │   │   ├── TankForm.tsx
│   │   │   ├── PumpForm.tsx
│   │   │   ├── StationTree.tsx
│   │   │   └── actions.ts
│   │   ├── reports/                # Daily / weekly / monthly variance
│   │   │   ├── page.tsx
│   │   │   ├── weekly/page.tsx
│   │   │   ├── monthly/page.tsx
│   │   │   └── export/route.ts     # CSV export
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
│   └── Toaster.tsx                 # Toast notifications
│
├── lib/                            # Business logic (no React)
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client (SSR cookies)
│   │   └── admin.ts                # Service role client (bypasses RLS)
│   ├── ocr/
│   │   ├── ocr-service.ts          # Pump meter + POS extraction logic
│   │   └── vision-client.ts        # Google Cloud Vision API wrapper
│   ├── middleware-utils.ts         # Auth guard helpers
│   ├── station-config.ts           # Station/tank/pump/grade CRUD
│   ├── shift-open.ts               # canStartShift guard (blocks on pending/closed)
│   ├── shift-close.ts              # getCloseProgress, canSubmit
│   ├── shift-baselines.ts          # Port/adapter: rolling baseline from prior closed shift
│   │                               #   or shift_baselines table fallback
│   ├── reconciliation.ts           # Core formulas (tank variance, pump vs POS)
│   ├── reconciliation-runner.ts    # Orchestrates reconciliation on submit
│   ├── supervisor-review.ts        # canFlag, canOverride, validateFlagComment
│   ├── deliveries.ts               # Delivery CRUD + getShiftPeriod
│   ├── pricing.ts                  # Versioned fuel prices
│   ├── tank-trends.ts              # Tank level time-series queries
│   ├── owner-reports.ts            # buildStationDayStatus, countPendingShiftsPerStation,
│   │                               #   daily/weekly/monthly report generation
│   ├── aggregate-reports.ts        # Cross-station aggregation
│   ├── user-management.ts          # Invite / assign / deactivate
│   ├── csv-export.ts               # Report CSV formatting
│   ├── idb-queue.ts                # IndexedDB offline queue (browser)
│   └── offline-queue.ts            # Enqueue / drain logic
│
├── supabase/migrations/            # 13 migration files (apply in order)
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
│   └── 20260320000013_reconciliation_formula_revision.sql  # Revised formulas + override schema
│
├── __tests__/                      # Vitest unit tests
│   ├── reconciliation.test.ts      # Formula 1 & 2, financial calc
│   ├── reconciliation-runner.test.ts
│   ├── ocr-service.test.ts
│   ├── ocr-service-pos.test.ts     # POS Z-report OCR extraction
│   ├── aggregate-reports.test.ts   # Cross-station aggregation
│   ├── csv-export.test.ts          # CSV formatting
│   ├── deliveries.test.ts          # Delivery CRUD + reconciliation trigger
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
│   └── offline-queue.test.ts
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
├── PRD.md                          # Full product requirements (53 user stories)
└── .issues/slice-01..15.md         # 15 development slices/epics
```

## Architecture

### Roles
| Role | Access |
|---|---|
| `supervisor` | Create and close shifts, capture readings, flag shifts, submit overrides |
| `owner` | Cross-station reports, config, user management, create shift slots |

Note: the `attendant` role is retired. Supervisors now own the full shift close workflow.

### Shift State Machine
```
pending → closed
```
- Shifts are created as `pending` (by supervisor via `/shift/new` or by owner via dashboard "Create shift slot")
- Shift moves to `closed` only when supervisor explicitly submits via `submitShift`
- `is_flagged` is a boolean field on `closed` shifts — set/cleared independently of status
- Duplicate guard: `canStartShift` in `lib/shift-open.ts` blocks if a `pending` or `closed` shift already exists for the same station/period/date

### Reconciliation (runs on shift submit)
- **Formula 1 — Tank Inventory (per tank):** `Expected Closing Dip = Opening Dip + Deliveries − Meter Delta`
  - Meter Delta = Σ(close − open) for all pumps whose `tank_id` matches this tank (not POS litres)
  - `variance_litres = actual − expected` (negative = inventory loss)
- **Formula 2 — Pump vs POS (per grade):**
  - `variance_litres = pos_litres_sold − meter_delta` (negative = unrecorded dispensing)
  - `expected_revenue_zar = meter_delta × price_per_litre`
  - `variance_zar = pos_revenue_zar − expected_revenue_zar` (negative = revenue shortfall)
- **Sign convention:** negative = loss/shortfall across all variances.
- Revenue is per-grade on `reconciliation_grade_lines` — no station-level revenue total.
- Re-runs automatically when a supervisor submits an override (`createOverride`) or a delivery is added post-close.
- `createOverride` mutates the source reading table (`pump_readings`, `dip_readings`, or `pos_submission_lines`) before inserting into `ocr_overrides` (which is the audit trail only). Supports `reading_type` of `'pump'`, `'dip'`, or `'pos_line'`; pos_line overrides require `field_name` of `'litres_sold'` or `'revenue_zar'`.
- Opening baseline for Formula 1/2 comes from the previous closed shift for that station. If none exists, falls back to the `shift_baselines` table (configured via `/dashboard/config/baselines`). Logic is in `lib/shift-baselines.ts` (port/adapter pattern).

### Rolling Baseline
- `lib/shift-baselines.ts` exports `createSupabaseBaselinesRepository` which provides:
  - `getBaselines(stationId)` — returns all pump/tank baselines for a station
  - `upsertPumpBaseline(stationId, pumpId, value)` — set/update pump meter baseline
  - `upsertTankBaseline(stationId, tankId, value)` — set/update tank dip baseline
- The reconciliation runner resolves opening values by checking prior closed shift first, then falling back to `shift_baselines`.

### Offline-First PWA
1. Photos captured → stored in IndexedDB as blobs
2. Form data queued in IndexedDB via `lib/idb-queue.ts`
3. On reconnect: queue drains — photos upload to Supabase Storage first, then readings submitted via Server Actions with returned URLs
4. `OfflineQueueProvider` exposes pending count and sync status to the UI

### OCR Pipeline
1. Photo uploaded via `app/api/upload/pump-photo/route.ts` or `pos-photo/route.ts`
2. `lib/ocr/vision-client.ts` calls Google Cloud Vision
3. `lib/ocr/ocr-service.ts` extracts meter value or POS lines
4. UI presents extracted value for supervisor to confirm or override
5. Post-close corrections are submitted via `createOverride` server action (stored in `ocr_overrides`, triggers re-reconciliation)

## Database Tables

| Table | Purpose |
|---|---|
| `user_profiles` | Auth roles and station assignment |
| `stations` | Station config |
| `tanks` | Tank capacity and fuel grade |
| `pumps` | Pump numbers and tank mapping |
| `fuel_grades` | 95, 93, D10, D50 |
| `pump_tank_mappings` | Pump → tank associations |
| `shifts` | Shift records with state |
| `pump_readings` | Opening/closing meter per pump |
| `dip_readings` | Tank dip levels per shift |
| `pos_submissions` | Z-report per shift |
| `pos_lines` | OCR-extracted sales lines |
| `reconciliation_records` | Per-shift reconciliation summary |
| `reconciliation_line_items` | Per-grade/tank variance lines |
| `deliveries` | Fuel deliveries by tank |
| `ocr_overrides` | Audit trail of post-close override corrections |
| `shift_baselines` | Fallback opening meter/dip values per station (configured by owner) |
| `fuel_prices` | Versioned ZAR/litre per grade |

RLS policies scope all data to `station_id` via `user_profiles`. Use `lib/supabase/admin.ts` (service role) only for server-side operations that need to bypass RLS.

## Key Patterns

**Server Actions** are co-located with route segments in `actions.ts` files. Use `lib/supabase/server.ts` inside server actions and Server Components.

**Supabase clients:**
- `lib/supabase/server.ts` — SSR (cookies, Server Components, Server Actions)
- `lib/supabase/client.ts` — Browser (Client Components)
- `lib/supabase/admin.ts` — Service role (bypasses RLS, server-only)

**Auth guard:** `middleware.ts` intercepts all routes, checks session and role from `user_profiles`, redirects to `/login` or correct dashboard. Helper logic in `lib/middleware-utils.ts`. The `/review/` route no longer exists — supervisor workflow lives under `/shift/`.

**Config mutations** go through `lib/station-config.ts` (not raw Supabase calls in components).

**Shift summary page (`/shift/[id]/close/summary`)** is a single server component that branches on status:
- `pending`: shows a progress checklist (pumps, dips, POS) and a submit button
- `closed`: shows reconciliation tables, flag/unflag controls, and `<details>` correction forms per reading. Uses zero-JS `<details>/<summary>` HTML for expand/collapse — no client component needed.

**`lib/supervisor-review.ts`** pure functions:
- `canFlag(status)` — true only for `closed` shifts
- `canOverride(status)` — true only for `closed` shifts
- `validateFlagComment(comment)` — returns `{ valid, error? }`
- `validateOverride({ value, reason, reading_type, field_name? })` — validates override input; `pos_line` type requires `field_name` of `'litres_sold'` or `'revenue_zar'`

**`lib/owner-reports.ts`** pure functions:
- `buildStationDayStatus(shifts)` — returns `{ morning, evening }` status strings
- `countPendingShiftsPerStation(shifts)` — returns `Record<stationId, count>` for badge display

## Testing

```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode
```

Tests are in `__tests__/`. Vitest + jsdom + Testing Library. No E2E tests.

## Deployment

- **Frontend:** Vercel — push to `main` triggers deploy
- **Database:** Supabase Cloud — apply migrations with `supabase db push`
- **Storage:** Supabase Storage buckets for shift photos and delivery note photos
