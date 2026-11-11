import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const MATCH = '00000000-0000-4000-8000-000000000004';
const MESSAGE = '00000000-0000-4000-8000-000000000005';

test('Push: destinatarios, horarios, privacidad, preferencias, marcas y permisos', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const f of readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(join(here, 'migrations', f), 'utf8'));
    }
    // También debe poder repetirse sin sobrecargas, triggers o jobs duplicados.
    await db.exec(
      readFileSync(join(here, 'migrations', '20261111160000_push_notifications.sql'), 'utf8')
    );
    // Reaplicar las correcciones posteriores conserva el esquema final.
    const reliability = readFileSync(
      join(here, 'migrations', '20261111180240_push_delivery_reliability.sql'),
      'utf8'
    );
    await db.exec(reliability);
    await db.exec(reliability);
    const localTimeDefinition = (
      await db.query(
        "select pg_get_functiondef('public.push_local_time(uuid,timestamptz)'::regprocedure) as sql"
      )
    ).rows[0].sql;
    await db.exec(`insert into auth.users(id,last_sign_in_at) values ('${A}',now()-interval '4 days'),('${B}',now()-interval '4 days'),('${C}',now());
      insert into public.profiles(id,name,age,location,timezone,avatar_initials,specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
      select id,case when id='${A}' then 'Ana' else 'Bea' end,30,'Madrid','Europe/Madrid','AB',array['dev']::public.specialty[],'par','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado' from auth.users;
      insert into public.user_settings(user_id,locale) select id,'ca' from auth.users;
      insert into public.push_tokens(token,user_id,platform) select 'ExponentPushToken[token_'||id||']',id,'ios' from auth.users;
      insert into public.decisions(actor_id,target_id,decision,is_super,created_at) values('${A}','${B}','like',true,now()-interval '1 hour');
      insert into public.matches(id,profile_a,profile_b,mode) values('${MATCH}','${A}','${B}','par');
      insert into public.messages(id,match_id,sender_id,body,sent_at) values('${MESSAGE}','${MATCH}','${A}','Hola',now()-interval '1 hour');
      -- Reloj local determinista; no reemplaza now() ni los intervalos reales.
      create or replace function public.push_local_time(p_user uuid,p_at timestamptz default now()) returns timestamp language sql stable security definer set search_path='' as $$
        select timestamp '2026-11-11 11:15' + (p_at-now()) $$;`);
    const rows = async (sql) => (await db.query(sql)).rows;
    const targets = (name) => rows(`select * from public.${name}()`);
    const act = async (user) =>
      db.exec(
        `reset role; create or replace function auth.uid() returns uuid language sql as $$ select '${user}'::uuid $$; set role authenticated;`
      );
    const tx = async (fn) => {
      await db.exec('begin');
      try {
        await fn();
      } finally {
        await db.exec('rollback');
      }
    };

    await t.test('zona inválida o sin perfil cae a Madrid; IANA válida usa su hora real', () =>
      tx(async () => {
        await db.exec(localTimeDefinition);
        await db.exec(`update public.profiles set timezone='not/a-zone' where id='${B}'`);
        const invalid = await rows(
          `select public.push_local_time('${B}')=timezone('Europe/Madrid',now()) as same`
        );
        assert.equal(invalid[0].same, true);
        const noProfile = await rows(
          `select public.push_local_time('00000000-0000-4000-8000-999999999999')=timezone('Europe/Madrid',now()) as same`
        );
        assert.equal(noProfile[0].same, true);
        await db.exec(`update public.profiles set timezone='UTC+02' where id='${B}'`);
        assert.equal(
          (
            await rows(
              `select public.push_local_time('${B}')=timezone('Europe/Madrid',now()) as same`
            )
          )[0].same,
          true
        );
        await db.exec(`update public.profiles set timezone='UTC' where id='${B}'`);
        assert.equal(
          (await rows(`select public.push_local_time('${B}')=timezone('UTC',now()) as same`))[0]
            .same,
          true
        );
        await db.exec(`update public.profiles set timezone='America/New_York' where id='${B}'`);
        assert.equal(
          (
            await rows(
              `select public.push_local_time('${B}')=timezone('America/New_York',now()) as same`
            )
          )[0].same,
          true
        );
      })
    );

    await t.test('gratis no devuelve identidad, Premium sí; claim y marcas solo al éxito', () =>
      tx(async () => {
        const free = await targets('like_digest_push_targets');
        assert.equal(free.length, 1);
        assert.equal(free[0].user_id, B);
        assert.equal(free[0].like_count, 1);
        assert.equal(free[0].first_name, null);
        assert.equal(free[0].first_super, null);
        assert.equal(free[0].locale, 'ca');
        assert.deepEqual(
          await targets('like_digest_push_targets'),
          [],
          'reserva contra cron concurrente'
        );
        assert.equal(
          (
            await rows(`select last_like_digest_at from public.user_settings where user_id='${B}'`)
          )[0].last_like_digest_at,
          null
        );
        await db.exec(`select public.complete_push_notices(array['${free[0].notice_id}']::uuid[])`);
        assert.ok(
          (
            await rows(`select last_like_digest_at from public.user_settings where user_id='${B}'`)
          )[0].last_like_digest_at
        );
        await db.exec(
          `delete from public.push_notice_claims; update public.user_settings set last_like_digest_at=null; insert into public.entitlements(user_id,premium_until) values('${B}',now()+interval '30 days');`
        );
        const premium = await targets('like_digest_push_targets');
        assert.equal(premium[0].first_name, 'Ana');
        assert.equal(premium[0].first_super, true);
      })
    );
    await t.test(
      'sin nuevos likes, vistos, decisión de vuelta, bloqueos, sin token o apagado',
      async () => {
        for (const sql of [
          `delete from public.decisions`,
          `update public.user_settings set last_like_digest_at=now()-interval '2 hours'`,
          `update public.user_settings set notify_likes=false`,
          `delete from public.push_tokens where user_id='${B}'`,
          `insert into public.decisions(actor_id,target_id,decision) values('${B}','${A}','pass')`,
          `insert into public.user_blocks(blocker_id,blocked_id) values('${B}','${A}')`,
          `insert into public.user_blocks(blocker_id,blocked_id) values('${A}','${B}')`,
        ])
          await tx(async () => {
            await db.exec(sql);
            assert.deepEqual(await targets('like_digest_push_targets'), [], sql);
          });
        await tx(async () => {
          await act(B);
          await db.exec('select public.mark_incoming_likes_seen()');
          await db.exec('reset role');
          assert.deepEqual(await targets('like_digest_push_targets'), []);
        });
      }
    );
    await t.test('quiet hours y mínimo de 20h, solo una vez al día', async () => {
      for (const hour of ['08:00', '22:00', '23:00', '10:59', '12:00'])
        await tx(async () => {
          await db.exec(
            `create or replace function public.push_local_time(p_user uuid,p_at timestamptz default now()) returns timestamp language sql stable security definer set search_path='' as $$ select timestamp '2026-11-11 ${hour}'+(p_at-now()) $$`
          );
          assert.deepEqual(await targets('like_digest_push_targets'), []);
        });
      await tx(async () => {
        await db.exec(
          `update public.user_settings set last_like_digest_at=now()-interval '19 hours'; update public.decisions set created_at=now()`
        );
        assert.deepEqual(await targets('like_digest_push_targets'), []);
      });
    });
    await t.test(
      'match a ambos; mensaje solo a la otra persona; preferencias y bloqueos en ambos sentidos',
      async () => {
        assert.equal((await rows(`select * from public.match_push_targets('${MATCH}')`)).length, 2);
        assert.equal(
          (await rows(`select * from public.direct_message_push_targets('${MESSAGE}')`)).length,
          1
        );
        for (const sql of [
          `update public.user_settings set notify_matches=false,notify_messages=false`,
          `insert into public.user_blocks(blocker_id,blocked_id) values('${A}','${B}')`,
          `insert into public.user_blocks(blocker_id,blocked_id) values('${B}','${A}')`,
        ])
          await tx(async () => {
            await db.exec(sql);
            assert.deepEqual(await rows(`select * from public.match_push_targets('${MATCH}')`), []);
            assert.deepEqual(
              await rows(`select * from public.direct_message_push_targets('${MESSAGE}')`),
              []
            );
          });
      }
    );
    await t.test(
      'reenganche exige 3 días, motivo, horario, opt-out y 7 días entre envíos',
      async () => {
        assert.equal((await targets('reengagement_push_targets')).length, 1);
        await db.exec('delete from public.push_notice_claims');
        for (const sql of [
          `delete from public.decisions; delete from public.messages`,
          `update public.user_settings set last_active_at=now()-interval '2 days'`,
          `update public.user_settings set last_reengagement_at=now()-interval '6 days'`,
          `update public.user_settings set notify_reminders=false`,
        ])
          await tx(async () => {
            await db.exec(sql);
            assert.deepEqual(await targets('reengagement_push_targets'), [], sql);
          });
        await tx(async () => {
          await db.exec('delete from public.decisions');
          const found = await targets('reengagement_push_targets');
          assert.equal(found[0].like_count, 0);
          assert.equal(found[0].url, `/chat/${MATCH}`);
        });
      }
    );
    await t.test(
      'Premium una vez por fecha; excluye perpetuo, null, apagado y fuera de ventana',
      async () => {
        await tx(async () => {
          await db.exec(
            `insert into public.entitlements(user_id,premium_until) values('${B}',now()+interval '24 hours')`
          );
          const found = await targets('premium_expiry_push_targets');
          assert.equal(found.length, 1);
          await db.exec(
            `select public.complete_push_notices(array['${found[0].notice_id}']::uuid[]); delete from public.push_notice_claims`
          );
          assert.deepEqual(await targets('premium_expiry_push_targets'), []);
        });
        for (const expiry of [
          "'9999-12-31'",
          'null',
          "now()+interval '30 hours'",
          "now()+interval '19 hours'",
        ])
          await tx(async () => {
            await db.exec(
              `insert into public.entitlements(user_id,premium_until) values('${B}',${expiry})`
            );
            assert.deepEqual(await targets('premium_expiry_push_targets'), []);
          });
      }
    );
    await t.test(
      'RPC propias, active_mode conservado, sin sobrecarga y service_role exclusivo',
      () =>
        tx(async () => {
          await act(B);
          await db.exec(`update public.user_settings set active_mode='par' where user_id='${B}'`);
          await db.exec(
            `select public.set_notification_prefs('{"notify_likes":false}'); select public.set_notification_locale('en'); select public.touch_last_active(); select public.register_push_token('ExponentPushToken[long_valid_token]','android','ca');`
          );
          assert.equal(
            (await rows('select public.notification_prefs() as prefs'))[0].prefs.notify_likes,
            false
          );
          assert.equal(
            (await rows(`select active_mode from public.user_settings where user_id='${B}'`))[0]
              .active_mode,
            'par'
          );
          await assert.rejects(db.query('select * from public.like_digest_push_targets()'), {
            code: '42501',
          });
        })
    );
    await t.test(
      'no hay escritura directa de marcas y los RPC rechazan campos o locales ajenos',
      async () => {
        for (const [sql, code] of [
          [
            `update public.user_settings set last_like_digest_at=now() where user_id='${B}'`,
            '42501',
          ],
          ['delete from public.user_settings', '42501'],
          [`select public.set_notification_prefs('{"user_id":"${A}"}')`, '22023'],
          [`select public.set_notification_prefs('{"notify_likes":null}')`, '22023'],
          [`select public.set_notification_locale('fr')`, '22023'],
        ])
          await tx(async () => {
            await act(B);
            await assert.rejects(db.query(sql), { code });
          });
      }
    );
    await t.test('triggers/enqueue sobreviven sin Vault, net ni cron', async () => {
      await db.exec(
        'select public.enqueue_like_digest_push(); select public.enqueue_hourly_push()'
      );
      assert.equal(
        (await rows(`select count(*)::int as n from public.messages where id='${MESSAGE}'`))[0].n,
        1
      );
    });
    await t.test(
      'grupos: incorporación, expulsión, likes con tope 3, bloqueos y preferencias',
      () =>
        tx(async () => {
          const group = '00000000-0000-4000-8000-000000000010';
          const role = '00000000-0000-4000-8000-000000000011';
          await db.exec(`insert into public.groups(id,name,description,admin_id,max_members) values('${group}','Equipo','Un equipo de prueba suficientemente descrito','${A}',6);
        insert into public.group_roles(id,group_id,specialty,slots) values('${role}','${group}','dev',3);
        insert into public.group_members(group_id,user_id) values('${group}','${A}');
        insert into public.group_members(group_id,user_id,role_id) values('${group}','${B}','${role}');`);
          const events = await rows(`select id from public.push_group_events where kind='joined'`);
          assert.equal(events.length, 1, 'crear un grupo no genera aviso de incorporación');
          const joined = await rows(
            `select * from public.group_activity_push_targets('${events[0].id}')`
          );
          assert.deepEqual(joined.map((r) => r.event_kind).sort(), ['joined', 'joined-self']);
          await db.exec(
            `update public.user_settings set notify_group_activity=false where user_id='${B}'`
          );
          assert.equal(
            (await rows(`select * from public.group_activity_push_targets('${events[0].id}')`))
              .length,
            1
          );
          await db.exec(
            `update public.user_settings set notify_group_activity=true; insert into public.user_blocks(blocker_id,blocked_id) values('${B}','${A}')`
          );
          assert.equal(
            (await rows(`select * from public.group_activity_push_targets('${events[0].id}')`))
              .length,
            1
          );
          await db.exec(
            `delete from public.user_blocks; insert into public.group_messages(group_id,sender_id,body) values('${group}','${A}','Hola equipo')`
          );
          const gm = (
            await rows(`select id from public.group_messages where group_id='${group}'`)
          )[0].id;
          assert.equal(
            (await rows(`select * from public.group_message_push_targets('${gm}')`)).length,
            1
          );
          await db.exec(
            `update public.user_settings set notify_group_messages=false where user_id='${B}'`
          );
          assert.deepEqual(
            await rows(`select * from public.group_message_push_targets('${gm}')`),
            []
          );
          await act(A);
          await db.exec(`select public.kick_group_member('${B}'); reset role`);
          const kicked = (
            await rows(`select id from public.push_group_events where kind='kicked'`)
          )[0];
          assert.ok(kicked);
          const target = await rows(
            `select * from public.group_activity_push_targets('${kicked.id}')`
          );
          assert.equal(target.length, 1);
          assert.equal(target[0].url, '/(tabs)/matches');
          for (let i = 0; i < 5; i++) {
            await db.exec(`insert into public.group_swipes(group_id,user_id,direction,decision,actor_id)
          values('${group}','${C}','user_to_group','like','${C}') on conflict(group_id,user_id,direction) do update set decision='like';
          update public.group_swipes set decision='pass' where group_id='${group}' and user_id='${C}';`);
          }
          assert.equal(
            (
              await rows(
                `select count(*)::int as n from public.push_group_events where kind='group-like'`
              )
            )[0].n,
            3
          );
        })
    );
    await t.test(
      'reenganche con likes consume también su marca para no repetir resumen enseguida',
      () =>
        tx(async () => {
          await db.exec('delete from public.push_notice_claims');
          const found = await targets('reengagement_push_targets');
          assert.equal(found[0].like_count, 1);
          await db.exec(
            `select public.complete_push_notices(array['${found[0].notice_id}']::uuid[]);`
          );
          assert.deepEqual(await targets('like_digest_push_targets'), []);
        })
    );
    await t.test('webhook horario pasa timeout de 30 s y su fallo no rompe la operación', () =>
      tx(async () => {
        // Dobles locales: nunca leen Vault ni hacen peticiones de red reales.
        await db.exec(`create schema vault;
          create table vault.decrypted_secrets(name text,decrypted_secret text);
          insert into vault.decrypted_secrets values
            ('push_webhook_url','https://example.invalid/push'),('push_webhook_secret','fixture');
          create schema net;
          create table net.requests(timeout integer,body jsonb,authenticated boolean);
          create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
          returns bigint language plpgsql as $$ begin
            insert into net.requests values(timeout_milliseconds,body,headers ? 'x-push-secret');
            return 1;
          end $$;
          select public.enqueue_hourly_push();`);
        assert.deepEqual(
          await rows(
            `select timeout,body->>'type' as kind,authenticated from net.requests order by kind`
          ),
          [
            { timeout: 30000, kind: 'premium-expiry', authenticated: true },
            { timeout: 30000, kind: 'reengagement', authenticated: true },
          ]
        );
        await db.exec(`create or replace function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
          returns bigint language plpgsql as $$ begin raise exception 'network fixture failure'; end $$;`);
        await assert.doesNotReject(() => db.exec('select public.enqueue_like_digest_push()'));
      })
    );
  } finally {
    await db.close();
  }
});
