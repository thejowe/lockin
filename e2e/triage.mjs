/**
 * ¿El recorrido falló por el caso, o se cayó el runner debajo?
 *
 * El emulador de Actions es inestable: `device offline`,
 * `StatusRuntimeException: UNAVAILABLE` y `DeviceServerDiedException` tumbaron
 * 3 de los 7 trabajos lanzados el 2026-09-07 sin relación con el código. Sin
 * reintento, cada pasada devuelve menos de la mitad de la señal que debería.
 *
 * Con reintento hay un riesgo peor: que un fallo real —hoy, el compositor de
 * `chat` bajo el teclado— se convierta en un verde intermitente. Por eso la
 * regla es de lista cerrada y en un solo sentido:
 *
 *   se reintenta SOLO si el fallo coincide con una firma conocida de caída de
 *   infraestructura. Todo lo demás, incluido lo que no se sabe clasificar, se
 *   propaga tal cual y tumba el trabajo.
 *
 * Y si el mensaje trae a la vez una aserción fallida y ruido de infraestructura,
 * manda la aserción: CASE_SIGNATURES se comprueba antes que RUNNER_SIGNATURES.
 *
 * Única excepción, y por evidencia, no por texto: un diálogo ANR de Android de
 * OTRO proceso encima de la pantalla en el paso que falla (`parseAnrDialog`).
 * Ahí la aserción no evaluó la app —el sistema solo expone la ventana del
 * diálogo—, así que su resultado no dice nada del caso. Si el que no responde
 * es la app bajo prueba, se propaga como fallo del caso.
 */

/** Firmas de fallo del CASO. Ganan siempre: son la prueba de que Maestro llegó
 *  a evaluar el recorrido y el recorrido no se cumplió. */
export const CASE_SIGNATURES = [
  { name: 'elemento no encontrado', pattern: /Element .*not found/i },
  { name: 'aserción falsa', pattern: /Assertion is false/i },
];

/** Firmas de caída del RUNNER. Lo único que se reintenta. */
export const RUNNER_SIGNATURES = [
  // El driver gRPC que Maestro instala en el dispositivo pierde la conexión.
  {
    name: 'el driver de Maestro murió (DeviceServerDiedException)',
    pattern: /DeviceServerDiedException/,
  },
  {
    name: 'gRPC no disponible (StatusRuntimeException/UNAVAILABLE)',
    pattern: /StatusRuntimeException|\bUNAVAILABLE\b/,
  },
  { name: 'el puerto del driver se cerró', pattern: /Command failed \(tcp:\d+\): closed/ },
  // adb pierde el emulador: el AVD se cayó o dejó de responder.
  { name: 'adb ve el dispositivo offline', pattern: /\bdevice offline\b/i },
  { name: 'adb no ve ningún dispositivo', pattern: /no devices(?:\/emulators)? found/i },
  { name: 'adb ve el dispositivo sin autorizar', pattern: /\bdevice unauthorized\b/i },
  { name: 'adb no encuentra el dispositivo', pattern: /device '[^']*' not found/i },
];

/**
 * Diálogo de "X no responde" (ANR) de Android, leído del volcado de jerarquía
 * que Maestro escribe en el paso que falla.
 *
 * Se busca por `android:id/aerr_*` —los botones "Esperar"/"Cerrar app" que pone
 * el propio sistema—, nunca por el texto: el id no depende del idioma con el
 * que arranque el emulador. El título (`android:id/alertTitle`) solo se usa
 * para decir de QUIÉN es el diálogo.
 *
 * @param {unknown} hierarchy Árbol `{attributes, children}` de Maestro, o null.
 * @returns {{title: string}|null}
 */
export function parseAnrDialog(hierarchy) {
  if (!hierarchy || typeof hierarchy !== 'object') return null;
  let anr = false;
  let title = '';
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const attributes = node.attributes ?? {};
    const id = typeof attributes['resource-id'] === 'string' ? attributes['resource-id'] : '';
    if (id.startsWith('android:id/aerr_')) anr = true;
    if (id === 'android:id/alertTitle' && typeof attributes.text === 'string') {
      title = attributes.text.trim();
    }
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child);
  };
  visit(hierarchy);
  return anr ? { title } : null;
}

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(lt|gt|amp|quot|apos);/g, (_, name) => ENTITIES[name]);
}

/**
 * Mensaje de fallo que Maestro dejó en su informe JUnit. Recoge tanto el
 * atributo `message` como el cuerpo del `<failure>`: según el fallo, la causa
 * está en uno o en el otro.
 */
