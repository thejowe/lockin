/**
 * Estos casos son el contrato del reintento del E2E, y el que importa es el
 * negativo: el fallo real de hoy —`Element not found: ... Enviar mensaje`, el
 * compositor de `chat` bajo el teclado— NO se reintenta. Si alguien relaja la
 * clasificación para "estabilizar" el workflow, aquí se rompe algo.
 *
 * Corren con `node --test` (`npm run test:e2e`), no con Jest: `run.mjs` y
 * `triage.mjs` son módulos de Node del runner, no código de la app, y no entran
 * ni en `testMatch` ni en la cobertura de `src/`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyFailure, parseMaestroFailure, shouldRetry } from './triage.mjs';

const ALIVE = 'device';

describe('parseMaestroFailure', () => {
  it('lee el mensaje del cuerpo del <failure>', () => {
    const xml =
      '<testsuites><testsuite><testcase><failure>Element not found: Enviar mensaje</failure></testcase></testsuite></testsuites>';
    assert.equal(parseMaestroFailure(xml), 'Element not found: Enviar mensaje');
  });

  it('lee también el atributo message, que es donde Maestro deja algunas causas', () => {
    const xml = '<testcase><failure message="DeviceServerDiedException" type="crash"/></testcase>';
    assert.match(parseMaestroFailure(xml), /DeviceServerDiedException/);
  });

  it('descodifica las entidades XML', () => {
    const xml = '<failure>Command failed (tcp:34809): closed &amp; gone</failure>';
    assert.match(parseMaestroFailure(xml), /closed & gone/);
  });

  it('devuelve cadena vacía si no hay informe o no hay fallo', () => {
    assert.equal(parseMaestroFailure(''), '');
    assert.equal(parseMaestroFailure(undefined), '');
    assert.equal(parseMaestroFailure('<testsuites><testsuite/></testsuites>'), '');
  });
});

describe('classifyFailure: lo que SÍ es caída del runner', () => {
  const crashes = [
    'DeviceServerDiedException: device server died',
    'io.grpc.StatusRuntimeException: UNAVAILABLE: Network closed',
    'Command failed (tcp:34809): closed',
    'error: device offline',
    'error: no devices/emulators found',
    'error: device unauthorized',
    "error: device 'emulator-5554' not found",
  ];
  for (const failureText of crashes) {
    it(failureText.slice(0, 48) + ' → runner', () => {
      const verdict = classifyFailure({ failureText, commandDumps: 0, deviceState: ALIVE });
      assert.equal(verdict.kind, 'runner');
    });
  }

  it('sin mensaje de Maestro, un dispositivo que no responde es del runner', () => {
    const verdict = classifyFailure({ failureText: '', commandDumps: 0, deviceState: 'offline' });
    assert.equal(verdict.kind, 'runner');
    assert.match(verdict.why, /offline/);
  });
});

describe('classifyFailure: lo que NO se puede reintentar', () => {
  it('el bug del compositor de chat es un fallo del caso', () => {
    const verdict = classifyFailure({
      failureText: 'Element not found: Text matching regex: Enviar mensaje',
      commandDumps: 1,
      deviceState: ALIVE,
    });
    assert.equal(verdict.kind, 'caso');
    assert.equal(
      shouldRetry({ runs: [verdict.kind === 'caso' ? { outcome: 'caso', why: verdict.why } : {}] })
        .retry,
      false
    );
  });

  it('una aserción fallida gana al ruido de infraestructura en el mismo mensaje', () => {
    // Si el driver se cae DESPUÉS de que el caso ya haya fallado, el mensaje
    // trae las dos cosas. Reintentar aquí sería enmascarar el fallo real.
    const verdict = classifyFailure({
      failureText: 'Element not found: Enviar mensaje\nio.grpc.StatusRuntimeException: UNAVAILABLE',
      commandDumps: 1,
      deviceState: 'offline',
    });
    assert.equal(verdict.kind, 'caso');
  });

  it('un mensaje desconocido de Maestro es fallo del caso, no flake', () => {
    const verdict = classifyFailure({
      failureText: 'Timed out waiting for anything to appear',
      commandDumps: 1,
      deviceState: ALIVE,
    });
    assert.equal(verdict.kind, 'caso');
  });

  it('sin mensaje y con el dispositivo vivo no se adivina: desconocido', () => {
    const verdict = classifyFailure({ failureText: '', commandDumps: 0, deviceState: ALIVE });
    assert.equal(verdict.kind, 'desconocido');
    assert.equal(
      shouldRetry({ runs: [{ outcome: 'desconocido', why: verdict.why }] }).retry,
      false
    );
  });

  it('sin evidencia ninguna tampoco se reintenta el caso', () => {
    assert.equal(classifyFailure().kind, 'desconocido');
  });
});

describe('shouldRetry', () => {
  it('reintenta cuando el paso no dejó veredicto: el proceso no sobrevivió', () => {
    assert.equal(shouldRetry(undefined).retry, true);
    assert.equal(shouldRetry({ variant: 'supabase', runs: [] }).retry, true);
  });

  it('reintenta tras una caída del runner', () => {
    const verdict = { runs: [{ outcome: 'runner', why: 'el driver de Maestro murió' }] };
    const decision = shouldRetry(verdict);
    assert.equal(decision.retry, true);
    assert.match(decision.why, /driver de Maestro/);
  });

  it('no reintenta un recorrido que pasó', () => {
    assert.equal(shouldRetry({ runs: [{ outcome: 'pass', why: 'verde' }] }).retry, false);
  });

  it('manda el último intento, no el primero', () => {
    const verdict = {
      runs: [
        { outcome: 'runner', why: 'gRPC caído' },
        { outcome: 'caso', why: 'Element not found: Enviar mensaje' },
      ],
    };
    assert.equal(shouldRetry(verdict).retry, false);
  });

  it('explica por qué no reintenta un fallo real', () => {
    const decision = shouldRetry({ runs: [{ outcome: 'caso', why: 'Element not found' }] });
    assert.match(decision.why, /enmascarar/i);
  });
});
