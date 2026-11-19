import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const migrations = new URL('./migrations/', import.meta.url);
const actorA = '00000000-0000-4000-8000-000000000001';
const actorB = '00000000-0000-4000-8000-000000000002';
const reader = '00000000-0000-4000-8000-000000000003';
const match = randomUUID();
const project = randomUUID();
const cover = 'shared/' + project + '/project-cover.jpg';
const card = {
  name: 'Atlas',
  tagline: 'Un mapa',
  description: '',
  link: '',
  cover_path: cover,
  photo_paths: [],
};
const storageFixture = `create schema storage;
  create table storage.objects(bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select on storage.objects to authenticated;
  create function storage.allow_only_operation(op text) returns boolean language sql stable as
  $$select current_setting('storage.test_operation',true) = op$$;`;

test('joint project membership, moderation, consent, visibility and lifecycle', async (t) => {
  const db = new PGlite();
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const admin = () => db.exec('reset role');
  const as = async (actor) => {
    await admin();
    await db.query("select set_config('test.actor',$1,false)", [actor]);
    await db.exec('set role authenticated');
  };
  const service = async () => {
    await admin();
    await db.exec('set role service_role');
  };
  const createProfile = async (id) => {
    await db.query('insert into auth.users(id) values($1)', [id]);
    await db.query(
      `insert into public.profiles(id,name,age,location,timezone,avatar_initials,specialties,looking_for,
      starting_point,availability_hours_per_week,availability_bands,ambition)
      values($1,'A',30,'Madrid','Europe/Madrid','A',array['dev']::public.specialty[],'par',
      'solo-ganas',10,array['tarde']::public.time_band[],'equilibrado')`,
      [id]
    );
  };
  const createMatch = () =>
    db.query("insert into public.matches(id,profile_a,profile_b,mode) values($1,$2,$3,'par')", [
      match,
      actorA,
      actorB,
    ]);
  const commit = (actor, rev = null, action = 'save', values = card, id = project) =>
    db.query('select public.commit_moderated_project($1,$2,$3,$4,$5,$6)', [
      actor,
      id,
      rev,
      rev ? null : match,
      action,
      values,
    ]);
  const workspace = () => rows('select * from public.project_workspace($1)', [match]);
  const content = () => rows('select * from public.profile_projects where id=$1', [project]);
  const revision = async () => (await content())[0].revision;
  const authors = () =>
    rows('select user_id from public.project_authors where project_id=$1 order by user_id', [
      project,
    ]);
  const publish = async (action, rev) =>
    db.query('select public.set_project_publication($1,$2,$3)', [
      project,
      rev ?? (await revision()),
      action,
    ]);
  const downloaded = async (operation = 'object.get_authenticated') => {
    await db.query("select set_config('storage.test_operation',$1,false)", [operation]);
    return (await rows('select name from storage.objects')).map((r) => r.name);
  };
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (file.endsWith('_profile_projects.sql')) await db.exec(storageFixture);
      if (file.endsWith('_joint_projects.sql')) {
        for (const id of [actorA, actorB, reader]) await createProfile(id);
        await db.query(
          "insert into public.profile_projects(owner_id,name,tagline) values($1,'Histórico','Personal')",
          [actorB]
        );
      }
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    await db.exec(
      "create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$"
    );
    await createMatch();
    await db.query("insert into storage.objects values('board',$1)", [cover]);
    await t.test('backfill, two equal authors, one private project per active match', async () => {
      await as(reader);
      assert.deepEqual(await rows('select user_id from public.project_authors'), [
        { user_id: actorB },
      ]);
      await assert.rejects(commit(reader), { code: '42501' });
      await service();
      await assert.rejects(commit(reader), { code: '42501' });
      await commit(actorA);
      await assert.rejects(
        commit(actorB, null, 'save', { ...card, cover_path: null }, randomUUID()),
        { code: '23505' }
      );
      for (const actor of [actorA, actorB]) {
        await as(actor);
        assert.deepEqual(await authors(), [{ user_id: actorA }, { user_id: actorB }]);
        const [state] = await workspace();
        assert.equal(state.published, false);
        assert.equal(state.project_revision, await revision());
        assert.deepEqual(await downloaded(), [cover]);
        assert.deepEqual(await downloaded('object.sign_many'), []);
        await assert.rejects(db.query('update public.profile_projects set published=true'), {
          code: '42501',
        });
        await assert.rejects(db.query('delete from public.project_authors'), { code: '42501' });
      }
      await as(reader);
      assert.deepEqual(await content(), []);
      assert.deepEqual(await authors(), []);
      assert.deepEqual(await workspace(), []);
      assert.deepEqual(await downloaded(), []);
      assert.deepEqual(await rows('select * from public.project_events'), []);
    });
    await t.test('notes keep a separate private revision and last editor', async () => {
      await as(actorB);
      const rev = (await workspace())[0].notes_revision;
      const save = (text) =>
        db.query('select public.save_project_notes($1,$2,$3)', [project, text, rev]);
      await save('decisión privada');
      await as(actorA);
      assert.equal((await workspace())[0].notes_by, actorB);
      await assert.rejects(save('stale'), { code: 'PJ409' });
      await as(reader);
      await assert.rejects(save('ajeno'), { code: '42501' });
    });
    await t.test(
      'reject, edit while proposed, retry and double consent with both caps',
      async () => {
        await as(actorA);
        await publish('propose');
        await assert.rejects(publish('accept'), { code: '42501' });
        const pending = await revision();
        await as(reader);
        await assert.rejects(publish('accept', pending), { code: '42501' });
        await as(actorB);
        await publish('reject');
        await publish('propose');
        const before = await revision();
        await service();
        await commit(actorA, before, 'save', { ...card, name: 'Mapa actualizado' });
        await as(actorA);
        await assert.rejects(publish('accept', before), { code: 'PJ409' });
        assert.equal((await workspace())[0].proposed_by, null);
        await publish('propose');
        await admin();
        await db.query(
          "insert into public.profile_projects(owner_id,name,tagline) select $1,'Personal','Idea' from generate_series(1,2)",
          [actorB]
        );
        await as(actorB);
        assert.equal((await workspace())[0].has_capacity, false);
        await assert.rejects(publish('accept'), { code: 'PJ003' });
        await admin();
        await db.query(
          "delete from public.profile_projects where id=(select id from public.profile_projects where name='Personal' limit 1)"
        );
        await as(actorB);
        await publish('accept');
        await admin();
        await assert.rejects(
          db.query(
            "insert into public.profile_projects(owner_id,name,tagline) values($1,'Personal','Idea')",
            [actorB]
          ),
          { code: 'PJ003' }
        );
        await as(reader);
        assert.equal((await content())[0].published, true);
        assert.deepEqual(await authors(), [{ user_id: actorA }, { user_id: actorB }]);
        assert.deepEqual(await workspace(), []);
        assert.deepEqual(await rows('select * from public.project_workspaces'), []);
        assert.deepEqual(await downloaded(), [cover]);
        assert.deepEqual(await downloaded('object.sign'), []);
        await as(actorA);
        await publish('private');
        await as(reader);
        assert.deepEqual(await downloaded(), []);
        assert.deepEqual(await content(), []);
      }
    );
    await t.test('either author may delete; partner sees deletion, can create again', async () => {
      await as(actorB);
      const rev = await revision();
      await service();
      await assert.rejects(commit(reader, rev, 'remove'), { code: '42501' });
      await commit(actorB, rev, 'remove');
      await as(actorA);
      assert.deepEqual(await workspace(), []);
      assert.deepEqual(
        await rows("select actor_id from public.project_events where kind='deleted'"),
        [{ actor_id: actorB }]
      );
      await service();
      await commit(actorB);
    });
    await t.test(
      'block, account deletion and unmatch revoke publication and detach departing author',
      async () => {
        for (const event of ['block', 'delete-account', 'unmatch']) {
          await as(actorA);
          await publish('propose');
          await as(actorB);
          await publish('accept');
          if (event === 'block') {
            await db.query('select public.block_profile($1)', [actorA]);
          } else if (event === 'delete-account') {
            await admin();
            await db.query('delete from auth.users where id=$1', [actorB]);
          } else {
            await admin();
            await db.query(
              "insert into public.decisions(actor_id,target_id,decision) values($1,$2,'like')",
              [actorB, actorA]
            );
            await as(reader);
            await assert.rejects(db.query('select public.leave_project_match($1)', [match]), {
              code: '42501',
            });
            await as(actorB);
            await db.query('select public.leave_project_match($1)', [match]);
            assert.deepEqual(
              await rows('select decision from public.decisions where target_id=$1', [actorA]),
              [{ decision: 'pass' }]
            );
          }
          await as(actorB);
          assert.deepEqual(await content(), []);
          assert.deepEqual(await workspace(), []);
          await as(actorA);
          assert.deepEqual(await authors(), [{ user_id: actorA }]);
          assert.equal((await content())[0].owner_id, actorA);
          assert.equal((await content())[0].published, false);
          assert.deepEqual(await workspace(), []);
          assert.deepEqual(await downloaded(), [cover]);
          await as(reader);
          assert.deepEqual(await content(), []);
          if (event === 'unmatch') break;
          await admin();
          await db.query('delete from public.profile_projects where id=$1', [project]);
          if (event === 'block') {
            await db.exec('delete from public.user_blocks');
          } else {
            await createProfile(actorB);
            await createMatch();
          }
          await service();
          await commit(actorB);
        }
      }
    );
    await t.test('storage installations without operation-aware policies fail closed', async () => {
      await admin();
      await db.exec('drop function storage.allow_only_operation(text)');
      await as(actorA);
      assert.equal((await content()).length, 1);
      assert.deepEqual(await downloaded(), []);
      assert.deepEqual(await downloaded('object.sign'), []);
    });
  } finally {
    await db.close();
  }
});
