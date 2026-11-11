-- cofounder — Grupos: hasta 3 grupos por persona (2026-11-11).
--
-- Hasta hoy una persona estaba como mucho en UN grupo. Desde aquí:
--
--   * Una persona está como mucho en 3 grupos (`group_max_memberships()`).
--   * Una persona administra como mucho UN grupo (`groups_admin_key`, único):
--     crear exige no administrar ya otro (LG006). Las funciones de admin
--     (`update_group`, `swipe_group_candidate`, `kick_group_member`,
--     `group_recruit_deck`) siguen buscando «el grupo cuyo admin soy yo».
--   * Quien administra un grupo también busca otros: el deck de grupos ya no se
--     vacía por estar en uno, solo al llegar al tope; y no enseña los grupos en
--     los que ya estás.
--   * Liderazgo: si el admin sale, pasa a serlo el miembro más antiguo que no
--     administre ya otro grupo. Si no queda nadie así, el grupo se disuelve
--     (como cuando se queda vacío).
--   * `leave_group` recibe el grupo: ya no hay uno solo del que salir.
--
-- Códigos: LG002 pasa a ser «has llegado al tope de grupos»; LG006 (nuevo) es
-- «ya administras un grupo»; LG003 cubre también «ya estás en ese grupo».


-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

alter table public.group_members drop constraint group_members_one_group_per_user;
create index group_members_user_idx on public.group_members (user_id);

drop index public.groups_admin_idx;
create unique index groups_admin_key on public.groups (admin_id);

-- El tope de grupos por persona. Repetido en `GROUP_MAX_MEMBERSHIPS`
-- (`src/data/groups.ts`): si cambia uno, cambian los dos.
create function public.group_max_memberships()
returns integer
language sql
immutable
set search_path = ''
as $fn$
  select 3;
$fn$;

revoke execute on function public.group_max_memberships() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Unión y salida
-- ---------------------------------------------------------------------------

-- Última definición: 20261109130000_groups.sql. Cambio: en vez de «no tiene
-- grupo», que no esté ya en ESTE grupo y que no haya llegado al tope.
create or replace function public.join_group_if_possible(p_group_id uuid, p_user_id uuid, p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_max smallint;
  v_role uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('group_member:' || p_user_id::text, 0));

  if exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = p_user_id
  ) or (
    select count(*) from public.group_members m where m.user_id = p_user_id
  ) >= public.group_max_memberships() then
    return false;
  end if;

  select g.max_members into v_max from public.groups g where g.id = p_group_id;
  if v_max is null
     or (select count(*) from public.group_members m where m.group_id = p_group_id) >= v_max then
    return false;
  end if;

  if public.group_has_block_with(p_group_id, p_user_id) then
    return false;
  end if;

  select r.id into v_role
    from public.group_roles r
   where r.group_id = p_group_id and r.id = p_role_id and r.filled < r.slots;

  if v_role is null then
    select r.id into v_role
      from public.group_roles r
      join public.profiles p on p.id = p_user_id
     where r.group_id = p_group_id
       and r.filled < r.slots
       and r.specialty = any(p.specialties)
     order by r.specialty, r.id
     limit 1;
  end if;

  if v_role is null then
    return false;
  end if;

  insert into public.group_members (group_id, user_id, role_id)
  values (p_group_id, p_user_id, v_role);
  update public.group_roles set filled = filled + 1 where id = v_role;
  update public.groups set updated_at = clock_timestamp() where id = p_group_id;

  return true;
end;
$fn$;

revoke execute on function public.join_group_if_possible(uuid, uuid, uuid) from public, anon, authenticated;

-- Última definición: 20261109130000_groups.sql. Cambio: el sucesor es el
-- miembro más antiguo que no administra ya otro grupo; sin nadie así, el grupo
-- se disuelve. Cada candidato se mira con su cerrojo por persona tomado (el
-- mismo de `create_group` y `join_group_if_possible`): dos admins que salen a
-- la vez de grupos distintos no pueden elegir a la misma persona.
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
     set decision = 'pass'
   where group_id = p_group_id and user_id = p_user_id;

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

