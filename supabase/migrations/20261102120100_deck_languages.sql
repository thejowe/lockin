-- LockIn — `discovery_deck` e `incoming_likes` devuelven idiomas y especialidad escrita.
--
-- Depende de 20261102120000_profile_languages_and_specialties.sql. Las dos
-- funciones devuelven las columnas de `profiles` una a una (ver la nota 3 de
-- 20261030120200), así que las columnas nuevas hay que añadirlas aquí o el
-- cliente vería esos perfiles sin idiomas.
--
-- Cambio de orden en el deck: al encaje mutuo de especialidades se le suma el de
-- idiomas — +1 si el otro habla alguno de los que busco, +1 si yo hablo alguno
-- de los que busca él. Solo reordena, no filtra: con `seeking_languages` vacío
-- (o perfiles anteriores sin idiomas) no cambia nada. Espejo en el mock
-- (`src/data/mock/index.ts`, `getDeck`).
--
-- El resto, idéntico a la última definición de cada una (20261030120200 y
-- 20261030120100). DROP + CREATE porque cambia el tipo de retorno; los grants
-- se repiten.

drop function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[], integer, public.time_band[], public.ambition[], public.starting_point[], integer);

create function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50,
  p_exclude_ids uuid[] default null,
  p_min_hours_per_week integer default null,
  p_time_bands public.time_band[] default null,
  p_ambition public.ambition[] default null,
  p_starting_point public.starting_point[] default null,
  p_timezone_window_hours integer default null
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
      or p_timezone_window_hours is not null)
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
    cross join viewer v
    left join public.profiles me on me.id = v_uid
    left join zones zp on zp.name = p.timezone
    left join zones zm on zm.name = me.timezone
    where p.id <> v_uid
      and not public.has_profile_block(p.id)
      and not exists (
        select 1 from public.decisions d
        where d.actor_id = v_uid and d.target_id = p.id
      )
      and (p_exclude_ids is null or not (p.id = any(p_exclude_ids)))
      and (v.mode is null or v.mode = 'ambos' or p.looking_for = 'ambos' or p.looking_for = v.mode)
      and (p_specialties is null or cardinality(p_specialties) = 0 or p.specialties && p_specialties)
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
  order by r.super_liked_me desc, r.boosted desc, r.score desc, r.id asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$fn$;

revoke execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[], integer, public.time_band[], public.ambition[], public.starting_point[], integer) from public, anon;
grant execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[], integer, public.time_band[], public.ambition[], public.starting_point[], integer) to authenticated;

-- ---------------------------------------------------------------------------
-- incoming_likes
-- ---------------------------------------------------------------------------

drop function public.incoming_likes(integer, timestamptz, boolean, uuid);

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
  languages public.language[],
  seeking_languages public.language[],
  other_specialty text,
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
    p.link_instagram, p.link_tiktok, p.languages, p.seeking_languages, p.other_specialty,
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
