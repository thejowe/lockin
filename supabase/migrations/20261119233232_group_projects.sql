-- Groups with no linked project keep the existing people-seeking behavior.
alter table public.groups add column project_id uuid unique references public.profile_projects(id);

-- Both the authenticated legacy RPC and the moderator use these admission rules.
create function project_private.create_group_for(
  v_uid uuid,
  p_name text,
  p_description text,
  p_roles jsonb,
  p_max_members integer default 6
)
returns public.groups
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_total integer;
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'create_group: necesitas un perfil' using errcode = '23503';
  end if;
  if public.group_creation_requires_premium() and not public.is_premium(v_uid) then
    raise exception 'create_group: crear un grupo requiere Premium' using errcode = 'LQ005';
  end if;

  if char_length(v_name) not between 2 and 60
     or char_length(v_description) not between 10 and 500
     or p_max_members is null or p_max_members not between 2 and 6
     or p_roles is null or jsonb_typeof(p_roles) <> 'array'
     or jsonb_array_length(p_roles) not between 1 and 5 then
    raise exception 'create_group: datos no válidos' using errcode = 'LG001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_roles) e
    where jsonb_typeof(e) <> 'object'
       or (e ->> 'specialty') is null
       or not (e ->> 'specialty' = any(enum_range(null::public.specialty)::text[]))
       or (e ->> 'slots') is null
       or (e ->> 'slots') !~ '^[0-9]{1,2}$'
       or (e ->> 'slots')::integer not between 1 and 5
  ) or (
    select count(distinct e ->> 'specialty') <> count(*) from jsonb_array_elements(p_roles) e
  ) then
    raise exception 'create_group: puestos no válidos' using errcode = 'LG001';
  end if;

  select sum((e ->> 'slots')::integer) into v_total from jsonb_array_elements(p_roles) e;
  -- El admin ocupa un sitio que no es de ningún puesto.
  if v_total + 1 > p_max_members then
    raise exception 'create_group: demasiadas plazas para % miembros', p_max_members
      using errcode = 'LG001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('group_member:' || v_uid::text, 0));
  if exists (select 1 from public.groups g where g.admin_id = v_uid) then
    raise exception 'create_group: ya administras un grupo' using errcode = 'LG006';
  end if;
  if (select count(*) from public.group_members m where m.user_id = v_uid)
     >= public.group_max_memberships() then
    raise exception 'create_group: ya estás en el máximo de grupos' using errcode = 'LG002';
  end if;

  insert into public.groups (name, description, admin_id, max_members)
  values (v_name, v_description, v_uid, p_max_members)
  returning * into v_group;

  insert into public.group_roles (group_id, specialty, slots)
  select v_group.id, (e ->> 'specialty')::public.specialty, (e ->> 'slots')::smallint
  from jsonb_array_elements(p_roles) e;

  insert into public.group_members (group_id, user_id, role_id)
  values (v_group.id, v_uid, null);

  return v_group;
end;
$fn$;

revoke all on function project_private.create_group_for(uuid,text,text,jsonb,integer)
  from public, anon, authenticated;

create or replace function public.create_group(
  p_name text, p_description text, p_roles jsonb, p_max_members integer default 6
) returns public.groups language plpgsql security definer set search_path = '' as $$
begin
  return project_private.create_group_for(auth.uid(), p_name, p_description, p_roles, p_max_members);
end;
$$;

-- Only the moderation service can create the linked pair. The editor's UUID
-- makes a second delivery of the same creation harmless after a lost reply.
create function public.create_moderated_group_project(
  p_actor uuid, p_id uuid, p_group jsonb, p_values jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  team public.groups;
begin
  if p_actor is null or p_id is null or jsonb_typeof(p_group) is distinct from 'object' then
    raise exception 'invalid group draft' using errcode='LG001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('group_member:' || p_actor::text, 0));
  if exists (select 1 from public.groups where project_id=p_id and admin_id=p_actor) then
    return false;
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

-- Membership writes (including account deletion) already serialize on the
-- group row. Keep the same lock order when checking who may edit its project.
alter function public.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb)
  set schema project_private;
