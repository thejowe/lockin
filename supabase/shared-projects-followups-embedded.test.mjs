import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

// 20261120100000_shared_projects_followups.sql: interruptor de fotos, versión
// mínima, proyecto desvinculado de quien se queda, pareja cerrada tras deshacer
// el match, orden por autor y versión de las tareas.
const migrations = new URL('./migrations/', import.meta.url);
const [a, b, reader] = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
const storageFixture = `create schema storage;
  create table storage.objects(bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select on storage.objects to authenticated;
  create function storage.allow_only_operation(op text) returns boolean language sql stable as
  $$select current_setting('storage.test_operation',true) = op$$;`;

test('seguimiento de proyectos compartidos antes de producción', async (t) => {
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
  const newMatch = async () => {
    const id = randomUUID();
    await admin();
    await db.query(
      "insert into public.matches(id,profile_a,profile_b,mode) values($1,$2,$3,'par')",
      [id, a, b]
    );
    return id;
  };
  const card = (project, photo = true) => ({
    name: 'Atlas',
    tagline: 'Un mapa',
    description: '',
    link: '',
    cover_path: photo ? `shared/${project}/project-cover.jpg` : null,
    photo_paths: [],
  });
  const create = async (match, photo = true) => {
    const project = randomUUID();
    await service();
    await db.query('select public.commit_moderated_project($1,$2,null,$3,$4,$5)', [
      a,
      project,
      match,
      'save',
      card(project, photo),
    ]);
    return project;
  };
  const revisionOf = async (project) => {
    await admin();
    return (await rows('select revision from public.profile_projects where id=$1', [project]))[0]
      .revision;
  };
  const publication = async (actor, project, action) => {
    const revision = await revisionOf(project);
    await as(actor);
    return db.query('select public.set_project_publication($1,$2,$3)', [project, revision, action]);
  };
  // Dentro de `isolated`, un error aborta la transacción: cada rechazo esperado va en su savepoint.
  const fails = async (run, code) => {
    await db.exec('savepoint expected');
    await assert.rejects(run(), { code });
    await db.exec('rollback to savepoint expected');
  };
  const isolated = async (body) => {
    await admin();
    await db.exec('begin');
    try {
      await body();
    } finally {
      await db.exec('rollback');
    }
  };

  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const file of readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (file.endsWith('_profile_projects.sql')) await db.exec(storageFixture);
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    await db.exec(
      "create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$"
    );
    for (const id of [a, b, reader]) await createProfile(id);

    await t.test('la configuración se lee sin sesión y nace apagada', async () => {
      await admin();
      await db.exec('set role anon');
      assert.deepEqual(
        await rows(
          'select shared_project_photos, min_ios_version, min_android_version from public.app_config'
        ),
        [{ shared_project_photos: false, min_ios_version: '0.0.0', min_android_version: '0.0.0' }]
      );
      await assert.rejects(db.query("update public.app_config set min_ios_version='9.9.9'"), {
        code: '42501',
      });
      await as(a);
      await assert.rejects(db.query('update public.app_config set shared_project_photos=true'), {
        code: '42501',
      });
    });

    await t.test('con el interruptor apagado no se publica nada compartido con fotos', () =>
      isolated(async () => {
        const match = await newMatch();
        const project = await create(match);
        // En privado funciona: los dos autores la ven.
        await as(b);
        assert.equal((await rows('select id from public.profile_projects')).length, 1);
        await fails(() => publication(a, project, 'propose'), 'PJ423');
        // Sin fotos sí se puede proponer y aceptar.
        const plain = await create(
          await (async () => {
            await admin();
            await db.query('delete from public.project_workspaces where project_id=$1', [project]);
            return match;
          })(),
          false
        );
        await publication(a, plain, 'propose');
        await publication(b, plain, 'accept');
        await as(reader);
        assert.equal(
          (await rows('select id from public.profile_projects where id=$1', [plain])).length,
          1
        );
        // Añadir una foto a una ficha publicada se rechaza.
        const revision = await revisionOf(plain);
        await service();
        await fails(
          () =>
            db.query('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
              a,
              plain,
              revision,
              'save',
              card(plain),
            ]),
          'PJ423'
        );
        // Si se apaga después de publicar con fotos, quien no es autor deja de verla.
        await admin();
        await db.exec('update public.app_config set shared_project_photos=true');
        await service();
        await db.query('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
          a,
          plain,
          revision,
          'save',
          card(plain),
        ]);
        await as(reader);
        assert.equal(
          (await rows('select id from public.profile_projects where id=$1', [plain])).length,
          1
        );
        await admin();
        await db.exec('update public.app_config set shared_project_photos=false');
        await as(reader);
        assert.deepEqual(
          await rows('select id from public.profile_projects where id=$1', [plain]),
          []
        );
        await as(b);
        assert.equal(
          (await rows('select id from public.profile_projects where id=$1', [plain])).length,
          1
        );
      })
    );

    await t.test('un grupo de proyecto con fotos no se crea con el interruptor apagado', () =>
      isolated(async () => {
        const project = randomUUID();
        await service();
        const group = {
          name: 'Equipo',
          description: 'Crear juntos una app',
          roles: [{ specialty: 'dev', slots: 1 }],
          maxMembers: 3,
        };
        await fails(
          () =>
            db.query('select public.create_moderated_group_project($1,$2,$3,$4)', [
              a,
              project,
              group,
              card(project),
            ]),
          'PJ423'
        );
        const [{ created }] = await rows(
          'select public.create_moderated_group_project($1,$2,$3,$4) as created',
          [a, project, group, card(project, false)]
        );
        assert.equal(created, true);
      })
    );

    await t.test(
      'tras un bloqueo, el proyecto pasa a ser de perfil y privado de quien se queda',
      () =>
        isolated(async () => {
          const match = await newMatch();
          const project = await create(match, false);
          await publication(a, project, 'propose');
          await publication(b, project, 'accept');
          // Quien bloquea se va; quien recibe el bloqueo se queda el proyecto.
          await as(b);
          await db.query('select public.block_profile($1)', [a]);
          assert.deepEqual(
            await rows('select id from public.profile_projects where id=$1', [project]),
            []
          );
          await as(a);
          const [row] = await rows(
            'select owner_id, published, detached from public.profile_projects where id=$1',
            [project]
          );
          assert.deepEqual(row, { owner_id: a, published: false, detached: true });
          // Lo publica y lo vuelve a privado sin pedir permiso a nadie.
          await publication(a, project, 'publish');
          await as(reader);
          assert.equal(
            (await rows('select id from public.profile_projects where id=$1', [project])).length,
            1
          );
          await publication(a, project, 'private');
          await as(reader);
          assert.deepEqual(
            await rows('select id from public.profile_projects where id=$1', [project]),
            []
          );
          await fails(() => publication(b, project, 'publish'), '42501');
          await fails(() => publication(a, project, 'propose'), '22023');
          // Lo edita y lo borra como cualquier proyecto suyo.
          const revision = await revisionOf(project);
          await service();
          await db.query('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
            a,
            project,
            revision,
            'save',
            { ...card(project, false), name: 'Atlas solo' },
          ]);
          await db.query('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
            a,
            project,
            await revisionOf(project),
            'remove',
            {},
          ]);
          await admin();
          assert.deepEqual(
            await rows('select id from public.profile_projects where id=$1', [project]),
            []
          );
        })
    );

    await t.test('publicar un proyecto desvinculado respeta el máximo de tres', () =>
      isolated(async () => {
        const match = await newMatch();
        const project = await create(match, false);
        await as(a);
        await db.query('select public.leave_project_match($1)', [match]);
        await service();
        for (let n = 0; n < 3; n++) {
          await db.query('select public.commit_moderated_project($1,$2,null,null,$3,$4)', [
            b,
            randomUUID(),
            'save',
            { ...card(project, false), name: 'Personal ' + n },
          ]);
        }
        await fails(() => publication(b, project, 'publish'), 'PJ003');
      })
    );

    await t.test('un match deshecho no vuelve: ni con un like repetido ni en el deck', () =>
      isolated(async () => {
        const match = await newMatch();
        await admin();
        await db.query(
          "insert into public.decisions(actor_id,target_id,decision) values($1,$2,'like'),($2,$1,'like')",
          [a, b]
        );
        await as(a);
        await db.query('select public.leave_project_match($1)', [match]);
        await admin();
        const charged = async () =>
          (await rows('select count(*)::int as n from public.like_events'))[0].n;
        const before = await charged();
        for (const [actor, target] of [
          [a, b],
          [b, a],
        ]) {
          await as(actor);
          const [{ record_decision: made }] = await rows(
            "select public.record_decision($1,'like') is not null as record_decision",
            [target]
          );
          assert.equal(made, false);
        }
        await admin();
        assert.deepEqual(await rows('select id from public.matches'), []);
        // El like repetido no escribe ni gasta cupo.
        assert.equal(await charged(), before);
        // Ni pasadas las 48 horas.
        await db.exec("update public.decisions set created_at = now() - interval '30 days'");
        await db.query("update public.decisions set decision='pass' where actor_id=$1", [a]);
        for (const [actor, other] of [
          [a, b],
          [b, a],
        ]) {
          await as(actor);
          const deck = await rows('select id from public.discovery_deck()');
          assert.ok(!deck.some((row) => row.id === other));
        }
        await as(b);
        assert.deepEqual(
          (await rows('select match_id, closed_by from public.match_closures')).map(
            (r) => r.closed_by
          ),
          [a]
        );
        await as(reader);
        assert.deepEqual(await rows('select * from public.match_closures'), []);
        await as(reader);
        assert.equal(
          (await rows('select id from public.discovery_deck()')).some((row) => row.id === a),
          true
        );
      })
    );

    await t.test('«Mover al principio» solo cambia el orden de quien lo hace', () =>
      isolated(async () => {
        const match = await newMatch();
        const project = await create(match, false);
        await publication(a, project, 'propose');
        await publication(b, project, 'accept');
        const revision = await revisionOf(project);
        await service();
        await db.query('select public.commit_moderated_project($1,$2,$3,null,$4,$5)', [
          a,
          project,
          revision,
          'promote',
          {},
        ]);
        await admin();
        assert.deepEqual(
          (
            await rows(
              'select user_id, promoted_at is not null as promoted from public.project_authors where project_id=$1 order by user_id',
              [project]
            )
          ).map((r) => [r.user_id, r.promoted]),
          [
            [a, true],
            [b, false],
          ]
        );
        assert.equal(
          (await rows('select promoted_at from public.profile_projects where id=$1', [project]))[0]
            .promoted_at,
          null
        );
      })
    );

    await t.test('cada edición de una tarea cambia su versión', () =>
      isolated(async () => {
        const match = await newMatch();
        await create(match, false);
        const task = randomUUID();
        await as(a);
        await db.query(
          "insert into public.chat_plan_items(id,match_id,title) values($1,$2,'Tarea')",
          [task, match]
        );
        const [{ revision }] = await rows(
          'select revision from public.chat_plan_items where id=$1',
          [task]
        );
        await db.query(
          "update public.chat_plan_items set status='in_progress' where id=$1 and revision=$2",
          [task, revision]
        );
        await as(b);
        const stale = await db.query(
          "update public.chat_plan_items set status='done' where id=$1 and revision=$2 returning id",
          [task, revision]
        );
        assert.equal(stale.rows.length, 0);
        const [{ status }] = await rows('select status from public.chat_plan_items where id=$1', [
          task,
        ]);
        assert.equal(status, 'in_progress');
      })
    );
  } finally {
    await db.close();
  }
});
