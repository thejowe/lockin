# TODO — calidad

> **Estado: segunda pasada completa (2026-09-06).** La primera dejó el repo con
> lint, formato, tipos, CI y 102 tests. Esta cierra los dos huecos de cobertura
> que quedaban — el bloque `chat` y el gesto del deck —, pone suelo de cobertura
> y retira el último andamio del scaffold. 154 tests en 9 suites. Lo que queda
> abierto está al final, en "Pendiente".

## Base
- [x] ESLint + Prettier configurados y sin errores (`npm run lint`)
- [x] `tsc --noEmit` limpio

## Tests
- [x] Jest + React Native Testing Library instalados y configurados
- [x] Test de la lógica de matching mock
- [x] Test de al menos una pantalla crítica (formulario de perfil o deck de swipe)

## CI
- [x] Workflow de GitHub Actions: lint + test + `expo export` en cada push/PR

## Accesibilidad
- [x] Labels en todos los inputs de formularios
- [x] Contraste de color verificado con los tokens del tema
- [x] Tamaño táctil mínimo (44×44) en botones interactivos

---

## Qué quedó montado

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint (config de Expo, sin las reglas que chocan con Prettier) |
| `npm run format` / `format:check` | Prettier sobre el código; `:check` es el que corre en CI |
| `npm run typecheck` | `tsc --noEmit`, tests incluidos |
| `npm test` / `test:watch` / `test:coverage` | Jest; `test:coverage` es el que corre en CI, porque es el que aplica el suelo de cobertura |

### Configuración
- `.prettierrc` — `printWidth: 100`, comillas simples, `bracketSameLine: true`.
  Lo último es para respetar el estilo que ya tenían los cuatro bloques: sin eso,
  el formateo movía el `>` de cierre de 34 archivos ajenos sin cambiar nada.
- `.prettierignore` — deja fuera la prosa (`*.md`, `docs/`, `.claude/`) y
  `package-lock.json`. Reformatear tablas y listas de Markdown ensucia el diff
  sin mejorar nada, y el lock lo escribe npm.
- `eslint.config.js` — añade `eslint-config-prettier` (apaga las reglas de estilo:
  el formato lo decide Prettier, no el linter) y los globals de Jest en los tests.
- `jest.config.js` — preset `jest-expo`, alias `@/`, stub de CSS (`test/style-stub.js`,
  porque `theme.ts` importa `global.css` para web) y la lista de paquetes ESM a
  transpilar. Además:
  - `resolver: 'react-native-worklets/jest/resolver.js'`. Sin él, cualquier test
    que importe un módulo con Reanimated muere en `Cannot read properties of
    undefined (reading 'loadUnpackers')`: Worklets resuelve su `.native.ts`, que
    busca el TurboModule real. El resolver oficial de Worklets descarta esa
    extensión. Los tests anteriores no lo notaban porque ninguno llegaba a
    importar Reanimated de verdad.
  - `standard-navigation` en `transformIgnorePatterns`: lo trae `expo-router` en
    ESM sin transpilar, y entra en cuanto un test toca una pantalla que importa
    `ExternalLink`.
  - `coverageThreshold` global: 50 % de sentencias, líneas y funciones, 42 % de
    ramas.
- `jest.setup.js` — mocks de `react-native-reanimated`, `react-native-gesture-handler`
  y `expo-font`, más los matchers de accesibilidad de RNTL (`toBeSelected`,
  `toHaveAccessibleName`…).
- `tsconfig.json` — `types: ["jest", "node"]`. Sin eso, `tsc` no ve `describe`/`expect`
  y el typecheck de los tests falla.

### Tests — 154, en 9 archivos

