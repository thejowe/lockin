-- Only an explicit pass may expire. Leaving or being removed also clears both
-- likes, and blocking a group must survive a change of admin.
alter table public.group_swipes add column dismissal text
  check (dismissal in ('block', 'membership'));

-- Legacy block_group recorded a pass and a profile block in one transaction.
-- A retried block_group refreshed the pass timestamp but kept the original
-- block, so a pass toward a group whose current admin this person blocked is
-- also treated as a permanent block (conservative: it never expires).
update public.group_swipes s set dismissal = 'block'
where s.direction = 'user_to_group' and s.decision = 'pass'
  and (
    exists (select 1 from public.user_blocks b
            where b.blocker_id = s.user_id and b.created_at = s.created_at)
    or exists (select 1 from public.user_blocks b join public.groups g on g.id = s.group_id
               where b.blocker_id = s.user_id and b.blocked_id = g.admin_id)
  );

-- remove_group_member changed BOTH likes to passes without updating their
-- timestamps. Push history is short-lived. If it has been pruned, preserve
-- the former exclusion for a historical pair of passes in opposing directions.
-- This also preserves the rare pair of genuine passes sent simultaneously by
-- two old clients. Future swipe, leave and block operations record their origin.
update public.group_swipes s set dismissal = 'membership'
where s.decision = 'pass' and s.dismissal is null and (
  exists (select 1 from public.push_group_events e where e.group_id = s.group_id
          and e.subject_id = s.user_id and e.kind in ('joined','kicked') and e.created_at >= s.created_at)
  or exists (select 1 from public.group_swipes peer where peer.group_id = s.group_id
             and peer.user_id = s.user_id and peer.direction <> s.direction and peer.decision = 'pass')
) and not exists (
  select 1 from public.group_members m where m.group_id = s.group_id and m.user_id = s.user_id
);


create or replace function public.group_has_block_with(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.group_swipes s where s.group_id = p_group_id and s.user_id = p_user_id
      and s.direction = 'user_to_group' and s.dismissal = 'block'
  ) or exists (
    select 1 from auth.users account
    where account.id in (select p_user_id union all
                         select m.user_id from public.group_members m where m.group_id = p_group_id)
      and (account.deleted_at is not null or account.banned_until > now()
           or exists (select 1 from public.blocked_account_emails e
                      where e.email_hash = public.email_block_hash(account.email)))
  ) or exists (
    select 1
    from public.group_members m
    join public.user_blocks b
      on (b.blocker_id = m.user_id and b.blocked_id = p_user_id)
      or (b.blocked_id = m.user_id and b.blocker_id = p_user_id)
    where m.group_id = p_group_id
  );
$fn$;

create or replace function public.block_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin uuid;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  select g.admin_id into v_admin from public.groups g where g.id = p_group_id for update;
  if not found then
    raise exception 'El grupo no está disponible.' using errcode = 'LG003';
  end if;
  if exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = v_actor
  ) then
    raise exception 'block_group: sal del grupo antes de bloquearlo' using errcode = 'LG001';
  end if;

  insert into public.group_swipes (group_id, user_id, direction, decision, actor_id, dismissal)
  values (p_group_id, v_actor, 'user_to_group', 'pass', v_actor, 'block')
  on conflict (group_id, user_id, direction)
  do update set decision = 'pass', dismissal = 'block', actor_id = excluded.actor_id, created_at = now();

  perform public.block_profile(v_admin);
end;
$fn$;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_role uuid;
  v_admin uuid;
  v_next uuid;
  v_candidate uuid;
begin
  delete from public.group_members
   where group_id = p_group_id and user_id = p_user_id
  returning role_id into v_role;

  if not found then
    return;
  end if;

  if v_role is not null then
    update public.group_roles set filled = greatest(filled - 1, 0) where id = v_role;
  end if;

  update public.group_swipes
     set decision = 'pass', dismissal = 'membership'
   where group_id = p_group_id and user_id = p_user_id;
  -- The founding admin joined without a swipe: record the departure too, so
  -- the group never comes back to their deck after someone inherits it.
  insert into public.group_swipes (group_id, user_id, direction, decision, actor_id, dismissal)
  values (p_group_id, p_user_id, 'user_to_group', 'pass', p_user_id, 'membership')
  on conflict (group_id, user_id, direction) do nothing;

  select g.admin_id into v_admin from public.groups g where g.id = p_group_id;

  if v_admin = p_user_id then
    for v_candidate in
      select m.user_id
        from public.group_members m
       where m.group_id = p_group_id
       order by m.joined_at, m.user_id
    loop
      perform pg_advisory_xact_lock(hashtextextended('group_member:' || v_candidate::text, 0));
      if not exists (
        select 1 from public.groups other
        where other.admin_id = v_candidate and other.id <> p_group_id
      ) then
        v_next := v_candidate;
        exit;
      end if;
    end loop;

    if v_next is null then
      delete from public.groups where id = p_group_id;
      return;
    end if;

    update public.groups set admin_id = v_next where id = p_group_id;
  end if;

  update public.groups set updated_at = clock_timestamp() where id = p_group_id;
