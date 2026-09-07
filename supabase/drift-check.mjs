#!/usr/bin/env node
/**
 * LockIn — detector de deriva entre `supabase/migrations/` y el esquema desplegado.
 *
 * ## Por qué existe
 *
 * Hay dos bases distintas y ningún mecanismo que garantice que coinciden:
 *
 * - La **local**, que `e2e/run.mjs` levanta copiando `supabase/migrations/` y
 *   `supabase/seed.sql`. Limpia y reproducible: sale de los archivos del repo.
 * - La **remota** (el proyecto al que apunta `.env.local`), cuyo esquema se
 *   aplicó pegando SQL a mano en el editor del dashboard, porque el CLI exige
 *   `SUPABASE_ACCESS_TOKEN` o la contraseña de Postgres y ninguna de las dos
 *   está —ni debe estar— en el repo.
 *
 * `src/data/supabase/contract.test.ts` habla con la remota. Así que el 25/25 de
 * esa suite y el verde del E2E local pueden convivir con las dos bases
 * divergidas, y nadie se enteraría. Este script es el que se entera.
 *
 * ## Qué comprueba y con qué credenciales
 *
 * Solo con la clave `anon` de `.env.local` y una sesión anónima. **No usa
 * `service_role`** — esa clave no está en el repo y no debe estarlo. Eso limita
 * lo que se puede ver: el endpoint OpenAPI de PostgREST (`GET /rest/v1/`), que
 * daría el catálogo entero de un tirón, lo bloquea la pasarela de Supabase con
 * `"Only the service_role API key can be used for this endpoint"`.
 *
 * Así que el esquema se deduce a base de sondas, leyendo los códigos de error
 * que devuelve PostgREST:
 *
 * | Sonda                                           | Qué revela                       |
 * |-------------------------------------------------|----------------------------------|
 * | `GET /tabla?limit=0`                            | `PGRST205` → la tabla no existe  |
 * | `GET /tabla?columna=eq.<basura>`                | `42703` → la columna no existe   |
 * | idem, leyendo el mensaje del `22P02`/`22007`    | el tipo real de la columna       |
 * | `GET /tabla?col_enum=eq.<valor>`                | si el enum admite ese valor      |
 * | `POST /rpc/fn` con los nombres de sus argumentos | `PGRST202` → no existe esa firma |
 * | `GET /tabla` sin sesión                         | `42501` → `anon` sigue revocado  |
 *
 * Ninguna sonda tiene efectos: las RPC se llaman con todos los argumentos a
 * `null` y el usuario de la sonda es anónimo y sin perfil, así que
 * `record_decision()` muere en su propia comprobación de perfil antes de
 * insertar nada, y `dev_reset_current_user()` no tiene nada que borrar.
 *
 * ## Qué NO puede ver
 *
 * Todo lo que no asoma por PostgREST: cuerpos de las políticas RLS, CHECKs,
 * índices, triggers, `default`s, y las columnas, tablas o valores de enum que
 * existan en el despliegue **de más** respecto a las migraciones. Para eso está
 * `supabase/schema-fingerprint.sql`, que es exacto pero necesita el editor SQL
 * del dashboard. Los dos son complementarios: este corre en un comando y
 * detecta lo que falta; el otro necesita dos pegadas manuales y lo detecta todo.
 *
 * ## Uso
 *
 *     node supabase/drift-check.mjs
 *
 * Lee `.env.local` (o las variables `EXPO_PUBLIC_SUPABASE_*` del entorno, que
 * tienen prioridad). Sale con 0 si no hay deriva y con 1 si la hay.
 *
 * Cada ejecución gasta un alta anónima del límite por IP (30/hora), así que el
 * token se cachea en el directorio temporal del sistema y se reutiliza mientras
 * siga vivo. `--fresh` fuerza un alta nueva.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const fresh = process.argv.includes('--fresh');

/** Valor que no es válido para ningún tipo salvo `text`. */
const GARBAGE = 'zz-lockin-drift-probe';

// ---------------------------------------------------------------------------
// Lo esperado: se deduce de `supabase/migrations/`, nunca se escribe a mano
// ---------------------------------------------------------------------------
//
// Un archivo de referencia mantenido a mano sería otra copia más que puede
// divergir — justo el problema que este script existe para detectar. Así que la
// referencia se saca de las migraciones en cada ejecución, con un parser
// deliberadamente estricto: solo entiende las formas que usan nuestras
// migraciones —`create table`, `alter table … add column`, `create type … as
// enum` y `create function`— y grita si encuentra algo que no sabe leer, en vez
// de callarse y dar un falso verde.

