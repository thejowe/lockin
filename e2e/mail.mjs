// El correo del registro, de Mailpit al `lockin://` que se abre en el emulador.
//
// La CLI de Supabase levanta Mailpit (Inbucket hasta la 2.x temprana; la 2.116
// de CI ya trae `axllent/mailpit`) y GoTrue le entrega ahí todo lo que mandaría
// por SMTP. `supabase status -o json` da su URL como `MAILPIT_URL`, y todavía
// como `INBUCKET_URL`, marcada obsoleta.
//
// Por qué el runner resuelve el enlace y no el navegador del emulador: el enlace
// del correo es `http://127.0.0.1:54321/auth/v1/verify?...`, que GoTrue contesta
// con un 303 a `lockin://auth/callback?code=…`. Un navegador que recibe una
// redirección a un esquema propio sin gesto del usuario puede pedir permiso o
// quedarse quieto según versión, y eso es ruido que no dice nada de LockIn. Lo
// que sí es de LockIn —que el esquema abra la app y que la app canjee el código—
// se recorre entero con `am start`. Lo que se pierde es el salto navegador → app,
// que es del sistema. Y no hay `assetlinks.json`: los App Links necesitan un
// dominio https verificado, y aquí el enlace es http contra 127.0.0.1.
import assert from 'node:assert/strict';

/** El destino al que el correo tiene que devolver, igual que en el dashboard. */
export const AUTH_CALLBACK = 'lockin://auth/callback';

/** La URL de Mailpit que da `supabase status`, con la clave vieja de reserva. */
export function mailpitUrl(status) {
  const url = status.MAILPIT_URL ?? status.INBUCKET_URL;
  assert(url, '`supabase status` no da MAILPIT_URL ni INBUCKET_URL: ¿se excluyó el correo local?');
  return url.replace(/\/+$/, '');
}

/**
 * El enlace de verificación de GoTrue dentro de un mensaje de Mailpit.
 *
 * Se busca en el HTML y en el texto, por este orden: GoTrue manda HTML, y
 * Mailpit rellena `Text` a partir de él. Los `&amp;` del atributo se deshacen,
 * porque el enlace lleva `&type=` y `&redirect_to=` y con la entidad puesta
 * GoTrue no los leería.
 */
export function verifyLinkFrom(message) {
  const sources = [message?.HTML ?? '', message?.Text ?? ''];
  for (const source of sources) {
    const found = source.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/);
    if (found) return found[0].replace(/&amp;/g, '&');
  }
  return null;
}

/**
 * Lo que GoTrue devuelve al pinchar el enlace, ya validado: el `Location` tiene
 * que ser el callback de la app y traer el `code` de PKCE, que es el único
 * formato que `completeAuthLink` canjea con este cliente (`flowType: 'pkce'`).
 *
 * Si GoTrue no reconoce el `redirect_to` cae en `site_url` (`http://127.0.0.1:3000`);
 * decirlo por su nombre ahorra un run leyendo capturas de una app que no se abrió.
 */
export function callbackFrom(location) {
  assert(location, 'GoTrue no devolvió `Location` al verificar el enlace del correo');
  assert(
    location.startsWith(AUTH_CALLBACK),
    'GoTrue redirigió a ' +
      location +
      ' y no a ' +
      AUTH_CALLBACK +
      ': falta en `additional_redirect_urls` o la app pidió otro `emailRedirectTo`'
  );
  const params = new URL(location.replace(/#/, '?')).searchParams;
  const failure = params.get('error_description') ?? params.get('error');
  assert(!failure, 'GoTrue rechazó el enlace del correo: ' + failure);
  assert(
    params.get('code'),
    'El enlace volvió sin `?code=`: la app es PKCE y sin código `completeAuthLink` no canjea nada (' +
      location +
      ')'
  );
  return location;
}

/**
 * Espera el correo que GoTrue manda a `email` y devuelve su enlace de
 * verificación. Sondea: GoTrue entrega por SMTP después de contestar al
 * `updateUser`, así que el correo puede llegar un instante después de que la app
 * ya enseñe «Confirma tu email».
 */
export async function waitForVerifyLink(status, email, { timeoutMs = 60000 } = {}) {
  const base = mailpitUrl(status);
  const query = encodeURIComponent('to:"' + email + '"');
  const deadline = Date.now() + timeoutMs;
  let last = 'sin respuesta de Mailpit';
  while (Date.now() < deadline) {
    try {
      const search = await fetch(base + '/api/v1/search?query=' + query);
      if (search.ok) {
        const { messages = [] } = await search.json();
        last = messages.length + ' mensaje(s) para ' + email;
        if (messages.length > 0) {
          assert.equal(messages.length, 1, 'Se esperaba un solo correo para ' + email);
          const detail = await fetch(base + '/api/v1/message/' + messages[0].ID);
          assert(detail.ok, 'Mailpit no devolvió el mensaje ' + messages[0].ID);
          const link = verifyLinkFrom(await detail.json());
          assert(link, 'El correo para ' + email + ' no trae el enlace /auth/v1/verify');
          return link;
        }
      } else {
        last = 'Mailpit respondió ' + search.status;
      }
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      last = error.message;
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
  assert.fail('No llegó el correo de confirmación a Mailpit (' + base + '): ' + last);
}

/**
 * Pincha el enlace como lo haría el navegador, pero sin seguir la redirección:
 * consume el token en GoTrue y devuelve el `lockin://…?code=` que la app canjea.
 */
export async function resolveVerifyLink(link) {
  const response = await fetch(link, { redirect: 'manual' });
  assert(
    response.status >= 300 && response.status < 400,
    'GoTrue contestó ' + response.status + ' al enlace del correo, no una redirección'
  );
  return callbackFrom(response.headers.get('location'));
}
