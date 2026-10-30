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

  } finally {
    await db.close();
  }
});
