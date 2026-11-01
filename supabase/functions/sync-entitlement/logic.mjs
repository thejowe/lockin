/**
 * Estado de Premium según RevenueCat, y escritura en `entitlements`. Sin Deno ni
 * red: todo lo de fuera entra por `deps`. Lo comparten `sync-entitlement` (el
 * cliente pide sincronizar SU uid tras comprar o restaurar) y `revenuecat-webhook`
 * (que importa `refreshEntitlement` de aquí).
 *
 * La verdad es la API REST de RevenueCat (`GET /v1/subscribers/{app_user_id}`),
 * no el cuerpo de un webhook ni el SDK del cliente: así el orden de llegada de los
 * eventos da igual y un cliente no puede darse Premium.
 *
 * Es JavaScript plano (ESM): lo importan Deno (`index.ts`) y `node --test`.
 *
 * `deps`:
 * - `fetchSubscriber(appUserId)` → `{ status, body }`: la respuesta de la API REST
 *   (`body` es el JSON o `null`). Lanza si la red falla.
 * - `saveEntitlement(userId, { premiumUntil, productId, store, snapshotAt })`: escribe
 *   `entitlements` con la service role vía el RPC `save_entitlement` (`premiumUntil` es
 *   ISO o `null`; `snapshotAt` es el instante en que se EMPEZÓ a pedir el estado: el RPC
 *   descarta una instantánea más vieja que la ya guardada).
 * - `now()` (opcional): reloj, para los tests.
 * - `log(message)`: rastro en los logs. Nunca recibe claves.
 */

export const REVENUECAT_API = 'https://api.revenuecat.com/v1/subscribers';
/** Nombre del único entitlement de RevenueCat (spec §1). */
export const ENTITLEMENT_ID = 'premium';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `app_user_id` de RevenueCat = `auth.uid()`; cualquier otra cosa (anónimos `$RCAnonymousID:`) se ignora. */
export function isUserId(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function subscriberUrl(appUserId) {
  return `${REVENUECAT_API}/${encodeURIComponent(appUserId)}`;
}

function toStore(value) {
  if (value === 'app_store' || value === 'mac_app_store') return 'app_store';
  if (value === 'play_store') return 'play_store';
  return null;
}

/**
 * De la respuesta de `GET /subscribers/{id}` a `{ premiumUntil, productId, store }`.
 * Sin el entitlement `premium` (nunca compró): todo `null`. Una fecha ya pasada se
 * guarda tal cual (`is_premium` compara con `now()`); `expires_date: null` es de
 * por vida y se guarda como el año 9999.
 */
export function mapSubscriber(body) {
  const subscriber = body && typeof body === 'object' ? body.subscriber : null;
  const entitlement = subscriber?.entitlements?.[ENTITLEMENT_ID];
  if (!entitlement || typeof entitlement !== 'object') {
    return { premiumUntil: null, productId: null, store: null };
  }
  let premiumUntil;
  if (entitlement.expires_date === null) {
    premiumUntil = '9999-12-31T23:59:59.000Z';
  } else {
    const ms = Date.parse(entitlement.expires_date);
    if (Number.isNaN(ms)) throw new Error('expires_date inválida en la respuesta de RevenueCat');
    premiumUntil = new Date(ms).toISOString();
  }
  const productId =
    typeof entitlement.product_identifier === 'string' ? entitlement.product_identifier : null;
  const store = productId ? toStore(subscriber.subscriptions?.[productId]?.store) : null;
  return { premiumUntil, productId, store };
}

/** Pide el estado a RevenueCat y lo escribe. Lanza si la API falla (el que llama decide el 5xx). */
export async function refreshEntitlement(userId, deps) {
  // Se apunta ANTES de pedir: una petición que empezó antes no puede traer un estado más nuevo.
  const snapshotAt = (deps.now ? deps.now() : new Date()).toISOString();
  const response = await deps.fetchSubscriber(userId);
  // 201: RevenueCat crea al cliente si aún no lo conoce y devuelve su estado vacío.
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`RevenueCat respondió ${response.status}`);
  }
  if (!response.body || typeof response.body !== 'object') {
    // Cuerpo ilegible: no es «sin Premium», así que no se escribe nada y se reintenta.
    throw new Error('RevenueCat respondió 200 con un cuerpo ilegible');
  }
  const entitlement = mapSubscriber(response.body);
  await deps.saveEntitlement(userId, { ...entitlement, snapshotAt });
  return entitlement;
}

/** La clave REST secreta de RevenueCat, o `null` si falta (la función aún no está configurada). */
export function readConfig(env) {
  const apiKey = env.REVENUECAT_SECRET_KEY;
  return apiKey ? { apiKey } : null;
}

/**
 * Petición del cliente (la sesión ya la comprobó `index.ts`): sincroniza SU uid.
 * Sin configurar → 200 `unconfigured`. API caída → 502 (el cliente reintenta).
 */
export async function handleSyncRequest({ userId, config, deps }) {
  if (!config) return { status: 200, body: { ok: false, reason: 'unconfigured' } };
  if (!isUserId(userId)) return { status: 400, body: { error: 'user' } };
  try {
    const { premiumUntil } = await refreshEntitlement(userId, deps);
    return { status: 200, body: { ok: true, premiumUntil } };
  } catch (error) {
    deps.log?.(`sync fallido: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 502, body: { error: 'upstream' } };
  }
}
