import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanRetiredProjectMedia } from './retired-project-media.mjs';

test('una caída de Storage conserva el lote hasta el siguiente borrado confirmado', async () => {
  let queue = [{ path: 'shared/project/photo.jpg' }];
  let available = false;
  const calls = [];
  const admin = {
    async rpc(name, args) {
      assert.equal(name, 'retired_group_project_media');
      if (args.p_removed) queue = queue.filter(({ path }) => !args.p_removed.includes(path));
      return { data: queue };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'board');
        return {
          async remove(paths) {
            calls.push(paths);
            return { error: available ? null : new Error('Storage unavailable') };
          },
        };
      },
    },
  };
  await assert.rejects(cleanRetiredProjectMedia(admin), /Storage unavailable/);
  available = true;
  assert.equal(await cleanRetiredProjectMedia(admin), 1);
  assert.equal(await cleanRetiredProjectMedia(admin), 0);
  assert.deepEqual(calls, [['shared/project/photo.jpg'], ['shared/project/photo.jpg']]);
});
