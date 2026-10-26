/* eslint-env jest */

/**
 * Arranque común de los tests.
 *
 * Reanimated y gesture-handler tocan el hilo de UI nativo: bajo Jest no existe,
 * así que se sustituyen por sus mocks oficiales. Sin esto, cualquier test que
 * importe el deck de swipe revienta al montar.
 */

// Desde SDK 58, gesture-handler 3 llama a `getUIRuntimeHolder` y `runOnUISync`
// de Worklets al cargarse. Bajo Jest Worklets resuelve su versión web, que
// lanza "not supported on web": su mock oficial los resuelve en el propio hilo.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// `react-native-keyboard-controller` es un módulo nativo: sin el mock oficial,
// importar `src/app/_layout.tsx` revienta con "doesn't seem to be linked".
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);

// `expo-font` intenta cargar las fuentes de marca; en tests damos por hecho que
// ya están listas para que las pantallas rendericen su árbol real.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: jest.fn(() => Promise.resolve()),
}));

// Matchers de accesibilidad de RNTL: `toBeSelected`, `toBeDisabled`,
// `toBeOnTheScreen`… Son la forma legible de aseverar estado de a11y.
require('@testing-library/react-native/dist/matchers/extend-expect');

// `@supabase/supabase-js` guarda la sesión en AsyncStorage, que es un módulo
// nativo: al importarlo bajo Jest revienta con "NativeModule: AsyncStorage is
// null". Este es el mock oficial del paquete. Hace falta desde que
// `src/data/active.ts` importa el backend de Supabase para poder elegirlo.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// `react-native-safe-area-context` lee insets del nativo: bajo Jest no hay
// ninguno y `useSafeAreaInsets` lanza "No safe area value available". Este es el
// mock oficial del paquete; devuelve insets a cero, que es justo lo que Jest no
// puede medir de todos modos.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
);

// `expo-secure-store` es nativo y sus stubs por defecto no retienen nada: con
// ellos, la sesión de Supabase escrita por `secure-storage.ts` no se podría
// releer (el contrato contra Supabase real la necesita). Este mock es un
// almacén en memoria que se vacía solo al reiniciar el proceso de Jest.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});
