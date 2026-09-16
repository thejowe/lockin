// El parser de `drift-check.mjs`, sin red ni credenciales: el script solo
// sondea cuando se ejecuta como tal, así que importarlo es seguro.
//
// Lo que se fija aquí es lo que el parser TIENE que ver, porque lo que no ve no
// lo sondea, y lo que no sondea sale verde. El caso del sello de GitHub
// (`20260916000100`) es el caro: si el parser se queda ciego al permiso de
// columna, el informe daría «sin deriva» con el sello falsificable en
// producción y nadie mirando — `schema-fingerprint.sql` tampoco lo ve, porque
// lee `relacl`/`proacl` pero no `attacl`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrationSql, stripComments, parseMigrations } from './drift-check.mjs';

const real = parseMigrations(stripComments(migrationSql()));

test('ve el sello de GitHub cerrado a authenticated, en INSERT y en UPDATE', () => {
  const sealed = real.sealed
    .filter((s) => s.table === 'profiles' && s.role === 'authenticated')
    .map((s) => `${s.privilege} ${s.column}`)
    .sort();
  assert.deepEqual(sealed, [
    'insert github_handle',
    'insert github_verified_at',
    'update github_handle',
    'update github_verified_at',
  ]);
});

test('link_github NO está cerrado: sin sello es un campo del formulario', () => {
  const cerradas = real.sealed.filter((s) => s.column === 'link_github');
  assert.deepEqual(cerradas, []);
});

test('ve las constraints de `alter table … add constraint`', () => {
  const names = real.constraints.map((c) => `${c.table}.${c.name} ${c.kind}`).sort();
  assert.deepEqual(names, [
    'profiles.profiles_github_link_matches_handle check',
    'profiles.profiles_github_verification_complete check',
  ]);
});

test('un `revoke <priv> (col)` sin revocar antes el privilegio de TABLA revienta', () => {
  // Es la trampa que motiva todo esto: PostgreSQL ignora ese revoke
  // («if a role has been granted privileges on a table, then revoking the same
  // privileges from individual columns will have no effect»), así que parece la
  // protección y no protege nada. El parser no puede tragárselo.
  const sql = `
    create table public.cosas (id uuid, sello timestamptz);
    revoke update (sello) on public.cosas from authenticated;
  `;
  assert.throws(() => parseMigrations(sql), /no cierra nada|de TABLA/i);
});

test('el mismo revoke SÍ cuenta cuando antes se revocó el privilegio ancho', () => {
  const sql = `
    create table public.cosas (id uuid, sello timestamptz);
    revoke update on public.cosas from authenticated;
    revoke update (sello) on public.cosas from authenticated;
  `;
  const parsed = parseMigrations(sql);
  assert.deepEqual(parsed.sealed, [
    { table: 'cosas', column: 'sello', privilege: 'update', role: 'authenticated' },
  ]);
});

test('revoke ancho + grant por columna: cerrado es lo que no vuelve', () => {
  const sql = `
    create table public.cosas (id uuid, nombre text, sello timestamptz);
    revoke insert, update on public.cosas from authenticated;
    grant update (id, nombre) on public.cosas to authenticated;
  `;
  const parsed = parseMigrations(sql);
  assert.deepEqual(parsed.sealed, [
    { table: 'cosas', column: 'sello', privilege: 'update', role: 'authenticated' },
  ]);
});

test('un grant sobre una columna que no existe revienta', () => {
  const sql = `
    create table public.cosas (id uuid, nombre text);
    revoke update on public.cosas from authenticated;
    grant update (id, nombra) on public.cosas to authenticated;
  `;
  assert.throws(() => parseMigrations(sql), /columnas inexistentes/i);
});

test('un `alter table` con forma desconocida revienta en vez de pasar de largo', () => {
  const sql = `
    create table public.cosas (id uuid, nombre text);
    alter table public.cosas drop column nombre;
  `;
  assert.throws(() => parseMigrations(sql), /forma desconocida/i);
});

test('las formas de `alter table` que ya usábamos siguen pasando', () => {
  const sql = `
    create table public.cosas (id uuid, nombre text);
    alter table public.cosas enable row level security;
    alter table public.cosas replica identity full;
    alter table public.cosas add column extra text;
  `;
  const parsed = parseMigrations(sql);
  assert.deepEqual(
    parsed.tables.get('cosas').map((c) => c.name),
    ['id', 'nombre', 'extra']
  );
});
