-- The Edge Function owns publication. A single row publishes the complete gallery.
create table public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  tagline text not null check (char_length(trim(tagline)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  link text not null default '' check (link = '' or link ~* '^https?://[^[:space:]]+$'),
  cover_path text,
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5),
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  promoted_at timestamptz
);

create index profile_projects_owner_order on public.profile_projects
  (owner_id, promoted_at desc nulls last, created_at, id);
alter table public.profile_projects enable row level security;
revoke all on public.profile_projects from public, anon, authenticated;
grant select on public.profile_projects to authenticated;
grant all on public.profile_projects to service_role;
create policy projects_visible on public.profile_projects for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = owner_id)
         and (owner_id = (select auth.uid()) or not public.has_profile_block(owner_id)));

create function public.check_profile_project() returns trigger language plpgsql
set search_path = '' as $$
declare
  path text;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('projects:' || new.owner_id::text, 0));
    if (select count(*) from public.profile_projects where owner_id = new.owner_id) >= 3 then
      raise exception 'project limit' using errcode = 'PJ003';
    end if;
  end if;
  foreach path in array (new.photo_paths || case when new.cover_path is null
    then '{}'::text[] else array[new.cover_path] end) loop
    if path is null or path !~ ('^' || new.owner_id::text || '/project-[a-zA-Z0-9-]+[.]jpg$') then
      raise exception 'invalid project image';
    end if;
  end loop;
  return new;
end;
$$;
create trigger check_profile_project before insert or update on public.profile_projects
for each row execute function public.check_profile_project();

-- Same private bucket, ownership folder and account cleanup as About me.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $policy$create policy project_read_published on storage.objects
      for select to authenticated using (bucket_id = 'board' and exists (
        select 1 from public.profile_projects p where storage.objects.name = p.cover_path
          or storage.objects.name = any(p.photo_paths)
      ))$policy$;
  end if;
end;
$$;
