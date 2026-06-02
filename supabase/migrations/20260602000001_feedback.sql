create table public.feedback (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  user_id           uuid        not null references auth.users(id),
  station_id        uuid        references public.stations(id),
  role              text        not null,
  category          text        not null,
  note              text,
  route             text        not null,
  shift_id          uuid        references public.shifts(id),
  device_info       jsonb       not null,
  recent_errors     jsonb       not null,
  route_breadcrumbs jsonb       not null,
  screenshot_path   text
);

alter table public.feedback enable row level security;

-- Any authenticated user can insert their own feedback row
create policy "feedback_insert"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Only owners can read feedback
create policy "feedback_select_owner"
  on public.feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where user_id = auth.uid()
        and role = 'owner'
    )
  );
