-- LockIn — Premium (suscripción), parte 2: cupos, deshacer, Boost y likes recibidos.
-- Spec §2-§3. Plan: Tarea 3. Depende de 20261030120000_premium_tables.sql.
--
-- Qué hay aquí:
--   * `record_decision` con Super Like, cupos y cerrojo por actor.
--   * `undo_last_decision`, `activate_boost`, `premium_quotas`.
--   * `incoming_likes_count` (para todos) e `incoming_likes` (solo Premium).
--   * `like_window_reset`, auxiliar interna de las anteriores.
--
-- Códigos de error (el cliente los traduce a QuotaExceededError / PremiumRequiredError):
--   LQ001 sin likes · LQ002 sin Super Likes · LQ003 sin Boost
--   LQ004 tope antiabuso (300 por 24 h, también con Premium)
--   LQ005 hace falta Premium (la spec decía 42501; se cambia para no confundirlo
--         con un rechazo de RLS)
-- Con LQ001-LQ004, `detail` lleva el instante en que vuelve a haber cupo, en ISO
-- 8601 UTC («resetsAt»). El cliente lo pinta tal cual y no lo recalcula con su reloj.
--
-- Todo el tiempo sale de `clock_timestamp()` capturado DESPUÉS del cerrojo, como
-- en 20261003000100: una llamada que espera el cerrojo cuenta con la hora a la
-- que entra, no con la de antes de esperar.

-- ---------------------------------------------------------------------------
-- like_window_reset: cuándo baja el conteo de la ventana por debajo del tope
-- ---------------------------------------------------------------------------
--
-- Caen primero los más viejos, así que hay que esperar a que salga el evento
-- número `tope` contando desde el más nuevo; si aún no se llega al tope, el más
-- viejo. Es la misma regla que `resetOf` en `src/data/mock/premium.ts`. Nulo si
-- no hay ningún evento en la ventana. Interna: no se concede a nadie.

create function public.like_window_reset(
  p_actor uuid,
  p_kind text,
  p_window interval,
  p_cap integer,
  p_now timestamptz
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (
      select e.created_at
      from public.like_events e
      where e.actor_id = p_actor
        and (p_kind is null or e.kind = p_kind)
        and e.created_at > p_now - p_window
      order by e.created_at desc
      offset greatest(p_cap, 1) - 1
      limit 1
    ),
    (
      select min(e.created_at)
      from public.like_events e
      where e.actor_id = p_actor
        and (p_kind is null or e.kind = p_kind)
        and e.created_at > p_now - p_window
    )
  ) + p_window;
$fn$;