revoke execute on function public.remove_group_member(uuid, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Crear grupo
-- ---------------------------------------------------------------------------

-- Última definición: 20261109130000_groups.sql. Cambio: en vez de «no tiene
-- grupo», que no administre ya uno (LG006) ni esté en el tope (LG002).
create or replace function public.create_group(
  p_name text,
  p_description text,
  p_roles jsonb,
  p_max_members integer default 6
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
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

revoke execute on function public.create_group(text, text, jsonb, integer) from public, anon;
grant execute on function public.create_group(text, text, jsonb, integer) to authenticated;


-- ---------------------------------------------------------------------------
-- Swipe de quien busca grupo
-- ---------------------------------------------------------------------------

-- Última definición: 20261109130000_groups.sql. Cambio: en vez de «no tiene
-- grupo», que no esté en el tope (LG002) ni ya dentro de ese grupo (LG003).
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

  insert into public.group_swipes (group_id, user_id, direction, decision, actor_id)
  values (p_group_id, v_uid, 'user_to_group', p_decision, v_uid)
  on conflict (group_id, user_id, direction)
  do update set decision = excluded.decision, actor_id = excluded.actor_id, created_at = now();

  if p_decision <> 'like' then
    return false;
  end if;

  select s.role_id into v_role
    from public.group_swipes s
   where s.group_id = p_group_id and s.user_id = v_uid
     and s.direction = 'group_to_user' and s.decision = 'like';
  if not found then
    return false;
  end if;

  return public.join_group_if_possible(p_group_id, v_uid, v_role);
end;
$fn$;

revoke execute on function public.swipe_group(uuid, public.decision) from public, anon;
grant execute on function public.swipe_group(uuid, public.decision) to authenticated;


-- ---------------------------------------------------------------------------
-- Salir: ahora de un grupo concreto
-- ---------------------------------------------------------------------------

drop function public.leave_group();

create function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;

  perform 1 from public.groups g where g.id = p_group_id for update;
  if not found or not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = v_uid
  ) then
    raise exception 'leave_group: no estás en ese grupo' using errcode = 'LG003';
  end if;

  perform public.remove_group_member(p_group_id, v_uid);
end;
$fn$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Cuenta borrada: sale de todos sus grupos
-- ---------------------------------------------------------------------------

-- Última definición: 20261109130000_groups.sql. Cambio: recorre todos sus
-- grupos, en orden de id para que dos borrados a la vez no se crucen.
create or replace function public.leave_groups_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_group uuid;
begin
  for v_group in
    select m.group_id from public.group_members m where m.user_id = old.id order by m.group_id
  loop
    perform 1 from public.groups g where g.id = v_group for update;
    perform public.remove_group_member(v_group, old.id);
  end loop;
  return old;
end;
$fn$;

revoke execute on function public.leave_groups_before_profile_delete() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Decks
-- ---------------------------------------------------------------------------

-- Última definición: 20261109130000_groups.sql. Cambio: vacío solo en el tope
-- de grupos (no por estar en uno), y sin los grupos en los que ya estás.
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

  select coalesce(jsonb_agg(c.card order by c.liked_me desc, c.id), '[]'::jsonb) into v_cards
  from (
    select
      g.id,
      exists (
        select 1 from public.group_swipes s
        where s.group_id = g.id and s.user_id = v_uid
          and s.direction = 'group_to_user' and s.decision = 'like'
      ) as liked_me,
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
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
      and not exists (
        select 1 from public.group_swipes s
        where s.group_id = g.id and s.user_id = v_uid
          and (s.direction = 'user_to_group'
               or (s.direction = 'group_to_user' and s.decision = 'pass'))
      )
    order by liked_me desc, g.id
    limit greatest(coalesce(p_limit, 30), 1)
  ) c;

  return v_cards;
end;
$fn$;

revoke execute on function public.group_deck(integer) from public, anon;
grant execute on function public.group_deck(integer) to authenticated;

-- Última definición: 20261109130000_groups.sql. Cambio: en vez de «personas sin
-- grupo», personas que no están ya en este grupo ni en el tope de grupos.
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

  select coalesce(jsonb_agg(c.card order by c.liked_us desc, c.id), '[]'::jsonb) into v_cards
  from (
    select
      p.id,
      exists (
        select 1 from public.group_swipes s
        where s.group_id = v_group.id and s.user_id = p.id
          and s.direction = 'user_to_group' and s.decision = 'like'
      ) as liked_us,
      jsonb_build_object('role_id', pick.id, 'profile', to_jsonb(p)) as card
    from public.profiles p
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
      and not exists (
        select 1 from public.group_swipes s
        where s.group_id = v_group.id and s.user_id = p.id
          and (s.direction = 'group_to_user'
               or (s.direction = 'user_to_group' and s.decision = 'pass'))
      )
    order by liked_us desc, p.id
    limit greatest(coalesce(p_limit, 30), 1)
  ) c;

  return v_cards;
end;
$fn$;

revoke execute on function public.group_recruit_deck(integer) from public, anon;
grant execute on function public.group_recruit_deck(integer) to authenticated;
