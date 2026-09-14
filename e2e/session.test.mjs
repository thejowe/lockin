/**
 * Guardia de `session.yaml`: lo que el emulador toca tiene que existir en el
 * código, y el fixture tiene que reconocer el mensaje que teclea el recorrido.
 * Falla en segundos en vez de media hora después en Actions.
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

const flow = read('session.yaml');
const fixture = read('session-now.sql');
const runner = read('run.mjs');
const card = read('../src/features/session/session-card.tsx');
const screen = read('../src/app/session/[sessionId].tsx');

describe('session.yaml', () => {
  it('toca etiquetas que existen en la tarjeta y en la pantalla', () => {
    assert.match(flow, /tapOn: 'Entrar a la sesión'/);
    assert.match(card, /label="Entrar a la sesión"/);
    assert.match(flow, /tapOn: 'Salir'\r?\n/);
    assert.match(screen, /label="Salir"/);
    assert.match(flow, /tapOn: 'Salir de la sesión'/);
    assert.match(screen, /label="Salir de la sesión"/);
  });

  it('no borra el estado: la sesión cuelga del match que deja full-journey.yaml', () => {
    assert.match(flow, /clearState: false/);
    assert.doesNotMatch(flow, /clearState: true/);
  });

  it('el fixture reconoce el mensaje que teclea el recorrido', () => {
    assert.match(runner, /const message = 'Mensaje E2E ' \+ runId;/);
    assert.match(fixture, /like 'Mensaje E2E %'/);
  });

  it('el runner lo ejecuta tras el oráculo del recorrido y comprueba la asistencia', () => {
    assert.match(runner, /e2e\/session\.yaml/);
    assert.match(runner, /e2e\/session-now\.sql/);
    assert.match(runner, /await verifySessionAttendance\(status, profileName\);/);
  });
});