revoke execute on function public.like_window_reset(uuid, text, interval, integer, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_decision: Super Like, cupos y cerrojo por actor
-- ---------------------------------------------------------------------------
--
-- Última definición: 20261009231000_block_report_enforcement.sql (bloqueo en
-- cualquier dirección: la decisión se guarda pero nunca crea match).
--
-- DROP + CREATE y no CREATE OR REPLACE: cambiar la lista de argumentos con OR
-- REPLACE crea una SOBRECARGA al lado de la vieja, y con dos `record_decision`
-- cualquier llamada de dos argumentos sería ambigua. Al recrearla se pierden los
-- grants, así que se repiten: EXECUTE solo para `authenticated`.
--
-- Orden fijo (el mismo del mock):
--   1. cerrojo consultivo sobre el actor, para que dos llamadas a la vez no se
--      cuelen las dos en el cupo;
--   2. si la decisión previa sobre ese target es la misma (mismo tipo y mismo
--      Super Like), no se gasta ni se reescribe nada: un reintento de red no cobra
--      dos veces;
--   3. cupos: antiabuso (LQ004), después likes del día (LQ001, solo gratis) y, si
--      es Super Like, los de la semana (LQ002);
--   4. upsert en `decisions` + registro en `like_events`;
--   5. el resto, como hoy: bloqueo, reciprocidad y match.
-- Un rechazo no escribe nada. El pass no gasta ni tiene límite.

drop function public.record_decision(uuid, public.decision, public.mode_preference);

create function public.record_decision(
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
  v_now := clock_timestamp();
  select * into v_limits from public.premium_limits();

  select (d.decision = p_decision and d.is_super = v_super)
    into v_unchanged
  from public.decisions d
  where d.actor_id = v_actor and d.target_id = p_target_id;
  v_unchanged := coalesce(v_unchanged, false);

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
    insert into public.decisions (actor_id, target_id, decision, is_super, created_at)
    values (v_actor, p_target_id, p_decision, v_super, v_now)
    on conflict (actor_id, target_id)
      do update set decision = excluded.decision,
                    is_super = excluded.is_super,
                    created_at = excluded.created_at;

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

revoke execute on function public.record_decision(uuid, public.decision, public.mode_preference, boolean) from public, anon;
grant execute on function public.record_decision(uuid, public.decision, public.mode_preference, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- undo_last_decision
-- ---------------------------------------------------------------------------
--
-- Solo Premium, solo la ÚLTIMA decisión y solo si tiene menos de 10 minutos. No
-- se deshace si ya hay match con esa persona (el otro lado ya lo ha visto):
-- devuelve null y el match sigue. Borra la fila de `decisions`, así que el perfil
-- vuelve al deck, pero NO borra `like_events`: el like gastado no se devuelve.
-- Devuelve el id deshecho, o null si no había nada que deshacer.
--
-- Más estricto que el mock en un caso: si ya hay match, tampoco se deshace un
-- pass posterior (el mock solo bloquea el like), porque dejaría de nuevo en el
-- deck a una persona con la que ya hay match.

create function public.undo_last_decision()
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_limits record;
  v_now timestamptz;
  v_last record;
begin
  if v_actor is null then
    raise exception 'undo_last_decision: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  if not public.is_premium(v_actor) then
    raise exception 'undo_last_decision: hace falta Premium'
      using errcode = 'LQ005';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));
  v_now := clock_timestamp();
  select * into v_limits from public.premium_limits();

  select d.target_id, d.created_at
    into v_last
  from public.decisions d
  where d.actor_id = v_actor
  order by d.created_at desc, d.target_id
  limit 1;

  if not found then
    return null;
  end if;

  if v_last.created_at <= v_now - make_interval(mins => v_limits.undo_window_minutes) then
    return null;
  end if;

  if exists (
    select 1
    from public.matches m
    where m.profile_a = least(v_actor, v_last.target_id)
      and m.profile_b = greatest(v_actor, v_last.target_id)
  ) then
    return null;
  end if;

  delete from public.decisions d
  where d.actor_id = v_actor and d.target_id = v_last.target_id;

  return v_last.target_id;
end;
$fn$;

revoke execute on function public.undo_last_decision() from public, anon;
grant execute on function public.undo_last_decision() to authenticated;

-- ---------------------------------------------------------------------------
-- activate_boost
-- ---------------------------------------------------------------------------
--
-- Solo Premium. Un Boost cada 30 días deslizantes (contados desde el INICIO del
-- anterior, así que uno activo también lo impide) y de 30 minutos. Devuelve el
-- instante en que termina. LQ003 lleva en `detail` cuándo vuelve a haber uno.

create function public.activate_boost()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_limits record;
  v_now timestamptz;
  v_last_start timestamptz;
  v_ends timestamptz;
begin
  if v_actor is null then
    raise exception 'activate_boost: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  if not public.is_premium(v_actor) then
    raise exception 'activate_boost: hace falta Premium'
      using errcode = 'LQ005';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));
  v_now := clock_timestamp();
  select * into v_limits from public.premium_limits();

  select max(b.starts_at) into v_last_start
  from public.boosts b
  where b.user_id = v_actor;

  if v_last_start is not null
     and v_last_start + make_interval(days => v_limits.boost_cooldown_days) > v_now then
    raise exception 'activate_boost: ya has usado el Boost de este periodo'
      using errcode = 'LQ003',
            detail = to_char(
              (v_last_start + make_interval(days => v_limits.boost_cooldown_days)) at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            );
  end if;

  insert into public.boosts (user_id, starts_at, ends_at)
  values (v_actor, v_now, v_now + make_interval(mins => v_limits.boost_minutes))
  returning ends_at into v_ends;

  return v_ends;
end;
$fn$;

revoke execute on function public.activate_boost() from public, anon;
grant execute on function public.activate_boost() to authenticated;

-- ---------------------------------------------------------------------------
-- premium_quotas: una sola lectura para la UI
-- ---------------------------------------------------------------------------
--
-- Las columnas son las de `PremiumQuotas` en snake_case. `likes_left` es nulo con
-- Premium (sin límite visible); `*_reset_at` es nulo si no hay nada gastado en la
-- ventana; `boost_available_at` es nulo si el Boost está disponible ya.

