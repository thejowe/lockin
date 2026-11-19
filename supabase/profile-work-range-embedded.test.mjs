import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

test('jornada: migra los huecos y mantiene sincronizados los clientes antiguos y nuevos', async () => {
  const db = new PGlite();
  const dir = new URL('./migrations/', import.meta.url);
  const migration = '20261119215204_profile_work_range.sql';
  const bands = ['madrugada', 'manana', 'tarde', 'noche'];
  const range = (start_min, end_min) => ({ start_min, end_min });
  const id = (mask) => '00000000-0000-4000-8000-' + String(mask).padStart(12, '0');
  const insert = (column, cast) => `insert into public.profiles
    (id, name, age, location, timezone, avatar_initials, specialties, looking_for,
     starting_point, availability_hours_per_week, ${column}, ambition)
    values ($1,'Ana',30,'Madrid','Europe/Madrid','A','{dev}','par','solo-ganas',10,
    $2::${cast},'equilibrado')`;
  const oldInsert = insert('availability_bands', 'text[]::public.time_band[]');
  const newInsert = insert('work_ranges', 'jsonb');

  async function read(mask) {
    const { rows } = await db.query(
      'select work_ranges, availability_bands::text[] as bands from public.profiles where id=$1',
      [id(mask)]
    );
    return rows[0];
  }
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.sql') && name < migration)
      .sort()) {
      await db.exec(readFileSync(new URL(file, dir), 'utf8'));
    }

    // Un perfil por selección posible. La versión antigua guardaba el orden de pulsación.
    for (let mask = 1; mask <= 17; mask++) {
      await db.query('insert into auth.users(id) values ($1)', [id(mask)]);
      if (mask <= 15) {
        const selected = bands.filter((_, i) => mask & (1 << i));
        await db.query(oldInsert, [id(mask), selected.reverse()]);
      }
    }
    const stamps = () => db.query('select updated_at from public.profiles order by id');
    const before = await stamps();
    await db.exec(readFileSync(new URL(migration, dir), 'utf8'));
    assert.deepEqual((await stamps()).rows, before.rows);
    const touchTrigger = await db.query(
      "select tgenabled from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_touch_updated_at'"
    );
    assert.deepEqual(touchTrigger.rows, [{ tgenabled: 'O' }]);
    const migrated = [
      [range(0, 360)],
      [range(360, 720)],
      [range(0, 720)],
      [range(720, 1200)],
      [range(0, 360), range(720, 1200)],
      [range(360, 1200)],
      [range(0, 1200)],
      [range(1200, 1440)],
      [range(0, 360), range(1200, 1440)],
      [range(360, 720), range(1200, 1440)],
      [range(0, 720), range(1200, 1440)],
      [range(720, 1440)],
      [range(0, 360), range(720, 1440)],
      [range(360, 1440)],
      [range(0, 1440)],
    ];
    for (let mask = 1; mask <= 15; mask++) {
      assert.deepEqual(await read(mask), {
        work_ranges: migrated[mask - 1],
        bands: bands.filter((_, i) => mask & (1 << i)),
      });
    }

    async function actingAs(mask) {
      await db.exec(`reset role;
        create or replace function auth.uid() returns uuid language sql as $$ select '${id(mask)}'::uuid $$;
        set role authenticated`);
    }
    await actingAs(16);
    await db.query(oldInsert, [id(16), ['noche', 'manana']]);
    assert.deepEqual(await read(16), {
      work_ranges: [range(360, 720), range(1200, 1440)],
      bands: ['manana', 'noche'],
    });
    await actingAs(17);
    const exact = [range(570, 660), range(1230, 1410)];
    await db.query(newInsert, [id(17), JSON.stringify(exact)]);
    const expected = { work_ranges: exact, bands: ['manana', 'noche'] };
    assert.deepEqual(await read(17), expected);
    const update = (set, args = []) =>
      db.query(`update public.profiles set ${set} where id = '${id(17)}'`, args);
    await update("name='Ana Luz', availability_bands='{noche,manana}'");
    assert.deepEqual(await read(17), expected);
    await db.query(
      oldInsert + ' on conflict (id) do update set availability_bands=excluded.availability_bands',
      [id(17), ['noche', 'manana']]
    );
    assert.deepEqual(await read(17), expected);
    // Al recibir el formato nuevo, el servidor deriva las franjas aunque el cliente mande otras.
    await update("availability_bands='{madrugada}', work_ranges=work_ranges");
    assert.deepEqual(await read(17), expected);

    await update("availability_bands='{noche,madrugada}'");
    assert.deepEqual(await read(17), {
      work_ranges: [range(0, 360), range(1200, 1440)],
      bands: ['madrugada', 'noche'],
    });
    await db.query(
      oldInsert + ' on conflict (id) do update set availability_bands=excluded.availability_bands',
      [id(17), ['tarde', 'manana']]
    );
    assert.deepEqual(await read(17), {
      work_ranges: [range(360, 1200)],
      bands: ['manana', 'tarde'],
    });

    const adjacent = [range(660, 720), range(720, 810)];
    await db.query(newInsert + ' on conflict (id) do update set work_ranges=excluded.work_ranges', [
      id(17),
      JSON.stringify(adjacent),
    ]);
    assert.deepEqual(await read(17), { work_ranges: adjacent, bands: ['manana', 'tarde'] });
    const withinMorning = [range(360, 450), range(630, 720)];
    await update('work_ranges=$1::jsonb', [JSON.stringify(withinMorning)]);
    assert.deepEqual(await read(17), { work_ranges: withinMorning, bands: ['manana'] });
    await update('work_ranges=$1::jsonb', [JSON.stringify([range(0, 1440)])]);
    assert.deepEqual(await read(17), { work_ranges: [range(0, 1440)], bands });

    const badData = (err) => ['23514', '23502'].includes(err.code);
    for (const invalid of [
      null,
      {},
      [],
      [null],
      [{ start_min: 0 }],
      [range('0', 60)],
      [range(0, null)],
      [{ ...range(0, 60), other: true }],
      [range(0, 30)],
      [range(-30, 60)],
      [range(0, 1470)],
      [range(690.5, 810)],
      [range(600, 675)],
      [range(1200, 60)],
      [range(0, 120), range(90, 210)],
      [range(600, 900), range(0, 300)],
      [range(0, 60), range(120, 180), range(240, 300)],
    ]) {
      await assert.rejects(update('work_ranges=$1::jsonb', [JSON.stringify(invalid)]), badData);
    }
    await assert.rejects(update('work_ranges=null'), badData);
    await assert.rejects(update("availability_bands='{}'"), badData);
    await assert.rejects(update("availability_bands='{noche,noche}'"), badData);
    assert.deepEqual(await read(17), { work_ranges: [range(0, 1440)], bands });
  } finally {
    await db.close();
  }
});
