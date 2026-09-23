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
  // Suelo fijado a la cobertura real de la suite (2026-09-23, sobre `949a071`,
  // medida con `npx jest --coverage --ci --runInBand`: 948 pasados, 84
  // saltados, 80 de 81 suites). Medida sobre un export limpio de ese commit
  // (`git archive HEAD`), no sobre el árbol de trabajo: cuando el suelo sube,
  // lo que lo justifica tiene que estar ya commiteado. Anterior:
  // 94.36/89.09/93.94/95.96, del 2026-09-19 sobre `72bf34f`.
  // Se sube cuando la cobertura suba; no se bajan los umbrales ni se excluyen
  // archivos para dejar pasar un cambio.
  //
  // Los cuatro se truncan hacia abajo y no se redondean: los crudos son
  // 94.641085 (2861/3023) / 89.520426 (1512/1689) / 94.279176 (824/874) /
  // 96.190117 (2550/2651), y Jest compara contra el valor sin redondear.
  // Poner 96.20 en `lines` dejaría el suelo POR ENCIMA de la cobertura real y
  // el job `Tests` saldría rojo el mismo día de subirlo.
  //
  // Los saltados son `src/data/supabase/contract.test.ts`, que sigue siendo
  // opt-in (`LOCKIN_SUPABASE_CONTRACT=1`) porque escribe en la base a la que
  // apunte. Desde el 2026-09-17 ya no es cierto que no se ejecute nunca: el job
  // `Contrato Supabase` de `ci.yml` lo corre en cada push a la rama principal
  // contra un Supabase local desechable. Su cobertura no cuenta aquí a
  // propósito — se mide en otra pasada y sobre otra base de datos —, así que
  // estos números son los de la suite por defecto y solo suben con ella.
  //
  // ── Un caso del contrato que solo corre en Supabase BAJA este suelo ──
  //
  // Criterio decidido el 2026-09-19, tras el rojo de `Tests` sobre `1c16e5b`.
  // No dejarlo escrito costó una pasada, así que aquí va entero.
  //
  // `src/data/repositories.contract.ts` no es un `.test.ts`: es el contrato
  // compartido que invocan DOS suites, la del mock (`src/data/mock/index.test.ts`,
  // que corre siempre) y la de Supabase (opt-in). Como no case con
  // `collectCoverageFrom`, cuenta como código medido — y así se queda:
  // excluirlo bajaría tres de los cuatro umbrales (medido el 2026-09-19:
  // 92.77/88.07/92.77/94.77 sin él, frente a 93.40/87.91/93.22/95.27 con él),
  // o sea que excluirlo ES bajar el suelo, que es lo único que nunca se hace.
  //
  // La consecuencia: un caso detrás de una capacidad del backend
  // (`itWithTimeTravel`, `itWithNetworkDrop`) es `it.skip` sobre el mock, así
  // que su cuerpo es código muerto para la suite por defecto y hunde el suelo
  // por su propio tamaño. Le pasó a D5 (`9815d8b`): el caso del hallazgo 8 son
  // 27 líneas que solo corren con `dropRealtime`, que el mock no implementa.
  //
  // Que el job `Contrato Supabase` aporte su cobertura queda DESCARTADO, y no
  // por trabajo: ataría el suelo a un trabajo que necesita Docker y un Supabase
  // local, que está detrás de una lista blanca de rutas (que ya se quedó corta
  // una vez, ver `docs/plan/todo/calidad.md`, 2026-09-15) y que no se puede
  // reproducir en una máquina cualquiera. Un suelo que no se puede medir en
  // local deja de ser un suelo y pasa a ser una lotería de CI.
  //
  // Así que el hueco se acepta, y quien añada un caso así lo compensa, eligiendo:
  //   (a) que el mock implemente la capacidad y el caso corra por defecto, o
  //   (b) cubrir con un test por defecto el código de producto que ese caso
  //       ejercita — es lo que hizo `realtime.test.ts` con
  //       `subscribeResyncingOnRejoin`, que quedó al 100 %.
  // Lo que no es una salida es bajar estos cuatro números ni excluir el archivo.
  coverageThreshold: {
    global: { statements: 94.64, branches: 89.52, functions: 94.27, lines: 96.19 },
  },
};
