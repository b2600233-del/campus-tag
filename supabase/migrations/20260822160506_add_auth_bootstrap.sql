-- =========================================================
-- Campus Tag
-- Auth bootstrap
-- =========================================================

create or replace function public.bootstrap_current_user()
returns public.app_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_app_user public.app_users%rowtype;
begin

  -- Authentication is required.
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;


  -- Existing Campus Tag accounts are returned first.
  --
  -- This allows pre-created demo accounts to work even when
  -- their email address is not an AIU student address.
  select *
  into v_app_user
  from public.app_users
  where id = v_uid;

  if found then
    return v_app_user;
  end if;


  -- Read the Supabase Auth identity.
  select
    u.email,
    u.email_confirmed_at
  into
    v_email,
    v_email_confirmed_at
  from auth.users u
  where u.id = v_uid;


  if v_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;


  if v_email_confirmed_at is null then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;


  -- General student self-registration requires
  -- a verified AIU student email address.
  if
    split_part(lower(v_email), '@', 2) <> 'gl.aiu.ac.jp'
    or length(split_part(v_email, '@', 1)) = 0
  then
    raise exception 'AIU_EMAIL_REQUIRED';
  end if;


  -- Create the Campus Tag application account.
  --
  -- student_number remains NULL.
  -- Supabase Auth user ID is the internal unique identity.
  insert into public.app_users (
    id,
    student_number,
    role,
    account_status,
    account_type
  )
  values (
    v_uid,
    null,
    'viewer',
    'active',
    'student'
  )
  on conflict (id) do nothing;


  select *
  into v_app_user
  from public.app_users
  where id = v_uid;


  return v_app_user;

end;
$$;


revoke execute
  on function public.bootstrap_current_user()
  from public;

revoke execute
  on function public.bootstrap_current_user()
  from anon;

grant execute
  on function public.bootstrap_current_user()
  to authenticated;