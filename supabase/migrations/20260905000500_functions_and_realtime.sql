-- LockIn — RPC del deck y del swipe, trigger de `last_message_at`, y realtime.

-- ---------------------------------------------------------------------------
-- resolve_match_mode — espejo exacto de `resolveMatchMode` en src/data/mock/store.ts
-- ---------------------------------------------------------------------------
--
-- Si uno de los dos busca un modo concreto, manda ese. Si ambos dicen "ambos",
-- el match nace en modo Par.

create or replace function public.resolve_match_mode(
  a public.mode_preference,
  b public.mode_preference
)
returns public.mode
language sql
immutable
set search_path = ''
as $fn$
  select case
    when a <> 'ambos' then a::text::public.mode
    when b <> 'ambos' then b::text::public.mode
    else 'par'::public.mode
  end;
$fn$;


-- ---------------------------------------------------------------------------
-- record_decision — `DiscoveryRepository.recordDecision`
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER porque es la ÚNICA operación que necesita mirar el lado
-- contrario de `decisions` (¿me ha dado like esta persona?) y crear filas en
-- `matches`, dos cosas que las políticas RLS niegan al usuario.
--
-- Devuelve la fila de `matches` creada, o NULL si el like no fue recíproco o
-- la decisión fue 'pass'. Eso es exactamente `DecisionResult.match`.
--
-- El actor sale siempre de `auth.uid()`, nunca de un parámetro: un cliente no
-- puede swipear en nombre de otro por mucho que manipule la llamada.

create or replace function public.record_decision(
  p_target_id uuid,
  p_decision public.decision
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_actor_mode public.mode_preference;
  v_target_looking_for public.mode_preference;
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

  -- Modo efectivo del actor: el activo de la sesión y, si no lo hay, el que
  -- declara su perfil. Mismo criterio que `effectiveMode()` en el mock.
  select coalesce(s.active_mode, p.looking_for)
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

  insert into public.decisions (actor_id, target_id, decision)
  values (v_actor, p_target_id, p_decision)
  on conflict (actor_id, target_id)
    do update set decision = excluded.decision, created_at = now();

  if p_decision <> 'like' then
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

  -- El par va ordenado para respetar `matches_pair_is_ordered`.
  insert into public.matches (profile_a, profile_b, mode)
  values (
    least(v_actor, p_target_id),
    greatest(v_actor, p_target_id),
    public.resolve_match_mode(v_actor_mode, v_target_looking_for)
  )
  on conflict on constraint matches_pair_unique
    -- El match ya existía (dos likes casi simultáneos). Devolvemos el que hay
    -- en vez de fallar: `recordDecision` debe ser idempotente.
    do update set profile_a = excluded.profile_a
  returning * into v_match;

  return v_match;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- discovery_deck — `DiscoveryRepository.getDeck`
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER: todo lo que lee ya es visible para el usuario. Existe como
-- función y no como consulta del cliente para no tener que traerse la lista de
-- ids ya decididos a la app solo para volver a mandarla en un `not in`.
--
-- Deck vacío no es un error: es que se agotó (así lo dice el contrato).

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
  from public.profiles p, viewer v
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
  order by p.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$fn$;


-- ---------------------------------------------------------------------------
-- last_message_at
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER porque el usuario no tiene UPDATE sobre `matches`. La
-- comprobación de que puede escribir en ese match ya la hizo la política de
-- INSERT de `messages` antes de llegar aquí.

create or replace function public.messages_touch_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.matches
     set last_message_at = new.sent_at
   where id = new.match_id;
  return new;
end;
$fn$;

create trigger messages_touch_match_after_insert
  after insert on public.messages
  for each row
  execute function public.messages_touch_match();


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.record_decision(uuid, public.decision) from public, anon;
revoke execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer) from public, anon;
revoke execute on function public.is_match_member(uuid) from public, anon;

grant execute on function public.record_decision(uuid, public.decision) to authenticated;
grant execute on function public.discovery_deck(public.mode_preference, public.specialty[], integer) to authenticated;
grant execute on function public.is_match_member(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime — sostiene `MatchRepository.subscribe` y `MessageRepository.subscribe`
-- ---------------------------------------------------------------------------
--
-- Las políticas RLS de SELECT también filtran el stream de realtime, así que
-- un usuario solo recibe eventos de sus propios matches y mensajes.
-- `replica identity full` hace que los UPDATE/DELETE lleguen con la fila
-- completa, necesario para filtrar por `match_id` en el cliente.

alter table public.matches  replica identity full;
alter table public.messages replica identity full;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.matches;
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$do$;
