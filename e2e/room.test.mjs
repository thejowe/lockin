/**
 * Guardia de `room.yaml`: lo que el emulador toca tiene que existir en el
 * código, la siembra tiene que dejar la sala que el flujo espera, el reloj de
 * la siembra y la espera del flujo tienen que cuadrar, y el runner tiene que
 * lanzarlo después del acuerdo. Falla en segundos en vez de media hora después
 * en Actions.
 *
 * Corre con `node --test` (`npm run test:e2e`). En Windows este script arrastra
 * los mismos problemas de CRLF que el resto de `e2e/`; la referencia es CI.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(here, path), 'utf8');

const flow = read('room.yaml');
const runner = read('run.mjs');
const verify = read('verify.mjs');
const seed = read('../supabase/seed.sql');
const rules = read('../src/data/rooms.ts');
const sessions = read('../src/data/sessions.ts');
const rowView = read('../src/features/room/row-view.ts');
const row = read('../src/features/room/room-row.tsx');
const screen = read('../src/app/room/[roomId].tsx');

describe('room.yaml', () => {
  it('toca y espera etiquetas que existen en la fila y en la pantalla de la sala', () => {
    assert.match(flow, /visible: '\.\*te invita\.\*'/);
    assert.match(flow, /tapOn: '\.\*te invita\.\*'/);
    assert.match(rowView, /`\$\{name\} te invita`/);
    assert.match(row, /accessibilityLabel=\{`\$\{title\} · \$\{detail\}`\}/);

    assert.match(flow, /tapOn: 'Me apunto'/);
    assert.match(screen, /<Button label="Me apunto"/);

    assert.match(flow, /visible: 'Empieza en'/);
    assert.match(screen, /if \(phase\.kind === 'antes'\) return 'Empieza en';/);

    assert.match(flow, /tapOn: 'Salir'\r?\n/);
    assert.match(screen, /<Button label="Salir" variant="secondary"/);
    assert.match(flow, /tapOn: 'Salir de la sala'/);
    assert.match(screen, /confirmLabel="Salir de la sala"/);

    assert.match(flow, /visible: 'Entrar a la sala\.\*'/);
    assert.match(rowView, /title: 'Entrar a la sala'/);
  });

  it('la siembra deja la sala que espera el flujo', () => {
    // Convoca la contraparte (la fila dice «{nombre} te invita») y la tercera
    // persona sale del seed.
    assert.match(verify, /\{ host_id: hostId, starts_at: startsAt\.toISOString\(\), blocks: 1 \}/);
    assert.match(verify, /'11111111-1111-4111-8111-000000000002'/);
    assert.match(seed, /'11111111-1111-4111-8111-000000000002', 'Marc Oller'/);
    // El usuario queda `invitada`: sin `status`, el valor por defecto.
    assert.match(verify, /\{ room_id: room\.id, profile_id: profile\.id \}/);
    assert.match(
      read('../supabase/migrations/20261002000100_lockin_rooms.sql'),
      /status public\.room_member_status not null default 'invitada'/
    );
  });

  it('la siembra y la espera cuadran con la ventana de entrada', () => {
    // La ventana de las salas es la de las sesiones 1:1.
    assert.match(rules, /import \{ JOIN_WINDOW_MINUTES, sessionEndsAtMs \} from '\.\/sessions';/);
    const window = Number(sessions.match(/JOIN_WINDOW_MINUTES = (\d+);/)?.[1]);
    const startsIn = Number(verify.match(/ROOM_SEED_STARTS_IN_MINUTES = (\d+);/)?.[1]);
    const wait = Number(flow.match(/visible: 'Empieza en'\r?\n\s+timeout: (\d+)/)?.[1]);
    assert.equal(window, 5);
    // Hay tiempo para responder antes de que se cierren las respuestas...
    assert(startsIn > window, 'La sala tiene que sembrarse fuera de la ventana');
    // ...y la espera cubre de sobra lo que falta hasta que abra la ventana.
    assert(wait >= (startsIn - window) * 60_000, 'La espera no llega a la apertura');
    assert.equal(startsIn, 7);
    assert.equal(wait, 180000);
  });

  it('no borra el estado: la sala cuelga del match que deja full-journey.yaml', () => {
    assert.match(flow, /clearState: false/);
    assert.doesNotMatch(flow, /clearState: true/);
  });

  it('el runner lo encadena después de agreement.yaml, con siembra y oráculo', () => {
    assert.match(runner, /e2e\/room\.yaml/);
    assert.match(runner, /room: 'verified'/);
    const agreementChecked = runner.indexOf('await verifyAgreementAnswer(status, profileName);');
    const seeded = runner.indexOf('const room = await prepareRoom(status, profileName);');
    const flowRun = runner.indexOf('roomFile,');
    const checked = runner.indexOf('await verifyRoomAttendance(status, profileName, room);');
    const abandon = runner.indexOf('maestroFlow(abandonDir, signInAbandonFile');
    assert(agreementChecked !== -1 && seeded !== -1 && flowRun !== -1 && checked !== -1);
    assert(agreementChecked < seeded, 'La sala va después del acuerdo');
    assert(seeded < flowRun, 'Se siembra antes de lanzar el flujo');
    assert(flowRun < checked, 'El oráculo va después del flujo, no antes');
    // Antes de entrar en otra cuenta: después, el perfil del recorrido ya no está.
    assert(abandon !== -1 && checked < abandon, 'La sala va antes de sign-in-abandon.yaml');
  });
});
