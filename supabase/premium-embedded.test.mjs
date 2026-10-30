// Premium (suscripción) contra PostgreSQL embebido (PGlite), sin Docker. Cubre las
// migraciones 20261030120000 (tablas), 20261030120100 (RPC) y 20261030120200
// (deck). Se corre con `npm run test:schema`.
//
// NO sustituye a la suite de contrato contra Supabase ni a los tests de contrato
// SQL de la spec §8 (casilla [Codex] de docs/plan/todo/premium.md): comprueba que
// el SQL hace lo que el mock de `src/data/mock/premium.ts` hace, en lo que PGlite
// puede probar.
//
// Límite de PGlite: una sola conexión. Las dos llamadas «a la vez» de los casos de
// concurrencia las encola PGlite una detrás de otra, así que no prueban el
// cerrojo; se complementan inspeccionando el cuerpo de `record_decision`, que es
// donde el orden (cerrojo antes de contar) se garantiza.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const pgliteModule = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href
  : '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const id = (n) => `00000000-0000-4000-8000-0000000000${n}`;
// Quien actúa y quienes reciben. Sus ids ordenan igual que su número.
const ME = id('a0');
const T = [1, 2, 3, 4, 5, 6, 7].map((n) => id(`b${n}`));
const LIKER_1 = id('c1');
const LIKER_2 = id('c2');
const LIKER_3 = id('c3');
const OTHER = id('d1');
const ALL = [ME, ...T, LIKER_1, LIKER_2, LIKER_3, OTHER];