export function parseMaestroFailure(xml) {
  if (typeof xml !== 'string') return '';
  const parts = [];
  for (const match of xml.matchAll(/<failure\b([^>]*?)(?:\/>|>([\s\S]*?)<\/failure>)/g)) {
    for (const attribute of (match[1] ?? '').matchAll(/(?:message|type)="([^"]*)"/g)) {
      parts.push(decode(attribute[1]));
    }
    if (match[2]) parts.push(decode(match[2]));
  }
  return parts.join('\n').trim();
}

/**
 * Mensajes de los comandos fallidos del volcado de Maestro. El informe JUnit
 * puede decir solo "Unknown error", mientras aquí queda la causa real.
 *
 * @param {unknown} commands Array ya parseado de `commands.json`.
 * @returns {string} Mensajes unidos por saltos de línea, o vacío si no los hay.
 */
export function parseCommandFailures(commands) {
  if (!Array.isArray(commands)) return '';
  return commands
    .filter((entry) => entry?.metadata?.status === 'FAILED')
    .map((entry) => entry.metadata.error?.message)
    .filter((message) => typeof message === 'string')
    .join('\n');
}

function firstLine(text) {
  return text.trim().split('\n')[0].slice(0, 300);
}

/**
 * Clasifica un fallo del recorrido.
 *
 * @param {object} evidence
 * @param {string} evidence.failureText  Mensajes de comandos y `maestro.xml`, vacío si no hay.
 * @param {number} evidence.commandDumps Volcados `commands.json` encontrados.
 * @param {string} evidence.deviceState  Salida de `adb get-state`.
 * @param {{title: string}|null} [evidence.anrDialog] Diálogo ANR en el paso fallido.
 * @param {string} [evidence.appLabel]   Nombre con el que el sistema llama a la app.
 * @returns {{kind: 'runner'|'caso'|'desconocido', why: string}}
 */
export function classifyFailure({
  failureText = '',
  commandDumps = 0,
  deviceState = '',
  anrDialog = null,
  appLabel = '',
} = {}) {
  const text = typeof failureText === 'string' ? failureText : '';
  // Va ANTES que CASE_SIGNATURES, y no relaja la regla de "manda la aserción".
  // Esa regla existe para que una aserción fallida SOBRE LA APP no se repita
  // hasta verla verde. Con un diálogo ANR de otro proceso encima, la aserción
  // no llegó a mirar la app: Android devuelve solo la ventana del diálogo, así
  // que `assertVisible` estaba preguntando por la pantalla del sistema. Eso no
  // es una respuesta sobre el caso, ni verde ni roja.
  //
  // La distinción la da el título: si el que no responde es la app bajo prueba,
  // eso SÍ es un fallo del producto y se propaga como tal. Sin `appLabel` no se
  // puede saber de quién es el diálogo, así que se cae a las reglas de siempre.
  if (anrDialog && appLabel) {
    const own = new RegExp('\\b' + appLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    const title = anrDialog.title || 'sin título en el diálogo';
    if (own.test(anrDialog.title ?? '')) {
      return { kind: 'caso', why: 'la app bajo prueba dejó de responder — ' + title };
    }
    return {
      kind: 'runner',
      why:
        'un diálogo ANR del sistema tapaba la pantalla ("' +
        title +
        '"): la aserción no llegó a mirar la app',
    };
  }
  const asserted = CASE_SIGNATURES.find((signature) => signature.pattern.test(text));
  if (asserted) return { kind: 'caso', why: firstLine(text) };
  const crashed = RUNNER_SIGNATURES.find((signature) => signature.pattern.test(text));
  if (crashed) return { kind: 'runner', why: crashed.name + ' — ' + firstLine(text) };
  // Cualquier otro mensaje de Maestro es un fallo del caso: no se reintenta.
  if (text.trim()) return { kind: 'caso', why: firstLine(text) };
  // Sin mensaje de Maestro, y solo entonces, decide el estado del dispositivo.
  // Ojo: NO saber en qué estado está no es lo mismo que saber que se ha caído.
  // Solo un estado leído y distinto de `device` cuenta como caída.
  if (deviceState && deviceState !== 'device') {
    return {
      kind: 'runner',
      why: 'Maestro no dejó mensaje y adb ve el dispositivo como "' + deviceState + '"',
    };
  }
  return {
    kind: 'desconocido',
    why:
      'Maestro falló sin dejar mensaje, con ' +
      commandDumps +
      ' volcado(s) de comandos y el dispositivo respondiendo. No se reintenta a ciegas.',
  };
}

/**
 * ¿Merece la pena volver a arrancar un emulador entero?
 *
 * Sin veredicto se reintenta: significa que el proceso no sobrevivió al paso
 * del emulador (o que el AVD ni siquiera arrancó), nunca que el caso fallara —
 * un fallo del caso SIEMPRE deja veredicto escrito.
 */
export function shouldRetry(verdict) {
  if (!verdict || !Array.isArray(verdict.runs) || verdict.runs.length === 0) {
    return {
      retry: true,
      why: 'el paso no dejó veredicto: el emulador no arrancó o el proceso no sobrevivió',
    };
  }
  const last = verdict.runs[verdict.runs.length - 1];
  if (last.outcome === 'pass') return { retry: false, why: 'el recorrido pasó' };
  if (last.outcome === 'runner') return { retry: true, why: 'caída del runner: ' + last.why };
  return {
    retry: false,
    why:
      'fallo real del caso (' +
      last.outcome +
      '): ' +
      last.why +
      '. No se reintenta: repetirlo lo enmascararía.',
  };
}

/** Rastro de `reportQueryError` (`src/data/provider.tsx`), tal cual sale por logcat. */
const QUERY_FAILURE = /\[lockin\] la consulta "([^"]+)" falló: (.*)$/;

