-- Return only the current user's fields required by the Next.js proxy.
-- The function avoids coupling the proxy's optimistic route check to table RLS.
create or replace function public.get_my_route_access()
returns table (
  role text,
  account_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    au.role::text,
    au.account_status::text
  from public.app_users au
  where au.id = auth.uid();
$$;

revoke execute
  on function public.get_my_route_access()
  from public;

revoke execute
  on function public.get_my_route_access()
  from anon;

grant execute
  on function public.get_my_route_access()
  to authenticated;
