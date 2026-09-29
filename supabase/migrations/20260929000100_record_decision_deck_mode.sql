-- LockIn — `record_decision` resuelve el modo del match con el del deck.
--
-- Migración NUEVA: no reescribe `20260905000500_functions_and_realtime.sql`,
-- que es donde vive la definición original.
--
-- Hallazgo del comprobador (2026-09-29): con la sesión en `par` (onboarding
-- «Cofundador») y el chip del deck en Lock-In, un like a alguien que busca
-- compañero de Lock-In creaba un match Par. El chip filtra el deck en el
-- cliente sin tocar `user_settings.active_mode`, y `record_decision` resolvía
-- el modo con `coalesce(active_mode, looking_for)`, así que nunca lo veía.
--
-- `p_mode` es el modo con el que se está decidiendo —el del filtro del deck—
-- y manda sobre el activo de la sesión. Va al final de la firma y con default
-- `null`: sin él, el criterio de siempre, así que las llamadas de dos
-- argumentos (clientes ya instalados) siguen funcionando igual.
--
-- DROP + CREATE y no CREATE OR REPLACE: cambiar la lista de argumentos con
-- OR REPLACE crea una SOBRECARGA al lado de la vieja, y con dos
-- `record_decision` —una de 2 argumentos y otra de 3 con default— cualquier
-- llamada de dos argumentos sería ambigua. Al recrearla se pierden los grants,
-- así que se vuelven a poner igual que en la original: EXECUTE solo para
-- `authenticated`, revocado de `public` y `anon`. SECURITY DEFINER y
-- `search_path = ''` se conservan por el mismo motivo que allí.

drop function public.record_decision(uuid, public.decision);

create function public.record_decision(
  p_target_id uuid,
  p_decision public.decision,
  p_mode public.mode_preference default null
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

  -- Modo con el que decide el actor: el del deck si llega; si no, el activo de
  -- la sesión y, si tampoco, el que declara su perfil. Mismo criterio que
  -- `recordDecision` en el mock.
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

revoke execute on function public.record_decision(uuid, public.decision, public.mode_preference) from public, anon;
grant execute on function public.record_decision(uuid, public.decision, public.mode_preference) to authenticated;
