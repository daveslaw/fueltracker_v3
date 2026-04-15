## Problem Statement

The app is slow to load on every page — owners and supervisors experience noticeable TTFB on the dashboard, config, reports, and shift close workflow. The root causes are:

1. The users page calls the Supabase Admin API (`listUsers()`) on every render to retrieve email and last-login data, despite this being the slowest API endpoint available.
2. Several pages perform sequential Supabase round-trips where later queries only depend on data from the first — creating unnecessary waterfalls of 4–7 network calls before the page can render.
3. Station configuration data (stations, tanks, pumps) is fetched fresh on every request despite changing at most once a month.
4. Owner-facing pages (`/dashboard`, `/dashboard/reports`) duplicate the auth check that middleware already performed, adding 2 extra Supabase round-trips per page load.
5. No database indexes exist on any table. Every query is a full table scan. As shift data accumulates (61+ pump readings per shift, twice daily), query times will grow linearly.
6. The middleware emits `console.log` on every matched request, adding noise and minor overhead on the edge runtime.

## Solution

A set of targeted, structural changes that eliminate redundant work at every layer — database, server, and application:

- Denormalise `email` into `user_profiles` (populated at invite time) so the Admin API is never needed for the users page.
- Reorganise sequential fetches into `Promise.all` batches so pages make 2–3 round-trips instead of 4–7.
- Cache station config with `unstable_cache` and invalidate it explicitly on mutation via `revalidateTag`.
- Remove in-page auth checks from owner pages that middleware already guards.
- Add a migration with composite and single-column indexes on all hot query patterns.
- Remove console.logs from middleware.

## User Stories

1. As an owner, I want the Users page to load quickly, so that I can manage staff without waiting on slow API calls.
2. As an owner, I want the Station Config page to load instantly on repeat visits, so that I can review configuration without delay.
3. As an owner, I want the Owner Dashboard to load in as few round-trips as possible, so that I get shift status quickly at the start of the day.
4. As an owner, I want the Daily Report page to load quickly, so that I can review variance data without frustration.
5. As a supervisor, I want the Deliveries page to load quickly, so that I can record deliveries without waiting.
6. As a supervisor, I want the Shift Summary page to load quickly whether the shift is pending or closed, so that I can review and submit without delay.
7. As an owner, I want config mutations (adding/editing stations, tanks, pumps) to immediately reflect updated data, so that the cache never serves stale config after a change.
8. As an owner, I want invited users to appear in the Users list with their email shown correctly, so that I can identify who is who without any Admin API dependency.
9. As an owner, I want user status to clearly show active or inactive, so that I can manage access without ambiguity.
10. As an owner, I want report and dashboard pages to load without redundant auth checks slowing them down, so that I get to my data faster.
11. As a developer, I want database indexes on all commonly-queried columns, so that query performance remains fast as shift data accumulates over months and years.
12. As a developer, I want middleware to run cleanly without debug logging in production, so that edge function overhead is minimised.
13. As a developer, I want station config queries to be centralised behind a cacheable interface, so that caching logic is not scattered across pages.

## Implementation Decisions

### Schema changes (migrations)

- **Migration 0010 — user_profile_email:** Add nullable `email text` column to `user_profiles`. Backfill existing rows from `auth.users` using a subquery. The invite server action must be updated to write `email` into `user_profiles` at invite time.

- **Migration 0011 — indexes:** Add the following indexes:
  - `shifts(station_id)`, `shifts(shift_date)`, composite `shifts(station_id, shift_date)`
  - `pump_readings(shift_id)`, composite `pump_readings(shift_id, type)`
  - `dip_readings(shift_id)`, composite `dip_readings(shift_id, type)`
  - `pos_submissions(shift_id)`
  - `deliveries(station_id)`, composite `deliveries(station_id, shift_date)`
  - `reconciliation_tank_lines(reconciliation_id)`
  - `reconciliation_grade_lines(reconciliation_id)`
  - `user_profiles(user_id)`
  - `ocr_overrides(shift_id)`

