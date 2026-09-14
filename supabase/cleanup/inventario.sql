-- LockIn — inventario de cuentas de seed y de pruebas. SOLO LECTURA.
--
-- ## Para qué
--
-- `supabase/seed.sql` se ejecutó contra `grrzmzktrhksbttpbblg` y la suite de
-- contrato corrió contra él: en la base quedan ocho cuentas con contraseña de
-- desarrollo conocida, sus perfiles y likes, y usuarios anónimos de pasadas de
-- la suite. Antes de borrar nada hay que saber qué es qué, y qué filas de
-- cuentas que se QUEDAN desaparecerían en cascada.
--
-- No se clasifica por `is_anonymous` ni por antigüedad a secas: la app crea
-- usuarios reales anónimos (`signInAnonymously()` es su camino principal).
--
-- ## Cómo
--
-- Pega este archivo en el SQL Editor y ejecútalo. Es una única sentencia
-- `select`: no escribe nada. Descarga el resultado (CSV) y guárdalo como
-- evidencia antes de preparar `borrado.sql`.
--
-- ## Categorías
--
-- - `seed` — uno de los ocho UUID fijos de `seed.sql` Y con email
--   `@seed.lockin.app`. Si solo se cumple una de las dos cosas, sale como
--   `revisar: seed incoherente`.
-- - `prueba: contrato con perfil` — anónimo cuyo perfil tiene uno de los
--   nombres que pone `src/data/supabase/contract.test.ts` («Recíproca Par»,
--   «Recíproca Lockin», «Recíproca Ambos», y «Perfil Prueba» de
--   `src/data/test-fixtures.ts`). Pasada que murió antes del teardown.
-- - `prueba: contrato sin perfil (ráfaga)` — anónimo sin perfil creado a menos
--   de 5 minutos de al menos otros 3 anónimos: cada pasada da de alta cuatro
--   seguidos (el del test y tres de apoyo) y su teardown les borra el perfil.
-- - `prueba: cuenta de dispositivo sin perfil` — `device-…@lockin.app`, el
--   respaldo de `src/data/supabase/auth.ts`, sin perfil.
-- - `revisar: posible usuario real` — todo lo demás. Incluye el recorrido a
--   mano del 2026-09-06 y cualquier anónimo suelto sin perfil (una pasada que
--   murió pronto o alguien que abrió la app y no terminó el onboarding: desde
--   aquí no se distinguen). Lo decide una persona, no esta consulta.
--
-- ## Columnas de colateral
--
-- Solo en filas `revisar`: cuántas decisiones, matches y mensajes de ESA cuenta
-- se irían en cascada si se borran todas las `seed` y `prueba`. La última fila
-- las suma: esos tres números son el acuse que pide `borrado.sql`.

with
seed_ids(id) as (
  values
    ('11111111-1111-4111-8111-000000000001'::uuid),
    ('11111111-1111-4111-8111-000000000002'::uuid),
    ('11111111-1111-4111-8111-000000000003'::uuid),
    ('11111111-1111-4111-8111-000000000004'::uuid),
    ('11111111-1111-4111-8111-000000000005'::uuid),
    ('11111111-1111-4111-8111-000000000006'::uuid),
    ('11111111-1111-4111-8111-000000000007'::uuid),
    ('11111111-1111-4111-8111-000000000008'::uuid)
),
contract_names(name) as (
  values ('Recíproca Par'), ('Recíproca Lockin'), ('Recíproca Ambos'), ('Perfil Prueba')
),
cuentas as (
  select
    u.id,
    u.email,
    coalesce(u.is_anonymous, false) as is_anonymous,
    u.created_at,
    u.last_sign_in_at,
    p.name as perfil,
    (
      select count(*)
      from auth.users o
      where coalesce(o.is_anonymous, false)
        and o.id <> u.id
        and o.created_at between u.created_at - interval '5 minutes'
                             and u.created_at + interval '5 minutes'
    ) as anon_cercanos
  from auth.users u
  left join public.profiles p on p.id = u.id
),
clasificadas as (
  select
    c.*,
    case
      when c.id in (select id from seed_ids) and c.email like '%@seed.lockin.app'
        then 'seed'
      when c.id in (select id from seed_ids) or c.email like '%@seed.lockin.app'
        then 'revisar: seed incoherente'
      when c.is_anonymous and c.perfil in (select name from contract_names)
        then 'prueba: contrato con perfil'
      when c.is_anonymous and c.perfil is null and c.anon_cercanos >= 3
        then 'prueba: contrato sin perfil (ráfaga)'
      when c.email like 'device-%@lockin.app' and c.perfil is null
        then 'prueba: cuenta de dispositivo sin perfil'
      else 'revisar: posible usuario real'
    end as categoria
  from cuentas c
),
borrables as (
  select id from clasificadas where categoria = 'seed' or categoria like 'prueba:%'
),
filas as (
  select
    case
      when k.categoria = 'seed' then 1
      when k.categoria like 'prueba:%' then 2
      else 3
    end as orden,
    k.categoria,
    k.id,
    k.email,
    k.is_anonymous,
    k.created_at,
    k.last_sign_in_at,
    k.perfil,
    k.anon_cercanos,
    (select count(*) from public.decisions d where d.actor_id = k.id) as swipes_hechos,
    (select count(*) from public.decisions d where d.target_id = k.id) as swipes_recibidos,
    (select count(*) from public.matches m where k.id in (m.profile_a, m.profile_b)) as matches,
    (select count(*) from public.messages ms where ms.sender_id = k.id) as mensajes_enviados,
    case when k.id not in (select id from borrables) then (
      select count(*) from public.decisions d
      where (d.actor_id = k.id and d.target_id in (select id from borrables))
         or (d.target_id = k.id and d.actor_id in (select id from borrables))
    ) end as colateral_decisiones,
    case when k.id not in (select id from borrables) then (
      select count(*) from public.matches m
      where (m.profile_a = k.id and m.profile_b in (select id from borrables))
         or (m.profile_b = k.id and m.profile_a in (select id from borrables))
    ) end as colateral_matches,
    case when k.id not in (select id from borrables) then (
      select count(*) from public.messages ms
      join public.matches m on m.id = ms.match_id
      where (m.profile_a = k.id and m.profile_b in (select id from borrables))
         or (m.profile_b = k.id and m.profile_a in (select id from borrables))
    ) end as colateral_mensajes
  from clasificadas k
)
select * from filas
union all
select
  4,
  'TOTAL colateral: copia estos tres números al acuse de borrado.sql',
  null, null, null, null, null, null, null, null, null, null, null,
  coalesce(sum(colateral_decisiones), 0)::bigint,
  coalesce(sum(colateral_matches), 0)::bigint,
  coalesce(sum(colateral_mensajes), 0)::bigint
from filas
order by orden, created_at nulls last, id nulls last;
