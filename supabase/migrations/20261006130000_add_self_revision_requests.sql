-- =========================================================
-- Campus Tag
-- Student-facing revision requests
-- =========================================================

create or replace function public.get_my_revision_requests()
returns table (
  request_id uuid,
  status text,
  user_message text,
  target_field text,
  target_tag_snapshot text,
  problematic_content_snapshot text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rr.id as request_id,
    rr.status,
    rr.user_message,
    rr.target_field,
    rr.target_tag_snapshot,
    rr.problematic_content_snapshot,
    rr.created_at,
    rr.updated_at
  from public.review_requests rr
  where rr.target_user_id = auth.uid()
    and rr.user_message is not null
  order by rr.updated_at desc, rr.id;
$$;

revoke execute
  on function public.get_my_revision_requests()
  from public;

revoke execute
  on function public.get_my_revision_requests()
  from anon;

grant execute
  on function public.get_my_revision_requests()
  to authenticated;
