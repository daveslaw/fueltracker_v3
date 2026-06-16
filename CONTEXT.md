# FuelTracker v3 — Domain Glossary

## Station Tablet
A single physical device (tablet) permanently assigned to one station. All supervisors and cashiers at that station share this device. The device is never moved between stations.

## Station Binding
The one-time configuration stored in `localStorage` that tells the app which station this tablet belongs to (`station_id`). Set by an owner via the `/setup` page. Survives browser restarts indefinitely. If browser data is cleared, the owner repeats setup.

## User Picker
The screen shown on a station tablet when no one is authenticated. Lists all active supervisors and cashiers at that station who have a PIN set. Owners never appear in the picker. Replaces the standard email/password login page for the tablet workflow.

## PIN
A 4-digit numeric credential used exclusively on station tablets. Stored as a bcrypt hash in `user_profiles.pin_hash`. Verified server-side; a Supabase session is created via the admin `createSession` API — the PIN is never used as a Supabase password. Owner-managed: owners set PINs for their staff in `/dashboard/users`. Users without a PIN do not appear in the User Picker.

## Handoff
The explicit transition between a supervisor and cashier (or back) on the station tablet. Triggered automatically by the app at workflow boundaries:
- After the supervisor captures all pumps + dips and reaches the deliveries page → "Pass to cashier" (shown on the deliveries page, allowing the supervisor to record any deliveries before handing off)
- After the cashier submits → "Pass back to supervisor"

The handoff prompt is full-screen and unavoidable. It signs out the current user and returns to the User Picker.

There are three handoff points in a complete shift cycle:
1. Supervisor → Cashier: on the deliveries page, after pumps + dips are complete
2. Cashier → Supervisor: on the cashier summary page, after cashier submits
3. Supervisor → idle: on the shift close/summary page, after the supervisor submits the shift ("Shift complete. Sign out when done.")

When the supervisor signs back in after a cashier handoff, the app auto-redirects to the in-progress shift's close/summary page (status `pending`, cashier already submitted) rather than the generic `/shift` landing. This avoids the supervisor needing to navigate manually to a shift they were already mid-way through.

When a cashier signs in on a tablet, the app auto-redirects to `/cashier/[shiftId]/fuel-pos` if there is exactly one shift at their station with pumps + dips captured but `cashier_submitted_at` null.

Both redirects are resolved in `lib/middleware-utils.ts` (server-side, using the session profile's `station_id`) — not client-side on the list pages.

## Idle Timeout
If the tablet is left unattended for 10 minutes with an authenticated session, the app automatically signs out and returns to the User Picker. Safety net — the primary sign-out mechanism is the Handoff prompt.

## Cashier Identity
The specific individual cashier who submitted a shift's cashier workflow. Stored as `shifts.cashier_id` (FK → `user_profiles`), set when the cashier submits. Displayed in shift history and owner reports alongside `supervisor_id`. Distinct from `cashier_submitted_at` which records the timestamp only.
