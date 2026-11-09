-- cofounder — Grupos (2026-11-09).
--
-- Un grupo es un equipo en formación: una persona lo crea (admin y primer
-- miembro), declara qué puestos busca y cuántas plazas tiene cada uno, y
-- recluta con un deck propio. Quien busca grupo ve los grupos con un puesto
-- abierto que encaja con lo que domina. Like en los dos sentidos = la persona
-- entra en el grupo, en ese puesto, y con ello en su chat.
--
-- Reglas que impone la base (no el cliente):
--
--   * Una persona pertenece como mucho a UN grupo (`group_members.user_id` es
--     único). Seguir usando el deck de Cofundador no depende de esto.
--   * Un grupo tiene como mucho 6 miembros (admin incluido): la suma de plazas
--     de sus puestos más el admin no puede pasar de `max_members`.
--   * La unión ocurre dentro de `join_group_if_possible`, con la fila del grupo
--     bloqueada (`for update`) y un cerrojo por persona: dos likes simultáneos
--     no pueden llenar la misma plaza dos veces ni meter a alguien en dos grupos.
--   * Si el admin sale o borra su cuenta, pasa a serlo el miembro más antiguo
--     (`joined_at`); si no queda nadie, el grupo se borra.
--
-- Quién ve qué:
--
--   * `groups`, `group_roles`, `group_members`, `group_messages`: solo los
--     miembros (RLS). Sin escritura directa salvo enviar mensajes.
--   * `group_swipes`: nadie. Solo la tocan las funciones.
--   * El deck público (`group_deck`) devuelve lo justo: nombre, descripción,
--     puestos y quién está dentro (ids; el perfil público se lee de `profiles`,
--     con su propia RLS de bloqueos).
--
-- Códigos propios nuevos: LG001 (datos no válidos), LG002 (ya estás en un
-- grupo), LG003 (el grupo no existe o no estás en él), LG004 (solo el admin),
-- LG005 (esa persona no está disponible).


-- ---------------------------------------------------------------------------
-- Interruptor: ¿crear un grupo exige Premium?
-- ---------------------------------------------------------------------------
--
-- Hoy es gratis. Para cobrarlo basta con que esta función devuelva `true` (y
-- cambiar `GROUP_CREATION_REQUIRES_PREMIUM` en `src/data/groups.ts`, que es lo
-- que hace que la app abra el paywall en vez de chocar con LQ005).

create function public.group_creation_requires_premium()
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select false;
$fn$;

revoke execute on function public.group_creation_requires_premium() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- El proyecto: qué se quiere construir.
  description text not null,
  -- `on delete cascade` es solo la red de seguridad: el trigger
  -- `profiles_leave_groups` reasigna el liderazgo (o borra el grupo) ANTES de
  -- que el perfil caiga, así que esta cascada no llega a dispararse.
  admin_id uuid not null references public.profiles (id) on delete cascade,
  max_members smallint not null default 6,
  created_at timestamptz not null default now(),
  -- Lo tocan las funciones en cada cambio de miembros: es lo que Realtime avisa.
  updated_at timestamptz not null default now(),
  constraint groups_name_check check (char_length(btrim(name)) between 2 and 60),
  constraint groups_description_check check (char_length(btrim(description)) between 10 and 500),
  constraint groups_max_members_check check (max_members between 2 and 6)
);

create index groups_admin_idx on public.groups (admin_id);

comment on table public.groups is
  'Equipo en formación. Solo lo leen sus miembros; el deck público sale de group_deck().';

create table public.group_roles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  specialty public.specialty not null,
  -- Plazas de este puesto y cuántas están ocupadas.
  slots smallint not null,
  filled smallint not null default 0,
  constraint group_roles_slots_check check (slots between 1 and 5),
  constraint group_roles_filled_check check (filled between 0 and slots),
  constraint group_roles_group_specialty_key unique (group_id, specialty)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- El puesto que ocupa. Nulo en quien creó el grupo: no ocupa ninguna plaza.
  role_id uuid references public.group_roles (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  -- Un grupo por persona.
  constraint group_members_one_group_per_user unique (user_id)
);

create type public.group_swipe_direction as enum ('user_to_group', 'group_to_user');

