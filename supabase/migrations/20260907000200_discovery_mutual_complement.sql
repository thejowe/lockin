-- Orden por encaje mutuo: ver JSDoc de DiscoveryRepository.getDeck.
-- Migración NUEVA: no reescribir 20260905000500 ni 20260907000100, ya aplicadas.
-- Dos intersecciones booleanas, peso idéntico; vacío no puntúa; lockin neutral.
-- Conserva firma, SECURITY INVOKER, RLS, filtros y permisos existentes.
-- Ordena TODOS los pendientes antes del límite: los de cero siguen accesibles.
-- CREATE OR REPLACE conserva grants. No modifica record_decision ni matches.

create or replace function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50
)
returns setof public.profiles
language sql
stable
set search_path = ''
as $fn$
  with viewer as (
    select
      coalesce(
        p_mode,
        (select s.active_mode from public.user_settings s where s.user_id = (select auth.uid())),
        (select p.looking_for from public.profiles p where p.id = (select auth.uid()))
      ) as mode
  )
  select p.*
  from public.profiles p
  cross join viewer v
  left join public.profiles me on me.id = (select auth.uid())
  where p.id <> (select auth.uid())
    -- Ya swipeados fuera del deck.
    and not exists (
      select 1 from public.decisions d
      where d.actor_id = (select auth.uid()) and d.target_id = p.id
    )
    -- Compatibilidad de modo: espejo de `matchesMode` en el mock.
    and (v.mode is null or v.mode = 'ambos' or p.looking_for = 'ambos' or p.looking_for = v.mode)
    -- Filtro opcional por especialidad: basta con que solape en una.
    and (p_specialties is null or cardinality(p_specialties) = 0 or p.specialties && p_specialties)
  order by
    case when me.id is null or v.mode = 'lockin'
      or me.looking_for = 'lockin' or p.looking_for = 'lockin' then 0
    else (me.specialties && p.seeking_specialties)::integer
       + (p.specialties && me.seeking_specialties)::integer end desc,
    p.id asc
  limit greatest(coalesce(p_limit, 50), 1);
$fn$;
