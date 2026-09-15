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
const rating = read('session-rate.yaml');
const streakFlow = read('session-streak.yaml');
const streak = read('../src/features/session/streak.ts');
const fixture = read('session-now.sql');
const runner = read('run.mjs');
const verify = read('verify.mjs');
const card = read('../src/features/session/session-card.tsx');
const chips = read('../src/features/session/rating-chips.tsx');
const labels = read('../src/features/session/rating.ts');
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

describe('session-rate.yaml', () => {
  it('toca etiquetas que existen en la tarjeta del chat', () => {
    assert.match(rating, /visible: '¿Qué tal fue la sesión con \.\*'/);
    assert.match(card, /¿Qué tal fue la sesión con \$\{name\}\?/);
    assert.match(rating, /tapOn: 'Genial'/);
    assert.match(chips, /accessibilityLabel=\{label\}/);
    assert.match(labels, /genial: 'Genial'/);
    assert.match(rating, /visible: 'Gracias — solo lo ves tú'/);
    assert.match(card, /Gracias — solo lo ves tú/);
  });

  it('no borra el estado: valora la sesión que acaba de vivir session.yaml', () => {
    assert.match(rating, /clearState: false/);
    assert.doesNotMatch(rating, /clearState: true/);
  });

  it('el runner lo encadena tras envejecer la sesión, y comprueba la valoración', () => {
    assert.match(runner, /e2e\/session-rate\.yaml/);
    assert.match(runner, /await prepareSessionRating\(status, profileName\);/);
    assert.match(runner, /await verifySessionRating\(status, profileName\);/);
    // El orden importa: sin envejecer antes, la sesión sigue viva y la tarjeta
    // no llega a preguntar. Sin el oráculo después, el toque no se comprueba.
    // Se ancla en `ratingFile,`, que es el argumento del spawn, y no en la ruta
    // del `.yaml`, que aparece antes en la declaración de la constante.
    const aged = runner.indexOf('await prepareSessionRating(');
    const flowRun = runner.indexOf('ratingFile,');
    const checked = runner.indexOf('await verifySessionRating(');
    assert(aged < flowRun, 'Hay que envejecer la sesión antes de lanzar el flujo');
    assert(flowRun < checked, 'El oráculo va después del flujo, no antes');
  });

  it('el envejecido mueve joined_at y no solo starts_at', () => {
    // Si solo se moviera `starts_at`, la entrada real quedaría posterior al
    // nuevo final y la sesión dejaría de contar como asistida por los dos.
    assert.match(verify, /\.update\(\{ joined_at: joinedAt\.toISOString\(\)/);
    assert.match(verify, /starts_at: startsAt\.toISOString\(\)/);
  });
});

describe('session-streak.yaml', () => {
  it('espera etiquetas que salen de streakLine', () => {
    // El `.yaml` escribe el texto que pinta `streakLine(2)`; si la plantilla
    // cambia, esto falla aquí y no media hora después en el emulador.
    assert.match(
      streak,
      /streakLine = \(count: number\) => `Racha de \$\{count\} sesiones seguidas`/
    );
    assert.match(streakFlow, /visible: 'Conversación con \.\*Racha de 2 sesiones seguidas\.\*'/);
    assert.match(streakFlow, /tapOn: 'Conversación con \.\*Racha de 2 sesiones seguidas\.\*'/);
    assert.match(streakFlow, /visible: 'Racha de 2 sesiones seguidas'\r?\n/);
  });

  it('no borra el estado: la racha cuelga del match de las sesiones anteriores', () => {
    assert.match(streakFlow, /clearState: false/);
    assert.doesNotMatch(streakFlow, /clearState: true/);
  });

  it('el runner lo encadena después de session-rate.yaml y de su oráculo', () => {
    assert.match(runner, /e2e\/session-streak\.yaml/);
    assert.match(runner, /await prepareSessionStreak\(status, profileName\);/);
    assert.match(runner, /streak: 'verified'/);
    // Anclado en los argumentos del spawn, como en session-rate.yaml.
    const rated = runner.indexOf('await verifySessionRating(');
    const seeded = runner.indexOf('await prepareSessionStreak(');
    const flowRun = runner.indexOf('streakFile,');
    assert(rated < seeded, 'Se siembra después de comprobar la valoración');
    assert(seeded < flowRun, 'Se siembra antes de lanzar el flujo');
    assert(runner.indexOf('ratingFile,') < flowRun, 'La racha va después de la valoración');
  });

  it('la sesión sembrada queda fuera de las 24 h y a menos de 7 días de la envejecida', () => {
    const days = Number(verify.match(/export const STREAK_SEED_DAYS_AGO = (\d+);/)?.[1]);
    // Un bloque de 30 min: la sembrada terminó `days * 24 − 0,5` horas atrás, y
    // la ventana de valoración se cierra 24 h después del final.
    const endedHoursAgo = days * 24 - 0.5;
    assert(endedHoursAgo > 24, 'Dentro de la ventana de valoración competiría con la valorada');
    // La envejecida empezó hace menos de una hora, así que el hueco entre el
    // final de la sembrada y ese inicio es menor que `endedHoursAgo`.
    assert(endedHoursAgo < 7 * 24, 'A 7 días o más la racha se rompería');
    assert.match(verify, /Date\.now\(\) - STREAK_SEED_DAYS_AGO \* 24 \* 60 \* 60_000/);
    assert.match(verify, /blocks: 1,/);
    assert.match(verify, /status: 'aceptada',/);
    assert.match(verify, /responded_at: startsAt\.toISOString\(\)/);
  });
});
