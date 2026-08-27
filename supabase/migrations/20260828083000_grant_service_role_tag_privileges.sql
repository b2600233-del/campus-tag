-- Allow the server-only admin client to insert screened profile tags.
grant select, insert
on table public.profile_tags
to service_role;

-- Required by profile tag validation and synchronization triggers.
grant select, update
on table public.profiles
to service_role;