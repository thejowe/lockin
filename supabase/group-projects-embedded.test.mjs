import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const migrations = new URL('./migrations/', import.meta.url);
const [founder, peer, seeker, outsider] = Array.from({ length: 4 }, () => randomUUID());
const project = randomUUID();
const cover = 'shared/' + project + '/project-portada.jpg';
const gallery = 'shared/' + project + '/project-equipo.jpg';
const group = {
  name: 'Taller',
  description: 'Un grupo para el taller.',
  roles: [{ specialty: 'dev', slots: 2 }],
};
const card = {
  name: 'Atlas',
  tagline: 'Un mapa',
  description: '',
  link: '',
  cover_path: cover,
  photo_paths: [gallery],
};

test('moderated group project and author lifecycle', async (t) => {
  const db = new PGlite();
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const admin = () => db.exec('reset role');
  const service = async () => {
    await admin();
    await db.exec('set role service_role');
  };
  const as = async (actor) => {
    await admin();
    await db.query("select set_config('test.actor',$1,false)", [actor]);
    await db.exec('set role authenticated');
  };
  const read = () => rows('select * from public.profile_projects where id=$1', [project]);
  const authors = async () =>
    (await rows('select user_id from public.project_authors where project_id=$1', [project]))
      .map((r) => r.user_id)
      .sort();
  const create = (actor = founder, input = group, values = card, id = project) =>
    rows('select public.create_moderated_group_project($1,$2,$3,$4) as created', [
      actor,
      id,
      input,
      values,
    ]);
  const edit = (actor, revision, action = 'save', name = 'Atlas nuevo') =>
    rows('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
      actor,
      project,
      revision,
      action,
      { ...card, name },
    ]);
  const files = async (operation = 'object.get_authenticated') => {
    await db.query("select set_config('storage.test_operation',$1,false)", [operation]);
    return (await rows('select name from storage.objects order by name')).map((r) => r.name);
  };
  const task = randomUUID();
  let team, legacyTeam, role, revision;
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (file.endsWith('_profile_projects.sql')) {
        await db.exec(`create schema storage;
          create table storage.objects(bucket_id text,name text);
          alter table storage.objects enable row level security;
          grant usage on schema storage to authenticated;
          grant select on storage.objects to authenticated;
          create function storage.allow_only_operation(op text) returns boolean language sql stable as
          $$select current_setting('storage.test_operation',true) = op$$;`);
      }
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    await db.exec(
      "create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$"
    );
    for (const id of [founder, peer, seeker, outsider]) {
      await db.query('insert into auth.users(id) values($1)', [id]);
      await db.query(
        `insert into public.profiles(id,name,age,location,timezone,avatar_initials,
        specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
        values($1,'Persona',28,'Madrid','Europe/Madrid','P',array[$2]::public.specialty[],
        'par','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado')`,
        [id, id === outsider ? 'legal' : 'dev']
      );
    }
    await db.query("insert into storage.objects values('board',$1),('board',$2)", [cover, gallery]);

    await t.test('legacy creation and atomic moderation, with stable retry id', async () => {
      await as(outsider);
      const [legacy] = await rows('select * from public.create_group($1,$2,$3,6)', [
        group.name,
        group.description,
        group.roles,
      ]);
      legacyTeam = legacy.id;
      assert.equal(legacy.project_id, null);
      await assert.rejects(create(), { code: '42501' });
      await assert.rejects(rows('update public.groups set project_id=$1', [project]), {
        code: '42501',
      });
      await service();
      await assert.rejects(create(founder, { ...group, roles: [] }), { code: 'LG001' });
      await assert.rejects(
        create(founder, group, { ...card, cover_path: 'foreign/project-stolen.jpg' })
      );
      await as(founder);
      assert.deepEqual(await rows('select * from public.groups'), []);
      await service();
      assert.deepEqual(await create(), [{ created: true }]);
      assert.deepEqual(await create(), [{ created: false }]);
      await assert.rejects(
        create(founder, group, { ...card, cover_path: null, photo_paths: [] }, randomUUID()),
        { code: 'LG006' }
      );
      await as(founder);
      const [created] = await rows('select * from public.groups');
      assert.equal(created.project_id, project);
      team = created.id;
      role = (await rows('select id from public.group_roles where group_id=$1', [team]))[0].id;
      assert.deepEqual(await authors(), [founder]);
      const [p] = await read();
      assert.equal(p.joint, true);
      assert.equal(p.published, false);
      revision = p.revision;
      await assert.rejects(
        rows('insert into public.project_authors values ($1,$2)', [project, peer]),
        { code: '42501' }
      );
    });

    await t.test(
      'candidate can read the card and authenticated media with the same eligibility as the deck',
      async () => {
        await as(seeker);
        assert.equal((await read())[0].name, card.name);
        assert.deepEqual(await authors(), [founder]);
        assert.deepEqual(await files(), [cover, gallery].sort());
        assert.deepEqual(await files('object.sign'), []);
        assert.deepEqual(await rows('select id from public.profile_projects where published'), []);
        assert.deepEqual(await rows('select * from public.groups'), []);
        await as(outsider);
        assert.deepEqual(await read(), []);
        assert.deepEqual(await files(), []);
        await as(seeker);
        await db.query("select public.swipe_group($1,'pass')", [team]);
        assert.deepEqual(await read(), []);
        await admin();
        await db.query(
          'update public.group_swipes set created_at=now()-public.pass_cooldown() where group_id=$1 and user_id=$2',
          [team, seeker]
        );
        await as(seeker);
        assert.equal((await read()).length, 1);
        await as(founder);
        await db.query('select public.block_profile($1)', [seeker]);
        await as(seeker);
        assert.deepEqual(await read(), []);
        assert.deepEqual(await authors(), []);
        assert.deepEqual(await files(), []);
      }
    );

    const join = async () => {
      await as(peer);
      await db.query("select public.swipe_group($1,'like')", [team]);
      await as(founder);
      await db.query("select public.swipe_group_candidate($1,$2,'like')", [peer, role]);
    };
    await t.test(
      'membership, admin edits, optimistic revisions and removal permissions',
      async () => {
        await join();
        await as(peer);
        assert.deepEqual(await authors(), [peer, founder].sort());
        const addTask = (id, groupId, assignee, startsAt = null) =>
          db.query(
            `insert into public.chat_plan_items(id,group_id,title,assignee_id,status,due_at,starts_at)
          values($1,$2,'Boceto',$3,'in_progress',now()+interval '1 day',$4)`,
            [id, groupId, assignee, startsAt]
          );
        await addTask(task, team, peer);
        await assert.rejects(addTask(randomUUID(), team, outsider), { code: '23514' });
        await assert.rejects(addTask(randomUUID(), team, peer, '2099-01-01T08:00:00Z'), {
          code: '23514',
        });
        await as(outsider);
        await assert.rejects(addTask(randomUUID(), legacyTeam, null), { code: '23514' });
        assert.deepEqual(
          await rows('select id from public.chat_plan_items where id=$1', [task]),
          []
        );
        await as(founder);
        await db.query("update public.chat_plan_items set status='done' where id=$1", [task]);
        await as(peer);
        const [closed] = await rows(
          'select closed,due_at from public.chat_plan_items where id=$1',
          [task]
        );
        assert.equal(closed.closed, true);
        assert.ok(closed.due_at);
        await assert.rejects(
          rows("select public.set_project_publication($1,$2,'propose')", [project, revision]),
          { code: '42501' }
        );
        await service();
        await assert.rejects(edit(peer, revision), { code: '42501' });
        for (const action of ['remove', 'promote'])
          await assert.rejects(edit(founder, revision, action), { code: '42501' });
        await edit(founder, revision);
        await assert.rejects(edit(founder, revision), { code: 'PJ409' });
        await as(peer);
        assert.equal((await read())[0].name, 'Atlas nuevo');
        await as(founder);
        await db.query('select public.kick_group_member($1)', [peer]);
        assert.deepEqual(await authors(), [founder]);
        assert.deepEqual(
          await rows('select assignee_id,status from public.chat_plan_items where id=$1', [task]),
          [{ assignee_id: null, status: 'done' }]
        );
        await as(peer);
        assert.deepEqual(await read(), []);
      }
    );

    await t.test(
      'leaving removes authors, deleting the admin transfers ownership and disbanding retires the gallery',
      async () => {
        // New mutual decisions after the group has made the candidate available again.
        await admin();
        await db.query('delete from public.group_swipes where user_id=$1', [peer]);
        await join();
        await as(peer);
        await db.query('select public.leave_group($1)', [team]);
        await as(founder);
        assert.deepEqual(await authors(), [founder]);
        await admin();
        await db.query('delete from public.group_swipes where user_id=$1', [peer]);
        await join();
        await admin();
        await db.query('delete from auth.users where id=$1', [founder]);
        await as(peer);
        const [p] = await read();
        assert.equal(p.owner_id, peer);
        assert.deepEqual(await authors(), [peer]);
        await service();
        await edit(peer, p.revision);
        await as(peer);
        await db.query('select public.leave_group($1)', [team]);
        assert.deepEqual(await read(), []);
        assert.deepEqual(await authors(), []);
        assert.deepEqual(await files(), []);
        await assert.rejects(rows('select * from public.retired_group_project_media()'), {
          code: '42501',
        });
        await service();
        const retired = await rows('select * from public.retired_group_project_media()');
        assert.deepEqual(
          retired.map((row) => row.path),
          [cover, gallery].sort()
        );
        assert.deepEqual(
          await rows('select * from public.retired_group_project_media($1)', [[cover, gallery]]),
          []
        );
      }
    );
  } finally {
    await db.close();
  }
});
