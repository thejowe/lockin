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

  it('esas cuatro, y solo esas, corren únicamente con el backend real', () => {
    // Dependen del `update` de `created_at` de `incoming-likes.sql`, que solo
    // existe en Postgres. Con el mock el deck lo ordena `src/data/mock/seed.ts`
    // y arriba hay otra persona, así que allí no se pueden cumplir — y el
    // control negativo tiene que llegar al `stopApp` para significar algo.
    const gate = journey.indexOf("true: ${DECK_FIXTURE == 'postgres'}");
    assert(gate >= 0, 'El bloque del deck ya no está condicionado al backend real');
    // Un único `runFlow` en todo el recorrido: nadie ha colado más pasos fuera
    // de la variante que decide el color, que es la que lleva credenciales.
    assert.equal(
      journey.split('- runFlow:').length - 1,
      1,
      'Hay más de un bloque condicional: el recorrido ha dejado de ser el mismo en las dos variantes'
    );
    // Se lee el bloque entero, no solo su presencia: lo condicionado tiene que
    // ser EXACTAMENTE esas cuatro líneas. Si algo más se cuela aquí dentro deja
    // de correr con el mock, y el control negativo se vacía sin que se note.
    const body = journey.slice(journey.indexOf('commands:', gate));
    const inside = body
      .split('\n')
      .slice(1)
      // El bloque acaba en la primera línea que vuelve al margen izquierdo.
      .reduce(
        (lines, line) =>
          lines.done || /^\S/.test(line)
            ? { ...lines, done: true }
            : { ...lines, list: [...lines.list, line] },
        { list: [], done: false }
      )
      .list.map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    assert.deepEqual(inside, [
      "- assertVisible: 'Núria Bosch'",
      "- assertVisible: '(?i)busca'",
      "- assertVisible: '(?i)✓ marketing'",
      "- assertVisible: '(?i)✓ encajas'",
    ]);
    // Y lo que sostiene el control negativo se queda fuera, al margen izquierdo:
    // el reinicio y todo lo que viene detrás corren en las dos variantes.
    assert.match(journey, /^- stopApp$/m, 'El reinicio ha quedado dentro del bloque condicional');
  });

  it('un DECK_FIXTURE ausente o mal escrito rompe el recorrido, no lo relaja', () => {
    // Sin esto, dejar de pasar la variable saltaría las cuatro aserciones en
    // silencio y el trabajo con credenciales se pondría verde sin comprobarlas.
    const guard = journey.match(/- assertTrue: \$\{([^}]*)\}/)?.[1];
    assert(guard, 'El recorrido ya no valida sus variables antes de empezar');
    assert.match(guard, /DECK_FIXTURE == 'postgres'/);
    assert.match(guard, /DECK_FIXTURE == 'memoria'/);
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

describe('la respuesta de texto libre es, además, una sonda del teclado', () => {
  // Run 34172803719, trabajo `supabase`: el recorrido pasó ENTERO —reinicio
  // incluido— y lo único rojo fue esta comparación. Postgres tenía
  // 'Una Herramienta para Construir en equipo' donde la UI escribió
  // 'Una herramienta para construir en equipo'.
  //
  // La decisión, argumentada en docs/plan/todo/calidad.md: el caso NO se hace
  // inmune. Ese campo es prosa libre, y que el teclado la cambie por su cuenta
  // es corrupción silenciosa de un dato del usuario. Ningún otro nivel lo puede
  // ver: Jest renderiza sin IME y los tests de contrato escriben en Postgres sin
  // pasar por la pantalla. Este es el único sitio del repo donde el bug existe.
  const typed = journey.match(/- inputText: '([^']*herramienta[^']*)'/i)?.[1];
  const expected = verify.match(/prompts\[0\]\.answer, '([^']*)'/)?.[1];

  it('el .yaml escribe exactamente lo que el oráculo espera leer', () => {
    assert(typed, 'El recorrido ya no escribe la respuesta del prompt');
    assert(expected, 'El oráculo ya no comprueba la respuesta del prompt');
    // Byte a byte y a propósito: "arreglar" el E2E copiando a `verify.mjs` lo
    // que salió capitalizado es exactamente la forma de perder esta señal.
    assert.equal(typed, expected, 'La cadena escrita y la esperada han dejado de coincidir');
  });

  it('conserva la forma que hace visible un auto-capitalizado', () => {
    const words = typed.split(' ');
    // Mayúscula inicial: `autoCapitalize="sentences"` es comportamiento
    // deseado en prosa, no un bug, y el caso no debe ir contra esa decisión.
    assert.match(words[0], /^[A-ZÁÉÍÓÚÑ]/, 'Sin mayúscula inicial se rechazaría `sentences`');
    // Interiores en minúscula: es lo que hace que `words` o un corrector activo
    // cambien la cadena y el oráculo lo note.
    for (const word of words.slice(1)) {
      assert.match(word, /^[a-záéíóúñ]/, 'Palabra interior capitalizada: la sonda deja de serlo');
    }
    assert(words.length >= 4, 'Con menos palabras la sonda casi no tiene dónde fallar');
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
