// Inventario y borrado de cuentas de seed/pruebas contra PostgreSQL embebido.
// NO sustituye ejecutarlos en Supabase: auth.users es un fixture con las
// columnas que usan seed.sql y los dos scripts, sin GoTrue ni sus tablas hijas.
// Se corre con `npm run test:schema` —job «SQL embebido» de ci.yml—: PGlite 0.3.14
// es devDependency desde 2026-09-15, así que después de `npm ci` no hace falta
// nada más. PGLITE_MODULE (ruta absoluta al dist/index.js de una copia instalada
// fuera del repo, supabase/README.md) se sigue admitiendo y tiene prioridad.
// Lo destructivo que prueba (borrado.sql) solo toca la base efímera en memoria
// que crea cada pasada: sin red y sin credenciales, no alcanza a ningún proyecto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, ...parts), 'utf8');

// Ya no lleva `skip`: con el paquete fuera del árbol, saltarse el test era lo
// razonable; ahora que viene con `npm ci`, que falte significa entorno a medio
// instalar, y un salto silencioso dejaría el job verde sin ejecutar una línea de
// SQL — que es peor que no tener job.
const pgliteModule = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href
  : '@electric-sql/pglite';

const NURIA = '11111111-1111-4111-8111-000000000001';
const MARC = '11111111-1111-4111-8111-000000000002';
const REAL = 'aaaaaaaa-0000-4000-8000-000000000001';
const LONE = 'aaaaaaaa-0000-4000-8000-000000000002';
const DEVICE = 'dddddddd-0000-4000-8000-000000000001';
const burst = (n, i) => `bbbbbbb${n}-0000-4000-8000-00000000000${i}`;
const BURST_A = [1, 2, 3, 4].map((i) => burst(1, i)); // teardown hecho: sin perfil
const BURST_B = [1, 2, 3, 4].map((i) => burst(2, i)); // pasada muerta: con perfil
const B_NAMES = ['Perfil Prueba', 'Recíproca Par', 'Recíproca Lockin', 'Recíproca Ambos'];

