-- LockIn — distintivo Premium: quién de estos perfiles tiene Premium.
--
-- `entitlements` solo la lee su dueño y `is_premium()` no se puede llamar desde
-- el cliente, así que hasta ahora nadie podía saber si OTRA persona era Premium.
-- El distintivo (un diamante junto al nombre) lo necesita. Se expone SOLO el
-- booleano, y solo para los ids que se piden: nunca `premium_until`, el producto
-- ni la tienda.

create function public.premium_badges(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select e.user_id
  from public.entitlements e
  where e.user_id = any (p_ids[1:100])
    and e.premium_until > now();
$fn$;

revoke execute on function public.premium_badges(uuid[]) from public, anon;
grant execute on function public.premium_badges(uuid[]) to authenticated;
