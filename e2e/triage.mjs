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

function firstLine(text) {
  return text.trim().split('\n')[0].slice(0, 300);
}

/**
 * Clasifica un fallo del recorrido.
 *
 * @param {object} evidence
 * @param {string} evidence.failureText  Mensaje de `maestro.xml`, vacío si no hay.
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
