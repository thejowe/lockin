import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BATCH_SIZE,
  buildMessages,
  deadTokens,
  handlePushRequest,
  preview,
  readConfig,
} from './logic.mjs';

const MESSAGE = '6eab25bc-8198-41cc-8699-11a8e14e1f22';
const GROUP = 'acce2d3f-6877-4f80-9060-fb47b465ee21';
const CONFIG = { secret: 'secreto-compartido' };

const row = (n, over = {}) => ({
  token: `ExponentPushToken[tok${n}]`,
  group_id: GROUP,
  group_name: 'Taller Abierto',
  sender_name: 'Marc',
  body: 'Hola equipo',
  ...over,
});

function deps(rows, responses = []) {
  const state = { sent: [], forgotten: [], logs: [] };
  let call = 0;
  return {
    state,
    targets: async (id) => (id === MESSAGE ? rows : []),
    sendToExpo: async (messages) => {
      state.sent.push(messages);
      return (
        responses[call++] ?? { status: 200, body: { data: messages.map(() => ({ status: 'ok' })) } }
      );
    },
    forgetTokens: async (tokens) => void state.forgotten.push(...tokens),
    log: (...args) => void state.logs.push(args),
  };
}

test('sin secreto configurado responde 503; con uno incorrecto, 401', async () => {
  assert.equal(readConfig({}), null);
  assert.deepEqual(readConfig({ PUSH_WEBHOOK_SECRET: 's' }), { secret: 's' });
  const d = deps([row(1)]);
  assert.equal(
    (await handlePushRequest({ secretHeader: 'x', body: {}, config: null, deps: d })).status,
    503
  );
  assert.equal(
    (
      await handlePushRequest({
        secretHeader: 'otro',
        body: { message_id: MESSAGE },
        config: CONFIG,
        deps: d,
      })
    ).status,
    401
  );
  assert.equal(
    (
      await handlePushRequest({
        secretHeader: null,
        body: { message_id: MESSAGE },
        config: CONFIG,
        deps: d,
      })
    ).status,
    401
  );
  assert.deepEqual(d.state.sent, []);
});

test('un message_id que no es uuid es 400', async () => {
  for (const body of [null, {}, { message_id: 'abc' }, { message_id: 7 }]) {
    const result = await handlePushRequest({
      secretHeader: CONFIG.secret,
      body,
      config: CONFIG,
      deps: deps([]),
    });
    assert.equal(result.status, 400);
  }
});

test('manda un aviso por token, con el grupo de título y el chat como destino', async () => {
  const d = deps([row(1), row(2, { sender_name: '' })]);
  const result = await handlePushRequest({
    secretHeader: CONFIG.secret,
    body: { message_id: MESSAGE },
    config: CONFIG,
    deps: d,
  });
  assert.deepEqual(result, { status: 200, body: { sent: 2, forgotten: 0 } });
  const [batch] = d.state.sent;
  assert.equal(batch[0].to, 'ExponentPushToken[tok1]');
  assert.equal(batch[0].title, 'Taller Abierto');
  assert.equal(batch[0].body, 'Marc: Hola equipo');
  assert.equal(batch[1].body, 'Hola equipo', 'sin nombre, solo el texto');
  assert.deepEqual(batch[0].data, { url: `/group/${GROUP}`, groupId: GROUP });
  assert.equal(batch[0].channelId, 'group-messages');
});

test('sin destinatarios no llama a Expo', async () => {
  const d = deps([]);
  const result = await handlePushRequest({
    secretHeader: `Bearer ${CONFIG.secret}`,
    body: { message_id: MESSAGE },
    config: CONFIG,
    deps: d,
  });
  assert.deepEqual(result.body, { sent: 0, forgotten: 0 });
  assert.deepEqual(d.state.sent, []);
});

test('lotes de 100; un lote rechazado se registra y los demás siguen', async () => {
  const rows = Array.from({ length: BATCH_SIZE + 5 }, (_, i) => row(i));
  const d = deps(rows, [{ status: 500, body: 'caído' }]);
  const result = await handlePushRequest({
    secretHeader: CONFIG.secret,
    body: { message_id: MESSAGE },
    config: CONFIG,
    deps: d,
  });
  assert.deepEqual(
    d.state.sent.map((batch) => batch.length),
    [BATCH_SIZE, 5]
  );
  assert.equal(result.body.sent, 5);
  assert.equal(d.state.logs.length, 1);
});

test('los tokens que Expo da por muertos se olvidan', async () => {
  const d = deps(
    [row(1), row(2), row(3)],
    [
      {
        status: 200,
        body: {
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
            { status: 'error', details: { error: 'MessageRateExceeded' } },
          ],
        },
      },
    ]
  );
  const result = await handlePushRequest({
    secretHeader: CONFIG.secret,
    body: { message_id: MESSAGE },
    config: CONFIG,
    deps: d,
  });
  assert.deepEqual(d.state.forgotten, ['ExponentPushToken[tok2]']);
  assert.equal(result.body.forgotten, 1);
  assert.deepEqual(deadTokens([], null), []);
});

test('la vista previa junta espacios y corta los mensajes largos', () => {
  assert.equal(preview('  hola\n\n  equipo  '), 'hola equipo');
  assert.equal(preview(undefined), '');
  const long = preview('x'.repeat(500));
  assert.equal(Array.from(long).length, 140);
  assert.ok(long.endsWith('…'));
  assert.equal(buildMessages([]).length, 0);
});
