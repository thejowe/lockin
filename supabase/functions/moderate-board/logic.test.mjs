import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BoardFullError,
  MAX_POSTS,
  boardVerdict,
  cleanCaption,
  handleBoardRequest,
} from './logic.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const CLEAN = {
  flagged: false,
  scores: { sexual: 0.01, 'sexual/minors': 0, 'violence/graphic': 0.01 },
};

function deps(over = {}) {
  const calls = [];
  return {
    calls,
    countPosts: async () => 0,
    downloadPending: async () => JPEG,
    moderate: async (_bytes, caption) => {
      calls.push(`moderate:${caption}`);
      return CLEAN;
    },
    publish: async (uid) => {
      calls.push('publish');
      return { path: `${uid}/b1.jpg` };
    },
    insertPost: async (uid, path, caption) => {
      calls.push(`insert:${path}:${caption}`);
      return { id: 'post-1', ownerId: uid, imagePath: path, caption };
    },
    findPost: async (id) =>
      id === 'post-1' ? { id, ownerId: 'u1', imagePath: 'u1/b1.jpg' } : null,
    deletePost: async (id) => calls.push(`delete:${id}`),
    removePublic: async (p) => calls.push(`removePublic:${p}`),
    removePending: async (p) => calls.push(`removePending:${p}`),
    ...over,
  };
}

const run = (body, d, userId = 'u1') => handleBoardRequest({ userId, body, deps: d });
const add = (over = {}) => ({
  action: 'add',
  path: 'u1/p.jpg',
  caption: '  Mi prototipo ',
  ...over,
});

test('publica foto y pie limpios, moderados juntos, y borra el pendiente', async () => {
  const d = deps();
  const result = await run(add(), d);
  assert.equal(result.status, 200);
  assert.equal(result.body.post.caption, 'Mi prototipo');
  assert.deepEqual(d.calls, [
    'moderate:Mi prototipo',
    'publish',
    'insert:u1/b1.jpg:Mi prototipo',
    'removePending:u1/p.jpg',
  ]);
});

test('una ruta ajena no se toca: 403 y sin borrar el pendiente de otro', async () => {
  const d = deps();
  const result = await run(add({ path: 'u2/p.jpg' }), d);
  assert.equal(result.status, 403);
  assert.deepEqual(d.calls, []);
});

test('lleno: no modera ni publica más allá del tope', async () => {
  const d = deps({ countPosts: async () => MAX_POSTS });
  const result = await run(add(), d);
  assert.deepEqual(result, { status: 409, body: { error: 'board-full' } });
  assert.ok(!d.calls.includes('publish'));
});

test('un pie demasiado largo o que no es texto se rechaza', async () => {
  assert.equal((await run(add({ caption: 'x'.repeat(281) }), deps())).status, 422);
  assert.equal((await run(add({ caption: 42 }), deps())).status, 422);
  assert.equal(cleanCaption(undefined), '');
});

test('lo que no es JPEG no llega a moderarse', async () => {
  const d = deps({ downloadPending: async () => PNG });
  assert.equal((await run(add(), d)).body.error, 'invalid-image');
  assert.ok(!d.calls.some((c) => c.startsWith('moderate')));
});

test('marcado por la moderación: 422 y nada publicado', async () => {
  const d = deps({ moderate: async () => ({ ...CLEAN, flagged: true }) });
  const result = await run(add(), d);
  assert.deepEqual(result, { status: 422, body: { error: 'flagged' } });
  assert.ok(!d.calls.includes('publish'));
});

test('sin moderación disponible falla cerrado', async () => {
  const d = deps({
    moderate: async () => {
      throw new Error('caído');
    },
  });
  assert.equal((await run(add(), d)).status, 503);
  const half = deps({ moderate: async () => ({ flagged: false, scores: {} }) });
  assert.equal((await run(add(), half)).status, 503);
});

test('si la fila no se inserta, la foto publicada se retira', async () => {
  const d = deps({
    insertPost: async () => {
      throw new Error('db');
    },
  });
  assert.equal((await run(add(), d)).status, 503);
  assert.ok(d.calls.includes('removePublic:u1/b1.jpg'));
});

test('quitar: solo el dueño, primero el archivo y después la fila', async () => {
  const d = deps();
  const result = await run({ action: 'remove', postId: 'post-1' }, d);
  assert.equal(result.status, 200);
  assert.deepEqual(d.calls, ['removePublic:u1/b1.jpg', 'delete:post-1']);

  const other = deps();
  assert.equal((await run({ action: 'remove', postId: 'post-1' }, other, 'u2')).status, 404);
  assert.deepEqual(other.calls, []);
});

test('si Storage no borra el archivo, la fila se queda para reintentar', async () => {
  const d = deps({
    removePublic: async () => {
      throw new Error('storage');
    },
  });
  assert.equal((await run({ action: 'remove', postId: 'post-1' }, d)).status, 503);
  assert.ok(!d.calls.includes('delete:post-1'));
});

test('quitar todo: archivo y fila de cada foto propia', async () => {
  const d = deps({
    listOwnPosts: async () => [
      { id: 'a', ownerId: 'u1', imagePath: 'u1/a.jpg' },
      { id: 'b', ownerId: 'u1', imagePath: 'u1/b.jpg' },
    ],
  });
  const result = await run({ action: 'remove-all' }, d);
  assert.deepEqual(result, { status: 200, body: { removed: 2 } });
  assert.deepEqual(d.calls, [
    'removePublic:u1/a.jpg',
    'delete:a',
    'removePublic:u1/b.jpg',
    'delete:b',
  ]);
});

test('si la base dice lleno (carrera), 409 y la foto publicada se retira', async () => {
  const d = deps({
    insertPost: async () => {
      throw new BoardFullError('board-full');
    },
  });
  assert.deepEqual(await run(add(), d), { status: 409, body: { error: 'board-full' } });
  assert.ok(d.calls.includes('removePublic:u1/b1.jpg'));
});

test('con texto, una puntuación diminuta en sexual/minors no tumba la foto', () => {
  const tiny = { flagged: false, scores: { ...CLEAN.scores, 'sexual/minors': 1e-7 } };
  assert.equal(boardVerdict(tiny), true);
  assert.equal(boardVerdict({ ...tiny, scores: { ...tiny.scores, 'sexual/minors': 0.2 } }), false);
  assert.equal(boardVerdict({ ...CLEAN, flagged: true }), false);
});

test('una acción desconocida es 400', async () => {
  assert.equal((await run({ action: 'borrar-todo' }, deps())).status, 400);
});
