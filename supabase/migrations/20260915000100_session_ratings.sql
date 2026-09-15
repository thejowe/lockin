-- LockIn — valoración de 1 toque post-sesión (Fase 2).
--
-- Diseño: docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md.
-- Continuación de `20260913000100_lockin_sessions.sql`: reutiliza
-- `session_ends_at`, `lock_member_session` e `is_match_member`, y mantiene su
-- patrón — nadie escribe la tabla directamente, no hay políticas de insert,
-- update ni delete, y todo pasa por el RPC SECURITY DEFINER de abajo.
--
-- Espejo de `src/data/sessions.ts` y de `src/data/mock/sessions.ts`: si cambia
-- una regla aquí, cambia allí, y al revés.
--
-- Dos cosas que esta migración NO copia de la de sesiones, y no es un descuido:
--
--   * La política de select es `profile_id = (select auth.uid())`, no
--     `is_session_member`. La valoración es privada de quien la escribe: la
--     otra parte del match no la lee nunca. Con `is_session_member` se volvería
--     legible por la otra persona, que es justo lo que la spec prohíbe — si se
--     ve, se deja de decir `floja`.
--   * `session_ratings` no entra en `supabase_realtime`. La escribe tu propio
--     dispositivo, que ya sabe lo que acaba de escribir, y no hay nadie más a
--     quien avisar; publicarla filtraría por el canal del match que alguien
--     acaba de valorar.

create type public.session_rating as enum ('floja', 'bien', 'genial');

create table public.session_ratings (
  session_id uuid not null references public.lockin_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rating public.session_rating not null,
  rated_at timestamptz not null default now(),
  -- Una valoración por persona y sesión, e inmutable: no hay update ni delete.
  primary key (session_id, profile_id)
);

comment on table public.session_ratings is
  'Valoración de un toque de una sesión Lock-In terminada. Privada de quien la escribe: no la lee nadie más, tampoco la otra persona del match.';


-- ---------------------------------------------------------------------------
-- Reglas de la ventana
-- ---------------------------------------------------------------------------

-- Solo el plazo de `isInRatingWindow`: se valora desde que la sesión termina
-- hasta 24 h después (`RATING_WINDOW_HOURS`). El estado NO se mira aquí —a
-- diferencia de su espejo en TypeScript, que lo lleva dentro—: lo comprueban
-- aparte y antes quienes llaman, porque una sesión cancelada o rechazada no es
-- "fuera de plazo" (LI003) sino una que nunca llegó a celebrarse (LI004).
-- `p_now` es parámetro y no `now()` para que la función sea inmutable y
-- comprobable, igual que `session_is_live`.
create or replace function public.session_rating_window_is_open(
  p_starts_at timestamptz,
  p_blocks smallint,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select p_now >= public.session_ends_at(p_starts_at, p_blocks)
     and p_now < public.session_ends_at(p_starts_at, p_blocks) + interval '24 hours';
$fn$;


-- ---------------------------------------------------------------------------
-- Helper de asistencia — la regla 4: sin las dos personas dentro no hubo sesión
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER como `is_session_member`: para afirmar algo de la asistencia
-- de la otra persona hace falta leer `matches` y `session_attendance` por
-- encima de RLS. Devuelve un booleano y nada más, así que no expone su fila.
--
-- Asistió = entró antes de que la sesión acabara; irse antes no lo deshace
-- (`left_at` no se mira). La PK de `session_attendance` es
-- `(session_id, profile_id)`, así que contar 2 filas de los dos perfiles del
-- match es contar a las dos personas.

create or replace function public.session_both_attended(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select 2 = (
    select count(*)
    from public.lockin_sessions s
    join public.matches m on m.id = s.match_id
    join public.session_attendance a
      on a.session_id = s.id
     and a.profile_id in (m.profile_a, m.profile_b)
     and a.joined_at < public.session_ends_at(s.starts_at, s.blocks)
    where s.id = p_session_id
  );
$fn$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.session_ratings enable row level security;

revoke all on table public.session_ratings from anon;

create policy "session_ratings: solo lees las tuyas"
  on public.session_ratings for select
  to authenticated
  using (profile_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

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
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_actor uuid := (select auth.uid());
  v_row public.session_ratings;
begin
  -- El estado se mira primero y aparte de la ventana: una cancelada o una
  -- rechazada no es "fuera de plazo", es una sesión que nunca se celebró.
  if v_session.status <> 'aceptada' then
    raise exception 'rate_session: la sesión no llegó a celebrarse' using errcode = 'LI004';
  end if;
  if not public.session_rating_window_is_open(v_session.starts_at, v_session.blocks, now()) then
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

-- La sesión terminada de ese match que toca valorar, o cero filas. `order by
-- starts_at desc limit 1` no es cosmético: con dos sin valorar se ofrece la más
-- reciente y la otra caduca — la tarjeta del chat pinta un estado, no una
-- bandeja.
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
    and public.is_match_member(p_match_id)
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
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.session_rating_window_is_open(timestamptz, smallint, timestamptz) from public, anon;
revoke execute on function public.session_both_attended(uuid) from public, anon;
revoke execute on function public.rate_session(uuid, public.session_rating) from public, anon;
revoke execute on function public.ratable_session(uuid) from public, anon;

grant execute on function public.session_rating_window_is_open(timestamptz, smallint, timestamptz) to authenticated;
grant execute on function public.session_both_attended(uuid) to authenticated;
grant execute on function public.rate_session(uuid, public.session_rating) to authenticated;
grant execute on function public.ratable_session(uuid) to authenticated;
