/**
 * Config plugin: el deep link que llega por `onNewIntent` pasa a ser el intent
 * de la actividad, para que `Linking.getInitialURL()` lo vea.
 *
 * El caso que arregla (comprobador, 2026-10-04, «Verificar con GitHub» en frío):
 * con la tarea de LockIn viva en recientes y el proceso muerto, Android recrea
 * `MainActivity` (`singleTask`) con su intent base `MAIN` y entrega el
 * `lockin://auth/callback?code=…` por `onNewIntent`, antes de que React exista.
 * `ReactHostImpl.onNewIntent` lo descarta («Tried to access onNewIntent while
 * context is not ready») y `getInitialURL()` lee `activity.intent`, el `MAIN`:
 * la app arranca en `/` y el code no se canjea nunca.
 *
 * Con `setIntent(intent)` antes de pasárselo a React, `getInitialURL()` devuelve
 * el deep link. Con React ya en marcha no cambia nada: el evento `url` sale
 * igual que antes.
 */

const { withMainActivity } = require('expo/config-plugins');

const MARKER = 'LockIn: deep link de onNewIntent como intent de la actividad';

const METHOD = `
  // ${MARKER} (plugins/with-new-intent-initial-url.js).
  override fun onNewIntent(intent: android.content.Intent) {
    setIntent(intent)
    super.onNewIntent(intent)
  }
`;

const ANCHOR = 'override fun getMainComponentName(): String = "main"';

/** Añade el `onNewIntent` a la `MainActivity` de Kotlin. Idempotente. */
function addNewIntentOverride(src) {
  if (src.includes(MARKER)) return src;
  if (/override fun onNewIntent\(/.test(src)) {
    throw new Error(
      'with-new-intent-initial-url: MainActivity ya tiene onNewIntent; ' +
        'añade setIntent(intent) a mano en vez de duplicarlo.'
    );
  }
  if (!src.includes(ANCHOR)) {
    throw new Error(
      'with-new-intent-initial-url: no encuentro getMainComponentName en MainActivity.kt; ' +
        'la plantilla de Expo ha cambiado.'
    );
  }
  return src.replace(ANCHOR, `${ANCHOR}\n${METHOD}`);
}

function withNewIntentInitialUrl(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('with-new-intent-initial-url: solo sabe editar MainActivity en Kotlin.');
    }
    mod.modResults.contents = addNewIntentOverride(mod.modResults.contents);
    return mod;
  });
}

module.exports = withNewIntentInitialUrl;
module.exports.addNewIntentOverride = addNewIntentOverride;