create function public.premium_quotas()
returns table (
  is_premium boolean,
  premium_until timestamptz,
  likes_left integer,
  likes_reset_at timestamptz,
  supers_left integer,
  supers_reset_at timestamptz,
  boost_available_at timestamptz,
  boost_active_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_limits record;
  v_now timestamptz := clock_timestamp();
  v_premium boolean;
  v_until timestamptz;
  v_used integer;
  v_supers integer;
  v_super_cap integer;
  v_last_start timestamptz;
  v_last_end timestamptz;
  v_cooldown_end timestamptz;
begin
  if v_actor is null then
    raise exception 'premium_quotas: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  select * into v_limits from public.premium_limits();
  v_premium := public.is_premium(v_actor);
  select e.premium_until into v_until from public.entitlements e where e.user_id = v_actor;

  select count(*)::integer into v_used
  from public.like_events e
  where e.actor_id = v_actor and e.created_at > v_now - interval '24 hours';

  v_super_cap := case when v_premium then v_limits.premium_supers_per_week else v_limits.free_supers_per_week end;
  select count(*)::integer into v_supers
  from public.like_events e
  where e.actor_id = v_actor and e.kind = 'super' and e.created_at > v_now - interval '7 days';

  select b.starts_at, b.ends_at into v_last_start, v_last_end
  from public.boosts b
  where b.user_id = v_actor
  order by b.starts_at desc
  limit 1;
  v_cooldown_end := v_last_start + make_interval(days => v_limits.boost_cooldown_days);

  return query
  select
    v_premium,
    case when v_premium then v_until end,
    case when v_premium then null else greatest(0, v_limits.free_likes_per_day - v_used) end,
    public.like_window_reset(v_actor, null, interval '24 hours', v_limits.free_likes_per_day, v_now),
    greatest(0, v_super_cap - v_supers),
    public.like_window_reset(v_actor, 'super', interval '7 days', v_super_cap, v_now),
    case when v_cooldown_end > v_now then v_cooldown_end end,
    case when v_last_end > v_now then v_last_end end;
end;
$fn$;

revoke execute on function public.premium_quotas() from public, anon;
grant execute on function public.premium_quotas() to authenticated;

-- ---------------------------------------------------------------------------
-- Likes recibidos
-- ---------------------------------------------------------------------------
--
-- Revoca a propósito la regla de 20260905000300 («saber quién te ha dado like
-- antes de corresponder rompería el producto»): ahora es justo lo que se vende
-- con Premium. La RLS de `decisions` NO cambia: la lista solo sale por RPC.
--
-- «Pendiente» = me dio like y yo aún no he decidido sobre esa persona. Nunca
-- cuenta a quien tiene un bloqueo conmigo en cualquier dirección.

create function public.incoming_likes_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select count(*)::integer
  from public.decisions d
  where d.target_id = (select auth.uid())
    and d.decision = 'like'
    and not exists (
      select 1 from public.decisions mine
      where mine.actor_id = (select auth.uid()) and mine.target_id = d.actor_id
    )
    and not public.has_profile_block(d.actor_id);
$fn$;

revoke execute on function public.incoming_likes_count() from public, anon;
grant execute on function public.incoming_likes_count() to authenticated;

-- Solo Premium (LQ005). Primero los Super Likes, luego del más reciente al más
-- antiguo, con el id como desempate. La paginación es por clave compuesta:
-- `p_before` es el `liked_at` de la última fila de la página anterior. Solo con
-- eso se pagina por fecha; con `p_before_super` (y, para los empates exactos,
-- `p_before_id`) se pagina sobre el orden completo, que es el que hace falta
-- cuando la última fila de la página es un Super Like y quedan likes normales
-- más recientes.
create function public.incoming_likes(
  p_limit integer default 50,
  p_before timestamptz default null,
  p_before_super boolean default null,
  p_before_id uuid default null
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
  is_super boolean,
  liked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'incoming_likes: no hay sesión autenticada'
      using errcode = '28000';
  end if;

  if not public.is_premium(v_actor) then
    raise exception 'incoming_likes: hace falta Premium'
      using errcode = 'LQ005';
  end if;

  return query
  select
    p.id, p.name, p.age, p.location, p.timezone, p.avatar_initials, p.avatar_accent,
    p.specialties, p.looking_for, p.starting_point, p.availability_hours_per_week,
    p.availability_bands, p.ambition, p.link_github, p.link_portfolio, p.link_linkedin,
    p.prompts, p.created_at, p.updated_at, p.seeking_specialties, p.github_handle,
    p.github_verified_at, p.avatar_url, p.linkedin_name, p.linkedin_verified_at,
    p.link_instagram, p.link_tiktok,
    l.is_super, l.liked_at
  from (
    select d.actor_id, d.is_super, d.created_at as liked_at
    from public.decisions d
    where d.target_id = v_actor
      and d.decision = 'like'
      and not exists (
        select 1 from public.decisions mine
        where mine.actor_id = v_actor and mine.target_id = d.actor_id
      )
      and not public.has_profile_block(d.actor_id)
  ) l
  join public.profiles p on p.id = l.actor_id
  where p_before is null
     or (p_before_super is null and l.liked_at < p_before)
     or (p_before_super is not null and (
          l.is_super < p_before_super
          or (l.is_super = p_before_super and (
                l.liked_at < p_before
                or (p_before_id is not null and l.liked_at = p_before and p.id > p_before_id)
              ))
        ))
  order by l.is_super desc, l.liked_at desc, p.id asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$fn$;

revoke execute on function public.incoming_likes(integer, timestamptz, boolean, uuid) from public, anon;
grant execute on function public.incoming_likes(integer, timestamptz, boolean, uuid) to authenticated;
