-- LockIn — el bloqueo (20261009224000_block_report.sql) también corta las rutas
-- SECURITY DEFINER que esquivaban la RLS de `matches`.
--
-- Va en una migración POSTERIOR a las de la auditoría (20261009230000 y
-- 20261009230200) a propósito: redefine `is_room_topic_member`, cuya última
-- definición es la de 20261009230200, y una migración anterior la habría
-- pisado. Todo es CREATE OR REPLACE / ALTER POLICY: no reescribe historia.
--
-- Criterio único: una pareja con bloqueo en CUALQUIER dirección no puede crear
-- ni responder invitaciones, proponer/responder/entrar a sesiones, ver ni
-- escribir el acuerdo, valorar, ni abrir canales de presencia o de vídeo.
-- Misma conducta que ya tiene el mock. Los errores son los mismos que ya
-- daban las funciones para un match que no es tuyo (LI004 / LI006), para no
-- revelar a quien fue bloqueado que hay un bloqueo.
--
-- Las salas tienen un anfitrión y varios invitados; aquí se corta la relación
-- con el ANFITRIÓN (quien convoca). Un bloqueo entre dos invitados de una sala
-- ajena no se resuelve en SQL: ver docs/plan/todo/perfil.md.

-- ---------------------------------------------------------------------------
-- 1. Salas
-- ---------------------------------------------------------------------------

-- ¿La sala no la convoca alguien con quien tengo un bloqueo (en cualquier
-- dirección)? SECURITY DEFINER para poder usarla en políticas sin recursión.
-- PL/pgSQL por la misma razón que `has_profile_block`.
create or replace function public.is_room_unblocked(p_room_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.lockin_rooms r
    where r.id = p_room_id
      and not public.has_profile_block(r.host_id)
  ) into v_ok;
  return v_ok;
end;
$fn$;

revoke execute on function public.is_room_unblocked(uuid) from public, anon;
grant execute on function public.is_room_unblocked(uuid) to authenticated;

-- Última definición: 20261002000100_lockin_rooms.sql. Cambio: una persona con
-- bloqueo (en cualquier dirección) no puede ser invitada.
create or replace function public.create_room(
  p_invitee_ids uuid[],
  p_starts_at timestamptz,
  p_blocks smallint
)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_count integer := coalesce(cardinality(p_invitee_ids), 0);
  v_now timestamptz := clock_timestamp();
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'create_room: no hay sesión autenticada' using errcode = '28000';
  end if;

  if v_count < 2 or v_count > 4
     or array_position(p_invitee_ids, null) is not null
     or (select count(distinct i) from unnest(p_invitee_ids) as i) <> v_count
     or v_actor = any (p_invitee_ids)
     or exists (
       select 1 from unnest(p_invitee_ids) as i(id)
       where not exists (
         select 1 from public.matches m
         where (m.profile_a = v_actor and m.profile_b = i.id)
            or (m.profile_b = v_actor and m.profile_a = i.id)
       )
       or public.has_profile_block(i.id)
     ) then
    raise exception 'create_room: invitados inválidos' using errcode = 'LI006';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < v_now + interval '5 minutes'
     or p_starts_at > v_now + interval '30 days' then
    raise exception 'create_room: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  insert into public.lockin_rooms (host_id, starts_at, blocks)
  values (v_actor, p_starts_at, p_blocks)
  returning * into v_room;

  insert into public.room_members (room_id, profile_id, status, responded_at)
  values (v_room.id, v_actor, 'aceptada', v_now);

  insert into public.room_members (room_id, profile_id)
  select v_room.id, i from unnest(p_invitee_ids) as i;

  return v_room;
end;
$fn$;

-- Última definición: 20261002000100_lockin_rooms.sql. Cambio: la sala de un
-- anfitrión con bloqueo «no existe» para respond/cancel/join/leave.
create or replace function public.lock_room_for_member(p_room_id uuid)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'sala Lock-In: no hay sesión autenticada' using errcode = '28000';
  end if;

  select * into v_room from public.lockin_rooms where id = p_room_id for update;
  if not found or not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.profile_id = v_actor and rm.status <> 'rechazada'
  ) or public.has_profile_block(v_room.host_id) then
    raise exception 'sala Lock-In: no existe o no estás en ella' using errcode = 'LI004';
  end if;

  return v_room;
end;
$fn$;

-- La RLS ya limitaba a tus salas no rechazadas; ahora, además, a las de
-- anfitriones sin bloqueo. Las salas ya hechas siguen en la base: solo se ocultan.
alter policy "lockin_rooms: lees las salas en las que estás" on public.lockin_rooms
  using (public.is_room_participant(id) and public.is_room_unblocked(id));

