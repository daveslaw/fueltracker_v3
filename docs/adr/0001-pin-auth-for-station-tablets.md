# ADR 0001 — PIN authentication for station tablets

## Status
Accepted

## Context
Each station has one shared tablet used by both supervisors and cashiers. The standard Supabase email/password login creates two problems for uneducated users on a touchscreen:
1. Typing email addresses is cumbersome on a tablet keyboard.
2. Users forget to log out, leaving the device in the wrong role for the next person.

Individual accountability must be preserved — the owner needs to know which specific supervisor and cashier handled each shift.

## Decision
Station tablets use a PIN-based authentication layer on top of Supabase Auth:

- A **User Picker** screen replaces `/login` on station tablets. It lists all active staff at that station who have a PIN set, fetched from a public API route (`/api/station-users?stationId=X`).
- Each user has a 4-digit PIN stored as a bcrypt hash in `user_profiles.pin_hash`. The PIN is set by the owner in `/dashboard/users`.
- On PIN entry, a server action verifies the hash and calls `supabase.auth.admin.createSession(userId)` to issue a real Supabase session. The PIN is never used as the Supabase password.
- Email/password login remains fully intact for owners and for non-tablet access.
- After each workflow boundary, a full-screen **Handoff** prompt signs out the current user and returns to the picker, making role transitions unavoidable.
- A 10-minute idle timeout is a secondary safety net.

## Alternatives considered

**PIN as Supabase password:** Store PIN as the actual Supabase password. Rejected because it exposes a weak 4-digit password over the normal auth flow and conflates the tablet credential with the account credential, making future credential management harder.

**Shared station account per role:** One cashier account per station. Rejected because individual cashier accountability was an explicit requirement — the owner needs to know which cashier handled each shift.

**Device-registered kiosk account:** A long-lived kiosk session on the device that proxies requests for authenticated users. Rejected as significantly more complex than `admin.createSession`, with no clear advantage for this use case.

## Consequences
- `user_profiles` gains: `full_name text not null`, `pin_hash text`, `pin_attempts smallint default 0`, `pin_locked boolean default false`.
- `shifts` gains: `cashier_id uuid references user_profiles(id)` — set on cashier submit, displayed in history and reports.
- A public (unauthenticated) API route `/api/station-users` returns `[{ id, full_name, role }]` for a station. No email or sensitive data is exposed.
- The `/setup` page (owner-authenticated) writes `station_id` to `localStorage` and signs the owner out.
- Users without a PIN are excluded from the User Picker. The standard `/login` page remains accessible at its URL as a permanent escape hatch.
- PIN lockout: after 10 failed attempts, `pin_locked = true`. Only the owner can reset it.
