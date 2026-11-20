import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

test('los dos decks de grupos reciclan únicamente los pass explícitos', async (t) => {
  const db = new PGlite();
  const [admin, secondAdmin, buyer, dev, other] = Array.from({ length: 5 }, () => randomUUID());
  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (user) => {
    await db.exec('reset role');
    await db.query("select set_config('test.actor',$1,true)", [user]);
    await db.exec('set local role authenticated');
  };
  const group = async (actor, max = 3) => {
    await as(actor);
    const [{ id }] = await rows(
      "select (public.create_group('Equipo','Crear juntos una app',$1,$2)).id",
      [JSON.stringify([{ specialty: 'dev', slots: max - 1 }]), max]
    );
    const [{ id: role }] = await rows('select id from public.group_roles where group_id=$1', [id]);
    return { id, role };
  };
  const personDeck = async (user, limit = 30) => {
    await as(user);
    const [{ deck }] = await rows('select public.group_deck($1) as deck', [limit]);
    return deck.map((card) => card.id);
  };
  const recruitDeck = async (actor, limit = 30) => {
    await as(actor);
    const [{ deck }] = await rows('select public.group_recruit_deck($1) as deck', [limit]);
    return deck.map((card) => card.profile.id);
  };
  const personSwipe = async (candidate, id, decision) => {
    await as(candidate);
    return db.query('select public.swipe_group($1,$2)', [id, decision]);
  };
  const recruitSwipe = async (actor, candidate, role, decision) => {
    await as(actor);
    return db.query('select public.swipe_group_candidate($1,$2,$3)', [candidate, role, decision]);
  };
  const setAge = async (id, user, direction, age) => {
    await db.exec('reset role');
    await db.query(
      `update public.group_swipes set created_at = now() - $4::interval
      where group_id=$1 and user_id=$2 and direction=$3`,
      [id, user, direction, age]
    );
  };
  const isolated = async (body) => {
    await db.exec('begin');
    try {
      await body();
    } finally {
      await db.exec('rollback');
    }
  };
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    const dir = new URL('./migrations/', import.meta.url);
    const migrations = readdirSync(dir)
      .filter((path) => path.endsWith('.sql'))
      .sort();
    const split = migrations.findIndex((path) => path.endsWith('_group_deck_passes.sql'));
    assert.notEqual(split, -1);
    const migrate = (path) => db.exec(readFileSync(new URL(path, dir), 'utf8'));
    for (const path of migrations.slice(0, split)) {
      await migrate(path);
    }
    await db.exec(`create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.actor',true),'')::uuid $$`);
    for (const [id, specialty] of [
      [admin, 'legal'],
      [secondAdmin, 'legal'],
      [buyer, 'dev'],
      [dev, 'dev'],
      [other, 'dev'],
    ]) {
      await db.query('insert into auth.users(id) values ($1)', [id]);
      await db.query(
        `insert into public.profiles(id,name,age,location,timezone,avatar_initials,
        specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
        values($1,'Dev',30,'Madrid','UTC','D',array[$2::public.specialty],'par','solo-ganas',10,
               array['tarde']::public.time_band[],'equilibrado')`,
        [id, specialty]
      );
    }

    await t.test('migra un pass antiguo y conserva el bloqueo y la expulsión previos', () =>
      isolated(async () => {
        const g = await group(admin);
        await personSwipe(dev, g.id, 'like');
        await recruitSwipe(admin, dev, g.role, 'like');
        await personSwipe(other, g.id, 'like');
        await recruitSwipe(admin, other, g.role, 'like');
        await as(admin);
        await db.query('select public.kick_group_member($1)', [other]);
        await personSwipe(secondAdmin, g.id, 'pass');
        await setAge(g.id, secondAdmin, 'user_to_group', '3 days');
        await as(buyer);
        await db.query('select public.block_group($1)', [g.id]);
        await as(admin);
        await db.query('select public.leave_group($1)', [g.id]);
        await db.exec('reset role');
        await db.query('delete from public.push_group_events where group_id=$1 and subject_id=$2', [
          g.id,
          other,
        ]); // expulsión más antigua que la retención de notificaciones
        await migrate(migrations[split]);
        const status = await rows(
          `select user_id, dismissal from public.group_swipes
          where direction='user_to_group' and group_id=$1`,
          [g.id]
        );
        const byUser = new Map(status.map((s) => [s.user_id, s.dismissal]));
        assert.equal(byUser.get(other), 'membership');
        assert.equal(byUser.get(buyer), 'block');
        assert.equal(byUser.get(secondAdmin), null);
        assert.deepEqual(
          await rows(`select liked from public.group_deck_swipe_rank($1,$2,'user_to_group')`, [
            g.id,
            secondAdmin,
          ]),
          [{ liked: false }]
        );
        await setAge(g.id, buyer, 'user_to_group', '7 days');
        assert.deepEqual(await personDeck(buyer), []);
        await setAge(g.id, other, 'user_to_group', '7 days');
        await setAge(g.id, other, 'group_to_user', '7 days');
        await personSwipe(other, g.id, 'like');
        await recruitSwipe(dev, other, g.role, 'like');
        assert.deepEqual(await personDeck(other), []);
        await db.exec('reset role');
        assert.deepEqual(
          await rows('select user_id from public.group_members where group_id=$1', [g.id]),
          [{ user_id: dev }]
        );
      })
    );
    for (const path of migrations.slice(split)) {
      await migrate(path);
    }
    await t.test('grupos nuevos, límite, frontera exacta, reintentos y segundo pass', () =>
      isolated(async () => {
        const passed = await group(admin);
        const fresh = await group(secondAdmin);
        await recruitSwipe(admin, buyer, passed.role, 'like');
        for (let round = 0; round < 2; round++) {
          await personSwipe(buyer, passed.id, 'pass');
          assert.deepEqual(await personDeck(buyer), [fresh.id]);
          await setAge(passed.id, buyer, 'user_to_group', '48 hours -1 microsecond');
          assert.deepEqual(await personDeck(buyer), [fresh.id]);
          await personSwipe(buyer, passed.id, 'pass');
          await db.exec('reset role');
          assert.equal(
            (
              await rows(
                `select created_at=now()-interval '48 hours -1 microsecond' kept
          from public.group_swipes where group_id=$1 and user_id=$2 and direction='user_to_group'`,
                [passed.id, buyer]
              )
            )[0].kept,
            true
          );
          await setAge(passed.id, buyer, 'user_to_group', '48 hours');
          assert.deepEqual(await personDeck(buyer), [fresh.id, passed.id]);
          assert.deepEqual(await personDeck(buyer, 1), [fresh.id]);
        }
        await personSwipe(buyer, passed.id, 'like'); // entra por like recíproco
        await setAge(passed.id, buyer, 'user_to_group', '7 days');
        assert.deepEqual(await personDeck(buyer), [fresh.id]);
        assert.ok(!(await recruitDeck(admin)).includes(buyer));
      })
    );

    await t.test('reclutamiento respeta el plazo, la prioridad y los likes pendientes', () =>
      isolated(async () => {
        const g = await group(admin);
        await personSwipe(buyer, g.id, 'like');
        await recruitSwipe(admin, other, g.role, 'like');
        for (let round = 0; round < 2; round++) {
          await recruitSwipe(admin, buyer, g.role, 'pass');
          await setAge(g.id, buyer, 'group_to_user', '48 hours -1 microsecond');
          assert.deepEqual(await recruitDeck(admin), [dev]);
          await setAge(g.id, buyer, 'group_to_user', '48 hours');
          assert.deepEqual(await recruitDeck(admin), [dev, buyer]);
          assert.deepEqual(await recruitDeck(admin, 1), [dev]);
        }
        await recruitSwipe(admin, other, g.role, 'pass');
        await setAge(g.id, other, 'group_to_user', '7 days');
        assert.deepEqual(await recruitDeck(admin), [dev, buyer]);
      })
    );

    await t.test('dos pass explícitos en sentidos opuestos vuelven cuando ambos han caducado', () =>
      isolated(async () => {
        const g = await group(admin);
        await personSwipe(buyer, g.id, 'pass');
        await recruitSwipe(admin, buyer, g.role, 'pass');
        await setAge(g.id, buyer, 'user_to_group', '48 hours');
        assert.deepEqual(await personDeck(buyer), []);
        assert.ok(!(await recruitDeck(admin)).includes(buyer));
        await setAge(g.id, buyer, 'group_to_user', '48 hours');
        assert.deepEqual(await personDeck(buyer), [g.id]);
        assert.ok((await recruitDeck(admin)).includes(buyer));
      })
    );

    await t.test('bloqueo persistente tras herencia, plazas, expulsiones y privacidad', () =>
      isolated(async () => {
        const g = await group(admin, 3);
        await personSwipe(buyer, g.id, 'pass');
        await setAge(g.id, buyer, 'user_to_group', '48 hours');
        await personSwipe(dev, g.id, 'like');
        await recruitSwipe(admin, dev, g.role, 'like');
        await personSwipe(other, g.id, 'like');
        await recruitSwipe(admin, other, g.role, 'like');
        assert.deepEqual(await recruitDeck(admin), []);
        assert.deepEqual(await personDeck(buyer), []);
        await as(buyer);
        await db.query('select public.block_group($1)', [g.id]);
        await as(admin);
        await db.query('select public.kick_group_member($1)', [other]);
        await db.query('select public.leave_group($1)', [g.id]); // dev hereda
        await setAge(g.id, buyer, 'user_to_group', '30 days');
        assert.deepEqual(await personDeck(buyer), []);
        assert.ok(!(await recruitDeck(dev)).includes(buyer));
        await as(buyer);
        await db.exec('savepoint blocked');
        await assert.rejects(() => db.query("select public.swipe_group($1,'like')", [g.id]), {
          code: 'LG003',
        });
        await db.exec('rollback to blocked');
        const [{ permission }] = await rows(`select has_function_privilege(current_user,
        'public.group_deck_swipe_rank(uuid,uuid,public.group_swipe_direction)','execute') permission`);
        assert.equal(permission, false);
        const another = await group(secondAdmin);
        await personSwipe(other, another.id, 'like');
        await recruitSwipe(secondAdmin, other, another.role, 'like');
        await as(secondAdmin);
        await db.query('select public.kick_group_member($1)', [other]);
        await setAge(another.id, other, 'user_to_group', '30 days');
        await setAge(another.id, other, 'group_to_user', '30 days');
        assert.ok(!(await recruitDeck(secondAdmin)).includes(other));
        assert.ok(!(await personDeck(other)).includes(another.id));
      })
    );

    await t.test(
      'las cuentas suspendidas y los bloqueos bilaterales quedan fuera al vencer el plazo',
      () =>
        isolated(async () => {
          const g = await group(admin);
          await recruitSwipe(admin, dev, g.role, 'pass');
          await setAge(g.id, dev, 'group_to_user', '3 days');
          await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [
            dev,
          ]);
          assert.ok(!(await recruitDeck(admin)).includes(dev));
          await personSwipe(buyer, g.id, 'pass');
          await setAge(g.id, buyer, 'user_to_group', '3 days');
          await as(admin);
          await db.query('select public.block_profile($1)', [buyer]);
          assert.deepEqual(await personDeck(buyer), []);
          assert.ok(!(await recruitDeck(admin)).includes(buyer));
        })
    );
  } finally {
    await db.close();
  }
});