alter policy "room_members: tu fila, las aceptadas y, si convocas, todas" on public.room_members
  using (
    profile_id = (select auth.uid())
    or public.is_room_host(room_id)
    or (status = 'aceptada' and public.is_room_participant(room_id) and public.is_room_unblocked(room_id))
  );

-- Última definición: 20261002000100_lockin_rooms.sql. Cambio: el filtro de
-- bloqueo explícito; la RLS de arriba ya lo impone, pero la función no debe
-- depender de que SECURITY INVOKER siga siéndolo.
create or replace function public.live_rooms()
returns setof public.lockin_rooms
language sql
stable
set search_path = ''
as $fn$
  select r.*
  from public.lockin_rooms r
  where r.cancelled_at is null
    and not public.has_profile_block(r.host_id)
    and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  order by r.starts_at, r.id;
$fn$;

-- Última definición: 20261009230200_realtime_room_window_no_delete_2.sql.
-- Cambio: no hay canal de presencia en la sala de un anfitrión con bloqueo.
create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language sql
volatile
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.lockin_rooms r
    where r.id = substring(
      p_topic
      from '^lockin:room:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
    )::uuid
      and (select auth.uid()) is not null
      and public.is_room_attendee(r.id)
      and public.is_room_unblocked(r.id)
      and r.cancelled_at is null
      and clock_timestamp() >= r.starts_at - interval '5 minutes'
      and clock_timestamp() < public.session_ends_at(r.starts_at, r.blocks)
  );
$fn$;

revoke execute on function public.is_room_topic_member(text) from public, anon;
grant execute on function public.is_room_topic_member(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Sesiones 1:1 (propuesta, respuesta, entrada, valoración, presencia y vídeo)
-- ---------------------------------------------------------------------------

-- Última definición: 20260913000100_lockin_sessions.sql. Cambio: un match con
-- bloqueo «no es tuyo». Cubre respond/cancel/join/leave y rate_session, que
-- pasan todas por aquí.
create or replace function public.lock_member_session(p_session_id uuid)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_session public.lockin_sessions;
begin
  if v_actor is null then
    raise exception 'sesión Lock-In: no hay sesión autenticada' using errcode = '28000';
  end if;

  select * into v_session from public.lockin_sessions where id = p_session_id for update;
  if not found or not exists (
    select 1 from public.matches m
    where m.id = v_session.match_id and v_actor in (m.profile_a, m.profile_b)
  ) or not public.is_unblocked_match(v_session.match_id) then
    raise exception 'sesión Lock-In: no existe o no es de tus matches' using errcode = 'LI004';
  end if;

  return v_session;
end;
$fn$;

-- Última definición: 20261003000100_harden_grants_and_clock.sql. Cambio: ídem.
create or replace function public.propose_session(
  p_match_id uuid,
  p_starts_at timestamptz,
  p_blocks smallint
)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
  v_session public.lockin_sessions;
  v_now timestamptz;
begin
  if v_actor is null then
    raise exception 'propose_session: no hay sesión autenticada' using errcode = '28000';
  end if;

  -- Bloquear el match serializa las propuestas simultáneas de las dos personas:
  -- la segunda espera aquí y luego ve la sesión viva de la primera. Un índice
  -- único no sirve porque "viva" depende de now().
  select * into v_match from public.matches where id = p_match_id for update;
  v_now := clock_timestamp();
  if not found or v_actor not in (v_match.profile_a, v_match.profile_b)
     or not public.is_unblocked_match(p_match_id) then
    raise exception 'propose_session: el match no es tuyo' using errcode = 'LI004';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < v_now + interval '5 minutes'
     or p_starts_at > v_now + interval '30 days' then
    raise exception 'propose_session: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  if exists (
    select 1 from public.lockin_sessions s
    where s.match_id = p_match_id
      and public.session_is_live(s.status, s.starts_at, s.blocks, v_now)
  ) then
    raise exception 'propose_session: ya hay una sesión viva en este match' using errcode = 'LI001';
  end if;

  insert into public.lockin_sessions (match_id, proposed_by, starts_at, blocks)
  values (p_match_id, v_actor, p_starts_at, p_blocks)
  returning * into v_session;

  return v_session;
end;
$fn$;

-- Última definición: 20260913000100_lockin_sessions.sql. Cambio: la pertenencia
-- exige match SIN bloqueo. Es lo que autorizan las políticas de presencia y de
-- vídeo (`is_session_topic_member`) y la lectura de `session_attendance`.
create or replace function public.is_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.lockin_sessions s
    where s.id = p_session_id
      and public.is_unblocked_match(s.match_id)
  );
