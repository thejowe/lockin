/**
 * Guardia del recorrido: fija lo que `full-journey.yaml` tiene que seguir
 * comprobando de `seekingSpecialties`.
 *
 * Existe porque es el único sitio donde esa feature se prueba de punta a punta.
 * Los 222+ tests unitarios corren contra el mock y los de contrato hablan con
 * Postgres sin pasar por la pantalla: si alguien borra estos pasos del .yaml
 * para "desatascar" el emulador, el pegamento pantalla ↔ repositorio se queda
 * sin nadie que lo mire y nada más se pone rojo. Aquí sí.
 *
 * No valida que el recorrido pase —eso solo lo dice un emulador—, valida que el
 * recorrido siga preguntando lo que decía preguntar.
 *
 * Corren con `node --test` (`npm run test:e2e`), no con Jest: son archivos del
 * runner, no código de la app, y no entran en `testMatch` ni en la cobertura.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const journey = readFileSync(join(here, 'full-journey.yaml'), 'utf8');
const fixture = readFileSync(join(here, 'incoming-likes.sql'), 'utf8');
const verify = readFileSync(join(here, 'verify.mjs'), 'utf8');

/** Posición del primer comando que contiene `needle`. -1 si no está. */
const at = (needle) => journey.indexOf(needle);

describe('full-journey declara lo que busca la persona', () => {
  it('elige "Ambos", que es lo que hace existir el campo', () => {
    // Invariante de `Profile.seekingSpecialties`: el bloque solo se pinta con
    // `par` o `ambos`. Con `lockin` los pasos de abajo no encontrarían nada.
    assert(at("- tapOn: 'Ambos'") >= 0, 'El recorrido ya no elige un modo que pida complemento');
  });

  it('toca el chip por su etiqueta de accesibilidad, no por el texto visible', () => {
    // "Diseño" nombra dos chips del formulario. `Busco Diseño` es el
    // accessibilityLabel que `perfil` puso justo para poder distinguirlos.
    assert(at("- tapOn: 'Busco Diseño'") >= 0, 'Falta declarar qué debe dominar la otra persona');
    assert(
      at("- tapOn: 'Busco Diseño'") < at("- tapOn: 'Crear perfil'"),
      'Se declara después de guardar el perfil: no llegaría a la fila'
    );
  });

  it('lee en la tarjeta la fila "Busca" y el ✓ de complementariedad', () => {
    const deck = at("- tapOn: 'Like'");
    for (const step of ["- assertVisible: 'Núria Bosch'", "- assertVisible: '(?i)busca'"]) {
      assert(at(step) >= 0 && at(step) < deck, 'Falta en el deck, antes del like: ' + step);
    }
    // El ✓ es lo que prueba el cruce: lo que ella busca ∩ lo que yo domino.
    assert(at("- assertVisible: '(?i)✓ marketing'") >= 0, 'Falta el ✓ del chip complementario');
    assert(at("- assertVisible: '(?i)✓ encajas'") >= 0, 'Falta el ✓ de la cabecera');
  });

  it('domina marketing, que es lo que hace aparecer ese ✓', () => {
    // Núria busca marketing y ventas. Sin marketing, el ✓ del deck no saldría y
    // sus dos aserciones pasarían a comprobar el vacío.
    const marketing = at("- tapOn: 'Marketing'");
    assert(marketing >= 0, 'El recorrido ya no domina marketing');
    assert(marketing > at("- tapOn: 'Ambos'"), 'Se elige antes de entrar al formulario');
    assert(marketing < at("- tapOn: 'Crear perfil'"), 'Se elige después de guardar el perfil');
  });

  it('relee la suya de Postgres después del reinicio', () => {
    const restart = at('- launchApp:\n    clearState: false');
    assert(restart >= 0, 'Sin reinicio no se distingue Postgres del estado en memoria');
    assert(
      at("- assertVisible: 'Diseño'") > restart,
      'La especialidad declarada no se vuelve a leer tras el reinicio'
    );
  });
});

describe('lo que sostiene esas aserciones', () => {
  it('el fixture fija el orden del deck', () => {
    // `discovery_deck` ordena por `created_at desc` y el seed las inserta todas
    // a la vez: sin este `update`, la tarjeta de arriba la elige el planificador.
    assert.match(fixture, /update public\.profiles\s+set created_at/);
  });

  it('el oráculo de Postgres comprueba la columna y la tarjeta que se likeó', () => {
    assert.match(verify, /seeking_specialties/);
    assert.match(verify, /11111111-1111-4111-8111-000000000001/);
  });
});
