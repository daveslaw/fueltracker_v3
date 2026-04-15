-- Add email column to user_profiles so the Admin API (listUsers) is never
-- needed at runtime. Email is written at invite time and backfilled here
-- for any existing rows.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE user_profiles
SET email = (
  SELECT email FROM auth.users WHERE auth.users.id = user_profiles.user_id
)
WHERE email IS NULL;
