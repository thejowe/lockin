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
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/test/style-stub.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg|@testing-library/react-native)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
    '!src/data/test-fixtures.ts',
  ],
};
