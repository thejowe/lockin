import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProject } from './logic.mjs';

const clean = { flagged: false, scores: { sexual: 0, 'sexual/minors': 0, 'violence/graphic': 0 } };
function fixture() {
  const stored = [],
    discarded = [];
  const deps = {
    objectionable: () => false,
    find: async () => null,
    download: async () => Uint8Array.of(255, 216, 255),
    moderate: async () => clean,
    upload: async () => 'me/project-' + ++deps.seq + '.jpg',
    seq: 0,
    save: async (_, __, value) => {
      stored.push(value);
      return 'saved';
    },
    cleanPending: async () => {},
    discard: async (paths) => discarded.push(...paths),
  };
  const body = {
    action: 'save',
    name: 'Atlas',
    tagline: 'Cartografía',
    description: '',
    link: '',
    images: [{ pending: 'me/1.jpg' }, { pending: 'me/2.jpg' }],
  };
  return { deps, body, stored, discarded };
}
test('cover and gallery commit together, after both reviews', async () => {
  const { deps, body, stored } = fixture();
  assert.equal((await handleProject('me', body, deps)).status, 200);
  assert.deepEqual(stored[0].photo_paths, ['me/project-2.jpg']);
});
for (const [name, result] of [
  ['rejected', { ...clean, flagged: true }],
  ['incomplete', {}],
  ['offline', null],
]) {
  test(name + ' on second image keeps entire draft unpublished', async () => {
    const { deps, body, stored, discarded } = fixture();
    deps.moderate = async () => {
      if (!deps.seq) return clean;
      if (!result) throw Error();
      return result;
    };
    const reply = await handleProject('me', body, deps);
    assert.equal(reply.body.slot, 1);
    assert.deepEqual(stored, []);
    assert.deepEqual(discarded, ['me/project-1.jpg']);
  });
}
test('foreign uploads, invented existing images and stale revisions cannot be published', async () => {
  for (const change of [
    { images: [{ pending: 'other/a.jpg' }] },
    { images: [{ keep: 'me/old.jpg' }] },
    { previous: { id: 'other', revision: 'stale' } },
  ]) {
    const { deps, body, stored } = fixture();
    assert.ok((await handleProject('me', { ...body, ...change }, deps)).status >= 400);
    assert.deepEqual(stored, []);
  }
});
