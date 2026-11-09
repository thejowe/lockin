// Grupos (migración 20261109130000) contra PostgreSQL embebido (PGlite), sin
// Docker. Se corre con `npm run test:schema`.
//
// Cubre: crear grupo y sus validaciones, los dos decks, la unión por like
// recíproco en cualquier orden, el tope de plazas y de un grupo por persona,
// salir y expulsar (la plaza vuelve), la regla de liderazgo al salir y al borrar
// la cuenta, el chat con su RLS, y denunciar/bloquear sobre `user_reports` y
// `user_blocks`.
//
// Límite de PGlite: una sola conexión, así que las carreras no se prueban
// lanzando dos llamadas a la vez; se comprueba el resultado de cada orden y que
// `join_group_if_possible` toma el cerrojo antes de mirar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const pgliteModule = process.env.PGLITE_MODULE
  ? pathToFileURL(process.env.PGLITE_MODULE).href
  : '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const id = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const ADMIN = id('a1');
const DEV1 = id('b1');
const DEV2 = id('b2');
const DEV3 = id('b3');
const DESIGNER = id('c1');
const LAWYER = id('d1');
const PEOPLE = [
  [ADMIN, 'producto'],
  [DEV1, 'dev'],
  [DEV2, 'dev'],
  [DEV3, 'dev'],
  [DESIGNER, 'diseno'],
  [LAWYER, 'legal'],
];
const ROLES = `'[{"specialty":"dev","slots":2},{"specialty":"diseno","slots":1}]'::jsonb`;
const DESCRIPTION = 'Un proyecto de prueba con una descripción suficiente.';

