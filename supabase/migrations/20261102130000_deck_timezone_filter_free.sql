-- LockIn — el filtro de zona horaria del deck pasa a ser gratis.
--
-- Hasta ahora `discovery_deck` lanzaba LQ005 si un usuario sin Premium pasaba
-- `p_timezone_window_hours`. Ahora ese filtro lo puede usar cualquiera, igual que
-- la especialidad; el resto de filtros avanzados (horas mínimas, franjas,
-- ambición y punto de partida) siguen siendo de Premium.
--
-- Mismo cuerpo que 20261102120100_deck_languages.sql salvo la condición de
-- Premium. La firma y el tipo de retorno no cambian: `create or replace`
-- conserva los grants.

create or replace function public.discovery_deck(
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
      or p_starting_point is not null)
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
