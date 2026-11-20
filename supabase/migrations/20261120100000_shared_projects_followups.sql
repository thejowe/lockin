-- Follow-ups to joint and group projects before their first production rollout.
--
-- 1. Server configuration: a switch that keeps shared project photos out of
--    public surfaces (the store build signs every listed photo and its project
--    list fails on a shared/ path), and the minimum app version.
-- 2. A detached joint project becomes a private personal project of the
--    remaining author, listed in their own profile.
-- 3. An unmatched pair is closed for good: no replayed like recreates the match
--    and the deck never shows them again. Each participant hears it in Realtime.
-- 4. A changed retry of a group creation stores the current draft.
-- 5. «Mover al principio» is per author.
-- 6. Task edits carry a revision.

-- 1. Configuration ----------------------------------------------------------

create table public.app_config (
  id boolean primary key default true check (id),
  shared_project_photos boolean not null default false,
  -- Per storefront: iOS and Android ship different version numbers.
  min_ios_version text not null default '0.0.0'
    check (min_ios_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  min_android_version text not null default '0.0.0'
    check (min_android_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  updated_at timestamptz not null default now()
);
insert into public.app_config default values;
alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;
grant select on public.app_config to anon, authenticated;
grant all on public.app_config to service_role;
create policy app_config_readable on public.app_config for select to anon, authenticated
using (true);

create function project_private.shared_photos_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.shared_project_photos from public.app_config c), false);
$$;
revoke all on function project_private.shared_photos_enabled() from public, anon;
grant execute on function project_private.shared_photos_enabled() to authenticated, service_role;

-- A card may reach people outside its authors only if it is personal, has no
-- photos, or shared photos are enabled.
create function project_private.media_public(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not p.joint or project_private.shared_photos_enabled()
      or (p.cover_path is null and cardinality(p.photo_paths) = 0)
    from public.profile_projects p where p.id = p_project
  ), false);
$$;
revoke all on function project_private.media_public(uuid) from public, anon;
grant execute on function project_private.media_public(uuid) to authenticated, service_role;

create function project_private.require_public_media(p_has_photos boolean) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_has_photos and not project_private.shared_photos_enabled() then
    raise exception 'shared project photos are disabled' using errcode = 'PJ423';
  end if;
end;
$$;
revoke all on function project_private.require_public_media(boolean) from public, anon, authenticated;
grant execute on function project_private.require_public_media(boolean) to service_role;

create or replace function project_private.can_read(p_project uuid, p_published boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.project_authors where project_id=p_project and user_id=auth.uid())
    or (p_published and not exists (
      select 1 from public.project_authors a where a.project_id=p_project
      and not public.project_owner_visible(a.user_id)
    ) and project_private.media_public(p_project))
  );
$$;

drop policy group_projects_in_discovery on public.profile_projects;
create policy group_projects_in_discovery on public.profile_projects for select to authenticated
using (joint and not published and project_private.group_project_discoverable(id)
       and project_private.media_public(id));

-- 2. Detached projects --------------------------------------------------------

alter table public.profile_projects add column detached boolean not null default false;
alter table public.profile_projects add constraint detached_projects_are_joint
  check (not detached or joint);

create or replace function project_private.detach_author(p_project uuid,p_leaving uuid)
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
    -- The survivor keeps it as a private personal project («Tus proyectos»).
    update public.profile_projects
      set published=false,detached=true,owner_id=survivor,revision=gen_random_uuid()
      where id=p_project;
    update public.project_workspaces set match_id=null,proposed_by=null where project_id=p_project;
  end if;
end;
$$;
revoke all on function project_private.detach_author(uuid,uuid) from public, anon, authenticated;

