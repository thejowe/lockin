import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleWebhookRequest, readConfig, secretMatches, targetUserIds } from './logic.mjs';

const UID = '6eab25bc-8198-41cc-8699-11a8e14e1f22';
const OTHER = 'acce2d3f-6877-4f80-9060-fb47b465ee21';
const CONFIG = { webhookSecret: 'secreto-compartido', apiKey: 'sk_x' };

const subscriber = (expires) => ({
  subscriber: {
    entitlements: { premium: { expires_date: expires, product_identifier: 'premium_monthly' } },
    subscriptions: { premium_monthly: { store: 'app_store' } },
  },
});

function deps({ seen = [], profiles = [UID, OTHER], responses = {}, ...over } = {}) {
  const state = {
    seen: new Set(seen),
    saved: [],
    fetched: [],
    logs: [],
  };
  return {
    state,
    hasSeenEvent: async (id) => state.seen.has(id),
    markEventSeen: async (id) => void state.seen.add(id),
    profileExists: async (id) => profiles.includes(id),
    fetchSubscriber: async (id) => {
      state.fetched.push(id);
      return responses[id] ?? { status: 200, body: subscriber('2026-12-01T10:00:00Z') };
    },
    saveEntitlement: async (id, e) => void state.saved.push([id, e]),
    log: (m) => void state.logs.push(m),
    ...over,
  };
}

const call = (d, event, authorization = CONFIG.webhookSecret, config = CONFIG) =>
  handleWebhookRequest({ authorization, body: event ? { event } : null, config, deps: d });

const ev = (type, extra = {}) => ({ id: `evt-${type}`, type, app_user_id: UID, ...extra });

test('secretMatches: el secreto tal cual o como Bearer; nada más', async () => {
  assert.equal(await secretMatches('s3', 's3'), true);
  assert.equal(await secretMatches('Bearer s3', 's3'), true);
  assert.equal(await secretMatches('s3 ', 's3'), false);
  assert.equal(await secretMatches('otro', 's3'), false);
  assert.equal(await secretMatches('', 's3'), false);
  assert.equal(await secretMatches(null, 's3'), false);
  assert.equal(await secretMatches('', ''), false);
});

test('readConfig exige los dos secretos', () => {
  assert.equal(readConfig({ REVENUECAT_WEBHOOK_SECRET: 'a' }), null);
  assert.equal(readConfig({ REVENUECAT_SECRET_KEY: 'b' }), null);
  assert.deepEqual(readConfig({ REVENUECAT_WEBHOOK_SECRET: 'a', REVENUECAT_SECRET_KEY: 'b' }), {
    webhookSecret: 'a',
    apiKey: 'b',
  });
});

test('firma inválida o ausente → 401 y no toca nada', async () => {
  for (const auth of ['mal', null, '']) {
    const d = deps();
    const r = await call(d, ev('RENEWAL'), auth);
    assert.equal(r.status, 401);
    assert.equal(d.state.fetched.length, 0);
    assert.equal(d.state.saved.length, 0);
  }
});

test('sin secretos configurados → 503', async () => {
  const r = await call(deps(), ev('RENEWAL'), 'x', null);
  assert.equal(r.status, 503);
});

test('cuerpo sin evento o sin id → 400', async () => {
  assert.equal((await call(deps(), null)).status, 400);
  assert.equal((await call(deps(), { type: 'RENEWAL', app_user_id: UID })).status, 400);
});

for (const type of [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
]) {
  test(`${type}: pide el estado a la API y escribe premium_until de la respuesta`, async () => {
    const d = deps();
    const r = await call(d, ev(type));
    assert.equal(r.status, 200);
    assert.deepEqual(d.state.fetched, [UID]);
    assert.deepEqual(d.state.saved, [
      [
        UID,
        {
          premiumUntil: '2026-12-01T10:00:00.000Z',
          productId: 'premium_monthly',
          store: 'app_store',
        },
      ],
    ]);
    assert.ok(d.state.seen.has(`evt-${type}`));
  });
}

