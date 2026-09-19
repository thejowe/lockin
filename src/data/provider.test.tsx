/**
 * Tests de `useQuery`.
 *
 * Lo que se fija aquí no es la lectura —eso lo cubre cada hook de feature— sino
 * las tres propiedades por las que las features dejaron de fiarse de este hook:
 * que retiene el dato anterior mientras relee (sin eso, cada aviso de realtime
 * vaciaba la pantalla y desmontaba su árbol: run 34160309273), que el `null` de
 * una lectura resuelta sí se publica (lo que desapareció tiene que desaparecer)
 * y que dos lectores de la misma `key` a la vez son una sola petición.
 *
 * Las lecturas se retienen a mano con promesas diferidas: con el mock resuelven
 * al instante y el estado intermedio —el que rompía— no se llega a ver.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import { Text } from 'react-native';

import { DataProvider, useQuery } from '@/data';
import { createMockRepositories } from '@/data/mock';

import type { Repositories } from '@/data';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: Error) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (cause: Error) => void = () => {};
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

let repositories: Repositories;

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider value={repositories}>{children}</DataProvider>;
}

beforeEach(() => {
  // Cada test con su propio juego: las peticiones en vuelo se comparten por
  // juego de repositorios, y un test no debe engancharse a las del anterior.
  repositories = createMockRepositories();
});

describe('useQuery — retención mientras relee', () => {
  it('no publica null en ningún render de la relectura: el dato anterior sigue ahí', async () => {
    const pending: Deferred<string>[] = [];
    const run = jest.fn(() => {
      const next = deferred<string>();
      pending.push(next);
      return next.promise;
    });

    /** Todo lo que ha visto la pantalla, render a render. */
    const seen: (string | null)[] = [];
    const { result } = await renderHook(
      () => {
        const state = useQuery('saludo', run);
        seen.push(state.data);
        return state;
      },
      { wrapper }
    );

    await act(async () => {
      pending[0].resolve('hola');
    });
    expect(result.current.data).toBe('hola');
    expect(result.current.loading).toBe(false);

    seen.length = 0;
    await act(async () => {
      result.current.refresh();
    });

    // En vuelo: el dato de antes sigue publicado, y `loading` no manda a la
    // pantalla a su rama de carga — para eso está `refreshing`.
    expect(result.current.data).toBe('hola');
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      pending[1].resolve('adiós');
    });
    expect(result.current.data).toBe('adiós');
    expect(result.current.refreshing).toBe(false);

    // Ni un solo render intermedio con el hueco: ese era el que desmontaba el
    // compositor y cerraba el teclado de Android.
    expect(seen).not.toContain(null);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('publica el null que traiga la relectura: lo que desapareció desaparece', async () => {
    const pending: Deferred<string | null>[] = [];
    const run = jest.fn(() => {
      const next = deferred<string | null>();
      pending.push(next);
      return next.promise;
    });

    const { result } = await renderHook(() => useQuery('match:uno', run), { wrapper });

    await act(async () => {
      pending[0].resolve('el match');
    });
    expect(result.current.data).toBe('el match');

    await act(async () => {
      result.current.refresh();
    });
    await act(async () => {
      pending[1].resolve(null);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it('al cambiar de key no retiene el dato de la consulta anterior', async () => {
    const pending = new Map<string, Deferred<string>>();
    const run = jest.fn((id: string) => {
      const next = deferred<string>();
      pending.set(id, next);
      return next.promise;
    });

    const { result, rerender } = await renderHook(
      ({ id }: { id: string }) => useQuery(`match:${id}`, () => run(id)),
      { wrapper, initialProps: { id: 'ana' } }
    );

    await act(async () => {
      pending.get('ana')?.resolve('perfil de ana');
    });
    expect(result.current.data).toBe('perfil de ana');

    await rerender({ id: 'bruno' });

    // Retener aquí enseñaría el perfil de Ana en el chat de Bruno: la consulta
    // es otra y el dato de la anterior no dice nada de ella.
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      pending.get('bruno')?.resolve('perfil de bruno');
    });
    expect(result.current.data).toBe('perfil de bruno');
  });

  it('un reintento tras un fallo vuelve a ser una primera carga, no una relectura', async () => {
    const pending: Deferred<string>[] = [];
    const run = jest.fn(() => {
      const next = deferred<string>();
      pending.push(next);
      return next.promise;
    });

    const { result } = await renderHook(() => useQuery('session:onboarded', run), { wrapper });

    await act(async () => {
      pending[0].reject(new Error('Sin conexión'));
    });
    expect(result.current.error?.message).toBe('Sin conexión');
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      result.current.refresh();
    });

    // Un fallo no deja dato que retener: mientras se reintenta no hay nada que
    // enseñar, y el error de la petición ya superada no se anuncia.
    expect(result.current.loading).toBe(true);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {
      pending[1].resolve('por fin');
    });
    expect(result.current.data).toBe('por fin');
    expect(result.current.error).toBeNull();
  });

  it('un fallo que no es Error se publica como Error', async () => {
    const run = jest.fn(() => Promise.reject('se cayó la red'));

    const { result } = await renderHook(() => useQuery('raro', run), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe('se cayó la red'));
  });

  it('un objeto con message se publica con su message, no como [object Object]', async () => {
    // Es la forma de un `PostgrestError` y la de cualquier SDK que no herede de
    // `Error`: con `String(cause)` el motivo se perdía entero.
    const causa = { message: 'permission denied for table profiles', code: '42501' };
    const run = jest.fn(() => Promise.reject(causa));

    const { result } = await renderHook(() => useQuery('rls', run), { wrapper });

    await waitFor(() =>
      expect(result.current.error?.message).toBe('permission denied for table profiles')
    );
    expect(result.current.error?.cause).toBe(causa);
  });

  it('un run que revienta ANTES de devolver promesa se publica como error, no tumba la app', async () => {
    // Pasa de verdad: la fachada de `./active` resuelve el backend al leer
    // `repositories.session`, así que sin credenciales lanza dentro del propio
    // `run`, sin llegar a haber promesa. Ese fallo síncrono escapaba del efecto
    // y mataba el árbol entero — pantalla en negro en el E2E (run 35362453233).
    const run = jest.fn((): Promise<string> => {
      throw new Error('LockIn no puede arrancar sin backend');
    });

    const { result } = await renderHook(() => useQuery('síncrono', run), { wrapper });

    await waitFor(() =>
      expect(result.current.error?.message).toBe('LockIn no puede arrancar sin backend')
    );
    expect(result.current.loading).toBe(false);
  });

  it('deja en el log la key y el error entero: sin eso el fallo es mudo', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    // El rastro se calla bajo Jest —cada caso de error haría ruido—, así que
    // aquí se pide expresamente el comportamiento de fuera de tests.
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const causa = new Error('no hay red');
    const run = jest.fn(() => Promise.reject(causa));

    try {
      const { result } = await renderHook(() => useQuery('session:onboarded', run), { wrapper });
      await waitFor(() => expect(result.current.error).toBe(causa));
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }

    expect(error).toHaveBeenCalledWith(
      '[lockin] la consulta "session:onboarded" falló: no hay red',
      causa
    );
    error.mockRestore();
  });
});

