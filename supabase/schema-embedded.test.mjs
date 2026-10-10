// Comprobación SQL parcial sin Docker. NO sustituye al workflow Supabase.
// Se corre con `npm run test:schema` —job «SQL embebido» de ci.yml—: PGlite 0.3.14
// es devDependency desde 2026-09-15, así que después de `npm ci` no hace falta
// nada más. PGLITE_MODULE (ruta absoluta al dist/index.js de una copia instalada
// fuera del repo, supabase/README.md) se sigue admitiendo y tiene prioridad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { compareFingerprints } from './schema-compare.mjs';
import { migrationSql, stripComments, parseMigrations } from './drift-check.mjs';

// Ya no lleva `skip`: con el paquete fuera del árbol, saltarse el test era lo
// razonable; ahora que viene con `npm ci`, que falte significa entorno a medio
// instalar, y un salto silencioso dejaría el job verde sin ejecutar una línea de
// SQL — que es peor que no tener job.
const pgliteModule = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href
  : '@electric-sql/pglite';

test('PostgreSQL embebido: migraciones, huella, rol lector, mutaciones y retirada', async (t) => {
  const { PGlite } = await import(pgliteModule);
  const db = new PGlite();
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    // Solo fixture de Auth: no GoTrue ni REST, ni seeds de cuentas.
    //
    // `auth.identities` es la tabla que GoTrue escribe al terminar el OAuth y de
    // la que `sync_github_verification()` lee la verdad. Sin ella la migración
    // del sello ni siquiera se ejecuta.
    //
    // Los `alter default privileges` NO son adorno de fidelidad: son lo que hace
    // que el test del sello signifique algo. Todo proyecto de Supabase los lleva
    // puestos sobre `public`, así que `authenticated` nace con el INSERT/UPDATE
    // de TABLA sobre cada tabla nueva —está en la huella real del despliegue,
    // `supabase/evidence/…/expected.txt`—. Sin emularlos aquí, `authenticated`
    // no tendría ningún permiso, cualquier escritura fallaría, y el test de
    // "no puedes encenderte el sello" pasaría por el motivo equivocado: un
    // verde que no prueba nada. Con ellos puestos, el único motivo por el que
    // el sello no se deja escribir es el permiso de columna de la migración.
    await db.exec(`create schema auth;
      create table auth.users (id uuid primary key, email text);
      create table auth.identities (
        provider_id text not null,
        user_id uuid not null,
        identity_data jsonb not null,
        provider text not null,
        primary key (provider, provider_id)
      );
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create role anon; create role authenticated; create role service_role;
      -- Supabase concede esto de fábrica fuera de cualquier migración —
      -- auth es un esquema gestionado por la plataforma, no por este repo.
      -- Hasta ahora ningún caso de esta fixture ejercitaba una política RLS
      -- SECURITY INVOKER llamando a auth.uid() directamente bajo el rol
      -- authenticated (las que sí lo hacían pasaban antes por una función
      -- SECURITY DEFINER, que ya eleva el privilegio); sin este grant esa
      -- ruta falla aquí con «permission denied for schema auth», y en el
      -- proyecto real no falla nunca, así que sin él la fixture mentiría.
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public
        grant all on tables to anon, authenticated, service_role;
      create publication supabase_realtime;
      -- Fixture de Realtime, por el mismo motivo que la de Auth: sin ella,
      -- la migración 20260917000100_realtime_authorization.sql ni se ejecuta. En
      -- Supabase el esquema realtime viene puesto y CERRADO —crear cosas dentro
      -- falla con permiso denegado—, así que aquí se emula lo justo que esa
      -- migración toca: la tabla, su RLS (que allí viene activada de fábrica, y
      -- la migración se niega a seguir si no lo está), los permisos con los que
      -- nace el rol authenticated y el helper realtime.topic(), que es de donde
      -- sale el nombre del canal al que el cliente se está uniendo.
      create schema realtime;
      create table realtime.messages (
        id uuid primary key default gen_random_uuid(),
        topic text not null,
        extension text not null,
        payload jsonb,
        event text,
        private boolean default false,
        inserted_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      alter table realtime.messages enable row level security;
      grant usage on schema realtime to anon, authenticated;
      grant select, insert on realtime.messages to authenticated;
      create function realtime.topic() returns text language sql stable
        as $$ select nullif(current_setting('realtime.topic', true), '') $$;`);
    const migrations = readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of migrations) {
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
    }
    // Barrido del catálogo después de TODAS las migraciones, incluidos los
    // grants por defecto de Supabase. RLS no protege TRUNCATE.
    const publicTables = (
      await db.query(`select tablename from pg_tables
      where schemaname = 'public' order by tablename`)
    ).rows.map((row) => row.tablename);
    assert.deepEqual(
      publicTables,
      [...parseMigrations(stripComments(migrationSql())).tables.keys()].sort()
    );
    for (const table of publicTables) {
      for (const role of ['anon', 'authenticated']) {
        await t.test(`${role}: public.${table} sin TRUNCATE/REFERENCES/TRIGGER`, async () => {
          const privileges = (
            await db.query(
              `select
            has_table_privilege($1, $2, 'TRUNCATE') as truncate,
            has_table_privilege($1, $2, 'REFERENCES') as references,
            has_table_privilege($1, $2, 'TRIGGER') as trigger`,
              [role, `public.${table}`]
            )
          ).rows[0];
          assert.deepEqual(privileges, { truncate: false, references: false, trigger: false });
        });
        await t.test(`${role}: TRUNCATE public.${table} denegado al ejecutarlo`, async () => {
          await db.exec(`begin; set local role ${role};`);
          try {
            // CASCADE evita que una FK dé un falso positivo (2BP01).
            // El rollback también protege la fixture si la regresión reaparece.
            await assert.rejects(
              db.exec(`truncate table public."${table}" cascade;`),
              (error) =>
                error.code === '42501' && error.message === `permission denied for table ${table}`
            );
          } finally {
            await db.exec('rollback;');
          }
        });
      }
    }
    // PGlite solo tiene una conexión (también con su worker multipestaña):
    // no puede probar dos transacciones compitiendo por el mismo bloqueo.
    // Inspeccionamos la definición instalada y, cuando se delega el FOR UPDATE,
    // también el helper. Las pruebas temporales de abajo no prueban contención.
    for (const signature of [
      'public.propose_session(uuid,timestamp with time zone,smallint)',
      'public.respond_session(uuid,public.session_status)',
      'public.cancel_session(uuid)',
      'public.join_session(uuid)',
      'public.rate_session(uuid,public.session_rating)',
    ]) {
      await t.test(`${signature}: captura el reloj después del bloqueo en BEGIN`, async () => {
        const definition = stripComments(
          (await db.query('select pg_get_functiondef($1::regprocedure) as definition', [signature]))
            .rows[0].definition
        );
        const begin = definition.search(/\bbegin\b/i);
        assert(begin >= 0);
        assert.match(definition.slice(0, begin), /\bv_now\s+timestamptz\s*;/i);
        assert.doesNotMatch(definition.slice(0, begin), /clock_timestamp\s*\(/i);
        const body = definition.slice(begin);
        const capture = /v_now\s*:=\s*clock_timestamp\(\);/i;
        assert.equal([...body.matchAll(/v_now\s*:=/gi)].length, 1);
        if (signature.includes('propose_session')) {
          assert.match(
            body,
            /select\s+\*\s+into\s+v_match\s+from\s+public\.matches\s+where\s+id\s*=\s*p_match_id\s+for update;\s*v_now\s*:=\s*clock_timestamp\(\);/i
          );
          assert(body.search(/for update/i) < body.search(capture));
        } else {
          assert.match(
            body,
            /begin\s+v_session\s*:=\s*public\.lock_member_session\(p_session_id\);\s*v_now\s*:=\s*clock_timestamp\(\);/i
          );
          const helper = stripComments(
            (
              await db.query(`select pg_get_functiondef(
              'public.lock_member_session(uuid)'::regprocedure) as definition`)
            ).rows[0].definition
          );
          assert.match(
            helper,
            /select\s+\*\s+into\s+v_session\s+from\s+public\.lockin_sessions\s+where\s+id\s*=\s*p_session_id\s+for update;/i
          );
          assert(helper.search(/for update/i) < helper.search(/return v_session;/i));
          // Orden efectivo: el helper adquiere el lock antes de devolver la fila;
          // la siguiente instrucción de la RPC captura el reloj.
          const expanded = body.replace('public.lock_member_session(p_session_id)', helper);
          assert(expanded.search(/for update/i) < expanded.search(capture));
        }
      });
    }
    const fingerprint = async () => {
      const results = await db.exec(readFileSync(join(here, 'schema-fingerprint.sql'), 'utf8'));
      return (
        results
          .at(-1)
          .rows.map((row) => row.line)
          .join('\n') + '\n'
      );
    };
    const expected = await fingerprint();
    console.log(
      `SQL ejecutado: ${migrations.length} migraciones; ${expected.split('\n')[0]}; ${expected.trimEnd().split('\n').length - 1} objetos`
    );
    assert.match(expected, /table\s+lockin_sessions rls=t/);
    assert.match(expected, /table\s+session_attendance rls=t/);
    assert.match(expected, /table\s+session_ratings rls=t/);
    // Las dos decisiones de privacidad de la valoración, leídas de la huella:
    // su política mira `auth.uid()` y no `is_session_member` —la otra persona
    // del match no la ve—, y la tabla no está publicada en realtime.
    const ratingPolicy = expected.match(/^policy\s+session_ratings\..*$/m)?.[0] ?? '';
    assert.match(ratingPolicy, /cmd=SELECT .*using=\(profile_id = \( SELECT auth\.uid\(\)/);
    assert.doesNotMatch(ratingPolicy, /is_session_member/);
    assert.doesNotMatch(expected, /publish\s+supabase_realtime session_ratings/);
    // Las reglas de "sesión viva" en SQL, contra la misma tabla de verdad que
    // `src/data/sessions.test.ts`. Es la única cobertura de estos bordes contra
    // Postgres: la suite de contrato de Supabase no puede esperar 30 minutos.
    const live = await db.query(`select
        public.session_is_live('propuesta', now() + interval '1 minute', 1::smallint, now()) as propuesta_futura,
        public.session_is_live('propuesta', now(), 1::smallint, now()) as propuesta_en_su_hora,
        public.session_is_live('aceptada', now() - interval '29 minutes', 1::smallint, now()) as aceptada_en_curso,
        public.session_is_live('aceptada', now() - interval '30 minutes', 1::smallint, now()) as aceptada_terminada,
        public.session_is_live('aceptada', now() - interval '100 minutes', 4::smallint, now()) as cuatro_bloques_en_curso,
        public.session_is_live('cancelada', now() + interval '1 hour', 1::smallint, now()) as cancelada,
        public.session_is_live('rechazada', now() + interval '1 hour', 1::smallint, now()) as rechazada`);
    assert.deepEqual(live.rows[0], {
      propuesta_futura: true,
      propuesta_en_su_hora: false,
      aceptada_en_curso: true,
      aceptada_terminada: false,
      cuatro_bloques_en_curso: true,
      cancelada: false,
      rechazada: false,
    });
    // Las reglas de la valoración en SQL. Es la única cobertura que tienen
    // contra Postgres: escribir una sesión ya terminada solo se puede aquí
    // —`propose_session` exige 5 minutos de margen, así que contra Supabase
    // real haría falta esperar media hora—, y por eso la suite de contrato
    // salta estos casos. Los datos van en una transacción que acaba en
    // rollback, como las mutaciones de más abajo.
    const ana = '00000000-0000-4000-8000-00000000aaaa';
    const bea = '00000000-0000-4000-8000-00000000bbbb';
    const match = '00000000-0000-4000-8000-00000000cccc';
    const session = (n) => `00000000-0000-4000-8000-00000000000${n}`;
    // Sesiones de un bloque, todas del mismo match. `mins` es lo que hace que
    // ya hayan terminado: con 40, el final quedó diez minutos atrás.
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'),
        ('${bea}', 'bea@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      ) values
        ('${ana}', 'Ana', 30, 'Madrid', 'Europe/Madrid', 'A',
         array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado'),
        ('${bea}', 'Bea', 31, 'Madrid', 'Europe/Madrid', 'B',
         array['diseno']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado');
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${match}', '${ana}', '${bea}', 'lockin');
      insert into public.lockin_sessions (id, match_id, proposed_by, starts_at, blocks, status, responded_at)
      select s.id::uuid, '${match}', '${ana}', now() - s.mins * interval '1 minute', 1,
             s.estado::public.session_status, now() - (s.mins + 60) * interval '1 minute'
      from (values
        ('${session(1)}', 40, 'aceptada'),
        ('${session(2)}', 40, 'aceptada'),
        ('${session(3)}', 40, 'aceptada'),
        ('${session(4)}', 40, 'aceptada'),
        ('${session(5)}', 40, 'cancelada'),
        ('${session(6)}', 1500, 'aceptada'),
        ('${session(7)}', 50, 'aceptada')
      ) as s(id, mins, estado);
      insert into public.session_attendance (session_id, profile_id, joined_at)
      select a.id::uuid, a.profile_id::uuid, now() - a.mins * interval '1 minute'
      from (values
        ('${session(1)}', '${ana}', 39), ('${session(1)}', '${bea}', 38),
        ('${session(2)}', '${ana}', 39),
        ('${session(4)}', '${ana}', 39), ('${session(4)}', '${bea}', 5),
        ('${session(5)}', '${ana}', 39), ('${session(5)}', '${bea}', 38),
        ('${session(6)}', '${ana}', 1499), ('${session(6)}', '${bea}', 1499),
        ('${session(7)}', '${ana}', 49), ('${session(7)}', '${bea}', 48)
      ) as a(id, profile_id, mins);`);
    const rating = await db.query(`select
        public.session_rating_window_is_open(now() - interval '29 minutes 59 seconds', 1::smallint, now()) as un_segundo_antes_del_final,
        public.session_rating_window_is_open(now() - interval '30 minutes', 1::smallint, now()) as justo_al_terminar,
        public.session_rating_window_is_open(now() - interval '13 hours', 1::smallint, now()) as dentro_de_la_ventana,
        public.session_rating_window_is_open(now() - interval '24 hours 30 minutes', 1::smallint, now()) as a_las_24_horas,
        public.session_both_attended('${session(1)}') as entraron_los_dos,
        public.session_both_attended('${session(2)}') as entro_solo_una,
        public.session_both_attended('${session(3)}') as no_entro_nadie,
        public.session_both_attended('${session(4)}') as entro_despues_del_final`);
    assert.deepEqual(rating.rows[0], {
      un_segundo_antes_del_final: false,
      justo_al_terminar: true,
      dentro_de_la_ventana: true,
      a_las_24_horas: false,
      entraron_los_dos: true,
      entro_solo_una: false,
      no_entro_nadie: false,
      entro_despues_del_final: false,
    });
    // Y el RPC entero, que es quien decide qué error sale por cada puerta.
    // `auth.uid()` se sustituye por Ana dentro de la transacción: es la
    // fixture de Auth de este archivo, no un objeto de `public`. Cada sonda
    // de error va en un savepoint porque un `raise` aborta la transacción.
    await db.exec(
      `create or replace function auth.uid() returns uuid language sql as $$ select '${ana}'::uuid $$;`
    );
    const errcode = async (sql) => {
      await db.exec('savepoint sonda;');
      try {
        await db.query(sql);
        return 'sin error';
      } catch (error) {
        return error.code;
      } finally {
        await db.exec('rollback to savepoint sonda;');
      }
    };
    // PGlite tiene una sola conexión: como en salas, cruzamos el límite
    // dentro de una transacción abierta. No simula contención entre conexiones.
    for (const boundary of [
      {
        name: 'propose_session',
        offset: '5 minutes',
        status: 'propuesta',
        code: 'LI003',
        sql: `select public.propose_session('${match}',
          (select starts_at from public.lockin_sessions where id = '${session(3)}'), 1::smallint)`,
      },
      {
        name: 'respond_session',
        offset: '0 seconds',
        status: 'propuesta',
        code: 'LI002',
        sql: `select public.respond_session('${session(3)}', 'aceptada')`,
      },
      {
        name: 'cancel_session',
        offset: '0 seconds',
        status: 'aceptada',
        code: 'LI002',
        sql: `select public.cancel_session('${session(3)}')`,
      },
      {
        name: 'join_session',
        offset: '-30 minutes',
        status: 'aceptada',
        code: 'LI003',
        sql: `select public.join_session('${session(3)}')`,
      },
      {
        name: 'rate_session',
        offset: '-24 hours -30 minutes',
        status: 'aceptada',
        code: 'LI003',
        sql: `select public.rate_session('${session(3)}', 'bien')`,
      },
    ]) {
      await t.test(`${boundary.name}: rechaza tras el plazo con now() obsoleto`, async () => {
        await db.exec('savepoint clock_case;');
        try {
          await db.exec(`delete from public.lockin_sessions where id <> '${session(3)}';
            update public.lockin_sessions set status = '${boundary.status}',
              responded_at = case when '${boundary.status}' = 'propuesta' then null else now() end,
              starts_at = clock_timestamp() + interval '${boundary.offset}' + interval '1 second'
              where id = '${session(3)}';
            insert into public.session_attendance (session_id, profile_id, joined_at)
              select lockin_sessions.id, p.id, starts_at from public.lockin_sessions
              cross join (values ('${ana}'::uuid), ('${bea}'::uuid)) p(id);
            create or replace function auth.uid() returns uuid language sql
              as $$ select '${bea}'::uuid $$;
            set local role authenticated;`);
          // Control positivo antes del cierre; errcode revierte la mutación.
          if (boundary.name === 'propose_session') {
            await db.exec('reset role;');
            await db.exec(
              `update public.lockin_sessions set status = 'cancelada', responded_at = now(); set local role authenticated;`
            );
          }
          assert.equal(await errcode(boundary.sql), 'sin error', 'la RPC funciona antes del plazo');
          await db.exec(`do $$ declare until_at timestamptz := clock_timestamp() + interval '1.5 seconds';
            begin while clock_timestamp() < until_at loop end loop; end $$;`);
          const clocks = (
            await db.query(`select
            now() < starts_at - interval '${boundary.offset}' as old_clock,
            clock_timestamp() >= starts_at - interval '${boundary.offset}' as current_clock
            from public.lockin_sessions where id = '${session(3)}'`)
          ).rows[0];
          assert.deepEqual(clocks, { old_clock: true, current_clock: true });
          assert.equal(await errcode(boundary.sql), boundary.code);
        } finally {
          await db.exec('rollback to savepoint clock_case;');
        }
      });
    }
    const ratable = async () =>
      (await db.query(`select id from public.ratable_session('${match}')`)).rows.map((r) => r.id);
    const rate = (id, value) => db.query(`select * from public.rate_session('${id}', '${value}')`);
    // Con dos valorables se ofrece la más reciente; la 7 termina antes.
    assert.deepEqual(await ratable(), [session(1)]);
    const primera = (await rate(session(1), 'genial')).rows[0];
    const repetida = (await rate(session(1), 'genial')).rows[0];
    assert.deepEqual(
      {
        valorada: primera.rating,
        escrita_por: primera.profile_id,
        idempotente: repetida.rated_at.getTime() === primera.rated_at.getTime(),
        otro_valor: await errcode(`select public.rate_session('${session(1)}', 'floja')`),
        solo_una_asistencia: await errcode(`select public.rate_session('${session(2)}', 'bien')`),
        // Cancelada, pero dentro de su ventana:
        // `session_rating_window_is_open` no recibe el estado, así que sin
        // la comprobación aparte y primera de `rate_session` una sesión que
        // nunca llegó a celebrarse se valoraría sin más.
        cancelada: await errcode(`select public.rate_session('${session(5)}', 'bien')`),
        fuera_de_las_24_horas: await errcode(`select public.rate_session('${session(6)}', 'bien')`),
        // Valorada deja de pedirse; la otra sigue en su ventana.
        siguiente: await ratable(),
      },
      {
        valorada: 'genial',
        escrita_por: ana,
        idempotente: true,
        otro_valor: 'LI001',
        solo_una_asistencia: 'LI004',
        cancelada: 'LI004',
        fuera_de_las_24_horas: 'LI003',
        siguiente: [session(7)],
      }
    );
    await db.exec('rollback;');
    // Las rachas en SQL. Igual que la valoración, es la única cobertura de las
    // cadenas contra Postgres: contra Supabase real solo cabe una sesión viva
    // por match, así que una racha de 2 no se puede escribir sin esperar. Todo
    // en una transacción que acaba en rollback, con `auth.uid()` sustituida.
    //
    // Minutos hacia atrás desde `now()`; un día son 1440 y 7 días, 10080. Un
    // bloque dura 30 minutos, cuatro bloques 120. Cada match de Ana prueba una
    // regla, y en todos la última sesión que cuenta terminó hace menos de 7 días
    // salvo en el de Dani.
    const person = (suffix) => `00000000-0000-4000-8000-00000000${suffix}`;
    const [carla, dani, eva, fran] = ['ccc1', 'ccc2', 'ccc3', 'ccc4'].map(person);
    const pair = (n) => `00000000-0000-4000-8000-00000000e00${n}`;
    const shared = (n) => `00000000-0000-4000-8000-0000000f00${n}`;
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'), ('${bea}', 'bea@lockin.test'),
        ('${carla}', 'carla@lockin.test'), ('${dani}', 'dani@lockin.test'),
        ('${eva}', 'eva@lockin.test'), ('${fran}', 'fran@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, p.name, 30, 'Madrid', 'Europe/Madrid', left(p.name, 1),
             array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values
        ('${ana}', 'Ana'), ('${bea}', 'Bea'), ('${carla}', 'Carla'),
        ('${dani}', 'Dani'), ('${eva}', 'Eva'), ('${fran}', 'Fran')
      ) as p(id, name);
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${pair(1)}', '${ana}', '${bea}', 'lockin'),
        ('${pair(2)}', '${ana}', '${carla}', 'lockin'),
        ('${pair(3)}', '${ana}', '${dani}', 'lockin'),
        ('${pair(4)}', '${ana}', '${eva}', 'lockin'),
        ('${pair(5)}', '${ana}', '${fran}', 'lockin'),
        ('${pair(6)}', '${bea}', '${carla}', 'lockin');
      insert into public.lockin_sessions (id, match_id, proposed_by, starts_at, blocks, status, responded_at)
      select s.id::uuid, s.match_id::uuid, m.profile_a, now() - s.mins * interval '1 minute',
             s.blocks::smallint, s.estado::public.session_status,
             now() - (s.mins + 60) * interval '1 minute'
      from (values
        -- Bea: tres seguidas. La primera es de 4 bloques y la segunda empieza
        -- 6 días y 23 horas después de su final —7 días y 1 hora después de su
        -- inicio—: el hueco se mide desde el final. La tercera, 6 días después.
        ('${shared(11)}', '${pair(1)}', 20000, 4, 'aceptada'),
        ('${shared(12)}', '${pair(1)}', 9860, 1, 'aceptada'),
        ('${shared(13)}', '${pair(1)}', 1190, 1, 'aceptada'),
        -- Carla: dos seguidas y luego 7 días exactos de hueco. Queda la última
        -- cadena, de 1, no la más larga.
        ('${shared(21)}', '${pair(2)}', 19970, 1, 'aceptada'),
        ('${shared(22)}', '${pair(2)}', 11300, 1, 'aceptada'),
        ('${shared(23)}', '${pair(2)}', 1190, 1, 'aceptada'),
        -- Dani: dos seguidas, la última terminada hace 8 días.
        ('${shared(31)}', '${pair(3)}', 20190, 1, 'aceptada'),
        ('${shared(32)}', '${pair(3)}', 11550, 1, 'aceptada'),
        -- Eva: un plantón en medio de dos seguidas.
        ('${shared(41)}', '${pair(4)}', 10000, 1, 'aceptada'),
        ('${shared(42)}', '${pair(4)}', 7000, 1, 'aceptada'),
        ('${shared(43)}', '${pair(4)}', 1330, 1, 'aceptada'),
        -- Fran: una cancelada, con las dos asistencias, en medio de dos seguidas.
        ('${shared(51)}', '${pair(5)}', 10000, 1, 'aceptada'),
        ('${shared(52)}', '${pair(5)}', 5000, 1, 'cancelada'),
        ('${shared(53)}', '${pair(5)}', 1330, 1, 'aceptada'),
        -- Bea y Carla, sin Ana.
        ('${shared(61)}', '${pair(6)}', 1000, 1, 'aceptada')
      ) as s(id, match_id, mins, blocks, estado)
      join public.matches m on m.id = s.match_id::uuid;
      -- Las dos personas entran un minuto después del inicio, salvo en el plantón.
      insert into public.session_attendance (session_id, profile_id, joined_at)
      select s.id, p.profile_id, s.starts_at + interval '1 minute'
      from public.lockin_sessions s
      join public.matches m on m.id = s.match_id
      cross join lateral (values (m.profile_a), (m.profile_b)) as p(profile_id)
      where s.match_id::text like '%e00_'
        and not (s.id = '${shared(42)}' and p.profile_id = '${ana}');`);
    const asActor = (id) =>
      db.exec(
        `create or replace function auth.uid() returns uuid language sql as $$ select '${id}'::uuid $$;`
      );
    const streaks = async () =>
      (
        await db.query(`select match_id, streak_count,
            extract(epoch from alive_until - now())::integer / 60 as minutos_de_vida
          from public.match_streaks()
          order by match_id`)
      ).rows;
    await asActor(ana);
    const deAna = await streaks();
    assert.deepEqual(deAna, [
      { match_id: pair(1), streak_count: 3, minutos_de_vida: 10080 - 1160 },
      { match_id: pair(2), streak_count: 1, minutos_de_vida: 10080 - 1160 },
      { match_id: pair(4), streak_count: 2, minutos_de_vida: 10080 - 1300 },
      { match_id: pair(5), streak_count: 2, minutos_de_vida: 10080 - 1300 },
    ]);
    // Las dos personas ven lo mismo, y la de Bea con Carla existe: si Ana no la
    // ve es por el filtro del actor, no por falta de datos.
    await asActor(bea);
    assert.deepEqual(await streaks(), [
      { match_id: pair(1), streak_count: 3, minutos_de_vida: 10080 - 1160 },
      { match_id: pair(6), streak_count: 1, minutos_de_vida: 10080 - 970 },
    ]);
    // Valorar no mueve la racha: ni con `floja` de un lado y `genial` del otro,
    // ni en la sesión que cierra la cadena.
    await db.exec(`insert into public.session_ratings (session_id, profile_id, rating)
      select s.id, p.profile_id, case when p.profile_id = m.profile_a then 'floja' else 'genial' end::public.session_rating
      from public.lockin_sessions s
      join public.matches m on m.id = s.match_id
      cross join lateral (values (m.profile_a), (m.profile_b)) as p(profile_id)
      where s.match_id::text like '%e00_';`);
    await asActor(ana);
    assert.deepEqual(await streaks(), deAna);
    // Sin zona horaria: los 7 días son 168 horas exactas aunque la sesión
    // tenga una zona con cambio de hora dentro de la ventana. Una zona POSIX
    // inventada adelanta la hora a medianoche de dentro de 3 días (juliano sin
    // 29 de febrero), así que siempre cae entre el final de la última sesión y
    // su caducidad, sea cual sea la fecha en que corra el test. Con
    // `interval '7 days'` la caducidad saldría una hora antes.
    const julianDay = (ms) => {
      const date = new Date(ms);
      const year = date.getUTCFullYear();
      const day = Math.floor((ms - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
      const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
      return leap && day >= 60 ? day - 1 : day;
    };
    const dstStart = julianDay(Date.now() + 3 * 86_400_000);
    await db.exec(
      `set local timezone = 'RCH0RCV,J${dstStart}/0,J${((dstStart + 59) % 365) + 1}/0';`
    );
    const calendarWeek = await db.query(
      `select extract(epoch from (now() + interval '7 days') - now())::integer / 3600 as horas`
    );
    assert.equal(calendarWeek.rows[0].horas, 167, 'la zona de prueba no cambia de hora');
    assert.deepEqual(await streaks(), deAna);
    await db.exec('set local timezone = utc;');
    // Y no puede depender de la valoración porque no la lee: ni la función ni
    // el helper de asistencia que usa nombran la tabla. Es la decisión de
    // privacidad de la spec de valoración; no se relaja para que pase un test.
    const definitions = await db.query(`select
        pg_get_functiondef('public.match_streaks()'::regprocedure) as rachas,
        pg_get_functiondef('public.session_both_attended(uuid)'::regprocedure) as asistencia,
        p.prosecdef as security_definer,
        p.proconfig as config,
        has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_ejecuta
      from pg_proc p where p.oid = 'public.match_streaks()'::regprocedure`);
    const streakFn = definitions.rows[0];
    assert.doesNotMatch(streakFn.rachas, /session_ratings/);
    assert.doesNotMatch(streakFn.asistencia, /session_ratings/);
    assert.deepEqual(
      {
        security_definer: streakFn.security_definer,
        config: streakFn.config,
        anon_ejecuta: streakFn.anon_ejecuta,
        authenticated_ejecuta: streakFn.authenticated_ejecuta,
      },
      {
        security_definer: true,
        config: ['search_path=""'],
        anon_ejecuta: false,
        authenticated_ejecuta: true,
      }
    );
    await db.exec('rollback;');
    // --- Acuerdo de socios ---------------------------------------------------
    //
    // El test central del bloque: `match_agreement` NO enseña la respuesta del
    // otro en un tema si tú no has respondido ese tema, pero sí dice que la ha
    // dado. Es el ciego, y lo impone Postgres: si se rompe aquí, la UI no tiene
    // nada que tapar. Además: solo matches Par (LI005), solo miembros (LI004),
    // solo por RPC (un insert directo de `authenticated` falla), y los `check`.
    const cai = '00000000-0000-4000-8000-00000000000c';
    const par = '00000000-0000-4000-8000-0000000acce0';
    const lockin = '00000000-0000-4000-8000-0000000acce1';
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'), ('${bea}', 'bea@lockin.test'), ('${cai}', 'cai@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      ) values
        ('${ana}', 'Ana', 30, 'Madrid', 'Europe/Madrid', 'A',
         array['dev']::public.specialty[], 'par', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado'),
        ('${bea}', 'Bea', 31, 'Madrid', 'Europe/Madrid', 'B',
         array['diseno']::public.specialty[], 'par', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado'),
        ('${cai}', 'Cai', 32, 'Madrid', 'Europe/Madrid', 'C',
         array['datos']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado');
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${par}', '${ana}', '${bea}', 'par'),
        -- El check de orden del par exige profile_a < profile_b; el id de
        -- Cai ordena antes que el de Ana, así que aquí va primero.
        ('${lockin}', '${cai}', '${ana}', 'lockin');`);
    // Sustituir `auth.uid()` exige ser el dueño, no `authenticated`: se sale
    // del rol, se cambia el actor y se vuelve a entrar.
    const actingAs = (id) =>
      db.exec(`reset role;
        create or replace function auth.uid() returns uuid language sql as $$ select '${id}'::uuid $$;
        set local role authenticated;`);
    const sonda = async (sql) => {
      await db.exec('savepoint sonda;');
      try {
        await db.query(sql);
        return 'sin error';
      } catch (error) {
        return error.code ?? error.message;
      } finally {
        await db.exec('rollback to savepoint sonda;');
      }
    };
    const responde = (topic, option, note = null) =>
      db.query(
        `select * from public.answer_agreement_topic('${par}', '${topic}', '${option}', ${
          note === null ? 'null' : `'${note}'`
        })`
      );
    const vista = async () =>
      (await db.query(`select * from public.match_agreement('${par}')`)).rows;

    // Bea responde dos temas; Ana, solo uno de ellos.
    await actingAs(bea);
    await responde('dedicacion', 'completa', 'Lo dejo todo');
    await responde('decisiones', 'consenso');
    await actingAs(ana);
    await responde('dedicacion', '10-25h');
    await responde('horizonte', '1-ano');
    // Responder otra vez sustituye, no duplica.
    await responde('horizonte', '3-meses', 'Mejor corto');
    const porTema = Object.fromEntries((await vista()).map((row) => [row.topic, row]));
    assert.deepEqual(
      {
        temas: Object.keys(porTema).sort(),
        dedicacion_suya: [porTema.dedicacion.theirs_option, porTema.dedicacion.theirs_note],
        decisiones_oculta: [
          porTema.decisiones.theirs_answered,
          porTema.decisiones.theirs_option,
          porTema.decisiones.theirs_note,
          porTema.decisiones.theirs_updated_at,
        ],
        horizonte: [
          porTema.horizonte.mine_option,
          porTema.horizonte.mine_note,
          porTema.horizonte.theirs_answered,
        ],
      },
      {
        temas: ['decisiones', 'dedicacion', 'horizonte'],
        dedicacion_suya: ['completa', 'Lo dejo todo'],
        decisiones_oculta: [true, null, null, null],
        horizonte: ['3-meses', 'Mejor corto', false],
      },
      'el ciego: sin tu respuesta, sabes que la hay pero no cuál es'
    );
    assert.deepEqual(
      {
        lockin: await sonda(
          `select public.answer_agreement_topic('${lockin}', 'dedicacion', 'completa', null)`
        ),
        lockin_lectura: await sonda(`select * from public.match_agreement('${lockin}')`),
        clave_invalida: await sonda(
          `select public.answer_agreement_topic('${par}', 'Dedicación!', 'completa', null)`
        ),
        nota_larga: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', '${'x'.repeat(281)}')`
        ),
        nota_vacia: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', '')`
        ),
        insert_directo: await sonda(
          `insert into public.agreement_answers (match_id, profile_id, topic, option)
           values ('${par}', '${ana}', 'dinero-propio', 'nada')`
        ),
        update_directo: await sonda(
          `update public.agreement_answers set option = 'completa' where profile_id = '${bea}'`
        ),
      },
      {
        lockin: 'LI005',
        lockin_lectura: 'LI005',
        clave_invalida: '23514',
        nota_larga: '23514',
        nota_vacia: '23514',
        insert_directo: '42501',
        update_directo: '42501',
      }
    );
    // Lectura directa de la tabla: solo las tuyas.
    const directas = await db.query('select profile_id from public.agreement_answers');
    assert.deepEqual([...new Set(directas.rows.map((row) => row.profile_id))], [ana]);
    // Un tercero que no está en el match no lee ni escribe.
    await actingAs(cai);
    assert.deepEqual(
      {
        lee: await sonda(`select * from public.match_agreement('${par}')`),
        escribe: await sonda(
          `select public.answer_agreement_topic('${par}', 'dedicacion', 'completa', null)`
        ),
      },
      { lee: 'LI004', escribe: 'LI004' }
    );
    await db.exec('reset role');
    // Ni publicación en realtime, ni ejecución para anon.
    assert.doesNotMatch(expected, /publish\s+supabase_realtime agreement_answers/);
    const ejecutables = await db.query(`select
        has_function_privilege('anon', 'public.match_agreement(uuid)', 'EXECUTE') as anon_lee,
        has_function_privilege('anon', 'public.answer_agreement_topic(uuid, text, text, text)', 'EXECUTE') as anon_escribe,
        has_function_privilege('authenticated', 'public.match_agreement(uuid)', 'EXECUTE') as auth_lee`);
    assert.deepEqual(ejecutables.rows[0], { anon_lee: false, anon_escribe: false, auth_lee: true });
    await db.exec('rollback;');
    // --- Modo del match: el del deck, no el de la sesión ---------------------
    //
    // Hallazgo del comprobador (2026-09-29): con la sesión en `par` y el chip
    // del deck en Lock-In, un like a alguien que busca Lock-In creaba un match
    // Par, porque `record_decision` resolvía con `coalesce(active_mode, …)` y el
    // chip no le llegaba. `20260929000100` le añade `p_mode`, opcional: sin él,
    // lo de siempre. Ana está en `par`; Bea (`ambos`) y Cai (`lockin`) ya le han
    // dado like, así que cualquier like de Ana cierra match.
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'), ('${bea}', 'bea@lockin.test'), ('${cai}', 'cai@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, p.name, 30, 'Madrid', 'Europe/Madrid', left(p.name, 1),
             array['dev']::public.specialty[], p.looking_for::public.mode_preference,
             'solo-ganas', 10, array['tarde']::public.time_band[], 'equilibrado'
      from (values
        ('${ana}', 'Ana', 'ambos'), ('${bea}', 'Bea', 'ambos'), ('${cai}', 'Cai', 'lockin')
      ) as p(id, name, looking_for);
      insert into public.user_settings (user_id, active_mode) values ('${ana}', 'par');
      insert into public.decisions (actor_id, target_id, decision) values
        ('${bea}', '${ana}', 'like'), ('${cai}', '${ana}', 'like');`);
    await actingAs(ana);
    const modoDelMatch = async (sql) => (await db.query(sql)).rows[0].mode;
    assert.deepEqual(
      {
        // Sin `p_mode`, la llamada de siempre: manda el activo de la sesión.
        sin_modo: await modoDelMatch(`select (public.record_decision('${bea}', 'like')).mode`),
        // El caso del hallazgo: chip Lock-In, perfil que busca Lock-In.
        chip_lockin: await modoDelMatch(
          `select (public.record_decision('${cai}', 'like', 'lockin')).mode`
        ),
      },
      { sin_modo: 'par', chip_lockin: 'lockin' }
    );
    // Y con `p_mode` explícito a `ambos` vuelve a decidir el otro lado, no la
    // sesión: es lo que pasa en el deck con el chip «Ambos».
    await db.exec(`reset role;
      delete from public.matches;
      delete from public.decisions where actor_id = '${ana}';
      set local role authenticated;`);
    assert.equal(
      await modoDelMatch(`select (public.record_decision('${cai}', 'like', 'ambos')).mode`),
      'lockin'
    );
    await db.exec('reset role');
    // Una sola firma: una sobrecarga vieja de dos argumentos junto a la nueva
    // haría ambigua cualquier llamada sin `p_mode`. Y los permisos y el
    // `search_path` de la original, que la nueva no puede perder al recrearse.
    const decisionFn = await db.query(`select
        (count(*) over ())::integer as firmas,
        pg_get_function_identity_arguments(p.oid) as firma,
        p.prosecdef as security_definer,
        p.proconfig as config,
        has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_ejecuta
      from pg_proc p
      where p.proname = 'record_decision' and p.pronamespace = 'public'::regnamespace`);
    assert.deepEqual(decisionFn.rows, [
      {
        firmas: 1,
        firma: 'p_target_id uuid, p_decision public.decision, p_mode public.mode_preference',
        security_definer: true,
        config: ['search_path=""'],
        anon_ejecuta: false,
        authenticated_ejecuta: true,
      },
    ]);
    await db.exec('rollback;');
    // --- Verificación de GitHub ---------------------------------------------
    //
    // El test central del bloque, y no es que el sello se encienda: es que NO se
    // pueda encender a mano. La clave anon viaja en el bundle, así que cualquier
    // usuario puede mandar el PATCH que quiera contra `profiles`; lo único que
    // separa eso de una insignia falsa es el permiso de columna de
    // `20260916000100`. Aquí se comprueba con el rol `authenticated` de verdad,
    // que en este fixture llega con los mismos permisos de tabla que en Supabase.
    //
    // Cada rechazo va en un savepoint: un error aborta la transacción entera.
    await db.exec(`begin;
      insert into auth.users (id, email) values ('${ana}', 'ana@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      ) values
        ('${ana}', 'Ana', 30, 'Madrid', 'Europe/Madrid', 'A',
         array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado');`);
    // La guardia del peaje de la migración: el sello son las DOS únicas columnas
    // de `profiles` cerradas a `authenticated`. Se lee de la tabla real, así que
    // una columna nueva que nadie vuelva a conceder sale por aquí en rojo en vez
    // de quedarse en solo-lectura sin que se entere nadie.
    const permisos = await db.query(`select a.attname,
        has_column_privilege('authenticated', 'public.profiles', a.attname, 'INSERT') as inserta,
        has_column_privilege('authenticated', 'public.profiles', a.attname, 'UPDATE') as actualiza,
        has_column_privilege('authenticated', 'public.profiles', a.attname, 'SELECT') as lee
      from pg_attribute a
      where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum`);
    assert.deepEqual(
      permisos.rows.filter((c) => !c.inserta || !c.actualiza).map((c) => c.attname),
      ['github_handle', 'github_verified_at'],
      'el sello, y solo el sello, está cerrado a authenticated'
    );
    assert.deepEqual(
      permisos.rows.filter((c) => !c.lee).map((c) => c.attname),
      [],
      'el sello se lee: es lo que pinta la insignia'
    );
    await asActor(ana);
    await db.exec('set local role authenticated');
    const rechaza = async (sql, pattern, message) => {
      await db.exec('savepoint sonda;');
      await assert.rejects(() => db.exec(sql), pattern, message);
      await db.exec('rollback to savepoint sonda;');
    };
    await rechaza(
      `update public.profiles set github_verified_at = now() where id = '${ana}';`,
      /permission denied|no privileges/i,
      'authenticated no debe poder encenderse el sello a mano'
    );
    await rechaza(
      `update public.profiles set github_handle = 'torvalds' where id = '${ana}';`,
      /permission denied|no privileges/i,
      'authenticated no debe poder escribir el handle a mano'
    );
    // Y por la otra puerta: el perfil se crea con un `.upsert()`, así que un
    // INSERT abierto sería el mismo agujero con el sello ya encendido de fábrica.
    await rechaza(
      `insert into public.profiles (
         id, name, age, location, timezone, avatar_initials, specialties,
         looking_for, starting_point, availability_hours_per_week,
         availability_bands, ambition, link_github, github_handle, github_verified_at
       ) values ('${bea}', 'Bea', 31, 'Madrid', 'Europe/Madrid', 'B',
         array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
         array['tarde']::public.time_band[], 'equilibrado',
         'https://github.com/torvalds', 'torvalds', now());`,
      /permission denied|no privileges/i,
      'tampoco se nace con el sello puesto'
    );
    // Pero el enlace sin sello SÍ se escribe: es un campo del formulario.
    await db.exec(
      `update public.profiles set link_github = 'https://github.com/loquesea' where id = '${ana}';`
    );
    await db.exec('reset role');
    // Con identidad, la función enciende el sello y deriva el enlace. La
    // identidad la escribe GoTrue, no el cliente: por eso se siembra fuera del
    // rol `authenticated`, que no tiene nada que hacer en el esquema `auth`.
    await db.exec(`insert into auth.identities (provider_id, user_id, identity_data, provider)
      values ('12345', '${ana}', '{"user_name":"anagarcia"}'::jsonb, 'github');`);
    await db.exec('set local role authenticated');
    await db.exec('select public.sync_github_verification();');
    const sello = await db.query(
      `select github_handle, github_verified_at, link_github from public.profiles where id = '${ana}';`
    );
    assert.equal(sello.rows[0].github_handle, 'anagarcia');
    assert.equal(
      sello.rows[0].link_github,
      'https://github.com/anagarcia',
      'el enlace que el usuario había escrito a mano queda sustituido por el de la identidad'
    );
    assert.ok(sello.rows[0].github_verified_at, 'la fecha debe quedar puesta');
    // Resincronizar no rejuvenece un sello que ya existía.
    await db.exec('select public.sync_github_verification();');
    const resello = await db.query(
      `select github_verified_at from public.profiles where id = '${ana}';`
    );
    assert.equal(
      resello.rows[0].github_verified_at.getTime(),
      sello.rows[0].github_verified_at.getTime(),
      'el `coalesce` de la función: la fecha es la del primer sello'
    );
    // Con el sello puesto, vaciar el enlace tampoco vale. Es el caso que la
    // lógica de tres valores se come si la constraint se escribe sin el
    // `link_github is not null`: la igualdad daría NULL, `false or null` es NULL
    // —no FALSE—, y un CHECK solo rechaza en FALSE, así que pasaría.
    //
    // Va aquí, y no con los otros casos de sello a medias, porque solo
    // significa algo con el sello ENCENDIDO y como `authenticated`: `link_github`
    // es columna abierta, así que este UPDATE es algo que el usuario verificado
    // puede intentar de verdad desde el cliente. Lo único que lo para es la
    // constraint.
    await rechaza(
      `update public.profiles set link_github = null where id = '${ana}';`,
      /profiles_github_link_matches_handle/i,
      'con sello, el enlace no se puede vaciar'
    );
    // Y sin identidad, lo apaga: un solo camino de escritura para las dos cosas.
    await db.exec('reset role');
    await db.exec(`delete from auth.identities where user_id = '${ana}';`);
    await db.exec('set local role authenticated');
    await db.exec('select public.sync_github_verification();');
    const apagado = await db.query(
      `select github_handle, github_verified_at, link_github from public.profiles where id = '${ana}';`
    );
    assert.equal(apagado.rows[0].github_handle, null);
    assert.equal(apagado.rows[0].github_verified_at, null);
    assert.equal(apagado.rows[0].link_github, null);
    await db.exec('reset role');
    // Un sello a medias no debe poder existir ni desde postgres.
    await rechaza(
      `update public.profiles set github_handle = 'solo-handle' where id = '${ana}';`,
      /profiles_github_verification_complete|profiles_github_link_matches_handle/i,
      'el sello no puede quedar a medias'
    );
    // Ni un sello entero apuntando a la cuenta de otro: es el ataque original
    // entrando por la ventana.
    await rechaza(
      `update public.profiles
         set github_handle = 'anagarcia', github_verified_at = now(),
             link_github = 'https://github.com/otrapersona'
       where id = '${ana}';`,
      /profiles_github_link_matches_handle/i,
      'con sello, el enlace ES el de la identidad'
    );
    // La función es la puerta y la puerta no tiene picaporte: CERO argumentos,
    // así que no hay nada que el cliente pueda pasarle. Si algún día aparece un
    // `p_handle`, este test es el que tiene que gritar.
    const sync = await db.query(`select p.pronargs, p.prosecdef, p.proconfig,
        has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_ejecuta
      from pg_proc p where p.oid = 'public.sync_github_verification()'::regprocedure`);
    assert.deepEqual(sync.rows[0], {
      pronargs: 0,
      prosecdef: true,
      proconfig: ['search_path=""'],
      anon_ejecuta: false,
      authenticated_ejecuta: true,
    });
    await db.exec('rollback;');
    // --- Realtime Authorization ---------------------------------------------
    //
    // Lo que tapa `20260917000100`: hasta esa migración, `lockin:video:<id>` y
    // `lockin:presence:<id>` eran canales PÚBLICOS, así que cualquier cuenta
    // —y darse de alta es anónimo— que adivinara un `sessionId` entraba en la
    // señalización WebRTC de una sesión ajena. Es el único camino del repo que
    // se saltaba el modelo de RLS entero.
    //
    // Se comprueba como lo evalúa Realtime de verdad: unirse a un topic privado
    // es insertar un mensaje en `realtime.messages` y leerlo, con el nombre del
    // canal en `realtime.topic()`. Lo que las políticas dejen pasar es lo que la
    // conexión puede hacer. No hay otra forma de cubrir esto desde el repo: la
    // suite de contrato habla con PostgREST, que no ve el esquema `realtime`.
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${ana}', 'ana@lockin.test'), ('${bea}', 'bea@lockin.test'),
        ('${carla}', 'carla@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, p.name, 30, 'Madrid', 'Europe/Madrid', left(p.name, 1),
             array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values ('${ana}', 'Ana'), ('${bea}', 'Bea'), ('${carla}', 'Carla')) as p(id, name);
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${match}', '${ana}', '${bea}', 'lockin');
      insert into public.lockin_sessions
        (id, match_id, proposed_by, starts_at, blocks, status, responded_at)
      values
        ('${session(1)}', '${match}', '${ana}', now() + interval '1 hour', 1, 'aceptada', now());`);
    const videoTopic = `lockin:video:${session(1)}`;
    const presenceTopic = `lockin:presence:${session(1)}`;
    // Cada sonda va en un savepoint: un rechazo de RLS aborta la transacción, y
    // el `set local role` se deshace solo al volver al savepoint.
    const entraEn = async (actor, topic, extension) => {
      await asActor(actor);
      await db.exec('savepoint canal;');
      try {
        await db.exec(`set local "realtime.topic" = '${topic}'; set local role authenticated;`);
        await db.query(
          `insert into realtime.messages (topic, extension, private)
             values ('${topic}', '${extension}', true)`
        );
        const leido = await db.query(
          `select count(*)::int as n from realtime.messages where topic = '${topic}'`
        );
        return leido.rows[0].n === 1 ? 'dentro' : 'escribe pero no lee';
      } catch (error) {
        return error.code ?? 'error';
      } finally {
        await db.exec('rollback to savepoint canal;');
      }
    };
    assert.deepEqual(
      {
        ana_video: await entraEn(ana, videoTopic, 'broadcast'),
        bea_video: await entraEn(bea, videoTopic, 'broadcast'),
        bea_presencia: await entraEn(bea, presenceTopic, 'presence'),
        carla_video: await entraEn(carla, videoTopic, 'broadcast'),
        carla_presencia: await entraEn(carla, presenceTopic, 'presence'),
        sesion_inexistente: await entraEn(ana, `lockin:video:${session(9)}`, 'broadcast'),
        topic_sin_uuid: await entraEn(ana, 'lockin:video:no-soy-un-uuid', 'broadcast'),
        topic_ajeno: await entraEn(ana, 'room-1', 'broadcast'),
      },
      {
        // Las dos personas del match, en los dos canales.
        ana_video: 'dentro',
        bea_video: 'dentro',
        bea_presencia: 'dentro',
        // Carla tiene perfil y cuenta, y aun así no entra en ninguno: es
        // exactamente el ataque, y es lo que antes de esta migración funcionaba.
        carla_video: '42501',
        carla_presencia: '42501',
        sesion_inexistente: '42501',
        // 42501 y no 22P02: la expresión regular exige el UUID entero, así que
        // el `::uuid` no llega a ejecutarse. Un error dentro de una política no
        // es un «no», es una puerta rota.
        topic_sin_uuid: '42501',
        topic_ajeno: '42501',
      }
    );
    // La otra mitad de la política, la de quién ESCUCHA: el mensaje lo escribe
    // Ana y se queda; Bea lo recibe y Carla no lo ve.
    await asActor(ana);
    await db.exec(`set local "realtime.topic" = '${videoTopic}'; set local role authenticated;`);
    await db.query(
      `insert into realtime.messages (topic, extension, private)
         values ('${videoTopic}', 'broadcast', true)`
    );
    await db.exec('reset role');
    const recibe = async (actor) => {
      await asActor(actor);
      await db.exec('set local role authenticated');
      const filas = await db.query('select count(*)::int as n from realtime.messages');
      await db.exec('reset role');
      return filas.rows[0].n;
    };
    assert.deepEqual(
      { bea: await recibe(bea), carla: await recibe(carla) },
      { bea: 1, carla: 0 },
      'la otra persona del match recibe el broadcast; un tercero no lo ve'
    );
    await db.exec('rollback;');
    // Las dos políticas, en la huella. `Schema drift` es lo único que vigila el
    // proyecto real, y no mira el esquema `realtime` por ningún otro sitio: sin
    // estas líneas, borrarlas allí saldría en verde.
    const rtPolicies = expected
      .split('\n')
      .filter((line) => line.startsWith('rtpolicy') && line.includes('de tus sesiones'))
      .sort();
    assert.equal(rtPolicies.length, 2, 'la huella debe traer las dos políticas de realtime');
    for (const line of rtPolicies) {
      assert.match(line, /roles=authenticated/);
      assert.match(line, /is_session_topic_member/);
    }
    assert.match(rtPolicies[0], /^rtpolicy lockin: envías .* cmd=INSERT .*check=\(/);
    assert.match(rtPolicies[1], /^rtpolicy lockin: recibes .* cmd=SELECT .*using=\(/);
    // Y el control negativo de esas líneas. Va aquí y no en la lista de
    // `mutations` de más abajo porque la guarda de `ci.yml` exige literalmente
    // «Rol lector, 5 mutaciones…» y `.github/workflows/` es de `calidad`.
    await db.exec(
      'begin; drop policy "lockin: recibes de los canales de tus sesiones" on realtime.messages;'
    );
    assert.notEqual(compareFingerprints(expected, await fingerprint()), '');
    await db.exec('rollback;');
    // --- Una sola discovery_deck ----------------------------------------------
    //
    // `20260918000100` añadió `p_exclude_ids` con CREATE OR REPLACE, y en
    // Postgres una lista de argumentos distinta es OTRA función: la de 3
    // argumentos (con el ranking de `20260907000200` y sin exclusión) quedó
    // viva al lado, y cualquier llamada con ≤3 argumentos era ambigua. Aquí se
    // exige que solo quede la de 4, con los permisos y la seguridad de siempre.
    const decks = await db.query(`select
        p.oid::regprocedure::text as firma,
        p.prosecdef as security_definer,
        p.proconfig as config,
        has_function_privilege('anon', p.oid, 'execute') as anon_ejecuta,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_ejecuta,
        exists (
          select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
          where g.grantee = 0
        ) as public_ejecuta
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'discovery_deck'`);
    assert.deepEqual(decks.rows, [
      {
        firma: 'public.discovery_deck(public.mode_preference,public.specialty[],integer,uuid[])',
        security_definer: false,
        config: ['search_path=""'],
        anon_ejecuta: false,
        authenticated_ejecuta: true,
        public_ejecuta: false,
      },
    ]);
    // El mismo tropiezo en cualquier otra función: ninguna de `public` puede
    // quedar con dos firmas por un CREATE OR REPLACE que cambió argumentos.
    const overloads = await db.query(`select p.proname as nombre, count(*)::int as firmas
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      group by p.proname
      having count(*) > 1`);
    assert.deepEqual(overloads.rows, []);
    // Y una llamada sin `p_exclude_ids` (lo que manda el sondeo de
    // `drift-check.mjs`) resuelve a esa única firma en vez de ser ambigua.
    await db.query(
      'select count(*) from public.discovery_deck(p_mode := null, p_specialties := null, p_limit := 1)'
    );
    // --- Orden D3: excludeIds en discovery_deck, último mensaje por RPC, ------
    // --- sesión activa resuelta por el reloj de Postgres ----------------------
    //
    // `viewer` es quien pide el deck y quien lista mensajes/sesiones; `c1` <
    // `c2` < `c3` por id, así que con encaje mutuo empatado (mismas
    // especialidades, nada buscado) el desempate por id da un orden conocido.
    const viewer = person('e100');
    const c1 = person('e101');
    const c2 = person('e102');
    const c3 = person('e103');
    const matchViewerC1 = person('e110');
    const matchViewerC2 = person('e111');
    const matchForeign = person('e112'); // c1 <-> c3, sin viewer.
    const sessionLive = person('e120');
    const sessionRejected = person('e121');
    const sessionForeignLive = person('e122');
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${viewer}', 'viewer@lockin.test'), ('${c1}', 'c1@lockin.test'),
        ('${c2}', 'c2@lockin.test'), ('${c3}', 'c3@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, p.name, 30, 'Madrid', 'Europe/Madrid', left(p.name, 1),
             array['dev']::public.specialty[], 'ambos', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values ('${viewer}', 'Viewer'), ('${c1}', 'C1'), ('${c2}', 'C2'), ('${c3}', 'C3'))
        as p(id, name);
      insert into public.matches (id, profile_a, profile_b, mode) values
        ('${matchViewerC1}', '${viewer}', '${c1}', 'par'),
        ('${matchViewerC2}', '${viewer}', '${c2}', 'par'),
        ('${matchForeign}', '${c1}', '${c3}', 'par');
      insert into public.messages (match_id, sender_id, body, sent_at) values
        ('${matchViewerC1}', '${viewer}', 'primero e110', now() - interval '2 minutes'),
        ('${matchViewerC1}', '${c1}', 'segundo e110', now() - interval '1 minute'),
        ('${matchViewerC1}', '${viewer}', 'último e110', now()),
        ('${matchViewerC2}', '${c2}', 'primero e111', now() - interval '1 minute'),
        ('${matchViewerC2}', '${viewer}', 'último e111', now()),
        ('${matchForeign}', '${c1}', 'único e112', now());
      insert into public.lockin_sessions
        (id, match_id, proposed_by, starts_at, blocks, status, responded_at)
      values
        ('${sessionLive}', '${matchViewerC1}', '${viewer}', now() - interval '10 minutes', 1, 'aceptada', now() - interval '15 minutes'),
        ('${sessionRejected}', '${matchViewerC2}', '${viewer}', now() + interval '10 minutes', 1, 'rechazada', now()),
        ('${sessionForeignLive}', '${matchForeign}', '${c1}', now() - interval '5 minutes', 1, 'aceptada', now() - interval '10 minutes');`);

    // 6c — `excludeIds` bajado al SQL: la página no encoge al excluir.
    await asActor(viewer);
    const uuidArray = (ids) =>
      ids ? `array[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]` : 'null';
    const deck = async (excludeIds, limit) =>
      (
        await db.query(
          `select id from public.discovery_deck(p_mode := 'ambos', p_specialties := null, p_limit := ${limit}, p_exclude_ids := ${uuidArray(excludeIds)})`
        )
      ).rows.map((r) => r.id);
    assert.deepEqual(await deck(null, 50), [c1, c2, c3], 'sin excludeIds, los tres candidatos');
    assert.deepEqual(
      await deck([c1], 2),
      [c2, c3],
      'con p_limit=2 y c1 excluido, la página trae los DOS restantes — antes, ' +
        'al filtrar después del límite, un c1 dentro de la primera página se ' +
        'llevaba una plaza y devolvía uno solo'
    );
    assert.deepEqual(await deck([c2], 50), [c1, c3], 'excluye exactamente el pedido, nada más');

    // 6b — último mensaje por match vía `distinct on` en SQL, no una ventana
    // de 200 mensajes agrupada en el cliente. `matchForeign` va en la consulta
    // a propósito: `viewer` no es miembro, así que RLS debe dejarlo fuera sin
    // que haga falta ningún filtro explícito en la función. La función es
    // SECURITY INVOKER (a diferencia de `active_session`), así que su
    // protección depende enteramente de RLS — hace falta `authenticated` de
    // verdad, no el superusuario de la fixture, que la salta.
    const lastMessages = async (matchIds) =>
      Object.fromEntries(
        (
          await db.query(
            `select match_id, body from public.last_messages_for_matches(${uuidArray(matchIds)})`
          )
        ).rows.map((r) => [r.match_id, r.body])
      );
    await db.exec('set local role authenticated;');
    assert.deepEqual(
      await lastMessages([matchViewerC1, matchViewerC2, matchForeign]),
      { [matchViewerC1]: 'último e110', [matchViewerC2]: 'último e111' },
      'una fila por match, el mensaje más reciente de cada uno; el match ajeno no aparece'
    );
    await db.exec('reset role;');
    await asActor(c1);
    await db.exec('set local role authenticated;');
    assert.deepEqual(
      await lastMessages([matchViewerC1, matchViewerC2, matchForeign]),
      { [matchViewerC1]: 'último e110', [matchForeign]: 'único e112' },
      'c1 ve sus dos matches (uno compartido con viewer, otro no) y no el que no es suyo'
    );
    await db.exec('reset role;');

    // 6d — "viva" la decide `now()` de Postgres: estado y pertenencia al match,
    // no el reloj de quien llama.
    await asActor(viewer);
    const active = async (matchId) =>
      (await db.query(`select id from public.active_session('${matchId}')`)).rows.map((r) => r.id);
    assert.deepEqual(await active(matchViewerC1), [sessionLive], 'aceptada y dentro de ventana');
    assert.deepEqual(
      await active(matchViewerC2),
      [],
      'rechazada no cuenta como viva aunque su hora todavía no haya llegado'
    );
    assert.deepEqual(
      await active(matchForeign),
      [],
      'viewer no es miembro de este match: is_match_member lo bloquea aunque la sesión esté viva'
    );
    await asActor(c1);
    assert.deepEqual(
      await active(matchForeign),
      [sessionForeignLive],
      'c1 sí es miembro y ve la misma sesión que a viewer se le negó'
    );
    await db.exec('rollback;');
    assert.match(expected, /column\s+profiles.seeking_specialties/);
    assert.match(expected, /column\s+profiles.github_handle/);
    assert.match(expected, /column\s+profiles.github_verified_at/);
    // El estado del sello, tal y como lo cuenta la huella — que es lo único que
    // compara el job `Schema drift` contra el proyecto real.
    //
    // Se lee en dos sitios y hacen falta los dos, porque el permiso se puede
    // reabrir por dos caminos distintos:
    //
    //   * `grant` (relacl): `authenticated` ya NO tiene el INSERT/UPDATE de
    //     TABLA. Si alguien se lo devuelve entero, reaparece esa línea.
    //   * `grantcol` (attacl): están las 20 columnas que sí se volvieron a
    //     conceder, y NO están las dos del sello. Cerrado se representa por
    //     ausencia, así que reabrir una por columna AÑADE una línea.
    for (const privilegio of ['INSERT', 'UPDATE']) {
      assert.doesNotMatch(
        expected,
        new RegExp(`^grant\\s+profiles authenticated ${privilegio}$`, 'm'),
        `authenticated no debe conservar el ${privilegio} de tabla sobre profiles`
      );
      for (const columna of ['github_handle', 'github_verified_at']) {
        assert.doesNotMatch(
          expected,
          new RegExp(`^grantcol profiles\\.${columna} authenticated ${privilegio}$`, 'm'),
          `${columna} debe seguir cerrada a authenticated en ${privilegio}`
        );
      }
      // Y el contraste, para que el bloque de arriba no pase por estar la huella
      // vacía de `grantcol`: las columnas normales sí llevan su permiso.
      assert.match(
        expected,
        new RegExp(`^grantcol profiles\\.link_github authenticated ${privilegio}$`, 'm'),
        `link_github sin sello es un campo del formulario: conserva el ${privilegio}`
      );
    }
    // El INSERT de perfiles del seed, contra las constraints de verdad.
    // `supabase db reset` lo ejecuta tal cual, y si en una fila con sello
    // `link_github` no es exactamente 'https://github.com/' || github_handle, la
    // rechaza `profiles_github_link_matches_handle` y el seed muere con un error
    // que no dice nada de sellos. Que salte aquí cuesta dos segundos; que salte
    // allí cuesta una tarde.
    const seedTexto = readFileSync(join(here, 'seed.sql'), 'utf8');
    const finSeed = 'on conflict (id) do nothing;';
    // El `on conflict (id) do nothing;` sale antes en el archivo (las cuentas de
    // `auth.users`), así que se busca a partir del INSERT, no desde el principio.
    const inicioSeed = seedTexto.indexOf('insert into public.profiles (');
    assert(inicioSeed >= 0, 'el seed debe traer el INSERT de perfiles');
    const perfilesSeed = seedTexto.slice(
      inicioSeed,
      seedTexto.indexOf(finSeed, inicioSeed) + finSeed.length
    );
    assert.match(perfilesSeed, /github_handle/, 'el seed debe sembrar el sello');
    const idsSeed = [
      ...new Set(
        [...perfilesSeed.matchAll(/'([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})'/gi)].map(
          (m) => m[1]
        )
      ),
    ];
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ${idsSeed.map((id, i) => `('${id}', 'seed${i}@lockin.test')`).join(',\n        ')};
      ${perfilesSeed}`);
    const conSello = await db.query(
      `select name, github_handle, link_github from public.profiles
        where github_handle is not null order by name`
    );
    assert.deepEqual(
      conSello.rows,
      [
        {
          name: 'Núria Bosch',
          github_handle: 'example-nuria',
          link_github: 'https://github.com/example-nuria',
        },
        {
          name: 'Omar Chaib',
          github_handle: 'example-omar',
          link_github: 'https://github.com/example-omar',
        },
      ],
      'el seed siembra exactamente los dos perfiles con sello del mock'
    );
    await db.exec('rollback;');
    await db.exec(
      'create role lockin_schema_reader; grant usage on schema public to lockin_schema_reader; begin; set local role lockin_schema_reader;'
    );
    assert.equal(compareFingerprints(expected, await fingerprint()), '');
    await db.exec('rollback;');
    const mutations = [
      'alter table public.profiles add column schema_drift_probe text;',
      'create index schema_drift_probe on public.profiles (name);',
      'alter policy "profiles: cualquier autenticado puede leer" on public.profiles using (false);',
      "create or replace function public.is_valid_prompts(prompts jsonb) returns boolean language sql immutable set search_path = '' as $$ select true; $$;",
      // Reabrir el sello. Es la mutación que demuestra que la línea `grantcol`
      // de la huella sirve para algo: sin ella este `grant` no movería ni un
      // byte —el permiso de columna vive en `attacl`, y la huella solo leía
      // `relacl`/`proacl`—, y el job `Schema drift` daría verde sobre un
      // despliegue en el que cualquiera puede encenderse la insignia.
      'grant update (github_verified_at) on public.profiles to authenticated;',
    ];
    for (const mutation of mutations) {
      await db.exec(`begin; ${mutation}`);
      assert.notEqual(compareFingerprints(expected, await fingerprint()), '');
      await db.exec('rollback;');
    }
    // --- Salas grupales ------------------------------------------------------
    // El ciego se comprueba con el rol real: una invitada no puede descubrir
    // las otras invitaciones. PGlite cubre RLS y configuración, no entrega de
    // eventos ni la caché de autorización de canales de Realtime.
    const roomAna = person('f100');
    const roomBea = person('f101');
    const roomCarla = person('f102');
    const roomDani = person('f103');
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${roomAna}', 'room-ana@lockin.test'), ('${roomBea}', 'room-bea@lockin.test'),
        ('${roomCarla}', 'room-carla@lockin.test'), ('${roomDani}', 'room-dani@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week, availability_bands, ambition
      )
      select p.id::uuid, p.name, 30, 'Madrid', 'Europe/Madrid', left(p.name, 1),
             array['dev']::public.specialty[], 'ambos', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values ('${roomAna}', 'Ana'), ('${roomBea}', 'Bea'),
                   ('${roomCarla}', 'Carla'), ('${roomDani}', 'Dani')) as p(id, name);
      insert into public.matches (profile_a, profile_b, mode) values
        ('${roomAna}', '${roomBea}', 'par'), ('${roomAna}', '${roomCarla}', 'lockin');`);
    const createRoom = async () => {
      await actingAs(roomAna);
      return (
        await db.query(`select * from public.create_room(
          array['${roomBea}', '${roomCarla}']::uuid[], clock_timestamp() + interval '1 hour', 2::smallint)`)
      ).rows[0];
    };
    const roomRows = async (id) =>
      (
        await db.query(`select profile_id, status from public.room_members
        where room_id = '${id}' order by profile_id`)
      ).rows;
    const roomVisible = async (id) =>
      (await db.query(`select id from public.lockin_rooms where id = '${id}'`)).rows;
    const roomRespond = (id, answer) => `select * from public.respond_room('${id}', '${answer}')`;
    const roomCall = async (rpc, id) =>
      (await db.query(`select * from public.${rpc}('${id}')`)).rows[0];
    // Leer como texto conserva los microsegundos que Date redondearía.
    const roomUpdated = async (id) =>
      (
        await db.query(
          `select updated_at::text as stamp from public.lockin_rooms where id = '${id}'`
        )
      ).rows[0].stamp;
    const moveRoom = async (id, interval) => {
      await db.exec(`reset role; update public.lockin_rooms
        set starts_at = clock_timestamp() + interval '${interval}' where id = '${id}';`);
    };
    const room = await createRoom();
    const initialMembers = [
      { profile_id: roomAna, status: 'aceptada' },
      { profile_id: roomBea, status: 'invitada' },
      { profile_id: roomCarla, status: 'invitada' },
    ];
    assert.deepEqual(
      await roomRows(room.id),
      initialMembers,
      'quien convoca ve todas las invitaciones'
    );
    await actingAs(roomBea);
    assert.deepEqual(await roomVisible(room.id), [{ id: room.id }]);
    assert.deepEqual(
      await roomRows(room.id),
      initialMembers.slice(0, 2),
      'ciego: Bea no ve a Carla'
    );
    const beforeAccept = await roomUpdated(room.id);
    await actingAs(roomCarla);
    const acceptedCarla = (await db.query(roomRespond(room.id, 'aceptada'))).rows[0];
    assert.equal(acceptedCarla.status, 'aceptada');
    assert.ok((await roomUpdated(room.id)) > beforeAccept, 'aceptar toca updated_at');
    assert.deepEqual(
      (await db.query(roomRespond(room.id, 'aceptada'))).rows[0],
      acceptedCarla,
      'aceptar dos veces conserva responded_at'
    );
    const acceptedMembers = [
      ...initialMembers.slice(0, 2),
      { profile_id: roomCarla, status: 'aceptada' },
    ];
    await actingAs(roomBea);
    assert.deepEqual(
      await roomRows(room.id),
      acceptedMembers,
      'Carla consiente y pasa a ser visible'
    );
    await actingAs(roomAna);
    assert.deepEqual(await roomRows(room.id), acceptedMembers);

    await actingAs(roomDani);
    assert.deepEqual(await roomVisible(room.id), [], 'un tercero no ve la sala');
    assert.deepEqual(await roomRows(room.id), [], 'un tercero no ve sus miembros');
    assert.equal(await sonda(roomRespond(room.id, 'aceptada')), 'LI004');
    assert.equal(await sonda(`select public.join_room('${room.id}')`), 'LI004');

    await actingAs(roomAna);
    for (const invitees of [
      `array['${roomBea}']`,
      `array['${roomBea}', '${roomCarla}', '${roomDani}']`,
      `array['${roomBea}', '${roomBea}']`,
      `array['${roomBea}', '${roomAna}']`,
      'array[]',
      `array['${roomBea}', null]`,
      'null',
      `array['${roomBea}', '${roomCarla}', '${roomDani}', '${person('f104')}', '${person('f105')}']`,
    ]) {
      assert.equal(
        await sonda(`select public.create_room(${invitees}::uuid[],
        clock_timestamp() + interval '1 hour', 2::smallint)`),
        'LI006',
        invitees
      );
    }
    for (const startsAt of [
      "clock_timestamp() + interval '1 minute'",
      "clock_timestamp() + interval '31 days'",
      'null',
    ]) {
      assert.equal(
        await sonda(`select public.create_room(
        array['${roomBea}', '${roomCarla}']::uuid[], ${startsAt}, 2::smallint)`),
        'LI003'
      );
    }
    for (const blocks of ['3', 'null']) {
      assert.equal(
        await sonda(`select public.create_room(
        array['${roomBea}', '${roomCarla}']::uuid[], clock_timestamp() + interval '1 hour', ${blocks}::smallint)`),
        'LI003'
      );
    }
    assert.equal(
      await sonda(roomRespond(room.id, 'aceptada')),
      'LI004',
      'quien convoca no responde'
    );
    await actingAs(roomBea);
    assert.equal(await sonda(`select public.cancel_room('${room.id}')`), 'LI004');
    assert.equal(
      await sonda(`select public.join_room('${room.id}')`),
      'LI004',
      'invitada no entra'
    );
    const beforeReject = await roomUpdated(room.id);
    assert.equal((await db.query(roomRespond(room.id, 'rechazada'))).rows[0].status, 'rechazada');
    assert.deepEqual(await roomVisible(room.id), []);
    assert.equal(await sonda(roomRespond(room.id, 'aceptada')), 'LI004', 'rechazo definitivo');
    await actingAs(roomCarla);
    assert.deepEqual(await roomRows(room.id), [acceptedMembers[0], acceptedMembers[2]]);
    assert.ok((await roomUpdated(room.id)) > beforeReject, 'rechazar toca updated_at');
    await actingAs(roomAna);
    assert.deepEqual(await roomRows(room.id), [
      acceptedMembers[0],
      { profile_id: roomBea, status: 'rechazada' },
      acceptedMembers[2],
    ]);

    // Revocación antes de abrir la ventana: una aceptada vuelve a quedar
    // oculta y el aviso debe salir por la sala, ya que su fila deja de verse.
    const revokeRoom = await createRoom();
    await actingAs(roomCarla);
    await db.query(roomRespond(revokeRoom.id, 'aceptada'));
    await actingAs(roomBea);
    assert.deepEqual(await roomRows(revokeRoom.id), acceptedMembers);
    const beforeRevoke = await roomUpdated(revokeRoom.id);
    await actingAs(roomCarla);
    assert.equal(
      (await db.query(roomRespond(revokeRoom.id, 'rechazada'))).rows[0].status,
      'rechazada'
    );
    assert.deepEqual(await roomVisible(revokeRoom.id), []);
    await actingAs(roomBea);
    assert.deepEqual(await roomRows(revokeRoom.id), initialMembers.slice(0, 2));
    assert.ok((await roomUpdated(revokeRoom.id)) > beforeRevoke);

    // Los dos órdenes de cancelar/aceptar: cancelar no pierde su derecho si
    // otra persona acaba de aceptar. No simula dos conexiones concurrentes.
    const cancelFirst = await createRoom();
    assert.ok((await roomCall('cancel_room', cancelFirst.id)).cancelled_at);
    assert.deepEqual(
      (await db.query(`select id from public.live_rooms() where id = '${cancelFirst.id}'`)).rows,
      []
    );
    await actingAs(roomCarla);
    assert.equal(await sonda(roomRespond(cancelFirst.id, 'aceptada')), 'LI001');
    const acceptFirst = await createRoom();
    await actingAs(roomCarla);
    assert.equal(
      (await db.query(roomRespond(acceptFirst.id, 'aceptada'))).rows[0].status,
      'aceptada'
    );
    await actingAs(roomAna);
    assert.ok((await roomCall('cancel_room', acceptFirst.id)).cancelled_at);
    await actingAs(roomCarla);
    assert.ok(
      (
        await db.query(
          `select cancelled_at from public.lockin_rooms where id = '${acceptFirst.id}'`
        )
      ).rows[0].cancelled_at
    );

    const windowRoom = await createRoom();
    await moveRoom(windowRoom.id, '4 minutes');
    await actingAs(roomBea);
    for (const answer of ['aceptada', 'rechazada']) {
      assert.equal(await sonda(roomRespond(windowRoom.id, answer)), 'LI002');
    }
    await moveRoom(windowRoom.id, '6 minutes');
    await actingAs(roomBea);
    assert.equal(
      (await db.query(roomRespond(windowRoom.id, 'aceptada'))).rows[0].status,
      'aceptada'
    );
    await moveRoom(windowRoom.id, '4 minutes');
    await actingAs(roomBea);
    assert.equal(
      await sonda(roomRespond(windowRoom.id, 'rechazada')),
      'LI002',
      'no revocar presencia ya autorizable'
    );

    // Ventana e idempotencia de asistencia.
    await actingAs(roomCarla);
    assert.equal(await sonda(`select public.join_room('${room.id}')`), 'LI003');
    assert.equal(await sonda(`select public.leave_room('${room.id}')`), 'LI003');
    await moveRoom(room.id, '2 minutes');
    await actingAs(roomCarla);
    const joinedCarla = await roomCall('join_room', room.id);
    assert.ok(joinedCarla.joined_at);
    assert.deepEqual((await roomCall('join_room', room.id)).joined_at, joinedCarla.joined_at);
    assert.ok((await roomCall('leave_room', room.id)).left_at);
    const rejoinedCarla = await roomCall('join_room', room.id);
    assert.equal(rejoinedCarla.left_at, null);
    assert.deepEqual(rejoinedCarla.joined_at, joinedCarla.joined_at);

    // Los privilegios por defecto del harness incluyen ALL: estos rechazos
    // prueban el REVOKE, no una ausencia artificial de permisos en la fixture.
    for (const sql of [
      `insert into public.room_members (room_id, profile_id) values ('${room.id}', '${roomDani}')`,
      'update public.lockin_rooms set cancelled_at = now()',
      'delete from public.room_members',
      'truncate public.room_members',
      'truncate public.lockin_rooms',
    ])
      assert.equal(await sonda(sql), '42501', sql);
    for (const table of ['lockin_rooms', 'room_members']) {
      const privileges = await db.query(`select
        has_table_privilege('authenticated', 'public.${table}', 'SELECT') as lectura,
        has_table_privilege('authenticated', 'public.${table}', 'TRUNCATE') as vaciar,
        has_table_privilege('anon', 'public.${table}', 'SELECT') as anon_lectura`);
      assert.deepEqual(privileges.rows[0], { lectura: true, vaciar: false, anon_lectura: false });
    }
    assert.deepEqual(
      (
        await db.query(`select tablename from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename in ('lockin_rooms', 'room_members')`)
      ).rows,
      [{ tablename: 'lockin_rooms' }],
      'nunca publicar las PK de invitados en DELETE'
    );

    // Presencia: Carla aceptada; Bea todavía invitada en una sala nueva.
    const presenceRoom = await createRoom();
    await actingAs(roomCarla);
    await db.query(roomRespond(presenceRoom.id, 'aceptada'));
    await moveRoom(presenceRoom.id, '2 minutes');
    await db.exec(`insert into realtime.messages (topic, extension) values
      ('lockin:room:${presenceRoom.id}', 'presence');`);
    for (const [actor, allowed] of [
      [roomCarla, true],
      [roomBea, false],
      [roomDani, false],
    ]) {
      await actingAs(actor);
      await db.exec(`set local "realtime.topic" = 'lockin:room:${presenceRoom.id}';`);
      assert.equal(
        (await db.query('select count(*)::int as n from realtime.messages')).rows[0].n,
        allowed ? 1 : 0,
        'solo aceptadas reciben presencia'
      );
      assert.equal(
        await sonda(`insert into realtime.messages (topic, extension)
        values ('lockin:room:${presenceRoom.id}', 'presence')`),
        allowed ? 'sin error' : '42501'
      );
    }
    await actingAs(roomCarla);
    await db.exec(`set local "realtime.topic" = 'lockin:room:no-es-uuid';`);
    assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, 0);

    const roomFunctions = await db.query(`select p.proname, p.prosecdef, p.proconfig,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
        p.prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'is_room_participant', 'is_room_host', 'is_room_attendee', 'touch_room',
        'create_room', 'lock_room_for_member', 'respond_room', 'cancel_room',
        'join_room', 'leave_room', 'live_rooms', 'is_room_topic_member')`);
    assert.equal(roomFunctions.rows.length, 12);
    for (const fn of roomFunctions.rows) {
      assert.deepEqual(fn.proconfig, ['search_path=""'], fn.proname);
      assert.equal(fn.anon_exec, false, fn.proname);
      assert.equal(
        fn.authenticated_exec,
        !['touch_room', 'lock_room_for_member'].includes(fn.proname),
        fn.proname
      );
      assert.equal(
        fn.prosecdef,
        !['live_rooms', 'is_room_topic_member'].includes(fn.proname),
        fn.proname
      );
      if (['respond_room', 'cancel_room', 'join_room', 'leave_room'].includes(fn.proname)) {
        assert.match(
          fn.prosrc,
          /public\.lock_room_for_member\(p_room_id\);\s*v_now(?:\s+timestamptz)?\s*:= clock_timestamp\(\);/,
          `${fn.proname}: reloj inmediatamente después del bloqueo`
        );
      }
    }
    const roomPolicies = expected
      .split('\n')
      .filter((line) => line.startsWith('rtpolicy') && line.includes('de tus salas'));
    assert.equal(roomPolicies.length, 2);
    for (const line of roomPolicies)
      assert.match(line, /roles=authenticated .*is_room_topic_member/);
    assert.match(expected, /trigger\s+room_members\.room_members_touch_room/);
    const parsedRooms = parseMigrations(stripComments(migrationSql()));
    assert.deepEqual(parsedRooms.enums.get('room_member_status'), [
      'invitada',
      'aceptada',
      'rechazada',
    ]);
    assert.deepEqual(
      parsedRooms.tables.get('lockin_rooms').map((column) => column.name),
      ['id', 'host_id', 'starts_at', 'blocks', 'cancelled_at', 'created_at', 'updated_at']
    );
    assert.deepEqual(
      parsedRooms.tables.get('room_members').map((column) => column.name),
      ['room_id', 'profile_id', 'status', 'responded_at', 'joined_at', 'left_at']
    );
    assert.equal(
      parsedRooms.realtimePolicies.filter((name) => name.includes('de tus salas')).length,
      2
    );

    // Cascadas: un miembro invalida la sala y quien convoca puede borrarse sin
    // que touch_room tropiece con la sala que también está desapareciendo.
    const beforeDelete = await roomUpdated(presenceRoom.id);
    await db.exec(`reset role; delete from public.profiles where id = '${roomBea}';`);
    assert.ok(
      (await roomUpdated(presenceRoom.id)) > beforeDelete,
      'borrar miembro toca updated_at'
    );
    await db.exec(`delete from public.profiles where id = '${roomAna}';`);
    assert.deepEqual((await db.query('select id from public.lockin_rooms')).rows, []);
    assert.deepEqual((await db.query('select room_id from public.room_members')).rows, []);
    await db.exec('rollback;');

    // Fixture pequeña e independiente para el reloj transaccional y las 21 salas.
    await db.exec(`begin;
      insert into auth.users (id) values ('${roomAna}'), ('${roomBea}');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week, availability_bands, ambition
      ) select id, 'Sala', 30, 'Madrid', 'Europe/Madrid', 'S',
        array['dev']::public.specialty[], 'ambos', 'solo-ganas', 10,
        array['tarde']::public.time_band[], 'equilibrado' from auth.users;
      insert into public.lockin_rooms (host_id, starts_at, blocks)
        select '${roomAna}', clock_timestamp() + interval '1 hour', 1 from generate_series(1, 21);
      insert into public.room_members (room_id, profile_id, status, responded_at)
        select id, '${roomAna}', 'aceptada', clock_timestamp() from public.lockin_rooms;`);
    await actingAs(roomAna);
    const allRooms = (await db.query('select id from public.live_rooms()')).rows;
    assert.equal(allRooms.length, 21, 'live_rooms no trunca a 20');
    const clockRoom = allRooms[0].id;
    await db.exec(`reset role;
      insert into public.room_members (room_id, profile_id) values ('${clockRoom}', '${roomBea}');
      update public.lockin_rooms set starts_at = clock_timestamp() + interval '5 minutes 1 second'
        where id = '${clockRoom}';`);
    // PGlite no ofrece espera de locks entre conexiones: el bucle garantiza que
    // now() quede antes del cierre y clock_timestamp() después, sin pg_sleep.
    await db.exec(`do $$ declare until_at timestamptz := clock_timestamp() + interval '1.5 seconds';
      begin while clock_timestamp() < until_at loop end loop; end $$;`);
    await actingAs(roomBea);
    assert.deepEqual(
      (
        await db.query(`select now() < starts_at - interval '5 minutes' as old_clock,
      clock_timestamp() >= starts_at - interval '5 minutes' as current_clock
      from public.lockin_rooms where id = '${clockRoom}'`)
      ).rows[0],
      { old_clock: true, current_clock: true }
    );
    assert.equal(
      await sonda(roomRespond(clockRoom, 'aceptada')),
      'LI002',
      'no validar con el now() obsoleto'
    );
    await db.exec('rollback;');
    console.log('Salas grupales: 15 casos del plan, ciego, permisos, reloj y presencia: OK');

    // Borrar mi cuenta: `delete_my_account()` borra a quien llama y a nadie más, y
    // todo lo suyo cae en cascada sin tocar lo ajeno.
    const delAna = person('f200');
    const delBea = person('f201');
    const delCarla = person('f202');
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${delAna}', 'ana@lockin.test'), ('${delBea}', 'bea@lockin.test'), ('${delCarla}', 'carla@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week, availability_bands, ambition
      ) select id, 'Borrar', 30, 'Madrid', 'Europe/Madrid', 'B',
        array['dev']::public.specialty[], 'ambos', 'solo-ganas', 10,
        array['tarde']::public.time_band[], 'equilibrado'
        from auth.users where id in ('${delAna}', '${delBea}', '${delCarla}');
      insert into public.matches (profile_a, profile_b, mode) values
        (least('${delAna}'::uuid, '${delBea}'::uuid), greatest('${delAna}'::uuid, '${delBea}'::uuid), 'lockin'),
        (least('${delBea}'::uuid, '${delCarla}'::uuid), greatest('${delBea}'::uuid, '${delCarla}'::uuid), 'lockin');
      insert into public.messages (match_id, sender_id, body)
        select id, '${delBea}', 'hola' from public.matches;
      insert into public.lockin_rooms (host_id, starts_at, blocks)
        values ('${delAna}', clock_timestamp() + interval '1 hour', 1);`);
    const countOf = async (table) =>
      Number((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n);

    // Sin sesión: LI007, y no se borra nada.
    await db.exec(`reset role;
      create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      set local role authenticated;`);
    assert.equal(await sonda('select public.delete_my_account()'), 'LI007');
    await db.exec('reset role;');
    assert.equal(await countOf('auth.users'), 3);

    // `anon` no puede ni ejecutarla.
    await db.exec('reset role; set local role anon;');
    assert.equal(await sonda('select public.delete_my_account()'), '42501');

    // Ana borra su cuenta: desaparece ella y lo que cuelga de ella.
    await actingAs(delAna);
    await db.query('select public.delete_my_account()');
    await db.exec('reset role;');
    const survivors = [delBea, delCarla].sort();
    assert.deepEqual(
      (await db.query('select id from auth.users order by id')).rows.map((row) => row.id),
      survivors
    );
    assert.deepEqual(
      (await db.query('select id from public.profiles order by id')).rows.map((row) => row.id),
      survivors
    );
    assert.equal(await countOf('public.matches'), 1, 'solo sobrevive el match de Bea y Carla');
    assert.equal(await countOf('public.messages'), 1, 'los mensajes del match de Ana caen con él');
    assert.equal(await countOf('public.lockin_rooms'), 0, 'la sala que convocó Ana cae con ella');
    await db.exec('rollback;');
    console.log(
      'Borrar mi cuenta: LI007 sin sesión, anon sin permiso y cascada sin tocar lo ajeno: OK'
    );

    // Ejecutar las definiciones reales de las dos funciones, sin sembrar cuentas.
    const seed = readFileSync(join(here, 'seed.sql'), 'utf8');
    const start = seed.search(/create or replace function public\.seed_incoming_likes/);
    assert(start >= 0);
    await db.exec(seed.slice(start));
    assert.notEqual(compareFingerprints(expected, await fingerprint()), '');
    for (let pass = 0; pass < 2; pass++) {
      const result = await db.exec(readFileSync(join(here, 'dev-teardown.sql'), 'utf8'));
      console.log(result.at(-1).rows[0].resultado);
      assert.equal(compareFingerprints(expected, await fingerprint()), '');
    }
    await db.exec(
      'create function public.dev_reset_current_user(integer) returns void language sql as $$ select $$;'
    );
    await assert.rejects(
      db.exec(readFileSync(join(here, 'dev-teardown.sql'), 'utf8')),
      /Quedan sobrecargas/
    );
    await db.exec('rollback;');
    console.log('Rol lector, 5 mutaciones, teardown dos veces y guardia de sobrecarga: OK');

    // Auditoría de seguridad 2026-10, H3: la autorización de presencia de una
    // sala exige estar dentro de la ventana de entrada y que la sala siga viva.
    const winHost = person('f300');
    const winBea = person('f301');
    const winCai = person('f302');
    await db.exec(`begin;
      insert into auth.users (id, email) values
        ('${winHost}', 'win-host@lockin.test'), ('${winBea}', 'win-bea@lockin.test'),
        ('${winCai}', 'win-cai@lockin.test');
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week, availability_bands, ambition
      ) select id, 'Ventana', 30, 'Madrid', 'Europe/Madrid', 'V',
        array['dev']::public.specialty[], 'ambos', 'solo-ganas', 10,
        array['tarde']::public.time_band[], 'equilibrado'
        from auth.users where id in ('${winHost}', '${winBea}', '${winCai}');
      insert into public.matches (profile_a, profile_b, mode) values
        (least('${winHost}'::uuid, '${winBea}'::uuid), greatest('${winHost}'::uuid, '${winBea}'::uuid), 'par'),
        (least('${winHost}'::uuid, '${winCai}'::uuid), greatest('${winHost}'::uuid, '${winCai}'::uuid), 'lockin');`);
    const winRoom = async () => {
      await actingAs(winHost);
      const created = (
        await db.query(`select * from public.create_room(
          array['${winBea}', '${winCai}']::uuid[], clock_timestamp() + interval '1 hour', 1::smallint)`)
      ).rows[0];
      await actingAs(winBea);
      await db.query(`select * from public.respond_room('${created.id}', 'aceptada')`);
      return created.id;
    };
    const winMember = async (id) =>
      (await db.query(`select public.is_room_topic_member('lockin:room:${id}') as ok`)).rows[0].ok;
    const winMove = async (id, interval) => {
      await db.exec(`reset role; update public.lockin_rooms
        set starts_at = clock_timestamp() + interval '${interval}' where id = '${id}';`);
      await actingAs(winBea);
    };
    const winPresence = (id) =>
      sonda(`insert into realtime.messages (topic, extension)
        values ('lockin:room:${id}', 'presence')`);

    // Aceptada pero antes de la ventana: ni helper ni presencia.
    const earlyRoom = await winRoom();
    assert.equal(await winMember(earlyRoom), false, 'una hora antes no autoriza');
    await db.exec(`set local "realtime.topic" = 'lockin:room:${earlyRoom}';`);
    assert.equal(await winPresence(earlyRoom), '42501', 'presencia denegada antes de la ventana');
    await winMove(earlyRoom, '6 minutes');
    assert.equal(await winMember(earlyRoom), false, 'a 6 minutos aún no');
    await winMove(earlyRoom, '4 minutes');
    assert.equal(await winMember(earlyRoom), true, 'a 4 minutos, sí');
    assert.equal(await winPresence(earlyRoom), 'sin error');
    // Terminada la sesión: se cierra.
    await winMove(earlyRoom, '-1 day');
    assert.equal(await winMember(earlyRoom), false, 'sala terminada');
    // La anfitriona es asistente y entra en la misma ventana.
    await winMove(earlyRoom, '2 minutes');
    await actingAs(winHost);
    assert.equal(await winMember(earlyRoom), true, 'la anfitriona entra en ventana');

    // Cancelada dentro de la ventana: se cierra.
    const cancelledRoom = await winRoom();
    await winMove(cancelledRoom, '2 minutes');
    assert.equal(await winMember(cancelledRoom), true);
    await db.exec(`reset role; update public.lockin_rooms
      set cancelled_at = clock_timestamp() where id = '${cancelledRoom}';`);
    await actingAs(winBea);
    assert.equal(await winMember(cancelledRoom), false, 'sala cancelada');

    // Rechazada: pierde el acceso (y como no pudo autorizarse antes, no hay caché).
    const rejectedRoom = await winRoom();
    await winMove(rejectedRoom, '10 minutes');
    assert.equal(await winMember(rejectedRoom), false);
    await db.query(`select * from public.respond_room('${rejectedRoom}', 'rechazada')`);
    await winMove(rejectedRoom, '2 minutes');
    assert.equal(await winMember(rejectedRoom), false, 'rechazada, ni en ventana');
    assert.equal(
      await sonda(`select public.is_room_topic_member('lockin:room:no-es-uuid')`),
      'sin error'
    );
    assert.equal(await winMember(rejectedRoom), false);
    await db.exec(`reset role;
      create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      set local role authenticated;`);
    assert.equal(await winMember(earlyRoom), false, 'sin sesión no autoriza');
    const helper = (
      await db.query(`select provolatile, prosecdef, proconfig from pg_proc
        where oid = 'public.is_room_topic_member(text)'::regprocedure`)
    ).rows[0];
    assert.deepEqual(helper, { provolatile: 'v', prosecdef: false, proconfig: ['search_path=""'] });
    await db.exec('rollback;');
    console.log('H3: presencia de sala solo en ventana, no cancelada y no rechazada: OK');

    // H4: la publicación de Realtime no emite DELETE ni TRUNCATE.
    const publication = (
      await db.query(`select pubinsert, pubupdate, pubdelete, pubtruncate
        from pg_publication where pubname = 'supabase_realtime'`)
    ).rows;
    assert.deepEqual(publication, [
      { pubinsert: true, pubupdate: true, pubdelete: false, pubtruncate: false },
    ]);
    assert.deepEqual(
      (
        await db.query(`select tablename from pg_publication_tables
          where pubname = 'supabase_realtime' order by tablename`)
      ).rows.map((row) => row.tablename),
      ['lockin_rooms', 'lockin_sessions', 'matches', 'messages', 'session_attendance']
    );
    console.log('H4: supabase_realtime publica solo INSERT y UPDATE: OK');
  } finally {
    await db.close();
  }
});
