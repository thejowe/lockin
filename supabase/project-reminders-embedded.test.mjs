import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const migrations = new URL('./migrations/', import.meta.url);
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const [ana, bea, outsider, match, project, task, meeting, event] = Array.from(
  { length: 8 },
  (_, i) => id(i + 1)
);

test('Project tasks and push deliveries use the active workspace, preferences, and current assignments', async () => {
  const db = new PGlite();
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const targets = (eventId = null) =>
    rows('select * from public.project_push_targets($1)', [eventId]);
  const asUser = async (actor) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
    await db.exec('set role authenticated');
  };
  const changeTask = (props) =>
    db.exec(`update public.chat_plan_items set ${props} where id='${task}'`);
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    for (const name of readdirSync(migrations)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (name.endsWith('_project_tasks_and_notifications.sql')) {
        await db.exec(`
          create or replace function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
          insert into auth.users(id) values ('${ana}'),('${bea}'),('${outsider}');
          insert into public.profiles(id,name,age,location,timezone,avatar_initials,specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
            select id,'Profile',30,'Madrid','Europe/Madrid','PF',array['dev']::public.specialty[],'par','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado' from auth.users;
          insert into public.matches(id,profile_a,profile_b,mode) values('${match}','${ana}','${bea}','par');
          insert into public.chat_plan_items(id,match_id,author_id,title,closed) values('${task}','${match}','${ana}','Boceto',true);
          insert into public.chat_plan_items(id,match_id,author_id,title,starts_at)
            values('${meeting}','${match}','${bea}','Primera reunión',now()+interval '14 minutes');
        `);
      }
      await db.exec(readFileSync(new URL(name, migrations), 'utf8'));
    }
    assert.equal(
      (await rows('select status from public.chat_plan_items where id=$1', [task]))[0].status,
      'done'
    );
    await asUser(ana);
    await assert.rejects(changeTask("status='in_progress'"), /invalid project task/i);
    await changeTask('closed=false');
    assert.equal(
      (await rows('select status from public.chat_plan_items where id=$1', [task]))[0].status,
      'pending'
    );
    await db.exec('reset role');
    await db.exec(`
      insert into public.profile_projects(id,owner_id,name,tagline,joint,published)
        values('${project}','${ana}','Boceto','Una idea compartida',true,false);
      insert into public.project_authors(project_id,user_id) values('${project}','${bea}');
      insert into public.project_workspaces(project_id,match_id) values('${project}','${match}');
      insert into public.user_settings(user_id,locale) values('${ana}','es'),('${bea}','ca');
      insert into public.push_tokens(token,user_id,platform)
        select 'ExponentPushToken['||id||']',id,'ios' from auth.users;
    `);

    await asUser(bea);
    await changeTask(`assignee_id='${ana}',due_at=now()+interval '23 hours',status='in_progress'`);
    await assert.rejects(changeTask(`assignee_id='${outsider}'`), /invalid project task/i);
    await assert.rejects(
      db.exec(`update public.chat_plan_items set due_at=now() where id='${meeting}'`),
      /invalid project task/i
    );
    await asUser(outsider);
    assert.equal(
      (await rows('select * from public.chat_plan_items where match_id=$1', [match])).length,
      0
    );
    assert.equal(
      (
        await rows("update public.chat_plan_items set status='done' where id=$1 returning id", [
          task,
        ])
      ).length,
      0
    );
    await assert.rejects(targets(), /permission denied/i);
    await assert.rejects(
      rows('select * from public.project_push_deliveries'),
      /permission denied/i
    );
    await asUser(ana);
    await changeTask("status='done'");
    assert.equal(
      (await rows('select closed from public.chat_plan_items where id=$1', [task]))[0].closed,
      true
    );
    await changeTask("status='pending'");

    await db.exec('reset role');
    await db.exec(`
      update public.chat_plan_items set due_at=now()+interval '25 hours' where id='${task}';
      update public.chat_plan_items set starts_at=now()+interval '16 minutes' where id='${meeting}';
    `);
    assert.equal((await targets()).length, 0, 'future notifications wait for their window');
    await db.exec(`
      update public.chat_plan_items set due_at=now()+interval '23 hours' where id='${task}';
      update public.chat_plan_items set starts_at=now()+interval '14 minutes' where id='${meeting}';
      update public.user_settings set notify_reminders=false where user_id='${bea}';
      insert into public.project_events(id,match_id,project_id,actor_id,kind)
        values('${event}','${match}','${project}','${ana}','created');
    `);
    const activity = await targets(event);
    assert.equal(activity.length, 1);
    assert.equal(activity[0].event_kind, 'created');
    assert.equal(activity[0].locale, 'ca');
    assert.equal(activity[0].token, 'ExponentPushToken[' + bea + ']');
    assert.equal((await targets(event)).length, 0);
    const reminders = await targets();
    assert.deepEqual(reminders.map((r) => r.event_kind).sort(), ['meeting', 'task']);
    assert.ok(reminders.every((r) => r.token === 'ExponentPushToken[' + ana + ']'));
    assert.equal((await targets()).length, 0);
    await db.query('select public.complete_project_push($1)', [
      [...activity, ...reminders].map((r) => r.notice_id),
    ]);
    await db.exec(
      "update public.project_push_deliveries set claimed_at=now()-interval '10 minutes'"
    );
    assert.equal((await targets()).length, 0);
    // A moved deadline is a fresh occurrence. Completion before a retry suppresses it.
    await asUser(bea);
    await changeTask("due_at=now()+interval '22 hours',assignee_id=null");
    await db.exec('reset role');
    assert.deepEqual(
      (await targets()).map((r) => r.event_kind),
      ['task']
    );
    await db.exec(
      "update public.project_push_deliveries set claimed_at=now()-interval '10 minutes' where not delivered"
    );
    await asUser(ana);
    await changeTask('closed=true');
    await db.exec('reset role');
    assert.equal((await targets()).length, 0);
    await db.exec(
      `update public.user_settings set notify_messages=false,notify_reminders=true where user_id='${bea}'`
    );
    await asUser(bea);
    await db.exec(`update public.chat_plan_items set closed=true where id='${meeting}'`);
    await db.exec('reset role');
    assert.equal((await targets()).length, 0, 'cancelled meeting');
    await asUser(ana);
    await db.exec(`update public.chat_plan_items set closed=false where id='${meeting}'`);
    await db.exec('reset role');
    assert.deepEqual(
      (await targets()).map((r) => r.event_kind),
      ['meeting']
    );

    const proposal = id(9);
    await db.exec(`
      update public.project_workspaces set proposed_by='${ana}' where project_id='${project}';
      insert into public.project_events(id,match_id,project_id,actor_id,kind)
        values('${proposal}','${match}','${project}','${ana}','proposed');
    `);
    assert.equal((await targets(proposal)).length, 0, 'messages disabled');
    await db.exec(`update public.user_settings set notify_messages=true where user_id='${bea}'`);
    assert.deepEqual(
      (await targets(proposal)).map((r) => r.event_kind),
      ['proposed']
    );
    await db.exec(`
      update public.project_workspaces set proposed_by=null;
      update public.project_push_deliveries set claimed_at=now()-interval '10 minutes';
    `);
    assert.equal((await targets(proposal)).length, 0, 'stale proposal suppressed');
    const deletion = id(10);
    await db.exec(`
      delete from public.profile_projects where id='${project}';
      insert into public.project_events(id,match_id,project_id,actor_id,kind)
        values('${deletion}','${match}','${project}','${bea}','deleted');
    `);
    assert.deepEqual(
      (await targets(deletion)).map((r) => r.token),
      ['ExponentPushToken[' + ana + ']']
    );
    await asUser(ana);
    await db.query('select public.block_profile($1)', [bea]);
    await db.exec(
      "reset role; update public.project_push_deliveries set claimed_at=now()-interval '10 minutes'"
    );
    assert.equal((await targets()).length, 0);
  } finally {
    await db.close();
  }
});
