/**
 * Guardia de la barra de pestañas flotante: en una pestaña, lo que se pulsa
 * después de `scrollUntilVisible` tiene que haber subido hasta el centro.
 *
 * La barra (`src/components/app-tabs.tsx`) es una píldora en `position:
 * absolute` encima del contenido, en la franja y≈2171–2291 del emulador de CI.
 * Maestro no la ve como tapa: `scrollUntilVisible` da el elemento por visible al
 * 100 % aunque quede debajo de ella, deja de desplazar, y el `tapOn` siguiente
 * cae en la barra y cambia de pestaña.
 *
 * Pasó de verdad: run 37228331950, variante `registro`. «Guardar contraseña»
 * quedó en y=2176–2234, el toque fue a (539, 2205) y la app saltó a Matches;
 * el aviso «Contraseña guardada…» no llegó a pintarse. En el run 37226087232
 * el mismo botón paró en y=2005 —el gesto de desplazar no recorre siempre lo
 * mismo— y pasó. Diagnóstico en `docs/plan/todo/verificacion.md`.
 *
 * `centerElement: true` hace que Maestro siga desplazando hasta que el centro
 * del elemento quede por encima de y≈1680 (o hasta el final de la lista, y el
 * relleno inferior `BottomTabInset` lo deja entonces por encima de la barra).
 *
 * Corren con `node --test` (`npm run test:e2e`), no con Jest.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Los casos que desplazan y pulsan dentro de una pestaña, con la barra
 * delante. La lista se mantiene a mano: si un caso desaparece, el
 * `readFileSync` revienta.
 */
const flows = ['password-reset.yaml'].map((file) => ({
  file,
  lines: readFileSync(join(here, file), 'utf8').split(/\r?\n/),
}));

/**
 * Cada `scrollUntilVisible` al que sigue un `tapOn` —con, como mucho,
 * aserciones en medio—, con su bloque de opciones. Reconoce la forma en que
 * están escritos estos casos: opciones con más sangría que el guion del comando.
 */
function scrollsFollowedByTap(lines) {
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)- scrollUntilVisible:\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    const options = [];
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || lines[j].search(/\S/) > indent)) {
      options.push(lines[j].trim());
      j++;
    }
    const element = options.find((line) => line.startsWith('element:'));
    // Las aserciones no mueven la pantalla: el toque que viene detrás de ellas
    // cae donde el desplazamiento dejó el elemento.
    while (j < lines.length && /^- assert/.test(lines[j].trim())) j++;
    const next = (lines[j] ?? '').trim();
    if (next.startsWith('- tapOn:')) found.push({ element, options, next });
  }
  return found;
}

describe('lo que se pulsa en una pestaña sube por encima de la barra', () => {
  for (const { file, lines } of flows) {
    const taps = scrollsFollowedByTap(lines);

    it(`${file} sigue desplazando antes de pulsar`, () => {
      // Sin esto, quitar los desplazamientos dejaría la guardia en verde sin
      // comprobar nada.
      assert(taps.length > 0, 'El caso ya no desplaza hasta lo que pulsa');
    });

    for (const { element, options, next } of taps) {
      it(`${file}: ${element} se centra antes de \`${next}\``, () => {
        assert(
          options.includes('centerElement: true'),
          'Sin `centerElement: true`, Maestro deja de desplazar con el elemento ' +
            'debajo de la barra de pestañas y el toque cambia de pestaña.'
        );
      });
    }
  }
});
