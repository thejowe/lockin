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

// El `useAnimatedRef` real devuelve una ref que también se llama como función
// (`ref(node)`); el mock oficial da solo `{ current }`. Se iguala, estable entre renders.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  const { useState } = require('react');
  return {
    ...mock,
    useAnimatedRef: () =>
      useState(() => {
        const ref = (node) => {
          ref.current = node;
        };
        ref.current = null;
        return ref;
      })[0],
  };
});

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

// Los tests corren en español, sea cual sea el idioma de la máquina.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-ES' }],
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

// `@react-native-google-signin/google-signin` exige su TurboModule al importarse
// (lo importa `src/data/supabase/auth.ts`). El mock oficial no es importable
// (los `exports` del paquete no lo publican), así que va uno mínimo con lo que
// usa la app; los tests que lo ejercitan lo sobrescriben.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signOut: jest.fn(async () => null),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
  },
  isCancelledResponse: (response) => response.type === 'cancelled',
  isErrorWithCode: (error) => typeof error?.code === 'string',
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

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

// `expo-notifications` es nativo. Por defecto el permiso está denegado, así
// que ninguna pantalla registra tokens sin que su test lo pida;
// `src/lib/push.test.ts` cambia estas respuestas caso a caso.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ type: 'expo', data: 'ExponentPushToken[test]' })
  ),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
