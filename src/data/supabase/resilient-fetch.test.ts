/**
 * La repetición ante `PGRST303`. Sin red: `base` es un `jest.fn()` que devuelve
 * respuestas de mentira con solo lo que el envoltorio lee (`status`, `clone`,
 * `json`), para no depender de qué `Response` traiga el entorno de Jest.
 *
 * Lo que se protege, en orden de importancia:
 *  1. que repita UNA vez y devuelva la segunda respuesta (el arreglo);
 *  2. que si la segunda también es `PGRST303` la devuelva tal cual (no oculta
 *     un desfase de reloj de verdad);
 *  3. que no toque nada más: otros 401, otros códigos, cuerpos que no son JSON.
 */

import { CLOCK_SKEW_ERROR_CODE, REPLAY_DELAY_MS, createReplayingFetch } from './resilient-fetch';

type FakeResponse = Response & { readonly tag: string };

function reply(status: number, body: unknown, tag = `${status}`): FakeResponse {
  const response = {
    tag,
    status,
    clone: () => response,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  };
  return response as unknown as FakeResponse;
}

const clockSkew = (tag = 'skew') =>
  reply(401, { code: CLOCK_SKEW_ERROR_CODE, message: 'JWT issued at future' }, tag);

const URL_REST = 'https://ref.supabase.co/rest/v1/profiles?select=id';

describe('createReplayingFetch', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
  });

  /** Lanza la petición y adelanta el reloj lo que haga falta para que acabe. */
  async function run(
    fetchWithReplay: typeof fetch,
    input: Parameters<typeof fetch>[0],
    init?: RequestInit
  ) {
    const pending = fetchWithReplay(input, init);
    await jest.advanceTimersByTimeAsync(REPLAY_DELAY_MS);
    return pending;
  }

  it('repite una vez tras un 401 PGRST303 y devuelve la segunda respuesta', async () => {
    const ok = reply(200, [], 'ok');
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(ok);
    const init = { method: 'GET', headers: { Authorization: 'Bearer token' } };

    const result = await run(createReplayingFetch(base), URL_REST, init);

    expect(result).toBe(ok);
    expect(base).toHaveBeenCalledTimes(2);
    // Misma petición, misma URL y mismas opciones: mismo token.
    expect(base).toHaveBeenNthCalledWith(1, URL_REST, init);
    expect(base).toHaveBeenNthCalledWith(2, URL_REST, init);
  });

  it('espera antes de repetir: no reenvía en el mismo instante', async () => {
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(reply(200, []));

    const pending = createReplayingFetch(base)(URL_REST);
    await jest.advanceTimersByTimeAsync(REPLAY_DELAY_MS - 1);
    expect(base).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await pending;
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('respeta el retardo que se le pasa', async () => {
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(reply(200, []));

    const pending = createReplayingFetch(base, 1000)(URL_REST);
    await jest.advanceTimersByTimeAsync(999);
    expect(base).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await pending;
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('deja rastro en el log cuando repite: es lo que confirma en el logcat del E2E que el arreglo actuó', async () => {
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(reply(200, []));

    await run(createReplayingFetch(base), URL_REST);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[lockin]');
    expect(warn.mock.calls[0][0]).toContain(CLOCK_SKEW_ERROR_CODE);
  });

  it('si la segunda respuesta también es PGRST303 la devuelve tal cual: un desfase de reloj real no se oculta ni se reintenta en bucle', async () => {
    const second = clockSkew('segunda');
    const base = jest
      .fn()
      .mockResolvedValueOnce(clockSkew('primera'))
      .mockResolvedValueOnce(second);

    const result = await run(createReplayingFetch(base), URL_REST);

    expect(result).toBe(second);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('repite también una escritura: PGRST303 sale antes de ejecutar nada, así que no duplica filas', async () => {
    const ok = reply(201, null, 'creado');
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(ok);
    const init = { method: 'POST', body: JSON.stringify({ text: 'hola' }) };

    const result = await run(createReplayingFetch(base), URL_REST, init);

    expect(result).toBe(ok);
    expect(base).toHaveBeenNthCalledWith(2, URL_REST, init);
  });

  it('acepta una URL como objeto URL', async () => {
    const base = jest.fn().mockResolvedValueOnce(clockSkew()).mockResolvedValueOnce(reply(200, []));

    await run(createReplayingFetch(base), new URL(URL_REST));

    expect(base).toHaveBeenCalledTimes(2);
  });

  describe('no toca lo que no es el suyo', () => {
    it.each([
      ['un 200', reply(200, [])],
      ['un 500 con ese mismo código', reply(500, { code: CLOCK_SKEW_ERROR_CODE })],
      ['un 401 de otro código (token caducado)', reply(401, { code: 'PGRST301' })],
      ['un 401 sin cuerpo JSON (un proxy)', reply(401, new SyntaxError('no es JSON'))],
      ['un 401 con cuerpo que no es un objeto', reply(401, 'PGRST303')],
      ['un 401 con cuerpo nulo', reply(401, null)],
    ])('%s: una sola llamada, respuesta intacta', async (_name, response) => {
      const base = jest.fn().mockResolvedValue(response);

      const result = await run(createReplayingFetch(base), URL_REST);

      expect(result).toBe(response);
      expect(base).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });

    it('si el fetch rechaza (sin red) propaga el error y no repite', async () => {
      const base = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

      // Sin `run`: no hay espera que adelantar, y avanzar timers con el rechazo
      // sin manejar lo convierte en un rechazo huérfano.
      await expect(createReplayingFetch(base)(URL_REST)).rejects.toThrow('Network request failed');
      expect(base).toHaveBeenCalledTimes(1);
    });
  });

  describe('no repite lo que no puede reenviar idéntico', () => {
    it('un cuerpo que no es texto (un flujo ya consumido)', async () => {
      const skew = clockSkew();
      const base = jest.fn().mockResolvedValue(skew);
      const init = { method: 'POST', body: new Uint8Array([1, 2, 3]) as unknown as BodyInit };

      const result = await run(createReplayingFetch(base), URL_REST, init);

      expect(result).toBe(skew);
      expect(base).toHaveBeenCalledTimes(1);
    });

    it('un objeto Request (su cuerpo ya se pudo consumir)', async () => {
      const skew = clockSkew();
      const base = jest.fn().mockResolvedValue(skew);
      const request = { url: URL_REST } as unknown as Request;

      const result = await run(createReplayingFetch(base), request);

      expect(result).toBe(skew);
      expect(base).toHaveBeenCalledTimes(1);
    });

    it('una petición ya cancelada', async () => {
      const skew = clockSkew();
      const base = jest.fn().mockResolvedValue(skew);
      const controller = new AbortController();
      controller.abort();

      const result = await run(createReplayingFetch(base), URL_REST, { signal: controller.signal });

      expect(result).toBe(skew);
      expect(base).toHaveBeenCalledTimes(1);
    });
  });

  it('por defecto delega en el fetch global, resuelto en el momento de la llamada', async () => {
    const ok = reply(200, []);
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(ok);
    try {
      const result = await createReplayingFetch()(URL_REST, { method: 'GET' });

      expect(result).toBe(ok);
      expect(global.fetch).toHaveBeenCalledWith(URL_REST, { method: 'GET' });
    } finally {
      global.fetch = original;
    }
  });
});