test('no se fía del cuerpo: un expiration_at_ms inventado no se usa', async () => {
  const d = deps({
    responses: { [UID]: { status: 200, body: subscriber('2026-12-01T10:00:00Z') } },
  });
  await call(d, ev('RENEWAL', { expiration_at_ms: Date.UTC(2099, 0, 1) }));
  assert.equal(d.state.saved[0][1].premiumUntil, '2026-12-01T10:00:00.000Z');
});

test('EXPIRATION: si la API dice que ya no hay entitlement, premium_until queda null', async () => {
  const d = deps({
    responses: { [UID]: { status: 200, body: { subscriber: { entitlements: {} } } } },
  });
  await call(d, ev('EXPIRATION'));
  assert.equal(d.state.saved[0][1].premiumUntil, null);
});

test('evento repetido → no-op (ni API ni escritura)', async () => {
  const d = deps({ seen: ['evt-RENEWAL'] });
  const r = await call(d, ev('RENEWAL'));
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, 'duplicate');
  assert.equal(d.state.fetched.length, 0);
  assert.equal(d.state.saved.length, 0);
});

test('el mismo evento dos veces seguidas solo se procesa una', async () => {
  const d = deps();
  await call(d, ev('RENEWAL'));
  await call(d, ev('RENEWAL'));
  assert.equal(d.state.saved.length, 1);
});

test('app_user_id no-uuid (anónimo) → 200 y nada', async () => {
  const d = deps();
  const r = await call(d, ev('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:abc' }));
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, 'user');
  assert.equal(d.state.fetched.length, 0);
  assert.equal(d.state.seen.size, 0);
});

test('app_user_id sin perfil (cuenta borrada) → 200, sin API ni escritura', async () => {
  const d = deps({ profiles: [] });
  const r = await call(d, ev('RENEWAL'));
  assert.equal(r.status, 200);
  assert.equal(r.body.updated, 0);
  assert.equal(d.state.fetched.length, 0);
  assert.equal(d.state.saved.length, 0);
});

test('tipos que no cambian el entitlement (TEST, NON_RENEWING...) se ignoran con 200', async () => {
  const d = deps();
  const r = await call(d, ev('TEST'));
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, 'type');
  assert.equal(d.state.fetched.length, 0);
});

test('error de la API de RevenueCat → 502 y el evento NO queda apuntado (el reintento procesa)', async () => {
  const d = deps({ responses: { [UID]: { status: 500, body: null } } });
  const r = await call(d, ev('RENEWAL'));
  assert.equal(r.status, 502);
  assert.equal(d.state.seen.size, 0);
  assert.equal(d.state.saved.length, 0);

  d.fetchSubscriber = async () => ({ status: 200, body: subscriber('2026-12-01T10:00:00Z') });
  assert.equal((await call(d, ev('RENEWAL'))).status, 200);
  assert.equal(d.state.saved.length, 1);
});

test('fallo de red o de base de datos → 502', async () => {
  const net = deps({
    fetchSubscriber: async () => {
      throw new Error('ECONNRESET');
    },
  });
  assert.equal((await call(net, ev('RENEWAL'))).status, 502);
  assert.match(net.state.logs[0], /ECONNRESET/);

  const db = deps({
    saveEntitlement: async () => {
      throw new Error('db caída');
    },
  });
  assert.equal((await call(db, ev('RENEWAL'))).status, 502);
});

test('TRANSFER: refresca origen y destino, solo uuids', () => {
  assert.deepEqual(
    targetUserIds({
      type: 'TRANSFER',
      app_user_id: UID,
      transferred_from: ['$RCAnonymousID:x', OTHER],
      transferred_to: [UID],
    }).sort(),
    [OTHER, UID].sort()
  );
  assert.deepEqual(targetUserIds({ type: 'RENEWAL', app_user_id: UID, transferred_to: [OTHER] }), [
    UID,
  ]);
});

test('TRANSFER procesa las dos cuentas', async () => {
  const d = deps();
  await call(
    d,
    ev('TRANSFER', { app_user_id: undefined, transferred_from: [OTHER], transferred_to: [UID] })
  );
  assert.deepEqual(d.state.fetched.sort(), [OTHER, UID].sort());
});
