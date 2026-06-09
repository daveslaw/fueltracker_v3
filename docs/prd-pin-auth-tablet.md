## Problem Statement

Station supervisors and cashiers share a single tablet at each station. The current email/password login creates two problems for uneducated field users on a touchscreen device:

1. Typing email addresses on a tablet keyboard is cumbersome and slow, creating friction every time the device changes hands.
2. Users forget to log out, leaving the device in the wrong role — a cashier opens the app and lands in the supervisor workflow, or vice versa.

Within a single shift, the device changes hands at least twice: supervisor opens the shift, hands to cashier for POS/stock capture, cashier hands back to supervisor to close and submit. Each handoff requires a full logout/login cycle under the current system.

## Solution

Replace the standard email/password login on station tablets with a PIN-based User Picker. Each tablet is permanently assigned to a station. Staff tap their name from a list, enter a 4-digit PIN, and are authenticated. Explicit full-screen Handoff prompts at workflow boundaries make role transitions unavoidable. An idle timeout acts as a safety net.

Email/password login is preserved unchanged for owners and for access from non-tablet devices.

Individual cashier identity is recorded on each shift for accountability.

## User Stories

1. As an owner, I want to assign a station to a tablet via a setup screen, so that the device knows which staff to show without me configuring anything technical.
2. As an owner, I want the setup screen to sign me out automatically after assigning a station, so that the tablet immediately shows the User Picker for staff.
3. As an owner, I want to set a full name for each staff member when managing users, so that the User Picker shows recognisable names rather than email addresses.
4. As an owner, I want to set a 4-digit PIN for each supervisor and cashier, so that they can authenticate on the tablet without typing their email.
5. As an owner, I want to reset a staff member's PIN from the user management screen, so that I can help them if they forget it.
6. As an owner, I want a staff member's account to lock after 10 failed PIN attempts, so that accidental repeated entries do not cascade into an unusable state.
7. As an owner, I want to unlock a PIN-locked account from the user management screen, so that a locked-out staff member can resume work quickly.
8. As an owner, I want to see which cashier submitted each shift in the shift history detail view, so that I have individual accountability for cashier data.
9. As an owner, I want to see the cashier name in daily and other reports alongside the supervisor name, so that I know who was responsible for each side of a shift.
10. As a supervisor, I want to tap my name on the User Picker and enter my 4-digit PIN, so that I can log in without typing my email address.
11. As a supervisor, I want the app to show a full-screen prompt to pass the device to the cashier after I complete my opening steps, so that the handoff is explicit and I cannot forget to log out.
12. As a supervisor, I want to return to the User Picker automatically when I hand off to the cashier, so that the cashier sees their own name rather than my session.
13. As a supervisor, I want the app to show a full-screen prompt to pass the device back to me after the cashier submits, so that I can log back in to close the shift.
14. As a supervisor, I want the app to sign me out and return to the User Picker if the tablet is left idle for 10 minutes, so that an unattended device does not remain in my session.
15. As a cashier, I want to tap my name on the User Picker and enter my 4-digit PIN, so that I can log in without typing my email address.
16. As a cashier, I want to see a full-screen prompt to pass the device back to the supervisor after I submit my shift data, so that the handoff is explicit and I cannot forget to log out.
17. As a cashier, I want the app to sign me out and return to the User Picker if the tablet is left idle for 10 minutes, so that an unattended device does not remain in my session.
18. As any staff member, I want to see a clear error message if I enter the wrong PIN, so that I know to try again rather than assume the system is broken.
19. As any staff member, I want to see how many PIN attempts I have remaining before lockout, so that I do not accidentally lock my account.
20. As any staff member, I want the standard email/password login to remain accessible at a known URL, so that an owner can always access the system from the tablet in an emergency.

## Implementation Decisions

### Station Binding
- Each tablet stores its assigned `station_id` in `localStorage` under a well-known key.
- An owner-authenticated `/setup` page lists all stations in a dropdown. On submit, the `station_id` is written to `localStorage` and the owner is signed out, leaving the tablet on the User Picker.
- If `localStorage` has no `station_id`, the app shows the standard email/password login (the existing `/login` page is the fallback).
- The standard `/login` page remains accessible at its URL at all times as a permanent escape hatch.

### User Picker
- When `localStorage` contains a `station_id` and no authenticated session exists, the app shows the User Picker instead of the login form.
- The User Picker fetches staff from a public (unauthenticated) API route: `GET /api/station-users?stationId=X`. Response: `[{ id, full_name, role }]`. No email or sensitive data is returned.
- Only active supervisors and cashiers with a PIN set are shown. Owners are excluded.
- Tapping a name opens a PIN pad for that user.

