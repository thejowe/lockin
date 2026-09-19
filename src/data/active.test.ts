/**
 * Tests de la elección de backend.
 *
 * `active.ts` son tres líneas efectivas, pero se equivocan de la peor manera
 * posible: sin credenciales caía al mock en silencio, así que una build de
 * release mal configurada arrancaba con perfiles semilla y parecía funcionar
 * perfectamente. Aquí se fija que fuera de desarrollo eso lanza, y que dice
 * exactamente qué variable falta.
 *
 * La comprobación es **perezosa**: salta al primer uso del repositorio, no al
 * cargar el módulo. `npx expo export` carga los módulos sin ninguna variable de
 * entorno, y con la comprobación en el cuerpo del módulo el export moría. Por
 * eso cada caso que espera el fallo toca `repositories` o `activeBackend()`,
 * y hay un caso que fija que la sola carga no lanza.
 *
 * Las credenciales se manipulan en `process.env` y el módulo se carga con
 * `jest.isolateModules`: `./supabase/client` las lee una sola vez al
 * importarse, así que cada caso necesita una carga limpia.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalAllowMock = process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK;
const originalDev = __DEV__;

function setDev(value: boolean): void {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}

function setCredentials(present: boolean): void {
  if (present) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    return;
  }

  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

/** Carga `./active` de cero, con el entorno que haya puesto el caso. */
function loadActive(): typeof import('./active') {
  const loaded: { module?: typeof import('./active') } = {};
  jest.isolateModules(() => {
    loaded.module = require('./active') as typeof import('./active');
  });
  if (!loaded.module) throw new Error('`./active` no se cargó');
  return loaded.module;
}

afterEach(() => {
  setDev(originalDev);
  process.env.NODE_ENV = originalNodeEnv;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalAnonKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  if (originalAllowMock === undefined) delete process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK;
  else process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK = originalAllowMock;
  jest.restoreAllMocks();
});

describe('elección de backend', () => {
  it('en desarrollo sin credenciales sigue cayendo al mock: arrancar sin configurar nada es la gracia', () => {
    setDev(true);
    setCredentials(false);

    expect(loadActive().activeBackend()).toBe('mock');
  });

  it('fuera de desarrollo sin credenciales lanza y nombra las dos variables que faltan', () => {
    setDev(false);
    setCredentials(false);

    const active = loadActive();
    expect(() => active.repositories.profiles).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY/
    );
  });

  it('fuera de desarrollo nombra solo la variable que falta', () => {
    setDev(false);
    setCredentials(false);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';

    const active = loadActive();
    expect(() => active.activeBackend()).toThrow(/faltan EXPO_PUBLIC_SUPABASE_ANON_KEY\./);
  });

  it('cargar el módulo sin entorno no lanza: es lo que hace `expo export` al compilar el bundle', () => {
    setDev(false);
    setCredentials(false);

    // Ni la carga ni la referencia a los tres exports resuelven nada. El
    // export web corre sin bloque `env:` y recorre los módulos para descubrir
    // las rutas; si esto lanza, no se genera ninguna.
    const active = loadActive();
    expect(active.repositories).toBeDefined();
    expect(active.presence).toBeDefined();
    expect(active.videoSignal).toBeDefined();
  });

  it('la presencia y el vídeo también fallan en release sin credenciales', () => {
    setDev(false);
    setCredentials(false);

    const active = loadActive();
    expect(() =>
      active.presence.join('s1', 'p1', { onPeers: () => {}, onConnection: () => {} })
    ).toThrow(/LockIn no puede arrancar sin backend/);
    expect(() =>
      active.videoSignal.send('s1', { kind: 'hangup', from: 'p1', payload: null })
    ).toThrow(/LockIn no puede arrancar sin backend/);
  });

  it('fuera de desarrollo con permiso explícito sirve el mock en vez de lanzar', () => {
    // Es el control negativo de `E2E Android`: un APK de release *a propósito*
    // sin credenciales, que tiene que recorrer la app entera sobre el mock para
    // demostrar al reiniciar que no hay nada en Postgres. Con la guarda a secas
    // reventaba en la primera pantalla (run 35362453233).
    setDev(false);
    setCredentials(false);
    process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK = '1';

    const active = loadActive();
    expect(active.activeBackend()).toBe('mock');
    expect(active.repositories.session).toBeDefined();
  });

  it('el permiso solo vale escrito exactamente como `1`: nada de valores por aproximación', () => {
    setDev(false);
    setCredentials(false);
    process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK = 'true';

    expect(() => loadActive().activeBackend()).toThrow(/LockIn no puede arrancar sin backend/);
  });

  it('el rastro dice que el mock va con permiso, para que nadie lo confunda con Supabase', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    setDev(false);
    setCredentials(false);
    process.env.EXPO_PUBLIC_LOCKIN_ALLOW_MOCK = '1';
    process.env.NODE_ENV = 'production';

    loadActive().activeBackend();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1'));
  });

  it('con credenciales elige Supabase, también fuera de desarrollo', () => {
    setDev(false);
    setCredentials(true);

    const active = loadActive();
    expect(active.activeBackend()).toBe('supabase');
    expect(active.presence).toBeDefined();
    expect(active.videoSignal).toBeDefined();
  });

  it('la fachada sirve los seis repositorios, no solo el primero que se pida', () => {
    setDev(true);
    setCredentials(false);

    const { repositories } = loadActive();

    // Cada propiedad es un getter perezoso propio: si alguna se quedara sin
    // resolver, la pantalla que la usa vería `undefined` en tiempo de ejecución.
    expect(repositories.session).toBeDefined();
    expect(repositories.profiles).toBeDefined();
    expect(repositories.discovery).toBeDefined();
    expect(repositories.matches).toBeDefined();
    expect(repositories.messages).toBeDefined();
    expect(repositories.sessions).toBeDefined();
  });

  it('la fachada de presencia y vídeo delega en el adaptador del backend', () => {
    setDev(true);
    setCredentials(false);

    const { presence, videoSignal } = loadActive();
    const handlers = { onPeers: () => {}, onConnection: () => {} };

    // En memoria, entrar y salir de una sala no falla y devuelve la salida.
    expect(typeof presence.join('s1', 'p1', handlers)).toBe('function');
    expect(
      typeof videoSignal.join('s1', 'p1', { onMessage: () => {}, onConnection: () => {} })
    ).toBe('function');
    videoSignal.send('s1', { kind: 'hangup', from: 'p1', payload: null });
  });

  it('deja rastro de qué backend está activo al arrancar', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    setDev(true);
    setCredentials(false);
    // El rastro se calla bajo Jest: cada archivo de suite lo importa y el dato
    // no aporta nada ahí. Fuera de tests sí tiene que salir.
    process.env.NODE_ENV = 'development';

    loadActive().activeBackend();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('mock en memoria'));
  });

  it('el rastro dice Supabase cuando es Supabase', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    setDev(true);
    setCredentials(true);
    process.env.NODE_ENV = 'development';

    loadActive().activeBackend();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('Supabase'));
  });
});