$fn$;

-- Última definición: 20260918000100_deck_exclude_last_messages_active_session.sql.
create or replace function public.active_session(p_match_id uuid)
returns setof public.lockin_sessions
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.*
  from public.lockin_sessions s
  where s.match_id = p_match_id
    and public.is_unblocked_match(p_match_id)
    and s.status in ('propuesta', 'aceptada')
    and public.session_is_live(s.status, s.starts_at, s.blocks, now())
  order by s.created_at desc
  limit 1;
$fn$;

-- Última definición: 20260915000100_session_ratings.sql.
create or replace function public.ratable_session(p_match_id uuid)
returns setof public.lockin_sessions
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.*
  from public.lockin_sessions s
  where s.match_id = p_match_id
    and public.is_unblocked_match(p_match_id)
    and s.status = 'aceptada'
    and public.session_rating_window_is_open(s.starts_at, s.blocks, now())
    and public.session_both_attended(s.id)
    and not exists (
      select 1
      from public.session_ratings r
      where r.session_id = s.id
        and r.profile_id = (select auth.uid())
    )
  order by s.starts_at desc
  limit 1;
$fn$;


-- ---------------------------------------------------------------------------
-- 3. Acuerdo de socios
-- ---------------------------------------------------------------------------

-- Última definición: 20260924000200_agreement_answers.sql. Cambio: un match con
-- bloqueo «no es tuyo» (LI004).
create or replace function public.answer_agreement_topic(
  p_match_id uuid,
  p_topic text,
  p_option text,
  p_note text default null
)
returns public.agreement_answers
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
  v_row public.agreement_answers;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b)
     or not public.is_unblocked_match(p_match_id) then
    raise exception 'answer_agreement_topic: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'answer_agreement_topic: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  insert into public.agreement_answers as a (match_id, profile_id, topic, option, note)
  values (p_match_id, v_actor, p_topic, p_option, p_note)
  on conflict (match_id, profile_id, topic) do update
    set option = excluded.option,
        note = excluded.note,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$fn$;

-- Última definición: 20260924000200_agreement_answers.sql. Cambio: ídem.
create or replace function public.match_agreement(p_match_id uuid)
returns table (
  topic text,
  mine_option text,
  mine_note text,
  mine_updated_at timestamptz,
  theirs_answered boolean,
  theirs_option text,
  theirs_note text,
  theirs_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found or v_actor is null or v_actor not in (v_match.profile_a, v_match.profile_b)
     or not public.is_unblocked_match(p_match_id) then
    raise exception 'match_agreement: el match no es tuyo' using errcode = 'LI004';
  end if;
  if v_match.mode <> 'par' then
    raise exception 'match_agreement: el acuerdo es solo para matches de cofundador'
      using errcode = 'LI005';
  end if;

  return query
    select coalesce(mine.topic, theirs.topic),
           mine.option,
           mine.note,
           mine.updated_at,
           theirs.topic is not null,
           case when mine.topic is not null then theirs.option end,
           case when mine.topic is not null then theirs.note end,
           case when mine.topic is not null then theirs.updated_at end
    from (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id = v_actor
    ) mine
    full outer join (
      select a.topic, a.option, a.note, a.updated_at
      from public.agreement_answers a
      where a.match_id = p_match_id and a.profile_id <> v_actor
    ) theirs on theirs.topic = mine.topic
    order by 1;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 4. Decisiones
-- ---------------------------------------------------------------------------

-- Última definición: 20260929000100_record_decision_deck_mode.sql. Cambio:
-- con bloqueo en cualquier dirección la decisión se guarda (igual que el mock)
-- pero NUNCA crea ni devuelve match, aunque los likes sean recíprocos o el
-- match ya existiera. Misma firma: CREATE OR REPLACE no crea sobrecarga.
create or replace function public.record_decision(
  p_target_id uuid,
  p_decision public.decision,
  p_mode public.mode_preference default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_actor_mode public.mode_preference;
  v_target_looking_for public.mode_preference;
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

  insert into public.decisions (actor_id, target_id, decision)
  values (v_actor, p_target_id, p_decision)
  on conflict (actor_id, target_id)
    do update set decision = excluded.decision, created_at = now();

  if p_decision <> 'like' then
    return null;
  end if;

  -- Bloqueo en cualquiera de las dos direcciones: sin match.
  if public.has_profile_block(p_target_id) then
    return null;
  end if;

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
