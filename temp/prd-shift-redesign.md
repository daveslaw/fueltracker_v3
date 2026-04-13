## Problem Statement

The current shift model assumes two separate actors and two separate steps: an attendant captures all readings and submits the shift, then a supervisor reviews and approves it. In practice, the physical pump-and-tank check only ever happens at the end of each shift and is carried out by the supervisor directly. There is no attendant data-capture step in the real workflow. This mismatch creates unnecessary complexity — a submission queue that serves no operational purpose, a two-step UI where one step would do, and an attendant role that has no real-world counterpart.

## Solution

Redesign the shift model around a single actor (supervisor) performing a single event (end-of-shift close check). The supervisor photographs pump meters, dips tanks, and photographs the POS Z-report; the system runs reconciliation and immediately closes the shift. No opening readings are captured — reconciliation uses the previous shift's closing readings as the baseline (rolling model). The attendant role is removed. The owner pre-creates shift slots and sets the initial baseline for each station's first shift.

## User Stories

### Owner — Shift Management
1. As an owner, I want to pre-create morning and evening shift slots for a station and date, so that supervisors have structured work to action each day.
2. As an owner, I want to view all pending shift slots across all stations, so that I can see what checks still need to be completed.
3. As an owner, I want to set initial pump meter readings and tank dip levels for a station, so that the very first shift has a valid reconciliation baseline before any prior shift data exists.
4. As an owner, I want to update the station baseline at any time, so that I can correct a starting point if it was entered incorrectly.
5. As an owner, I want to record fuel deliveries in a separate screen, so that they automatically factor into reconciliation for the correct shift period without requiring supervisor input.
6. As an owner, I want to see all closed shifts for all stations in the history screen, so that I have a complete audit trail across the business.
7. As an owner, I want to see flagged shifts highlighted in my dashboard, so that I can identify discrepancies without having to action or resolve them.
8. As an owner, I want to see the flag comment the supervisor left alongside the flagged shift, so that I understand what issue was noted.
9. As an owner, I want owner reports (daily, weekly, monthly variance) to continue working unchanged, so that I have uninterrupted visibility of inventory and revenue variance.

### Supervisor — Shift Close Check
10. As a supervisor, I want to land directly on the current pending shift for my station when I log in, so that I can begin the close check immediately without navigating.
11. As a supervisor, I want to see a clear message if no pending shift exists for the current period, so that I know whether I need to create one.
12. As a supervisor, I want to create a shift myself for the current period if the owner has not pre-created one, so that I am not blocked.
13. As a supervisor, I want to photograph each pump meter and have the reading extracted via OCR, so that I can capture close meter values quickly and accurately.
14. As a supervisor, I want to confirm the OCR-extracted pump meter reading or override it with a manually typed value, so that I can correct any extraction errors before submitting.
15. As a supervisor, I want to enter a closing tank dip reading (in litres) for each tank at the station, so that I can record physical stock levels at shift end.
16. As a supervisor, I want to photograph the POS Z-report and have the sales lines (grade, litres, revenue) extracted via OCR, so that I can capture daily sales without manual transcription.
17. As a supervisor, I want to confirm or override each OCR-extracted POS sales line, so that I can correct any misread values before submitting.
18. As a supervisor, I want to see a progress summary before submitting, so that I can verify all readings are complete and correct.
19. As a supervisor, I want the shift to close immediately when I submit the readings — with reconciliation calculated automatically — so that I do not need to wait for an approval step.
20. As a supervisor, I want to see the reconciliation results (tank variance, pump-vs-POS variance, revenue variance) on the closed shift summary screen, so that I know immediately whether the shift balances.
21. As a supervisor, I want to flag a closed shift with a comment, so that I can alert the owner to a discrepancy I cannot resolve.
22. As a supervisor, I want to remove a flag I previously set on a closed shift, so that I can correct an accidental flag.
23. As a supervisor, I want to amend a reading I entered on a closed shift by providing a corrected value and a mandatory reason, so that reconciliation reflects the true data.
24. As a supervisor, I want the correction to trigger reconciliation to re-run immediately, so that I see updated variance figures without refreshing.
25. As a supervisor, I want each correction to be logged in an override audit trail, so that all changes to the original readings are traceable.
26. As a supervisor, I want to see a step-by-step progress indicator (pumps → dips → POS → submit) as I work through the close check, so that I always know what is outstanding.

## Implementation Decisions

### Shift State Machine (new)
- States: `pending` → `closed`
- `is_flagged: boolean` (default false) — property on the shift record, not a state
- `flag_comment: text` nullable
- Retired states for new shifts: `draft`, `open`, `pending_pos`, `submitted`, `approved`
- A supervisor can flag or unflag any `closed` shift

### Rolling Baseline Model
- No opening readings are captured. Reconciliation uses the previous shift's `close` pump readings and `close` dip readings as the opening baseline.
- When no prior shift exists for a station, the runner falls back to the `shift_baselines` table (owner-entered initial readings).
- The `pump_readings` and `dip_readings` tables retain the `type` column; new shifts only ever write `type = 'close'`. The `'open'` value is reserved for archived historical data.

### New Module — lib/shift-baselines.ts
- Interface: `getBaseline(stationId)`, `upsertPumpBaseline(stationId, pumpId, value)`, `upsertTankBaseline(stationId, tankId, value)`, `listBaselines(stationId)`
- Called by the reconciliation runner when no prior closed shift exists for the station.

