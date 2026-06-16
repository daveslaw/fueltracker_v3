-- PIN-based tablet authentication and cashier identity tracking.
--
-- user_profiles gains:
--   full_name      — display name in the User Picker
--   pin_hash       — bcrypt hash of the 4-digit tablet PIN (null until owner sets one)
--   pin_attempts   — consecutive failed PIN entries; reset on success or owner reset
--   pin_locked     — true after 10 failed attempts; only owner can clear
--
-- shifts gains:
--   cashier_id     — profile of the cashier who submitted the cashier side

-- ── user_profiles ─────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists full_name    text,
  add column if not exists pin_hash     text,
  add column if not exists pin_attempts smallint not null default 0,
  add column if not exists pin_locked   boolean  not null default false;

-- Backfill full_name from email prefix for existing rows.
update public.user_profiles
  set full_name = split_part(email, '@', 1)
  where full_name is null and email is not null;

-- Now enforce not null (all rows now have a value).
alter table public.user_profiles
  alter column full_name set not null;

-- ── shifts ────────────────────────────────────────────────────────────────────

alter table public.shifts
  add column if not exists cashier_id uuid references public.user_profiles(id);