test('Premium: tablas, cupos, deshacer, Boost, likes recibidos y deck', async (t) => {
  const { PGlite } = await import(pgliteModule);
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
    }
    // Las herramientas de desarrollo (`dev_*`) viven en el seed, no en migraciones.
    const seed = readFileSync(join(here, 'seed.sql'), 'utf8');
    await db.exec(
      seed.slice(seed.search(/create or replace function public\.seed_incoming_likes/))
    );

    await db.exec(`insert into auth.users (id, email) values
      ${ALL.map((u, i) => `('${u}', 'premium${i}@lockin.test')`).join(',\n      ')};
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, 'P' || p.n, 30, 'Madrid', 'Europe/Madrid', 'P',
             array['dev']::public.specialty[], 'lockin', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values ${ALL.map((u, i) => `('${u}', ${i})`).join(', ')}) as p(id, n);`);

    // --- utilidades ---------------------------------------------------------
    const actingAs = (uid) =>
      db.exec(`reset role;
        create or replace function auth.uid() returns uuid language sql as $$ select '${uid}'::uuid $$;
        set local role authenticated;`);
    const asOwner = (sql) => db.exec(`reset role; ${sql}`);
    // Cada caso corre en su transacción y la deshace: no se contaminan.
    const tx = async (fn) => {
      await db.exec('begin;');
      try {
        await fn();
      } finally {
        await db.exec('rollback;');
      }
    };
    // Ejecuta sin romper la transacción si falla; si va bien, conserva el efecto.
    const attempt = async (sql) => {
      await db.exec('savepoint intento;');
      try {
        const result = await db.query(sql);
        await db.exec('release savepoint intento;');
        return { ok: true, rows: result.rows };
      } catch (error) {
        await db.exec('rollback to savepoint intento;');
        return { ok: false, code: error.code, detail: error.detail, message: error.message };
      }
    };
    const like = (target, extra = '') =>
      attempt(`select (public.record_decision('${target}', 'like'${extra})).id as match_id`);
    const superLike = (target) => like(target, ', null, true');
    const pass = (target) =>
      attempt(`select (public.record_decision('${target}', 'pass')).id as m`);
    const seedLikeEvents = (kind, count, ageHours) =>
      asOwner(`insert into public.like_events (actor_id, target_id, kind, created_at)
        select '${ME}', gen_random_uuid(), '${kind}', now() - ${ageHours} * interval '1 hour'
        from generate_series(1, ${count});`);
    const setPremium = (uid, active = true) =>
      asOwner(`insert into public.entitlements (user_id, premium_until, product_id, store)
        values ('${uid}', ${active ? "now() + interval '30 days'" : "now() - interval '1 minute'"},
                'test', 'play_store')
        on conflict (user_id) do update set premium_until = excluded.premium_until;`);
    const rows = async (sql) => (await db.query(sql)).rows;
    const quotas = async () => (await rows('select * from public.premium_quotas()'))[0];
    // like_events está cerrada al cliente: se lee como dueño y se vuelve a authenticated.
    const eventCount = async () => {
      await db.exec('reset role;');
      const n = (
        await rows(`select count(*)::int as n from public.like_events where actor_id = '${ME}'`)
      )[0].n;
      await db.exec('set local role authenticated;');
      return n;
    };
    const deckIds = async (args = '') =>
      (await rows(`select id from public.discovery_deck(${args})`)).map((r) => r.id);
    const isoMs = (iso) => {
      assert.match(iso, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, `no es ISO: ${iso}`);
      return Date.parse(iso);
    };

    // =======================================================================
    // Tarea 2 — tablas
    // =======================================================================

    await t.test('RLS activada en las cuatro tablas nuevas', async () => {
      const result = await rows(`select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('entitlements', 'like_events', 'boosts', 'revenuecat_events')
        order by relname`);
      assert.deepEqual(result, [
        { relname: 'boosts', relrowsecurity: true },
        { relname: 'entitlements', relrowsecurity: true },
        { relname: 'like_events', relrowsecurity: true },
        { relname: 'revenuecat_events', relrowsecurity: true },
      ]);
    });

    await t.test(
      'authenticated no puede insertar ni actualizar entitlements, like_events, boosts ni revenuecat_events',
      () =>
        tx(async () => {
          await actingAs(ME);
          const writes = {
            entitlements: [
              `insert into public.entitlements (user_id, premium_until) values ('${ME}', now() + interval '1 day')`,
              `update public.entitlements set premium_until = now() + interval '1 day'`,
              'delete from public.entitlements',
            ],
            like_events: [
              `insert into public.like_events (actor_id, target_id, kind) values ('${ME}', '${T[0]}', 'like')`,
              `update public.like_events set kind = 'like'`,
              'delete from public.like_events',
              'select * from public.like_events',
            ],
            boosts: [
              `insert into public.boosts (user_id, starts_at, ends_at) values ('${ME}', now(), now() + interval '1 minute')`,
              'update public.boosts set ends_at = now()',
              'delete from public.boosts',
              'select * from public.boosts',
            ],
            revenuecat_events: [
              `insert into public.revenuecat_events (event_id) values ('x')`,
              `update public.revenuecat_events set event_id = 'y'`,
              'delete from public.revenuecat_events',
              'select * from public.revenuecat_events',
            ],
          };
          for (const [table, statements] of Object.entries(writes)) {
            for (const statement of statements) {
              const result = await attempt(statement);
              assert.equal(result.code, '42501', `${table}: «${statement}» debería ser 42501`);
            }
          }
          // Ni siquiera anon lee la tabla de Premium.
          await asOwner('set local role anon;');
          assert.equal((await attempt('select * from public.entitlements')).code, '42501');
        })
    );

    await t.test('solo lee su propia fila de entitlements', () =>
      tx(async () => {
        await setPremium(ME);
        await setPremium(T[0]);
        await actingAs(ME);
        assert.deepEqual(
          (await rows('select user_id from public.entitlements')).map((r) => r.user_id),
          [ME]
        );
        await actingAs(T[0]);
        assert.deepEqual(
          (await rows('select user_id from public.entitlements')).map((r) => r.user_id),
          [T[0]]
        );
        await actingAs(T[1]);
        assert.deepEqual(await rows('select user_id from public.entitlements'), []);
      })
    );

    await t.test(
      'is_premium es true con premium_until futuro y false con pasado, null o sin fila',
      () =>
        tx(async () => {
          await asOwner(`insert into public.entitlements (user_id, premium_until) values
          ('${T[0]}', now() + interval '1 day'),
          ('${T[1]}', now() - interval '1 second'),
          ('${T[2]}', null);`);
          const check = async (uid) => (await rows(`select public.is_premium('${uid}') as v`))[0].v;
          assert.equal(await check(T[0]), true);
          assert.equal(await check(T[1]), false);
          assert.equal(await check(T[2]), false);
          assert.equal(await check(T[3]), false, 'sin fila');
          assert.equal(await check(ME), false);
        })
    );

    await t.test(
      'is_premium, premium_limits y las auxiliares no las ejecuta nadie desde el cliente',
      async () => {
        const sigs = [
          'public.is_premium(uuid)',
          'public.premium_limits()',
          'public.like_window_reset(uuid,text,interval,integer,timestamptz)',
          'public.purge_old_premium_records()',
        ];
        for (const sig of sigs) {
          for (const role of ['anon', 'authenticated']) {
            assert.equal(
              (await rows(`select has_function_privilege('${role}', '${sig}', 'execute') as v`))[0]
                .v,
              false,
              `${role} no debe ejecutar ${sig}`
            );
          }
        }
      }
    );

    await t.test('premium_limits() coincide con src/data/premium-limits.ts', async () => {
      const ts = readFileSync(join(here, '..', 'src', 'data', 'premium-limits.ts'), 'utf8');
      const fromTs = Object.fromEntries(
        [...ts.matchAll(/export const ([A-Z_]+) = (\d+);/g)].map((m) => [
          m[1].toLowerCase(),
          Number(m[2]),
        ])
      );
      assert.equal(Object.keys(fromTs).length, 7, 'el TS debe traer los siete límites');
      const sql = (await rows('select * from public.premium_limits()'))[0];
      assert.deepEqual(sql, fromTs);
    });

    await t.test('borrar un perfil no borra sus like_events como target, y sí como actor', () =>
      tx(async () => {
        await asOwner(`insert into public.like_events (actor_id, target_id, kind) values
          ('${ME}', '${T[0]}', 'like'), ('${T[0]}', '${ME}', 'like');`);
        await asOwner(`delete from public.profiles where id = '${T[0]}'`);
        const left = await rows('select actor_id, target_id from public.like_events');
        assert.deepEqual(left, [{ actor_id: ME, target_id: T[0] }]);
      })
    );

    await t.test(
      'purge_old_premium_records borra likes de más de 30 días y eventos de más de 90',
      () =>
        tx(async () => {
          await asOwner(`insert into public.like_events (actor_id, target_id, kind, created_at) values
          ('${ME}', '${T[0]}', 'like', now() - interval '31 days'),
          ('${ME}', '${T[1]}', 'like', now() - interval '29 days');
          insert into public.revenuecat_events (event_id, received_at) values
          ('viejo', now() - interval '91 days'), ('reciente', now() - interval '89 days');`);
          await db.exec('select public.purge_old_premium_records();');
          assert.deepEqual(
            (await rows('select target_id from public.like_events')).map((r) => r.target_id),
            [T[1]]
          );
          assert.deepEqual(
            (await rows('select event_id from public.revenuecat_events')).map((r) => r.event_id),
            ['reciente']
          );
        })
    );

    await t.test(
      'las herramientas dev_* siembran el estado y dev_reset_current_user lo limpia',
      () =>
        tx(async () => {
          await actingAs(ME);
          await db.exec('select public.dev_set_premium(true)');
          assert.equal((await quotas()).is_premium, true);
          await db.exec('select public.dev_set_premium(false)');
          assert.equal((await quotas()).is_premium, false);

          await db.exec("select public.dev_add_like_events('like', 5, 2)");
          assert.equal((await quotas()).likes_left, 20);
          await db.exec("select public.dev_add_like_events('super', 1, 2)");
          assert.equal((await quotas()).supers_left, 0);

          await like(T[0]);
          await db.exec('select public.dev_age_last_decision(11)');
          await db.exec('select public.dev_set_premium(true)');
          assert.equal(
            (await attempt('select public.undo_last_decision()')).rows[0].undo_last_decision,
            null
          );

          await db.exec('select public.dev_add_boost(29)');
          assert.equal((await attempt('select public.activate_boost()')).code, 'LQ003');

          await db.exec('select public.dev_reset_current_user()');
          await asOwner('');
          const left = await rows(`select
          (select count(*) from public.like_events where actor_id = '${ME}')::int as likes,
          (select count(*) from public.boosts where user_id = '${ME}')::int as boosts,
          (select count(*) from public.entitlements where user_id = '${ME}')::int as ents`);
          assert.deepEqual(left, [{ likes: 0, boosts: 0, ents: 0 }]);
        })
    );

    // =======================================================================
    // Tarea 3 — record_decision, deshacer, Boost, cuotas y likes recibidos
    // =======================================================================

    await t.test(
      'record_decision tiene una sola firma, de 4 argumentos, y la ejecuta authenticated',
      async () => {
        const fns = await rows(`select pg_get_function_identity_arguments(p.oid) as firma,
          p.prosecdef, p.proconfig,
          has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as auth
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'record_decision'`);
        assert.deepEqual(fns, [
          {
            firma: 'p_target_id uuid, p_decision decision, p_mode mode_preference, p_super boolean',
            prosecdef: true,
            proconfig: ['search_path=""'],
            anon: false,
            auth: true,
          },
        ]);
      }
    );

    await t.test('los RPC nuevos no los puede ejecutar anon', async () => {
      const sigs = [
        'public.record_decision(uuid,public.decision,public.mode_preference,boolean)',
        'public.undo_last_decision()',
        'public.activate_boost()',
        'public.premium_quotas()',
        'public.incoming_likes_count()',
        'public.incoming_likes(integer,timestamptz,boolean,uuid)',
        'public.discovery_deck(public.mode_preference,public.specialty[],integer,uuid[],integer,public.time_band[],public.ambition[],public.starting_point[],integer)',
      ];
      for (const sig of sigs) {
        assert.deepEqual(
          (
            await rows(`select
              has_function_privilege('anon', '${sig}', 'execute') as anon,
              has_function_privilege('authenticated', '${sig}', 'execute') as auth,
              exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                       where p.oid = '${sig}'::regprocedure and a.grantee = 0) as public`)
          )[0],
          { anon: false, auth: true, public: false },
          sig
        );
      }
      await tx(async () => {
        await asOwner('set local role anon;');
        assert.equal((await attempt('select * from public.premium_quotas()')).code, '42501');
      });
    });

    await t.test(
      'el like 25 pasa y el 26 falla con LQ001 y un detail ISO entre +22 h y +24 h',
      () =>
        tx(async () => {
          await seedLikeEvents('like', 24, 1);
          await actingAs(ME);
          assert.equal((await like(T[0])).ok, true);
          const before = Date.now();
          const refused = await like(T[1]);
          assert.equal(refused.code, 'LQ001');
          const resetsAt = isoMs(refused.detail);
          assert.ok(resetsAt >= before + 22 * HOUR_MS, 'no antes de +22 h');
          assert.ok(resetsAt <= Date.now() + 24 * HOUR_MS, 'no después de +24 h');
          const q = await quotas();
          assert.equal(q.likes_left, 0);
          assert.ok(Math.abs(new Date(q.likes_reset_at).getTime() - resetsAt) <= 1);
        })
    );

    await t.test('un rechazo no escribe nada: ni decisión ni evento', () =>
      tx(async () => {
        await seedLikeEvents('like', 25, 1);
        await actingAs(ME);
        assert.equal((await like(T[0])).code, 'LQ001');
        assert.equal(await eventCount(), 25);
        assert.deepEqual(await rows('select * from public.decisions'), []);
      })
    );

    await t.test('los likes de hace más de 24 h no cuentan', () =>
      tx(async () => {
        await seedLikeEvents('like', 25, 25);
        await actingAs(ME);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await quotas()).likes_left, 24);
      })
    );

    await t.test('like, pass y like sobre el mismo perfil gastan dos', () =>
      tx(async () => {
        await seedLikeEvents('like', 23, 1);
        await actingAs(ME);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await pass(T[0])).ok, true);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await like(T[1])).code, 'LQ001');
        assert.equal(await eventCount(), 25);
      })
    );

    await t.test('repetir el mismo like no gasta', () =>
      tx(async () => {
        await seedLikeEvents('like', 24, 1);
        await actingAs(ME);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await quotas()).likes_left, 0);
        assert.equal(await eventCount(), 25);
      })
    );

    await t.test('dos record_decision a la vez con 24 eventos dejan exactamente 25', () =>
      tx(async () => {
        await seedLikeEvents('like', 24, 1);
        await actingAs(ME);
        // PGlite encola las dos: esto prueba el conteo, no la contención (ver cabecera).
        // El bloque DO se traga el LQ001 para que la transacción siga viva.
        const guarded = (target) =>
          db.exec(`do $do$ begin
            perform public.record_decision('${target}', 'like');
          exception when sqlstate 'LQ001' then null;
          end $do$;`);
        await Promise.all([guarded(T[0]), guarded(T[1])]);
        assert.equal(await eventCount(), 25, 'solo una de las dos gastó');
        assert.equal((await rows('select * from public.decisions')).length, 1);
      })
    );

    await t.test('el cerrojo por actor se toma antes de contar los eventos', async () => {
      const body = (
        await rows(
          `select pg_get_functiondef('public.record_decision(uuid,public.decision,public.mode_preference,boolean)'::regprocedure) as d`
        )
      )[0].d;
      const lock = body.search(/pg_advisory_xact_lock\(hashtextextended\(v_actor::text, 0\)\)/);
      const count = body.search(/from public\.like_events e\s+where e\.actor_id = v_actor/);
      assert.ok(lock >= 0 && count >= 0 && lock < count, 'cerrojo antes del primer conteo');
      assert.ok(
        lock < body.search(/v_now := clock_timestamp\(\)/),
        'el reloj se captura después del cerrojo'
      );
    });

    await t.test('con Premium no hay 25 pero sí 300 (LQ004), con detail', () =>
      tx(async () => {
        await setPremium(ME);
        await seedLikeEvents('like', 299, 1);
        await actingAs(ME);
        assert.equal((await like(T[0])).ok, true);
        const refused = await like(T[1]);
        assert.equal(refused.code, 'LQ004');
        isoMs(refused.detail);
        const q = await quotas();
        assert.equal(q.is_premium, true);
        assert.equal(q.likes_left, null);
        assert.ok(q.premium_until);
      })
    );

    await t.test('un Premium caducado vuelve a tener el cupo gratis', () =>
      tx(async () => {
        await setPremium(ME, false);
        await seedLikeEvents('like', 25, 1);
        await actingAs(ME);
        assert.equal((await like(T[0])).code, 'LQ001');
        assert.equal((await quotas()).is_premium, false);
      })
    );

    await t.test('el pass no gasta ni tiene límite', () =>
      tx(async () => {
        await seedLikeEvents('like', 25, 1);
        await actingAs(ME);
        assert.equal((await pass(T[0])).ok, true);
        assert.equal(await eventCount(), 25);
      })
    );

    await t.test('Super Like: 1 a la semana gratis y gasta también del diario', () =>
      tx(async () => {
        await actingAs(ME);
        assert.equal((await superLike(T[0])).ok, true);
        const q = await quotas();
        assert.equal(q.likes_left, 24);
        assert.equal(q.supers_left, 0);
        assert.ok(q.supers_reset_at);
        const refused = await superLike(T[1]);
        assert.equal(refused.code, 'LQ002');
        isoMs(refused.detail);
        assert.deepEqual(
          (await rows(`select decision, is_super from public.decisions order by target_id`)).map(
            (r) => [r.decision, r.is_super]
          ),
          [['like', true]]
        );
      })
    );

    await t.test('con Premium hay 5 Super Likes por semana y el sexto falla', () =>
      tx(async () => {
        await setPremium(ME);
        await actingAs(ME);
        for (const target of T.slice(0, 5)) assert.equal((await superLike(target)).ok, true);
        assert.equal((await superLike(T[5])).code, 'LQ002');
        assert.equal((await quotas()).supers_left, 0);
      })
    );

    await t.test('un Super Like sobre un like ya dado cuenta como un like nuevo', () =>
      tx(async () => {
        await actingAs(ME);
        assert.equal((await like(T[0])).ok, true);
        assert.equal((await superLike(T[0])).ok, true);
        assert.equal(await eventCount(), 2);
        assert.equal((await quotas()).supers_left, 0);
      })
    );

    await t.test('un Super Like recíproco crea match igual que un like', () =>
      tx(async () => {
        await asOwner(
          `insert into public.decisions (actor_id, target_id, decision) values ('${LIKER_1}', '${ME}', 'like')`
        );
        await actingAs(ME);
        const result = await superLike(LIKER_1);
        assert.ok(result.rows[0].match_id, 'hay match');
      })
    );

    await t.test('deshacer sin Premium lanza LQ005', () =>
      tx(async () => {
        await actingAs(ME);
        await pass(T[0]);
        assert.equal((await attempt('select public.undo_last_decision()')).code, 'LQ005');
      })
    );

    await t.test('deshacer devuelve el perfil al deck, y no devuelve el like gastado', () =>
      tx(async () => {
        await setPremium(ME);
        await actingAs(ME);
        await like(T[0]);
        assert.ok(!(await deckIds()).includes(T[0]));
        const undone = await attempt('select public.undo_last_decision() as t');
        assert.equal(undone.rows[0].t, T[0]);
        assert.ok((await deckIds()).includes(T[0]), 'vuelve al deck');
        assert.equal(await eventCount(), 1, 'el like gastado no se devuelve');
      })
    );

    await t.test('deshace solo el último, y no pasados 10 minutos', () =>
      tx(async () => {
        await setPremium(ME);
        await actingAs(ME);
        await pass(T[0]);
        await pass(T[1]);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, T[1]);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, T[0]);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, null);

        await pass(T[2]);
        await asOwner(
          `update public.decisions set created_at = created_at - interval '11 minutes'`
        );
        await actingAs(ME);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, null);
        assert.equal((await rows('select * from public.decisions')).length, 1);
      })
    );

    await t.test('no se deshace un like que creó match, y el match sigue', () =>
      tx(async () => {
        await setPremium(ME);
        await asOwner(
          `insert into public.decisions (actor_id, target_id, decision) values ('${LIKER_1}', '${ME}', 'like')`
        );
        await actingAs(ME);
        assert.ok((await like(LIKER_1)).rows[0].match_id);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, null);
        assert.equal((await rows('select * from public.matches')).length, 1);
        assert.equal(
          (await rows('select * from public.decisions where actor_id = auth.uid()')).length,
          1
        );
      })
    );

    await t.test('si el otro te da like entre tu like y tu deshacer, el match sigue', () =>
      tx(async () => {
        await setPremium(ME);
        await actingAs(ME);
        await like(LIKER_1);
        await actingAs(LIKER_1);
        assert.ok((await like(ME)).rows[0].match_id, 'el otro lado cierra el match');
        await actingAs(ME);
        assert.equal((await attempt('select public.undo_last_decision() as t')).rows[0].t, null);
        assert.equal((await rows('select * from public.matches')).length, 1);
      })
    );

    await t.test('Boost: sin Premium LQ005; con Premium +30 min; el segundo LQ003 con detail', () =>
      tx(async () => {
        await actingAs(ME);
        assert.equal((await attempt('select public.activate_boost()')).code, 'LQ005');
        await setPremium(ME);
        await actingAs(ME);
        const first = await attempt('select public.activate_boost() as ends');
        const ends = new Date(first.rows[0].ends).getTime();
        assert.ok(Math.abs(ends - (Date.now() + 30 * MINUTE_MS)) < MINUTE_MS, '+30 min');
        const second = await attempt('select public.activate_boost()');
        assert.equal(second.code, 'LQ003');
        const available = isoMs(second.detail);
        assert.ok(Math.abs(available - (Date.now() + 30 * 24 * HOUR_MS)) < MINUTE_MS);
        const q = await quotas();
        assert.equal(new Date(q.boost_active_until).getTime(), ends);
        assert.equal(new Date(q.boost_available_at).getTime(), available);
      })
    );

    await t.test('Boost: a los 29 días rechaza y a los 31 resuelve', () =>
      tx(async () => {
        await setPremium(ME);
        const past = (days) =>
          asOwner(`delete from public.boosts; insert into public.boosts (user_id, starts_at, ends_at)
            values ('${ME}', now() - interval '${days} days', now() - interval '${days} days' + interval '30 minutes');`);
        await past(29);
        await actingAs(ME);
        assert.equal((await attempt('select public.activate_boost()')).code, 'LQ003');
        await past(31);
        await actingAs(ME);
        assert.equal((await attempt('select public.activate_boost()')).ok, true);
        assert.equal((await quotas()).boost_available_at !== null, true);
      })
    );

    await t.test('premium_quotas de una persona gratis sin actividad', () =>
      tx(async () => {
        await actingAs(ME);
        assert.deepEqual(await quotas(), {
          is_premium: false,
          premium_until: null,
          likes_left: 25,
          likes_reset_at: null,
          supers_left: 1,
          supers_reset_at: null,
          boost_available_at: null,
          boost_active_until: null,
        });
      })
    );

    await t.test('likes recibidos: el número cuenta los pendientes y baja al decidir', () =>
      tx(async () => {
        await asOwner(`insert into public.decisions (actor_id, target_id, decision, is_super) values
          ('${LIKER_1}', '${ME}', 'like', true), ('${LIKER_2}', '${ME}', 'like', false),
          ('${LIKER_3}', '${ME}', 'pass', false);`);
        await actingAs(ME);
        const count = async () => (await rows('select public.incoming_likes_count() as n'))[0].n;
        assert.equal(await count(), 2, 'el pass del otro no cuenta');
        await pass(LIKER_2);
        assert.equal(await count(), 1);
      })
    );

    await t.test('incoming_likes: sin Premium LQ005; con Premium, Super Likes primero', () =>
      tx(async () => {
        await asOwner(`insert into public.decisions (actor_id, target_id, decision, is_super, created_at) values
          ('${LIKER_1}', '${ME}', 'like', false, now() - interval '1 hour'),
          ('${LIKER_2}', '${ME}', 'like', true, now() - interval '5 hours'),
          ('${LIKER_3}', '${ME}', 'like', false, now() - interval '2 hours');`);
        await actingAs(ME);
        assert.equal((await attempt('select * from public.incoming_likes()')).code, 'LQ005');
        await setPremium(ME);
        await actingAs(ME);
        const list = await rows('select id, name, is_super, liked_at from public.incoming_likes()');
        assert.deepEqual(
          list.map((r) => [r.id, r.is_super]),
          [
            [LIKER_2, true],
            [LIKER_1, false],
            [LIKER_3, false],
          ]
        );
        assert.ok(list[0].name, 'viene el perfil completo');
      })
    );

    await t.test('incoming_likes pagina sobre el orden completo (Super Likes primero)', () =>
      tx(async () => {
        await setPremium(ME);
        await asOwner(`insert into public.decisions (actor_id, target_id, decision, is_super, created_at) values
          ('${LIKER_1}', '${ME}', 'like', true, now() - interval '9 hours'),
          ('${LIKER_2}', '${ME}', 'like', false, now() - interval '1 hour'),
          ('${LIKER_3}', '${ME}', 'like', false, now() - interval '2 hours');`);
        await actingAs(ME);
        const seen = [];
        let page = await rows('select id, is_super, liked_at from public.incoming_likes(1)');
        while (page.length > 0) {
          seen.push(page[0].id);
          const last = page[0];
          page = await rows(
            `select id, is_super, liked_at from public.incoming_likes(1, '${last.liked_at.toISOString()}', ${last.is_super}, '${last.id}')`
          );
        }
        assert.deepEqual(seen, [LIKER_1, LIKER_2, LIKER_3]);
        // Solo con la fecha (la forma simple) pagina por fecha.
        const byDate = await rows(
          `select id from public.incoming_likes(10, now() - interval '90 minutes')`
        );
        assert.deepEqual(
          byDate.map((r) => r.id),
          [LIKER_1, LIKER_3],
          'sigue el orden: Super Like primero'
        );
      })
    );

    await t.test(
      'un bloqueo en cualquier dirección saca el perfil de incoming_likes y de su número',
      () =>
        tx(async () => {
          await setPremium(ME);
          await asOwner(`insert into public.decisions (actor_id, target_id, decision, is_super) values
          ('${LIKER_1}', '${ME}', 'like', true), ('${LIKER_2}', '${ME}', 'like', true),
          ('${LIKER_3}', '${ME}', 'like', false);`);
          await actingAs(ME);
          const state = async () => ({
            n: (await rows('select public.incoming_likes_count() as n'))[0].n,
            ids: (await rows('select id from public.incoming_likes()')).map((r) => r.id).sort(),
          });
          assert.deepEqual(await state(), { n: 3, ids: [LIKER_1, LIKER_2, LIKER_3] });
          await asOwner(`insert into public.user_blocks (blocker_id, blocked_id) values
          ('${LIKER_1}', '${ME}'), ('${ME}', '${LIKER_2}');`);
          await actingAs(ME);
          assert.deepEqual(await state(), { n: 1, ids: [LIKER_3] });
        })
    );

    // =======================================================================
    // Tarea 4 — discovery_deck
    // =======================================================================

    await t.test('discovery_deck: una sola firma y devuelve super_liked_me', async () => {
      assert.equal(
        (
          await rows(`select count(*)::int as n from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'discovery_deck'`)
        )[0].n,
        1
      );
      await tx(async () => {
        await actingAs(ME);
        const result = await db.query('select * from public.discovery_deck()');
        assert.ok(result.fields.some((f) => f.name === 'super_liked_me'));
        assert.equal(result.rows.length, ALL.length - 1);
      });
    });

    await t.test('cualquier filtro premium sin Premium lanza LQ005, y el de especialidad no', () =>
      tx(async () => {
        await actingAs(ME);
        for (const args of [
          'p_min_hours_per_week => 5',
          "p_time_bands => array['noche']::public.time_band[]",
          "p_ambition => array['todo-o-nada']::public.ambition[]",
          "p_starting_point => array['solo-ganas']::public.starting_point[]",
          'p_timezone_window_hours => 3',
        ]) {
          const result = await attempt(`select * from public.discovery_deck(${args})`);
          assert.equal(result.code, 'LQ005', args);
        }
        const free = await attempt(
          "select * from public.discovery_deck(p_specialties => array['dev']::public.specialty[])"
        );
        assert.equal(free.ok, true);
        await setPremium(ME);
        await actingAs(ME);
        assert.equal(
          (await attempt('select * from public.discovery_deck(p_min_hours_per_week => 5)')).ok,
          true
        );
      })
    );

    await t.test('filtros premium: horas, franjas, ambición y punto de partida', () =>
      tx(async () => {
        await setPremium(ME);
        await asOwner(`update public.profiles set availability_hours_per_week = 30,
            availability_bands = array['noche','madrugada']::public.time_band[],
            ambition = 'todo-o-nada', starting_point = 'algo-empezado'
          where id = '${T[0]}';
          update public.profiles set availability_hours_per_week = 3 where id = '${T[1]}';`);
        await actingAs(ME);
        const where = async (args) => (await deckIds(args)).filter((u) => T.includes(u));
        assert.deepEqual(await where('p_min_hours_per_week => 20'), [T[0]]);
        assert.deepEqual(await where("p_time_bands => array['madrugada']::public.time_band[]"), [
          T[0],
        ]);
        assert.deepEqual(await where("p_ambition => array['todo-o-nada']::public.ambition[]"), [
          T[0],
        ]);
        assert.deepEqual(
          await where("p_starting_point => array['algo-empezado']::public.starting_point[]"),
          [T[0]]
        );
        assert.equal((await where('p_min_hours_per_week => 0')).length, T.length);
        assert.equal(
          (await where('p_ambition => array[]::public.ambition[]')).length,
          T.length,
          'una lista vacía no filtra, como en el mock'
        );
      })
    );

    await t.test(
      'p_timezone_window_hours = 2 deja fuera un perfil a 6 h y deja dentro uno a 1 h',
      () =>
        tx(async () => {
          // Zonas fijas (sin horario de verano) para que el desfase no dependa de la fecha.
          await asOwner(`update public.profiles set timezone = 'Etc/GMT+8';
          update public.profiles set timezone = 'Etc/GMT-1' where id = '${ME}';
          update public.profiles set timezone = 'Etc/GMT+5' where id = '${T[0]}';
          update public.profiles set timezone = 'Etc/GMT-2' where id = '${T[1]}';
          update public.profiles set timezone = 'Etc/GMT-1' where id = '${T[2]}';
          update public.profiles set timezone = 'Zona/Inventada' where id = '${T[3]}';`);
          const formula = await rows(`select abs(extract(epoch from
            (now() at time zone 'Etc/GMT+5') - (now() at time zone 'Etc/GMT-1'))) / 3600 as h`);
          assert.equal(Number(formula[0].h), 6, 'la fórmula del plan da 6 h');
          await setPremium(ME);
          await actingAs(ME);
          const near = (await deckIds('p_timezone_window_hours => 2')).filter((u) => T.includes(u));
          assert.ok(!near.includes(T[0]), 'a 6 h queda fuera');
          assert.ok(near.includes(T[1]), 'a 1 h queda dentro');
          assert.ok(near.includes(T[2]), 'a 0 h queda dentro');
          assert.ok(near.includes(T[3]), 'una zona que no se reconoce cuenta como UTC (a 1 h)');
          const wide = (await deckIds('p_timezone_window_hours => 12')).filter((u) =>
            T.includes(u)
          );
          assert.ok(wide.includes(T[0]));
          const zero = (await deckIds('p_timezone_window_hours => 0')).filter((u) => T.includes(u));
          assert.deepEqual(zero, [T[2]]);
        })
    );

    await t.test('orden: Super Like recibido, después Boost activo, después el de siempre', () =>
      tx(async () => {
        const superUser = T[6];
        const boosted = T[5];
        await setPremium(boosted);
        await asOwner(`insert into public.boosts (user_id, starts_at, ends_at)
            values ('${boosted}', now() - interval '1 minute', now() + interval '29 minutes');
          insert into public.decisions (actor_id, target_id, decision, is_super) values
            ('${superUser}', '${ME}', 'like', true), ('${T[0]}', '${ME}', 'like', false);`);
        await actingAs(ME);
        const rowsOut = await rows('select id, super_liked_me from public.discovery_deck()');
        const ids = rowsOut.map((r) => r.id);
        assert.equal(ids[0], superUser);
        assert.equal(ids[1], boosted);
        const rest = rowsOut.slice(2);
        assert.deepEqual(
          rest.map((r) => r.id),
          [...rest.map((r) => r.id)].sort(),
          'el resto, por id'
        );
        assert.deepEqual(
          rowsOut.filter((r) => r.super_liked_me).map((r) => r.id),
          [superUser],
          'un like normal no lleva insignia'
        );
      })
    );

    await t.test('un Boost terminado no adelanta', () =>
      tx(async () => {
        await asOwner(`insert into public.boosts (user_id, starts_at, ends_at)
          values ('${T[5]}', now() - interval '2 hours', now() - interval '1 hour');`);
        await actingAs(ME);
        const ids = await deckIds();
        assert.deepEqual(ids, [...ids].sort());
      })
    );

    await t.test('el Boost no mete un perfil que el filtro excluye', () =>
      tx(async () => {
        await setPremium(ME);
        await asOwner(`update public.profiles set ambition = 'todo-o-nada' where id = '${T[0]}';
          insert into public.boosts (user_id, starts_at, ends_at)
          values ('${T[5]}', now() - interval '1 minute', now() + interval '29 minutes');`);
        await actingAs(ME);
        assert.deepEqual(await deckIds("p_ambition => array['todo-o-nada']::public.ambition[]"), [
          T[0],
        ]);
      })
    );

    await t.test(
      'el Super Like de quien me bloquea, o de quien ya decidí, no sale con insignia',
      () =>
        tx(async () => {
          await asOwner(`insert into public.decisions (actor_id, target_id, decision, is_super) values
          ('${LIKER_1}', '${ME}', 'like', true), ('${LIKER_2}', '${ME}', 'like', true);
          insert into public.user_blocks (blocker_id, blocked_id) values ('${LIKER_1}', '${ME}');`);
          await actingAs(ME);
          const withBadge = async () =>
            (await rows('select id from public.discovery_deck() where super_liked_me')).map(
              (r) => r.id
            );
          assert.deepEqual(await withBadge(), [LIKER_2], 'el bloqueo de LIKER_1 lo esconde');
          assert.ok(!(await deckIds()).includes(LIKER_1));
          await pass(LIKER_2);
          assert.deepEqual(await withBadge(), [], 'una vez decidido, sale del deck');
        })
    );

    await t.test('el deck conserva el filtro de modo, p_exclude_ids y p_limit', () =>
      tx(async () => {
        await asOwner(`update public.profiles set looking_for = 'par' where id = '${T[0]}'`);
        await actingAs(ME);
        assert.ok(!(await deckIds("p_mode => 'lockin'")).includes(T[0]));
        assert.ok((await deckIds("p_mode => 'par'")).includes(T[0]));
        assert.ok(!(await deckIds(`p_exclude_ids => array['${T[1]}']::uuid[]`)).includes(T[1]));
        assert.equal((await deckIds('p_limit => 3')).length, 3);
      })
    );
  } finally {
    await db.close();
  }
});
