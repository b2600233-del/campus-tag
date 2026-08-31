-- =========================================================
-- Campus Tag
-- Admin review workflow functions
-- =========================================================


-- ---------------------------------------------------------
-- 1. Get open Admin review requests
-- ---------------------------------------------------------

create or replace function public.get_admin_review_queue(
  p_limit integer default 100
)
returns table (
  review_request_id uuid,
  profile_id uuid,
  target_user_id uuid,
  tag_id uuid,
  tag_exists boolean,
  current_tag_review_status text,
  target_email text,
  target_display_name text,
  target_tag_text text,
  target_tag_source text,
  target_field text,
  problematic_content text,
  reason_category text,
  editor_comment text,
  requested_by uuid,
  review_status text,
  resolution_action text,
  admin_comment text,
  user_message text,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(
    private.has_min_role('admin'),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Admin permission is required.';
  end if;

  return query
  select
    rr.id,
    rr.profile_id,
    rr.target_user_id,
    rr.tag_id,
    (pt.id is not null),
    pt.review_status,
    u.email::text,
    coalesce(
      rr.target_display_name_snapshot,
      p.display_name
    ),
    rr.target_tag_snapshot,
    rr.target_tag_source_snapshot,
    rr.target_field,
    rr.problematic_content_snapshot,
    rr.reason_category,
    rr.editor_comment,
    rr.requested_by,
    rr.status,
    rr.resolution_action,
    rr.admin_comment,
    rr.user_message,
    rr.created_at,
    rr.updated_at,
    rr.closed_at
  from public.review_requests rr
  left join public.profile_tags pt
    on pt.id = rr.tag_id
  left join public.profiles p
    on p.id = rr.profile_id
  left join auth.users u
    on u.id = rr.target_user_id
  where rr.status in (
    'pending_admin_review',
    'waiting_for_user'
  )
  order by rr.created_at asc
  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      200
    )
  );
end;
$$;


-- ---------------------------------------------------------
-- 2. Approve a tag for publication
-- ---------------------------------------------------------

