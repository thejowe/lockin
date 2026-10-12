import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAvatarRequest, isJpeg, ownsPath, verdict } from './logic.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

function deps(over = {}) {
  const calls = [];
  return {
    calls,
    downloadPending: async () => JPEG,
    moderate: async () => ({ flagged: false, scores: { sexual: 0.01 } }),
    publish: async (uid) => {
      calls.push('publish');
      return {
        path: `${uid}/n.jpg`,
        url: `https://x/storage/v1/object/public/avatars/${uid}/n.jpg`,
      };
    },
    currentAvatarPath: async () => 'u1/old.jpg',
    setAvatarUrl: async (_uid, url) => calls.push(`setUrl:${url}`),
    removePublic: async (p) => calls.push(`removePublic:${p}`),
    removePending: async (p) => calls.push(`removePending:${p}`),
    ...over,
  };
}

const set = (path = 'u1/p.jpg') => ({ action: 'set', path });

test('isJpeg mira los magic bytes, no la extensión', () => {
  assert.equal(isJpeg(JPEG), true);
  assert.equal(isJpeg(PNG), false);
  assert.equal(isJpeg(new Uint8Array(0)), false);
});

test('ownsPath solo acepta <uid>/<archivo>.jpg propio, sin escapar de la carpeta', () => {
  assert.equal(ownsPath('u1', 'u1/a-b_c.jpg'), true);
  assert.equal(ownsPath('u1', 'u2/a.jpg'), false);
  assert.equal(ownsPath('u1', 'u1/../u2/a.jpg'), false);
  assert.equal(ownsPath('u1', 'u1/a.png'), false);
  assert.equal(ownsPath('u1', 'u1/sub/a.jpg'), false);
  assert.equal(ownsPath('u1', undefined), false);
});

test('verdict: flagged, sexual alto, menores y violencia gráfica se rechazan', () => {
  assert.equal(verdict({ flagged: false, scores: { sexual: 0.1 } }), true);
  assert.equal(verdict({ flagged: true, scores: {} }), false);
  assert.equal(verdict({ flagged: false, scores: { sexual: 0.4 } }), false);
  assert.equal(verdict({ flagged: false, scores: { 'sexual/minors': 0.001 } }), false);
  assert.equal(verdict({ flagged: false, scores: { 'violence/graphic': 0.5 } }), false);
});

test('set limpio: publica, apunta avatar_url, borra la anterior y la pendiente', async () => {
  const d = deps();
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 200);
  assert.match(res.body.avatarUrl, /avatars\/u1\/n\.jpg$/);
  assert.deepEqual(d.calls, [
    'publish',
    'setUrl:https://x/storage/v1/object/public/avatars/u1/n.jpg',
    'removePublic:u1/old.jpg',
    'removePending:u1/p.jpg',
  ]);
});

test('imagen marcada: 422 flagged, no publica y borra la pendiente', async () => {
  const d = deps({ moderate: async () => ({ flagged: true, scores: { sexual: 0.9 } }) });
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'flagged');
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('proveedor caído: falla cerrado, 503, nada publicado', async () => {
  const d = deps({
    moderate: async () => {
      throw new Error('500');
    },
  });
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'unavailable');
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('no es JPEG: 422 invalid-image y ni se llama al proveedor', async () => {
  let called = false;
  const d = deps({
    downloadPending: async () => PNG,
    moderate: async () => {
      called = true;
      return { flagged: false, scores: {} };
    },
  });
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'invalid-image');
  assert.equal(called, false);
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('más de 5 MB: 422 invalid-image', async () => {
  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  big.set(JPEG);
  const d = deps({ downloadPending: async () => big });
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'invalid-image');
});

test('archivo pendiente inexistente: 422 invalid-image', async () => {
  const d = deps({ downloadPending: async () => null });
  const res = await handleAvatarRequest({ userId: 'u1', body: set(), deps: d });

  assert.equal(res.status, 422);
});

test('path de otra persona: 403 sin leer nada', async () => {
  let downloaded = false;
  const d = deps({
    downloadPending: async () => {
      downloaded = true;
      return JPEG;
    },
  });
  const res = await handleAvatarRequest({ userId: 'u1', body: set('u2/p.jpg'), deps: d });

  assert.equal(res.status, 403);
  assert.equal(downloaded, false);
  assert.deepEqual(d.calls, []);
});

test('cuerpo desconocido o ausente: 400', async () => {
  const hack = await handleAvatarRequest({ userId: 'u1', body: { action: 'hack' }, deps: deps() });
  assert.equal(hack.status, 400);
  const none = await handleAvatarRequest({ userId: 'u1', body: null, deps: deps() });
  assert.equal(none.status, 400);
});

test('remove: pone avatar_url a null y borra el archivo; sin foto no falla', async () => {
  const d = deps();
  const res = await handleAvatarRequest({ userId: 'u1', body: { action: 'remove' }, deps: d });
  assert.equal(res.status, 200);
  assert.deepEqual(d.calls, ['setUrl:null', 'removePublic:u1/old.jpg']);

  const none = deps({ currentAvatarPath: async () => null });
  const again = await handleAvatarRequest({ userId: 'u1', body: { action: 'remove' }, deps: none });
  assert.equal(again.status, 200);
  assert.deepEqual(none.calls, ['setUrl:null']);
});
