import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAvatarRequest, isComplete, isJpeg, ownsPath, verdict } from './logic.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
const OLD_PATH = 'u1/old.jpg';
const NEW_PATH = 'u1/n.jpg';

/** Una respuesta completa y limpia del proveedor. */
const CLEAN = {
  flagged: false,
  scores: { sexual: 0.01, 'sexual/minors': 0, 'violence/graphic': 0.01 },
};

function deps(over = {}) {
  const calls = [];
  return {
    calls,
    downloadPending: async () => JPEG,
    moderate: async () => CLEAN,
    publish: async (uid) => {
      calls.push('publish');
      return { path: `${uid}/n.jpg` };
    },
    currentAvatar: async () => ({ path: OLD_PATH }),
    setAvatarPath: async (_uid, path, expected) => {
      calls.push(`setPath:${path}:${expected === undefined ? 'any' : expected}`);
      return true;
    },
    removePublic: async (p) => calls.push(`removePublic:${p}`),
    removePending: async (p) => calls.push(`removePending:${p}`),
    removeAllPending: async (uid) => calls.push(`removeAllPending:${uid}`),
    ...over,
  };
}

const set = (path = 'u1/p.jpg') => ({ action: 'set', path });
const run = (body, d) => handleAvatarRequest({ userId: 'u1', body, deps: d });

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
  assert.equal(verdict(CLEAN), true);
  assert.equal(verdict({ ...CLEAN, flagged: true }), false);
  assert.equal(verdict({ flagged: false, scores: { ...CLEAN.scores, sexual: 0.4 } }), false);
  assert.equal(
    verdict({ flagged: false, scores: { ...CLEAN.scores, 'sexual/minors': 0.001 } }),
    false
  );
  assert.equal(
    verdict({ flagged: false, scores: { ...CLEAN.scores, 'violence/graphic': 0.5 } }),
    false
  );
});

test('isComplete exige las tres categorías con números finitos', () => {
  assert.equal(isComplete(CLEAN), true);
  assert.equal(isComplete({ flagged: false, scores: {} }), false);
  assert.equal(
    isComplete({ flagged: false, scores: { ...CLEAN.scores, sexual: undefined } }),
    false
  );
  assert.equal(isComplete({ flagged: false, scores: { ...CLEAN.scores, sexual: NaN } }), false);
  assert.equal(isComplete({ flagged: 'no', scores: CLEAN.scores }), false);
  assert.equal(isComplete(null), false);
});

test('respuesta incompleta del proveedor: 503 y nada publicado (falla cerrado)', async () => {
  const d = deps({ moderate: async () => ({ flagged: false, scores: {} }) });
  const res = await run(set(), d);

  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'unavailable');
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('set limpio: publica, apunta avatar_url con la anterior como esperada, borra la anterior y la pendiente', async () => {
  const d = deps();
  const res = await run(set(), d);

  assert.equal(res.status, 200);
  assert.equal(res.body.avatarPath, NEW_PATH);
  assert.deepEqual(d.calls, [
    'publish',
    `setPath:${NEW_PATH}:${OLD_PATH}`,
    'removePublic:u1/old.jpg',
    'removePending:u1/p.jpg',
  ]);
});

test('imagen marcada: 422 flagged, no publica y borra la pendiente', async () => {
  const d = deps({ moderate: async () => ({ ...CLEAN, flagged: true }) });
  const res = await run(set(), d);

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
  const res = await run(set(), d);

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
      return CLEAN;
    },
  });
  const res = await run(set(), d);

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'invalid-image');
  assert.equal(called, false);
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('más de 5 MB: 422 invalid-image', async () => {
  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  big.set(JPEG);
  const res = await run(set(), deps({ downloadPending: async () => big }));

  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'invalid-image');
});

test('archivo pendiente inexistente: 422 invalid-image', async () => {
  const res = await run(set(), deps({ downloadPending: async () => null }));
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
  const res = await run(set('u2/p.jpg'), d);

  assert.equal(res.status, 403);
  assert.equal(downloaded, false);
  assert.deepEqual(d.calls, []);
});

