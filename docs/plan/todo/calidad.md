# TODO — calidad

> **Estado actual: cuarta pasada completa (2026-09-06).** Deuda menor cerrada; detalle y verificación al final. Los apartados anteriores son el historial de las primeras pasadas.

> **Tercera pasada (histórico).** La primera dejó el repo con
> lint, formato, tipos, CI y 102 tests. La segunda cubrió el bloque `chat` y el
> gesto del deck y puso suelo de cobertura (154 tests). Esta cierra el último
> hueco del bloque `chat`: `icebreakers.ts` — las reglas que eligen el primer
> mensaje, que estaban a 0 % — y sus tres componentes presentacionales. 207 tests
> en 13 suites. Lo que queda abierto está al final, en "Pendiente".

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
  - `coverageThreshold` global: 55 % de sentencias, líneas y funciones, 47 % de
    ramas.
- `jest.setup.js` — mocks de `react-native-reanimated`, `react-native-gesture-handler`
  y `expo-font`, más los matchers de accesibilidad de RNTL (`toBeSelected`,
  `toHaveAccessibleName`…).
- `tsconfig.json` — `types: ["jest", "node"]`. Sin eso, `tsc` no ve `describe`/`expect`
  y el typecheck de los tests falla.

### Tests — 207, en 13 archivos

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
| `src/features/chat/icebreakers.test.ts` | Las nueve reglas que proponen el primer mensaje: cada una con su caso que dispara y su caso que calla, el orden en que compiten por las tres plazas, y el recorte |
| `src/features/chat/match-row.test.tsx` | La fila de la lista: el prefijo "Tú:", la pista cuando no hay mensajes, la marca de nuevo, qué fecha manda, y el nombre accesible del destino |
| `src/features/chat/message-bubble.test.tsx` | La burbuja: cuerpo, hora, y de qué lado cae según `isMine` — que es lo único suyo que se puede romper sin que se note |
| `src/features/chat/message-composer.test.tsx` | `canSend`: vacío, solo espacios y envío en vuelo bloquean el botón; con texto envía una vez. Más el `ref` que la pantalla usa para devolver el foco |

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

**Cómo se prueban los componentes presentacionales de `chat`.** No tienen estado
propio, así que el test ataca lo único que sí pueden romper en silencio:

- `match-row.test.tsx` **mockea `expo-router`** con un `Link` que solo devuelve a
  su hijo. Montar el router entero aquí no aporta nada y arrastra contexto de
  navegación que la fila no usa. Lo que sí se comprueba es el nombre accesible,
  que es lo que anuncia a dónde lleva.
- `message-bubble.test.tsx` lee la alineación de la fila exterior con
  `StyleSheet.flatten(screen.toJSON().props.style)`. Es la única forma de aseverar
  de qué lado cae la burbuja: si `isMine` deja de decidirla, la conversación queda
  ilegible aunque todos los textos estén bien y ningún test de texto se entere.
- Las fechas relativas se construyen con `Date.now()` menos N minutos en vez de
  fijarlas: `formatRelative` mide contra el ahora real, y clavar una fecha
  obligaría a congelar el reloj para nada.

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
cobertura real de hoy** (61,2 % de sentencias, 53,0 % de ramas), no un objetivo:
sirven para que un PR no pueda borrar tests ni meter un bloque grande sin tocarlos.
Se suben cuando la cobertura suba; no se bajan para dejar pasar un cambio. En esta
pasada subieron de 50/42/50/50 a 55/47/55/55.

Dónde está hoy: la capa de datos y `data/mock` al 100 %, `features/chat` al 86 %
(con `icebreakers.ts`, `message-bubble.tsx`, `match-row.tsx`, `use-matches.ts` y
`use-conversation.ts` al 100 %), `swipe-deck.tsx` al 94 %, `profile-form.tsx` al
92 %. Lo que arrastra la media hacia abajo son las rutas de `app/` (0 %),
`src/data/supabase/` (6 %, porque sus tests no se pueden ejecutar todavía — ver
"Pendiente") y los componentes presentacionales que quedan en `chat` y `discover`
(`conversation-intro`, `lock-in-cta`, `matches-empty`, `deck-empty`,
`match-modal`, `mode-filter`), que casi no tienen lógica que guardar.

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

