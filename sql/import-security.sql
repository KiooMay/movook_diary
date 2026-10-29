begin;
alter table public.user_media enable row level security;
drop policy if exists movook_media_owner_guard on public.user_media;
create policy movook_media_owner_guard on public.user_media as restrictive for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists movook_media_owner_allow on public.user_media;
create policy movook_media_owner_allow on public.user_media as permissive for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.movook_import_security_ready() returns boolean language sql stable security invoker set search_path = pg_catalog, public as $$
  select exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='user_media' and c.relrowsecurity)
  and exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='user_media' and p.polname='movook_media_owner_guard' and not p.polpermissive);
$$;
revoke all on function public.movook_import_security_ready() from public, anon;
grant execute on function public.movook_import_security_ready() to authenticated;
commit;
