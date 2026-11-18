import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

test('storage solo permite firmar fotos de proyectos publicados y visibles', async () => {
  const db = new PGlite();
  const migrationDir = new URL('./migrations/', import.meta.url);
  const owner = '00000000-0000-4000-8000-000000000001';
  const reader = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (file.endsWith('_profile_projects.sql')) {
        await db.exec(`create schema storage; create table storage.objects(bucket_id text,name text);
          alter table storage.objects enable row level security;
          grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;`);
      }
      await db.exec(readFileSync(new URL(file, migrationDir), 'utf8'));
    }
    for (const id of [owner, reader]) {
      await db.query('insert into auth.users(id) values ($1)', [id]);
      await db.query(
        `insert into public.profiles (id,name,age,location,timezone,avatar_initials,specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
        values ($1,'Ana',30,'Madrid','Europe/Madrid','A',array['dev']::public.specialty[],'par','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado')`,
        [id]
      );
    }
    const paths = ['project-cover.jpg', 'project-extra.jpg', 'project-unpublished.jpg'].map(
      (name) => owner + '/' + name
    );
    for (const path of paths)
      await db.query("insert into storage.objects values ('board',$1)", [path]);
    await db.query(
      "insert into public.profile_projects(owner_id,name,tagline,cover_path,photo_paths) values ($1,'Mapa','Rutas',$2,array[$3]::text[])",
      [owner, paths[0], paths[1]]
    );
    async function visible(user) {
      await db.exec(
        `reset role; create or replace function auth.uid() returns uuid language sql as $$ select '${user}'::uuid $$; set role authenticated;`
      );
      const { rows } = await db.query('select name from storage.objects order by name');
      await db.exec('reset role');
      return rows.map((row) => row.name);
    }
    assert.deepEqual(await visible(reader), paths.slice(0, 2));
    for (const [a, b] of [
      [reader, owner],
      [owner, reader],
    ]) {
      await db.query('insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)', [
        a,
        b,
      ]);
      assert.deepEqual(await visible(reader), []);
      assert.deepEqual(await visible(owner), paths.slice(0, 2));
      await db.exec('delete from public.user_blocks');
    }
    await db.query('delete from auth.users where id=$1', [owner]);
    assert.equal((await db.query('select * from public.profile_projects')).rows.length, 0);
    assert.deepEqual(await visible(reader), []);
  } finally {
    await db.close();
  }
});
