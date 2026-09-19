-- LockIn — borrar las cuentas de seed y de pruebas de una base desplegada.
--
-- ## Antes de ejecutarlo
--
-- 1. Ejecuta `supabase/cleanup/inventario.sql` y guarda su resultado.
-- 2. Revisa cada fila `prueba: …` y `revisar: …`. Solo pasan a este archivo las
--    que una persona haya confirmado como prueba.
-- 3. Rellena los dos valores marcados con EDITAR. Nada más.
-- 4. Pega el archivo ENTERO en el SQL Editor y ejecútalo sin nada seleccionado.
--
-- Lo ejecuta un administrador en el SQL Editor (borrar en `auth.users` exige
-- privilegios que ni la clave `anon` ni `lockin_schema_reader` tienen).
--
-- ## Por qué es un único bloque `do` y no `begin; … commit;`
--
-- El SQL Editor de Supabase pasa por un pooler: dos sentencias seguidas pueden
-- caer en conexiones distintas. La versión anterior usaba tablas temporales
-- (`on commit drop`) y, con la mala suerte de un reparto así, fallaba con
-- `relation "borrar" does not exist` — o, peor, dejaba un intento a medias sin
-- que se supiera. Un bloque `do` es UNA sola sentencia: se ejecuta entero en
-- una conexión y una excepción deshace todo lo que hizo. Por eso no lleva
-- `begin`/`commit` ni tablas temporales: los ids y el acuse son variables.
--
-- ## Qué borra
--
-- Filas de `auth.users`. Todo lo demás cae por las claves ajenas de
-- `supabase/migrations/`: `profiles` y `user_settings` (on delete cascade
-- contra `auth.users`), y desde `profiles` las `decisions` de los dos lados,
-- los `matches` y los `messages` de esos matches, sean de quien sean.
--
-- Eso último es el riesgo: un match entre una cuenta de seed y una cuenta que
-- se queda se lleva también los mensajes que escribió la que se queda. Por eso
-- el acuse: el borrado solo sigue si el colateral real coincide con el que
-- viste en el inventario.
--
-- ## Guardias (cualquiera aborta el bloque entero y no borra nada)
--
-- - Todo id listado existe en `auth.users` (inventario desfasado o ya borrado).
-- - Los ocho de seed siguen teniendo email `@seed.lockin.app`.
-- - Un id de prueba es anónimo sin perfil o con perfil de nombre de la suite,
--   o cuenta `device-…@lockin.app` sin perfil. Un perfil con otro nombre no se
--   borra desde aquí aunque lo pegues: revísalo a mano.
-- - El colateral sobre cuentas que se quedan coincide con el acuse.
-- - Se borran exactamente tantas filas como ids, no queda ningún perfil de
--   ellos y no queda ninguna cuenta `@seed.lockin.app`.

do $$
declare
  -- Los ocho de `supabase/seed.sql`. Fijos: no se editan.
  v_seed uuid[] := array[
    '11111111-1111-4111-8111-000000000001',
    '11111111-1111-4111-8111-000000000002',
    '11111111-1111-4111-8111-000000000003',
    '11111111-1111-4111-8111-000000000004',
    '11111111-1111-4111-8111-000000000005',
    '11111111-1111-4111-8111-000000000006',
    '11111111-1111-4111-8111-000000000007',
    '11111111-1111-4111-8111-000000000008'
  ]::uuid[];

  -- EDITAR 1/2 — ids de prueba confirmados en el inventario, entre comillas
  -- simples y separados por comas. Vacío = solo se borran los ocho de seed.
  v_prueba uuid[] := array[
  -- PRUEBAS: pega aquí los id
  ]::uuid[];

  -- EDITAR 2/2 — la fila TOTAL del inventario. Con -1 no pasa: obliga a mirarla.
  v_ac_decisiones bigint := -1;  -- ACUSE_DECISIONES
  v_ac_matches bigint := -1;  -- ACUSE_MATCHES
  v_ac_mensajes bigint := -1;  -- ACUSE_MENSAJES

  v_todos uuid[];
  v_fallo text;
  v_decisiones bigint;
  v_matches bigint;
  v_mensajes bigint;
  v_esperadas bigint;
  v_borradas bigint;
begin
  v_todos := v_seed || v_prueba;

  select string_agg(t.id::text, ', ') into v_fallo
  from unnest(v_todos) as t(id)
  where not exists (select 1 from auth.users u where u.id = t.id);
  if v_fallo is not null then
    raise exception 'No existen en auth.users (inventario desfasado o ya borrados): %', v_fallo;
  end if;

  select string_agg(t.id::text, ', ') into v_fallo
  from unnest(v_seed) as t(id)
  join auth.users u on u.id = t.id
  where coalesce(u.email, '') not like '%@seed.lockin.app';
  if v_fallo is not null then
    raise exception 'UUID de seed sin email @seed.lockin.app: %', v_fallo;
  end if;

  select string_agg(t.id::text || coalesce(' (' || p.name || ')', ''), ', ') into v_fallo
  from unnest(v_prueba) as t(id)
  join auth.users u on u.id = t.id
  left join public.profiles p on p.id = t.id
  where not (
    (coalesce(u.is_anonymous, false)
      and (p.id is null
           or p.name in ('Recíproca Par', 'Recíproca Lockin', 'Recíproca Ambos', 'Perfil Prueba')))
    or (coalesce(u.email, '') like 'device-%@lockin.app' and p.id is null)
  );
  if v_fallo is not null then
    raise exception 'No son reconocibles como prueba, revisar a mano: %', v_fallo;
  end if;

  select count(*) into v_decisiones
  from public.decisions d
  where (d.actor_id = any(v_todos)) <> (d.target_id = any(v_todos));

  select count(*) into v_matches
  from public.matches m
  where (m.profile_a = any(v_todos)) <> (m.profile_b = any(v_todos));

  select count(*) into v_mensajes
  from public.messages ms
  join public.matches m on m.id = ms.match_id
  where (m.profile_a = any(v_todos)) <> (m.profile_b = any(v_todos));

  if (v_decisiones, v_matches, v_mensajes)
     is distinct from (v_ac_decisiones, v_ac_matches, v_ac_mensajes) then
    raise exception
      'Colateral sobre cuentas que se quedan: % decisiones, % matches, % mensajes; el acuse dice %, %, %. Revisa el inventario antes de repetir.',
      v_decisiones, v_matches, v_mensajes,
      v_ac_decisiones, v_ac_matches, v_ac_mensajes;
  end if;

  v_esperadas := cardinality(v_todos);
  delete from auth.users where id = any(v_todos);
  get diagnostics v_borradas = row_count;
  if v_borradas <> v_esperadas then
    raise exception 'Se esperaban % cuentas borradas y se borraron %', v_esperadas, v_borradas;
  end if;

  if exists (select 1 from public.profiles where id = any(v_todos)) then
    raise exception 'Quedan perfiles de cuentas borradas: la cascada no ha actuado';
  end if;

  if exists (select 1 from auth.users where email like '%@seed.lockin.app') then
    raise exception 'Quedan cuentas @seed.lockin.app fuera de los ocho UUID: revisar';
  end if;
end;
$$;

select
  (select count(*) from auth.users) as cuentas_restantes,
  (select count(*) from auth.users where email like '%@seed.lockin.app') as seed_restantes,
  (select count(*) from public.profiles) as perfiles_restantes,
  (select count(*) from public.decisions) as decisiones_restantes,
  (select count(*) from public.matches) as matches_restantes,
  (select count(*) from public.messages) as mensajes_restantes;
