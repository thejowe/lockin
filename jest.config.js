/**
 * Configuración de Jest para LockIn.
 *
 * `jest-expo` trae el preset de React Native con los mocks nativos de Expo ya
 * puestos. Lo único que añadimos aquí es el alias `@/` (que en la app resuelve
 * Metro vía `tsconfig.json`), un stub para el CSS que solo existe en web y la
 * lista de paquetes ESM que sí hay que transpilar.
 */

module.exports = {
  preset: 'jest-expo',
  // Worklets resuelve `.native.ts` primero y ese fichero busca el TurboModule
  // real; bajo Jest no existe. Su resolver oficial descarta esa extensión y deja
  // que Reanimated cargue su implementación JS.
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/test/style-stub.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg|@testing-library/react-native|standard-navigation)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
    '!src/data/test-fixtures.ts',
  ],
  // Suelo, no objetivo: unos puntos por debajo de la cobertura real de hoy. Sirve
  // para que un PR no pueda borrar tests ni añadir un bloque grande sin tocarlos;
  // se sube cuando la cobertura suba, nunca se baja para dejar pasar un cambio.
  // Subido tras los tests de `src/data/supabase/` (contrato parametrizado y
  // `mappers`), que llevaron la cobertura real de 55 % a 69 %.
  coverageThreshold: {
    global: { statements: 65, branches: 53, functions: 64, lines: 65 },
  },
};
