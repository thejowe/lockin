-- LockIn — sesiones Lock-In (Fase 2).
--
-- Diseño: docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md.
-- Espejo de `src/data/sessions.ts`: si cambia una regla de tiempo aquí, cambia
-- allí, y al revés.
--
-- Nadie escribe estas tablas directamente: no hay políticas de insert, update
-- ni delete. Todo pasa por los RPCs SECURITY DEFINER de abajo, que validan las
-- reglas con la fila bloqueada. Es el mismo patrón que `record_decision()`.

create type public.session_status as enum ('propuesta', 'aceptada', 'rechazada', 'cancelada');

create table public.lockin_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  blocks smallint not null,
  status public.session_status not null default 'propuesta',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint lockin_sessions_blocks_valid check (blocks in (1, 2, 4)),
  -- Una propuesta no tiene respuesta; cualquier otro estado sí.
  constraint lockin_sessions_responded_iff_not_proposal
    check ((status = 'propuesta') = (responded_at is null))
);

comment on table public.lockin_sessions is
  'Sesiones Lock-In entre las dos personas de un match. Estados derivados (caducada, en curso, terminada) salen de starts_at y blocks, no se guardan.';

create index lockin_sessions_match_idx on public.lockin_sessions (match_id, created_at desc);

create table public.session_attendance (
  session_id uuid not null references public.lockin_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- NULL = no salió de forma explícita. Solo un left_at anterior al final es abandono.
  left_at timestamptz,
  primary key (session_id, profile_id)
);


-- ---------------------------------------------------------------------------
-- Reglas de tiempo
-- ---------------------------------------------------------------------------

create or replace function public.session_ends_at(p_starts_at timestamptz, p_blocks smallint)
returns timestamptz
language sql
immutable
set search_path = ''
as $fn$
  select p_starts_at + make_interval(mins => 30 * p_blocks);
$fn$;

-- Viva: propuesta antes de su hora, o aceptada antes de terminar. `p_now` es
-- parámetro y no `now()` para que la función sea inmutable y comprobable.
create or replace function public.session_is_live(
  p_status public.session_status,
  p_starts_at timestamptz,
  p_blocks smallint,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select case p_status
    when 'propuesta' then p_now < p_starts_at
    when 'aceptada' then p_now < public.session_ends_at(p_starts_at, p_blocks)
    else false
  end;
$fn$;


-- ---------------------------------------------------------------------------
-- Helper de pertenencia — se usa en la política RLS de `session_attendance`.
-- ---------------------------------------------------------------------------
--
-- Envuelta en una función, igual que `is_match_member`, para que la política
-- deparse en una sola línea: la huella de esquema asume un objeto por línea,
-- y un `exists (select … from … where …)` inline se deparsea con saltos de
-- línea reales.

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
      and public.is_match_member(s.match_id)
  );
$fn$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.lockin_sessions    enable row level security;
alter table public.session_attendance enable row level security;

revoke all on table public.lockin_sessions    from anon;
revoke all on table public.session_attendance from anon;

create policy "lockin_sessions: lees las de tus matches"
  on public.lockin_sessions for select
  to authenticated
  using (public.is_match_member(match_id));

create policy "session_attendance: lees la de sesiones de tus matches"
  on public.session_attendance for select
  to authenticated
  using (public.is_session_member(session_id));


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
--
-- Todas sacan al actor de `auth.uid()`. La pertenencia al match se comprueba
-- contra `matches` directamente: son SECURITY DEFINER y RLS no aplica aquí.

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
begin
  if v_actor is null then
    raise exception 'propose_session: no hay sesión autenticada' using errcode = '28000';
  end if;

  -- Bloquear el match serializa las propuestas simultáneas de las dos personas:
  -- la segunda espera aquí y luego ve la sesión viva de la primera. Un índice
  -- único no sirve porque "viva" depende de now().
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'propose_session: el match no es tuyo' using errcode = 'LI004';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < now() + interval '5 minutes'
     or p_starts_at > now() + interval '30 days' then
    raise exception 'propose_session: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  if exists (
    select 1 from public.lockin_sessions s
    where s.match_id = p_match_id
      and public.session_is_live(s.status, s.starts_at, s.blocks, now())
  ) then
    raise exception 'propose_session: ya hay una sesión viva en este match' using errcode = 'LI001';
  end if;

  insert into public.lockin_sessions (match_id, proposed_by, starts_at, blocks)
  values (p_match_id, v_actor, p_starts_at, p_blocks)
  returning * into v_session;

  return v_session;
