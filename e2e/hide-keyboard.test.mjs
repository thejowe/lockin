/**
 * Guardia del `hideKeyboard`: en Android, `hideKeyboard` es un `pressBack()`.
 *
 * Cuando hay teclado, lo cierra. Cuando NO lo hay, el `pressBack()` llega a la
 * app y la saca de la pantalla — no es un no-op. Después de enviar un mensaje,
 * si el teclado ya se cerró (por un remontaje, por un blur, por lo que sea), ese
 * comando se convierte en un "volver atrás" silencioso: los comandos siguientes
 * afirman sobre otra pantalla y fallan con mensajes que no nombran la causa.
 *
 * Pasó de verdad, no es teoría: run 34160309273, donde `send()` desmontaba el
 * compositor y los trabajos `supabase` y `probe` (la sonda del teclado, ya
 * retirada) murieron con dos errores distintos —"no encuentro Enviar mensaje",
 * "no encuentro la burbuja"— porque los dos estaban ya en Descubrir.
 * Diagnóstico en `docs/plan/todo/chat.md` (ronda 4). Se dejó anotado y sin tocar hasta que el recorrido `supabase`
 * cerrara en verde; cerró (run 34281070607) y se quita con red debajo.
 *
 * Esta guardia fija la ausencia. No prueba que el recorrido pase —eso solo lo
 * dice un emulador—, prueba que nadie vuelva a colar el comando ahí.
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
 * Los casos que envían un mensaje. Eran dos: la sonda `keyboard-probe.yaml` se
 * retiró el 2026-09-09 con su pregunta cerrada, así que queda el recorrido
 * completo — que es el que de verdad decide el color del workflow. Si alguno
 * desapareciera, este `readFileSync` revienta, que es lo que se quiere: la
 * lista se actualiza a mano, no se relaja sola.
 */
const flows = ['full-journey.yaml'].map((file) => ({
  file,
  source: readFileSync(join(here, file), 'utf8'),
}));

/** Comandos declarados, sin comentarios: `hideKeyboard` dentro de uno no cuenta. */
const commandsOf = (source) =>
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

describe('ningún caso cierra el teclado después de enviar', () => {
  for (const { file, source } of flows) {
    const commands = commandsOf(source);
    const send = commands.indexOf("- tapOn: 'Enviar mensaje'");

    it(`${file} sigue enviando el mensaje`, () => {
      // Sin esto, borrar el envío dejaría los dos casos de abajo en verde sobre
      // un recorrido que ya no manda nada.
      assert(send >= 0, 'El caso ya no pulsa "Enviar mensaje"');
    });

    it(`${file} no lleva \`hideKeyboard\` detrás del envío`, () => {
      const after = commands.slice(send + 1).indexOf('- hideKeyboard');
      assert.equal(
        after,
        -1,
        'Hay un `hideKeyboard` tras el envío: en Android es `pressBack()` y, sin ' +
          'teclado, saca del chat. Lo que venga detrás afirmará sobre Descubrir.'
      );
    });

    it(`${file} comprueba la burbuja con el teclado todavía delante`, () => {
      // La contrapartida de quitar el `hideKeyboard`: si además se quitara la
      // aserción, el caso dejaría de mirar el resultado del envío y esta
      // guardia se habría limitado a borrar una línea.
      assert(
        commands.slice(send + 1).includes('- assertVisible: ${MESSAGE}'),
        'Tras enviar ya no se afirma la burbuja: el envío deja de comprobarse'
      );
    });
  }

  it('los `hideKeyboard` que quedan están todos en el formulario de perfil', () => {
    // Los del alta van pegados a un `inputText`, así que ahí el teclado está
    // abierto con seguridad y el `pressBack()` hace lo que dice. Esa es la
    // condición que los hace legítimos, y aquí se comprueba una a una.
    for (const { file, source } of flows) {
      const commands = commandsOf(source);
      commands.forEach((command, index) => {
        if (command !== '- hideKeyboard') return;
        assert.match(
          commands[index - 1] ?? '',
          /^- inputText: /,
          `${file}: hay un \`hideKeyboard\` que no viene de escribir en un campo, ` +
            'así que no se puede dar por hecho que haya teclado que cerrar'
        );
      });
    }
  });
});
