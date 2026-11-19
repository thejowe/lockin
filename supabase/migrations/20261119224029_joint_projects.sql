-- Profile cards contain moderated content only. Match ids, requests and notes
-- live in author-only rows even when a card is on both public profiles.
create schema project_private;
revoke all on schema project_private from public, anon, authenticated;
grant usage on schema project_private to authenticated;

alter table public.profile_projects
  add column published boolean not null default true,
  add column joint boolean not null default false,
  add constraint personal_projects_are_public check (joint or published);

create table public.project_authors (
  project_id uuid not null references public.profile_projects on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (project_id, user_id)
);
create index project_authors_by_user on public.project_authors(user_id,project_id);
insert into public.project_authors(project_id,user_id) select id,owner_id from public.profile_projects;

create table public.project_workspaces (
  project_id uuid primary key references public.profile_projects on delete cascade,
  match_id uuid unique references public.matches on delete set null,
  proposed_by uuid references public.profiles on delete set null,
  notes text not null default '' check (char_length(notes) <= 10000),
  notes_by uuid references public.profiles on delete set null,
  notes_revision uuid not null default gen_random_uuid()
);

-- A deletion notice survives deletion of the project but never of its chat.
create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches on delete cascade,
  project_id uuid not null,
  actor_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('created','proposed','deleted')),
  created_at timestamptz not null default now()
);
create index project_event_stream on public.project_events(match_id,kind,created_at desc);

alter table public.project_authors enable row level security;
alter table public.project_workspaces enable row level security;
alter table public.project_events enable row level security;
revoke all on public.project_authors, public.project_workspaces, public.project_events from public, anon, authenticated;
grant select on public.project_authors, public.project_workspaces, public.project_events to authenticated;
grant all on public.project_authors, public.project_workspaces, public.project_events to service_role;

-- The policy predicate reads membership without recursively invoking its own RLS.
create function project_private.can_read(p_project uuid, p_published boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.project_authors where project_id=p_project and user_id=auth.uid())
    or (p_published and not exists (
      select 1 from public.project_authors a where a.project_id=p_project
      and not public.project_owner_visible(a.user_id)
    ))
  );
$$;
revoke all on function project_private.can_read(uuid,boolean) from public, anon;
grant execute on function project_private.can_read(uuid,boolean) to authenticated;

drop policy projects_visible on public.profile_projects;
create policy projects_visible on public.profile_projects for select to authenticated
using (project_private.can_read(id,published));
create function project_private.card_visible(p_project uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.profile_projects where id=p_project);
$$;
revoke all on function project_private.card_visible(uuid) from public, anon;
grant execute on function project_private.card_visible(uuid) to authenticated;
create policy authors_visible on public.project_authors for select to authenticated
using (project_private.card_visible(project_id));
create policy workspace_authors on public.project_workspaces for select to authenticated
using (project_private.can_read(project_id,false));
create policy project_event_members on public.project_events for select to authenticated
using (public.is_unblocked_match(match_id));

-- Personal creations and joint publication use the same per-profile lock.
-- The owner_id fallback counts personal rows of a multi-row legacy insert
-- before the AFTER INSERT trigger has populated their membership rows.
create function project_private.has_room(p_user uuid, p_except uuid)
returns boolean language sql stable set search_path = '' as $$
  select count(*) < 3 from public.profile_projects p
  where p.published and p.id is distinct from p_except and
    ((not p.joint and p.owner_id = p_user) or exists (
      select 1 from public.project_authors a where a.project_id=p.id and a.user_id=p_user
    ));
$$;
revoke all on function project_private.has_room(uuid,uuid) from public, anon, authenticated;

create or replace function public.check_profile_project() returns trigger language plpgsql
set search_path = '' as $$
declare
  path text;
  prefix text := case when new.joint then 'shared/' || new.id::text else new.owner_id::text end;
