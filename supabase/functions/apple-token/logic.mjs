/**
 * Token de Apple para poder revocarlo al borrar la cuenta (App Store, norma
 * 5.1.1(v)). Sin Deno ni red: todo lo de fuera entra por `deps`.
 *
 * Por qué hace falta: «Continuar con Apple» en iOS canjea el `identityToken` en
 * GoTrue (`signInWithIdToken`), y en ese flujo Supabase no guarda ningún token
 * de Apple. Para revocar hay que tener un refresh token, y el único modo de
 * conseguirlo es canjear el `authorizationCode` de la hoja nativa en
 * `https://appleid.apple.com/auth/token` con un `client_secret` firmado con la
 * clave .p8 de la cuenta de desarrollador.
 *
 * Dos acciones:
 * - `exchange` (`{ action: 'exchange', code }`): justo después de entrar. Canjea
 *   el code, comprueba que el `id_token` que devuelve Apple es de la misma
 *   identidad de Apple que la sesión y guarda el refresh token.
 * - `revoke` (`{ action: 'revoke' }`): justo antes de `delete_my_account`.
 *   Revoca el refresh token guardado y borra la fila.
 *
 * Ninguna de las dos debe impedir lo que acompaña (entrar, borrar la cuenta): el
 * cliente las llama a mejor esfuerzo. Sin secretos configurados responden 200
 * con `reason: 'unconfigured'` y no hacen nada.
 *
 * Es JavaScript plano (ESM) a propósito: lo importan Deno (`index.ts`) y
 * `node --test` sin transpilar. La firma usa WebCrypto (`crypto.subtle`), que
 * tienen los dos.
 *
 * `deps`:
 * - `post(url, form)` → `{ status, body }`: POST `application/x-www-form-urlencoded`
 *   (`form` es un objeto plano); `body` es el JSON de la respuesta o `null`.
 *   Lanza si la red falla.
 * - `saveRefreshToken(userId, token)`, `loadRefreshToken(userId)` → string | null,
 *   `deleteRefreshToken(userId)`: la tabla privada `apple_refresh_tokens`.
 * - `log(message)`: rastro en los logs de la función. Nunca recibe el token.
 * - `now()` → milisegundos (opcional; por defecto `Date.now()`).
 */

export const APPLE_AUDIENCE = 'https://appleid.apple.com';
export const TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** Vida del `client_secret`. Apple admite hasta 6 meses; se firma uno por petición. */
const SECRET_TTL_SECONDS = 5 * 60;

/** Un `authorizationCode` de Apple es corto; un tope evita cuerpos absurdos. */
const MAX_CODE_LENGTH = 1024;

const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlJson(value) {
  return base64url(encoder.encode(JSON.stringify(value)));
}

/**
 * La clave .p8 tal y como se pega en el dashboard: con cabeceras PEM, con
 * saltos de línea reales o escritos como `\n`. Devuelve los bytes PKCS#8.
 */
export function pemToPkcs8(pem) {
  const body = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) throw new Error('APPLE_PRIVATE_KEY no es un PEM');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  // PKCS#8 es una SEQUENCE de DER: empieza por 0x30.
  if (bytes[0] !== 0x30) throw new Error('APPLE_PRIVATE_KEY no es un PEM');
  return bytes;
}

/**
 * Los cuatro secretos, o `null` si falta alguno: sin ellos la función no hace
 * nada (no es un error, es «todavía sin configurar»).
 */
export function readConfig(env) {
  const config = {
    teamId: env.APPLE_TEAM_ID?.trim(),
    keyId: env.APPLE_KEY_ID?.trim(),
    privateKey: env.APPLE_PRIVATE_KEY?.trim(),
    clientId: env.APPLE_CLIENT_ID?.trim(),
  };
  return Object.values(config).every(Boolean) ? config : null;
}

/**
 * `client_secret` para Apple: JWT ES256 firmado con la clave .p8.
 * `iss` = Team ID, `sub` = client_id (el bundle ID), `aud` = appleid.apple.com,
 * `kid` = Key ID. WebCrypto ya devuelve la firma ECDSA en formato JWS (r‖s).
 */
