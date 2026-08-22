-- =========================================================
-- Campus Tag
-- Row Level Security and role helpers
-- =========================================================


-- =========================================================
-- 1. Internal authorization helpers
-- =========================================================

create or replace function private.has_min_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users au
    where au.id = auth.uid()
      and au.account_status = 'active'
      and
        case au.role
          when 'viewer' then 1
          when 'editor' then 2
          when 'admin' then 3
          else 0
        end
        >=
        case required_role
          when 'viewer' then 1
          when 'editor' then 2
          when 'admin' then 3
          else 999
        end
  );
$$;


create or replace function private.owns_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_profile_id
      and p.user_id = auth.uid()
  );
$$;


-- The private schema is not exposed through the Data API.
-- Authenticated users only need these helpers for RLS evaluation.

grant usage on schema private to authenticated;

revoke execute on function private.has_min_role(text) from public;
revoke execute on function private.owns_profile(uuid) from public;

grant execute on function private.has_min_role(text) to authenticated;
grant execute on function private.owns_profile(uuid) to authenticated;


-- =========================================================
-- 2. Enable RLS explicitly on every application table
-- =========================================================

alter table public.app_users enable row level security;
alter table public.profiles enable row level security;
alter table public.languages enable row level security;
alter table public.profile_languages enable row level security;
alter table public.profile_tags enable row level security;
alter table public.review_requests enable row level security;
alter table public.ai_usage_state enable row level security;
alter table public.ai_tag_regeneration_batches enable row level security;


-- =========================================================
-- 3. Explicit Data API grants
--
-- Start from deny-by-default for anon/authenticated.
-- Add only the minimum privileges needed at this stage.
-- =========================================================

revoke all privileges on table public.app_users
  from anon, authenticated;

revoke all privileges on table public.profiles
  from anon, authenticated;

revoke all privileges on table public.languages
  from anon, authenticated;

revoke all privileges on table public.profile_languages
  from anon, authenticated;

revoke all privileges on table public.profile_tags
  from anon, authenticated;

revoke all privileges on table public.review_requests
  from anon, authenticated;

revoke all privileges on table public.ai_usage_state
  from anon, authenticated;

revoke all privileges on table public.ai_tag_regeneration_batches
  from anon, authenticated;


grant select
  on table public.app_users
  to authenticated;

grant select, insert, update, delete
  on table public.profiles
  to authenticated;

grant select
  on table public.languages
  to authenticated;

grant select, insert, update, delete
  on table public.profile_languages
  to authenticated;

grant select, delete
  on table public.profile_tags
  to authenticated;

grant select
  on table public.review_requests
  to authenticated;


-- =========================================================
-- 4. app_users
--
-- Self: own application account row.
-- Admin: all app_users rows for account management.
--
-- Writes remain server-controlled.
-- =========================================================

create policy app_users_select_self_or_admin
on public.app_users
for select
to authenticated
using (
  (select auth.uid()) = id
  or
  (select private.has_min_role('admin'))
);


-- =========================================================
-- 5. profiles
--
-- Raw profile data is visible only to its owner.
-- Admin does NOT receive broad private-profile access.
-- =========================================================

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
);


create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and
  (select private.has_min_role('viewer'))
);


create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  user_id = (select auth.uid())
  and
  (select private.has_min_role('viewer'))
)
with check (
  user_id = (select auth.uid())
  and
  (select private.has_min_role('viewer'))
);


create policy profiles_delete_own
on public.profiles
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and
  (select private.has_min_role('viewer'))
);


-- =========================================================
-- 6. languages
--
-- Normal authenticated users:
--   active languages only.
--
-- Active Admin:
--   active + inactive master records.
--
-- Writes remain server-controlled.
-- =========================================================

create policy languages_select_active_or_admin
on public.languages
for select
to authenticated
using (
  is_active = true
  or
  (select private.has_min_role('admin'))
);


-- =========================================================
-- 7. profile_languages
--
-- Raw rows belong only to the profile owner.
-- Suspended users may still read their data but cannot
-- perform normal writes.
-- =========================================================

create policy profile_languages_select_own
on public.profile_languages
for select
to authenticated
using (
  (select private.owns_profile(profile_id))
);


create policy profile_languages_insert_own
on public.profile_languages
for insert
to authenticated
with check (
  (select private.owns_profile(profile_id))
  and
  (select private.has_min_role('viewer'))
);


create policy profile_languages_update_own
on public.profile_languages
for update
to authenticated
using (
  (select private.owns_profile(profile_id))
  and
  (select private.has_min_role('viewer'))
)
with check (
  (select private.owns_profile(profile_id))
  and
  (select private.has_min_role('viewer'))
);


create policy profile_languages_delete_own
on public.profile_languages
for delete
to authenticated
using (
  (select private.owns_profile(profile_id))
  and
  (select private.has_min_role('viewer'))
);


-- =========================================================
-- 8. profile_tags
--
-- Owners may read all of their own tags.
-- Owners may delete their own tags while active.
--
-- INSERT / UPDATE are intentionally NOT granted directly:
-- tag creation/editing must pass server-controlled
-- Safety Screening and workflow logic.
-- =========================================================

create policy profile_tags_select_own
on public.profile_tags
for select
to authenticated
using (
  (select private.owns_profile(profile_id))
);


create policy profile_tags_delete_own
on public.profile_tags
for delete
to authenticated
using (
  (select private.owns_profile(profile_id))
  and
  (select private.has_min_role('viewer'))
);


-- =========================================================
-- 9. review_requests
--
-- Admin can read every formal moderation case.
--
-- Editor does NOT receive raw table access.
-- Editor access will later be implemented through a limited
-- server function that returns only cases submitted by that
-- Editor.
--
-- Writes remain workflow-controlled.
-- =========================================================

create policy review_requests_select_admin
on public.review_requests
for select
to authenticated
using (
  (select private.has_min_role('admin'))
);


-- =========================================================
-- 10. Server-controlled tables
--
-- ai_usage_state
-- ai_tag_regeneration_batches
--
-- RLS is enabled, but no authenticated policies or grants
-- are provided.
--
-- They are intentionally inaccessible directly from the
-- browser/user JWT and will be handled through controlled
-- server/database operations later.
-- =========================================================