La tercera pasada **no tocó ningún archivo de otro bloque**: los cuatro tests
nuevos leen los componentes por su API pública y por sus etiquetas accesibles, sin
necesitar un `testID` ni un export extra.

## Verificación hecha (2026-09-06, tercera pasada)
- `npm run lint` — 0 errores, 0 avisos.
- `npm run typecheck` — limpio.
- `npm run format:check` — todo formateado.
- `npm run test:coverage` — 207 tests en 13 suites, todos en verde, umbral nuevo
  (55/47/55/55) cumplido.
- `npx expo export --platform web` — 14 rutas generadas sin errores.

## Pendiente
- [x] Tests del bloque `chat` (`use-conversation`, `use-matches`, `format.ts` con
      sus fechas relativas). Era el hueco de cobertura más grande que quedaba.
- [x] Test de la pantalla de swipe (`swipe-deck.tsx`), gesto incluido.
- [x] Umbral de cobertura en `jest.config.js`, con CI corriendo `test:coverage`.
- [x] Retirado `src/components/ui/collapsible.tsx`, andamio del scaffold.
- [x] Tests de la parte presentacional de `chat` (`match-row`, `message-bubble`,
      `message-composer`, `icebreakers.ts`). `icebreakers.ts` estaba a 0 % y era el
      que más lo pedía: los cuatro quedan al 100 % de sentencias.
- [x] **Delegado a `datos`, y ya hecho por otra vía.** La casilla estaba abierta
      esperando a poder reutilizar `src/data/mock/index.test.ts` contra Supabase,
      bloqueada por la configuración de Auth del proyecto (con *Anonymous
      sign-ins* cerrado, `auth.ts` no abría sesión y ninguna consulta llegaba a
      correr). Desde el commit b1472a6 ese interruptor está activo y el contrato
      se ejecuta de verdad: `src/data/supabase/contract.test.ts` pasa **25/25**
      contra el proyecto real, opt-in y fuera de `npm test` y de CI. No se
      reutilizó el test del mock tal cual —tres de sus casos describen mecánica
      interna del mock (`CURRENT_USER_ID`, `resetState`, `setProfileId`) y no son
      trasladables—, pero el contrato que importaba está cubierto. El trabajo
      queda en `datos`; `calidad` vuelve al suelo de cobertura, que ya no lo
      arrastra `src/data/supabase/`.

## Siguiente hueco de cobertura
Lo que queda sin tocar y sí tiene algo que guardar, por orden:
1. ~~`src/data/supabase/mappers.ts` (0 %)~~ — **ya no aplica**: existe
   `src/data/supabase/mappers.test.ts` y el archivo está al 90 % de sentencias.
   Lo escribió `datos`, que es dueño de esa carpeta.
2. [x] Los componentes presentacionales que quedan de `discover` (`mode-filter`,
   `match-modal`, `deck-empty`) y de `chat` (`icebreaker-suggestions`,
   `conversation-intro`, `lock-in-cta`).
3. [x] Las rutas de `app/` (0 %). Es lo más caro y lo que menos lógica tiene.

## Cuarta pasada: deuda menor (2026-09-06)

Trabajo aislado en el worktree ../lockin-codex-calidad, rama codex/calidad,
partiendo de c546476 de claude/startup-cofounder-matching-app-tfeai1.
Los apartados anteriores conservan el historial de las primeras pasadas.

- [x] Quitar expo-symbols como dependencia directa y actualizar el lockfile.
- [x] Revisar @expo/ui, expo-glass-effect, expo-device, expo-linking y expo-constants.
- [x] Ignorar supabase/.temp/ generado por el CLI.
- [x] Medir la cobertura real y subir coverageThreshold sin cambiar las exclusiones.
- [x] Verificar instalación, lint, formato, tipos, tests con cobertura y export web.

Se conservan expo-linking y expo-constants: son peers obligatorios de
expo-router 57.0.19. @expo/ui, expo-glass-effect y expo-symbols son dependencias
propias de ese router; quitar sus declaraciones directas no elimina sus
entradas transitivas del lockfile. expo-device no tiene consumidores en la app
ni en el árbol de dependencias del lockfile.

### Resultado y verificación de la cuarta pasada

