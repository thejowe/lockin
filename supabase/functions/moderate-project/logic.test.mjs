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

test('coauthor edits can retain an approved gallery while new images use shared storage', async () => {
  const { deps, body, stored } = fixture();
  const cover = 'shared/project/project-original.jpg';
  const old = { id: 'project', revision: 'r1', joint: true, cover_path: cover, photo_paths: [] };
  const scopes = [];
  deps.find = async () => old;
  deps.upload = async (user, bytes, joint) => {
    scopes.push({ user, joint });
    return 'shared/project/project-extra.jpg';
  };
  const reply = await handleProject(
    'peer',
    {
      ...body,
      previous: { id: old.id, revision: old.revision },
      images: [{ keep: cover }, { pending: 'peer/new.jpg' }],
    },
    deps
  );
  assert.equal(reply.status, 200);
  assert.deepEqual(scopes, [{ user: 'peer', joint: true }]);
  assert.equal(stored[0].cover_path, cover);
  assert.deepEqual(stored[0].photo_paths, ['shared/project/project-extra.jpg']);
});

test('a lost edit race discards only newly staged shared files', async () => {
  const { deps, body, discarded } = fixture();
  const cover = 'shared/project/project-original.jpg';
  deps.find = async () => ({
    id: 'project',
    revision: 'r1',
    joint: true,
    cover_path: cover,
    photo_paths: [],
  });
  deps.save = async () => 'conflict';
  const reply = await handleProject(
    'me',
    {
      ...body,
      previous: { id: 'project', revision: 'r1' },
      images: [{ keep: cover }, { pending: 'me/1.jpg' }],
    },
    deps
  );
  assert.equal(reply.status, 409);
  assert.deepEqual(discarded, ['me/project-1.jpg']);
});