create table public.group_swipes (
  group_id uuid not null references public.groups (id) on delete cascade,
  -- La persona candidata, en los dos sentidos.
  user_id uuid not null references public.profiles (id) on delete cascade,
  direction public.group_swipe_direction not null,
  decision public.decision not null,
  -- En `group_to_user`, el puesto que cubriría. Nulo en `user_to_group`.
  role_id uuid references public.group_roles (id) on delete set null,
  -- Quién deslizó: la propia persona o el admin de entonces. El like del grupo
  -- es del grupo y sobrevive a un cambio de admin.
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, direction)
);

create index group_swipes_user_idx on public.group_swipes (user_id, direction);

comment on table public.group_swipes is
  'Likes y pases entre personas y grupos. Sin políticas: solo las funciones SECURITY DEFINER.';

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (btrim(body) <> '' and char_length(body) <= 4000),
  sent_at timestamptz not null default now()
);

create index group_messages_group_sent_at_idx on public.group_messages (group_id, sent_at, id);

comment on table public.group_messages is
  'Chat del grupo: un hilo por grupo, visible solo para sus miembros.';


-- ---------------------------------------------------------------------------
-- Pertenencia — helper de las políticas
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER para que la política de `group_members` no se llame a sí
-- misma, y PL/pgSQL por lo mismo que `has_profile_block` (la caché de planes sí
-- se invalida al cambiar `auth.uid()`).

create function public.is_group_member(p_group_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_member boolean;
begin
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  ) into v_member;
  return v_member;
end;
$fn$;

revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- ¿Hay un bloqueo, en cualquier sentido, entre esta persona y algún miembro
-- del grupo? Interna: mira bloqueos de terceros, así que no se concede a nadie.
create function public.group_has_block_with(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.group_members m
    join public.user_blocks b
      on (b.blocker_id = m.user_id and b.blocked_id = p_user_id)
      or (b.blocked_id = m.user_id and b.blocker_id = p_user_id)
    where m.group_id = p_group_id
  );
$fn$;

revoke execute on function public.group_has_block_with(uuid, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_roles enable row level security;
alter table public.group_members enable row level security;
alter table public.group_swipes enable row level security;
alter table public.group_messages enable row level security;

-- `revoke all` y no solo las escrituras: si no, queda TRUNCATE.
revoke all on table public.groups from public, anon, authenticated;
revoke all on table public.group_roles from public, anon, authenticated;
revoke all on table public.group_members from public, anon, authenticated;
revoke all on table public.group_swipes from public, anon, authenticated;
revoke all on table public.group_messages from public, anon, authenticated;

grant select on table public.groups to authenticated;
grant select on table public.group_roles to authenticated;
grant select on table public.group_members to authenticated;
grant select on table public.group_messages to authenticated;
-- `sent_at` lo pone la base, como en `messages`.
grant insert (id, group_id, sender_id, body) on table public.group_messages to authenticated;

create policy "groups: lees el grupo en el que estás"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "group_roles: lees los puestos de tu grupo"
  on public.group_roles for select to authenticated
  using (public.is_group_member(group_id));

create policy "group_members: lees a los miembros de tu grupo"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

-- Un bloqueo esconde los mensajes de esa persona también dentro del grupo.
create policy "group_messages: lees los de tu grupo"
  on public.group_messages for select to authenticated
  using (
    public.is_group_member(group_id)
    and (sender_id = (select auth.uid()) or not public.has_profile_block(sender_id))
  );

create policy "group_messages: escribes en tu nombre en tu grupo"
  on public.group_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_group_member(group_id)
  );


-- ---------------------------------------------------------------------------
-- Unión y salida — las dos piezas internas
-- ---------------------------------------------------------------------------

-- Mete a `p_user_id` en el grupo si se puede. Quien llama YA tiene bloqueada la
-- fila del grupo. Devuelve si entró.
--
-- Orden: cerrojo por persona (dos grupos no pueden aceptarla a la vez) y, con
-- los dos cerrojos tomados, las comprobaciones: que no tenga grupo, que el
-- grupo no esté lleno, que no haya un bloqueo con nadie de dentro y que quede
-- una plaza. El puesto preferido es el que eligió el admin; si se llenó
-- entretanto, vale cualquier otro abierto que encaje con lo que la persona
-- domina. `unique (user_id)` queda como última red.
create function public.join_group_if_possible(p_group_id uuid, p_user_id uuid, p_role_id uuid)
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

  if exists (select 1 from public.group_members m where m.user_id = p_user_id) then
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

