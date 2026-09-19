/**
 * `fetch` del cliente de Supabase: repite UNA vez una petición que PostgREST
 * rechaza con `PGRST303` («JWT issued at future»).
 *
 * De dónde sale ese error, con la fuente delante (no es de esta app):
 *
 *  - PostgREST rechaza un token cuyo `iat` es posterior a su reloj MÁS 30 s de
 *    tolerancia. Un redondeo al segundo o un desfase entre contenedores no
 *    llegan ni de lejos; hacen falta 30 s.
 *  - Lo que los provoca es un bug de PostgREST: el reloj que usa para validar
 *    lo sirve la librería `auto-update`, y tras un rato sin tráfico la primera
 *    petición lee un valor viejo (minutos, a veces semanas). Solo falla la
 *    primera, y la siguiente con el MISMO token pasa. Upstream:
 *    PostgREST/postgrest#5196, arreglado en v14.18 y v16.3 (PR #5208) quitando
 *    `auto-update`. El `supabase start` de CLI 2.116.0 levanta v16.1 y el de
 *    2.117.0 v16.2: los dos lo llevan.
 *  - Le pasa igual a un proyecto alojado mientras su PostgREST sea anterior:
 *    la primera consulta de un usuario tras un rato de calma falla con un 401
 *    que no es suyo.
 *
 * Por qué repetir es seguro y no tapa un fallo real:
 *
 *  - `PGRST303` sale al validar el token, ANTES de ejecutar nada: la petición
 *    no llegó a Postgres, así que volver a enviarla no duplica ninguna
 *    escritura, sea `GET`, `POST` o `rpc`.
 *  - Es una sola repetición y con una espera corta. Si el reloj está mal de
 *    verdad (un token con `iat` ≥ 30 s en el futuro), la segunda respuesta
 *    también es `PGRST303` y esa se devuelve tal cual: el error llega a
 *    `reportQueryError` como siempre. Sin bucles, sin cambiar el código.
 *  - Solo se activa con 401 + ese código exacto. Cualquier otro 401 (token
 *    caducado, JWT mal firmado…) pasa sin tocar, y un `fetch` que rechaza por
 *    falta de red también.
 */

type Fetch = typeof fetch;

/** El código de PostgREST para «`iat` posterior a mi reloj». */
export const CLOCK_SKEW_ERROR_CODE = 'PGRST303';

/**
 * Espera antes de repetir. El reporte upstream más limpio ve pasar la misma
 * petición con el mismo token 3 ms después; 300 ms deja margen de sobra para
 * que el reloj de PostgREST se refresque sin que el usuario lo note.
 */
export const REPLAY_DELAY_MS = 300;

async function isClockSkewRejection(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;

  try {
    // Clon: quien recibe la respuesta original necesita poder leerla entera.
    const body: unknown = await response.clone().json();
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as { code?: unknown }).code === CLOCK_SKEW_ERROR_CODE
    );
  } catch {
    // El cuerpo no es JSON (un 401 de un proxy, por ejemplo): no es el nuestro.
    return false;
  }
}

/**
 * Solo se puede repetir lo que se puede volver a enviar idéntico: una URL en
 * texto y un cuerpo que sea texto o no exista. `supabase-js` siempre manda
 * `JSON.stringify(...)`. Un `Request` o un flujo ya consumido no se toca.
 */
function canReplay(input: Parameters<Fetch>[0], init: Parameters<Fetch>[1]): boolean {
  if (init?.signal?.aborted) return false;

  const plainUrl = typeof input === 'string' || input instanceof URL;
  const plainBody = init?.body == null || typeof init.body === 'string';
  return plainUrl && plainBody;
}

export function createReplayingFetch(
  base: Fetch = (input, init) => fetch(input, init),
  delayMs: number = REPLAY_DELAY_MS
): Fetch {
  return async (input, init) => {
    const first = await base(input, init);
    if (!(await isClockSkewRejection(first)) || !canReplay(input, init)) return first;

    // Este rastro es el que dice, en el logcat del E2E, que el arreglo actuó.
    console.warn(
      `[lockin] PostgREST rechazó el token con ${CLOCK_SKEW_ERROR_CODE}; se repite la petición una vez`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return base(input, init);
  };
}

export const resilientFetch: Fetch = createReplayingFetch();
