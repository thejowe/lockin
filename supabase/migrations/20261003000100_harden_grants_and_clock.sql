-- Hardening incremental: las migraciones anteriores ya están aplicadas.
-- Supabase concede ALL por defecto; RLS no filtra TRUNCATE. Conservamos
-- SELECT/INSERT/UPDATE/DELETE y los permisos de columna existentes.
-- lockin_rooms y room_members ya usan REVOKE ALL + GRANT SELECT.

revoke truncate, references, trigger on table public.profiles from anon, authenticated;
revoke truncate, references, trigger on table public.user_settings from anon, authenticated;
revoke truncate, references, trigger on table public.decisions from anon, authenticated;
revoke truncate, references, trigger on table public.matches from anon, authenticated;
revoke truncate, references, trigger on table public.messages from anon, authenticated;
revoke truncate, references, trigger on table public.lockin_sessions from anon, authenticated;
revoke truncate, references, trigger on table public.session_attendance from anon, authenticated;
revoke truncate, references, trigger on table public.session_ratings from anon, authenticated;
revoke truncate, references, trigger on table public.agreement_answers from anon, authenticated;

-- Solo cambia el reloj de las validaciones posteriores al bloqueo.
-- CREATE OR REPLACE conserva firmas, propietarios y privilegios de EXECUTE.
-- Los timestamps de escritura y los defaults mantienen su comportamiento.

-- Última definición: 20260913000100_lockin_sessions.sql
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
  if not found or v_actor not in (v_match.profile_a, v_match.profile_b) then
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

-- Última definición: 20260913000100_lockin_sessions.sql
create or replace function public.respond_session(
  p_session_id uuid,
  p_answer public.session_status
)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions;
  v_now timestamptz;
begin
  v_session := public.lock_member_session(p_session_id);
  v_now := clock_timestamp();

  if p_answer is null or p_answer not in ('aceptada', 'rechazada') then
    raise exception 'respond_session: la respuesta es aceptada o rechazada' using errcode = '22023';
  end if;
  if v_session.proposed_by = (select auth.uid()) then
    raise exception 'respond_session: no puedes responder a tu propia propuesta' using errcode = 'LI004';
  end if;
  if v_session.status <> 'propuesta' then
    raise exception 'respond_session: ya se respondió' using errcode = 'LI001';
  end if;
  if v_now >= v_session.starts_at then
    raise exception 'respond_session: la propuesta caducó' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = p_answer, responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

-- Última definición: 20260913000100_lockin_sessions.sql
create or replace function public.cancel_session(p_session_id uuid)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions;
  v_now timestamptz;
begin
  v_session := public.lock_member_session(p_session_id);
  v_now := clock_timestamp();

  if v_session.status not in ('propuesta', 'aceptada') then
    raise exception 'cancel_session: ya no se puede cancelar' using errcode = 'LI001';
  end if;
  if v_now >= v_session.starts_at then
    raise exception 'cancel_session: ya ha empezado' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = 'cancelada', responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

-- Última definición: 20260913000100_lockin_sessions.sql
create or replace function public.join_session(p_session_id uuid)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions;
  v_now timestamptz;
  v_row public.session_attendance;
begin
  v_session := public.lock_member_session(p_session_id);
  v_now := clock_timestamp();

  if v_session.status <> 'aceptada'
     or v_now < v_session.starts_at - interval '5 minutes'
     or v_now >= public.session_ends_at(v_session.starts_at, v_session.blocks) then
    raise exception 'join_session: fuera de la ventana de entrada' using errcode = 'LI003';
  end if;

  insert into public.session_attendance (session_id, profile_id)
  values (p_session_id, (select auth.uid()))
  on conflict (session_id, profile_id) do update set left_at = null
  returning * into v_row;

  return v_row;
end;
$fn$;

-- Última definición: 20260915000100_session_ratings.sql
create or replace function public.rate_session(
  p_session_id uuid,
  p_rating public.session_rating
)
returns public.session_ratings
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  -- Ya lanza LI004 si la sesión no existe o el match no es tuyo.
  v_session public.lockin_sessions;
  v_now timestamptz;
  v_actor uuid := (select auth.uid());
  v_row public.session_ratings;
begin
  v_session := public.lock_member_session(p_session_id);
  v_now := clock_timestamp();

  -- El estado se mira primero y aparte de la ventana: una cancelada o una
  -- rechazada no es "fuera de plazo", es una sesión que nunca se celebró.
  if v_session.status <> 'aceptada' then
    raise exception 'rate_session: la sesión no llegó a celebrarse' using errcode = 'LI004';
  end if;
  if not public.session_rating_window_is_open(v_session.starts_at, v_session.blocks, v_now) then
    raise exception 'rate_session: la sesión no ha terminado, o ya pasaron 24 horas' using errcode = 'LI003';
  end if;
  if not public.session_both_attended(p_session_id) then
    raise exception 'rate_session: solo se valora una sesión a la que entrasteis los dos' using errcode = 'LI004';
  end if;

  insert into public.session_ratings (session_id, profile_id, rating)
  values (p_session_id, v_actor, p_rating)
  on conflict (session_id, profile_id) do nothing
  returning * into v_row;

  -- Ya estaba valorada: repetir el mismo toque es idempotente (la red puede
  -- entregarlo dos veces); mandar otro valor, no — queda escrita.
  if not found then
    select * into v_row
      from public.session_ratings r
     where r.session_id = p_session_id and r.profile_id = v_actor;
    if v_row.rating <> p_rating then
      raise exception 'rate_session: ya valoraste esta sesión' using errcode = 'LI001';
    end if;
  end if;

  return v_row;
end;
$fn$;
