-- =========================================================
-- Campus Tag
-- Authenticated profile-tag creation
--
-- Regular user tag creation no longer requires service_role.
-- The function limits insertion to the caller's own profile and
-- keeps direct INSERT access to profile_tags disabled.
-- =========================================================

create or replace function public.create_my_profile_tag(
  p_tag_text text,
  p_safety_screening_status text,
  p_safety_reason_category text default null,
  p_safety_reason_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_tag_id uuid;
  v_tag_text text := btrim(p_tag_text);
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.app_users au
    where au.id = v_user_id
      and au.account_status = 'active'
  ) then
    raise exception 'ACTIVE_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.user_id = v_user_id;

  if v_profile_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0002';
  end if;

  if v_tag_text = '' or char_length(v_tag_text) > 60 then
    raise exception 'INVALID_TAG_LENGTH' using errcode = '22023';
  end if;

  if p_safety_screening_status not in ('passed', 'flagged') then
    raise exception 'INVALID_SAFETY_STATUS' using errcode = '22023';
  end if;

  insert into public.profile_tags (
    profile_id,
    tag_text,
    source,
    review_status,
    safety_screening_status,
    safety_reason_category,
    safety_reason_summary,
    safety_checked_at
  )
  values (
    v_profile_id,
    v_tag_text,
    'user_added',
    case
      when p_safety_screening_status = 'passed' then 'clear'
      else 'needs_editor_review'
    end,
    p_safety_screening_status,
    p_safety_reason_category,
    p_safety_reason_summary,
    now()
  )
  returning id into v_tag_id;

  return v_tag_id;
end;
$$;

revoke execute
  on function public.create_my_profile_tag(text, text, text, text)
  from public;

revoke execute
  on function public.create_my_profile_tag(text, text, text, text)
  from anon;

grant execute
  on function public.create_my_profile_tag(text, text, text, text)
  to authenticated;
