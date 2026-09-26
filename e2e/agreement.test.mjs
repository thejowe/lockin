/**
 * Guardia de `agreement.yaml`: lo que el emulador toca tiene que existir en el
 * código, la siembra tiene que coincidir con lo que responde el flujo, y el
 * runner tiene que lanzarlo después de la racha. Falla en segundos en vez de
 * media hora después en Actions.
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

const flow = read('agreement.yaml');
const runner = read('run.mjs');
const verify = read('verify.mjs');
const seed = read('../supabase/seed.sql');
const card = read('../src/features/agreement/agreement-card.tsx');
const row = read('../src/features/agreement/topic-row.tsx');
const topics = read('../src/features/agreement/topics.ts');
const screen = read('../src/app/agreement/[matchId].tsx');

describe('agreement.yaml', () => {
  it('toca y espera etiquetas que existen en la tarjeta, la pantalla y la fila', () => {
    assert.match(flow, /visible: 'Acuerdo de socios\.\*'/);
    assert.match(flow, /tapOn: 'Acuerdo de socios\.\*'/);
    assert.match(card, /<ThemedText type="bodyStrong">Acuerdo de socios<\/ThemedText>/);

    assert.match(flow, /visible: '\.\*Esto no es un contrato ni asesoría legal\.\*'/);
    assert.match(screen, /'Esto no es un contrato ni asesoría legal\./);

    assert.match(flow, /tapOn: '¿Cuánto tiempo le vas a dedicar los próximos 6 meses\\[?]\.\*'/);
    assert.match(topics, /question: '¿Cuánto tiempo le vas a dedicar los próximos 6 meses\?'/);

    assert.match(flow, /tapOn: 'Jornada completa'/);
    assert.match(topics, /\{ key: 'completa', label: 'Jornada completa' \}/);
    assert.match(row, /accessibilityLabel=\{candidate\.label\}/);

    assert.match(flow, /element: 'Guardar respuesta'/);
    assert.match(flow, /tapOn: 'Guardar respuesta'/);
    assert.match(row, /accessibilityLabel="Guardar respuesta"/);

    assert.match(flow, /visible: '\.\*Coincidís\.\*'/);
    assert.match(row, /coincidis: 'Coincidís'/);
  });

  it('la revelación que espera es la que siembra prepareAgreement', () => {
    // Mismo tema y misma opción que toca el flujo: si no, sale «Distinto».
    assert.match(
      verify,
      /topic: 'dedicacion',\s+option: 'completa',\s+note: 'Lo dejo todo por esto\.'/
    );
    assert.match(topics, /key: 'dedicacion'/);
    assert.match(flow, /assertVisible: '\.\*Núria Bosch: «Lo dejo todo por esto\\[.]»\.\*'/);
    assert.match(row, /`\$\{counterpartName\}: «\$\{theirs\.note\}»`/);
    assert.match(seed, /'Núria Bosch'/);
  });

  it('no borra el estado: el acuerdo cuelga del match que deja full-journey.yaml', () => {
    assert.match(flow, /clearState: false/);
    assert.doesNotMatch(flow, /clearState: true/);
  });

  it('el runner lo encadena después de session-streak.yaml, con siembra y oráculo', () => {
    assert.match(runner, /e2e\/agreement\.yaml/);
    assert.match(runner, /agreement: 'verified'/);
    // Anclado en los argumentos del spawn, como los demás encadenados.
    const streakRun = runner.indexOf('streakFile,');
    const seeded = runner.indexOf('await prepareAgreement(status, profileName);');
    const flowRun = runner.indexOf('agreementFile,');
    const checked = runner.indexOf('await verifyAgreementAnswer(status, profileName);');
    assert(streakRun !== -1 && seeded !== -1 && flowRun !== -1 && checked !== -1);
    assert(streakRun < seeded, 'El acuerdo va después de la racha');
    assert(seeded < flowRun, 'Se siembra antes de lanzar el flujo');
    assert(flowRun < checked, 'El oráculo va después del flujo, no antes');
  });

  it('el runner le pasa el mensaje con el que encuentra la conversación', () => {
    assert.match(flow, /assertTrue: \$\{MESSAGE\}/);
    assert.match(flow, /tapOn: 'Conversación con \.\*\$\{MESSAGE\}\.\*'/);
    const flowRun = runner.indexOf('agreementFile,');
    const spawn = runner.lastIndexOf('spawnSync(', flowRun);
    assert.match(runner.slice(spawn, flowRun), /'MESSAGE=' \+ message,/);
  });
});