create or replace function public.set_project_publication(p_project_id uuid,p_revision uuid,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  card public.profile_projects;
  work public.project_workspaces;
  author uuid;
  actor uuid := auth.uid();
  photos boolean;
begin
  select * into card from public.profile_projects where id=p_project_id for update;
  if not found or not exists (
    select 1 from public.project_authors where project_id=card.id and user_id=actor
  ) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  if card.revision is distinct from p_revision then
    raise exception 'project changed' using errcode='PJ409';
  end if;
  photos := card.cover_path is not null or cardinality(card.photo_paths) > 0;

  -- A detached project belongs to its only author: no consent to ask for.
  if card.detached then
    case p_action
      when 'publish' then
        perform project_private.require_public_media(photos);
        perform pg_advisory_xact_lock(hashtextextended('projects:' || actor::text,0));
        if not card.published and not project_private.has_room(actor,card.id) then
          raise exception 'project limit' using errcode='PJ003';
        end if;
        update public.profile_projects set published=true where id=card.id;
      when 'private' then
        update public.profile_projects set published=false where id=card.id;
      else raise exception 'invalid action' using errcode='22023';
    end case;
    update public.profile_projects set revision=gen_random_uuid() where id=card.id;
    return;
  end if;

  select * into work from public.project_workspaces where project_id=p_project_id;
  if work.match_id is null or not public.is_unblocked_match(work.match_id) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  case p_action
    when 'propose' then
      if card.published or work.proposed_by is not null then
        raise exception 'proposal changed' using errcode='PJ409';
      end if;
      perform project_private.require_public_media(photos);
      update public.project_workspaces set proposed_by=actor where project_id=card.id;
      insert into public.project_events(match_id,project_id,actor_id,kind)
        values(work.match_id,card.id,actor,'proposed');
    when 'accept', 'reject' then
      if work.proposed_by is null or actor=work.proposed_by or card.published then
        raise exception 'peer consent required' using errcode='42501';
      end if;
      if p_action='accept' then
        perform project_private.require_public_media(photos);
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

-- 5. Per-author order ---------------------------------------------------------

alter table public.project_authors add column promoted_at timestamptz;
update public.project_authors a set promoted_at = p.promoted_at
from public.profile_projects p where p.id = a.project_id and p.promoted_at is not null;

-- The service entry point: group admin rule (20261119233232), photo switch,
-- and «promote» on the actor's own membership.
create or replace function public.commit_moderated_project(
  p_actor uuid, p_id uuid, p_revision uuid, p_match_id uuid, p_action text, p_values jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  team public.groups;
  card public.profile_projects;
  photos boolean := p_values->>'cover_path' is not null
    or coalesce(jsonb_array_length(p_values->'photo_paths'), 0) > 0;
begin
  select * into team from public.groups where project_id=p_id for update;
  if found and (team.admin_id is distinct from p_actor or p_action is distinct from 'save'
                or p_revision is null or p_match_id is not null) then
    raise exception 'only the group admin may edit this project' using errcode='42501';
  end if;
  if p_action = 'promote' then
    select * into card from public.profile_projects where id=p_id for update;
    if not found or not exists (
      select 1 from public.project_authors where project_id=p_id and user_id=p_actor
    ) then
      raise exception 'unavailable' using errcode='42501';
    end if;
    if card.revision is distinct from p_revision then
      raise exception 'project changed' using errcode='PJ409';
    end if;
    if card.published then
      update public.project_authors set promoted_at=now() where project_id=p_id and user_id=p_actor;
      -- Store clients still sort personal projects by the card column.
      if not card.joint then
        update public.profile_projects set promoted_at=now() where id=p_id;
      end if;
    end if;
    return;
  end if;
  if p_action = 'save' and p_revision is not null then
    select * into card from public.profile_projects where id=p_id;
    if found and card.joint and (card.published or team.id is not null) then
      perform project_private.require_public_media(photos);
    end if;
  end if;
  perform project_private.commit_moderated_project(p_actor,p_id,p_revision,p_match_id,p_action,p_values);
  if team.id is not null then
    update public.groups set updated_at=clock_timestamp() where id=team.id;
  end if;
end;
$$;
revoke all on function public.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb) to service_role;

-- 4. Group creation retries ---------------------------------------------------

-- A lost reply leaves the editor open with the same draft id. A retry within
-- a group nobody else has joined yet stores the current draft in place (same
-- group id); images it no longer uses go to the removal queue.
create function project_private.check_group_draft(p_group jsonb) returns void
language plpgsql immutable set search_path = '' as $fn$
declare
  v_name text := btrim(coalesce(p_group->>'name', ''));
  v_description text := btrim(coalesce(p_group->>'description', ''));
  v_max integer := coalesce((p_group->>'maxMembers')::integer, 6);
  v_roles jsonb := p_group->'roles';
begin
  -- Same rules as project_private.create_group_for (20261119233232).
  if char_length(v_name) not between 2 and 60
     or char_length(v_description) not between 10 and 500
     or v_max not between 2 and 6
     or v_roles is null or jsonb_typeof(v_roles) <> 'array'
     or jsonb_array_length(v_roles) not between 1 and 5 then
    raise exception 'create_group: datos no válidos' using errcode = 'LG001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_roles) e
    where jsonb_typeof(e) <> 'object'
       or (e ->> 'specialty') is null
       or not (e ->> 'specialty' = any(enum_range(null::public.specialty)::text[]))
       or (e ->> 'slots') is null
       or (e ->> 'slots') !~ '^[0-9]{1,2}$'
       or (e ->> 'slots')::integer not between 1 and 5
  ) or (
    select count(distinct e ->> 'specialty') <> count(*) from jsonb_array_elements(v_roles) e
  ) or (
    select sum((e ->> 'slots')::integer) + 1 > v_max from jsonb_array_elements(v_roles) e
  ) then
    raise exception 'create_group: puestos no válidos' using errcode = 'LG001';
  end if;