async function freshDatabase(PGlite) {
  const db = new PGlite();
  await db.exec(`create schema auth; create schema extensions;
    create table auth.users (
      id uuid primary key, instance_id uuid, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz,
      last_sign_in_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
      is_anonymous boolean not null default false,
      confirmation_token text, recovery_token text, email_change text,
      email_change_token_new text, email_change_token_current text,
      phone_change text, phone_change_token text, reauthentication_token text);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
    create function extensions.crypt(text, text) returns text language sql as $$ select 'hash' $$;
    create role anon; create role authenticated; create role service_role;
    create publication supabase_realtime;
    -- Mínimo de realtime para que 20260917000100 se pueda aplicar: esa
    -- migración crea políticas sobre realtime.messages y se niega a seguir si
    -- la tabla no existe o no tiene RLS. Aquí no se prueba nada de Realtime
    -- —eso es schema-embedded.test.mjs—, solo se deja aplicar la migración.
    create schema realtime;
    create table realtime.messages (topic text not null, extension text not null);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable
      as $$ select nullif(current_setting('realtime.topic', true), '') $$;`);
  for (const file of readdirSync(join(here, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(read('migrations', file));
  }
  // Las cuentas y perfiles reales de seed.sql; sin sus funciones de desarrollo.
  const seed = read('seed.sql');
  await db.exec(
    seed.slice(0, seed.search(/create or replace function public\.seed_incoming_likes/))
  );

  const anon = (id, at) =>
    `insert into auth.users (id, is_anonymous, created_at) values ('${id}', true, '${at}');`;
  const profile = (id, name) =>
    `insert into public.profiles (id, name, age, location, timezone, avatar_initials, avatar_accent,
       specialties, seeking_specialties, looking_for, starting_point,
       availability_hours_per_week, availability_bands, ambition,
       link_github, link_portfolio, link_linkedin, prompts)
     select '${id}', '${name}', age, location, timezone, avatar_initials, avatar_accent,
       specialties, seeking_specialties, looking_for, starting_point,
       availability_hours_per_week, availability_bands, ambition,
       link_github, link_portfolio, link_linkedin, prompts
     from public.profiles where id = '${NURIA}';`;

  const sql = [];
  // Recorrido a mano: anónimo con perfil propio, like cruzado con Núria (el de
  // seed_incoming_likes), match y un mensaje suyo; y un pass a Marc.
  sql.push(anon(REAL, '2026-09-06 18:00:00+00'), profile(REAL, 'Joel'));
  sql.push(`insert into public.decisions (actor_id, target_id, decision) values
    ('${NURIA}', '${REAL}', 'like'), ('${REAL}', '${NURIA}', 'like'), ('${REAL}', '${MARC}', 'pass');`);
  sql.push(
    `insert into public.matches (profile_a, profile_b, mode) values ('${NURIA}', '${REAL}', 'par');`
  );
  sql.push(`insert into public.messages (match_id, sender_id, body)
    select id, '${REAL}', 'Hola' from public.matches where profile_b = '${REAL}';`);
  // Anónimo suelto sin perfil: no se distingue de un onboarding abandonado.
  sql.push(anon(LONE, '2026-09-08 09:00:00+00'));
  // Dos pasadas de la suite, cuatro altas seguidas cada una.
  BURST_A.forEach((id, i) => sql.push(anon(id, `2026-09-07 10:00:0${i}+00`)));
  BURST_B.forEach((id, i) => {
    sql.push(anon(id, `2026-09-07 15:00:0${i}+00`), profile(id, B_NAMES[i]));
  });
  sql.push(`insert into public.decisions (actor_id, target_id, decision)
    select r, '${BURST_B[0]}', 'like' from unnest(array['${BURST_B.slice(1).join("','")}']::uuid[]) r;`);
  sql.push(`insert into auth.users (id, email, created_at)
    values ('${DEVICE}', 'device-0123456789ab@lockin.app', '2026-09-06 12:00:00+00');`);
  await db.exec(sql.join('\n'));
  return db;
}

function fillDeletion({ ids, decisiones, matches, mensajes }) {
  const text = read('cleanup', 'borrado.sql');
  const marker = '  -- PRUEBAS: pega aquí los id';
  assert(text.includes(marker));
  return text
    .replace(marker, ids.map((id) => `  '${id}'`).join(',\n'))
    .replace(/-1;(\s+-- ACUSE_DECISIONES)/, `${decisiones};$1`)
    .replace(/-1;(\s+-- ACUSE_MATCHES)/, `${matches};$1`)
    .replace(/-1;(\s+-- ACUSE_MENSAJES)/, `${mensajes};$1`);
}

test('Limpieza: inventario clasifica y borrado respeta sus guardias', async () => {
  const { PGlite } = await import(pgliteModule);
  const db = await freshDatabase(PGlite);
  try {
    const before = JSON.stringify(
      (await db.query('select count(*)::int as n from public.decisions')).rows
    );
    const rows = (await db.exec(read('cleanup', 'inventario.sql'))).at(-1).rows;
    assert.equal(
      JSON.stringify((await db.query('select count(*)::int as n from public.decisions')).rows),
      before,
      'el inventario no debe escribir'
    );
    const byId = Object.fromEntries(rows.filter((r) => r.id).map((r) => [r.id, r]));
    const categoryOf = (id) => byId[id].categoria;

    for (let i = 1; i <= 8; i++) {
      assert.equal(categoryOf(`11111111-1111-4111-8111-00000000000${i}`), 'seed');
    }
    BURST_A.forEach((id) => assert.equal(categoryOf(id), 'prueba: contrato sin perfil (ráfaga)'));
    BURST_B.forEach((id) => assert.equal(categoryOf(id), 'prueba: contrato con perfil'));
    assert.equal(categoryOf(DEVICE), 'prueba: cuenta de dispositivo sin perfil');
    assert.equal(categoryOf(REAL), 'revisar: posible usuario real');
    assert.equal(categoryOf(LONE), 'revisar: posible usuario real');

    assert.deepEqual(
      [
        byId[REAL].colateral_decisiones,
        byId[REAL].colateral_matches,
        byId[REAL].colateral_mensajes,
      ].map(Number),
      [3, 1, 1]
    );
    assert.equal(byId[NURIA].colateral_decisiones, null);
    const total = rows.at(-1);
    assert.match(total.categoria, /^TOTAL colateral/);
    assert.deepEqual(
      [total.colateral_decisiones, total.colateral_matches, total.colateral_mensajes].map(Number),
      [3, 1, 1]
    );
    console.log(
      `Inventario: ${rows.length - 1} cuentas → ` +
        Object.entries(
          rows
            .slice(0, -1)
            .reduce((acc, r) => ({ ...acc, [r.categoria]: (acc[r.categoria] ?? 0) + 1 }), {})
        )
          .map(([k, v]) => `${v} «${k}»`)
          .join(', ') +
        `; TOTAL colateral 3/1/1`
    );

    const tests = [...BURST_A, ...BURST_B, DEVICE];
    const accountCount = async () =>
      Number((await db.query('select count(*) as n from auth.users')).rows[0].n);
    const accounts = await accountCount();

    // Sin tocar el acuse (-1) no pasa.
    await assert.rejects(
      db.exec(fillDeletion({ ids: tests, decisiones: -1, matches: -1, mensajes: -1 })),
      /Colateral sobre cuentas que se quedan: 3 decisiones, 1 matches, 1 mensajes/
    );
    await db.exec('rollback;');
    // Un perfil con nombre propio no se borra desde aquí.
    await assert.rejects(
      db.exec(fillDeletion({ ids: [...tests, REAL], decisiones: 0, matches: 0, mensajes: 0 })),
      /No son reconocibles como prueba, revisar a mano: aaaaaaaa-0000-4000-8000-000000000001 \(Joel\)/
    );
    await db.exec('rollback;');
    // Un id que ya no existe aborta.
    await assert.rejects(
      db.exec(
        fillDeletion({
          ids: ['eeeeeeee-0000-4000-8000-000000000000'],
          decisiones: 3,
          matches: 1,
          mensajes: 1,
        })
      ),
      /No existen en auth.users/
    );
    await db.exec('rollback;');
    assert.equal(await accountCount(), accounts, 'los rechazos no borran nada');

    const result = (
      await db.exec(fillDeletion({ ids: tests, decisiones: 3, matches: 1, mensajes: 1 }))
    ).at(-1).rows[0];
    assert.deepEqual(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Number(v)])), {
      cuentas_restantes: 2,
      seed_restantes: 0,
      perfiles_restantes: 1,
      decisiones_restantes: 0,
      matches_restantes: 0,
      mensajes_restantes: 0,
    });
    const left = (await db.query('select id from auth.users order by id')).rows.map((r) => r.id);
    assert.deepEqual(left, [REAL, LONE]);
    console.log(
      `Borrado: ${accounts} → ${JSON.stringify(result)}; quedan Joel y el anónimo suelto`
    );

    await assert.rejects(
      db.exec(fillDeletion({ ids: tests, decisiones: 0, matches: 0, mensajes: 0 })),
      /No existen en auth.users/
    );
    await db.exec('rollback;');
    console.log(
      'Guardias: acuse sin rellenar, perfil no reconocible, id inexistente y repetición: OK'
    );
  } finally {
    await db.close();
  }
});