function migrationSql() {
  const dir = join(root, 'supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) throw new Error('No hay migraciones en supabase/migrations/');
  return files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

/**
 * Quita los comentarios del SQL para que no confundan al parser.
 *
 * Los dos estilos: `-- hasta el fin de línea` y los bloques. Nuestras
 * migraciones documentan columnas con bloques `/** … *​/` colocados *entre* las
 * comas de un `create table`, así que dejarlos dentro convierte el comentario
 * en el nombre de la columna siguiente.
 */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
}

/** Devuelve el contenido del paréntesis que empieza en `open`, equilibrado. */
function balanced(sql, open) {
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(open + 1, i);
    }
  }
  throw new Error('Paréntesis sin cerrar al parsear las migraciones');
}

/** Parte por las comas que estén a profundidad 0 de paréntesis. */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Primeras palabras que delatan que una entrada es una constraint, no una columna. */
const CONSTRAINT_KEYWORDS = new Set([
  'primary',
  'constraint',
  'unique',
  'check',
  'foreign',
  'exclude',
]);

/** Palabras que cierran el tipo de una columna y empiezan sus modificadores. */
const AFTER_TYPE = new Set([
  'not',
  'null',
  'default',
  'check',
  'references',
  'primary',
  'unique',
  'generated',
  'collate',
]);

function parseMigrations(sql) {
  const enums = new Map();
  for (const m of sql.matchAll(/create type public\.(\w+) as enum\s*\(/gi)) {
    const body = balanced(sql, m.index + m[0].length - 1);
    const values = [...body.matchAll(/'([^']*)'/g)].map((v) => v[1]);
    if (values.length === 0) throw new Error(`Enum ${m[1]} sin valores: parser desfasado`);
    enums.set(m[1], values);
  }

  const tables = new Map();
  for (const m of sql.matchAll(/create table public\.(\w+)\s*\(/gi)) {
    const body = balanced(sql, m.index + m[0].length - 1);
    const columns = [];
    for (const entry of splitTopLevel(body)) {
      const tokens = entry.split(/\s+/);
      if (CONSTRAINT_KEYWORDS.has(tokens[0].toLowerCase())) continue;
      const name = tokens[0];
      const type = [];
      for (const token of tokens.slice(1)) {
        if (AFTER_TYPE.has(token.toLowerCase())) break;
        type.push(token);
      }
      if (type.length === 0) throw new Error(`Columna ${m[1]}.${name} sin tipo: parser desfasado`);
      // Del `not null` y del `default` no se guarda nada: desde el cliente no
      // hay forma de sondearlos —probarlos exigiría un INSERT con efectos, y
      // RLS lo impide igualmente—. Esa parte la cubre
      // `supabase/schema-fingerprint.sql`.
      columns.push({ name, type: type.join(' ').replace(/^public\./, '') });
    }
    if (columns.length === 0) throw new Error(`Tabla ${m[1]} sin columnas: parser desfasado`);
    tables.set(m[1], columns);
  }

  // `alter table … add column`. Una columna añadida por una migración posterior
  // no aparece en ningún `create table`, así que sin esto el detector se queda
  // ciego justo a lo más nuevo —que es lo más probable que falte en el
  // despliegue—. La primera fue `profiles.seeking_specialties`
  // (`20260907000100`): las migraciones ya aplicadas no se editan, se añaden.
  //
  // El resto de `alter table` (RLS, `replica identity`) no trae `add column` y
  // pasa de largo. La forma que no sepa leer la deja sin tipo y revienta, que es
  // la misma regla que arriba: antes un error que un verde falso.
  for (const m of sql.matchAll(/alter table (?:only\s+)?public\.(\w+)([\s\S]*?);/gi)) {
    const columns = tables.get(m[1]);
    const clauses = [
      ...m[2].matchAll(
        /add column\s+(?:if not exists\s+)?(\w+)\s+([\s\S]*?)(?=\s*,\s*(?:add|alter|drop)\s|\s*$)/gi
      ),
    ];
    if (clauses.length === 0) continue;
    if (!columns) {
      throw new Error(
        `add column sobre public.${m[1]}, que no tiene create table: parser desfasado`
      );
    }
    for (const clause of clauses) {
      const name = clause[1];
      const type = [];
      for (const token of clause[2].split(/\s+/).filter(Boolean)) {
        if (AFTER_TYPE.has(token.toLowerCase())) break;
        type.push(token);
      }
      if (type.length === 0) throw new Error(`Columna ${m[1]}.${name} sin tipo: parser desfasado`);
      columns.push({ name, type: type.join(' ').replace(/^public\./, '') });
    }
  }

  const functions = [];
  for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(/gi)) {
    const open = m.index + m[0].length - 1;
    const body = balanced(sql, open);
    const rest = sql.slice(open + body.length + 2);
    const returns = /^\s*returns\s+(setof\s+)?([\w.]+)/i.exec(rest);
    if (!returns) throw new Error(`Función ${m[1]} sin RETURNS legible: parser desfasado`);
    const args = splitTopLevel(body).map((arg) => {
      const tokens = arg.split(/\s+/);
      if (tokens.length < 2) throw new Error(`Argumento ilegible en ${m[1]}: "${arg}"`);
      return tokens[0];
    });
    functions.push({ name: m[1], args, returns: returns[2].toLowerCase() });
  }

  return { enums, tables, functions };
}

// ---------------------------------------------------------------------------
// Credenciales y sesión
// ---------------------------------------------------------------------------

function readEnv() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    };
  }

  const file = join(root, '.env.local');
  if (!existsSync(file)) {
    throw new Error(
      'No hay credenciales: define EXPO_PUBLIC_SUPABASE_URL y ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY, o copia .env.example a .env.local.'
    );
  }
  const parsed = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
  );
  const url = parsed.EXPO_PUBLIC_SUPABASE_URL;
  const key = parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('.env.local no tiene las dos variables EXPO_PUBLIC_SUPABASE_*');
  return { url, key };
}

