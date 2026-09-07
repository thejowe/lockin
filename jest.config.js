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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/test/native-hosts.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/test/style-stub.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Los tests de rutas viven en `test/app/` y no en `src/app/`: expo-router mete
  // en el bundle todos los `.tsx` de su raíz, así que un test colocado ahí
  // arrastraría `@testing-library/react-native` a la app y rompería Metro.
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg|@testing-library/react-native|standard-navigation)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
    '!src/data/test-fixtures.ts',
  ],
  // Suelo fijado a la cobertura real de la suite local (2026-09-07).
  // Se sube cuando la cobertura suba; no se bajan los umbrales ni se excluyen
  // archivos para dejar pasar un cambio. El contrato remoto sigue siendo opt-in.
  coverageThreshold: {
    global: { statements: 89.82, branches: 82.56, functions: 91.49, lines: 91.38 },
  },
};
