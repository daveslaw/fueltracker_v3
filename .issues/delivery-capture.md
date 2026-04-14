## Problem Statement

Supervisors currently have no way to record fuel deliveries received during a shift. The reconciliation formulas already account for deliveries mathematically (Formula 1: `Expected Closing Dip = Opening Dip + Deliveries − POS Litres Sold`), but the data never makes it into the system because there is no capture UI. As a result, any shift where a tanker delivery occurred will always show a false positive tank variance equal to the delivery volume.

## Solution

Add a **Deliveries** step to the shift close workflow, positioned between the Dip readings step and the POS Z-report step. Supervisors can record zero or more deliveries per shift, each consisting of a tank selection, litres received, and a required photo of the delivery receipt (for audit purposes). The step is silently optional — the supervisor can proceed with zero entries. Deliveries can also be added after a shift is closed from the shift summary page, which triggers a reconciliation re-run.

## User Stories

1. As a supervisor, I want a dedicated Deliveries step in the shift close flow, so that I have a clear place to record any fuel that was delivered during my shift.
2. As a supervisor, I want to skip the Deliveries step with zero entries, so that I am not blocked from submitting on shifts where no delivery occurred.
3. As a supervisor, I want to record multiple delivery entries in a single shift, so that I can capture deliveries to different tanks or multiple loads to the same tank.
4. As a supervisor, I want to select which tank the delivery went into, so that the litres are attributed to the correct grade in reconciliation.
5. As a supervisor, I want to enter the number of litres received for each delivery, so that the tank inventory calculation reflects the actual stock added.
6. As a supervisor, I want to photograph the delivery receipt for each entry, so that there is documentary proof attached to the record.
7. As a supervisor, I want the photo to be required before saving a delivery entry, so that unsubstantiated delivery claims cannot be recorded.
8. As a supervisor, I want the delivery timestamp to be set automatically when I save the entry, so that I do not need to manually input timing.
9. As a supervisor, I want to see all deliveries I have recorded for the current shift listed on the Deliveries page, so that I can review what has been entered before proceeding.
10. As a supervisor, I want to delete a delivery entry I recorded in error before the shift is submitted, so that I can correct mistakes during capture.
11. As a supervisor, I want a "Continue to POS" button on the Deliveries page, so that I can move forward in the workflow at any point regardless of how many deliveries I have entered.
12. As a supervisor, I want to navigate back to the Dip readings from the Deliveries page, so that I can correct a dip reading I noticed was wrong.
13. As a supervisor, I want to add a delivery to a shift after it has been closed, so that I can correct a missed delivery discovered later.
14. As a supervisor, I want the reconciliation to re-run automatically after I add a post-close delivery, so that the variance figures update immediately without manual intervention.
15. As a supervisor, I want to see deliveries listed on the closed shift summary page, so that I have a full audit view of what was recorded.
16. As an owner, I want delivery entries to include a receipt photo URL, so that I can verify deliveries during a reconciliation audit.
17. As an owner, I want the Tank Inventory reconciliation table to show delivery volumes correctly, so that I can distinguish between genuine stock losses and un-recorded deliveries.

## Implementation Decisions

### Modules to build or modify

**`lib/deliveries.ts` — Delivery CRUD (extend existing file)**
Currently only exports `getShiftPeriod`. Add:
- `createDelivery(params)` — inserts a row into the `deliveries` table with station_id, tank_id, litres_received, delivery_note_url, recorded_by, and a server-generated timestamp. Returns the created record or an error.
- `getShiftDeliveries(stationId, shiftDate, period)` — fetches all deliveries for a station/date filtered to the correct half-day using the existing `getShiftPeriod` function. Returns an array.
- `deleteDelivery(deliveryId, stationId)` — deletes a single delivery, scoped to the caller's station for RLS safety.

This module encapsulates all delivery I/O. Reconciliation continues to read the `deliveries` table directly via the runner — no coupling change needed.

**`app/api/upload/delivery-photo/route.ts` — New upload endpoint**
POST handler following the same pattern as the existing pump-photo and pos-photo routes. Accepts multipart form with `file` and `shiftId`. Uploads to a new Supabase Storage bucket named `delivery-photos`. Returns `{ url }` or `{ error }`. No OCR. Auth-gated (401 if no session).

**`app/shift/[id]/close/deliveries/page.tsx` — New shift close step (server component)**
- Fetches the shift's station tanks and existing deliveries for the shift period.
- Renders a list of recorded deliveries (tank label, litres, receipt photo thumbnail).
- Renders a client-side "Add delivery" form: tank selector (dropdown of station tanks with grade labels), litres input, file input for receipt photo, Save button.
- Always renders a "Continue to POS" link, enabled regardless of delivery count.
- Renders a "Back to Dip readings" link.
- Redirects to summary if shift is already closed.

