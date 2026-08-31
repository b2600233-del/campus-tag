-- =========================================================
-- Campus Tag
-- Limited Editor tag-review functions
--
-- Editors do not receive direct access to profile_tags or
-- review_requests. All review operations pass through these
-- restricted RPC functions.
-- =========================================================


-- =========================================================
-- 1. Get the Editor review queue
-- =========================================================

create or replace function public.get_editor_tag_review_queue(
  p_limit integer default 50
)
returns table (
  tag_id uuid,
  tag_text text,
  tag_source text,
  safety_reason_category text,
  safety_reason_summary text,
  safety_checked_at timestamptz,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(
    private.has_min_role('editor'),
    false
  ) then
    raise exception 'Editor権限が必要です。'
      using errcode = '42501';
  end if;

  return query
  select
    pt.id,
    pt.tag_text,
    pt.source,
    pt.safety_reason_category,
    pt.safety_reason_summary,
    pt.safety_checked_at,
    pt.created_at
  from public.profile_tags pt
  where pt.review_status = 'needs_editor_review'
  order by
    pt.safety_checked_at asc nulls first,
    pt.created_at asc,
    pt.id asc
  limit greatest(
    1,
    least(
      coalesce(p_limit, 50),
      100
    )
  );
end;
$$;


-- =========================================================
-- 2. Approve a tag
--
-- Used when the Editor determines that the AI flag was a
-- false positive. The safety result remains recorded, while
-- review_status becomes clear.
-- =========================================================

create or replace function public.approve_editor_tag(
  p_tag_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  if not coalesce(
    private.has_min_role('editor'),
    false
  ) then
    raise exception 'Editor権限が必要です。'
      using errcode = '42501';
  end if;

  if p_tag_id is null then
    raise exception 'タグIDが必要です。'
      using errcode = '22023';
  end if;

  update public.profile_tags
  set review_status = 'clear'
  where id = p_tag_id
    and review_status = 'needs_editor_review';

  get diagnostics
    v_updated_count = row_count;

  return v_updated_count = 1;
end;
$$;


-- =========================================================
-- 3. Escalate a tag to Admin
--
-- The review request and tag status update occur in the same
-- transaction. If either operation fails, neither change is
-- retained.
-- =========================================================

create or replace function public.escalate_editor_tag(
  p_tag_id uuid,
  p_editor_comment text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tag record;
  v_normalized_comment text;
begin
  if not coalesce(
    private.has_min_role('editor'),
    false
  ) then
    raise exception 'Editor権限が必要です。'
      using errcode = '42501';
  end if;

  if p_tag_id is null then
    raise exception 'タグIDが必要です。'
      using errcode = '22023';
  end if;

  v_normalized_comment :=
    nullif(
      btrim(
        coalesce(p_editor_comment, '')
      ),
      ''
    );

  if char_length(v_normalized_comment) > 1000 then
    raise exception 'コメントは1000文字以内で入力してください。'
      using errcode = '22001';
  end if;

  select
    pt.id as tag_id,
    pt.profile_id,
    pt.tag_text,
    pt.source as tag_source,
    pt.safety_reason_category,
    p.user_id as target_user_id,
    p.display_name
  into v_tag
  from public.profile_tags pt
  join public.profiles p
    on p.id = pt.profile_id
  where pt.id = p_tag_id
    and pt.review_status = 'needs_editor_review'
  for update of pt;

  if not found then
    return false;
  end if;

  insert into public.review_requests (
    profile_id,
    target_user_id,
    tag_id,
    target_display_name_snapshot,
    target_tag_snapshot,
    target_tag_source_snapshot,
    target_field,
    problematic_content_snapshot,
    requested_by,
    reason_category,
    editor_comment,
    status
  )
  values (
    v_tag.profile_id,
    v_tag.target_user_id,
    v_tag.tag_id,
    v_tag.display_name,
    v_tag.tag_text,
    v_tag.tag_source,
    'profile_tag',
    v_tag.tag_text,
    auth.uid(),
    coalesce(
      v_tag.safety_reason_category,
      'other'
    ),
    v_normalized_comment,
    'pending_admin_review'
  );

  update public.profile_tags
  set review_status = 'needs_admin_review'
  where id = v_tag.tag_id;

  return true;
end;
$$;


-- =========================================================
-- 4. RPC privileges
-- =========================================================

revoke execute
  on function public.get_editor_tag_review_queue(integer)
  from public;

revoke execute
  on function public.get_editor_tag_review_queue(integer)
  from anon;

grant execute
  on function public.get_editor_tag_review_queue(integer)
  to authenticated;


revoke execute
  on function public.approve_editor_tag(uuid)
  from public;

revoke execute
  on function public.approve_editor_tag(uuid)
  from anon;

grant execute
  on function public.approve_editor_tag(uuid)
  to authenticated;


revoke execute
  on function public.escalate_editor_tag(uuid, text)
  from public;

revoke execute
  on function public.escalate_editor_tag(uuid, text)
  from anon;

grant execute
  on function public.escalate_editor_tag(uuid, text)
  to authenticated;