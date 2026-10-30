-- LockIn — Premium: endurecimiento tras la revisión de 20261030120000..0200.
--
-- 1. `decisions` ya no admite escritura directa del cliente.
--
--    20260905000400 dejó a `authenticated` el INSERT de su propia fila ("solo
--    swipeas en tu nombre"). Con Premium eso abre un truco: insertar a mano un
--    like con `is_super = true` sin pasar por `like_events` y llamar después a
--    `record_decision` con los mismos argumentos; la idempotencia ve «misma
--    decisión» y se salta los cupos. Ahora solo escribe `record_decision` /
--    `undo_last_decision` (security definer, corren como dueño). Nada depende del
--    INSERT directo: el cliente solo hace SELECT de `target_id` (listDecided), el
--    trigger de e2e/incoming-likes.sql es security definer, y las políticas de
--    SELECT no cambian. Se retira también la política de INSERT, que queda muerta.
--
-- 2. Cerrojo compartido por el PAR en `undo_last_decision` y en la rama de match
--    de `record_decision`.
--
--    Los cerrojos por actor no serializan a A deshaciendo con B dándole like
--    recíproco: son dos actores distintos. Sin más, B podía crear el match entre
--    que A comprobaba «no hay match» y borraba su decisión. Ahora las dos rutas
--    toman `pg_advisory_xact_lock(hashtextextended(least(a,b)::text || ':' ||
--    greatest(a,b)::text, 1))` ANTES de mirar la reciprocidad / el match.
--
--    Orden de adquisición (para no interbloquear): 1.º el cerrojo del actor (clave
--    `actor::text`, semilla 0), 2.º el del par (semilla 1), y no se toma ningún otro
--    cerrojo consultivo después. Quien tiene el del par no espera a ningún otro, así
--    que no hay ciclo posible entre A (actor A → par) y B (actor B → par).
--
-- Mismas firmas: CREATE OR REPLACE conserva owner y grants.

revoke insert, update, delete on table public.decisions from anon, authenticated;
drop policy if exists "decisions: solo swipeas en tu nombre" on public.decisions;

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

create or replace function public.undo_last_decision()
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

  perform pg_advisory_xact_lock(hashtextextended(least(v_actor, v_last.target_id)::text || ':' || greatest(v_actor, v_last.target_id)::text, 1));

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
