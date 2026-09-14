-- LockIn — borrar las cuentas de seed y de pruebas de una base desplegada.
--
-- ## Antes de ejecutarlo
--
-- 1. Ejecuta `supabase/cleanup/inventario.sql` y guarda su resultado.
-- 2. Revisa cada fila `prueba: …` y `revisar: …`. Solo pasan a este archivo las
--    que una persona haya confirmado como prueba.
-- 3. Rellena los dos bloques marcados con EDITAR. Nada más.
--
-- Lo ejecuta un administrador en el SQL Editor (borrar en `auth.users` exige
-- privilegios que ni la clave `anon` ni `lockin_schema_reader` tienen).
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
-- ## Guardias (cualquiera aborta la transacción entera y no borra nada)
--
-- - Todo id listado existe en `auth.users` (inventario desfasado o ya borrado).
-- - Los ocho de seed siguen teniendo email `@seed.lockin.app`.
-- - Un id de prueba es anónimo sin perfil o con perfil de nombre de la suite,
--   o cuenta `device-…@lockin.app` sin perfil. Un perfil con otro nombre no se
--   borra desde aquí aunque lo pegues: revísalo a mano.
-- - El colateral sobre cuentas que se quedan coincide con el acuse.
-- - Se borran exactamente tantas filas como ids, no queda ningún perfil de
--   ellos y no queda ninguna cuenta `@seed.lockin.app`.

begin;

create temp table borrar (
  id uuid primary key,
  motivo text not null check (motivo in ('seed', 'prueba'))
) on commit drop;

create temp table acuse (
  decisiones bigint not null,
  matches bigint not null,
  mensajes bigint not null
) on commit drop;

-- Los ocho de `supabase/seed.sql`. Fijos: no se editan.
insert into borrar (id, motivo) values
  ('11111111-1111-4111-8111-000000000001', 'seed'),
  ('11111111-1111-4111-8111-000000000002', 'seed'),
  ('11111111-1111-4111-8111-000000000003', 'seed'),
  ('11111111-1111-4111-8111-000000000004', 'seed'),
  ('11111111-1111-4111-8111-000000000005', 'seed'),
  ('11111111-1111-4111-8111-000000000006', 'seed'),
  ('11111111-1111-4111-8111-000000000007', 'seed'),
  ('11111111-1111-4111-8111-000000000008', 'seed');

-- EDITAR 1/2 — ids de prueba confirmados en el inventario, entre comillas
-- simples y separados por comas. Vacío = solo se borran los ocho de seed.
insert into borrar (id, motivo)
select id, 'prueba'
from unnest(array[
  -- PRUEBAS: pega aquí los id
]::uuid[]) as id;

-- EDITAR 2/2 — la fila TOTAL del inventario. Con -1 no pasa: obliga a mirarla.
insert into acuse (decisiones, matches, mensajes) values (
  -1,  -- ACUSE_DECISIONES
  -1,  -- ACUSE_MATCHES
  -1   -- ACUSE_MENSAJES
);

do $$
declare
  v_fallo text;
  v_decisiones bigint;
  v_matches bigint;
  v_mensajes bigint;
  v_acuse record;
  v_esperadas bigint;
  v_borradas bigint;
begin
  select string_agg(b.id::text, ', ') into v_fallo
  from borrar b
  where not exists (select 1 from auth.users u where u.id = b.id);
  if v_fallo is not null then
    raise exception 'No existen en auth.users (inventario desfasado o ya borrados): %', v_fallo;
  end if;

  select string_agg(b.id::text, ', ') into v_fallo
  from borrar b
  join auth.users u on u.id = b.id
  where b.motivo = 'seed' and coalesce(u.email, '') not like '%@seed.lockin.app';
  if v_fallo is not null then
    raise exception 'UUID de seed sin email @seed.lockin.app: %', v_fallo;
  end if;

  select string_agg(b.id::text || coalesce(' (' || p.name || ')', ''), ', ') into v_fallo
  from borrar b
  join auth.users u on u.id = b.id
  left join public.profiles p on p.id = b.id
  where b.motivo = 'prueba'
    and not (
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
  where (d.actor_id in (select id from borrar)) <> (d.target_id in (select id from borrar));

  select count(*) into v_matches
  from public.matches m
  where (m.profile_a in (select id from borrar)) <> (m.profile_b in (select id from borrar));

  select count(*) into v_mensajes
  from public.messages ms
  join public.matches m on m.id = ms.match_id
  where (m.profile_a in (select id from borrar)) <> (m.profile_b in (select id from borrar));

  select * into v_acuse from acuse;
  if (v_decisiones, v_matches, v_mensajes)
     is distinct from (v_acuse.decisiones, v_acuse.matches, v_acuse.mensajes) then
    raise exception
      'Colateral sobre cuentas que se quedan: % decisiones, % matches, % mensajes; el acuse dice %, %, %. Revisa el inventario antes de repetir.',
      v_decisiones, v_matches, v_mensajes,
      v_acuse.decisiones, v_acuse.matches, v_acuse.mensajes;
  end if;

  select count(*) into v_esperadas from borrar;
  delete from auth.users where id in (select id from borrar);
  get diagnostics v_borradas = row_count;
  if v_borradas <> v_esperadas then
    raise exception 'Se esperaban % cuentas borradas y se borraron %', v_esperadas, v_borradas;
  end if;

  if exists (select 1 from public.profiles where id in (select id from borrar)) then
    raise exception 'Quedan perfiles de cuentas borradas: la cascada no ha actuado';
  end if;

  if exists (select 1 from auth.users where email like '%@seed.lockin.app') then
    raise exception 'Quedan cuentas @seed.lockin.app fuera de los ocho UUID: revisar';
  end if;
end;
$$;

commit;

select
  (select count(*) from auth.users) as cuentas_restantes,
  (select count(*) from auth.users where email like '%@seed.lockin.app') as seed_restantes,
  (select count(*) from public.profiles) as perfiles_restantes,
  (select count(*) from public.decisions) as decisiones_restantes,
  (select count(*) from public.matches) as matches_restantes,
  (select count(*) from public.messages) as mensajes_restantes;