- Retiradas de package.json las dependencias directas expo-symbols, @expo/ui,
  expo-glass-effect y expo-device. npm actualizó el lockfile sin actualizar
  versiones ajenas; desaparecen expo-device y su dependencia ua-parser-js.
- expo-linking y expo-constants se conservan como peers obligatorios. Los otros
  tres módulos siguen instalados de forma transitiva por expo-router, verificado
  con npm ls y con las dependencies/peerDependencies del paquete 57.0.19.
- /supabase/.temp/ queda ignorado; no se borra su contenido.
- coverageThreshold pasa de 65/53/64/65 a **69.29/57.57/68.09/69.47**
  (sentencias/ramas/funciones/líneas), exactamente los porcentajes medidos por
  Jest. No se cambian collectCoverageFrom, las exclusiones ni los tests.
- Ajuste de configuración necesario en checkout limpio: tsconfig.json declara
  expo/types junto a jest y node. Sin ello tsc daba TS2882 al importar el CSS,
  porque expo-env.d.ts está ignorado y solo existía en la carpeta original.
  Los tipos oficiales de Expo ya declaran CSS; no se añade un stub propio.

Comprobaciones sobre una instalación nueva en el worktree, sin compartir
node_modules ni copiar variables de Supabase:

- npm uninstall desde node_modules inexistente instaló el árbol actualizado.
- npm run lint: limpio.
- npm run typecheck: limpio con expo/types, sin necesitar expo-env.d.ts.
- npm run test:coverage -- --ci --runInBand: **222 tests en 14 suites pasan**;
  25 tests de contrato remoto omitidos por su opt-in. Cobertura: 650/938
  sentencias, 327/568 ramas, 222/326 funciones y 569/819 líneas. Los nuevos
  mínimos pasan. La primera ejecución, concurrente con export/lint/tipos y con
  caché fría, agotó 5 s en un test de ProfileForm; la repetición completa aislada
  pasó sin cambiar timeouts ni tests (48.8 s).
- npx expo export --platform web: correcto, **14 rutas estáticas** generadas.
- npm run format:check -- --end-of-line auto: limpio. El comando sin override
  señala CRLF en 95 archivos debido al core.autocrlf=true local, mientras el
  repositorio exige LF. Se formatearon solo package.json, jest.config.js y
  tsconfig.json; no se reescribieron archivos de producto para resolver una
  conversión local de Git.
- git diff --check: limpio.

No se modifica src/data/supabase/ ni supabase/seed.sql, ni se ejecuta la suite
contra el proyecto Supabase real. Su verificación continúa en el bloque datos.
Se consultó la documentación exacta del SDK antes de editar:
https://docs.expo.dev/versions/v57.0.0/.

## Quinta pasada: presentacionales que faltaban y rutas de `app/` (2026-09-06)

Cierra los puntos 2 y 3 de "Siguiente hueco de cobertura". Solo se escriben
tests: no se ha tocado el código de producto de `discover` ni de `chat`.

- [x] Presentacionales de `discover`: `mode-filter`, `deck-empty`, `match-modal`.
- [x] Presentacionales de `chat`: `icebreaker-suggestions`, `conversation-intro`,
      `lock-in-cta`.
- [x] Las siete rutas de `app/`: `index`, `(onboarding)/mode`,
      `(onboarding)/profile-form`, `(tabs)/discover`, `(tabs)/matches`,
      `(tabs)/profile` y `chat/[matchId]`.
- [x] Los tres `_layout.tsx` (raíz, `(onboarding)` y `(tabs)`).
- [x] Subido `coverageThreshold` a la cobertura medida.

### Dónde viven los tests de ruta, y por qué no en `src/app/`

`src/app/` es la raíz de `expo-router`: **todo** `.tsx` que cuelga de ahí entra
en el bundle como ruta, así que un `discover.test.tsx` colocado al lado de
`discover.tsx` arrastraría `@testing-library/react-native` a la app. Los tests de
ruta viven por eso en `test/app/`, con `testMatch` de `jest.config.js` ampliado a
`test/**`. Comprobado: `npx expo export --platform web` sigue generando las
mismas **14 rutas** que antes de esta pasada.

