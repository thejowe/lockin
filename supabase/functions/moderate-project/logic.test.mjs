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

test('the whole group waits for moderation, uses shared keys, and cleans a replayed upload', async () => {
  const group = {
    name: 'Taller',
    description: 'Un grupo de prueba',
    roles: [{ specialty: 'dev', slots: 1 }],
  };
  for (const mode of ['saved', 'replayed', 'flagged', 'LG006']) {
    const { deps, body, discarded } = fixture();
    const scopes = [];
    let commits = 0;
    deps.upload = async (_, __, shared) => {
      scopes.push(shared);
      return 'shared/draft/project-new.jpg';
    };
    deps.moderate = async () => (mode === 'flagged' ? { ...clean, flagged: true } : clean);
    deps.save = async () => {
      commits++;
      return mode;
    };
    const reply = await handleProject(
      'me',
      {
        ...body,
        group,
        draftId: 'draft',
        images: [{ pending: 'me/cover.jpg' }],
      },
      deps
    );
    assert.equal(commits, mode === 'flagged' ? 0 : 1);
    assert.deepEqual(scopes, mode === 'flagged' ? [] : [true]);
    assert.equal(reply.status, mode === 'flagged' ? 422 : mode === 'LG006' ? 409 : 200);
    if (mode === 'LG006') assert.equal(reply.body.error, 'LG006');
    assert.deepEqual(
      discarded,
      mode === 'replayed' || mode === 'LG006' ? ['shared/draft/project-new.jpg'] : []
    );
  }
});

test('group creation is exclusive to a new, stable project draft', async () => {
  for (const change of [
    { previous: { id: 'foreign' } },
    { matchId: 'match' },
    { action: 'remove-all' },
    { draftId: null },
  ]) {
    const { deps, body, stored } = fixture();
    const reply = await handleProject(
      'me',
      { ...body, group: {}, draftId: 'draft', ...change },
      deps
    );
    assert.equal(reply.status, 400);
    assert.deepEqual(stored, []);
  }
});

test('with the photo switch off the save is refused and its new uploads are discarded', async () => {
  const { deps, body, discarded } = fixture();
  deps.save = async () => 'photos-locked';
  const reply = await handleProject('me', body, deps);
  assert.equal(reply.status, 409);
  assert.equal(reply.body.error, 'photos-locked');
  assert.deepEqual(discarded, ['me/project-1.jpg', 'me/project-2.jpg']);
});

test('a group with photos is refused before any moderation while the switch is off', async () => {
  const { deps, body } = fixture();
  let moderated = 0;
  deps.moderate = async () => {
    moderated++;
    return clean;
  };
  deps.sharedPhotosEnabled = async () => false;
  const reply = await handleProject(
    'me',
    { ...body, draftId: 'draft', group: { name: 'Equipo' } },
    deps
  );
  assert.equal(reply.status, 409);
  assert.equal(reply.body.error, 'photos-locked');
  assert.equal(moderated, 0);
});

test('a joint project from a match is refused with photos while the switch is off', async () => {
  const { deps, body } = fixture();
  deps.sharedPhotosEnabled = async () => false;
  const reply = await handleProject('me', { ...body, matchId: 'match' }, deps);
  assert.equal(reply.body.error, 'photos-locked');
  deps.sharedPhotosEnabled = async () => true;
  assert.equal((await handleProject('me', { ...body, matchId: 'match' }, deps)).status, 200);
});