test('Grupos: crear, decks, unión, salida, liderazgo, chat y denuncias', async (t) => {
  const { PGlite } = await import(pgliteModule);
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
    }

    await db.exec(`insert into auth.users (id, email) values
      ${PEOPLE.map(([u], i) => `('${u}', 'grupo${i}@lockin.test')`).join(',\n      ')};
      insert into public.profiles (
        id, name, age, location, timezone, avatar_initials, specialties,
        looking_for, starting_point, availability_hours_per_week,
        availability_bands, ambition
      )
      select p.id::uuid, 'P' || p.n, 30, 'Madrid', 'Europe/Madrid', 'P',
             array[p.s]::public.specialty[], 'par', 'solo-ganas', 10,
             array['tarde']::public.time_band[], 'equilibrado'
      from (values ${PEOPLE.map(([u, s], i) => `('${u}', '${s}', ${i})`).join(', ')}) as p(id, s, n);`);

    const actingAs = (uid) =>
      db.exec(`reset role;
        create or replace function auth.uid() returns uuid language sql as $$ select '${uid}'::uuid $$;
        set local role authenticated;`);
    const tx = async (fn) => {
      await db.exec('begin;');
      try {
        await fn();
      } finally {
        await db.exec('rollback;');
      }
    };
    const code = async (sql) => {
      await db.exec('savepoint probe;');
      try {
        await db.query(sql);
        await db.exec('release savepoint probe;');
        return 'sin error';
      } catch (error) {
        await db.exec('rollback to savepoint probe;');
        return error.code ?? error.message;
      }
    };
    const one = async (sql) => (await db.query(sql)).rows[0];
    const owner = (sql) => db.exec(`reset role; ${sql}`);
    const createGroup = async (uid = ADMIN, roles = ROLES, max = 6) => {
      await actingAs(uid);
      return (
        await one(`select (public.create_group('Equipo', '${DESCRIPTION}', ${roles}, ${max})).id`)
      ).id;
    };
    const swipeGroup = async (uid, group, decision = 'like') => {
      await actingAs(uid);
      return (await one(`select public.swipe_group('${group}', '${decision}') as joined`)).joined;
    };
    const roleId = async (group, specialty) => {
      await db.exec('reset role;');
      return (
        await one(
          `select id from public.group_roles where group_id = '${group}' and specialty = '${specialty}'`
        )
      ).id;
    };
    const swipeCandidate = async (admin, user, role, decision = 'like') => {
      await actingAs(admin);
      return (
        await one(
          `select public.swipe_group_candidate('${user}', '${role}', '${decision}') as joined`
        )
      ).joined;
    };
    const members = async (group) => {
      await db.exec('reset role;');
      return (
        await db.query(
          `select user_id from public.group_members where group_id = '${group}' order by joined_at, user_id`
        )
      ).rows.map((row) => row.user_id);
    };
    const filled = async (role) => {
      await db.exec('reset role;');
      return (await one(`select filled from public.group_roles where id = '${role}'`)).filled;
    };
    /** Mete a alguien por like recíproco, con `joined_at` creciente. */
    const admit = async (group, admin, user, specialty) => {
      await swipeGroup(user, group);
      assert.equal(await swipeCandidate(admin, user, await roleId(group, specialty)), true);
    };

    await t.test('crear: el creador es admin y miembro sin plaza', () =>
      tx(async () => {
        const group = await createGroup();
        assert.deepEqual(await members(group), [ADMIN]);
        const row = await one(
          `select admin_id, max_members from public.groups where id = '${group}'`
        );
        assert.equal(row.admin_id, ADMIN);
        assert.equal(row.max_members, 6);
        assert.equal(await filled(await roleId(group, 'dev')), 0);
      })
    );

    await t.test('crear: validaciones y un grupo por persona', () =>
      tx(async () => {
        await actingAs(ADMIN);
        const create = (name, description, roles, max = 6) =>
          code(`select public.create_group('${name}', '${description}', ${roles}, ${max})`);
        assert.equal(await create('X', DESCRIPTION, ROLES), 'LG001', 'nombre corto');
        assert.equal(await create('Equipo', 'corta', ROLES), 'LG001', 'descripción corta');
        assert.equal(await create('Equipo', DESCRIPTION, `'[]'::jsonb`), 'LG001', 'sin puestos');
        assert.equal(
          await create('Equipo', DESCRIPTION, `'[{"specialty":"magia","slots":1}]'::jsonb`),
          'LG001',
          'especialidad inexistente'
        );
        assert.equal(
          await create(
            'Equipo',
            DESCRIPTION,
            `'[{"specialty":"dev","slots":1},{"specialty":"dev","slots":1}]'::jsonb`
          ),
          'LG001',
          'puesto repetido'
        );
        assert.equal(
          await create(
            'Equipo',
            DESCRIPTION,
            `'[{"specialty":"dev","slots":5},{"specialty":"diseno","slots":1}]'::jsonb`
          ),
          'LG001',
          '6 plazas + admin no caben en 6'
        );
        assert.equal(await create('Equipo', DESCRIPTION, ROLES, 7), 'LG001', 'máximo 6');
        assert.equal(await create('Equipo', DESCRIPTION, ROLES), 'sin error');
        assert.equal(await create('Otro', DESCRIPTION, ROLES), 'LG002', 'ya tiene grupo');
      })
    );

    await t.test('decks: cada lado ve solo lo que encaja', () =>
      tx(async () => {
        const group = await createGroup();

        await actingAs(DEV1);
        const deck = (await one('select public.group_deck() as d')).d;
        assert.equal(deck.length, 1);
        assert.equal(deck[0].id, group);
        assert.equal(deck[0].my_role_id, await roleId(group, 'dev'));
        await actingAs(DEV1);
        assert.equal(deck[0].roles.length, 2);
        assert.deepEqual(
          deck[0].members.map((m) => m.user_id),
          [ADMIN]
        );

        await actingAs(LAWYER);
        assert.deepEqual(
          (await one('select public.group_deck() as d')).d,
          [],
          'sin puesto que encaje'
        );

        await actingAs(ADMIN);
        assert.deepEqual((await one('select public.group_deck() as d')).d, [], 'ya tiene grupo');
        const recruit = (await one('select public.group_recruit_deck() as d')).d;
        assert.deepEqual(
          recruit.map((c) => c.profile.id).sort(),
          [DEV1, DEV2, DEV3, DESIGNER].sort(),
          'ni el admin ni quien no encaja'
        );

        await actingAs(DEV1);
        assert.equal(await code('select public.group_recruit_deck()'), 'LG004');
      })
    );

    await t.test('unión: like recíproco en los dos órdenes', () =>
      tx(async () => {
        const group = await createGroup();
        const dev = await roleId(group, 'dev');
        const design = await roleId(group, 'diseno');

        // Primero la persona, después el admin.
        assert.equal(await swipeGroup(DEV1, group), false);
        assert.equal(await swipeCandidate(ADMIN, DEV1, dev), true);
        // Primero el admin, después la persona.
        assert.equal(await swipeCandidate(ADMIN, DESIGNER, design), false);
        assert.equal(await swipeGroup(DESIGNER, group), true);

        assert.deepEqual((await members(group)).sort(), [ADMIN, DEV1, DESIGNER].sort());
        assert.equal(await filled(dev), 1);
        assert.equal(await filled(design), 1);

        // Un pase no une, y quien ya está dentro no desliza.
        assert.equal(await swipeCandidate(ADMIN, DEV2, dev, 'pass'), false);
        assert.equal(await swipeGroup(DEV2, group), false);
        await actingAs(DEV1);
        assert.equal(await code(`select public.swipe_group('${group}', 'like')`), 'LG002');
      })
    );

    await t.test('plazas: un puesto lleno deja de reclutar y no se pasa del cupo', () =>
      tx(async () => {
        const group = await createGroup();
        const dev = await roleId(group, 'dev');
        await admit(group, ADMIN, DEV1, 'dev');
        await admit(group, ADMIN, DEV2, 'dev');
        assert.equal(await filled(dev), 2);

        // DEV3 solo encaja en dev: ya no sale en ningún deck ni puede entrar.
        await actingAs(ADMIN);
        const recruit = (await one('select public.group_recruit_deck() as d')).d;
        assert.deepEqual(
          recruit.map((c) => c.profile.id),
          [DESIGNER]
        );
        await actingAs(DEV3);
        assert.deepEqual((await one('select public.group_deck() as d')).d, []);
        assert.equal(await swipeGroup(DEV3, group), false);
        assert.equal(await swipeCandidate(ADMIN, DEV3, dev), false, 'sin plaza no entra');
        assert.equal(await filled(dev), 2);
        assert.equal((await members(group)).includes(DEV3), false);
      })
    );

    await t.test('un grupo por persona: el segundo like recíproco no une', () =>
      tx(async () => {
        const first = await createGroup(ADMIN);
        const second = await createGroup(DESIGNER, `'[{"specialty":"dev","slots":1}]'::jsonb`);
        await swipeGroup(DEV1, first);
        await swipeGroup(DEV1, second);
        assert.equal(await swipeCandidate(ADMIN, DEV1, await roleId(first, 'dev')), true);
        assert.equal(await swipeCandidate(DESIGNER, DEV1, await roleId(second, 'dev')), false);
        assert.deepEqual(await members(second), [DESIGNER]);
        assert.equal(await filled(await roleId(second, 'dev')), 0);
      })
    );

    await t.test('salir y expulsar: la plaza vuelve y no hay reentrada sola', () =>
      tx(async () => {
        const group = await createGroup();
        const dev = await roleId(group, 'dev');
        await admit(group, ADMIN, DEV1, 'dev');
        await admit(group, ADMIN, DEV2, 'dev');

        await actingAs(DEV1);
        await db.query('select public.leave_group()');
        assert.equal(await filled(dev), 1);
        assert.equal(await code('select public.leave_group()'), 'LG003');
        // Sus likes con el grupo quedan en pase: no vuelve a salirle.
        assert.deepEqual((await one('select public.group_deck() as d')).d, []);

        await actingAs(DEV2);
        assert.equal(await code(`select public.kick_group_member('${ADMIN}')`), 'LG004');
        await actingAs(ADMIN);
        assert.equal(await code(`select public.kick_group_member('${ADMIN}')`), 'LG001');
        assert.equal(await code(`select public.kick_group_member('${DEV1}')`), 'LG005');
        await db.query(`select public.kick_group_member('${DEV2}')`);
        assert.equal(await filled(dev), 0);
        assert.deepEqual(await members(group), [ADMIN]);
      })
    );

    await t.test('liderazgo: pasa al más antiguo y, sin nadie, el grupo se borra', () =>
      tx(async () => {
        const group = await createGroup();
        await admit(group, ADMIN, DEV1, 'dev');
        await owner(
          `update public.group_members set joined_at = now() + interval '1 hour' where user_id = '${DEV1}'`
        );
        await admit(group, ADMIN, DESIGNER, 'diseno');
        await owner(
          `update public.group_members set joined_at = now() + interval '2 hours' where user_id = '${DESIGNER}'`
        );

        await actingAs(ADMIN);
        await db.query('select public.leave_group()');
        await db.exec('reset role;');
        assert.equal(
          (await one(`select admin_id from public.groups where id = '${group}'`)).admin_id,
          DEV1
        );

        // Borrar la cuenta del nuevo admin: mismo camino, por el trigger.
        await actingAs(DEV1);
        await db.query('select public.delete_my_account()');
        await db.exec('reset role;');
        assert.equal(
          (await one(`select admin_id from public.groups where id = '${group}'`)).admin_id,
          DESIGNER
        );
        assert.equal(await filled(await roleId(group, 'dev')), 0, 'su plaza queda libre');
        assert.equal(
          (
            await one(
              `select count(*)::int as n from public.group_swipes where user_id = '${DEV1}'`
            )
          ).n,
          0,
          'sus swipes como candidata caen'
        );

        await actingAs(DESIGNER);
        await db.query('select public.leave_group()');
        await db.exec('reset role;');
        assert.equal((await one(`select count(*)::int as n from public.groups`)).n, 0);
      })
    );

    await t.test('RLS: solo los miembros leen el grupo y su chat', () =>
      tx(async () => {
        const group = await createGroup();
        await admit(group, ADMIN, DEV1, 'dev');

        await actingAs(DEV1);
        await db.query(
          `insert into public.group_messages (group_id, sender_id, body) values ('${group}', '${DEV1}', 'hola equipo')`
        );
        assert.equal(
          await code(
            `insert into public.group_messages (group_id, sender_id, body) values ('${group}', '${ADMIN}', 'suplantado')`
          ),
          '42501',
          'no se escribe en nombre de otra persona'
        );
        assert.equal(await code(`select * from public.group_swipes`), '42501');
        assert.equal(
          await code(
            `insert into public.group_members (group_id, user_id) values ('${group}', '${DEV2}')`
          ),
          '42501'
        );

        await actingAs(ADMIN);
        assert.equal((await one('select count(*)::int as n from public.group_messages')).n, 1);

        await actingAs(DEV2);
        for (const table of ['groups', 'group_roles', 'group_members', 'group_messages']) {
          assert.equal((await one(`select count(*)::int as n from public.${table}`)).n, 0, table);
        }
        assert.equal(
          await code(
            `insert into public.group_messages (group_id, sender_id, body) values ('${group}', '${DEV2}', 'colado')`
          ),
          '42501'
        );
        // Canal de realtime: solo miembros.
        assert.equal(
          (
            await one(
              `select public.is_changes_topic_member('lockin:group-messages:${group}') as ok`
            )
          ).ok,
          false
        );
        await actingAs(DEV1);
        assert.equal(
          (
            await one(
              `select public.is_changes_topic_member('lockin:group-messages:${group}') as ok`
            )
          ).ok,
          true
        );
        assert.equal(
          (await one(`select public.is_changes_topic_member('lockin:groups') as ok`)).ok,
          true
        );
      })
    );

    await t.test('denunciar y bloquear usan user_reports y user_blocks', () =>
      tx(async () => {
        const group = await createGroup();
        await admit(group, ADMIN, DEV1, 'dev');
        await actingAs(DEV1);
        await db.query(
          `insert into public.group_messages (group_id, sender_id, body) values ('${group}', '${DEV1}', 'mensaje feo')`
        );
        await db.exec('reset role;');
        const message = (await one('select id from public.group_messages')).id;

        await actingAs(ADMIN);
        assert.equal(await code(`select public.report_group('${group}', 'spam')`), 'LI008');
        assert.equal(
          await code(`select public.report_group_message('${message}', 'acoso')`),
          'sin error'
        );
        await actingAs(DEV1);
        assert.equal(
          await code(`select public.report_group_message('${message}', 'acoso')`),
          'LI008'
        );
        assert.equal(
          await code(`select public.block_group('${group}')`),
          'LG001',
          'desde dentro no'
        );

        await actingAs(DEV2);
        assert.equal(
          await code(`select public.report_group_message('${message}', 'acoso')`),
          '42501'
        );
        assert.equal(await code(`select public.report_group('${group}', 'nada')`), 'LI009');
        assert.equal(
          await code(`select public.report_group('${group}', 'spam', 'detalle')`),
          'sin error'
        );
        assert.equal(await code(`select public.block_group('${group}')`), 'sin error');
        assert.deepEqual(
          (await one('select public.group_deck() as d')).d,
          [],
          'bloqueado: no sale'
        );

        await db.exec('reset role;');
        const reports = (
          await db.query(
            `select reported_id, group_ref, group_name, message_ref, message_excerpt
               from public.user_reports order by created_at, message_ref nulls last`
          )
        ).rows;
        assert.equal(reports.length, 2);
        assert.ok(reports.every((r) => r.group_ref === group && r.group_name === 'Equipo'));
        assert.ok(
          reports.some((r) => r.reported_id === DEV1 && r.message_excerpt === 'mensaje feo')
        );
        assert.ok(reports.some((r) => r.reported_id === ADMIN && r.message_ref === null));
        assert.equal(
          (
            await one(
              `select count(*)::int as n from public.user_blocks where blocker_id = '${DEV2}' and blocked_id = '${ADMIN}'`
            )
          ).n,
          1
        );
        // Con el bloqueo, el admin tampoco ve a esa persona en su deck.
        await actingAs(ADMIN);
        const recruit = (await one('select public.group_recruit_deck() as d')).d;
        assert.equal(
          recruit.some((c) => c.profile.id === DEV2),
          false
        );
      })
    );

    await t.test('editar: solo el admin, sin tocar a quien ya está dentro', () =>
      tx(async () => {
        const group = await createGroup();
        await admit(group, ADMIN, DEV1, 'dev');
        const update = (roles, name = 'Equipo Nuevo', description = DESCRIPTION) =>
          code(`select public.update_group('${name}', '${description}', '${roles}'::jsonb)`);
        const roles = async () => {
          await db.exec('reset role;');
          return (
            await db.query(
              `select specialty, slots, filled from public.group_roles
               where group_id = '${group}' order by specialty`
            )
          ).rows.map((row) => `${row.specialty}:${row.slots}/${row.filled}`);
        };

        // Quien no administra, no edita.
        await actingAs(DEV1);
        assert.equal(await update('[{"specialty":"dev","slots":2}]'), 'LG004');

        await actingAs(ADMIN);
        // Ni quitar un perfil ocupado ni dejarlo con menos plazas que personas.
        assert.equal(await update('[{"specialty":"diseno","slots":1}]'), 'LG001');
        await admit(group, ADMIN, DEV2, 'dev');
        await actingAs(ADMIN);
        assert.equal(await update('[{"specialty":"dev","slots":1}]'), 'LG001');
        // Las mismas reglas que al crear: aforo, repetidos, textos.
        assert.equal(
          await update('[{"specialty":"dev","slots":5},{"specialty":"legal","slots":1}]'),
          'LG001'
        );
        assert.equal(
          await update('[{"specialty":"dev","slots":2},{"specialty":"dev","slots":1}]'),
          'LG001'
        );
        assert.equal(await update('[]'), 'LG001');
        assert.equal(await update('[{"specialty":"dev","slots":2}]', 'x'), 'LG001');
        assert.equal(await update('[{"specialty":"dev","slots":2}]', 'Equipo', 'corta'), 'LG001');
        assert.deepEqual(await roles(), ['diseno:1/0', 'dev:2/2']);

        // El admin le había dado like a la diseñadora para el perfil de diseño…
        const design = await roleId(group, 'diseno');
        assert.equal(await swipeCandidate(ADMIN, DESIGNER, design), false);

        // …y ahora quita diseño, amplía desarrollo y abre legal.
        await actingAs(ADMIN);
        assert.equal(
          await update('[{"specialty":"dev","slots":3},{"specialty":"legal","slots":1}]'),
          'sin error'
        );
        assert.deepEqual(await roles(), ['dev:3/2', 'legal:1/0']);
        await db.exec('reset role;');
        const row = await one(`select name, description from public.groups where id = '${group}'`);
        assert.equal(row.name, 'Equipo Nuevo');
        assert.equal(
          (
            await one(
              `select role_id from public.group_swipes
               where group_id = '${group}' and user_id = '${DESIGNER}'`
            )
          ).role_id,
          null,
          'el like del grupo sobrevive sin perfil concreto'
        );
        // Sin perfil que encaje, su like de vuelta ya no la mete.
        assert.equal(await swipeGroup(DESIGNER, group), false);
        // El perfil nuevo recluta de inmediato.
        await admit(group, ADMIN, LAWYER, 'legal');
        assert.deepEqual(await roles(), ['dev:3/2', 'legal:1/1']);

        await actingAs(DEV3);
        assert.equal(await update('[{"specialty":"dev","slots":2}]'), 'LG004');
      })
    );

    await t.test('push: tokens propios, destinatarios sin quien escribe ni bloqueos', () =>
      tx(async () => {
        const group = await createGroup();
        await admit(group, ADMIN, DEV1, 'dev');
        await admit(group, ADMIN, DESIGNER, 'diseno');
        const token = (n) => `ExponentPushToken[contrato${n}]`;

        // Cada cual registra su dispositivo; nadie lee la tabla directamente.
        for (const [uid, n] of [
          [ADMIN, 1],
          [DEV1, 2],
          [DESIGNER, 3],
        ]) {
          await actingAs(uid);
          assert.equal(
            await code(`select public.register_push_token('${token(n)}', 'ios')`),
            'sin error'
          );
        }
        assert.equal(await code(`select * from public.push_tokens`), '42501');
        assert.equal(await code(`select public.register_push_token('basura', 'ios')`), '23514');
        assert.equal(
          await code(`select public.register_push_token('${token(9)}', 'web')`),
          '23514'
        );
        // El mismo dispositivo con otra cuenta: el token pasa a ella.
        await actingAs(DEV1);
        await one(`select public.register_push_token('${token(3)}', 'android')`);
        await db.exec('reset role;');
        assert.equal(
          (await one(`select user_id from public.push_tokens where token = '${token(3)}'`)).user_id,
          DEV1
        );
        await actingAs(DESIGNER);
        await one(`select public.register_push_token('${token(3)}', 'ios')`);
        // Borrar un token ajeno no hace nada.
        await actingAs(DEV1);
        await one(`select public.unregister_push_token('${token(3)}')`);
        await db.exec('reset role;');
        assert.equal((await one(`select count(*)::int as n from public.push_tokens`)).n, 3);

        // El trigger no estorba: sin Vault ni pg_net, el mensaje se guarda.
        await actingAs(ADMIN);
        const message = (
          await one(
            `insert into public.group_messages (group_id, sender_id, body)
             values ('${group}', '${ADMIN}', 'Hola') returning id`
          )
        ).id;
        const targets = async () => {
          await db.exec('reset role; set local role service_role;');
          const rows = (
            await db.query(
              `select token, group_name, body from public.group_message_push_targets('${message}') order by token`
            )
          ).rows;
          await db.exec('reset role;');
          return rows;
        };
        assert.deepEqual(
          (await targets()).map((row) => row.token),
          [token(2), token(3)]
        );
        assert.equal((await targets())[0].body, 'Hola');

        // Con un bloqueo entre quien escribe y una destinataria, a ella no le llega.
        await owner(
          `insert into public.user_blocks (blocker_id, blocked_id) values ('${DESIGNER}', '${ADMIN}')`
        );
        assert.deepEqual(
          (await targets()).map((row) => row.token),
          [token(2)]
        );

        // Solo `service_role` pide destinatarios u olvida tokens.
        await actingAs(DEV1);
        assert.equal(
          await code(`select * from public.group_message_push_targets('${message}')`),
          '42501'
        );
        assert.equal(await code(`select public.forget_push_tokens(array['${token(2)}'])`), '42501');
        await db.exec('reset role; set local role service_role;');
        await db.query(`select public.forget_push_tokens(array['${token(2)}'])`);
        await db.exec('reset role;');
        assert.equal((await one(`select count(*)::int as n from public.push_tokens`)).n, 2);

        // Al salir, su token sigue (es del dispositivo), pero ya no es destinatario.
        await actingAs(DEV1);
        await one(`select public.register_push_token('${token(2)}', 'ios')`);
        await one(`select public.leave_group()`);
        assert.deepEqual(await targets(), []);
      })
    );

    await t.test(
      'el flag de Premium está apagado y la unión toma el cerrojo antes de mirar',
      async () => {
        await db.exec('reset role;');
        assert.equal((await one('select public.group_creation_requires_premium() as v')).v, false);
        const body = (
          await one(`select prosrc from pg_proc where proname = 'join_group_if_possible'`)
        ).prosrc;
        assert.ok(
          body.indexOf('pg_advisory_xact_lock') < body.indexOf('from public.group_members'),
          'el cerrojo por persona va antes de la primera lectura'
        );
      }
    );
  } finally {
    await db.close();
  }
});