-- Saca a `p_user_id` del grupo: libera su plaza, apaga sus likes con ese grupo
-- (no vuelve a entrar solo) y aplica la regla de liderazgo. Quien llama YA
-- tiene bloqueada la fila del grupo.
create function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_role uuid;
  v_admin uuid;
  v_next uuid;
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
    select m.user_id into v_next
      from public.group_members m
     where m.group_id = p_group_id
     order by m.joined_at, m.user_id
     limit 1;

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
--
-- `p_roles` es un array json: `[{"specialty": "dev", "slots": 2}, …]`.

create function public.create_group(
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
  if exists (select 1 from public.group_members m where m.user_id = v_uid) then
    raise exception 'create_group: ya estás en un grupo' using errcode = 'LG002';
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
-- Swipes
-- ---------------------------------------------------------------------------

-- Quien busca grupo decide sobre un grupo. Devuelve `true` si con este like ha
-- entrado (el grupo ya le había dado like).
create function public.swipe_group(p_group_id uuid, p_decision public.decision)
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
  if exists (select 1 from public.group_members m where m.user_id = v_uid) then
    raise exception 'swipe_group: ya estás en un grupo' using errcode = 'LG002';
  end if;

  perform 1 from public.groups g where g.id = p_group_id for update;
  -- Un grupo con alguien bloqueado de por medio no existe para ti.
  if not found or public.group_has_block_with(p_group_id, v_uid) then
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

-- El admin decide sobre una persona, para un puesto concreto de su grupo.
-- Devuelve `true` si con este like la persona ha entrado.
create function public.swipe_group_candidate(
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

  insert into public.group_swipes (group_id, user_id, direction, decision, role_id, actor_id)
  values (v_group, p_user_id, 'group_to_user', p_decision, p_role_id, v_uid)
  on conflict (group_id, user_id, direction)
  do update set decision = excluded.decision, role_id = excluded.role_id,
                actor_id = excluded.actor_id, created_at = now();

  if p_decision <> 'like' or not exists (
    select 1 from public.group_swipes s
    where s.group_id = v_group and s.user_id = p_user_id
      and s.direction = 'user_to_group' and s.decision = 'like'
  ) then
    return false;
  end if;

  return public.join_group_if_possible(v_group, p_user_id, p_role_id);
end;
$fn$;

revoke execute on function public.swipe_group_candidate(uuid, uuid, public.decision) from public, anon;
grant execute on function public.swipe_group_candidate(uuid, uuid, public.decision) to authenticated;


-- ---------------------------------------------------------------------------
-- Salir y expulsar
-- ---------------------------------------------------------------------------

create function public.leave_group()
returns void
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

  select m.group_id into v_group from public.group_members m where m.user_id = v_uid;
  if v_group is null then
    raise exception 'leave_group: no estás en ningún grupo' using errcode = 'LG003';
  end if;

  perform 1 from public.groups g where g.id = v_group for update;
  perform public.remove_group_member(v_group, v_uid);
end;
$fn$;

revoke execute on function public.leave_group() from public, anon;
grant execute on function public.leave_group() to authenticated;

create function public.kick_group_member(p_user_id uuid)
returns void
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
    raise exception 'kick_group_member: no administras ningún grupo' using errcode = 'LG004';
  end if;
  if p_user_id = v_uid then
    raise exception 'kick_group_member: para irte tú, sal del grupo' using errcode = 'LG001';
  end if;
  if not exists (
    select 1 from public.group_members m where m.group_id = v_group and m.user_id = p_user_id
  ) then
    raise exception 'kick_group_member: esa persona no está en tu grupo' using errcode = 'LG005';
  end if;

  perform public.remove_group_member(v_group, p_user_id);
end;
$fn$;

revoke execute on function public.kick_group_member(uuid) from public, anon;
grant execute on function public.kick_group_member(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Cuenta borrada: sale de su grupo con la regla de liderazgo
-- ---------------------------------------------------------------------------
--
-- En un trigger BEFORE DELETE de `profiles`, como el de las salas
-- (20261010000100): cubre `delete_my_account()` y la cascada desde
-- `auth.users`. Sus swipes como candidata caen por `on delete cascade`; los que
-- hizo como admin son del grupo y se quedan, con `actor_id` nulo.

create function public.leave_groups_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_group uuid;
begin
  select m.group_id into v_group from public.group_members m where m.user_id = old.id;
  if v_group is not null then
    perform 1 from public.groups g where g.id = v_group for update;
    perform public.remove_group_member(v_group, old.id);
  end if;
  return old;
end;
$fn$;

revoke execute on function public.leave_groups_before_profile_delete() from public, anon, authenticated;

create trigger profiles_leave_groups
  before delete on public.profiles
  for each row execute function public.leave_groups_before_profile_delete();


-- ---------------------------------------------------------------------------
-- Decks
-- ---------------------------------------------------------------------------

-- Deck de quien busca grupo: grupos no llenos con un puesto abierto que encaja
-- con lo que domina, sin decidir todavía, sin bloqueos con nadie de dentro y
-- que no le hayan dado ya un pase. Vacío si ya está en un grupo. Primero los
-- que ya le dieron like (no se dice cuáles), después por id.
--
-- Cada carta: el grupo, sus puestos, sus miembros (id y puesto) y el puesto que
-- cubriría quien mira (`my_role_id`).
create function public.group_deck(p_limit integer default 30)
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
     or exists (select 1 from public.group_members m where m.user_id = v_uid) then
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

-- Deck del admin: personas sin grupo que dominan algo de un puesto con plazas
-- libres, sin decidir todavía, sin bloqueos con nadie de dentro y que no hayan
-- pasado ya del grupo. Vacío si el grupo está lleno. Cada carta lleva el puesto
-- que cubriría: el primero abierto que encaja. Cuando un puesto se llena, quien
-- solo encajaba en él deja de salir.
create function public.group_recruit_deck(p_limit integer default 30)
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
      and not exists (select 1 from public.group_members m where m.user_id = p.id)
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


-- ---------------------------------------------------------------------------
-- Denunciar y bloquear — sobre `user_reports` y `user_blocks`, que ya existen
-- ---------------------------------------------------------------------------
--
-- Un reporte de grupo es un reporte a su admin con la referencia del grupo:
-- `group_id` vivo mientras el grupo exista, y la instantánea (`group_ref`,
-- `group_name`) por si se borra. Misma retención de 12 meses.

alter table public.user_reports
  add column group_id uuid references public.groups (id) on delete set null;
alter table public.user_reports add column group_ref text;
alter table public.user_reports
  add column group_name text check (group_name is null or char_length(group_name) <= 60);

create function public.report_group(p_group_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin uuid;
  v_name text;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('acoso', 'contenido-inapropiado', 'spam', 'suplantacion', 'otro') then
    raise exception 'Elige un motivo válido.' using errcode = 'LI009';
  end if;
  if char_length(p_details) > 500 then
    raise exception 'El texto no puede superar 500 caracteres.' using errcode = '23514';
  end if;

  select g.admin_id, g.name into v_admin, v_name from public.groups g where g.id = p_group_id;
  if not found then
    raise exception 'El grupo no está disponible.' using errcode = 'LG003';
  end if;
  if v_admin = v_actor then
    raise exception 'No puedes reportar tu propio grupo.' using errcode = 'LI008';
  end if;

  insert into public.user_reports
    (reporter_id, reported_id, reporter_ref, reported_ref, reason, details,
     group_id, group_ref, group_name)
  values
    (v_actor, v_admin, v_actor::text, v_admin::text, p_reason, nullif(btrim(p_details), ''),
     p_group_id, p_group_id::text, v_name);
end;
$fn$;

revoke execute on function public.report_group(uuid, text, text) from public, anon;
grant execute on function public.report_group(uuid, text, text) to authenticated;

-- Reportar un mensaje del chat de grupo: como `report_message`, con el autor
-- como reportado y el fragmento guardado. `message_id` va nulo (apunta a
-- `messages`); la referencia viva es `message_ref`.
create function public.report_group_message(p_message_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_sender uuid;
  v_body text;
  v_group uuid;
  v_name text;
begin
  if v_actor is null then
    raise exception 'No hay sesión autenticada.' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('acoso', 'contenido-inapropiado', 'spam', 'suplantacion', 'otro') then
    raise exception 'Elige un motivo válido.' using errcode = 'LI009';
  end if;
  if char_length(p_details) > 500 then
    raise exception 'El texto no puede superar 500 caracteres.' using errcode = '23514';
  end if;

  select gm.sender_id, gm.body, g.id, g.name
    into v_sender, v_body, v_group, v_name
    from public.group_messages gm
    join public.groups g on g.id = gm.group_id
   where gm.id = p_message_id
     and exists (
       select 1 from public.group_members m where m.group_id = g.id and m.user_id = v_actor
     );
  if not found then
    raise exception 'El mensaje no está disponible.' using errcode = '42501';
  end if;
  if v_sender = v_actor then
    raise exception 'No puedes reportar tus propios mensajes.' using errcode = 'LI008';
  end if;

  insert into public.user_reports
    (reporter_id, reported_id, reporter_ref, reported_ref, reason, details,
     message_ref, message_excerpt, group_id, group_ref, group_name)
  values
    (v_actor, v_sender, v_actor::text, v_sender::text, p_reason, nullif(btrim(p_details), ''),
     p_message_id::text, left(v_body, 500), v_group, v_group::text, v_name);
end;
$fn$;

revoke execute on function public.report_group_message(uuid, text, text) from public, anon;
grant execute on function public.report_group_message(uuid, text, text) to authenticated;

-- Bloquear un grupo: deja de salirte (pase definitivo) y bloquea a su admin con
-- el bloqueo de siempre (`block_profile`), que ya esconde deck, matches y
-- mensajes en los dos sentidos. Desde dentro del grupo no se bloquea: se sale.
create function public.block_group(p_group_id uuid)
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

  insert into public.group_swipes (group_id, user_id, direction, decision, actor_id)
  values (p_group_id, v_actor, 'user_to_group', 'pass', v_actor)
  on conflict (group_id, user_id, direction)
  do update set decision = 'pass', actor_id = excluded.actor_id, created_at = now();

  perform public.block_profile(v_admin);
end;
$fn$;

revoke execute on function public.block_group(uuid) from public, anon;
grant execute on function public.block_group(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
--
-- `groups`: cada cambio de miembros toca `updated_at`, y ese UPDATE pasa por la
-- RLS (lo reciben los miembros, incluido quien acaba de entrar). `group_members`
-- NO se publica, igual que `room_members`. `group_messages`: los INSERT, con su
-- RLS. La publicación solo emite insert y update (20261009230200).

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.groups;
    alter publication supabase_realtime add table public.group_messages;
  end if;
end;
$do$;

-- Última definición: 20261106130000_realtime_changes_private.sql. Cambio: dos
-- topics nuevos. `lockin:groups` es de toda la cuenta (la RLS de `groups`
-- filtra las filas); `lockin:group-messages:<grupo>` es solo de sus miembros.
create or replace function public.is_changes_topic_member(p_topic text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select case
    -- Los avisos de matches, salas y grupos son de toda la cuenta: la RLS de
    -- `matches`, `lockin_rooms` y `groups` ya filtra qué filas llegan a cada uno.
    when p_topic in ('lockin:matches', 'lockin:rooms', 'lockin:groups') then (select auth.uid()) is not null
    when p_topic like 'lockin:group-messages:%' then coalesce(
      public.is_group_member(
        substring(
          p_topic
          from '^lockin:group-messages:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
        )::uuid
      ),
      false
    )
    -- Mensajes y sesiones van por match: solo sus dos miembros, sin bloqueo.
    else coalesce(
      public.is_unblocked_match(
        substring(
          p_topic
          from '^lockin:(?:messages|sessions):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
        )::uuid
      ),
      false
    )
  end;
$fn$;

revoke execute on function public.is_changes_topic_member(text) from public, anon;
grant execute on function public.is_changes_topic_member(text) to authenticated;