| Archivo | Qué cubre |
|---|---|
| `src/data/mock/store.test.ts` | `initialsFrom`, `matchesMode`, `resolveMatchMode` — las funciones puras que deciden a quién ves y bajo qué modo nace un match |
| `src/data/mock/index.test.ts` | El repositorio entero: filtrado del deck por modo/especialidad/decidido, reciprocidad, orden de matches por actividad, aislamiento de hilos, suscripciones, alta y edición de perfil |
| `src/features/discover/use-deck.test.tsx` | El estado del deck: descarte optimista, match, devolución de la tarjeta si el guardado falla, cambio de modo, `refresh` |
| `src/features/profile/profile-form.test.tsx` | Validación, normalización del `ProfileInput`, precarga al editar, error de guardado, y que todo control pulsable tenga nombre accesible |
| `src/constants/theme.test.ts` | Ratio WCAG de cada par de tokens que la app usa de verdad, en claro y oscuro |
| `src/features/chat/format.test.ts` | Las fechas del chat: cada rama de `formatRelative` con sus bordes (el minuto exacto, la hora exacta, "ayer a las 23:55" que son 15 minutos), `formatDayHeading` y `isSameDayIso` |
| `src/features/chat/use-matches.test.tsx` | La lista de matches: carga, resolución del perfil del otro lado, un match nuevo entrando sin remontar, el reordenado al llegar un mensaje, error de lectura y baja de la suscripción al desmontar |
| `src/features/chat/use-conversation.test.tsx` | La conversación: las tres lecturas, el envío recortado, el vacío que no llega al repositorio, el fallo expuesto en `sendError` y limpiado al reintentar, y la baja de la suscripción |
| `src/features/discover/swipe-deck.test.tsx` | El gesto: umbral de desplazamiento, flick corto pero rápido, arrastre insuficiente que no decide, los botones como camino equivalente, y que el deck nunca pinte más de tres tarjetas |

`src/data/test-fixtures.ts` es la fábrica de `Profile`/`ProfileInput` para los
tests: si `Profile` gana un campo obligatorio, se añade ahí una vez y no en cada
test. No lo importes desde código de producción.

**Cómo se dispara el gesto del deck.** `swipe-deck.tsx` marca su `Gesture.Pan`
con `.withTestId(PAN_TEST_ID)`; el test lo recupera con `getByGestureTestId` y le
inyecta eventos con `fireGestureHandler`, ambos de
`react-native-gesture-handler/jest-utils`. Es la vía oficial para la API nueva de
gestos — el `jestSetup` que carga `jest.setup.js` solo evita que el módulo nativo
reviente, no permite emitir eventos. Dos detalles que cuestan una tarde:

- La secuencia necesita un evento **sin `state`** entre el `ACTIVE` y el `END`.
  El que estrena `ACTIVE` abre el gesto; los que vienen después son los que
  llegan a `onUpdate`, que es donde el componente guarda el desplazamiento que
  juzga al soltar. Sin ese evento intermedio, el gesto se cierra con la tarjeta
  todavía en el centro y ningún swipe decide nunca.
- Las tarjetas de detrás llevan `aria-hidden`, así que hay que buscarlas con
  `{ includeHiddenElements: true }` o RNTL no las ve.

**Ojo con los mocks de repositorio.** `createMockRepositories()` devuelve siempre
los mismos objetos de módulo, así que un `jest.spyOn` sobre `repositories.messages`
sobrevive al test que lo puso. Los tests de `chat` llaman a `jest.restoreAllMocks()`
en `afterEach`; si añades otro que espíe un repositorio, haz lo mismo.

**Ojo con RNTL 14:** `render`, `fireEvent`, `renderHook` y `rerender` son
**asíncronos**. Sin `await`, el árbol no llega a montarse y las queries fallan con
`` `render` function has not been called ``.

### CI — `.github/workflows/ci.yml`
Cinco trabajos en paralelo sobre `npm ci` y Node 22: lint, formato, tipos, tests
y `expo export --platform web`. Sin `fail-fast`: un lint roto no debe ocultar un
test roto. `concurrency` cancela la ejecución anterior de la misma rama.

### Accesibilidad
- **Labels.** Los nueve `TextInput` del formulario de perfil y el del chat ya
  traían `accessibilityLabel`. Añadido un test que lo guarda: recorre los
  controles con rol `button`/`radio`/`checkbox` del formulario y exige que todos
  tengan nombre accesible.
- **Contraste.** `src/constants/theme.test.ts` mide los 21 pares de tokens que la
  app usa. 17 cumplen AA en claro y oscuro. Los 4 que no (`textMuted` sobre las
  dos superficies y `border` sobre las dos) están reportados en
  `docs/plan/todo/arquitecto.md` con los números medidos, porque el arreglo es una
  decisión de paleta y no de una pantalla. El test fija el ratio actual como
  suelo: no exige el arreglo, pero impide que empeore en silencio.
