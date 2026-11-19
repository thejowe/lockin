-- Cofundador: una decisión vigente por par. Deshacer un swipe reciclado recupera
-- el rechazo anterior y su puesto en la cola. Las filas existentes ya tienen
-- la fecha del swipe en created_at.
alter table public.decisions add column previous_pass_at timestamptz;

create or replace function public.pass_cooldown()
returns interval
language sql immutable
set search_path = ''
as $$ select interval '48 hours' $$;

revoke execute on function public.pass_cooldown() from public, anon, authenticated;

create or replace function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50,
  p_exclude_ids uuid[] default null,
  p_min_hours_per_week integer default null,
  p_time_bands public.time_band[] default null,
  p_ambition public.ambition[] default null,
  p_starting_point public.starting_point[] default null,
  p_timezone_window_hours integer default null,
  p_min_age integer default null,
  p_max_age integer default null,
  p_require_github boolean default null,
  p_require_linkedin boolean default null
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
  languages public.language[],
  seeking_languages public.language[],
  other_specialty text,
  super_liked_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if (p_min_hours_per_week is not null
      or p_time_bands is not null
      or p_ambition is not null
      or p_starting_point is not null
      or p_min_age is not null
      or p_max_age is not null
      or p_require_github is not null
      or p_require_linkedin is not null)
     and not public.is_premium(v_uid) then
    raise exception 'discovery_deck: los filtros avanzados requieren Premium'
      using errcode = 'LQ005';
  end if;

  return query
  with viewer as (
    select coalesce(
      p_mode,
      (select s.active_mode from public.user_settings s where s.user_id = v_uid),
      (select p.looking_for from public.profiles p where p.id = v_uid)
    ) as mode
  ),
  zones as materialized (
    select z.name, extract(epoch from z.utc_offset) / 3600 as offset_hours
    from pg_catalog.pg_timezone_names z
    where p_timezone_window_hours is not null
  ),
  ranked as (
    select
      p.*,
      mine.created_at as passed_at,
      exists (
        select 1 from public.decisions d
        where d.actor_id = p.id and d.target_id = v_uid
          and d.decision = 'like' and d.is_super
      ) as super_liked_me,
      exists (
        select 1 from public.boosts b
        where b.user_id = p.id and b.ends_at > now()
      ) as boosted,
      case when me.id is null or v.mode = 'lockin'
        or me.looking_for = 'lockin' or p.looking_for = 'lockin' then 0
      else (me.specialties && p.seeking_specialties)::integer
         + (p.specialties && me.seeking_specialties)::integer end
      + coalesce((p.languages && me.seeking_languages)::integer, 0)
      + coalesce((me.languages && p.seeking_languages)::integer, 0) as score
    from public.profiles p
    join auth.users account on account.id = p.id
    left join public.decisions mine on mine.actor_id = v_uid and mine.target_id = p.id
    cross join viewer v
    left join public.profiles me on me.id = v_uid
    left join zones zp on zp.name = p.timezone
    left join zones zm on zm.name = me.timezone
    where p.id <> v_uid
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until <= now())
      and not exists (
        select 1 from public.blocked_account_emails e
        where e.email_hash = public.email_block_hash(account.email)
      )
      and not public.has_profile_block(p.id)
      and (mine.target_id is null or
           (mine.decision = 'pass' and mine.created_at <= now() - public.pass_cooldown()))
      and not exists (
        select 1 from public.matches m
        where m.profile_a = least(v_uid, p.id) and m.profile_b = greatest(v_uid, p.id)
      )
      and (p_exclude_ids is null or not (p.id = any(p_exclude_ids)))
      and (v.mode is null or v.mode = 'ambos' or p.looking_for = 'ambos' or p.looking_for = v.mode)
      and (p_specialties is null or cardinality(p_specialties) = 0 or p.specialties && p_specialties)
      and (p_min_age is null or p.age >= p_min_age)
      and (p_max_age is null or p.age <= p_max_age)
      and (p_require_github is not true or p.github_verified_at is not null)
      and (p_require_linkedin is not true or p.linkedin_verified_at is not null)
      and (p_min_hours_per_week is null or p.availability_hours_per_week >= p_min_hours_per_week)
      and (p_time_bands is null or cardinality(p_time_bands) = 0 or p.availability_bands && p_time_bands)
      and (p_ambition is null or cardinality(p_ambition) = 0 or p.ambition = any(p_ambition))
      and (p_starting_point is null or cardinality(p_starting_point) = 0 or p.starting_point = any(p_starting_point))
      and (
        p_timezone_window_hours is null
        or me.id is null
        or abs(coalesce(zp.offset_hours, 0) - coalesce(zm.offset_hours, 0)) <= p_timezone_window_hours
      )
  )
  select
    r.id, r.name, r.age, r.location, r.timezone, r.avatar_initials, r.avatar_accent,
    r.specialties, r.looking_for, r.starting_point, r.availability_hours_per_week,
    r.availability_bands, r.ambition, r.link_github, r.link_portfolio, r.link_linkedin,
    r.prompts, r.created_at, r.updated_at, r.seeking_specialties, r.github_handle,
    r.github_verified_at, r.avatar_url, r.linkedin_name, r.linkedin_verified_at,
    r.link_instagram, r.link_tiktok, r.languages, r.seeking_languages, r.other_specialty,
    r.super_liked_me
  from ranked r
  order by r.passed_at asc nulls first,
    case when r.passed_at is null then r.super_liked_me end desc,
    case when r.passed_at is null then r.boosted end desc,
    case when r.passed_at is null then r.score end desc,
    r.id asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$fn$;

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
  v_previous_pass_at timestamptz;
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

  select d.decision = p_decision and d.is_super = v_super,
         case when d.decision = 'pass' and d.created_at <= v_now - public.pass_cooldown()
              then d.created_at end
    into v_unchanged, v_previous_pass_at
  from public.decisions d
  where d.actor_id = v_actor and d.target_id = p_target_id;
  v_unchanged := coalesce(v_unchanged, false) and v_previous_pass_at is null;

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
    insert into public.decisions (actor_id, target_id, decision, is_super, created_at, previous_pass_at)
    values (v_actor, p_target_id, p_decision, v_super, v_now, v_previous_pass_at)
    on conflict (actor_id, target_id)
      do update set decision = excluded.decision,
                    is_super = excluded.is_super,
                    created_at = excluded.created_at,
                    previous_pass_at = excluded.previous_pass_at;

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

  select d.target_id, d.created_at, d.previous_pass_at
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

  if v_last.previous_pass_at is null then
    delete from public.decisions d
    where d.actor_id = v_actor and d.target_id = v_last.target_id;
  else
    update public.decisions d
    set decision = 'pass', is_super = false, created_at = v_last.previous_pass_at,
        previous_pass_at = null
    where d.actor_id = v_actor and d.target_id = v_last.target_id;
  end if;

  return v_last.target_id;
end;
$fn$;