end;
$fn$;

-- A single lookup of each direction ranks an unseen card (NULL timestamp) or
-- an eligible pass. An empty result vetoes the card before sorting and limiting.
create function public.group_deck_swipe_rank(
  p_group_id uuid, p_user_id uuid, p_direction public.group_swipe_direction
) returns table (passed_at timestamptz, liked boolean)
language sql stable security invoker set search_path = '' as $fn$
  select mine.created_at, coalesce(peer.decision = 'like', false)
  from (values (1)) anchor(n)
  left join public.group_swipes mine on mine.group_id = p_group_id and mine.user_id = p_user_id
    and mine.direction = p_direction
  left join public.group_swipes peer on peer.group_id = p_group_id and peer.user_id = p_user_id
    and peer.direction <> p_direction
  where mine.dismissal is null and peer.dismissal is null
    and (mine.user_id is null or
         (mine.decision = 'pass' and mine.created_at <= now() - public.pass_cooldown()))
    and (peer.user_id is null or peer.decision = 'like'
         or peer.created_at <= now() - public.pass_cooldown());
$fn$;
revoke all on function public.group_deck_swipe_rank(uuid,uuid,public.group_swipe_direction)
  from public, anon, authenticated;

create or replace function public.swipe_group(p_group_id uuid, p_decision public.decision)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_role uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'swipe_group: necesitas un perfil' using errcode = '23503';
  end if;
  if (select count(*) from public.group_members m where m.user_id = v_uid)
     >= public.group_max_memberships() then
    raise exception 'swipe_group: ya estás en el máximo de grupos' using errcode = 'LG002';
  end if;

  perform 1 from public.groups g where g.id = p_group_id for update;
  -- Un grupo con alguien bloqueado de por medio no existe para ti; el tuyo, tampoco.
  if not found
     or public.group_has_block_with(p_group_id, v_uid)
     or exists (
       select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = v_uid
     ) then
    raise exception 'swipe_group: el grupo no está disponible' using errcode = 'LG003';
  end if;

  insert into public.group_swipes as previous (group_id, user_id, direction, decision, actor_id)
  values (p_group_id, v_uid, 'user_to_group', p_decision, v_uid)
  on conflict (group_id, user_id, direction)
  do update set decision = excluded.decision, actor_id = excluded.actor_id, created_at = now(), dismissal = null
  where previous.decision = 'pass' and previous.dismissal is null
    and (excluded.decision = 'like' or previous.created_at <= now() - public.pass_cooldown());

  -- Join only on two persisted, active likes: the guarded upsert above may have
  -- left a dismissed or still-cooling pass in place.
  if p_decision <> 'like' or not exists (
    select 1 from public.group_swipes s
    where s.group_id = p_group_id and s.user_id = v_uid and s.direction = 'user_to_group'
      and s.decision = 'like' and s.dismissal is null
  ) then
    return false;
  end if;

  select s.role_id into v_role
    from public.group_swipes s
   where s.group_id = p_group_id and s.user_id = v_uid
     and s.direction = 'group_to_user' and s.decision = 'like' and s.dismissal is null;
  if not found then
    return false;
  end if;

  return public.join_group_if_possible(p_group_id, v_uid, v_role);
end;
$fn$;