create or replace function public.admin_approve_tag_review(
  p_review_request_id uuid,
  p_admin_comment text default null,
  p_user_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.review_requests%rowtype;
begin
  if not coalesce(
    private.has_min_role('admin'),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Admin permission is required.';
  end if;

  if char_length(
    coalesce(p_admin_comment, '')
  ) > 2000 then
    raise exception
      using
        errcode = '22023',
        message =
          'Admin comment must be 2000 characters or fewer.';
  end if;

  if char_length(
    coalesce(p_user_message, '')
  ) > 2000 then
    raise exception
      using
        errcode = '22023',
        message =
          'User message must be 2000 characters or fewer.';
  end if;

  select *
  into v_request
  from public.review_requests
  where id = p_review_request_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Review request was not found.';
  end if;

  if v_request.status not in (
    'pending_admin_review',
    'waiting_for_user'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'This review request is already closed.';
  end if;

  if v_request.tag_id is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'The target tag no longer exists.';
  end if;

  update public.profile_tags
  set review_status = 'clear'
  where id = v_request.tag_id
    and review_status = 'needs_admin_review';

  if not found then
    raise exception
      using
        errcode = '55000',
        message =
          'The tag is not waiting for Admin review.';
  end if;

  update public.review_requests
  set
    status = 'dismissed',
    resolution_action = 'tag_approved',
    admin_comment = nullif(
      btrim(coalesce(p_admin_comment, '')),
      ''
    ),
    user_message = nullif(
      btrim(coalesce(p_user_message, '')),
      ''
    ),
    closed_at = now()
  where id = p_review_request_id;

  return true;
end;
$$;


-- ---------------------------------------------------------
-- 3. Remove an unsafe tag
-- ---------------------------------------------------------

create or replace function public.admin_remove_tag_review(
  p_review_request_id uuid,
  p_admin_comment text,
  p_user_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.review_requests%rowtype;
  v_tag_removed boolean := false;
  v_admin_comment text;
  v_user_message text;
begin
  if not coalesce(
    private.has_min_role('admin'),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Admin permission is required.';
  end if;

  v_admin_comment := nullif(
    btrim(coalesce(p_admin_comment, '')),
    ''
  );

  v_user_message := nullif(
    btrim(coalesce(p_user_message, '')),
    ''
  );

  if v_admin_comment is null then
    raise exception
      using
        errcode = '22023',
        message = 'Admin comment is required.';
  end if;

  if v_user_message is null then
    raise exception
      using
        errcode = '22023',
        message = 'User message is required.';
  end if;

  if char_length(v_admin_comment) > 2000
    or char_length(v_user_message) > 2000 then
    raise exception
      using
        errcode = '22023',
        message =
          'Comments must be 2000 characters or fewer.';
  end if;

  select *
  into v_request
  from public.review_requests
  where id = p_review_request_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Review request was not found.';
  end if;

  if v_request.status not in (
    'pending_admin_review',
    'waiting_for_user'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'This review request is already closed.';
  end if;

  if v_request.tag_id is not null then
    delete from public.profile_tags
    where id = v_request.tag_id
    returning true into v_tag_removed;
  end if;

  update public.review_requests
  set
    status = 'resolved',
    resolution_action = case
      when v_tag_removed
        then 'tag_removed'
      else 'tag_already_removed'
    end,
    admin_comment = v_admin_comment,
    user_message = v_user_message,
    closed_at = now()
  where id = p_review_request_id;

  return true;
end;
$$;


-- ---------------------------------------------------------
-- 4. Ask the user to take action
-- ---------------------------------------------------------

create or replace function public.admin_request_user_action_review(
  p_review_request_id uuid,
  p_admin_comment text,
  p_user_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.review_requests%rowtype;
  v_admin_comment text;
  v_user_message text;
begin
  if not coalesce(
    private.has_min_role('admin'),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Admin permission is required.';
  end if;

  v_admin_comment := nullif(
    btrim(coalesce(p_admin_comment, '')),
    ''
  );

  v_user_message := nullif(
    btrim(coalesce(p_user_message, '')),
    ''
  );

  if v_admin_comment is null then
    raise exception
      using
        errcode = '22023',
        message = 'Admin comment is required.';
  end if;

  if v_user_message is null then
    raise exception
      using
        errcode = '22023',
        message = 'User message is required.';
  end if;

  if char_length(v_admin_comment) > 2000
    or char_length(v_user_message) > 2000 then
    raise exception
      using
        errcode = '22023',
        message =
          'Comments must be 2000 characters or fewer.';
  end if;

  select *
  into v_request
  from public.review_requests
  where id = p_review_request_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Review request was not found.';
  end if;

  if v_request.status not in (
    'pending_admin_review',
    'waiting_for_user'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'This review request is already closed.';
  end if;

  update public.review_requests
  set
    status = 'waiting_for_user',
    resolution_action = 'user_action_requested',
    admin_comment = v_admin_comment,
    user_message = v_user_message,
    closed_at = null
  where id = p_review_request_id;

  return true;
end;
$$;


-- ---------------------------------------------------------
-- 5. Force the profile private and remove the tag
-- ---------------------------------------------------------

create or replace function public.admin_force_private_review(
  p_review_request_id uuid,
  p_admin_comment text,
  p_user_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.review_requests%rowtype;
  v_admin_comment text;
  v_user_message text;
begin
  if not coalesce(
    private.has_min_role('admin'),
    false
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Admin permission is required.';
  end if;

  v_admin_comment := nullif(
    btrim(coalesce(p_admin_comment, '')),
    ''
  );

  v_user_message := nullif(
    btrim(coalesce(p_user_message, '')),
    ''
  );

  if v_admin_comment is null then
    raise exception
      using
        errcode = '22023',
        message = 'Admin comment is required.';
  end if;

  if v_user_message is null then
    raise exception
      using
        errcode = '22023',
        message = 'User message is required.';
  end if;

  if char_length(v_admin_comment) > 2000
    or char_length(v_user_message) > 2000 then
    raise exception
      using
        errcode = '22023',
        message =
          'Comments must be 2000 characters or fewer.';
  end if;

  select *
  into v_request
  from public.review_requests
  where id = p_review_request_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Review request was not found.';
  end if;

  if v_request.status not in (
    'pending_admin_review',
    'waiting_for_user'
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'This review request is already closed.';
  end if;

  if v_request.profile_id is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'The target profile no longer exists.';
  end if;

  update public.profiles
  set
    is_public = false,
    is_forced_private = true
  where id = v_request.profile_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The target profile no longer exists.';
  end if;

  if v_request.tag_id is not null then
    delete from public.profile_tags
    where id = v_request.tag_id;
  end if;

  update public.review_requests
  set
    status = 'resolved',
    resolution_action =
      'profile_forced_private_and_tag_removed',
    admin_comment = v_admin_comment,
    user_message = v_user_message,
    closed_at = now()
  where id = p_review_request_id;

  return true;
end;
$$;


-- =========================================================
-- Permissions
-- =========================================================

revoke execute
on function public.get_admin_review_queue(integer)
from public, anon, authenticated;

revoke execute
on function public.admin_approve_tag_review(
  uuid,
  text,
  text
)
from public, anon, authenticated;

revoke execute
on function public.admin_remove_tag_review(
  uuid,
  text,
  text
)
from public, anon, authenticated;

revoke execute
on function public.admin_request_user_action_review(
  uuid,
  text,
  text
)
from public, anon, authenticated;

revoke execute
on function public.admin_force_private_review(
  uuid,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.get_admin_review_queue(integer)
to authenticated;

grant execute
on function public.admin_approve_tag_review(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.admin_remove_tag_review(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.admin_request_user_action_review(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.admin_force_private_review(
  uuid,
  text,
  text
)
to authenticated;


notify pgrst, 'reload schema';