-- LockIn — Premium (suscripción), parte 3: el deck con filtros premium y orden.
-- Spec §2.4-§2.6. Plan: Tarea 4. Depende de 20261030120100_premium_rpcs.sql.
--
-- Última definición: 20261009224000_block_report.sql (cuatro argumentos, bloqueo
-- en cualquier dirección). Se conservan el filtro de modo, el de especialidad,
-- `p_exclude_ids`, el ranking por encaje mutuo y el `limit` después de ordenar.
--
-- Cambios:
--
-- 1. Cinco filtros nuevos, solo Premium: horas mínimas por semana, franjas,
--    ambición, punto de partida y ventana de zona horaria. Quien no es Premium y
--    pasa CUALQUIERA de ellos recibe LQ005: no se ignoran en silencio, porque el
--    usuario vería un deck sin filtrar creyendo que está filtrado. El filtro de
--    especialidad sigue gratis.
--
-- 2. Orden: Super Like que me han dado -> Boost activo -> el de siempre (encaje
--    mutuo y desempate por id). El Boost solo REORDENA: los filtros mandan, así
--    que no mete a nadie que el filtro deje fuera.
--
-- 3. Devuelve además `super_liked_me` por fila. Eso obliga a cambiar el tipo de
--    retorno de `setof public.profiles` a una tabla con las columnas de
--    `profiles` + la nueva. Si se añade una columna a `profiles` que el cliente
--    deba ver, hay que añadirla aquí (y en `incoming_likes`).
--
-- 4. Pasa de SECURITY INVOKER a SECURITY DEFINER. Hace falta: para saber si
--    alguien me dio un Super Like hay que leer `decisions` de otra persona, y
--    para ordenar por Boost hay que leer `boosts`, y la RLS no deja ninguna de
--    las dos. No se pierde ninguna protección: ya filtraba `has_profile_block`
--    (que es exactamente la regla de la política de lectura de `profiles`,
--    20261018120000), excluye lo que ya decidí y solo mira `auth.uid()`.
--
-- 5. Zona horaria: el desfase actual de cada zona sale de `pg_timezone_names`
--    (así lo resuelve Postgres con el horario de verano) y no de `at time zone`
--    sobre `profiles.timezone`, porque esa columna es texto libre y un nombre
--    inválido haría fallar el deck entero. Una zona que no se reconoce cuenta
--    como UTC, igual que en el mock. Si quien mira no tiene perfil, no filtra.
--
-- DROP + CREATE: cambiar la lista de argumentos y el tipo de retorno con OR
-- REPLACE crearía otra función al lado (patrón de 20260929000200). Se pierden
-- los grants, así que se repiten.

drop function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[]);

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
         + (p.specialties && me.seeking_specialties)::integer end as score
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
    r.link_instagram, r.link_tiktok, r.super_liked_me
  from ranked r
  order by r.super_liked_me desc, r.boosted desc, r.score desc, r.id asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$fn$;

revoke execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[], integer, public.time_band[], public.ambition[], public.starting_point[], integer) from public, anon;
grant execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[], integer, public.time_band[], public.ambition[], public.starting_point[], integer) to authenticated;
