-- Add username column for station staff (supervisors and cashiers).
-- Owners have no username (null). Uniqueness is enforced globally.

alter table user_profiles
  add column username text unique;
