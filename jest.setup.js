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