### lib/user-management.ts

- `getUserStatus` drops the `last_sign_in_at` parameter. It now accepts only `{ is_active: boolean }` and returns only `'active' | 'inactive'`. The `'pending'` status is removed.

### lib/station-config.ts

- Extract a `getCachedStationTree()` function that wraps the three station/tank/pump Supabase queries in `unstable_cache` with the tag `'station-config'`.
- Export a `revalidateStationConfig()` helper that calls `revalidateTag('station-config')`.
- The config page uses `getCachedStationTree()` instead of issuing the three queries directly. The `force-dynamic` export is removed from the config page.

### app/dashboard/config/actions.ts

- Every mutation action (add/edit station, tank, pump) calls `revalidateStationConfig()` after a successful write.

### app/dashboard/users/page.tsx

- Remove `admin.auth.admin.listUsers()` entirely.
- Query only `user_profiles` (with the new `email` column) and `stations`.
- Remove `last_sign_in_at` from the rendered user row.
- The `UserRow` component no longer receives or displays last login time.

### app/dashboard/page.tsx

- Remove the `supabase.auth.getUser()` + `user_profiles` auth check. Middleware guarantees the request is from an active owner before the page renders.

### app/dashboard/reports/page.tsx

- Same auth check removal as the dashboard page.

### middleware.ts

- Remove both `console.log` statements.

### app/shift/[id]/close/deliveries/page.tsx

- Fetch shift first (required for `station_id`), then issue station name, tanks, and deliveries in a single `Promise.all`. Reduces 4 sequential round-trips to 2.

### app/shift/[id]/close/summary/page.tsx

- **Pending path:** Fetch shift first, then issue station, pumps, pump_readings, tanks, dip_readings, pos_submissions, deliveries, and reconciliation all in a single `Promise.all`. Reduces to 2 round-trips.
- **Closed path:** Same first batch as pending path. After it resolves, issue a second `Promise.all` for tank lines, grade lines, pos lines (keyed on `posSubmission.id`), and overrides (keyed on `rec.id`). Reduces 7+ sequential round-trips to 3.

## Testing Decisions

**What makes a good test here:** test the external behaviour of pure functions — inputs in, outputs out — not implementation details like which Supabase client method was called or whether `unstable_cache` was invoked.

**Module to update:** `lib/user-management.ts` — the existing `__tests__/user-management.test.ts` covers `getUserStatus`. It must be updated to:
- Remove test cases that assert `'pending'` is returned.
- Remove test cases that pass `last_sign_in_at` as an argument.
- Verify that `{ is_active: true }` returns `'active'` and `{ is_active: false }` returns `'inactive'`.

No new test files are required. The query restructuring changes are I/O-level (server components calling Supabase), not logic-level, and are verified by the application working correctly. The cache wrapper delegates to `unstable_cache` and the underlying `buildStationTree` pure function — `buildStationTree` is already tested in `__tests__/station-config.test.ts`.

## Out of Scope

- Suspense streaming / progressive rendering (perceived load improvements via partial hydration).
- End-to-end tests or integration tests against a real Supabase instance.
- Caching shift-level data (shifts change frequently; caching would require careful invalidation on every submission).
- Supabase Realtime as a replacement for the 30-second dashboard poller.
- Query optimisation for the weekly/monthly report pages.
- Connection pooling configuration (Supabase handles this at the platform level).

## Further Notes

- The dashboard poller (`DashboardPoller.tsx`) calls `router.refresh()` every 30 seconds. This is intentional and is left unchanged. Once the duplicate auth checks and sequential fetches are removed, each refresh will be cheap.
- The `email` column on `user_profiles` should be kept in sync at invite time. There is no automated sync for email changes made directly in the Supabase Auth dashboard — acceptable for an internal tool where email changes are rare.
- All index additions are non-destructive and can be applied to a live database without downtime (Postgres creates indexes without locking reads).
