-- LockIn — orden D3: excludeIds al SQL del deck, RPC para el último mensaje de
-- cada match, y "sesión viva" resuelta por el reloj de Postgres.
--
-- Migración NUEVA: no reescribe ninguna de las ya aplicadas. Los tres cambios
-- son independientes entre sí y comparten archivo solo porque los tres son de
-- la misma orden.

-- ---------------------------------------------------------------------------
-- 1. `discovery_deck`: `excludeIds` baja al SQL.
-- ---------------------------------------------------------------------------
--
-- Antes, `getDeck` aplicaba `excludeIds` en el cliente DESPUÉS de que el RPC
-- ya hubiera limitado a `p_limit` filas: la página encogía de forma
-- impredecible según cuánto llevara ya swipeado (en memoria, sin persistir)
-- quien pide el deck. `p_exclude_ids` se añade al final de la firma —
-- parámetro nuevo con default, no reordena los que ya había — así que
-- `record_decision` y cualquier llamada existente sin este argumento siguen
-- funcionando igual. Conserva SECURITY INVOKER, RLS, el resto de filtros y el
-- orden por encaje mutuo (que sigue calculándose antes del `limit`).
create or replace function public.discovery_deck(
  p_mode public.mode_preference default null,
  p_specialties public.specialty[] default null,
  p_limit integer default 50,
  p_exclude_ids uuid[] default null
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
    -- Excluidos explícitos: lo que el cliente ya tiene cargado y todavía no
    -- ha decidido (o acaba de decidir y aún no llegó el eco). Antes de esto
    -- se aplicaba en JS, encima de la página ya limitada; ahora entra en el
    -- mismo `where` que el resto, así que la página siempre sale completa.
    and (p_exclude_ids is null or not (p.id = any(p_exclude_ids)))
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

revoke execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[]) from public, anon;
grant execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer, uuid[]) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. `last_messages_for_matches`: el último mensaje de cada match, en SQL.
-- ---------------------------------------------------------------------------
--
-- PostgREST no expone `distinct on`, así que `MatchRepository.list()` traía
-- los `RECENT_MESSAGES_WINDOW = 200` mensajes más recientes del usuario y los
-- agrupaba en el cliente — correcto salvo que alguien tuviera más de 200
-- mensajes por delante del último de alguna conversación vieja. Un RPC sí
-- puede usar `distinct on`.
--
-- SECURITY INVOKER (el valor por defecto, no se declara aparte): la política
-- "messages: lees los de tus matches" ya limita las filas visibles a las de
-- los matches del que llama, igual que hace `is_match_member` sin necesitar
-- privilegios elevados. Pasar el id de un match ajeno en `p_match_ids`
-- simplemente no devuelve nada para ese id — RLS, no un chequeo aparte.
create or replace function public.last_messages_for_matches(p_match_ids uuid[])
returns setof public.messages
language sql
stable
set search_path = ''
as $fn$
  select distinct on (match_id) *
  from public.messages
  where match_id = any(p_match_ids)
  order by match_id, sent_at desc, id desc;
$fn$;

revoke execute on function public.last_messages_for_matches(uuid[]) from public, anon;
grant execute on function public.last_messages_for_matches(uuid[]) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. `active_session`: "viva" la decide Postgres, no el reloj del teléfono.
-- ---------------------------------------------------------------------------
--
-- `LockInSessionRepository.getActive()` traía las cinco sesiones más
-- recientes no cerradas y decidía cuál seguía viva con `Date.now()` en el
-- cliente. Un teléfono desfasado abre o cierra la ventana de la sesión antes
-- de tiempo — exactamente el motivo por el que `server_now()` existe. Mismo
-- patrón defensivo que `ratable_session`: SECURITY DEFINER con
-- `is_match_member` explícito, aunque la política de `lockin_sessions` ya
-- acota la lectura, porque es el estilo que ya sigue el resto del archivo.
create or replace function public.active_session(p_match_id uuid)
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
    and s.status in ('propuesta', 'aceptada')
    and public.session_is_live(s.status, s.starts_at, s.blocks, now())
  order by s.created_at desc
  limit 1;
$fn$;

revoke execute on function public.active_session(uuid) from public, anon;
grant execute on function public.active_session(uuid) to authenticated;
