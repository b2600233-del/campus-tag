-- =========================================================
-- Campus Tag
-- Admin user management functions
-- =========================================================


-- =========================================================
-- 1. Admin user directory
-- =========================================================

create or replace function public.get_admin_user_directory(
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  student_number text,
  role text,
  account_status text,
  account_type text,
  display_name text,
  profile_is_public boolean,
  profile_is_forced_private boolean,
  current_suspension_reason text,
  suspended_at timestamptz,
  suspended_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select private.has_min_role('admin')) then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using
      errcode = '22023',
      message = 'Limit must be between 1 and 200.';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception using
      errcode = '22023',
      message = 'Offset must be zero or greater.';
  end if;

  return query
  select
    au.id as user_id,
    u.email::text as email,
    au.student_number,
    au.role,
    au.account_status,
    au.account_type,
    p.display_name,
    p.is_public as profile_is_public,
    p.is_forced_private as profile_is_forced_private,
    au.current_suspension_reason,
    au.suspended_at,
    au.suspended_by_user_id,
    au.created_at,
    au.updated_at,
    count(*) over () as total_count
  from public.app_users as au
  join auth.users as u
    on u.id = au.id
  left join public.profiles as p
    on p.user_id = au.id
  where
    nullif(btrim(p_search), '') is null
    or position(
      lower(btrim(p_search))
      in lower(
        concat_ws(
          ' ',
          u.email,
          au.student_number,
          p.display_name
        )
      )
    ) > 0
  order by
    au.created_at desc,
    au.id
  limit p_limit
  offset p_offset;
end;
$$;


-- =========================================================
-- 2. Change a user's role
--
-- An Admin cannot demote themselves.
-- The final active Admin cannot be demoted.
-- =========================================================

create or replace function public.admin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_target_status text;
  v_new_role text;
begin
  if (select auth.uid()) is null
     or not (select private.has_min_role('admin')) then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  if p_target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required.';
  end if;

  v_new_role := lower(btrim(coalesce(p_new_role, '')));

  if v_new_role not in ('viewer', 'editor', 'admin') then
    raise exception using
      errcode = '22023',
      message = 'Role must be viewer, editor, or admin.';
  end if;

  select
    au.role,
    au.account_status
  into
    v_target_role,
    v_target_status
  from public.app_users as au
  where au.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Target user was not found.';
  end if;

  if p_target_user_id = (select auth.uid())
     and v_new_role <> 'admin' then
    raise exception using
      errcode = '55000',
      message = 'You cannot demote your own Admin account.';
  end if;

  if v_target_role = 'admin'
     and v_new_role <> 'admin'
     and v_target_status = 'active'
     and not exists (
       select 1
       from public.app_users as other_admin
       where other_admin.id <> p_target_user_id
         and other_admin.role = 'admin'
         and other_admin.account_status = 'active'
     ) then
    raise exception using
      errcode = '55000',
      message = 'The final active Admin cannot be demoted.';
  end if;

  update public.app_users
  set
    role = v_new_role,
    updated_at = now()
  where id = p_target_user_id;
end;
$$;


-- =========================================================
-- 3. Suspend a user
--
-- An Admin cannot suspend themselves.
-- The final active Admin cannot be suspended.
-- =========================================================

create or replace function public.admin_suspend_user(
  p_target_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role text;
  v_target_status text;
  v_reason text;
begin
  if (select auth.uid()) is null
     or not (select private.has_min_role('admin')) then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  if p_target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception using
      errcode = '22023',
      message = 'Suspension reason is required.';
  end if;

  if char_length(v_reason) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Suspension reason must be 1000 characters or fewer.';
  end if;

  select
    au.role,
    au.account_status
  into
    v_target_role,
    v_target_status
  from public.app_users as au
  where au.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Target user was not found.';
  end if;

  if p_target_user_id = (select auth.uid()) then
    raise exception using
      errcode = '55000',
      message = 'You cannot suspend your own account.';
  end if;

  if v_target_status = 'suspended' then
    raise exception using
      errcode = '55000',
      message = 'The target account is already suspended.';
  end if;

  if v_target_role = 'admin'
     and not exists (
       select 1
       from public.app_users as other_admin
       where other_admin.id <> p_target_user_id
         and other_admin.role = 'admin'
         and other_admin.account_status = 'active'
     ) then
    raise exception using
      errcode = '55000',
      message = 'The final active Admin cannot be suspended.';
  end if;

  update public.app_users
  set
    account_status = 'suspended',
    current_suspension_reason = v_reason,
    suspended_at = now(),
    suspended_by_user_id = (select auth.uid()),
    updated_at = now()
  where id = p_target_user_id;
end;
$$;


-- =========================================================
-- 4. Reactivate a suspended user
-- =========================================================

create or replace function public.admin_reactivate_user(
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_status text;
begin
  if (select auth.uid()) is null
     or not (select private.has_min_role('admin')) then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  if p_target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required.';
  end if;

  select au.account_status
  into v_target_status
  from public.app_users as au
  where au.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Target user was not found.';
  end if;

  if v_target_status = 'active' then
    raise exception using
      errcode = '55000',
      message = 'The target account is already active.';
  end if;

  update public.app_users
  set
    account_status = 'active',
    current_suspension_reason = null,
    suspended_at = null,
    suspended_by_user_id = null,
    updated_at = now()
  where id = p_target_user_id;
end;
$$;


-- =========================================================
-- 5. Force a profile private or release the restriction
--
-- Releasing the restriction does not automatically publish
-- the profile. The user must publish it again themselves.
-- =========================================================

create or replace function public.admin_set_profile_forced_private(
  p_target_user_id uuid,
  p_forced_private boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select private.has_min_role('admin')) then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  if p_target_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Target user ID is required.';
  end if;

  if p_forced_private is null then
    raise exception using
      errcode = '22023',
      message = 'Forced-private state is required.';
  end if;

  update public.profiles
  set
    is_public = false,
    is_forced_private = p_forced_private,
    updated_at = now()
  where user_id = p_target_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The target user does not have a profile.';
  end if;
end;
$$;


-- =========================================================
-- 6. Function permissions
-- =========================================================

revoke all privileges
  on function public.get_admin_user_directory(text, integer, integer)
  from public, anon, authenticated;

revoke all privileges
  on function public.admin_set_user_role(uuid, text)
  from public, anon, authenticated;

revoke all privileges
  on function public.admin_suspend_user(uuid, text)
  from public, anon, authenticated;

revoke all privileges
  on function public.admin_reactivate_user(uuid)
  from public, anon, authenticated;

revoke all privileges
  on function public.admin_set_profile_forced_private(uuid, boolean)
  from public, anon, authenticated;


grant execute
  on function public.get_admin_user_directory(text, integer, integer)
  to authenticated;

grant execute
  on function public.admin_set_user_role(uuid, text)
  to authenticated;

grant execute
  on function public.admin_suspend_user(uuid, text)
  to authenticated;

grant execute
  on function public.admin_reactivate_user(uuid)
  to authenticated;

grant execute
  on function public.admin_set_profile_forced_private(uuid, boolean)
  to authenticated;


notify pgrst, 'reload schema';