begin
  if tg_op = 'INSERT' and not new.joint then
    perform pg_advisory_xact_lock(hashtextextended('projects:' || new.owner_id::text, 0));
    if not project_private.has_room(new.owner_id,null) then
      raise exception 'project limit' using errcode='PJ003';
    end if;
  end if;
  foreach path in array (new.photo_paths || case when new.cover_path is null then '{}'::text[] else array[new.cover_path] end) loop
    if path is null or path !~ ('^' || prefix || '/project-[a-zA-Z0-9-]+[.]jpg$') then
      raise exception 'invalid project image';
    end if;
  end loop;
  return new;
end;
$$;

create function project_private.add_first_author() returns trigger language plpgsql
set search_path = '' as $$
begin
  insert into public.project_authors values (new.id,new.owner_id);
  return null;
end;
$$;
create trigger project_first_author after insert on public.profile_projects
for each row execute function project_private.add_first_author();

create function public.project_workspace(p_match_id uuid)
returns table (project_id uuid,project_revision uuid,published boolean,proposed_by uuid,has_capacity boolean,
               notes text,notes_by uuid,notes_revision uuid)
language sql stable security definer set search_path = '' as $$
  select w.project_id,p.revision,p.published,w.proposed_by,
    not exists(select 1 from public.project_authors a where a.project_id=p.id
               and not project_private.has_room(a.user_id,p.id)),
    w.notes,w.notes_by,w.notes_revision
  from public.project_workspaces w join public.profile_projects p on p.id=w.project_id
  where w.match_id=p_match_id and public.is_unblocked_match(p_match_id)
    and project_private.can_read(p.id,false);
$$;