export async function buildClientSecret({ teamId, keyId, clientId, privateKey }, nowMs) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const iat = Math.floor(nowMs / 1000);
  const signingInput = `${base64urlJson({ alg: 'ES256', kid: keyId })}.${base64urlJson({
    iss: teamId,
    iat,
    exp: iat + SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  })}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput)
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

/**
 * La carga de un JWT sin verificar la firma. Solo vale para el `id_token` que
 * Apple devuelve en la respuesta de `/auth/token`: llega directamente de Apple
 * por TLS, no de la app.
 */
export function decodeJwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

const UNCONFIGURED = { status: 200, body: { ok: false, reason: 'unconfigured' } };

async function exchange({ userId, appleSubjects, code, config, deps, now }) {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return { status: 400, body: { error: 'bad-request' } };
  }
  // Solo una sesión que entró con Apple puede guardar un token de Apple.
  if (appleSubjects.length === 0) return { status: 403, body: { error: 'not-apple' } };
  if (!config) return UNCONFIGURED;

  let response;
  try {
    response = await deps.post(TOKEN_URL, {
      client_id: config.clientId,
      client_secret: await buildClientSecret(config, now),
      code,
      grant_type: 'authorization_code',
    });
  } catch (cause) {
    deps.log(`apple-token exchange: fallo de red o de firma (${cause?.message ?? cause})`);
    return { status: 502, body: { error: 'apple' } };
  }
  if (response.status !== 200 || typeof response.body?.refresh_token !== 'string') {
    deps.log(
      `apple-token exchange: Apple respondió ${response.status} ${response.body?.error ?? ''}`
    );
    return { status: 502, body: { error: 'apple' } };
  }

  // El code tiene que ser de la MISMA persona de Apple que la sesión: si no,
  // borrar esta cuenta revocaría el acceso de otra.
  const claims = decodeJwtPayload(response.body.id_token);
  if (
    !claims ||
    claims.aud !== config.clientId ||
    typeof claims.sub !== 'string' ||
    !appleSubjects.includes(claims.sub)
  ) {
    deps.log('apple-token exchange: el id_token no es de la identidad de Apple de la sesión');
    return { status: 403, body: { error: 'identity' } };
  }

  await deps.saveRefreshToken(userId, response.body.refresh_token);
  return { status: 200, body: { ok: true } };
}

async function revoke({ userId, config, deps, now }) {
  const token = await deps.loadRefreshToken(userId);
  if (!token) return { status: 200, body: { ok: false, reason: 'none' } };
  if (!config) {
    deps.log('apple-token revoke: hay token guardado pero faltan los secretos de Apple');
    return UNCONFIGURED;
  }

  let response;
  try {
    response = await deps.post(REVOKE_URL, {
      client_id: config.clientId,
      client_secret: await buildClientSecret(config, now),
      token,
      token_type_hint: 'refresh_token',
    });
  } catch (cause) {
    deps.log(`apple-token revoke: fallo de red o de firma (${cause?.message ?? cause})`);
    return { status: 502, body: { error: 'apple' } };
  }
  if (response.status !== 200) {
    // La fila se queda: el borrado de la cuenta se la lleva en cascada igual,
    // pero si el borrado no llega a hacerse, se puede reintentar.
    deps.log(
      `apple-token revoke: Apple respondió ${response.status} ${response.body?.error ?? ''}`
    );
    return { status: 502, body: { error: 'apple' } };
  }

  await deps.deleteRefreshToken(userId);
  return { status: 200, body: { ok: true } };
}

/**
 * @param {{
 *   userId: string,
 *   appleSubjects: string[],  // `sub` de las identidades `apple` de la sesión
 *   body: unknown,
 *   config: ReturnType<typeof readConfig>,
 *   deps: object,
 * }} input
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleAppleTokenRequest({ userId, appleSubjects, body, config, deps }) {
  const now = deps.now ? deps.now() : Date.now();
  try {
    if (body?.action === 'exchange') {
      return await exchange({ userId, appleSubjects, code: body.code, config, deps, now });
    }
    if (body?.action === 'revoke') return await revoke({ userId, config, deps, now });
    return { status: 400, body: { error: 'bad-request' } };
  } catch (cause) {
    deps.log(`apple-token ${body?.action}: fallo inesperado (${cause?.message ?? cause})`);
    return { status: 500, body: { error: 'unavailable' } };
  }
}
