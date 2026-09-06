/**
 * Andamiaje común para probar las rutas de `src/app/`.
 *
 * Una ruta de `expo-router` es un componente normal, pero solo se monta si le
 * das dos cosas que en la app pone el framework: el router (para `push`,
 * `replace` y `<Redirect>`) y unos repositorios. Aquí van las dos, para que cada
 * test de ruta hable de lo que la pantalla decide y no de cómo montarla.
 *
 * Vive fuera de `src/` a propósito: no es código de producto ni entra en la
 * medición de cobertura.
 */

import { render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import type { Repositories } from '@/data';

/** Espías del router, compartidos por el mock de `expo-router` de cada test. */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  /** Destinos de cada `<Redirect href>` montado, en orden. */
  redirects: [] as string[],
};

export function resetRouter() {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  router.redirects.length = 0;
}

/**
 * El mock de `expo-router` que usan los tests de ruta.
 *
 * `Link` y `Stack.Screen` no pintan nada propio: montar el router de verdad
 * arrastraría contexto de navegación que ninguna de estas pantallas usa.
 * `Redirect` sí deja rastro en `router.redirects`, porque a dónde manda es
 * justo lo que hay que comprobar en `index.tsx`.
 */
export function expoRouterMock() {
  const Stack = Object.assign(({ children }: { children?: React.ReactNode }) => children ?? null, {
    Screen: () => null,
  });

  return {
    useRouter: () => router,
    router,
    Stack,
    Link: ({ children }: { children: React.ReactNode }) => children,
    Redirect: ({ href }: { href: string }) => {
      router.redirects.push(href);
      return null;
    },
    useLocalSearchParams: () => searchParams,
  };
}

/** Params de la ruta dinámica que devolverá `useLocalSearchParams`. */
let searchParams: Record<string, string | string[] | undefined> = {};

export function setSearchParams(params: Record<string, string | string[] | undefined>) {
  searchParams = params;
}

/** Repositorios inyectados en el último `renderRoute`. */
export let repositories: Repositories;

/**
 * Deja el mock de datos en su estado inicial. Llámalo en un `beforeEach`.
 *
 * `restoreAllMocks` no es decorativo: `createMockRepositories()` devuelve
 * siempre los mismos objetos de módulo, así que un `jest.spyOn` sobre un
 * repositorio sobrevive al siguiente test si no se deshace aquí.
 */
export function resetRepositories(): Repositories {
  jest.restoreAllMocks();
  resetState();
  repositories = createMockRepositories();
  return repositories;
}

/**
 * Métricas de un iPhone con notch. Sin ellas `useSafeAreaInsets` lanza
 * ("No safe area value available"), porque bajo Jest no hay medición real.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Monta una ruta con el provider de datos y el de área segura puestos. */
export function renderRoute(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DataProvider value={repositories}>{ui}</DataProvider>
    </SafeAreaProvider>
  );
}