create or replace function public.swipe_group_candidate(
  p_user_id uuid,
  p_role_id uuid,
  p_decision public.decision
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  select g.id into v_group from public.groups g where g.admin_id = v_uid for update;
  if v_group is null then
    raise exception 'swipe_group_candidate: no administras ningún grupo' using errcode = 'LG004';
  end if;
  if not exists (
    select 1 from public.group_roles r where r.id = p_role_id and r.group_id = v_group
  ) then
    raise exception 'swipe_group_candidate: ese puesto no es de tu grupo' using errcode = 'LG001';
  end if;
  if p_user_id = v_uid
     or not exists (select 1 from public.profiles p where p.id = p_user_id)
     or public.group_has_block_with(v_group, p_user_id) then
    raise exception 'swipe_group_candidate: esa persona no está disponible' using errcode = 'LG005';
  end if;

  insert into public.group_swipes as previous (group_id, user_id, direction, decision, role_id, actor_id)
  values (v_group, p_user_id, 'group_to_user', p_decision, p_role_id, v_uid)
  on conflict (group_id, user_id, direction)
  do update set decision = excluded.decision, role_id = excluded.role_id,
                actor_id = excluded.actor_id, created_at = now(), dismissal = null
  where previous.decision = 'pass' and previous.dismissal is null
    and (excluded.decision = 'like' or previous.created_at <= now() - public.pass_cooldown());

  -- Join only on two persisted, active likes (see swipe_group).
  if p_decision <> 'like' or not exists (
    select 1 from public.group_swipes s
    where s.group_id = v_group and s.user_id = p_user_id and s.direction = 'group_to_user'
      and s.decision = 'like' and s.role_id = p_role_id and s.dismissal is null
  ) or not exists (
    select 1 from public.group_swipes s
    where s.group_id = v_group and s.user_id = p_user_id
      and s.direction = 'user_to_group' and s.decision = 'like' and s.dismissal is null
  ) then
    return false;
  end if;

  return public.join_group_if_possible(v_group, p_user_id, p_role_id);
end;
$fn$;

create or replace function public.group_deck(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_specialties public.specialty[];
  v_cards jsonb;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  select p.specialties into v_specialties from public.profiles p where p.id = v_uid;
  if v_specialties is null
     or (select count(*) from public.group_members m where m.user_id = v_uid)
        >= public.group_max_memberships() then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(c.card order by c.passed_at nulls first, c.liked desc, c.id), '[]'::jsonb) into v_cards
  from (
    select
      g.id,
      swipe.passed_at, swipe.liked,
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'project_id', g.project_id,
        'admin_id', g.admin_id,
        'max_members', g.max_members,
        'created_at', g.created_at,
        'my_role_id', pick.id,
        'roles', (
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id, 'group_id', r.group_id, 'specialty', r.specialty,
              'slots', r.slots, 'filled', r.filled
            ) order by r.specialty, r.id
          )
          from public.group_roles r where r.group_id = g.id
        ),
        'members', (
          select jsonb_agg(
            jsonb_build_object(
              'group_id', m.group_id, 'user_id', m.user_id,
              'role_id', m.role_id, 'joined_at', m.joined_at
            ) order by m.joined_at, m.user_id
          )
          from public.group_members m where m.group_id = g.id
        )
      ) as card
    from public.groups g
    cross join lateral public.group_deck_swipe_rank(g.id, v_uid, 'user_to_group') swipe
    cross join lateral (
      select r.id
      from public.group_roles r
      where r.group_id = g.id and r.filled < r.slots and r.specialty = any(v_specialties)
      order by r.specialty, r.id
      limit 1
    ) pick
    where (select count(*) from public.group_members m where m.group_id = g.id) < g.max_members
      and not exists (
        select 1 from public.group_members m where m.group_id = g.id and m.user_id = v_uid
      )
      and not public.group_has_block_with(g.id, v_uid)
    order by swipe.passed_at nulls first, swipe.liked desc, g.id
    limit greatest(coalesce(p_limit, 30), 1)
  ) c;

  return v_cards;
end;
$fn$;

create or replace function public.group_recruit_deck(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_group public.groups;
  v_cards jsonb;
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  select g.* into v_group from public.groups g where g.admin_id = v_uid;
  if v_group.id is null then
    raise exception 'group_recruit_deck: no administras ningún grupo' using errcode = 'LG004';
  end if;
  if (select count(*) from public.group_members m where m.group_id = v_group.id) >= v_group.max_members then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(c.card order by c.passed_at nulls first, c.liked desc, c.id), '[]'::jsonb) into v_cards
  from (
    select
      p.id,
      swipe.passed_at, swipe.liked,
      jsonb_build_object('role_id', pick.id, 'profile', to_jsonb(p)) as card
    from public.profiles p
    cross join lateral public.group_deck_swipe_rank(v_group.id, p.id, 'group_to_user') swipe
    cross join lateral (
      select r.id
      from public.group_roles r
      where r.group_id = v_group.id and r.filled < r.slots and r.specialty = any(p.specialties)
      order by r.specialty, r.id
      limit 1
    ) pick
    where p.id <> v_uid
      and p.looking_for <> 'lockin'
      and not exists (
        select 1 from public.group_members m where m.group_id = v_group.id and m.user_id = p.id
      )
      and (select count(*) from public.group_members m where m.user_id = p.id)
          < public.group_max_memberships()
      and not public.group_has_block_with(v_group.id, p.id)
    order by swipe.passed_at nulls first, swipe.liked desc, p.id
    limit greatest(coalesce(p_limit, 30), 1)
  ) c;

  return v_cards;
end;
$fn$;

-- Authorship still grants member reads. Add a separate read policy for
-- eligible seekers only. Match workspaces, notes and personal profile lists
-- keep their existing visibility, and Storage rechecks this policy on download.
create function project_private.group_project_discoverable(p_project uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (
    select 1 from public.groups g
    join public.profiles viewer on viewer.id=(select auth.uid())
    where g.project_id=p_project
      and (select count(*) from public.group_members m where m.user_id=viewer.id)
          < public.group_max_memberships()
      and (select count(*) from public.group_members m where m.group_id=g.id) < g.max_members
      and exists (select 1 from public.group_roles r where r.group_id=g.id
                  and r.filled<r.slots and r.specialty=any(viewer.specialties))
      and not public.group_has_block_with(g.id, viewer.id)
      and exists (select 1 from public.group_deck_swipe_rank(g.id, viewer.id, 'user_to_group'))
  );
end;
$$;
revoke all on function project_private.group_project_discoverable(uuid) from public, anon;
grant execute on function project_private.group_project_discoverable(uuid) to authenticated;
create policy group_projects_in_discovery on public.profile_projects for select to authenticated
using (joint and not published and project_private.group_project_discoverable(id));
