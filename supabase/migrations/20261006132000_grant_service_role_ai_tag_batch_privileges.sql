-- Allow the server-only admin client to manage temporary AI tag batches.
grant select, insert, update
on table public.ai_tag_regeneration_batches
to service_role;