create function public.set_project_publication(p_project_id uuid,p_revision uuid,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  card public.profile_projects;
  work public.project_workspaces;
  author uuid;
  actor uuid := auth.uid();
begin
  select * into card from public.profile_projects where id=p_project_id for update;
  select * into work from public.project_workspaces where project_id=p_project_id;
  if work.match_id is null or not public.is_unblocked_match(work.match_id)
    or not project_private.can_read(card.id,false) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  if card.revision is distinct from p_revision then
    raise exception 'project changed' using errcode='PJ409';
  end if;
  case p_action
    when 'propose' then
      if card.published or work.proposed_by is not null then
        raise exception 'proposal changed' using errcode='PJ409';
      end if;
      update public.project_workspaces set proposed_by=actor where project_id=card.id;
      insert into public.project_events(match_id,project_id,actor_id,kind)
        values(work.match_id,card.id,actor,'proposed');
    when 'accept', 'reject' then
      if work.proposed_by is null or actor=work.proposed_by or card.published then
        raise exception 'peer consent required' using errcode='42501';
      end if;
      if p_action='accept' then
        for author in select user_id from public.project_authors where project_id=card.id order by user_id loop
          perform pg_advisory_xact_lock(hashtextextended('projects:' || author::text,0));
          if not project_private.has_room(author,card.id) then
            raise exception 'project limit' using errcode='PJ003';
          end if;
        end loop;
        update public.profile_projects set published=true where id=card.id;
      end if;
      update public.project_workspaces set proposed_by=null where project_id=card.id;
    when 'private' then
      update public.profile_projects set published=false where id=card.id;
      update public.project_workspaces set proposed_by=null where project_id=card.id;
    else raise exception 'invalid action' using errcode='22023';
  end case;
  update public.profile_projects set revision=gen_random_uuid() where id=card.id;
end;
$$;

create function public.save_project_notes(p_project_id uuid,p_text text,p_revision uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profile_projects where id=p_project_id for update;
  if not project_private.can_read(p_project_id,false) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  update public.project_workspaces set notes=p_text,notes_by=auth.uid(),notes_revision=gen_random_uuid()
  where project_id=p_project_id and notes_revision=p_revision;
  if not found then raise exception 'notes changed' using errcode='PJ409'; end if;
end;
$$;

revoke all on function public.project_workspace(uuid),public.set_project_publication(uuid,uuid,text),
  public.save_project_notes(uuid,text,uuid) from public, anon;
grant execute on function public.project_workspace(uuid),public.set_project_publication(uuid,uuid,text),
  public.save_project_notes(uuid,text,uuid) to authenticated;

-- In a private bucket a signed URL can outlive the visibility of the card.
-- Require an authenticated download for shared media so RLS runs at every read.
-- Older Storage installations without operation-aware RLS fail closed.
create function project_private.authenticated_download() returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if to_regprocedure('storage.allow_only_operation(text)') is null then return false; end if;
  return storage.allow_only_operation('object.get_authenticated');
end;
$$;
revoke all on function project_private.authenticated_download() from public, anon;
grant execute on function project_private.authenticated_download() to authenticated;

do $storage$
begin
  if to_regclass('storage.objects') is not null then
    execute $p$create policy shared_project_downloads on storage.objects as restrictive
      for select to authenticated using (bucket_id <> 'board' or name not like 'shared/%'
        or (select project_private.authenticated_download()))$p$;
  end if;
end;
$storage$;

-- Called only by moderate-project, after authentication and moderation. The
-- actor/membership and optimistic revision are checked again at commit time.
create function public.commit_moderated_project(
  p_actor uuid,p_id uuid,p_revision uuid,p_match_id uuid,p_action text,p_values jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  card public.profile_projects;
  pair public.matches;
  match_id_for_event uuid;
  photo_paths_value text[];
begin
  if p_actor is null or p_id is null then raise exception 'invalid actor/project' using errcode='22023'; end if;
  if p_action='save' then
    photo_paths_value := array(select jsonb_array_elements_text(p_values->'photo_paths'));
  end if;
  if p_revision is null then
    if p_action is distinct from 'save' then raise exception 'expected save' using errcode='22023'; end if;
    if p_match_id is not null then
      select * into pair from public.matches where id=p_match_id for update;
      if not found or p_actor not in (pair.profile_a,pair.profile_b)
          or public.push_pair_blocked(pair.profile_a,pair.profile_b) then
        raise exception 'unavailable' using errcode='42501';
      end if;
    end if;
    insert into public.profile_projects(id, owner_id, joint, published, name, tagline, description, link, cover_path, photo_paths)
    values(p_id,p_actor,p_match_id is not null,p_match_id is null,p_values->>'name',p_values->>'tagline',
           p_values->>'description',p_values->>'link',p_values->>'cover_path',photo_paths_value);
    if p_match_id is not null then
      insert into public.project_authors values (p_id,case when pair.profile_a=p_actor then pair.profile_b else pair.profile_a end);
      insert into public.project_workspaces(project_id,match_id) values(p_id,p_match_id);
      insert into public.project_events(match_id,project_id,actor_id,kind) values(p_match_id,p_id,p_actor,'created');
    end if;
    return;
  end if;

  select * into card from public.profile_projects where id=p_id for update;
  if not exists (select 1 from public.project_authors where project_id=p_id and user_id=p_actor) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  if card.revision is distinct from p_revision then raise exception 'project changed' using errcode='PJ409'; end if;
  case p_action
    when 'save' then
      update public.profile_projects set
        name=p_values->>'name',tagline=p_values->>'tagline',description=p_values->>'description',
        link=p_values->>'link',cover_path=p_values->>'cover_path',photo_paths=photo_paths_value,revision=gen_random_uuid()
      where id=p_id;
      update public.project_workspaces set proposed_by=null where project_id=p_id and proposed_by is not null;
    when 'remove' then
      select match_id into match_id_for_event from public.project_workspaces where project_id=p_id;
      if match_id_for_event is not null then
        insert into public.project_events(match_id,project_id,actor_id,kind) values(match_id_for_event,p_id,p_actor,'deleted');
      end if;
      delete from public.profile_projects where id=p_id;
    when 'promote' then
      update public.profile_projects set promoted_at=now() where id=p_id and published;
    else raise exception 'invalid action' using errcode='22023';
  end case;
end;
$$;
revoke all on function public.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb) to service_role;

-- Transfer the compatibility id before the old owner's FK can cascade.
-- Detached joint projects remain private, even with just one surviving author.
create function project_private.detach_author(p_project uuid,p_leaving uuid)
returns void language plpgsql set search_path = '' as $$
declare
  survivor uuid;
begin
  perform 1 from public.profile_projects where id=p_project for update;
  if not found then return; end if;
  delete from public.project_authors where project_id=p_project and user_id=p_leaving;
  select user_id into survivor from public.project_authors where project_id=p_project order by user_id limit 1;
  if survivor is null then
    delete from public.profile_projects where id=p_project;
  else
    update public.profile_projects set published=false,owner_id=survivor,revision=gen_random_uuid() where id=p_project;
    update public.project_workspaces set match_id=null,proposed_by=null where project_id=p_project;
  end if;
end;
$$;
revoke all on function project_private.detach_author(uuid,uuid) from public, anon, authenticated;

create function project_private.detach_on_block() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pair_id uuid;
  project uuid;
begin
  select id into pair_id from public.matches where profile_a=least(new.blocker_id,new.blocked_id)
    and profile_b=greatest(new.blocker_id,new.blocked_id) for update;
  select project_id into project from public.project_workspaces where match_id=pair_id;
  if found then perform project_private.detach_author(project,new.blocker_id); end if;
  return null;
end;
$$;
create trigger detach_projects_on_block after insert on public.user_blocks
for each row execute function project_private.detach_on_block();

create function project_private.detach_on_account_delete() returns trigger language plpgsql security definer set search_path = '' as $$
declare project uuid;
begin
  for project in select a.project_id from public.project_authors a
    join public.project_workspaces w using(project_id) where a.user_id=old.id order by a.project_id loop
    perform project_private.detach_author(project,old.id);
  end loop;
  return old;
end;
$$;
create trigger detach_projects_on_account_delete before delete on public.profiles
for each row execute function project_private.detach_on_account_delete();

create function project_private.detach_on_unmatch() returns trigger language plpgsql security definer set search_path = '' as $$
declare project uuid;
begin
  select project_id into project from public.project_workspaces where match_id=old.id;
  if found then
    if auth.uid() in (old.profile_a,old.profile_b) then
      perform project_private.detach_author(project,auth.uid());
    else
      -- Administrative deletion has no departing actor: revoke publication and
      -- close the workspace for both. Account deletion detaches its actor first.
      delete from public.profile_projects where id=project;
    end if;
  end if;
  return old;
end;
$$;
create trigger detach_projects_on_unmatch before delete on public.matches
for each row execute function project_private.detach_on_unmatch();

create function public.leave_project_match(p_match_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pair public.matches;
  actor uuid := auth.uid();
begin
  select * into pair from public.matches where id=p_match_id and actor in (profile_a,profile_b);
  if not found then raise exception 'unavailable' using errcode='42501'; end if;
  -- Serialize with record_decision from either side so retrying an old like
  -- cannot recreate the match after this transaction commits.
  perform pg_advisory_xact_lock(hashtextextended(pair.profile_a::text,0));
  perform pg_advisory_xact_lock(hashtextextended(pair.profile_b::text,0));
  update public.decisions set decision='pass',is_super=false,created_at=now()
    where actor_id=actor and target_id in (pair.profile_a,pair.profile_b);
  delete from public.matches where id=p_match_id;
end;
$$;
revoke all on function public.leave_project_match(uuid) from public, anon;
grant execute on function public.leave_project_match(uuid) to authenticated;

grant usage on schema project_private to service_role;
grant execute on function project_private.has_room(uuid,uuid) to service_role;
revoke all on function project_private.detach_on_block(), project_private.detach_on_account_delete(),
  project_private.detach_on_unmatch(), project_private.add_first_author() from public, anon, authenticated;
