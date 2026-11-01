-- LockIn — Premium: una instantánea más vieja de RevenueCat no pisa una más nueva.
--
-- `sync-entitlement` y `revenuecat-webhook` escriben `entitlements` a partir de lo
-- que responde la API REST de RevenueCat. Si dos refrescos del mismo usuario se
-- solapan (una EXPIRATION lenta detrás de una RENEWAL), el último en escribir
-- gana aunque su respuesta sea la más antigua: la renovación queda caducada.
--
-- `save_entitlement` serializa por usuario (cerrojo consultivo de transacción) y
-- solo escribe si la instantánea se pidió DESPUÉS (o a la vez) que la guardada:
-- `p_snapshot_at` es el instante en que la función empezó a pedir el estado, no el
-- de la respuesta. Una petición que empezó antes no puede traer un estado más
-- nuevo que otra que empezó después.
--
-- Solo la service role la ejecuta (las Edge Functions); `entitlements` sigue
-- cerrada a escritura para el cliente.

alter table public.entitlements
  add column snapshot_at timestamptz not null default '-infinity';

create function public.save_entitlement(
  p_user uuid,
  p_premium_until timestamptz,
  p_product_id text,
  p_store text,
  p_snapshot_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_applied integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('entitlement:' || p_user::text, 2));

  insert into public.entitlements as e (
    user_id, premium_until, product_id, store, snapshot_at, updated_at
  )
  values (p_user, p_premium_until, p_product_id, p_store, p_snapshot_at, now())
  on conflict (user_id) do update
    set premium_until = excluded.premium_until,
        product_id = excluded.product_id,
        store = excluded.store,
        snapshot_at = excluded.snapshot_at,
        updated_at = excluded.updated_at
    where e.snapshot_at <= excluded.snapshot_at;

  get diagnostics v_applied = row_count;
  return v_applied > 0;
end;
$fn$;

revoke all on function public.save_entitlement(uuid, timestamptz, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_entitlement(uuid, timestamptz, text, text, timestamptz)
  to service_role;