`test/routes.tsx` es el andamiaje común: el mock de `expo-router` (con espías de
`push`/`replace` y el destino de cada `<Redirect>`), los repositorios mock, y un
`renderRoute` que envuelve en `DataProvider` y `SafeAreaProvider` — sin el
segundo, `useSafeAreaInsets` del chat lanza "No safe area value available".
`resetRepositories()` llama a `jest.restoreAllMocks()` a propósito:
`createMockRepositories()` devuelve siempre los mismos objetos de módulo, así que
un `jest.spyOn` sobre un repositorio sobrevive al test siguiente si no se deshace.

El test del chat se llama `matchId.test.tsx`, sin corchetes: `[matchId]` es
sintaxis de ruta de `expo-router`, no de Jest, y un patrón `-t` sobre ella no
encuentra nada.

### Qué se prueba, y qué no

Los presentacionales se leen por su API pública y por sus etiquetas accesibles
(rol `radio` y `accessibilityState.selected` en el filtro, la pista "Escribe esta
frase…" en los icebreakers, el `expanded` del CTA de Lock-In). En las rutas se
prueban las decisiones que **no** viven en sus hooks: a dónde redirige `index`,
que `mode` guarde antes de navegar, que `profile` cierre la edición **y** relea
al guardar, que `discover` conserve el deck cuando falla guardar una decisión, y
que el chat deje de ofrecer icebreakers en cuanto hay un mensaje.

Dos dobles a propósito: `SwipeDeck` en el test de `discover` (su gesto ya está
probado en `swipe-deck.test.tsx` y montarlo arrastraría Reanimated) y
`ProfileForm` en los de `profile` y `profile-form` (ya tiene sus tests en
`perfil`; aquí solo importa cuándo se monta y qué se hace con lo que envía).

**Sin cubrir, y por qué:** el tirar-para-refrescar de `(tabs)/matches`. El
`RefreshControl` no es alcanzable desde RNTL sin ponerle un `testID` a la
`FlatList`, y esta pasada no toca código de producto. Su `refresh` ya está al
100 % en `use-matches.test.tsx`. Es la línea 30 que aparece descubierta en
`matches.tsx`.

### Cobertura

`coverageThreshold` pasa de **69.29/57.57/68.09/69.47** a
**87.52/78.87/87.73/88.76** (sentencias/ramas/funciones/líneas), que son los
porcentajes exactos medidos por Jest, no un número redondo. Sigue la misma regla:
se suben cuando la cobertura suba, no se bajan ni se excluyen archivos para dejar
pasar un cambio.

Todo `app/` queda al 100 % salvo `(tabs)/matches.tsx` (87,5 %, la línea del
`RefreshControl`), `(onboarding)/mode.tsx` (94,4 %) y `chat/[matchId].tsx`
(96,5 %). `features/chat` sube a 99,5 % y `features/discover` a 97,5 %.

Parte de la subida no es de esta pasada: `src/data/supabase/` va del 6 % al
24,7 % gracias a `mappers.test.ts`, que es trabajo de `datos`.

### Verificación hecha (2026-09-06, quinta pasada)

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check --end-of-line auto` sobre los archivos nuevos — limpio.
- `npm run test:coverage -- --ci --runInBand` — **307 tests en 28 suites** pasan
  (25 del contrato remoto omitidos por su opt-in) y el umbral nuevo se cumple.
- `npx expo export --platform web` — 14 rutas, las mismas de antes.

Aviso conocido, no es un fallo: el test de `(tabs)/matches` deja un `act(...)`
warning de `VirtualizedList`, que viene de un `setTimeout` interno de
`FlatList`. Y con caché fría el primer `render` de `test/app/layouts.test.tsx`
tarda ~6 s (0,6 s en caliente), lo bastante cerca del timeout de 5 s de Jest para
haber fallado una vez en una ejecución concurrente con `expo export`. No se tocan
timeouts —misma decisión que en la cuarta pasada con `ProfileForm`—, pero queda
anotado por si reaparece en CI.

## Siguiente hueco de cobertura (tras la quinta pasada)

Lo que queda a 0 % ya no es de este bloque, así que va como aviso:

1. `src/components/screen-placeholder.tsx` y `src/components/themed-view.tsx`
   están a 0 % y **no los importa nadie**. Es el mismo caso que
   `components/ui/collapsible.tsx`, que se retiró en la tercera pasada: andamio
   del scaffold de Expo. Borrarlos es decisión de `arquitecto` — no se tocan aquí
   con otra sesión trabajando en paralelo.
2. `src/components/app-tabs.tsx` y `app-tabs.web.tsx` (0 %). Son configuración
   declarativa de `NativeTabs`; probarlos cuesta más de lo que protege.
3. `src/data/supabase/auth.ts` (3 %) y `client.ts` (33 %). Alcance de `datos`:
   solo se ejercitan contra el proyecto real, y ese contrato es opt-in.
4. `src/hooks/use-color-scheme.ts` y `.web.ts` (0 %). Un re-export y un
   equivalente para web; alcance de `arquitecto`.

## Sexta pasada: E2E Android (2026-09-06)

Worktree `../lockin-codex-calidad`, actualizado con `git fetch` y
`git reset --hard 4cce6e0` como se pidió. Se conserva el historial anterior.

- [x] Evaluar herramienta: Maestro, sin instrumentar componentes/hooks ni repositorios.
- [x] Escribir registro anónimo → perfil → deck → match → mensaje en
      `e2e/full-journey.yaml`, con parada del proceso, relanzamiento y recuperación
      del perfil y mensaje por la UI.
- [x] Aviso contra falsos positivos del mock en el propio caso: mismo catálogo,
      backend elegido por credenciales; el reinicio y las lecturas de Postgres
      son obligatorios.
- [x] Runner local aislado con migraciones y seed reales, fixture de likes
      entrantes y verificación de las filas creadas por la UI.
- [x] Evaluar emulador en GitHub Actions y preparar workflow **activo** en
      push/PR/manual: Ubuntu 24.04 + KVM + API 36, APK release, Supabase local,
      artefactos de Maestro/logcat y parada del backend incluso al fallar.
- [x] Documentar comandos, requisitos, aislamiento, fuentes y limitaciones en
      `e2e/README.md`.
- [ ] Confirmar primer recorrido completo verde en emulador y guardar su evidencia.
- [ ] Ejecutar control negativo con APK sin credenciales y confirmar que falla
      al intentar recuperar el estado tras el reinicio.

### Alcance y viabilidad

No se toca `src/components/`, `src/hooks/`, `src/data/`, `supabase/` ni
`docs/plan/TODO.md`. La fixture E2E copia los SQL del repo a una base
desechable; solo simula los likes de la otra parte. El perfil propio, la decisión,
el match y el mensaje se generan al interactuar con la app. La comprobación
administrativa posterior es de solo lectura y nunca entra en el bundle.

GitHub Actions sí admite este emulador mediante KVM. No se desactiva el workflow
ni se necesitan secretos: Auth/Postgres/REST/Realtime corren localmente en Docker.
No se ha ejecutado Actions desde esta sesión: falta subir/integrar la rama y
revisar el primer resultado. El host de trabajo carece de Android SDK, Java,
Maestro y Docker; `node e2e/run.mjs prepare` se ha intentado y termina en
`spawnSync docker ENOENT`. No se presenta YAML válido como prueba E2E superada.

La copia de build vive dentro de `e2e/.runtime/node_modules/lockin-e2e-app`
para que la resolución habitual de TypeScript no incorpore sus fuentes al
checkout. Prettier y ESLint ignoran únicamente runtime/artefactos generados;
no se modifica la lista de archivos medida por cobertura.
### Verificación de esta pasada

- `npm run lint`: limpio.
- `npm run typecheck`: limpio.
- Sintaxis de ambos módulos Node y parseo de los dos YAML: correctos.
- Prettier sobre archivos nuevos y configuración modificada: limpio.
- `npm run test:coverage -- --ci --runInBand`: **307 tests en 28 suites**
  pasan; 25 de contrato real omitidos por su opt-in. Cobertura final:
  **87.52/78.87/87.73/88.76**; se conserva el suelo exactamente, sin exclusiones.
- La primera ejecución tuvo un timeout de 5 s en el caso de ChatScreen con id
  inexistente (306 pasaron). La repetición completa pasó en 41,6 s sin tocar
  timeout, test ni código de producto. Se conserva el antecedente de lentitud
  con caché fría documentado en pasadas anteriores.
- Comprobado que el oráculo rechaza una URL remota antes de intentar conectar.
- `git diff --check`: limpio.
- **No ejecutados**: build Android, Maestro en emulador y workflow remoto,
  por los requisitos del host anotados arriba. Las casillas correspondientes
  continúan abiertas; no se modifica el estado global del MVP en TODO.md.
## Sexta pasada — integración de `arquitecto` + E2E (2026-09-06)

Costura entre las dos sesiones paralelas, hecha desde la principal tras
fusionar `codex/calidad`. Ninguna de las dos podía cerrarla sola: cada una veía
solo la mitad del cambio.

- `coverageThreshold` sube a **88.74 / 80.03 / 89.5 / 90.17**
  (sentencias/ramas/funciones/líneas). Dos causas suman: el borrado de
  `screen-placeholder.tsx` y `themed-view.tsx` por `arquitecto` encogió el
  denominador sin tocar el numerador, y el test nuevo de `app-tabs.web.tsx`
  añade cobertura. Medidos por Jest, no redondeados.
- `src/components/app-tabs.web.test.tsx` — cierra la casilla que `arquitecto`
  dejó abierta al rechazar la exención de este archivo. Ver su TODO para el
  razonamiento; aquí lo relevante es que **se verificó que no son tests vacíos
  mutando el componente**: quitar el `hitSlop` tumba 1 test, fijar el fondo a
  `transparent` tumba 3.
- `app-tabs.tsx` (el nativo) sigue exento a propósito y a 0 %. El argumento de
  la quinta pasada se mantiene y `arquitecto` lo compró explícitamente.

**Verificación:** `npm run lint` limpio, `npm run typecheck` limpio,
`npx prettier --check` limpio, `npm run test:coverage -- --ci --runInBand` con
**313 tests en 29 suites** (25 del contrato remoto omitidos por su opt-in) y el
umbral nuevo cumpliéndose, `npx expo export --platform web` con 14 rutas.

**Sigue pendiente y no lo tapa nada de esto:** el caso E2E de `e2e/` nunca se ha
ejecutado en un emulador. Su propio README lo dice y hace bien: "no se declara un
E2E verde por validar YAML, ni por pasar Jest". Hasta esa primera pasada, el
workflow `e2e.yml` es código sin ejecutar.

## Séptima pasada — primer CI real (2026-09-07 UTC)

Worktree actualizado a `origin/claude/startup-cofounder-matching-app-tfeai1`
(89a8fb2). Alcance exclusivo de calidad; sin tocar `supabase/`, `src/data/`
ni `docs/plan/TODO.md`. Se conserva la integración y el umbral 88.74/80.03/89.5/90.17.

- [x] Leer la primera ejecución y comprobar los artefactos disponibles.
- [x] Diagnosticar el fallo de bundle con logs y código del resolver instalado.
- [x] Corregir la ubicación de la copia de build y recoger evidencia antes de Maestro.
- [ ] Confirmar recorrido completo verde en CI, con evidencia de UI y Postgres.
- [ ] Comprobar estabilidad y resolver el coste de carga dentro del test de layouts.

Primera ejecución: https://github.com/thejowe/lockin/actions/runs/34069732039.
Supabase local pasó. Falló `:app:createBundleReleaseJsAndAssets`: Metro no resolvía
`@/components/themed-text`. El resolver del CLI omite los alias para orígenes bajo
`node_modules`, donde el runner colocaba la app. Corregido a un directorio temporal
por checkout, fuera de ese segmento y del include de TypeScript. No se han
relajado aserciones E2E ni cambiado el producto.

No había `e2e-android` para descargar: la API devuelve `total_count: 0` y el log
de upload-artifact dice `No files were found`. El runner solo creaba evidencias
al entrar en test. El workflow ahora conserva log del build, estados de fases
y disco incluso cuando no se llega a Maestro; conserva el fallo con pipefail.

CI general del mismo commit: https://github.com/thejowe/lockin/actions/runs/34069732040,
verde, 313 tests/29 suites, 25 del contrato remoto omitidos por opt-in.
El test de layouts local con `--no-cache` pasó pero tardó 43,8 s en su primer caso.
Una medición temporal separada confirmó 58,4 s dentro del `require` del layout
y aproximadamente 0,1 s para el resto del caso. Se traslada la importación a la
preparación de la suite: el mock de useFonts se configura por render, no por
carga de módulo. Sin nuevos timeouts, mocks ni aserciones retiradas.