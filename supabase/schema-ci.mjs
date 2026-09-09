// Backend propio: no importa e2e/, no enlaza proyectos ni migra el remoto.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareFingerprints, parseFingerprint } from './schema-compare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = process.env.SCHEMA_ARTIFACTS;
assert(artifacts, 'Define SCHEMA_ARTIFACTS fuera del checkout');
mkdirSync(artifacts, { recursive: true });
const sql = readFileSync(join(root, 'supabase/schema-fingerprint.sql'), 'utf8');
const expectedPath = join(artifacts, 'expected.txt');

function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 600_000, ...options });
  assert(
    !result.error && result.status === 0,
    `${binary} falló (exit=${result.status}); no hay verificación`
  );
  return result.stdout ?? '';
}

function query(url, input) {
  // URL solo en entorno: nunca en argv/logs. No heredar opciones SQL del runner.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('PG'))
  );
  return run('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...env, PGDATABASE: url, PGCONNECT_TIMEOUT: '20', PGCLIENTENCODING: 'UTF8' },
    input,
    // No publicar stderr: errores de conexión pueden contener partes del secreto.
    maxBuffer: 8 * 1024 * 1024,
  });
}

function capture(url, file, mutation = '') {
  // Mutaciones solo en las pruebas locales; siempre rollback. Remoto READ ONLY.
  const output = query(
    url,
    `begin${mutation ? '' : ' read only'};\nset local search_path = pg_catalog;\nset local statement_timeout = '30s';\n${mutation}\n${sql}\nrollback;\n`
  );
  parseFingerprint(output);
  writeFileSync(join(artifacts, file), output);
  return output;
}

function compare(expected, actual, file, negative = false) {
  const diff = compareFingerprints(expected, actual);
  writeFileSync(join(artifacts, file), diff || 'Sin diferencias.\n');
  if (diff) console.log(diff);
  assert(
    negative ? diff.length > 0 : diff.length === 0,
    negative ? 'CONTROL NEGATIVO FALLÓ: la huella no detectó la mutación' : `DERIVA: ver ${file}`
  );
}

const command = process.argv[2];
if (command === 'local') {
  const runtime = process.env.SCHEMA_RUNTIME;
  assert(
    runtime && !existsSync(runtime),
    'SCHEMA_RUNTIME debe ser un directorio nuevo y desechable'
  );
  mkdirSync(runtime, { recursive: true });
  const cli = (args, quiet = false) =>
    run('supabase', ['--workdir', runtime, ...args], {
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
  cli(['init']);
  const configPath = join(runtime, 'supabase/config.toml');
  const config = readFileSync(configPath, 'utf8');
  assert(/^project_id = /m.test(config), 'Formato de config Supabase desconocido');
  writeFileSync(configPath, config.replace(/^project_id = .*$/m, 'project_id = "lockin-schema"'));
  cpSync(join(root, 'supabase/migrations'), join(runtime, 'supabase/migrations'), {
    recursive: true,
  });
  cpSync(join(root, 'supabase/seed.sql'), join(runtime, 'supabase/seed.sql'));
  cli(['start', '-x', 'studio,imgproxy,edge-runtime,logflare,vector,supavisor'], true);
  cli(['db', 'reset', '--local', '--no-seed']);
  const { DB_URL: url } = JSON.parse(cli(['status', '-o', 'json'], true));
  assert(
    url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname),
    'Solo base local desechable'
  );
  const expected = capture(url, 'expected.txt');
  writeFileSync(join(artifacts, 'postgres-version.txt'), query(url, 'show server_version;'));

  // Mismo catálogo, rol sin acceso a datos: prueba de permisos mínimos del remoto.
  query(
    url,
    'create role lockin_schema_reader nologin; grant usage on schema public to lockin_schema_reader;'
  );
  const reader = capture(url, 'reader.txt', 'set local role lockin_schema_reader;');
  compare(expected, reader, 'reader.diff');

  // Referencia ejecutable = migrations sin seed. Segunda reconstrucción completa:
  // seed + teardown deben dejar exactamente ese esquema de producción.
  cli(['db', 'reset', '--local']);
  const development = capture(url, 'development.txt');
  assert.match(development, /func\s+public\.dev_reset_current_user\(\)/);
  assert.match(development, /func\s+public\.seed_incoming_likes\(text\)/);
  query(url, readFileSync(join(root, 'supabase/dev-teardown.sql'), 'utf8'));
  const actual = capture(url, 'local.txt');
  compare(expected, actual, 'local.diff');
  query(url, readFileSync(join(root, 'supabase/dev-teardown.sql'), 'utf8'));
  compare(expected, capture(url, 'teardown-twice.txt'), 'teardown-twice.diff');

  const mutations = {
    column: 'alter table public.profiles add column schema_drift_probe text;',
    index: 'create index schema_drift_probe on public.profiles (name);',
    policy:
      'alter policy "profiles: cualquier autenticado puede leer" on public.profiles using (false);',
    function:
      "create or replace function public.is_valid_prompts(prompts jsonb) returns boolean language sql immutable set search_path = '' as $$ select true; $$;",
  };
  for (const [name, mutation] of Object.entries(mutations)) {
    compare(
      expected,
      capture(url, `negative-${name}.txt`, mutation),
      `negative-${name}.diff`,
      true
    );
  }
  compare(expected, capture(url, 'after-controls.txt'), 'after-controls.diff');
  summary(
    'Local: migraciones = reset con seed + teardown. Rol lector, idempotencia y cuatro controles negativos PASADOS. Esto no verifica el proyecto remoto.'
  );
} else if (command === 'remote') {
  const url = process.env.SUPABASE_SCHEMA_DB_URL;
  assert(url, 'Remoto OMITIDO: falta SUPABASE_SCHEMA_DB_URL; no hay comparación');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    // TypeError de URL incluye el input; nunca dejar que imprima el secreto.
    throw new Error('SUPABASE_SCHEMA_DB_URL no es una URI válida');
  }
  const ref = 'grrzmzktrhksbttpbblg';
  assert(['postgres:', 'postgresql:'].includes(parsed.protocol), 'Se requiere una URI PostgreSQL');
  assert(
    parsed.hostname === `db.${ref}.supabase.co` ||
      (parsed.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(parsed.username).endsWith(`.${ref}`)),
    'El secreto debe apuntar al proyecto grrzmzktrhksbttpbblg'
  );
  assert(
    ['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode')),
    'La URI requiere sslmode=require o verificación TLS más estricta'
  );
  const expected = readFileSync(expectedPath, 'utf8');
  const actual = capture(url, 'remote.txt');
  compare(expected, actual, 'remote.diff');
  summary(
    'Remoto grrzmzktrhksbttpbblg: huella SQL coincide con las migraciones de este commit. Funciones de desarrollo no permitidas.'
  );
} else {
  throw new Error('Uso: node supabase/schema-ci.mjs local|remote');
}