/**
 * Token de una sesión anónima, cacheado fuera del repo.
 *
 * Se cachea porque cada alta anónima consume del límite por IP (30/hora) que ya
 * costó una tarde a la suite de contrato. El archivo lleva un `access_token`:
 * vive en el directorio temporal del sistema, nunca en el árbol del proyecto.
 */
async function openSession(url, key) {
  const cacheDir = join(tmpdir(), 'lockin-drift');
  const cacheFile = join(cacheDir, 'session.json');
  if (!fresh && existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.url === url && cached.expiresAt * 1000 > Date.now() + 60_000) {
      return cached.accessToken;
    }
  }

  const response = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error(
      `No se pudo abrir sesión anónima (${response.status}): ${JSON.stringify(payload)}. ` +
        'Sin sesión, `anon` no ve nada y este script no puede sondear el esquema.'
    );
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    cacheFile,
    JSON.stringify({ url, accessToken: payload.access_token, expiresAt: payload.expires_at })
  );
  return payload.access_token;
}

// ---------------------------------------------------------------------------
// Sondas
// ---------------------------------------------------------------------------

function makeProbes(url, key, token) {
  const authed = { apikey: key, Authorization: `Bearer ${token}` };

  async function parse(response) {
    const text = await response.text();
    // El cuerpo puede ser un objeto de error, una lista de filas, o el `null`
    // literal que devuelve una función que retorna NULL. Solo el primero lleva
    // `code`/`message`; de los otros dos solo interesa que la llamada llegó.
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
    const isError = body !== null && !Array.isArray(body) && typeof body === 'object';
    return {
      status: response.status,
      code: isError ? body.code : undefined,
      message: isError ? (body.message ?? '') : '',
    };
  }

  async function rest(path, headers = authed) {
    return parse(await fetch(`${url}/rest/v1/${path}`, { headers }));
  }

  async function rpc(name, args) {
    return parse(
      await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { ...authed, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
    );
  }

  return { rest, rpc, anonHeaders: { apikey: key } };
}

/**
 * Traduce el tipo declarado en la migración a la huella que deja PostgREST
 * cuando se le manda basura en un filtro sobre esa columna.
 *
 * `text` es el único que acepta cualquier cosa y responde 200; el resto falla
 * con un mensaje que nombra el tipo, y los enums además nombran el enum.
 */
function expectedTypeSignature(type, enums) {
  const isArray = type.endsWith('[]');
  const base = isArray ? type.slice(0, -2) : type;
  if (enums.has(base)) return { kind: isArray ? 'enum-array' : 'enum', enumName: base };
  if (isArray) return { kind: 'array' };
  switch (base) {
    case 'text':
      return { kind: 'text' };
    case 'uuid':
      return { kind: 'cast', pg: 'uuid' };
    case 'integer':
      return { kind: 'cast', pg: 'integer' };
    case 'timestamptz':
      return { kind: 'cast', pg: 'timestamp with time zone' };
    case 'jsonb':
      return { kind: 'cast', pg: 'json' };
    default:
      return { kind: 'unknown', base };
  }
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

const findings = [];
function drift(message) {
  findings.push(message);
  console.log(`  x ${message}`);
}
function ok(message) {
  console.log(`  . ${message}`);
}
function note(message) {
  console.log(`  - ${message}`);
}

const { url: rawUrl, key } = readEnv();
const url = rawUrl
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const expected = parseMigrations(stripComments(migrationSql()));

console.log(`Proyecto:   ${url}`);
console.log(
  `Referencia: supabase/migrations/ — ${expected.tables.size} tablas, ` +
    `${expected.enums.size} enums, ${expected.functions.length} funciones`
);

const token = await openSession(url, key);
const { rest, rpc, anonHeaders } = makeProbes(url, key, token);

// --- Tablas y columnas -----------------------------------------------------
console.log('\nTablas y columnas');
for (const [table, columns] of expected.tables) {
  const head = await rest(`${table}?limit=0`);
  if (head.code === 'PGRST205' || head.code === '42P01') {
    drift(`falta la tabla public.${table}`);
    continue;
  }
  if (head.status !== 200) {
    drift(`public.${table} no es legible por un usuario autenticado: ${head.code} ${head.message}`);
    continue;
  }

  const problems = [];
  for (const column of columns) {
    const signature = expectedTypeSignature(column.type, expected.enums);
    if (signature.kind === 'unknown') {
      note(
        `no sé sondear el tipo "${column.type}" de ${table}.${column.name}; solo compruebo que la columna existe`
      );
    }
    const filter = signature.kind === 'enum-array' ? `cs.{${GARBAGE}}` : `eq.${GARBAGE}`;
    const probe = await rest(`${table}?${column.name}=${filter}&limit=0`);

    if (probe.code === '42703') {
      problems.push(`falta la columna ${table}.${column.name}`);
      continue;
    }
    if (probe.code === '42501') {
      problems.push(`${table}.${column.name} existe pero el usuario autenticado no puede leerla`);
      continue;
    }

    // El mensaje del error revela el tipo desplegado.
    const said = probe.message || `HTTP ${probe.status}`;
    if (signature.kind === 'text') {
      if (probe.status !== 200) problems.push(`${table}.${column.name} debería ser text: ${said}`);
    } else if (signature.kind === 'cast') {
      if (!probe.message.includes(`type ${signature.pg}`)) {
        problems.push(`${table}.${column.name} debería ser ${column.type}: ${said}`);
      }
    } else if (signature.kind === 'enum' || signature.kind === 'enum-array') {
      const suffix = signature.kind === 'enum-array' ? '[]' : '';
      if (!probe.message.includes(`enum ${signature.enumName}`)) {
        problems.push(
          `${table}.${column.name} debería ser el enum ${signature.enumName}${suffix}: ${said}`
        );
      }
    } else if (signature.kind === 'array') {
      if (!/malformed array literal/.test(probe.message)) {
        problems.push(`${table}.${column.name} debería ser un array: ${said}`);
      }
    }
  }

  if (problems.length === 0)
    ok(`public.${table} — ${columns.length} columnas con el tipo esperado`);
  else problems.forEach(drift);
}

// --- Valores de los enums --------------------------------------------------
//
// Un enum solo se puede sondear a través de una columna que lo use. El que no
// tenga columna se declara no comprobable en vez de darse por bueno en silencio.
console.log('\nValores de los enums');
const enumColumn = new Map();
for (const [table, columns] of expected.tables) {
  for (const column of columns) {
    const isArray = column.type.endsWith('[]');
    const base = isArray ? column.type.slice(0, -2) : column.type;
    if (expected.enums.has(base) && !enumColumn.has(base)) {
      enumColumn.set(base, { table, column: column.name, isArray });
    }
  }
}
for (const [name, values] of expected.enums) {
  const site = enumColumn.get(name);
  if (!site) {
    note(`el enum ${name} no lo usa ninguna columna: no hay por dónde sondearlo`);
    continue;
  }
  const missing = [];
  for (const value of values) {
    const filter = site.isArray ? `cs.{${value}}` : `eq.${value}`;
    const probe = await rest(`${site.table}?${site.column}=${filter}&limit=0`);
    if (probe.status !== 200) missing.push(`${value} (${probe.code} ${probe.message})`);
  }
  if (missing.length === 0) ok(`${name} — ${values.length} valores presentes`);
  else drift(`al enum ${name} le faltan valores en el despliegue: ${missing.join(', ')}`);
}

// --- Funciones -------------------------------------------------------------
//
// PostgREST no expone las funciones que devuelven `trigger`, así que sondearlas
// daría un PGRST202 que no significa nada. Se saltan explícitamente.
console.log('\nFunciones expuestas por PostgREST');
for (const fn of expected.functions) {
  if (fn.returns === 'trigger') {
    note(`${fn.name}() devuelve trigger: PostgREST no la expone, no se puede sondear desde aquí`);
    continue;
  }
  const args = Object.fromEntries(fn.args.map((arg) => [arg, null]));
  const probe = await rpc(fn.name, args);
  if (probe.code === 'PGRST202') {
    drift(
      `no existe public.${fn.name}(${fn.args.join(', ')}) en el despliegue, ` +
        'o sus argumentos se llaman de otra forma'
    );
  } else if (probe.code === '42501') {
    drift(`public.${fn.name}() existe pero el rol authenticated no puede ejecutarla`);
  } else {
    ok(`${fn.name}(${fn.args.join(', ')})`);
  }
}

// --- Funciones de desarrollo ----------------------------------------------
//
// No están en `migrations/` a propósito (ver la cabecera de `supabase/seed.sql`
// y la sección "Deriva de esquema" de `supabase/README.md`). Aquí no se juzga
// si "faltan": se informa de dónde están instaladas, que es justo el dato que
// nadie tenía.
console.log('\nFunciones solo-desarrollo de supabase/seed.sql');
const seedSql = stripComments(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
const devFunctions = [
  ...seedSql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(([^)]*)\)/gi),
].map((m) => ({
  name: m[1],
  args: splitTopLevel(m[2]).map((arg) => arg.split(/\s+/)[0]),
}));
let devInstalled = 0;
for (const fn of devFunctions) {
  const args = Object.fromEntries(fn.args.map((arg) => [arg, null]));
  const probe = await rpc(fn.name, args);
  const signature = `${fn.name}(${fn.args.join(', ')})`;
  if (probe.code === 'PGRST202') {
    note(`${signature} NO está instalada`);
  } else {
    devInstalled += 1;
    note(`${signature} SÍ está instalada`);
  }
}
if (devInstalled > 0) {
  note(
    'Son herramientas de desarrollo. Antes de que este proyecto tenga usuarios ' +
      'reales hay que retirarlas: supabase/dev-teardown.sql'
  );
}

// --- RLS: `anon` sigue fuera ----------------------------------------------
console.log('\nRLS — anon sin sesión');
for (const table of expected.tables.keys()) {
  const probe = await rest(`${table}?limit=1`, anonHeaders);
  if (probe.code === '42501') ok(`public.${table} — denegado a anon`);
  else {
    drift(
      `public.${table} responde ${probe.status} ${probe.code ?? ''} a anon sin sesión: ` +
        'los REVOKE de la migración de RLS no están puestos'
    );
  }
}

// --- Veredicto -------------------------------------------------------------
console.log('');
if (findings.length === 0) {
  console.log('Sin deriva detectable desde el cliente.');
  console.log(
    'Alcance: esto no ve políticas, CHECKs, índices, triggers ni objetos de más.\n' +
      'Para el cotejo exacto, supabase/schema-fingerprint.sql.'
  );
  process.exit(0);
}
console.log(`DERIVA: ${findings.length} diferencia(s) entre supabase/migrations/ y el despliegue.`);
for (const finding of findings) console.log(`  - ${finding}`);
console.log('\nNo la parchees a ciegas: decide primero quién tiene razón, si el repo o la base.');
process.exit(1);