**`app/shift/actions.ts` — New server actions**
- `saveDelivery(shiftId, formData)` — validates tank_id and litres_received (greater than 0), requires delivery_note_url, resolves station_id from the shift, resolves the caller's profile id, calls `createDelivery`. If the shift is already closed, also calls `runReconciliation(shiftId)`.
- `deleteDelivery(deliveryId, shiftId)` — only allowed when shift status is `pending`; deletes the row via `lib/deliveries.ts`.

**`app/shift/[id]/close/dips/page.tsx` — Update navigation**
Change the "Continue" button destination from `/pos` to `/deliveries`. The `isReadyForPos` guard currently controls visibility of the continue button — rename or repurpose to `isReadyForDeliveries` (same logic: all dips complete).

**`app/shift/[id]/close/summary/page.tsx` — Two additions**
1. Progress checklist (pending view): add an informational Deliveries row showing count of deliveries recorded. Non-blocking — no tick required for submission.
2. Closed view: add a "Deliveries" section showing the list of deliveries for the shift, plus an inline "Add delivery" form (same fields as the capture page). On save, triggers `saveDelivery` which re-runs reconciliation and revalidates the page.

### Schema
No schema changes required. The `deliveries` table already exists with the correct columns: `station_id`, `tank_id`, `litres_received`, `delivery_note_url`, `delivered_at`, `recorded_by`. RLS policies are already in place for supervisor write and owner read.

### Storage
New Supabase Storage bucket `delivery-photos`. Public read, authenticated write. Path pattern: `shifts/{shiftId}/deliveries/{timestamp}.jpg`.

### Reconciliation
No changes to `lib/reconciliation.ts` or `lib/reconciliation-runner.ts`. The runner already loads deliveries for the shift date and filters by period using `getShiftPeriod`. Post-close delivery additions re-run reconciliation via the existing `runReconciliation(shiftId)` call inside `saveDelivery`.

### Navigation flow after change
`/shift/[id]/close/pumps` → `/shift/[id]/close/dips` → `/shift/[id]/close/deliveries` → `/shift/[id]/close/pos` → `/shift/[id]/close/summary`

## Testing Decisions

**What makes a good test:** Test only the observable contract of a module — inputs and outputs — not internal implementation details. Tests should be independent of each other, require no running Supabase instance, and use injected mocks at module boundaries only.

**`lib/deliveries.ts`**
- Unit tests for `getShiftDeliveries` — given a list of deliveries with various timestamps, assert correct period filtering.
- Unit tests for `createDelivery` — given valid inputs, assert correct shape passed to Supabase insert mock.
- Unit tests for `deleteDelivery` — assert delete is called with correct ID and station scope.
- Prior art: `__tests__/deliveries.test.ts` (currently only tests `getShiftPeriod`).

**`saveDelivery` action validation**
- Unit tests for input validation: litres <= 0 should return error; missing photo URL should return error; missing tank_id should return error.
- Prior art: `__tests__/shift-open.test.ts`, `__tests__/supervisor-review.test.ts`.

**Reconciliation (no new tests needed)**
- `computeReconciliation` is already tested in `__tests__/reconciliation.test.ts` with delivery inputs. Post-close re-run is covered by `__tests__/reconciliation-runner.test.ts`.

## Out of Scope

- OCR extraction from delivery receipt photos.
- Editing a delivery entry after it has been saved (delete and re-add is the correction path).
- Deleting a delivery from a closed shift (additions only post-close).
- Delivery approval workflow (no supervisor-to-owner sign-off on individual deliveries).
- Delivery note PDF support (JPEG/PNG only for now).
- Bulk import of deliveries.
- Owner-initiated delivery creation from the dashboard (owner can add via the closed shift summary, same as supervisor).

## Further Notes

- Timestamp assignment uses `now()` server-side inside `createDelivery`, not a client-supplied value. This keeps the period assignment reliable and prevents backdating.
- The `getShiftPeriod` function in `lib/deliveries.ts` already drives period filtering in the reconciliation runner. The same function should be used in `getShiftDeliveries` to avoid divergence.
- The existing `deliveries` table has no `shift_id` foreign key — deliveries are matched to shifts by station + date + period, not by direct reference. This is intentional and must not be changed.
- The delivery-photos Storage bucket must be created in the Supabase dashboard (or via migration/script) before the upload route can be used in production.