### PIN Authentication
- PINs are 4 digits (numeric only).
- PINs are stored as bcrypt hashes in `user_profiles.pin_hash`. The PIN is never used as the Supabase password — it is a separate credential.
- PIN verification and session creation are handled by a server action: it verifies the hash, then calls `supabase.auth.admin.createSession(userId)` to issue a real Supabase session. Session tokens are returned to the client, which calls `supabase.auth.setSession(access_token, refresh_token)`.
- Email/password login continues to work unchanged for all users on non-tablet devices.

### PIN Lockout
- `user_profiles` stores `pin_attempts smallint default 0`.
- After 10 consecutive failed attempts, `user_profiles.pin_locked` is set to `true` and the user disappears from the User Picker.
- Only the owner can reset `pin_locked` via the user management screen. Resetting also zeroes `pin_attempts`.
- A successful PIN entry resets `pin_attempts` to 0.

### Handoff Flow
- After the supervisor completes the last step before the cashier's turn, the app renders a full-screen Handoff prompt: "Pass device to cashier." Tapping it signs out the supervisor and navigates to the User Picker.
- After the cashier submits, the cashier summary page renders a full-screen Handoff prompt: "Pass device back to supervisor." Tapping it signs out the cashier and navigates to the User Picker.
- Handoff prompts are rendered at the page level — they are not dismissable without tapping through.

### Idle Timeout
- A client-side hook (`useIdleTimeout`) listens to `mousemove`, `touchstart`, `keydown`, and `click` events. After 10 minutes of inactivity, it calls `supabase.auth.signOut()` and navigates to the User Picker (or standard login if no station binding exists).
- The hook is mounted at the root layout level so it covers all authenticated pages.

### Schema Changes
- `user_profiles`: add `full_name text not null`, `pin_hash text`, `pin_attempts smallint not null default 0`, `pin_locked boolean not null default false`.
- `shifts`: add `cashier_id uuid references user_profiles(id)` (nullable). Set when the cashier submits. Displayed in shift history detail and owner reports alongside `supervisor_id`.
- Existing users: `full_name` is required for new users; existing rows are backfilled with a placeholder (their email prefix) via migration. PIN fields default to null/0/false — existing users do not appear in the User Picker until the owner sets their PIN.

### User Management Screen
- Invite form gains a required `full_name` field.
- Each user row gains a "Set PIN" action (owner-only): a small form to enter and confirm a 4-digit PIN. On save, the server action hashes the PIN and writes `pin_hash`, resets `pin_attempts` and clears `pin_locked`.
- Locked accounts are visually indicated with an "Unlock" action.

### Cashier Identity on Shifts
- `submitCashierShift` server action stamps both `cashier_submitted_at` and `cashier_id` (the authenticated user profile id) on the shift row.
- Shift history detail page and owner daily/weekly/monthly reports display the cashier full name alongside the supervisor full name.

### Architecture Note
See ADR 0001 (`docs/adr/0001-pin-auth-for-station-tablets.md`) for the rationale behind PIN-as-separate-credential and the `admin.createSession` approach.

## Testing Decisions

Good tests in this codebase test external behaviour through the module's public interface, using plain fixture data — no Supabase mocks. See `__tests__/user-management.test.ts`, `__tests__/shift-open.test.ts`, and `__tests__/cashier-submission.test.ts` as prior art.

**Modules with tests:**

- `lib/pin-auth.ts` — test that `hashPin` produces a non-reversible hash, `verifyPin` returns true for the correct PIN and false for a wrong PIN, `shouldLockout` returns true at the threshold and false below it, and that a correct PIN after failed attempts does not trigger lockout.
- `lib/user-management.ts` additions — test that `validatePin` rejects non-numeric input, lengths other than 4, and accepts valid 4-digit strings. Test that `validateFullName` rejects empty strings and whitespace-only strings.
- `lib/idle-timeout.ts` — test that the timeout callback fires after the configured interval with no activity, and does not fire if activity resets the timer before the interval elapses.

UI components (UserPicker, PinPad, HandoffPrompt) and server actions are not unit-tested — their correctness is verified by running the app.

## Out of Scope

- Self-service PIN reset by staff (owner-managed only).
- Biometric or NFC authentication.
- Multiple simultaneous authenticated sessions on one device.
- Owners appearing in the User Picker.
- Any changes to the email/password login flow or the invite/set-password flow.
- E2E or integration tests.
- Changes to the cashier workflow steps themselves (fuel POS, stock POS, stock count) — only the auth wrapper and submit action change.

## Further Notes

- The `/setup` page must be owner-guarded: an unauthenticated visit redirects to `/login`.
- If `localStorage` is unavailable (e.g. private browsing mode), the app falls back gracefully to the standard login page.
- The public `/api/station-users` route must never return `email`, `pin_hash`, or any credential data.
- Resetting a device (clearing browser data) does not affect any server-side data — only the `localStorage` station binding is lost. The owner runs setup again.
- The 10-minute idle timeout applies to all authenticated roles on all devices. If this proves disruptive for owners on laptops, a follow-up can scope it to tablet sessions only by checking for the station binding in `localStorage`.
