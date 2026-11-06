/**
 * Sello «Verificado en GitHub/LinkedIn» comprobado en el servidor. Sin Deno ni
 * red: lo de fuera entra por `deps`. Es JavaScript plano (ESM): lo importan
 * Deno (`index.ts`) y `node --test`.
 *
 * Por qué existe (auditoría de seguridad run-1, 2026-11-06): GoTrue escribe la
 * identidad en `auth.identities` en su propio callback, antes de devolver el
 * code y sin ligarla al navegador que empezó `linkIdentity`. Que la identidad
 * esté en la cuenta no prueba que el dueño de la cuenta pasara por GitHub. Lo
 * que sí lo prueba es el `provider_token` que GoTrue devuelve AL CANJEAR el
 * code: solo lo tiene quien guarda el verificador PKCE y recibe el code.
 *
 * El cliente manda ese token; aquí se pregunta a la API del proveedor de quién
 * es, y el sello lo pone `seal_identity_verification` (service role) solo si la
 * cuenta tiene una identidad de ese proveedor con ESE `provider_id`.
 *
 * `deps`:
 * - `fetchProviderUser(url, token)` → `{ status, body }` (`body` JSON o `null`).
 *   Lanza si la red falla.
 * - `seal(userId, provider, providerId)` → `boolean`: el RPC
 *   `seal_identity_verification`. Lanza si el RPC falla.
 * - `log(message)`: rastro. Nunca recibe tokens.
 */

export const PROVIDERS = Object.freeze({
  github: {
    url: 'https://api.github.com/user',
    /** GitHub: `id` numérico; en `auth.identities.provider_id` va como texto. */
    idOf: (body) =>
      body && (typeof body.id === 'number' || typeof body.id === 'string') && `${body.id}` !== ''
        ? `${body.id}`
        : null,
  },
  linkedin_oidc: {
    url: 'https://api.linkedin.com/v2/userinfo',
    /** LinkedIn OIDC: `sub`, el mismo que GoTrue guarda como `provider_id`. */
    idOf: (body) => (body && typeof body.sub === 'string' && body.sub !== '' ? body.sub : null),
  },
});

const MAX_TOKEN_LENGTH = 4096;

/**
 * Petición del cliente (la sesión ya la comprobó `index.ts`).
 *
 * - 400 `request`: cuerpo mal formado o proveedor desconocido.
 * - 403 `token`: el proveedor no acepta el token.
 * - 403 `mismatch`: el token es de una cuenta que no está vinculada a esta.
 * - 502 `upstream`: el proveedor o el RPC fallan (el cliente puede reintentar).
 */
export async function handleVerifyRequest({ userId, body, deps }) {
  const provider = body && typeof body === 'object' ? body.provider : undefined;
  const token = body && typeof body === 'object' ? body.providerToken : undefined;
  const spec = typeof provider === 'string' ? PROVIDERS[provider] : undefined;
  if (
    !spec ||
    !Object.hasOwn(PROVIDERS, provider) ||
    typeof token !== 'string' ||
    token === '' ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return { status: 400, body: { error: 'request' } };
  }

  let answer;
  try {
    answer = await deps.fetchProviderUser(spec.url, token);
  } catch (error) {
    deps.log?.(`${provider}: red: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 502, body: { error: 'upstream' } };
  }
  if (answer.status === 401 || answer.status === 403) {
    return { status: 403, body: { error: 'token' } };
  }
  if (answer.status !== 200) {
    deps.log?.(`${provider}: respuesta ${answer.status}`);
    return { status: 502, body: { error: 'upstream' } };
  }

  const providerId = spec.idOf(answer.body);
  if (!providerId) {
    deps.log?.(`${provider}: respuesta sin id`);
    return { status: 502, body: { error: 'upstream' } };
  }

  let sealed;
  try {
    sealed = await deps.seal(userId, provider, providerId);
  } catch (error) {
    deps.log?.(`${provider}: sello: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 502, body: { error: 'upstream' } };
  }
  if (!sealed) return { status: 403, body: { error: 'mismatch' } };
  return { status: 200, body: { ok: true } };
}