- **Tamaño táctil.** Cuatro controles se quedaban por debajo de 44 px de alto.
  Arreglados con `hitSlop`, que agranda el área de toque sin tocar el diseño:
  `features/profile/controls.tsx` (chip, 36 px), `features/discover/mode-filter.tsx`
  (chip de filtro, 32 px), `features/chat/icebreaker-suggestions.tsx` (sugerencia,
  36 px) y `components/app-tabs.web.tsx` (pastilla de tab, 28 px). El resto ya
  cumplía.

### Cobertura
`coverageThreshold` global en `jest.config.js`, y CI pasa a `npm run test:coverage`
para que se aplique. Los números son un **suelo unos puntos por debajo de la
cobertura real de hoy** (55,6 % de sentencias, 47,6 % de ramas), no un objetivo:
sirven para que un PR no pueda borrar tests ni meter un bloque grande sin tocarlos.
Se suben cuando la cobertura suba; no se bajan para dejar pasar un cambio.

Dónde está hoy: la capa de datos y `data/mock` al 100 %, los tres módulos de
lógica de `chat` al 100 %, `swipe-deck.tsx` al 94 %, `profile-form.tsx` al 92 %.
Lo que arrastra la media hacia abajo son las rutas de `app/` (0 %) y los
componentes presentacionales de `chat` y `discover`, que casi no tienen lógica
que guardar.

## Cambios en archivos de otros bloques
- **Formato.** Prettier tocó 13 archivos de `arquitecto`, `perfil`, `descubrir` y
  `chat`. Son cambios de formato puros — ninguna línea cambia de significado.
- **`hitSlop`.** Los cuatro controles de arriba. Una prop añadida cada uno, sin
  tocar estilos ni lógica.
- **`src/features/discover/swipe-deck.tsx`.** Añadido `.withTestId(PAN_TEST_ID)`
  al `Gesture.Pan` y exportada esa constante. Es la única forma de alcanzar el
  gesto desde un test; no cambia el comportamiento, igual que un `testID` en una
  vista.
- **`src/components/ui/collapsible.tsx`.** Borrado. Era andamio del scaffold de
  Expo y no lo importaba nadie. Con él se va el único uso de `expo-symbols`: la
  dependencia sigue en `package.json`, y quitarla es decisión de `arquitecto` —
  anotado en su TODO.
- **`src/constants/theme.ts`.** `brassSoft` claro pasa de `#F0E3C9` a `#F2E5CB`:
  el chip de marca seleccionado estaba en 4.44:1, a un pelo de AA. Es el mismo
  color a ojo y no toca ninguno de los cinco literales de marca de `CONCEPTO.md`.
  Anotado también en el TODO de `arquitecto`.

## Verificación hecha (2026-09-06)
- `npm run lint` — 0 errores, 0 avisos.
- `npm run typecheck` — limpio.
- `npm run format:check` — todo formateado.
- `npm run test:coverage` — 154 tests en 9 suites, todos en verde, umbral cumplido.
- `npx expo export --platform web` — 10 rutas generadas sin errores.

## Pendiente
- [x] Tests del bloque `chat` (`use-conversation`, `use-matches`, `format.ts` con
      sus fechas relativas). Era el hueco de cobertura más grande que quedaba.
- [x] Test de la pantalla de swipe (`swipe-deck.tsx`), gesto incluido.
- [x] Umbral de cobertura en `jest.config.js`, con CI corriendo `test:coverage`.
- [x] Retirado `src/components/ui/collapsible.tsx`, andamio del scaffold.
- [ ] Tests de la parte presentacional de `chat` (`match-row`, `message-bubble`,
      `message-composer`, `icebreakers.ts`). `icebreakers.ts` es el que más lo
      pide: son reglas puras que comparan dos perfiles y hoy está a 0 %.
- [ ] Cuando `datos` conecte Supabase: los tests de `src/data/mock/index.test.ts`
      son la especificación de lo que el repositorio real tiene que cumplir.
      Reutilizarlos contra la implementación de Supabase, no escribir otros.
