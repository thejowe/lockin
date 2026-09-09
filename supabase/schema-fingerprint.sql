-- LockIn — huella exacta del esquema `public`.
--
-- ## Para qué
--
-- Para cotejar, objeto a objeto, la base construida desde `supabase/migrations/`
-- con la que está desplegada. Es el complemento exacto de
-- `supabase/drift-check.mjs`: aquel corre solo y sin credenciales especiales,
-- pero solo ve lo que asoma por PostgREST; este ve políticas, CHECKs,
-- índices, triggers, defaults, permisos y objetos de más, a cambio de necesitar
-- acceso SQL a las dos bases.
--
-- ## Cómo se usa
--
-- 1. **Lado repo.** Levanta una base desde las migraciones y ejecuta este
--    archivo contra ella:
--
--        supabase start
--        supabase db reset --local --no-seed  # referencia de producción
--        psql "$(supabase status -o json | jq -r .DB_URL)" \
--          -XqAt -v ON_ERROR_STOP=1 -f supabase/schema-fingerprint.sql > /tmp/fingerprint.local.txt
--
--    (Necesita Docker. Si no lo tienes, este lado no se puede generar: dilo en
--    vez de comparar contra nada.)
--
-- 2. **Lado desplegado.** Pega este archivo entero en el SQL Editor del
--    dashboard del proyecto, ejecútalo, y exporta el resultado
--    (`Download CSV` o copiar la columna) a `/tmp/fingerprint.remote.txt`.
--
--    Esto no necesita `service_role` ni la contraseña de Postgres: el editor
--    del dashboard ya corre como superusuario. Alternativa automática:
--    schema-drift.yml + SUPABASE_SCHEMA_DB_URL (rol lector; ver README).
--    Para el comparador Node guardar texto sin cabecera CSV ni comillas CSV.
--
-- 3. **Cotejo.** Compara primero la línea `digest`. Si coincide, las dos bases
--    coinciden en los objetos cubiertos por esta consulta. Si no:
--
--        diff /tmp/fingerprint.local.txt /tmp/fingerprint.remote.txt
--
-- ## Funciones de desarrollo
--
-- El workflow exige el esquema de producción: si el remoto conserva funciones
-- de seed, sus líneas func/grantfn adicionales FALLAN; no se filtran del diff.
-- En local, reset con seed + dev-teardown debe equivaler a migrations sin seed.
-- El `md5` del cuerpo de una función cambia
-- también con un simple reformateo: para ver qué cambió de verdad,
-- `select pg_get_functiondef('public.nombre(args)'::regprocedure);` en los dos
-- lados.

-- CI: schema-ci.mjs ejecuta esta consulta en READ ONLY y con search_path fijo.
-- Para uso manual, fijarlo también: las funciones pg_get_* y regprocedure
-- califican nombres según search_path. No hay dependencia de la collation del
-- servidor para ordenar las líneas o calcular el digest.
set search_path = pg_catalog;

with
  -- Objetos que pertenecen a una extensión: no los ponemos nosotros y no son
  -- comparables entre un proyecto de Supabase y una base local. Los oid no son
  -- únicos entre catálogos, así que la pertenencia se filtra por (classid,
  -- objid) y no solo por objid.
  ext_rel as (
    select objid from pg_depend where deptype = 'e' and classid = 'pg_class'::regclass
  ),
  ext_proc as (
    select objid from pg_depend where deptype = 'e' and classid = 'pg_proc'::regclass
  ),
  rel as (
    select c.oid, c.relname, c.relrowsecurity, c.relacl, c.relowner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.oid not in (select objid from ext_rel)
  ),
  proc as (
    select
      p.oid,
      p.oid::regprocedure::text as ident,
      l.lanname,
      p.prosecdef,
      p.provolatile,
      p.proconfig,
      p.prosrc,
      p.proacl,
      p.proowner
    from pg_proc p
    join pg_language l on l.oid = p.prolang
    where p.pronamespace = 'public'::regnamespace
      and p.oid not in (select objid from ext_proc)
  ),
  lines as (
    select format('table    %s rls=%s', r.relname, r.relrowsecurity) as line
    from rel r

    union all
    select format(
      'column   %s.%s %s notnull=%s default=%s',
      r.relname,
      a.attname,
      format_type(a.atttypid, a.atttypmod),
      a.attnotnull,
      coalesce(pg_get_expr(d.adbin, d.adrelid), '-')
    )
    from rel r
    join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = r.oid and d.adnum = a.attnum

    union all
    select format('constr   %s.%s %s', r.relname, c.conname, pg_get_constraintdef(c.oid))
    from rel r
    join pg_constraint c on c.conrelid = r.oid

    union all
    select format('index    %s.%s %s', i.tablename, i.indexname, i.indexdef)
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename in (select relname from rel)

    union all
    select format(
      'enum     %s = %s',
      t.typname,
      string_agg(e.enumlabel, ',' order by e.enumsortorder)
    )
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
    group by t.typname

    union all
    select format(
      'func     %s args=%s returns=%s lang=%s security=%s volatile=%s config=%s body_md5=%s',
      p.ident,
      pg_get_function_arguments(p.oid),
      pg_get_function_result(p.oid),
      p.lanname,
      case when p.prosecdef then 'definer' else 'invoker' end,
      p.provolatile,
      coalesce(array_to_string(p.proconfig, ','), '-'),
      md5(coalesce(p.prosrc, ''))
    )
    from proc p

    union all
    select format('trigger  %s.%s %s', r.relname, t.tgname, pg_get_triggerdef(t.oid))
    from rel r
    join pg_trigger t on t.tgrelid = r.oid and not t.tgisinternal

    union all
    select format(
      'policy   %s.%s cmd=%s permissive=%s roles=%s using=%s check=%s',
      p.tablename,
      p.policyname,
      p.cmd,
      p.permissive,
      array_to_string(p.roles, ','),
      coalesce(p.qual, '-'),
      coalesce(p.with_check, '-')
    )
    from pg_policies p
    where p.schemaname = 'public'

    -- Los GRANT/REVOKE de tablas: es lo que hace que `anon` no vea nada.
    union all
    select format(
      'grant    %s %s %s',
      r.relname,
      case when g.grantee = 0 then 'PUBLIC' else pg_get_userbyid(g.grantee) end,
      g.privilege_type
    )
    from rel r,
         aclexplode(coalesce(r.relacl, acldefault('r', r.relowner))) g

    -- Y los de las funciones: `record_decision` y `discovery_deck` tienen el
    -- execute revocado de `public`/`anon` a propósito.
    union all
    select format(
      'grantfn  %s %s %s',
      p.ident,
      case when g.grantee = 0 then 'PUBLIC' else pg_get_userbyid(g.grantee) end,
      g.privilege_type
    )
    from proc p,
         aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g

    -- Realtime: si una tabla se cae de la publicación, los `subscribe()` del
    -- contrato dejan de recibir eventos sin que falle nada más.
    union all
    select format('publish  %s %s', t.pubname, t.tablename)
    from pg_publication_tables t
    where t.schemaname = 'public'
  )
select line
from (
  select 0 as ord, 'digest   ' || md5(string_agg(line, E'\n' order by line collate "C")) as line
  from lines
  union all
  select 1 as ord, line
  from lines
) fingerprint
order by ord, line collate "C";
