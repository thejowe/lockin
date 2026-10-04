/**
 * Guardia del «fetch failed» de los oráculos contra el Supabase local.
 *
 * Run 37236214636, con la instrumentación de `fetch-diagnostics.mjs`: la
 * primera petición del oráculo tras un flujo de Maestro largo (8 min 31 s la
 * valoración, 2 min 11 s la sala) falló con `UND_ERR_SOCKET` «other side
 * closed» a los 3–12 ms, sin llegar a Kong. En ese mismo instante un `curl` a
 * Kong respondía 200, y repetir la petición también: el backend estaba bien y
 * lo que fallaba era la conexión keep-alive que Node había guardado en su pool
 * de antes del flujo, ya cerrada por Kong por inactividad. Cuando esa primera
 * petición era de PostgREST, postgrest-js la repetía solo y el run seguía; si
 * era de GoTrue (`getUserById` tras `sign-in-abandon.yaml`), auth-js no la
 * repite y el oráculo moría (runs 37228331950 y 37231590523).
 *
 * El arreglo repite una vez, en una conexión nueva, solo ese fallo y solo en
 * peticiones que se pueden repetir sin efectos (GET/HEAD). Estos casos fijan
 * los límites.
 *
 * Corren con `node --test` (`npm run test:e2e`), no con Jest.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wrapFetch } from './fetch-diagnostics.mjs';

/** El error que da undici al escribir en un socket que el servidor ya cerró. */
function staleSocket() {
  const cause = Object.assign(new Error('other side closed'), {
    name: 'SocketError',
    code: 'UND_ERR_SOCKET',
  });
  return new TypeError('fetch failed', { cause });
}

/** Un `fetch` falso que va devolviendo, en orden, lo que se le da. */
function scripted(...outcomes) {
  const calls = [];
  const fetch = async (input, init) => {
    calls.push({ input, init });
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

const ok = { status: 200 };
const quiet = { log: () => {}, probe: async () => ({}) };

describe('los oráculos sobreviven a la conexión keep-alive que Kong ya cerró', () => {
  it('un GET que cae con «other side closed» se repite una vez y devuelve la respuesta', async () => {
    const { fetch, calls } = scripted(staleSocket(), ok);
    const response = await wrapFetch(fetch, quiet)('http://127.0.0.1:54321/auth/v1/admin/users/x');
    assert.equal(response, ok);
    assert.equal(calls.length, 2);
  });

  it('un POST no se repite: si llegó a procesarse, repetirlo crearía filas dobles', async () => {
    const { fetch, calls } = scripted(staleSocket(), ok);
    await assert.rejects(
      wrapFetch(fetch, quiet)('http://127.0.0.1:54321/rest/v1/profiles', { method: 'POST' }),
      /fetch failed/
    );
    assert.equal(calls.length, 1);
  });

  it('otro fallo de red no se repite: el backend caído tiene que verse', async () => {
    const refused = new TypeError('fetch failed', {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    });
    const { fetch, calls } = scripted(refused, ok);
    await assert.rejects(wrapFetch(fetch, quiet)('http://127.0.0.1:54321/x'), /fetch failed/);
    assert.equal(calls.length, 1);
  });

  it('se repite una sola vez: si la conexión nueva también cae, el error sube', async () => {
    const { fetch, calls } = scripted(staleSocket(), staleSocket(), ok);
    await assert.rejects(wrapFetch(fetch, quiet)('http://127.0.0.1:54321/x'), /fetch failed/);
    assert.equal(calls.length, 2);
  });
});
