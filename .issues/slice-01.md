## Parent PRD

#2

## What to build

Scaffold the full Next.js 15 (App Router) project with Supabase, Tailwind CSS, and shadcn/ui. Implement end-to-end authentication: login page, session management, role-based route guards, and the `user_profiles` table with roles (attendant, supervisor, owner). A logged-in user must be redirected to the correct home screen for their role. An unauthenticated user must be redirected to login.

This is a HITL slice — the folder structure and module boundaries should be reviewed before building everything on top.

## Acceptance criteria

- [ ] Next.js 15 App Router project initialised with TypeScript, Tailwind CSS, and shadcn/ui
- [ ] Supabase project linked; migrations folder established
- [ ] `user_profiles` table: id, user_id (FK auth.users), role (attendant|supervisor|owner), station_id (nullable FK), is_active, created_at
- [ ] RLS enabled on `user_profiles`: owner reads all; others read own row only
- [ ] Login page (email + password) via Supabase Auth
- [ ] Magic link / OTP login supported
- [ ] On login, redirect by role: attendant → /shift, supervisor → /review, owner → /dashboard
- [ ] Unauthenticated access to any protected route redirects to /login
- [ ] Middleware enforces route protection server-side (not just client-side)
- [ ] PWA manifest and service worker stub registered (ready for Slice 15)
- [ ] Folder structure matches 15-module architecture from PRD and is reviewed (HITL checkpoint)

## Blocked by

None — can start immediately.

## User stories addressed

- User story 1