test('cuerpo desconocido o ausente: 400', async () => {
  assert.equal((await run({ action: 'hack' }, deps())).status, 400);
  assert.equal((await run(null, deps())).status, 400);
});

test('si no se puede leer la foto actual no se publica nada: 503', async () => {
  const d = deps({
    currentAvatar: async () => {
      throw new Error('db caída');
    },
  });
  const res = await run(set(), d);

  assert.equal(res.status, 503);
  assert.deepEqual(d.calls, ['removePending:u1/p.jpg']);
});

test('si apuntar avatar_url falla, retira lo publicado y la pendiente', async () => {
  const d = deps({
    setAvatarPath: async () => {
      throw new Error('db caída');
    },
  });
  const res = await run(set(), d);

  assert.equal(res.status, 503);
  assert.deepEqual(d.calls, ['publish', 'removePublic:u1/n.jpg', 'removePending:u1/p.jpg']);
});

test('dos set a la vez: el que pierde la carrera retira su publicación y responde 409', async () => {
  const d = deps({ setAvatarPath: async () => false });
  const res = await run(set(), d);

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'conflict');
  assert.deepEqual(d.calls, ['publish', 'removePublic:u1/n.jpg', 'removePending:u1/p.jpg']);
});

test('borrar la foto anterior es de mejor esfuerzo: si falla, la nueva ya está puesta', async () => {
  const d = deps({
    removePublic: async () => {
      throw new Error('storage');
    },
  });
  const res = await run(set(), d);

  assert.equal(res.status, 200);
  assert.equal(res.body.avatarPath, NEW_PATH);
});

test('remove: borra el archivo, luego pone avatar_url a null y barre las pendientes', async () => {
  const d = deps();
  const res = await run({ action: 'remove' }, d);

  assert.equal(res.status, 200);
  assert.deepEqual(d.calls, ['removePublic:u1/old.jpg', 'setPath:null:any', 'removeAllPending:u1']);
});

test('remove: si Storage rechaza el borrado no se confirma y avatar_url sigue apuntando al archivo', async () => {
  const d = deps({
    removePublic: async () => {
      throw new Error('storage');
    },
  });
  const res = await run({ action: 'remove' }, d);

  assert.equal(res.status, 503);
  assert.deepEqual(
    d.calls.filter((c) => c.startsWith('setPath')),
    []
  );
});

test('remove sin foto no falla y también barre las pendientes', async () => {
  const d = deps({ currentAvatar: async () => ({ path: null }) });
  const res = await run({ action: 'remove' }, d);

  assert.equal(res.status, 200);
  assert.deepEqual(d.calls, ['setPath:null:any', 'removeAllPending:u1']);
});

test('la pendiente se borra en todos los desenlaces con path propio', async () => {
  const cases = [
    deps(),
    deps({ moderate: async () => ({ ...CLEAN, flagged: true }) }),
    deps({
      moderate: async () => {
        throw new Error('proveedor');
      },
    }),
    deps({ moderate: async () => ({ flagged: false, scores: {} }) }),
    deps({ downloadPending: async () => null }),
    deps({
      currentAvatar: async () => {
        throw new Error('db');
      },
    }),
    deps({ setAvatarPath: async () => false }),
  ];
  for (const d of cases) {
    await run(set(), d);
    assert.ok(d.calls.includes('removePending:u1/p.jpg'), JSON.stringify(d.calls));
  }
});

test('si borrar la pendiente falla, el resultado no cambia (huérfano que purga la retención)', async () => {
  const failing = async () => {
    throw new Error('storage');
  };
  const ok = await run(set(), deps({ removePending: failing }));
  assert.equal(ok.status, 200);
  const rejected = await run(
    set(),
    deps({ removePending: failing, moderate: async () => ({ ...CLEAN, flagged: true }) })
  );
  assert.equal(rejected.status, 422);
});

test('path ajeno: no se borra nada (no es una pendiente propia)', async () => {
  const d = deps();
  await run(set('u2/p.jpg'), d);
  assert.equal(
    d.calls.some((c) => c.startsWith('removePending')),
    false
  );
});
