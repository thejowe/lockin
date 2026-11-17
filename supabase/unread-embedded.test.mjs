// Mensajes sin leer (`20261117120000_chat_reads.sql`) sobre PGlite, sin Docker.
// Se corre con `npm run test:schema`, como el resto de `*-embedded.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { SUPABASE_FIXTURE_SQL } from './embedded-bootstrap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const C = '00000000-0000-4000-8000-0000000000c3';
const MATCH_AB = '00000000-0000-4000-8000-0000000000d4';
const MATCH_BC = '00000000-0000-4000-8000-0000000000e5';
const GROUP = '00000000-0000-4000-8000-0000000000f6';

test('Sin leer: contador por chat, marca de lectura, bloqueos y permisos', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_FIXTURE_SQL);
    const migrations = readdirSync(join(here, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of migrations) {
      // Los datos previos a la migración: así se prueba la siembra.
      if (file === '20261117120000_chat_reads.sql') {
        await db.exec(`insert into auth.users(id) values ('${A}'),('${B}'),('${C}');
          insert into public.profiles(id,name,age,location,timezone,avatar_initials,specialties,looking_for,starting_point,availability_hours_per_week,availability_bands,ambition)
          select id,'Persona',30,'Madrid','Europe/Madrid','PE',array['dev']::public.specialty[],'par','solo-ganas',10,array['tarde']::public.time_band[],'equilibrado' from auth.users;
          insert into public.matches(id,profile_a,profile_b,mode) values ('${MATCH_AB}','${A}','${B}','par');
          insert into public.messages(match_id,sender_id,body,sent_at) values ('${MATCH_AB}','${B}','viejo',now()-interval '1 day');`);
      }
      await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
    }
    // Idempotente: se puede volver a aplicar.
    await db.exec(readFileSync(join(here, 'migrations', '20261117120000_chat_reads.sql'), 'utf8'));

    const act = (user) =>
      db.exec(
        `reset role; create or replace function auth.uid() returns uuid language sql as $$ select '${user}'::uuid $$; set role authenticated;`
      );
    const counts = async (user) => {
      await act(user);
      const rows = (
        await db.query('select chat_kind, chat_id, unread from public.unread_message_counts()')
      ).rows;
      await db.exec('reset role');
      return Object.fromEntries(rows.map((row) => [`${row.chat_kind}:${row.chat_id}`, row.unread]));
    };
    const asOwner = (sql) => db.exec(`reset role; ${sql}`);
    const tx = async (fn) => {
      await db.exec('begin');
      try {
        await fn();
      } finally {
        await db.exec('rollback; reset role');
      }
    };

    await t.test('lo que existía al desplegar cuenta como leído', async () => {
      assert.deepEqual(await counts(A), {});
    });

    await t.test('cuenta los mensajes de la otra persona, no los tuyos', () =>
      tx(async () => {
        await asOwner(`insert into public.messages(match_id,sender_id,body) values
          ('${MATCH_AB}','${B}','uno'),('${MATCH_AB}','${B}','dos'),('${MATCH_AB}','${A}','mío');`);
        assert.deepEqual(await counts(A), { [`match:${MATCH_AB}`]: 2 });
        assert.deepEqual(await counts(B), { [`match:${MATCH_AB}`]: 1 });
      })
    );

    await t.test('marcar como leído pone el chat a cero y solo avanza', () =>
      tx(async () => {
        await asOwner(
          `insert into public.messages(match_id,sender_id,body) values ('${MATCH_AB}','${B}','uno')`
        );
        await act(A);
        await db.query(`select public.mark_chat_read('match','${MATCH_AB}')`);
        assert.deepEqual(await counts(A), {});
        // Uno posterior a la marca vuelve a contar.
        await asOwner(`insert into public.messages(match_id,sender_id,body,sent_at)
          values ('${MATCH_AB}','${B}','nuevo',clock_timestamp()+interval '1 second')`);
        assert.deepEqual(await counts(A), { [`match:${MATCH_AB}`]: 1 });
      })
    );

    await t.test('match nuevo sin marca: cuenta todo lo recibido', () =>
      tx(async () => {
        await asOwner(`insert into public.matches(id,profile_a,profile_b,mode) values ('${MATCH_BC}','${B}','${C}','par');
          insert into public.messages(match_id,sender_id,body) values ('${MATCH_BC}','${B}','hola');`);
        assert.deepEqual(await counts(C), { [`match:${MATCH_BC}`]: 1 });
      })
    );

    await t.test('con un bloqueo de por medio el chat no cuenta', () =>
      tx(async () => {
        await asOwner(`insert into public.messages(match_id,sender_id,body) values ('${MATCH_AB}','${B}','uno');
          insert into public.user_blocks(blocker_id,blocked_id) values ('${A}','${B}');`);
        assert.deepEqual(await counts(A), {});
      })
    );

    await t.test('grupo: cuenta desde que entraste y sin bloqueados', () =>
      tx(async () => {
        await asOwner(`insert into public.groups(id,name,description,admin_id) values ('${GROUP}','Equipo','Un proyecto con gancho','${A}');
          insert into public.group_members(group_id,user_id,joined_at) values
            ('${GROUP}','${A}',now()-interval '3 days'),('${GROUP}','${B}',now()-interval '3 days'),('${GROUP}','${C}',now()-interval '1 day');
          insert into public.group_messages(group_id,sender_id,body,sent_at) values
            ('${GROUP}','${B}','antes de C',now()-interval '2 days'),
            ('${GROUP}','${B}','después',now()-interval '1 hour'),
            ('${GROUP}','${A}','del admin',now()-interval '1 hour');`);
        assert.deepEqual(await counts(C), { [`group:${GROUP}`]: 2 });
        assert.deepEqual(await counts(A), { [`group:${GROUP}`]: 2 });
        await asOwner(
          `insert into public.user_blocks(blocker_id,blocked_id) values ('${C}','${B}')`
        );
        assert.deepEqual(await counts(C), { [`group:${GROUP}`]: 1 });
        await act(C);
        await db.query(`select public.mark_chat_read('group','${GROUP}')`);
        assert.deepEqual(await counts(C), {});
      })
    );

    await t.test('no puedes marcar un chat ajeno', () =>
      tx(async () => {
        await asOwner(
          `insert into public.matches(id,profile_a,profile_b,mode) values ('${MATCH_BC}','${B}','${C}','par')`
        );
        await act(A);
        await assert.rejects(db.query(`select public.mark_chat_read('match','${MATCH_BC}')`), {
          code: '42501',
        });
      })
    );

    await t.test('ni un tipo de chat inventado', () =>
      tx(async () => {
        await act(A);
        await assert.rejects(db.query(`select public.mark_chat_read('otro','${MATCH_AB}')`), {
          code: '22023',
        });
      })
    );

    await t.test('la tabla no se lee ni se escribe desde el cliente', () =>
      tx(async () => {
        await act(A);
        await assert.rejects(db.query('select * from public.chat_reads'), { code: '42501' });
      })
    );

    await t.test('anon no puede llamar a las RPC', () =>
      tx(async () => {
        await db.exec('set role anon');
        await assert.rejects(db.query('select * from public.unread_message_counts()'), {
          code: '42501',
        });
      })
    );
  } finally {
    await db.close();
  }
});