### Modified Module — lib/reconciliation-runner.ts
- `assemblePureInputs()` now fetches the previous shift's `close` readings as opening values instead of the current shift's `open` readings.
- Fallback path: if no prior shift, reads from `shift_baselines`.
- New warning code: `NO_PRIOR_SHIFT_BASELINE` — emitted when neither prior shift nor station baseline exists (reconciliation cannot run).
- `ReconciliationInputs` interface in `lib/reconciliation.ts` is unchanged — the pure computation layer is unaffected.

### Modified Module — lib/shift-close.ts
- `canSubmit()` updated: accepts `pending` status (replaces `open` / `pending_pos` checks).
- `resolveCloseStatus()` simplified: returns `pending` while incomplete, `closed` when all close readings and POS are present.
- `pending_pos` intermediate state removed.

### Modified Module — lib/supervisor-review.ts
- Remove `canReview()` and `ReviewAction` type (no approve action).
- Retain `validateOverride()` unchanged.
- Add `canFlag(status: ShiftStatus): boolean` — only `closed` shifts can be flagged or unflagged.

### Modified Server Actions — app/shift/actions.ts
- Remove `createOpenPumpReading`, `createOpenDipReading` and related opening-phase actions.
- Update `submitShift`: transitions shift to `closed` (not `submitted`); triggers `runReconciliation`.
- Add `flagShift(shiftId, comment)` and `unflagShift(shiftId)` actions.

### App Route Changes
- `app/shift/page.tsx` — auto-selects the current period pending shift; shows "Create shift" button if none exists.
- `app/shift/new/page.tsx` — simplified; supervisor selects period only (station is their own).
- Remove `app/shift/[id]/pumps/` (opening pump readings screen).
- Remove `app/shift/[id]/dips/` (opening dip readings screen).
- Remove `app/shift/[id]/summary/` (opening summary screen).
- Retain `app/shift/[id]/close/pumps/`, `/dips/`, `/pos/`, `/summary/` — these become the entire shift workflow.
- `app/shift/[id]/close/summary/` — add flag/unflag button; "Submit" closes the shift immediately; reconciliation results shown inline.
- Remove `app/review/` entirely (no supervisor approval queue).
- Owner dashboard history screen absorbs shift audit trail (no new pages needed).

### Database Schema Changes
- `shifts.status` CHECK constraint updated to include `pending` and `closed`.
- `shifts.supervisor_id uuid` (FK → user_profiles) — new column. `attendant_id` retained (nullable) for archived historical data only.
- `shifts.is_flagged boolean DEFAULT false NOT NULL`.
- `shifts.flag_comment text` (nullable).
- New table: `shift_baselines (id uuid PK, station_id uuid FK, pump_id uuid nullable FK, tank_id uuid nullable FK, reading_type text CHECK ('meter', 'dip'), value numeric(12,2), set_at timestamptz, set_by uuid FK)` — one row per pump or tank per station.

### Migration Strategy
- Existing shifts (submitted / approved / flagged / draft / open) are archived: a new `shifts_archive` table receives all rows from `shifts` where status is not `pending` or `closed`.
- The live `shifts` table is cleared of historical data. New shifts use the `pending` / `closed` model only.
- No retroactive status remapping.

## Testing Decisions

Good tests assert external behavior given controlled inputs — they do not inspect internal state or mock implementation details beyond the I/O boundary (Supabase calls).

### Modules to test

**lib/shift-close.ts** (updated)
- Test `canSubmit()` with `pending` status (allowed), and `closed`, `draft`, `open` (blocked).
- Test `getCloseProgress()` and `resolveCloseStatus()` with the simplified two-state model.
- Prior art: `__tests__/shift-close.test.ts`.

**lib/reconciliation.ts** (rolling model inputs)
- Test `computeReconciliation()` with `openDips` and `pumpReadings.opening_reading` sourced from a simulated previous close (not explicit opening entries). Verify Formula 1, Formula 2, and financial calculations remain correct.
- Prior art: `__tests__/reconciliation.test.ts`.

**lib/reconciliation-runner.ts** (updated)
- Test `assemblePureInputs()` with the prev-shift baseline path: verify it fetches prior close readings correctly.
- Test the station-baseline fallback path: verify it reads from `shift_baselines` when no prior shift exists.
- Test the `NO_PRIOR_SHIFT_BASELINE` warning: emitted when neither path has data.
- Prior art: existing reconciliation runner tests.

**lib/shift-baselines.ts** (new)
- Test `upsertPumpBaseline` and `upsertTankBaseline` write the correct rows.
- Test `getBaseline` returns the latest value per pump/tank.
- Prior art: `__tests__/deliveries.test.ts` (CRUD + reconciliation trigger pattern).

## Out of Scope

- Re-designing owner report visuals (reports continue to consume the same reconciliation output; no UI changes to the reports section).
- OCR pipeline changes (Google Cloud Vision integration, extraction logic, and photo upload API routes are unchanged).
- Offline PWA / IndexedDB sync queue (service worker and offline queue unaffected).
- User management and invite flow (role assignments unchanged; the attendant role goes unused rather than being formally deleted from the schema at this time).

## Further Notes

The reconciliation pure function (`computeReconciliation` in `lib/reconciliation.ts`) is intentionally unchanged at the interface level — it still accepts `openDips` and `opening_reading` fields. The rolling-model concern is entirely encapsulated in the runner's `assemblePureInputs()` function. This preserves the clean I/O separation and means existing reconciliation formula tests remain valid with only their input fixtures updated.

The `type = 'open'` value on `pump_readings` and `dip_readings` is not removed from the schema, as it is needed to read archived historical data. New application code will never write `type = 'open'`.