revoke all on function project_private.commit_moderated_project(uuid,uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
create function public.commit_moderated_project(
  p_actor uuid, p_id uuid, p_revision uuid, p_match_id uuid, p_action text, p_values jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  team public.groups;
begin
  select * into team from public.groups where project_id=p_id for update;
  if found and (team.admin_id is distinct from p_actor or p_action is distinct from 'save'
                or p_revision is null or p_match_id is not null) then
    raise exception 'only the group admin may edit this project' using errcode='42501';
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

create function project_private.sync_group_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.project_authors(project_id,user_id)
    select project_id,new.user_id from public.groups where id=new.group_id and project_id is not null;
  else
    delete from public.project_authors a using public.groups g
    where g.id=old.group_id and a.project_id=g.project_id and a.user_id=old.user_id;
  end if;
  return null;
end;
$$;
create trigger group_project_members after insert or delete on public.group_members
for each row execute function project_private.sync_group_author();

create function project_private.transfer_group_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profile_projects set owner_id=new.admin_id, revision=gen_random_uuid()
    where id=new.project_id;
  return null;
end;
$$;
create trigger group_project_admin after update of admin_id on public.groups
for each row when (new.project_id is not null and new.admin_id <> old.admin_id)
execute function project_private.transfer_group_project();

-- Store immutable keys until the Storage API confirms it has deleted the bytes.
-- SQL-only deletion of storage.objects would strand the underlying files.
create table project_private.retired_group_media (path text primary key);
revoke all on project_private.retired_group_media from public, anon, authenticated;
create function project_private.retire_group_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into project_private.retired_group_media(path)
  select unnest(array_remove(array[p.cover_path] || p.photo_paths, null))
  from public.profile_projects p where p.id=old.project_id on conflict do nothing;
  delete from public.profile_projects where id=old.project_id;
  return null;
end;
$$;
create trigger group_project_disbanded after delete on public.groups
for each row when (old.project_id is not null) execute function project_private.retire_group_project();
revoke all on function project_private.sync_group_author(), project_private.transfer_group_project(),
  project_private.retire_group_project() from public, anon, authenticated;

create function public.retired_group_project_media(p_removed text[] default '{}')
returns table(path text) language plpgsql security definer set search_path = '' as $$
begin
  delete from project_private.retired_group_media m where m.path=any(p_removed);
  return query select m.path from project_private.retired_group_media m order by m.path limit 100;
end;
$$;
revoke all on function public.retired_group_project_media(text[]) from public, anon, authenticated;
grant execute on function public.retired_group_project_media(text[]) to service_role;

-- Composite FK enforces current group membership even when a task assignment
-- races a kick. A departing assignee leaves the task, state and due date intact.
alter table public.chat_plan_items add constraint group_task_assignee_member
  foreign key (group_id, assignee_id) references public.group_members(group_id,user_id)
  on delete set null (assignee_id);
create index group_assigned_tasks on public.chat_plan_items(group_id, assignee_id)
  where group_id is not null and assignee_id is not null;

create or replace function public.sync_project_task() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare enhanced boolean;
begin
  if tg_op = 'INSERT' then
    enhanced := new.assignee_id is not null or new.due_at is not null or new.status <> 'pending';
  else
    enhanced := (new.assignee_id, new.due_at, new.status)
      is distinct from (old.assignee_id, old.due_at, old.status);
  end if;
  -- A foreign-key action may be clearing the assignee during disbanding.
  if tg_op='UPDATE' and old.assignee_id is not null and new.assignee_id is null
     and (new.status,new.due_at) is not distinct from (old.status,old.due_at) then
    enhanced := false;
  end if;
  if enhanced and (new.starts_at is not null or not exists (
    select 1 from (
      select w.project_id from public.project_workspaces w where w.match_id=new.match_id
      union all
      select g.project_id from public.groups g where g.id=new.group_id and g.project_id is not null
    ) project
    where new.assignee_id is null or exists (
      select 1 from public.project_authors a
      where a.project_id=project.project_id and a.user_id=new.assignee_id
    )
  )) then
    raise exception 'Invalid project task' using errcode = '23514';
  end if;
  if new.starts_at is null then
    if tg_op = 'INSERT' and new.closed and new.status = 'pending' then
      new.status := 'done';
    elsif tg_op = 'UPDATE' and new.closed is distinct from old.closed
       and new.status is not distinct from old.status then
      new.status := case when new.closed then 'done' else 'pending' end;
    else
      new.closed := new.status = 'done';
    end if;
  end if;
  return new;
end;
$$;
