import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleSyncRequest,
  isUserId,
  mapSubscriber,
  readConfig,
  refreshEntitlement,
  subscriberUrl,
} from './logic.mjs';

const UID = '6eab25bc-8198-41cc-8699-11a8e14e1f22';

function subscriber({ expires = '2026-12-01T10:00:00Z', product = 'premium_monthly', store } = {}) {
  return {
    subscriber: {
      entitlements: {
        premium: { expires_date: expires, product_identifier: product },
      },
      subscriptions: { [product]: { store: store ?? 'play_store' } },
    },
  };
}

function deps({ response = { status: 200, body: subscriber() }, ...over } = {}) {
  const saved = [];
  const fetched = [];
  return {
    saved,
    fetched,
    logs: [],
    fetchSubscriber: async (id) => {
      fetched.push(id);
      return response;
    },
    saveEntitlement: async (id, e) => void saved.push([id, e]),
    log(message) {
      this.logs.push(message);
    },
    ...over,
  };
}

test('isUserId solo acepta uuid (no los anónimos de RevenueCat)', () => {
  assert.equal(isUserId(UID), true);
  assert.equal(isUserId('$RCAnonymousID:abc123'), false);
  assert.equal(isUserId(undefined), false);
});

test('subscriberUrl codifica el id', () => {
  assert.equal(subscriberUrl(UID), `https://api.revenuecat.com/v1/subscribers/${UID}`);
  assert.ok(subscriberUrl('a/b').endsWith('/a%2Fb'));
});

test('mapSubscriber: entitlement activo con tienda', () => {
  assert.deepEqual(mapSubscriber(subscriber({ store: 'app_store' })), {
    premiumUntil: '2026-12-01T10:00:00.000Z',
    productId: 'premium_monthly',
    store: 'app_store',
  });
  assert.equal(mapSubscriber(subscriber({ store: 'mac_app_store' })).store, 'app_store');
});

test('mapSubscriber: tienda desconocida (promocional, Stripe) → null por el check de la tabla', () => {
  assert.equal(mapSubscriber(subscriber({ store: 'promotional' })).store, null);
});

test('mapSubscriber: sin entitlement premium → todo null', () => {
  const empty = { premiumUntil: null, productId: null, store: null };
  assert.deepEqual(mapSubscriber({ subscriber: { entitlements: {} } }), empty);
  assert.deepEqual(mapSubscriber({}), empty);
  assert.deepEqual(mapSubscriber(null), empty);
});

test('mapSubscriber: una expiración ya pasada se conserva (is_premium compara con now())', () => {
  assert.equal(
    mapSubscriber(subscriber({ expires: '2025-01-01T00:00:00Z' })).premiumUntil,
    '2025-01-01T00:00:00.000Z'
  );
});

test('mapSubscriber: expires_date null es de por vida; una fecha rota lanza', () => {
  assert.equal(
    mapSubscriber(subscriber({ expires: null })).premiumUntil,
    '9999-12-31T23:59:59.000Z'
  );
  assert.throws(() => mapSubscriber(subscriber({ expires: 'ayer' })), /expires_date/);
});

test('refreshEntitlement escribe lo que diga la API, no otra cosa', async () => {
  const d = deps();
  const result = await refreshEntitlement(UID, d);
  assert.deepEqual(d.fetched, [UID]);
  assert.deepEqual(d.saved, [[UID, result]]);
  assert.equal(result.premiumUntil, '2026-12-01T10:00:00.000Z');
});

test('refreshEntitlement lanza si la API no responde 200 y no escribe', async () => {
  for (const status of [401, 404, 429, 500]) {
    const d = deps({ response: { status, body: null } });
    await assert.rejects(() => refreshEntitlement(UID, d), new RegExp(String(status)));
    assert.equal(d.saved.length, 0);
  }
});

test('refreshEntitlement no borra Premium si el cuerpo 200 es ilegible', async () => {
  const d = deps({ response: { status: 200, body: null } });
  await assert.rejects(() => refreshEntitlement(UID, d), /ilegible/);
  assert.equal(d.saved.length, 0);
});

test('readConfig', () => {
  assert.equal(readConfig({}), null);
  assert.deepEqual(readConfig({ REVENUECAT_SECRET_KEY: 'sk_x' }), { apiKey: 'sk_x' });
});

test('sync: sin configurar → 200 unconfigured y no llama a nadie', async () => {
  const d = deps();
  const r = await handleSyncRequest({ userId: UID, config: null, deps: d });
  assert.equal(r.status, 200);
  assert.equal(r.body.reason, 'unconfigured');
  assert.equal(d.fetched.length, 0);
});

test('sync: sincroniza el uid de la sesión y devuelve premiumUntil', async () => {
  const d = deps();
  const r = await handleSyncRequest({ userId: UID, config: { apiKey: 'k' }, deps: d });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, premiumUntil: '2026-12-01T10:00:00.000Z' });
  assert.deepEqual(d.fetched, [UID]);
});

test('sync: una compra caducada deja premiumUntil en pasado, no lo borra', async () => {
  const d = deps({
    response: { status: 200, body: subscriber({ expires: '2025-01-01T00:00:00Z' }) },
  });
  await handleSyncRequest({ userId: UID, config: { apiKey: 'k' }, deps: d });
  assert.equal(d.saved[0][1].premiumUntil, '2025-01-01T00:00:00.000Z');
});

test('sync: error de la API o de la red → 502', async () => {
  const bad = deps({ response: { status: 500, body: null } });
  assert.equal(
    (await handleSyncRequest({ userId: UID, config: { apiKey: 'k' }, deps: bad })).status,
    502
  );
  assert.equal(bad.saved.length, 0);

  const down = deps({
    fetchSubscriber: async () => {
      throw new Error('timeout');
    },
  });
  assert.equal(
    (await handleSyncRequest({ userId: UID, config: { apiKey: 'k' }, deps: down })).status,
    502
  );
  assert.match(down.logs[0], /timeout/);
});

test('sync: uid que no es uuid → 400', async () => {
  const d = deps();
  const r = await handleSyncRequest({ userId: 'x', config: { apiKey: 'k' }, deps: d });
  assert.equal(r.status, 400);
  assert.equal(d.fetched.length, 0);
});
