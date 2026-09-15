-- LockIn — rachas de pareja (Fase 2).
--
-- Diseño: docs/superpowers/specs/2026-09-15-rachas-design.md.
-- Continuación de `20260913000100_lockin_sessions.sql` y
-- `20260915000100_session_ratings.sql`: reutiliza `session_ends_at` y
-- `session_both_attended` —la definición de "asistió" no se repite aquí— y
-- mantiene su patrón: SECURITY DEFINER con `search_path` vacío y nombres
-- cualificados, y `revoke`/`grant` al final.
--
-- Espejo de `pairStreak` en `src/data/streaks.ts`: si cambia la regla aquí,
-- cambia allí, y al revés.
--
-- Solo una función: sin tablas, enums, políticas ni publicación en realtime. La
-- racha cambia cuando cambian `lockin_sessions` o `session_attendance`, que ya
-- publican.
--
-- Nada se guarda: la racha se calcula al leer. La caducidad depende de now() y
-- ningún trigger la dispararía, así que un número guardado habría que
-- recompararlo igual.
--
-- NO lee `session_ratings`, y no es un descuido: la valoración es privada de
-- quien la escribe, y una racha que dependiera de ella la delataría a la otra
-- persona del match al subir o no subir. Lo fija `schema-embedded.test.mjs`.


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER como `ratable_session`: la asistencia de la otra persona no
-- es legible por RLS. Por eso el filtro del actor va dentro y no se delega en
-- las políticas: sin `auth.uid()` en `profile_a`/`profile_b` devolvería las
-- rachas de todos.
--
-- Una fila por match con racha viva. Los pasos:
--
--   * `shared`: las sesiones que cuentan — aceptadas y con las dos dentro. Un
--     plantón, una cancelada o una rechazada no llegan aquí, así que ni suman
--     ni rompen.
--   * `marked`: una sesión empieza cadena si le faltan menos de 7 días desde el
--     final de la anterior —estricto, como `pairStreak`—. En la primera de cada
--     match `lag` es null, la comparación también, y cae en `else 1`: empieza
--     cadena, que es lo correcto. No se arregla con `coalesce`.
--   * `chained`: la suma acumulada numera las cadenas, en el mismo orden por
--     `starts_at` que el `lag`.
--   * `last_chain`: `distinct on` con `chain desc` se queda con la última.
--
-- Viva mientras `now() < último final + 7 días`; sin fila si no. Sin zona
-- horaria: todo son instantes. Por eso los 7 días se escriben `168 hours` y no
-- `7 days`: sumar días a un timestamptz cuenta días de calendario en la zona de
-- la sesión, y un cambio de hora en medio los deja en 167 o 169 horas, cuando
-- `STREAK_GAP_DAYS` son 168 exactas.

create or replace function public.match_streaks()
returns table (match_id uuid, streak_count integer, alive_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  with shared as (
    select s.match_id,
           s.starts_at,
           public.session_ends_at(s.starts_at, s.blocks) as ends_at
    from public.lockin_sessions s
    join public.matches m on m.id = s.match_id
    where (select auth.uid()) in (m.profile_a, m.profile_b)
      and s.status = 'aceptada'
      and public.session_both_attended(s.id)
  ),
  marked as (
    select sh.match_id,
           sh.starts_at,
           sh.ends_at,
           case
             when sh.starts_at - lag(sh.ends_at) over w < interval '168 hours' then 0
             else 1
           end as starts_chain
    from shared sh
    window w as (partition by sh.match_id order by sh.starts_at)
  ),
  chained as (
    select mk.match_id,
           mk.ends_at,
           sum(mk.starts_chain) over (partition by mk.match_id order by mk.starts_at) as chain
    from marked mk
  ),
  last_chain as (
    select distinct on (c.match_id)
           c.match_id,
           count(*) as streak_count,
           max(c.ends_at) as last_ends_at
    from chained c
    group by c.match_id, c.chain
    order by c.match_id, c.chain desc
  )
  select lc.match_id,
         lc.streak_count::integer,
         lc.last_ends_at + interval '168 hours'
  from last_chain lc
  where now() < lc.last_ends_at + interval '168 hours';
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.match_streaks() from public, anon;

grant execute on function public.match_streaks() to authenticated;
