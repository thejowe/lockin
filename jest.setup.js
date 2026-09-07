/* eslint-env jest */

/**
 * Arranque común de los tests.
 *
 * Reanimated y gesture-handler tocan el hilo de UI nativo: bajo Jest no existe,
 * así que se sustituyen por sus mocks oficiales. Sin esto, cualquier test que
 * importe el deck de swipe revienta al montar.
 */

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
