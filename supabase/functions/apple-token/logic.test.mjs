import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_AUDIENCE,
  REVOKE_URL,
  TOKEN_URL,
  buildClientSecret,
  decodeJwtPayload,
  handleAppleTokenRequest,
  pemToPkcs8,
  readConfig,
} from './logic.mjs';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

/** Una clave P-256 de usar y tirar, en el mismo formato que el .p8 de Apple. */
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const PEM = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8)
  .toString('base64')
  .replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----`;

const CONFIG = {
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  privateKey: PEM,
  clientId: 'app.cofounder.mobile',
};

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const idToken = (claims) => `${b64url({ alg: 'RS256' })}.${b64url(claims)}.firma`;

function deps({ seed = [], ...over } = {}) {
  const calls = [];
  const stored = new Map(seed);
  return {
    calls,
    stored,
    logs: [],
    now: () => NOW,
    post: async (url, form) => {
      calls.push({ url, form });
      if (url === TOKEN_URL) {
        return {
          status: 200,
          body: {
            refresh_token: 'rt-de-apple',
            id_token: idToken({ sub: 'apple-sub-1', aud: 'app.cofounder.mobile' }),
          },
        };
      }
      return { status: 200, body: null };
    },
    saveRefreshToken: async (uid, token) => void stored.set(uid, token),
    loadRefreshToken: async (uid) => stored.get(uid) ?? null,
    deleteRefreshToken: async (uid) => void stored.delete(uid),
    log(message) {
      this.logs.push(message);
    },
    ...over,
  };
}

const run = (body, d, { config = CONFIG, appleSubjects = ['apple-sub-1'] } = {}) =>
  handleAppleTokenRequest({ userId: 'u1', appleSubjects, body, config, deps: d });

test('readConfig: los cuatro secretos o nada', () => {
  const env = {
    APPLE_TEAM_ID: 'T',
    APPLE_KEY_ID: 'K',
    APPLE_PRIVATE_KEY: 'P',
    APPLE_CLIENT_ID: 'app.cofounder.mobile',
  };
  assert.deepEqual(readConfig(env), {
    teamId: 'T',
    keyId: 'K',
    privateKey: 'P',
    clientId: 'app.cofounder.mobile',
  });
  assert.equal(readConfig({ ...env, APPLE_KEY_ID: '' }), null);
  assert.equal(readConfig({ ...env, APPLE_PRIVATE_KEY: undefined }), null);
  assert.equal(readConfig({}), null);
});

test('pemToPkcs8: acepta el .p8 con saltos reales o escritos como \\n', () => {
  assert.deepEqual(pemToPkcs8(PEM), pkcs8);
  assert.deepEqual(pemToPkcs8(PEM.replace(/\n/g, '\\n')), pkcs8);
  assert.throws(() => pemToPkcs8('no es una clave'), /PEM/);
});

test('client_secret: ES256 con iss, sub, aud, kid y caducidad corta, verificable con la clave', async () => {
  const jwt = await buildClientSecret(CONFIG, NOW);
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {
    alg: 'ES256',
    kid: 'KEY1234567',
  });
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.deepEqual(claims, {
    iss: 'TEAM123456',
    iat: NOW / 1000,
    exp: NOW / 1000 + 300,
    aud: APPLE_AUDIENCE,
    sub: 'app.cofounder.mobile',
  });
  // Apple admite como mucho 6 meses.
  assert.ok(claims.exp - claims.iat <= 15_777_000);
  const raw = Buffer.from(signature, 'base64url');
  assert.equal(raw.length, 64, 'firma JWS r‖s, no DER');
  assert.equal(
    await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      raw,
      new TextEncoder().encode(`${header}.${payload}`)
    ),
    true
  );
});

test('decodeJwtPayload: lee la carga y no lanza con basura', () => {
  assert.deepEqual(decodeJwtPayload(idToken({ sub: 'x' })), { sub: 'x' });
  assert.equal(decodeJwtPayload('basura'), null);
  assert.equal(decodeJwtPayload(undefined), null);
});

test('exchange: canjea el code con el client_secret y guarda el refresh token', async () => {
  const d = deps();
  const result = await run({ action: 'exchange', code: 'code-1' }, d);
  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.equal(d.calls.length, 1);
  assert.equal(d.calls[0].url, TOKEN_URL);
  const { client_secret, ...form } = d.calls[0].form;
  assert.deepEqual(form, {
    client_id: 'app.cofounder.mobile',
    code: 'code-1',
    grant_type: 'authorization_code',
  });
  assert.equal(client_secret.split('.').length, 3);
  assert.equal(d.stored.get('u1'), 'rt-de-apple');
});

test('exchange: sin secretos no llama a Apple ni guarda nada', async () => {
  const d = deps();
  const result = await run({ action: 'exchange', code: 'code-1' }, d, { config: null });
  assert.deepEqual(result, { status: 200, body: { ok: false, reason: 'unconfigured' } });
  assert.equal(d.calls.length, 0);
  assert.equal(d.stored.size, 0);
});

test('exchange: una sesión sin identidad de Apple no guarda tokens', async () => {
  const d = deps();
  const result = await run({ action: 'exchange', code: 'code-1' }, d, { appleSubjects: [] });
  assert.equal(result.status, 403);
  assert.equal(d.calls.length, 0);
});

test('exchange: el code de OTRA persona de Apple no se guarda', async () => {
  const d = deps();
  const result = await run({ action: 'exchange', code: 'code-1' }, d, {
    appleSubjects: ['apple-sub-otra'],
  });
  assert.deepEqual(result, { status: 403, body: { error: 'identity' } });
  assert.equal(d.stored.size, 0);
});

test('exchange: un id_token para otra app no se guarda', async () => {
  const d = deps({
    post: async () => ({
      status: 200,
      body: { refresh_token: 'rt', id_token: idToken({ sub: 'apple-sub-1', aud: 'otra.app' }) },
    }),
  });
  const result = await run({ action: 'exchange', code: 'code-1' }, d);
  assert.equal(result.status, 403);
  assert.equal(d.stored.size, 0);
});

test('exchange: Apple rechaza o se cae la red → 502 con rastro, sin guardar', async () => {
  for (const post of [
    async () => ({ status: 400, body: { error: 'invalid_grant' } }),
    async () => ({ status: 200, body: { access_token: 'sin refresh' } }),
    async () => {
      throw new Error('ECONNRESET');
    },
  ]) {
    const d = deps({ post });
    const result = await run({ action: 'exchange', code: 'code-1' }, d);
    assert.deepEqual(result, { status: 502, body: { error: 'apple' } });
    assert.equal(d.stored.size, 0);
    assert.equal(d.logs.length, 1);
  }
});

test('exchange: code ausente, vacío o enorme es 400', async () => {
  for (const code of [undefined, '', 42, 'x'.repeat(1025)]) {
    const d = deps();
    assert.equal((await run({ action: 'exchange', code }, d)).status, 400);
    assert.equal(d.calls.length, 0);
  }
});

test('revoke: revoca el refresh token guardado y borra la fila', async () => {
  const d = deps({ seed: [['u1', 'rt-guardado']] });
  const result = await run({ action: 'revoke' }, d, { appleSubjects: [] });
  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.equal(d.calls[0].url, REVOKE_URL);
  const { client_secret, ...form } = d.calls[0].form;
  assert.deepEqual(form, {
    client_id: 'app.cofounder.mobile',
    token: 'rt-guardado',
    token_type_hint: 'refresh_token',
  });
  assert.equal(client_secret.split('.').length, 3);
  assert.equal(d.stored.size, 0);
});

test('revoke: sin token guardado no llama a Apple', async () => {
  const d = deps();
  assert.deepEqual(await run({ action: 'revoke' }, d), {
    status: 200,
    body: { ok: false, reason: 'none' },
  });
  assert.equal(d.calls.length, 0);
});

test('revoke: sin secretos deja la fila y lo registra', async () => {
  const d = deps({ seed: [['u1', 'rt']] });
  const result = await run({ action: 'revoke' }, d, { config: null });
  assert.deepEqual(result, { status: 200, body: { ok: false, reason: 'unconfigured' } });
  assert.equal(d.calls.length, 0);
  assert.equal(d.stored.get('u1'), 'rt');
  assert.equal(d.logs.length, 1);
});

test('revoke: si Apple falla, 502 con rastro y la fila se queda para reintentar', async () => {
  for (const post of [
    async () => ({ status: 400, body: { error: 'invalid_client' } }),
    async () => {
      throw new Error('timeout');
    },
  ]) {
    const d = deps({ seed: [['u1', 'rt']], post });
    assert.deepEqual(await run({ action: 'revoke' }, d), { status: 502, body: { error: 'apple' } });
    assert.equal(d.stored.get('u1'), 'rt');
    assert.equal(d.logs.length, 1);
    assert.ok(!d.logs[0].includes('rt '), 'el rastro no lleva el token');
  }
});

test('acción desconocida es 400; un fallo de la base es 500 con rastro', async () => {
  assert.equal((await run({ action: 'otra' }, deps())).status, 400);
  assert.equal((await run(null, deps())).status, 400);
  const d = deps({
    loadRefreshToken: async () => {
      throw new Error('db caída');
    },
  });
  assert.deepEqual(await run({ action: 'revoke' }, d), {
    status: 500,
    body: { error: 'unavailable' },
  });
  assert.equal(d.logs.length, 1);
});
