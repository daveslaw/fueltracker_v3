# ADR 0002 — Username + PIN authentication for supervisors and cashiers

## Status
Accepted

## Context
Supervisors and cashiers were previously created via Supabase `inviteUserByEmail` — an invite email was sent, the user clicked a link and set a password. This flow assumes users have an email address and check it. Station staff in practice do not: they work on a shared tablet, they are not email users, and the invite flow added owner overhead with no benefit to the staff member.

The PIN mechanism (ADR 0001) was already in place for tablet login. The only thing the email/password layer provided was account creation and Supabase Auth record management.

## Decision
Email invites are removed entirely for supervisors and cashiers. Accounts are created by the owner in a single form: full name, role, station, PIN, confirm PIN. A username is auto-generated (`firstname.lastname`, lowercased, numeric suffix on collision) and shown to the owner as an editable field before saving. The username is read-only after creation.

Supabase Auth still backs each account. A synthetic email (`username@fueltracker.internal`) is generated server-side and used as the Auth record's email address — it is never shown to the user or sent anywhere. The PIN session-minting flow (generateLink + verifyOtp) is unchanged.

Usernames are globally unique across all stations (single unique index on `user_profiles.username`).

Existing cashier/supervisor accounts created under the old email flow are not migrated. Owners recreate them using the new flow and deactivate the old records.

Owner accounts are unchanged: email/password, invite-by-email, no PIN.

## Alternatives considered

**Migrate existing accounts automatically:** Backfill `username` from `full_name`, keep existing Auth records. Rejected because the force-recreation approach is simpler and gives owners a clean slate — the station staff list is small enough that recreation is low overhead.

**Skip Supabase Auth entirely for station staff:** No Auth record, fully custom session management. Rejected because it requires rewriting RLS policies, minting custom JWTs, and managing token refresh — weeks of work with no user-facing benefit.

**Per-station username uniqueness:** Username unique only within a station. Rejected because it complicates PIN login resolution (station must be known before username can be resolved) and a global unique index is simpler with no practical downside.

## Consequences
- `user_profiles` gains: `username text unique not null` (supervisors and cashiers only; null for owners).
- `inviteUserByEmail` and `/set-password` flows are removed for supervisor and cashier creation.
- The `/dashboard/users` creation form no longer has an email field for station staff.
- The user table is grouped by station rather than a flat list.
- A user is always created with a PIN — the "Set PIN" action on an existing user no longer exists; only "Reset PIN" remains.
- The `/set-password` page and owner invite flow remain intact.
