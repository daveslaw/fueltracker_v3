## Parent PRD

#2

## What to build

Build the User Management module end-to-end: owner can invite users by email (Supabase Auth invite flow), assign a role and station, update assignments, and deactivate accounts. Deactivation revokes login access while preserving all historical data and audit trail.

## Acceptance criteria

- [ ] Owner can invite a user by email; user receives a Supabase invite email with a set-password link
- [ ] Owner assigns role (attendant or supervisor) and station during invite
- [ ] Invited user appears in the users list with status "pending" until they accept
- [ ] Owner can change a user's role or station assignment
- [ ] Owner can deactivate a user; deactivated users cannot log in
- [ ] Owner can reactivate a deactivated user
- [ ] Owner sees a list of all users across all stations: name, email, role, station, last login, status
- [ ] Deactivated users' historical submissions remain intact and visible in audit trails
- [ ] RLS: only owner role can access user management screens and API routes

## Blocked by

- Blocked by #4 (Slice 1: scaffold + auth)

## User stories addressed

- User story 50
- User story 51
- User story 52
- User story 53
