// Comprobación SQL parcial sin Docker. NO sustituye al workflow Supabase.
// PGLITE_MODULE = ruta absoluta al dist/index.js de @electric-sql/pglite 0.3.14
// instalado fuera del repo; sin cambios en package.json/package-lock.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { compareFingerprints } from './schema-compare.mjs';

test(
  'PostgreSQL embebido: migraciones, huella, rol lector, mutaciones y retirada',
  {
    skip: !process.env.PGLITE_MODULE && 'Requiere PGLITE_MODULE; no verifica Supabase real',
  },
  async () => {
    const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
    const db = new PGlite();
    const here = dirname(fileURLToPath(import.meta.url));
    try {
      // Solo fixture de Auth: no GoTrue, REST, seeds de cuentas ni permisos Supabase.
      await db.exec(`create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create role anon; create role authenticated; create role service_role;
      create publication supabase_realtime;`);
      for (const file of readdirSync(join(here, 'migrations'))
        .filter((f) => f.endsWith('.sql'))
        .sort()) {
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
        `SQL ejecutado: 7 migraciones; ${expected.split('\n')[0]}; ${expected.trimEnd().split('\n').length - 1} objetos`
      );
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
  }
);