describe('useQuery — una petición por key', () => {
  it('dos lectores de la misma key a la vez no disparan dos lecturas', async () => {
    let lecturas = 0;
    const run = jest.fn(() => Promise.resolve(`lectura ${(lecturas += 1)}`));

    // Es el caso real: `useConversation` y la tarjeta de sesión piden
    // `profile:current` por separado en el mismo commit.
    const { result } = await renderHook(
      () => ({
        chat: useQuery('profile:current', run),
        tarjeta: useQuery('profile:current', run),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.chat.data).toBe('lectura 1'));
    expect(result.current.tarjeta.data).toBe('lectura 1');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('el refresh de un lector relee para todos los de su key', async () => {
    let lecturas = 0;
    const run = jest.fn(() => Promise.resolve(`lectura ${(lecturas += 1)}`));

    const { result } = await renderHook(
      () => ({
        chat: useQuery('profile:current', run),
        tarjeta: useQuery('profile:current', run),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.chat.data).toBe('lectura 1'));

    await act(async () => {
      result.current.chat.refresh();
    });

    await waitFor(() => expect(result.current.tarjeta.data).toBe('lectura 2'));
    expect(result.current.chat.data).toBe('lectura 2');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keys distintas no se comparten la lectura', async () => {
    const run = jest.fn((key: string) => Promise.resolve(key));

    const { result } = await renderHook(
      () => ({
        uno: useQuery('match:uno', () => run('match:uno')),
        dos: useQuery('match:dos', () => run('match:dos')),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.uno.data).toBe('match:uno'));
    expect(result.current.dos.data).toBe('match:dos');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('dos juegos de repositorios no se comparten la petición en vuelo', async () => {
    const otros = createMockRepositories();
    const pending: Deferred<string>[] = [];
    const run = jest.fn(() => {
      const next = deferred<string>();
      pending.push(next);
      return next.promise;
    });

    function Lector({ testID }: { testID: string }) {
      const { data } = useQuery('profile:current', run);
      return <Text testID={testID}>{data ?? 'sin dato'}</Text>;
    }

    await render(
      <DataProvider value={repositories}>
        <Lector testID="fuera" />
        <DataProvider value={otros}>
          <Lector testID="dentro" />
        </DataProvider>
      </DataProvider>
    );

    // Los dos piden la misma `key` en el mismo commit, pero la misma `key`
    // significa datos distintos en cada juego: coalescerlos daría el perfil de
    // un backend al otro.
    expect(run).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending[0].resolve('del juego de fuera');
      pending[1].resolve('del juego de dentro');
    });

    expect(screen.getByTestId('fuera')).toHaveTextContent('del juego de fuera');
    expect(screen.getByTestId('dentro')).toHaveTextContent('del juego de dentro');
  });

  it('al desmontarse el último lector la key deja de contar relecturas', async () => {
    const run = jest.fn(() => Promise.resolve('un dato'));

    const primero = await renderHook(() => useQuery('profile:current', run), { wrapper });
    await waitFor(() => expect(primero.result.current.data).toBe('un dato'));
    await act(async () => {
      primero.result.current.refresh();
    });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    // En RNTL 14 `unmount` también es asíncrono: sin esperarlo queda un `act`
    // abierto que se cuela en los tests siguientes.
    await primero.unmount();

    // Sin la limpieza, el lector nuevo heredaría el contador de relecturas del
    // anterior y su primera lectura pasaría por una relectura ajena.
    const segundo = await renderHook(() => useQuery('profile:current', run), { wrapper });
    await waitFor(() => expect(segundo.result.current.data).toBe('un dato'));
    expect(run).toHaveBeenCalledTimes(3);
  });
});

describe('useRepositories', () => {
  it('sin provider devuelve la implementación activa del proyecto', async () => {
    const { result } = await renderHook(() => useQuery('activo', () => Promise.resolve('sí')));

    await waitFor(() => expect(result.current.data).toBe('sí'));
  });
});
