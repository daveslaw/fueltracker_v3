# FuelTracker v3 — Claude Code Guide

## Project Summary

Multi-station fuel inventory PWA for South African petrol stations. Attendants capture shift open/close meter readings and tank dips (with OCR via Google Cloud Vision). Supervisors approve or flag shifts. Owners view cross-station variance reports. Three stations: Elegant Amaglug, Speedway, Truck Stop. Currency: ZAR.

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
│   ├── shift/                      # Attendant shift workflow
│   │   ├── page.tsx                # Shift list / new button
│   │   ├── actions.ts              # Shift create/submit server actions
│   │   ├── new/page.tsx            # Select station & shift period
│   │   └── [id]/
│   │       ├── pumps/              # Open: pump meter capture + OCR
│   │       ├── dips/               # Open: tank dip entry
│   │       ├── summary/            # Review open readings
│   │       └── close/
│   │           ├── pumps/          # Close: pump meter capture
│   │           ├── dips/           # Close: tank dip entry
│   │           ├── pos/            # POS Z-report photo + OCR confirm
│   │           └── summary/        # Review & submit
│   │
│   ├── review/                     # Supervisor workflow
│   │   ├── page.tsx                # List submitted shifts
│   │   ├── [id]/                   # Shift detail: approve, flag, override
│   │   │   ├── page.tsx
│   │   │   ├── ApproveButton.tsx
│   │   │   ├── FlagForm.tsx
│   │   │   ├── OverrideForm.tsx
│   │   │   └── actions.ts
│   │   └── deliveries/             # Record fuel deliveries
│   │       ├── DeliveryForm.tsx
│   │       └── actions.ts
│   │
│   ├── dashboard/                  # Owner reports & config
│   │   ├── page.tsx                # Cross-station status
│   │   ├── config/                 # Station / tank / pump / pricing CRUD
│   │   │   ├── stations/
│   │   │   ├── pricing/
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
│   ├── shift-open.ts               # Shift open workflow
│   ├── shift-close.ts              # Shift close workflow (includes POS)
│   ├── reconciliation.ts           # Core formulas (tank variance, pump vs POS)
│   ├── reconciliation-runner.ts    # Orchestrates reconciliation on submit
│   ├── supervisor-review.ts        # Approve / flag / override logic
│   ├── deliveries.ts               # Delivery CRUD
│   ├── pricing.ts                  # Versioned fuel prices
│   ├── tank-trends.ts              # Tank level time-series queries
│   ├── owner-reports.ts            # Daily/weekly/monthly report generation
│   ├── aggregate-reports.ts        # Cross-station aggregation
│   ├── user-management.ts          # Invite / assign / deactivate
│   ├── csv-export.ts               # Report CSV formatting
│   ├── idb-queue.ts                # IndexedDB offline queue (browser)
│   └── offline-queue.ts            # Enqueue / drain logic
│
├── supabase/migrations/            # 9 migration files (apply in order)
│   ├── 20260319000001_user_profiles.sql
│   ├── 20260320000001_station_config.sql
│   ├── 20260320000002_station_seed.sql    # Seeds 3 stations
│   ├── 20260320000003_shifts.sql
│   ├── 20260320000004_shift_close.sql
│   ├── 20260320000005_pos_ocr_status.sql
│   ├── 20260320000006_reconciliation.sql
│   ├── 20260320000007_deliveries.sql
│   ├── 20260320000008_shifts_submitted_at.sql
│   └── 20260320000009_supervisor_review.sql
│
├── __tests__/                      # Vitest unit tests
│   ├── reconciliation.test.ts      # Formula 1 & 2, financial calc
│   ├── ocr-service-pos.test.ts     # POS Z-report OCR extraction
│   ├── aggregate-reports.test.ts   # Cross-station aggregation
│   ├── csv-export.test.ts          # CSV formatting
│   ├── deliveries.test.ts          # Delivery CRUD + reconciliation trigger
│   └── middleware.test.ts          # Auth guard routing
│
├── public/
│   ├── manifest.json               # PWA manifest
│   └── sw.js                       # Service worker (offline sync)
│
├── middleware.ts                   # Auth guard + role-based routing
├── PRD.md                          # Full product requirements (53 user stories)
└── .issues/slice-01..15.md         # 15 development slices/epics
```

## Architecture

### Roles
| Role | Access |
|---|---|
| `attendant` | Submit shifts for any pump at their station |
| `supervisor` | Approve/flag shifts, record deliveries, override OCR values |
| `owner` | Cross-station reports, config, user management |

### Shift State Machine
```
draft → open → submitted → approved
                        ↘ flagged
```

### Reconciliation (runs on shift submit)
- **Formula 1 — Tank Inventory:** `Expected Closing Dip = Opening Dip + Deliveries − POS Litres Sold`
- **Formula 2 — Pump vs POS:** `Meter Delta per grade − POS Litres Sold per grade`
- **Financial:** `Expected Revenue = POS Litres × Selling Price`
- Re-runs automatically when a supervisor overrides a value or a delivery is added post-submit.

### Offline-First PWA
1. Photos captured → stored in IndexedDB as blobs
2. Form data queued in IndexedDB via `lib/idb-queue.ts`
3. On reconnect: queue drains — photos upload to Supabase Storage first, then readings submitted via Server Actions with returned URLs
4. `OfflineQueueProvider` exposes pending count and sync status to the UI

### OCR Pipeline
1. Photo uploaded via `app/api/upload/pump-photo/route.ts` or `pos-photo/route.ts`
2. `lib/ocr/vision-client.ts` calls Google Cloud Vision
3. `lib/ocr/ocr-service.ts` extracts meter value or POS lines
4. UI presents extracted value for attendant to confirm or override

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
| `supervisor_overrides` | Audit trail of overridden values |
| `fuel_prices` | Versioned ZAR/litre per grade |

RLS policies scope all data to `station_id` via `user_profiles`. Use `lib/supabase/admin.ts` (service role) only for server-side operations that need to bypass RLS.

## Key Patterns

**Server Actions** are co-located with route segments in `actions.ts` files. Use `lib/supabase/server.ts` inside server actions and Server Components.

**Supabase clients:**
- `lib/supabase/server.ts` — SSR (cookies, Server Components, Server Actions)
- `lib/supabase/client.ts` — Browser (Client Components)
- `lib/supabase/admin.ts` — Service role (bypasses RLS, server-only)

**Auth guard:** `middleware.ts` intercepts all routes, checks session and role from `user_profiles`, redirects to `/login` or correct dashboard. Helper logic in `lib/middleware-utils.ts`.

**Config mutations** go through `lib/station-config.ts` (not raw Supabase calls in components).

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