end;
$fn$;
revoke all on function project_private.check_group_draft(jsonb) from public, anon, authenticated;

create or replace function public.create_moderated_group_project(
  p_actor uuid, p_id uuid, p_group jsonb, p_values jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  team public.groups;
  kept text[] := array_remove(array[p_values->>'cover_path'], null)
    || array(select jsonb_array_elements_text(p_values->'photo_paths'));
begin
  if p_actor is null or p_id is null or jsonb_typeof(p_group) is distinct from 'object' then
    raise exception 'invalid group draft' using errcode='LG001';
  end if;
  -- A group project is discoverable as soon as it exists.
  perform project_private.require_public_media(cardinality(kept) > 0);
  perform pg_advisory_xact_lock(hashtextextended('group_member:' || p_actor::text, 0));
  select * into team from public.groups where project_id=p_id and admin_id=p_actor for update;
  if found then
    if exists (select 1 from public.group_members m where m.group_id=team.id and m.user_id<>p_actor)
    then
      return false;
    end if;
    perform project_private.check_group_draft(p_group);
    update public.groups set
      name=btrim(p_group->>'name'), description=btrim(p_group->>'description'),
      max_members=coalesce((p_group->>'maxMembers')::integer, 6), updated_at=clock_timestamp()
      where id=team.id;
    -- Reconcile roles by specialty, as update_group does: a surviving
    -- specialty keeps its id (pending invitations point at it).
    delete from public.group_roles r where r.group_id=team.id and not exists (
      select 1 from jsonb_array_elements(p_group->'roles') e where e->>'specialty' = r.specialty::text);
    update public.group_roles r set slots=(e->>'slots')::smallint
      from jsonb_array_elements(p_group->'roles') e
      where r.group_id=team.id and e->>'specialty' = r.specialty::text;
    insert into public.group_roles (group_id, specialty, slots)
    select team.id, (e ->> 'specialty')::public.specialty, (e ->> 'slots')::smallint
    from jsonb_array_elements(p_group->'roles') e
    where not exists (select 1 from public.group_roles r
                      where r.group_id=team.id and r.specialty::text = e->>'specialty');
    insert into project_private.retired_group_media(path)
    select unnest(array_remove(array[p.cover_path] || p.photo_paths, null))
    from public.profile_projects p where p.id=p_id
    on conflict do nothing;
    update public.profile_projects set
      name=p_values->>'name', tagline=p_values->>'tagline', description=p_values->>'description',
      link=p_values->>'link', cover_path=p_values->>'cover_path',
      photo_paths=array(select jsonb_array_elements_text(p_values->'photo_paths')),
      revision=gen_random_uuid()
      where id=p_id;
    delete from project_private.retired_group_media m where m.path = any(kept);
    return true;
  end if;
  team := project_private.create_group_for(p_actor, p_group->>'name', p_group->>'description',
    p_group->'roles', coalesce((p_group->>'maxMembers')::integer, 6));

  insert into public.profile_projects(id, owner_id, joint, published, name, tagline, description,
                                     link, cover_path, photo_paths)
  values(p_id, p_actor, true, false, p_values->>'name', p_values->>'tagline',
    p_values->>'description', p_values->>'link', p_values->>'cover_path',
    array(select jsonb_array_elements_text(p_values->'photo_paths')));
  -- project_first_author has already registered the group's founding admin.
  update public.groups set project_id=p_id where id=team.id;
  return true;
end;
$$;
revoke all on function public.create_moderated_group_project(uuid,uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_moderated_group_project(uuid,uuid,jsonb,jsonb) to service_role;

-- 3. Closed pairs ---------------------------------------------------------------

create table public.match_closures (
  match_id uuid primary key,
  profile_a uuid not null references public.profiles on delete cascade,
  profile_b uuid not null references public.profiles on delete cascade,
  closed_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  check (profile_a < profile_b)
);
create unique index match_closures_pair on public.match_closures(profile_a, profile_b);
create index match_closures_by_b on public.match_closures(profile_b);
alter table public.match_closures enable row level security;
revoke all on public.match_closures from public, anon, authenticated;
grant select on public.match_closures to authenticated;
grant all on public.match_closures to service_role;
create policy match_closures_participants on public.match_closures for select to authenticated
using ((select auth.uid()) in (profile_a, profile_b));

create function public.pair_closed(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_closures c
    where c.profile_a = least((select auth.uid()), p_other)
      and c.profile_b = greatest((select auth.uid()), p_other)
  );
$$;
revoke all on function public.pair_closed(uuid) from public, anon;
grant execute on function public.pair_closed(uuid) to authenticated;

create or replace function public.leave_project_match(p_match_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pair public.matches;
  actor uuid := auth.uid();
begin
  select * into pair from public.matches where id=p_match_id and actor in (profile_a,profile_b);
  if not found then raise exception 'unavailable' using errcode='42501'; end if;
  -- Serialize with record_decision from either side: the closure below makes
  -- any later like of this pair inert, including a retried old request.
  perform pg_advisory_xact_lock(hashtextextended(pair.profile_a::text,0));
  perform pg_advisory_xact_lock(hashtextextended(pair.profile_b::text,0));
  update public.decisions set decision='pass',is_super=false,created_at=now()
    where actor_id=actor and target_id in (pair.profile_a,pair.profile_b);
  insert into public.match_closures(match_id,profile_a,profile_b,closed_by)
    values(pair.id,pair.profile_a,pair.profile_b,actor)
    on conflict do nothing;
  delete from public.matches where id=p_match_id;
end;
$$;
revoke all on function public.leave_project_match(uuid) from public, anon;
grant execute on function public.leave_project_match(uuid) to authenticated;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.match_closures;
  end if;
end;
$do$;

-- 6. Task revisions -----------------------------------------------------------

alter table public.chat_plan_items add column revision uuid not null default gen_random_uuid();
create function public.bump_plan_item_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := gen_random_uuid();
  return new;
end;
$$;
revoke all on function public.bump_plan_item_revision() from public, anon, authenticated;
create trigger bump_plan_item_revision before update on public.chat_plan_items
  for each row execute function public.bump_plan_item_revision();

-- 3b. The deck and the match maker respect closed pairs. Last definitions:
-- 20261119214427_recycle_discovery_passes.sql; only the pair_closed() check is new.
create or replace function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50,
  p_exclude_ids uuid[] default null,
  p_min_hours_per_week integer default null,
  p_time_bands public.time_band[] default null,
  p_ambition public.ambition[] default null,
  p_starting_point public.starting_point[] default null,
  p_timezone_window_hours integer default null,
  p_min_age integer default null,
  p_max_age integer default null,
  p_require_github boolean default null,
  p_require_linkedin boolean default null
)
returns table (
  id uuid,
  name text,
  age integer,
  location text,
  timezone text,
  avatar_initials text,
  avatar_accent public.avatar_accent,
  specialties public.specialty[],
  looking_for public.mode_preference,
  starting_point public.starting_point,
  availability_hours_per_week integer,
  availability_bands public.time_band[],
  ambition public.ambition,
  link_github text,
  link_portfolio text,
  link_linkedin text,
  prompts jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  seeking_specialties public.specialty[],
  github_handle text,
  github_verified_at timestamptz,
  avatar_url text,
  linkedin_name text,
  linkedin_verified_at timestamptz,
  link_instagram text,
  link_tiktok text,
  languages public.language[],
  seeking_languages public.language[],
  other_specialty text,
  super_liked_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if (p_min_hours_per_week is not null
      or p_time_bands is not null
      or p_ambition is not null
      or p_starting_point is not null
      or p_min_age is not null
      or p_max_age is not null
      or p_require_github is not null
      or p_require_linkedin is not null)
     and not public.is_premium(v_uid) then
    raise exception 'discovery_deck: los filtros avanzados requieren Premium'
      using errcode = 'LQ005';
  end if;

  return query
  with viewer as (
    select coalesce(
      p_mode,
      (select s.active_mode from public.user_settings s where s.user_id = v_uid),
      (select p.looking_for from public.profiles p where p.id = v_uid)
    ) as mode
  ),
  zones as materialized (
    select z.name, extract(epoch from z.utc_offset) / 3600 as offset_hours
    from pg_catalog.pg_timezone_names z
    where p_timezone_window_hours is not null
  ),
  ranked as (
    select
      p.*,
      mine.created_at as passed_at,
      exists (
        select 1 from public.decisions d
        where d.actor_id = p.id and d.target_id = v_uid
          and d.decision = 'like' and d.is_super
      ) as super_liked_me,
      exists (
        select 1 from public.boosts b
        where b.user_id = p.id and b.ends_at > now()
      ) as boosted,
      case when me.id is null or v.mode = 'lockin'
        or me.looking_for = 'lockin' or p.looking_for = 'lockin' then 0
      else (me.specialties && p.seeking_specialties)::integer
         + (p.specialties && me.seeking_specialties)::integer end
      + coalesce((p.languages && me.seeking_languages)::integer, 0)
      + coalesce((me.languages && p.seeking_languages)::integer, 0) as score
    from public.profiles p
    join auth.users account on account.id = p.id
    left join public.decisions mine on mine.actor_id = v_uid and mine.target_id = p.id
    cross join viewer v
    left join public.profiles me on me.id = v_uid
    left join zones zp on zp.name = p.timezone
    left join zones zm on zm.name = me.timezone
    where p.id <> v_uid
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until <= now())
      and not exists (
        select 1 from public.blocked_account_emails e
        where e.email_hash = public.email_block_hash(account.email)
      )
      and not public.has_profile_block(p.id)
      and not public.pair_closed(p.id)
      and (mine.target_id is null or
           (mine.decision = 'pass' and mine.created_at <= now() - public.pass_cooldown()))
      and not exists (
        select 1 from public.matches m
        where m.profile_a = least(v_uid, p.id) and m.profile_b = greatest(v_uid, p.id)
      )
      and (p_exclude_ids is null or not (p.id = any(p_exclude_ids)))
      and (v.mode is null or v.mode = 'ambos' or p.looking_for = 'ambos' or p.looking_for = v.mode)
      and (p_specialties is null or cardinality(p_specialties) = 0 or p.specialties && p_specialties)
      and (p_min_age is null or p.age >= p_min_age)
      and (p_max_age is null or p.age <= p_max_age)
      and (p_require_github is not true or p.github_verified_at is not null)
      and (p_require_linkedin is not true or p.linkedin_verified_at is not null)
      and (p_min_hours_per_week is null or p.availability_hours_per_week >= p_min_hours_per_week)
      and (p_time_bands is null or cardinality(p_time_bands) = 0 or p.availability_bands && p_time_bands)
      and (p_ambition is null or cardinality(p_ambition) = 0 or p.ambition = any(p_ambition))
      and (p_starting_point is null or cardinality(p_starting_point) = 0 or p.starting_point = any(p_starting_point))
      and (
        p_timezone_window_hours is null
        or me.id is null
        or abs(coalesce(zp.offset_hours, 0) - coalesce(zm.offset_hours, 0)) <= p_timezone_window_hours
      )
  )
  select
    r.id, r.name, r.age, r.location, r.timezone, r.avatar_initials, r.avatar_accent,
    r.specialties, r.looking_for, r.starting_point, r.availability_hours_per_week,
    r.availability_bands, r.ambition, r.link_github, r.link_portfolio, r.link_linkedin,
    r.prompts, r.created_at, r.updated_at, r.seeking_specialties, r.github_handle,
    r.github_verified_at, r.avatar_url, r.linkedin_name, r.linkedin_verified_at,
    r.link_instagram, r.link_tiktok, r.languages, r.seeking_languages, r.other_specialty,
    r.super_liked_me
  from ranked r
  order by r.passed_at asc nulls first,
    case when r.passed_at is null then r.super_liked_me end desc,
    case when r.passed_at is null then r.boosted end desc,
    case when r.passed_at is null then r.score end desc,
    r.id asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$fn$;

create or replace function public.record_decision(
  p_target_id uuid,
  p_decision public.decision,
  p_mode public.mode_preference default null,
  p_super boolean default false
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_super boolean := coalesce(p_super, false) and p_decision = 'like';
  v_actor_mode public.mode_preference;
  v_target_looking_for public.mode_preference;
  v_limits record;
  v_now timestamptz;
  v_premium boolean;
  v_unchanged boolean;
  v_previous_pass_at timestamptz;
  v_used integer;
  v_supers integer;
  v_super_cap integer;
  v_reciprocal boolean;
  v_match public.matches;
begin
  if v_actor is null then
    raise exception 'record_decision: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  if p_target_id = v_actor then
    raise exception 'record_decision: no puedes decidir sobre tu propio perfil'
      using errcode = '22023';
  end if;

  select coalesce(p_mode, s.active_mode, p.looking_for)
    into v_actor_mode
  from public.profiles p
  left join public.user_settings s on s.user_id = p.id
  where p.id = v_actor;

  if not found then
    raise exception 'record_decision: el usuario todavía no tiene perfil'
      using errcode = '23503';
  end if;

  select p.looking_for
    into v_target_looking_for
  from public.profiles p
  where p.id = p_target_id;

  if not found then
    raise exception 'record_decision: el perfil destino no existe'
      using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  -- A closed pair: a retried old like neither writes nor spends quota.
  if p_decision = 'like' and public.pair_closed(p_target_id) then
    return null;
  end if;

  v_now := clock_timestamp();
  select * into v_limits from public.premium_limits();

  select d.decision = p_decision and d.is_super = v_super,
         case when d.decision = 'pass' and d.created_at <= v_now - public.pass_cooldown()
              then d.created_at end
    into v_unchanged, v_previous_pass_at
  from public.decisions d
  where d.actor_id = v_actor and d.target_id = p_target_id;
  v_unchanged := coalesce(v_unchanged, false) and v_previous_pass_at is null;

  if p_decision = 'like' and not v_unchanged then
    v_premium := public.is_premium(v_actor);

    select count(*)::integer into v_used
    from public.like_events e
    where e.actor_id = v_actor and e.created_at > v_now - interval '24 hours';

    if v_used >= v_limits.abuse_likes_per_day then
      raise exception 'record_decision: tope antiabuso de likes'
        using errcode = 'LQ004',
              detail = to_char(
                public.like_window_reset(v_actor, null, interval '24 hours', v_limits.abuse_likes_per_day, v_now)
                  at time zone 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
              );
    end if;

    if not v_premium and v_used >= v_limits.free_likes_per_day then
      raise exception 'record_decision: sin likes hasta que se renueve el cupo'
        using errcode = 'LQ001',
              detail = to_char(
                public.like_window_reset(v_actor, null, interval '24 hours', v_limits.free_likes_per_day, v_now)
                  at time zone 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
              );
    end if;

    if v_super then
      v_super_cap := case when v_premium then v_limits.premium_supers_per_week else v_limits.free_supers_per_week end;

      select count(*)::integer into v_supers
      from public.like_events e
      where e.actor_id = v_actor and e.kind = 'super' and e.created_at > v_now - interval '7 days';

      if v_supers >= v_super_cap then
        raise exception 'record_decision: sin Super Likes hasta que se renueve el cupo'
          using errcode = 'LQ002',
                detail = to_char(
                  public.like_window_reset(v_actor, 'super', interval '7 days', v_super_cap, v_now)
                    at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                );
      end if;
    end if;
  end if;

  if not v_unchanged then
    insert into public.decisions (actor_id, target_id, decision, is_super, created_at, previous_pass_at)
    values (v_actor, p_target_id, p_decision, v_super, v_now, v_previous_pass_at)
    on conflict (actor_id, target_id)
      do update set decision = excluded.decision,
                    is_super = excluded.is_super,
                    created_at = excluded.created_at,
                    previous_pass_at = excluded.previous_pass_at;

    if p_decision = 'like' then
      insert into public.like_events (actor_id, target_id, kind, created_at)
      values (v_actor, p_target_id, case when v_super then 'super' else 'like' end, v_now);
    end if;
  end if;

  if p_decision <> 'like' then
    return null;
  end if;

  if public.has_profile_block(p_target_id) then
    return null;
  end if;

  -- A pair that undid its match stays closed, even for a retried old like.
  if public.pair_closed(p_target_id) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_actor, p_target_id)::text || ':' || greatest(v_actor, p_target_id)::text, 1));

  select exists (
    select 1
    from public.decisions d
    where d.actor_id = p_target_id
      and d.target_id = v_actor
      and d.decision = 'like'
  ) into v_reciprocal;

  if not v_reciprocal then
    return null;
  end if;

  insert into public.matches (profile_a, profile_b, mode)
  values (
    least(v_actor, p_target_id),
    greatest(v_actor, p_target_id),
    public.resolve_match_mode(v_actor_mode, v_target_looking_for)
  )
  on conflict on constraint matches_pair_unique
    do update set profile_a = excluded.profile_a
  returning * into v_match;

  return v_match;
end;
$fn$;

-- Reminders every five minutes, also where 20261119224135 already ran with the
-- one-minute schedule (cron.schedule with an existing name updates it).
do $cron$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lockin-project-reminders', '*/5 * * * *', 'select public.enqueue_project_reminders();');
  end if;
end;
$cron$;
