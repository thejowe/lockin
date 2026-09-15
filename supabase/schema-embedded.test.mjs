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

// Ya no lleva `skip`: con el paquete fuera del árbol, saltarse el test era lo
// razonable; ahora que viene con `npm ci`, que falte significa entorno a medio
// instalar, y un salto silencioso dejaría el job verde sin ejecutar una línea de
// SQL — que es peor que no tener job.
const pgliteModule = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href
  : '@electric-sql/pglite';

test('PostgreSQL embebido: migraciones, huella, rol lector, mutaciones y retirada', async () => {
  const { PGlite } = await import(pgliteModule);
  const db = new PGlite();
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    // Solo fixture de Auth: no GoTrue, REST, seeds de cuentas ni permisos Supabase.
    await db.exec(`create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create role anon; create role authenticated; create role service_role;
      create publication supabase_realtime;`);
    const migrations = readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of migrations) {
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
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
    assert.match(expected, /column\s+profiles.seeking_specialties/);
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
    ];
    for (const mutation of mutations) {
      await db.exec(`begin; ${mutation}`);
      assert.notEqual(compareFingerprints(expected, await fingerprint()), '');
      await db.exec('rollback;');
    }
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
    console.log('Rol lector, 4 mutaciones, teardown dos veces y guardia de sobrecarga: OK');
  } finally {
    await db.close();
  }
});
