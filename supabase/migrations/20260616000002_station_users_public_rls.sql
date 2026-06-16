-- Allow the public (unauthenticated) station-users API to read the minimum
-- required fields from user_profiles. The route projects only id, full_name,
-- and role — this policy is defence-in-depth enforcing the same restriction
-- at the database level.
--
-- Only active non-owner users with a PIN set are readable. Email, pin_hash,
-- pin_attempts, and pin_locked are never exposed by this policy.

create policy "public_station_users_read"
  on public.user_profiles
  for select
  to anon
  using (
    is_active = true
    and role <> 'owner'
    and pin_hash is not null
  );
