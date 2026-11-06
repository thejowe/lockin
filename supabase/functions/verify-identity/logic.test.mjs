import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, handleVerifyRequest } from './logic.mjs';

const UID = '6eab25bc-8198-41cc-8699-11a8e14e1f22';

function deps({ answer = { status: 200, body: { id: 12345, login: 'ana' } }, sealed = true } = {}) {
  const calls = { fetched: [], sealed: [], logs: [] };
  return {
    calls,
    fetchProviderUser: async (url, token) => {
      calls.fetched.push([url, token]);
      if (answer instanceof Error) throw answer;
      return answer;
    },
    seal: async (...args) => {
      calls.sealed.push(args);
      if (sealed instanceof Error) throw sealed;
      return sealed;
    },
    log: (message) => calls.logs.push(message),
  };
}

test('GitHub: pregunta con el token y sella con el id numérico como texto', async () => {
  const d = deps();
  const result = await handleVerifyRequest({
    userId: UID,
    body: { provider: 'github', providerToken: 'gho_x' },
    deps: d,
  });
  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.deepEqual(d.calls.fetched, [['https://api.github.com/user', 'gho_x']]);
  assert.deepEqual(d.calls.sealed, [[UID, 'github', '12345']]);
});

test('LinkedIn: sella con el sub de userinfo', async () => {
  const d = deps({ answer: { status: 200, body: { sub: 'li-abc', name: 'Ana' } } });
  const result = await handleVerifyRequest({
    userId: UID,
    body: { provider: 'linkedin_oidc', providerToken: 't' },
    deps: d,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(d.calls.fetched, [['https://api.linkedin.com/v2/userinfo', 't']]);
  assert.deepEqual(d.calls.sealed, [[UID, 'linkedin_oidc', 'li-abc']]);
});

test('el token de otra cuenta del proveedor no sella (mismatch)', async () => {
  const d = deps({ sealed: false });
  const result = await handleVerifyRequest({
    userId: UID,
    body: { provider: 'github', providerToken: 'gho_otro' },
    deps: d,
  });
  assert.deepEqual(result, { status: 403, body: { error: 'mismatch' } });
});

test('token rechazado por el proveedor: 403 token, sin sellar', async () => {
  for (const status of [401, 403]) {
    const d = deps({ answer: { status, body: null } });
    const result = await handleVerifyRequest({
      userId: UID,
      body: { provider: 'github', providerToken: 'caducado' },
      deps: d,
    });
    assert.deepEqual(result, { status: 403, body: { error: 'token' } });
    assert.deepEqual(d.calls.sealed, []);
  }
});

test('proveedor caído, respuesta sin id o RPC roto: 502 sin sellar a medias', async () => {
  for (const d of [
    deps({ answer: new Error('red') }),
    deps({ answer: { status: 500, body: null } }),
    deps({ answer: { status: 200, body: { login: 'sin-id' } } }),
  ]) {
    const result = await handleVerifyRequest({
      userId: UID,
      body: { provider: 'github', providerToken: 'x' },
      deps: d,
    });
    assert.deepEqual(result, { status: 502, body: { error: 'upstream' } });
    assert.deepEqual(d.calls.sealed, []);
  }
  const roto = deps({ sealed: new Error('rpc') });
  const result = await handleVerifyRequest({
    userId: UID,
    body: { provider: 'github', providerToken: 'x' },
    deps: roto,
  });
  assert.deepEqual(result, { status: 502, body: { error: 'upstream' } });
});

test('cuerpo mal formado o proveedor fuera de la lista: 400 sin llamar a nadie', async () => {
  for (const body of [
    null,
    {},
    { provider: 'github' },
    { provider: 'github', providerToken: '' },
    { provider: 'github', providerToken: 'x'.repeat(4097) },
    { provider: 'google', providerToken: 'x' },
    { provider: 'toString', providerToken: 'x' },
    { provider: '__proto__', providerToken: 'x' },
  ]) {
    const d = deps();
    const result = await handleVerifyRequest({ userId: UID, body, deps: d });
    assert.deepEqual(result, { status: 400, body: { error: 'request' } }, JSON.stringify(body));
    assert.deepEqual(d.calls.fetched, []);
  }
});

test('los logs nunca llevan el token', async () => {
  const d = deps({ answer: { status: 500, body: null } });
  await handleVerifyRequest({
    userId: UID,
    body: { provider: 'github', providerToken: 'gho_secreto' },
    deps: d,
  });
  assert.ok(d.calls.logs.length > 0);
  assert.ok(d.calls.logs.every((line) => !line.includes('gho_secreto')));
  assert.deepEqual(Object.keys(PROVIDERS).sort(), ['github', 'linkedin_oidc']);
});
