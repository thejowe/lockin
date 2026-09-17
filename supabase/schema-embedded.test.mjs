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
      .filter((line) => line.startsWith('rtpolicy'))
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
  } finally {
    await db.close();
  }
});
