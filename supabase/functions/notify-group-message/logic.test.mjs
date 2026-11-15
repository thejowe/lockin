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

test('tipos y payloads desconocidos son 400 sin consultar destinatarios', async () => {
  const d = deps([row(1)]);
  for (const body of [
    null,
    [],
    { type: 'unknown' },
    { type: null },
    { type: 'match', match_id: 'x' },
    { type: 'like-digest', users: [MESSAGE] },
    { type: 'group-activity', event_id: MESSAGE, group_name: 'injected' },
  ]) {
    assert.equal(
      (await handlePushRequest({ secretHeader: CONFIG.secret, body, config: CONFIG, deps: d }))
        .status,
      400
    );
  }
  assert.deepEqual(d.state.sent, []);
});

test('likes gratis anónimos y Premium con nombre, plurales y Super Like en los tres idiomas', () => {
  for (const [locale, one, many, named] of [
    [
      'es',
      '¡Tienes un like nuevo! 🔥',
      '¡3 personas te han dado like! 🔥',
      '¡Ana te ha dado like! 🔥',
    ],
    ['en', 'You have a new like! 🔥', '3 people liked you! 🔥', 'Ana liked you! 🔥'],
    ['ca', 'Tens un like nou! 🔥', "3 persones t'han donat like! 🔥", "Ana t'ha donat like! 🔥"],
  ]) {
    const base = { token: 'token', user_id: MESSAGE, locale, like_count: 1, first_name: null };
    const free = buildMessages([base], 'like-digest')[0];
    assert.equal(free.title, one);
    assert.equal(free.data.url, '/likes');
    assert.equal(free.collapseId, `likes:${MESSAGE}`);
    assert.ok(!JSON.stringify(free).includes('Ana'));
    assert.equal(buildMessages([{ ...base, like_count: 3 }], 'like-digest')[0].title, many);
    assert.equal(buildMessages([{ ...base, first_name: 'Ana' }], 'like-digest')[0].title, named);
    assert.match(
      buildMessages([{ ...base, first_name: 'Ana', first_super: true }], 'like-digest')[0].title,
      /Ana.*Super Like/
    );
    assert.match(
      buildMessages([{ ...base, first_name: 'Ana', like_count: 3 }], 'like-digest')[0].body,
      /Ana.*2/
    );
  }
  assert.equal(
    buildMessages(
      [{ token: 'x', like_count: 2, first_name: 'Ana', locale: 'en' }],
      'like-digest'
    )[0].body,
    'Ana and 1 other want to meet you! 🚀'
  );
  assert.equal(
    buildMessages([{ token: 'x', like_count: 1, locale: null }], 'like-digest')[0].title,
    'You have a new like! 🔥'
  );
});

test('cada tipo usa su canal, hilo, sonido y destino, sin fiarse del payload', () => {
  const base = {
    token: 'token',
    user_id: MESSAGE,
    locale: 'ca',
    match_id: MESSAGE,
    other_name: 'Ana',
    sender_name: 'Ana',
    body: 'hola\n  món',
    url: `/group/${GROUP}`,
    group_id: GROUP,
    group_name: 'Equip',
    person_name: 'Ana',
    event_kind: 'joined',
  };
  const match = buildMessages([base], 'match')[0];
  assert.equal(match.title, 'És un match! 🎉');
  assert.equal(match.data.url, `/chat/${MESSAGE}`);
  assert.equal(match.channelId, 'matches');
  assert.equal(match.sound, 'default');
  const direct = buildMessages([base], 'direct-message')[0];
  assert.equal(direct.title, 'Ana');
  assert.equal(direct.body, 'hola món');
  assert.equal(direct.collapseId, `match:${MESSAGE}`);
  assert.equal(direct.channelId, 'messages');
  for (const event_kind of ['joined', 'joined-self', 'kicked', 'group-like']) {
    const event = buildMessages([{ ...base, event_kind }], 'group-activity')[0];
    assert.equal(event.channelId, 'groups');
    assert.match(event.title, /Equip/);
  }
  const reminder = buildMessages([{ ...base, like_count: 0 }], 'reengagement')[0];
  assert.equal(reminder.title, 'Tens missatges nous! 💬');
  assert.equal(reminder.data.url, base.url);
  assert.equal(reminder.sound, undefined);
  assert.equal(reminder.channelId, 'reminders');
  assert.equal(buildMessages([{ ...base, like_count: 1 }], 'reengagement')[0].data.url, '/likes');
  const expiry = buildMessages([base], 'premium-expiry')[0];
  assert.equal(expiry.data.url, '/premium');
  assert.equal(expiry.title, 'El teu Premium acaba demà! ⏳');
});

test('solo marca destinatarios con ticket ok; lotes fallidos y tickets ausentes no avanzan marcas', async () => {
  const marked = [];
  const forgotten = [];
  const rows = Array.from({ length: 103 }, (_, i) => ({
    token: `ExponentPushToken[t${i}]`,
    notice_id: `notice-${i}`,
    user_id: MESSAGE,
    like_count: 1,
  }));
  let batch = 0;
  const d = {
    targets: async (id, type) => {
      assert.equal(id, null);
      assert.equal(type, 'like-digest');
      return rows;
    },
    sendToExpo: async () =>
      ++batch === 1
        ? { status: 503, body: null }
        : {
            status: 200,
            body: {
              data: [
                { status: 'ok' },
                { status: 'error', details: { error: 'DeviceNotRegistered' } },
              ],
            },
          },
    completeNotices: async (ids) => marked.push(...ids),
    forgetTokens: async (tokens) => forgotten.push(...tokens),
    log: () => {},
  };
  const result = await handlePushRequest({
    secretHeader: CONFIG.secret,
    body: { type: 'like-digest' },
    config: CONFIG,
    deps: d,
  });
  assert.equal(result.body.sent, 1);
  assert.deepEqual(marked, ['notice-100']);
  assert.deepEqual(forgotten, ['ExponentPushToken[t101]']);
});
