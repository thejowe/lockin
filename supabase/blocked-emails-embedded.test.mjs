// Correos bloqueados al eliminar la cuenta (migración 20261109120000) contra
// PostgreSQL embebido (PGlite), sin Docker. Se corre con `npm run test:schema`.
//
// Cubre: `delete_my_account()` apunta el correo (normalizado) y los de las
// identidades; el trigger de `auth.users` / `auth.identities` rechaza volver a
// usarlo; la solicitud de desbloqueo exige motivo y no se duplica; aprobarla
// libera el correo.
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
const USER = '00000000-0000-4000-8000-0000000000e1';
const AGAIN = '00000000-0000-4000-8000-0000000000e2';
const OTHER = '00000000-0000-4000-8000-0000000000e3';
const REASON = 'Borré la cuenta sin querer y quiero volver a usar este correo.';

test('Correo bloqueado: borrar, rechazar, pedir y aprobar desbloqueo', async () => {
  const { PGlite } = await import(pgliteModule);
  const db = new PGlite();
  const code = async (sql) => {
    try {
      await db.query(sql);
      return 'sin error';
    } catch (error) {
      return error.code ?? error.message;
    }
  };
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
    }

    await db.exec(`
      insert into auth.users (id, email) values ('${USER}', 'Ana@Ejemplo.com');
      insert into auth.identities (provider_id, user_id, identity_data, provider)
        values ('gh-1', '${USER}', '{"email":"ana.gh@ejemplo.com"}', 'github');
      create or replace function auth.uid() returns uuid language sql as $$ select '${USER}'::uuid $$;
    `);

    const blocked = async (email) =>
      (await db.query(`select public.is_email_blocked($1) as b`, [email])).rows[0].b;

    assert.equal(await blocked('ana@ejemplo.com'), false, 'antes de borrar no hay bloqueo');
    await db.query('select public.delete_my_account()');
    assert.equal((await db.query(`select count(*)::int as n from auth.users`)).rows[0].n, 0);

    // Normalizado: mayúsculas y espacios no lo esquivan. Y las identidades cuentan.
    assert.equal(await blocked('  ANA@ejemplo.com '), true);
    assert.equal(await blocked('ana.gh@ejemplo.com'), true);
    assert.equal(await blocked('otra@ejemplo.com'), false);
    // La tabla guarda la huella, no el correo.
    const stored = (await db.query('select email_hash from public.blocked_account_emails')).rows;
    assert.ok(stored.every((row) => /^[0-9a-f]{64}$/.test(row.email_hash)));

    // GoTrue no puede crear otra cuenta con él, ni ponérselo a otra, ni vincularlo.
    assert.equal(
      await code(`insert into auth.users (id, email) values ('${AGAIN}', 'ana@ejemplo.com')`),
      'LI011'
    );
    await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'libre@ejemplo.com')`);
    assert.equal(
      await code(`update auth.users set email = 'ana@ejemplo.com' where id = '${OTHER}'`),
      'LI011'
    );
    assert.equal(
      await code(`update auth.users set last_sign_in_at = now() where id = '${OTHER}'`),
      'sin error',
      'otras actualizaciones de una cuenta sana siguen pasando'
    );
    assert.equal(
      await code(`insert into auth.identities (provider_id, user_id, identity_data, provider)
        values ('g-1', '${OTHER}', '{"email":"ana@ejemplo.com"}', 'google')`),
      'LI011'
    );

    // Solicitud de desbloqueo.
    const request = (email, reason) =>
      code(`select public.request_account_unblock('${email}', '${reason}')`);
    assert.equal(await request('ana@ejemplo.com', 'porque sí'), 'LI014', 'motivo corto');
    assert.equal(await request('otra@ejemplo.com', REASON), 'LI012', 'correo sin bloqueo');
    assert.equal(await request('ANA@ejemplo.com', REASON), 'sin error');
    assert.equal(await request('ana@ejemplo.com', REASON), 'LI013', 'una pendiente por correo');

    // Las tablas están cerradas a la app.
    await db.exec('set role authenticated');
    assert.equal(await code('select * from public.account_unblock_requests'), '42501');
    assert.equal(await code('select * from public.blocked_account_emails'), '42501');
    assert.equal(
      await code(`select public.resolve_account_unblock(gen_random_uuid(), true)`),
      '42501'
    );
    await db.exec('reset role');

    const { id, email } = (await db.query(`select id, email from public.account_unblock_requests`))
      .rows[0];
    assert.equal(email, 'ana@ejemplo.com');
    await db.query(`select public.resolve_account_unblock($1, true)`, [id]);
    assert.equal(await blocked('ana@ejemplo.com'), false, 'aprobada: correo libre');
    assert.equal(
      await code(`insert into auth.users (id, email) values ('${AGAIN}', 'ana@ejemplo.com')`),
      'sin error'
    );
  } finally {
    await db.close();
  }
});