end;
$fn$;

-- Carga la sesión bloqueada y exige que el actor sea del match. Uso interno.
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
  ) then
    raise exception 'sesión Lock-In: no existe o no es de tus matches' using errcode = 'LI004';
  end if;

  return v_session;
end;
$fn$;

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
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
begin
  if p_answer is null or p_answer not in ('aceptada', 'rechazada') then
    raise exception 'respond_session: la respuesta es aceptada o rechazada' using errcode = '22023';
  end if;
  if v_session.proposed_by = (select auth.uid()) then
    raise exception 'respond_session: no puedes responder a tu propia propuesta' using errcode = 'LI004';
  end if;
  if v_session.status <> 'propuesta' then
    raise exception 'respond_session: ya se respondió' using errcode = 'LI001';
  end if;
  if now() >= v_session.starts_at then
    raise exception 'respond_session: la propuesta caducó' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = p_answer, responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

create or replace function public.cancel_session(p_session_id uuid)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
begin
  if v_session.status not in ('propuesta', 'aceptada') then
    raise exception 'cancel_session: ya no se puede cancelar' using errcode = 'LI001';
  end if;
  if now() >= v_session.starts_at then
    raise exception 'cancel_session: ya ha empezado' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = 'cancelada', responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

create or replace function public.join_session(p_session_id uuid)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_row public.session_attendance;
begin
  if v_session.status <> 'aceptada'
     or now() < v_session.starts_at - interval '5 minutes'
     or now() >= public.session_ends_at(v_session.starts_at, v_session.blocks) then
    raise exception 'join_session: fuera de la ventana de entrada' using errcode = 'LI003';
  end if;

  insert into public.session_attendance (session_id, profile_id)
  values (p_session_id, (select auth.uid()))
  on conflict (session_id, profile_id) do update set left_at = null
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.leave_session(p_session_id uuid)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_row public.session_attendance;
begin
  update public.session_attendance
     set left_at = now()
   where session_id = v_session.id
     and profile_id = (select auth.uid())
  returning * into v_row;

  if not found then
    raise exception 'leave_session: no habías entrado en la sesión' using errcode = 'LI003';
  end if;

  return v_row;
end;
$fn$;

create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $fn$
  select now();
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.session_ends_at(timestamptz, smallint) from public, anon;
revoke execute on function public.session_is_live(public.session_status, timestamptz, smallint, timestamptz) from public, anon;
revoke execute on function public.is_session_member(uuid) from public, anon;
revoke execute on function public.propose_session(uuid, timestamptz, smallint) from public, anon;
revoke execute on function public.lock_member_session(uuid) from public, anon, authenticated;
revoke execute on function public.respond_session(uuid, public.session_status) from public, anon;
revoke execute on function public.cancel_session(uuid) from public, anon;
revoke execute on function public.join_session(uuid) from public, anon;
revoke execute on function public.leave_session(uuid) from public, anon;
revoke execute on function public.server_now() from public, anon;

grant execute on function public.session_ends_at(timestamptz, smallint) to authenticated;
grant execute on function public.session_is_live(public.session_status, timestamptz, smallint, timestamptz) to authenticated;
grant execute on function public.is_session_member(uuid) to authenticated;
grant execute on function public.propose_session(uuid, timestamptz, smallint) to authenticated;
grant execute on function public.respond_session(uuid, public.session_status) to authenticated;
grant execute on function public.cancel_session(uuid) to authenticated;
grant execute on function public.join_session(uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.server_now() to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime — sostiene `LockInSessionRepository.subscribe`
-- ---------------------------------------------------------------------------

alter table public.lockin_sessions    replica identity full;
alter table public.session_attendance replica identity full;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lockin_sessions;
    alter publication supabase_realtime add table public.session_attendance;
  end if;
end;
$do$;