/**
 * Deja el mensaje del error y tira lo que la consola pega detrás: el objeto ya
 * inspeccionado (`', { [Error: …]`) por una etiqueta, la pila (` Error: …,
 * stack:`) por la otra. Sin esto el mismo error cuenta como dos distintos.
 */
function tidyQueryMessage(raw) {
  let end = raw.length;
  for (const marker of ["', ", ' Error: ', ', stack:']) {
    const at = raw.indexOf(marker);
    if (at >= 0 && at < end) end = at;
  }
  return raw.slice(0, end).trim();
}

/** `code: 'PGRST303'` del `cause:` que el inspector imprime bajo la línea `index`. */
function findCauseCode(lines, index) {
  const limit = Math.min(lines.length, index + 12);
  for (let cursor = index + 1; cursor < limit; cursor += 1) {
    // Otro rastro de consulta fallida es donde este `cause:` deja de ser suyo.
    if (QUERY_FAILURE.test(lines[cursor])) break;
    const code = /\bcode: '([^']+)'/.exec(lines[cursor]);
    if (code) return code[1];
  }
  return '';
}

/**
 * Errores de la app que quedaron en el logcat, aunque el intento se clasifique
 * como caída del runner.
 *
 * Existe por un fallo concreto: el 2026-09-19, `attempt-01` de la variante
 * `supabase` murió con un ANR del sistema por delante —clasificado `runner`, y
 * bien clasificado— y el reintento lo repitió en verde. Detrás del ANR había un
 * `PGRST303` real de PostgREST que solo se vio leyendo el logcat a mano. Un
 * reintento que borra la evidencia del intento anterior es justo el fallo que el
 * control negativo existe para no tener, así que este rastro se recoge SIEMPRE y
 * se escribe en `verdict.json`, gane quien gane el diagnóstico.
 *
 * El mismo error sale por dos etiquetas —`E ReactNativeJS` con el objeto
 * inspeccionado y `E unknown:ReactNative: console.error:` con la pila—, así que
 * se agrupa por consulta y mensaje: `logcatLines` cuenta líneas del volcado, no
 * veces que falló la consulta.
 *
 * @param {unknown} logcat Contenido de `logcat.txt`.
 * @returns {{key: string, message: string, code: string, logcatLines: number}[]}
 */
export function parseAppQueryErrors(logcat) {
  if (typeof logcat !== 'string') return [];
  const lines = logcat.split(/\r?\n/);
  const found = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const match = QUERY_FAILURE.exec(lines[index]);
    if (!match) continue;
    const key = match[1];
    const message = tidyQueryMessage(match[2]);
    const id = key + '||' + message;
    const entry = found.get(id) ?? { key, message, code: '', logcatLines: 0 };
    entry.logcatLines += 1;
    // El `code` de PostgREST viene en el `cause:` de debajo, y solo por una de
    // las dos etiquetas: se busca en la primera aparición que lo traiga.
    if (!entry.code) entry.code = findCauseCode(lines, index);
    found.set(id, entry);
  }
  return [...found.values()];
}

/**
 * Une los errores de app de varios intentos sin perder de cuál venían. Es lo
 * que deja el resumen a la vista en la raíz de `verdict.json`, para que un rojo
 * intermitente no haya que ir a buscarlo intento por intento.
 */
export function mergeAppQueryErrors(runs) {
  const found = new Map();
  for (const run of Array.isArray(runs) ? runs : []) {
    for (const error of Array.isArray(run?.appErrors) ? run.appErrors : []) {
      const id = error.key + '||' + error.message;
      const seen = found.get(id);
      // `{...error}` ya trae su cuenta: sumar solo cuando el error ya estaba.
      const entry = seen ?? { ...error, attempts: [] };
      if (seen) {
        entry.logcatLines += error.logcatLines;
        if (!entry.code) entry.code = error.code;
      }
      if (run.attempt && !entry.attempts.includes(run.attempt)) entry.attempts.push(run.attempt);
      found.set(id, entry);
    }
  }
  return [...found.values()];
}
