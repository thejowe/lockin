# TODO — calidad

> **Estado actual: duodécima pasada (2026-09-08).** **Primer recorrido E2E completo en verde**, con evidencia: [job 102245686110](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110) — `1/1 Flow Passed in 2m 36s` y las filas verificadas en Postgres. La causa que lo tenía atascado era una sola: el merge de `codex/mutual-complement` cambió el criterio de orden del deck y el fixture del E2E llevaba dos commits fijando algo que ya no ordenaba. El workflow sigue en rojo por el control negativo, que está parado en `src/data/mock/seed.ts` (otro bloque). Detalle en "Duodécima pasada", justo debajo. Lo de más abajo es el historial de las pasadas anteriores.

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
- [x] Ejecutar el workflow en Actions y revisar su primer resultado real
      (build, KVM, emulador y Maestro conduciendo la app: ver séptima pasada).
- [x] Montar el control negativo con APK sin credenciales: variante del runner,
      oráculo invertido y matriz en el workflow.
- [ ] Confirmar primer recorrido completo verde en emulador y guardar su
      evidencia. El bug de `chat` ya está arreglado; lo que falta es cerrar la
      variante `supabase`. Diagnóstico cerrado en la duodécima pasada: el
      recorrido de Maestro **pasa entero** (1/1 en 2m 59s) y lo único rojo es la
      comparación de `verify.mjs:27` contra una cadena que el teclado capitaliza.
      El arreglo es del bloque `perfil`.
- [x] Confirmar que el control negativo falla **después** del reinicio.
      Cerrado en 696408a, ver novena pasada: el APK con mock llega al reinicio,
      falla allí y no escribe nada.

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

## Duodécima pasada: los dos rojos del E2E, leídos (2026-09-08)

[Run 34172803719](https://github.com/thejowe/lockin/actions/runs/34172803719)
sobre d28baa6. Alcance de esta pasada: `e2e/` y `.github/workflows/`. No se toca
`src/` ni `supabase/`.

### Lo primero: el bloqueo que este TODO daba por vigente ya no existe

La décima pasada anotó que el log del trabajo y el artefacto respondían
`403 Must have admin rights to Repository` y que por eso el diagnóstico se
quedaba a medias. **Eso ya no es cierto**: `gh` CLI está instalado y autenticado
en esta máquina (`gh auth status` → cuenta `thejowe`, scopes `gist`, `read:org`,
`repo`, `workflow`), y tanto `gh run view --job <id> --log-failed` como
`gh run download` funcionan. El punto correspondiente de la décima pasada lleva
ahora una nota de corrección; `e2e/README.md` también. Lo que sí sigue siendo
cierto es que este host no tiene Android SDK, Java, Maestro ni Docker: desde aquí
se **lee** el emulador, no se reproduce.

### Los dos trabajos fallan por motivos distintos

| Variante | Trabajo | Resultado |
| --- | --- | --- |
| `probe` | pasa | la sonda del teclado sigue verde |
| `supabase` | [101896233448](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233448) | Maestro **1/1 Flow Passed en 2m 59s**; rojo solo en el oráculo, `e2e/verify.mjs:27` |
| `mock` | [101896233240](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233240) | falla en `full-journey.yaml:17`, la primera espera, antes de tocar nada |
| `mock` (rerun del mismo commit) | [102222194124](https://github.com/thejowe/lockin/actions/runs/34172803719/job/102222194124) | ese fallo **no se reproduce**; llega al deck y muere en la aserción del nombre, todavía antes del reinicio |

### `supabase`: el recorrido entero pasa en el emulador

Esto es más de lo que decía el TODO. El log del trabajo trae, literal:

```
[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 59s)
1/1 Flow Passed in 2m 59s
```

Es decir: formulario, chips de `seekingSpecialties`, deck ordenado, ✓ de
complementariedad, like, match, envío del mensaje, `stopApp`,
`launchApp clearState: false` y la relectura del perfil y del mensaje desde
Postgres — **todo verde en el emulador**. El compositor de `chat`, que bloqueó
tres pasadas, está cerrado de verdad.

Lo único rojo es la comparación del oráculo:

```
+ 'Una Herramienta para Construir en equipo'   ← fila en Postgres
- 'Una herramienta para construir en equipo'   ← lo que escribió la UI
```

Algo capitaliza palabra por palabra entre el `inputText` de Maestro y la fila
guardada. Es de `src/features/profile/profile-form.tsx` y **no se toca desde
aquí**: es del bloque `perfil`, que ya lo está arreglando en paralelo (en el
árbol de trabajo se ve `autoCapitalize="sentences"` + `autoCorrect={false}` sin
commitear en ese `TextField`).

### La decisión que había que argumentar: el caso NO se hace inmune

La alternativa era darle al recorrido una entrada determinista —escribir algo ya
capitalizado, o comparar sin distinguir mayúsculas— para que el E2E dejara de ser
sensible a esto. Se descarta, por tres razones:

1. **Es un bug real, y del tipo peor.** El campo es prosa libre ("Lo que quiero
   construir es…"). Que el teclado la reescriba no rompe nada visible: guarda un
   dato del usuario distinto del que el usuario escribió, en silencio.
2. **Ningún otro nivel del repo lo puede ver.** Jest + RNTL renderizan sin IME,
   así que `autoCapitalize` no se manifiesta nunca ahí; los tests de contrato de
   `src/data/supabase/` escriben en Postgres sin pasar por la pantalla. El único
   sitio donde este bug existe es esta comparación, después de un teclado real.
   Hacerla inmune no arregla nada: apaga el único detector que hay.
3. **Relajarla es exactamente lo que las reglas del E2E prohíben.** Copiar a
   `verify.mjs` la cadena capitalizada cierra el rojo sin cambiar el producto.

Lo que sí había que arreglar es que la sensibilidad era **accidental**: venía de
que la cadena elegida tenía interiores en minúscula, no de una decisión escrita.
Ahora `e2e/full-journey.test.mjs` la fija con dos casos:

- el `.yaml` escribe **byte a byte** lo que `verify.mjs` espera leer — mutación
  comprobada: capitalizar solo la expectativa del oráculo tumba este caso;
- la cadena conserva su forma de sonda: mayúscula inicial e interiores en
  minúscula, con al menos cuatro palabras — mutación comprobada: capitalizarla en
  los dos sitios a la vez tumba este otro.

La mayúscula inicial es deliberada y marca el límite de lo que el E2E exige:
`autoCapitalize="sentences"` en prosa es comportamiento deseado, no un bug. Con
esta sonda pasa `sentences` y pasa `none`, y falla `words` o un corrector activo.
El E2E no le impone a `perfil` cuál de los dos elegir; solo se niega a aceptar
que le cambien las palabras de dentro.

### `mock`, primer intento: no es una regresión del arranque, es un ANR del sistema

El síntoma era `Assertion is false: "Cofundador" is visible` a los 72 s, en el
primer `extendedWaitUntil` tras `launchApp clearState: true`. Parecía que la app
no llegaba a pintar la pantalla de modo. No es eso. El artefacto
`e2e-android-mock` lo desmiente en dos sitios:

- `logcat.txt`:
  `Displayed app.lockin.mobile/.MainActivity for user 0: +3s934ms`. La app
  arrancó y pintó, cuatro segundos después del `launchApp`.
- el volcado de jerarquía del paso que falla
  (`step-005-assertCondition-Cofundador.json`) tiene **tres nodos con texto y
  ninguno es de la app**:

  ```
  android:id/alertTitle  "System UI isn't responding"
  android:id/aerr_close  "Close app"
  android:id/aerr_wait   "Wait"
  ```

Un diálogo modal del sistema encima. Android entonces solo expone esa ventana, y
el `assertVisible` estuvo preguntando por la pantalla de SystemUI, no por la app.
Eso no es una respuesta sobre el caso, ni verde ni roja. El contexto encaja:
Maestro arranca justo tras `Boot completed in 65487 ms`, con el sistema todavía
instalando paquetes, y el logcat va lleno de `Slow dispatch` / `Slow operation`
de `system_server`.

### El rerun sobre el mismo commit: el ANR no se repite, y aparece la causa de verdad

`gh run rerun 34172803719 --job 101896233240` sobre d28baa6, sin tocar nada
([job 102222194124](https://github.com/thejowe/lockin/actions/runs/34172803719/job/102222194124)).
Resultado: **el fallo no se reproduce**, y el recorrido llega mucho más lejos —
2m 24s frente a 1m 12s:

```
[Failed] Alta, perfil, deck, match, mensaje y persistencia (2m 24s)
         (Assertion is false: "Núria Bosch" is visible)
```

Dos conclusiones, y la segunda es la que importa:

1. **No había regresión del arranque en frío.** El `"Cofundador"` del primer
   intento era el ANR de SystemUI y nada más: en el rerun el mismo APK, el mismo
   commit y el mismo AVD pasan de largo esa pantalla y 34 comandos más. Eso es lo
   que el `gh run rerun` costaba responder, y lo responde.
2. **El control negativo tiene un problema estructural, no ambiental.** Ahora
   falla en el comando 35 de 36 — `assertVisible: 'Núria Bosch'`, la primera de
   las cuatro aserciones del deck— y sigue estando **antes** del `stopApp`.

El artefacto lo explica sin ambigüedad. El volcado de la pantalla en ese paso
(`step-036-assertCondition-Núria_Bosch.json`) trae el deck cargado y delante
**no está Núria Bosch**. Cuál es la de delante se lee en los `bounds`, no en el
orden del volcado: la de delante es la única tarjeta a tamaño completo, y las de
detrás salen escaladas.

```
Lucía Pardo  [295,530][974,609]   ← delante
Marc Oller   [305,587][957,663]
Diego Salas  [315,641][939,714]
```

Es exactamente lo que la décima pasada dejó anotado como riesgo, palabra por
palabra: *"los pasos que añade esta pasada van antes del reinicio y todavía no
han visto un emulador; si alguno fallara ahí, el propio control lo diría y lo
rechazaría"*. Pasó eso. Esas cuatro aserciones nombran a la persona que el
`update` de `created_at` de `incoming-likes.sql` pone arriba, y ese fixture es de
Postgres: con el APK sin credenciales el deck lo ordena `src/data/mock/seed.ts` y
arriba hay otra persona. No es que la aserción sea débil con el mock — es que no
puede cumplirse allí por construcción.

### El arreglo: condicionar esas cuatro líneas, y solo esas

Se descartan las dos salidas fáciles. Relajar la aserción (comparar "algún
nombre" en vez de uno concreto) le quitaría al deck lo único que lo hace
comprobable, que es hablar de datos de una persona conocida. Y darle al control
negativo un `.yaml` propio rompería su garantía central: que las dos variantes
corren **el mismo caso**.

Lo que se hace es marcarlas como lo que son — el único tramo del recorrido que
depende de una fila que solo existe en Postgres — con la condición de Maestro:

```yaml
- runFlow:
    when:
      true: ${DECK_FIXTURE == 'postgres'}
    commands:
      - assertVisible: 'Núria Bosch'
      - assertVisible: '(?i)busca'
      - assertVisible: '(?i)✓ marketing'
      - assertVisible: '(?i)✓ encajas'
```

`run.mjs` pasa `DECK_FIXTURE=postgres` en la variante con credenciales y
`memoria` en el control negativo. Qué **no** cambia: la variante que decide el
color del E2E las ejecuta todas, igual que antes; el `tapOn: 'Like'`, el
`stopApp`, el `launchApp clearState: false` y toda la relectura de persistencia
corren idénticos en las dos. Lo que se recupera es que el control negativo pueda
llegar al reinicio, que es lo único que le da sentido.

Tres guardas nuevas en `full-journey.test.mjs`, las tres verificadas por mutación
(cada una se rompe al introducir el error que vigila):

- el bloque condicional contiene **exactamente** esas cuatro líneas — colar
  cualquier otro paso dentro, o meter ahí el `stopApp`, tumba el caso;
- hay **un solo** `runFlow` en todo el recorrido, y el `stopApp` sigue al margen
  izquierdo, fuera de él;
- el primer `assertTrue` del recorrido exige que `DECK_FIXTURE` valga `postgres`
  o `memoria`, así que dejar de pasar la variable rompe el recorrido en vez de
  saltarse las cuatro aserciones en silencio.

La sintaxis de `runFlow` + `when.true` con `commands:` en línea está contrastada
contra la documentación de Maestro
(https://docs.maestro.dev/maestro-flows/flow-control-and-logic/conditions.md).
Aquí no hay Maestro para ejecutarla: lo dice el próximo run.

### La guarda del control negativo acertó, pero por el motivo equivocado

Al fallar antes del `stopApp`, el `commands.json` de Maestro traía 5 comandos y
ninguno era el reinicio — **Maestro solo vuelca lo que llegó a ejecutar**.
`run.mjs` leía ese `-1` y respondía *"El caso ya no reinicia la app: el control
negativo perdería su sentido"*, que es falso: `full-journey.yaml:114` lo declara.
El trabajo se puso rojo, que es lo correcto, pero con un diagnóstico que apuntaba
a una regresión inexistente.

Ahora se distinguen las dos causas: primero se comprueba en el `.yaml` que el
`stopApp` sigue declarado (esa sí es la regresión que este control existe para
impedir, y conserva su mensaje) y, si está, se dice lo que de verdad pasó — el
recorrido no llegó al reinicio, así que el control negativo no concluye nada
sobre la persistencia.

### Cambio en `triage.mjs`: una excepción, y por evidencia

`e2e/triage.mjs` clasificaba —correctamente, según su propia regla— este fallo
como del caso: `Assertion is false` está en `CASE_SIGNATURES` y las firmas del
caso ganan siempre. Esa regla existe para que un bug real no se reintente hasta
verlo verde, y no se toca.

Se añade una única excepción, decidida por **evidencia del volcado, no por texto
del mensaje**: si el paso que falla trae un diálogo ANR de Android
(`android:id/aerr_*`, buscado por id y no por texto para que no dependa del
idioma del emulador) y el título **no** nombra a la app (`expo.name` de
`app.json`), es caída del runner y se reintenta. Si el que no responde es la app
bajo prueba, sigue siendo fallo del caso y no se reintenta nunca. Sin saber cómo
se llama la app no se decide por el diálogo: se cae a las reglas de siempre.

Justificación de que esto no relaja nada: la regla protege contra repetir una
aserción fallida **sobre la app**. Aquí la aserción no llegó a mirar la app —
había una ventana del sistema delante, y el sistema no expone otra cosa. Los
cuatro casos nuevos de `e2e/triage.test.mjs` fijan las cuatro ramas, y el parser
se ha validado contra el volcado real del run (devuelve
`{"title":"System UI isn't responding"}` y clasifica `runner`).

### Lo que el run de la rama demuestra, y lo que destapa

Rama `calidad/e2e-anr-y-deck-condicional`, commit 91e98a1.
[Run 34276300168](https://github.com/thejowe/lockin/actions/runs/34276300168).
CI verde entero (Lint, Formato, Tipos, Tests, **Runner E2E**, Export web).

**Las tres piezas de esta pasada funcionan en un emulador de verdad**, y esto ya
no es "pasa el YAML":

1. **La clasificación del ANR.** El trabajo `mock` volvió a encontrarse el
   diálogo del sistema, dos veces seguidas en el mismo AVD, y el veredicto lo
   dijo con todas las letras en vez de culpar al caso:
   `Veredicto de attempt-01: runner — un diálogo ANR del sistema tapaba la
   pantalla ("System UI isn't responding"): la aserción no llegó a mirar la app`.
   O sea que el ANR no era una casualidad de un run: es reproducible.
2. **El reintento de emulador se disparó por ese motivo**, que es justo para lo
   que existe: `Reintentar el emulador: true`, y el paso "segundo emulador" corrió
   por primera vez con una causa legítima. En el AVD nuevo no hubo ANR.
3. **El `runFlow` condicional hace lo que dice.** En el `commands.json` del
   tercer intento el comando 35 es `runFlowCommand SKIPPED` con el mock, y el
   recorrido siguió adelante: 38 comandos en vez de los 36 de antes, y llegó a
   `tapOn: 'Like'` (COMPLETED). La sintaxis es correcta y el gate no toca al
   resto del recorrido.
4. **El mensaje de la guarda ya no miente.** Donde antes decía "El caso ya no
   reinicia la app", ahora dice: *"El recorrido no llegó al reinicio: Maestro
   ejecutó 38 comando(s) y falló en el 37. `full-journey.yaml` sí declara el
   `stopApp`, así que esto no dice nada sobre la persistencia"*.

**Y destapa el siguiente eslabón, que no es de este bloque.** Con el gate puesto,
el control negativo ya no muere en el nombre de la tarjeta: muere en el comando
37 de 38, `Assertion is false: "¡Match!" is visible`. Sigue siendo antes del
`stopApp`, así que sigue sin concluir.

La causa está en el artefacto y es concreta. Comparando los `bounds` de la
tarjeta de delante antes y después del like:

```
antes del like (job 102222194124)   Lucía Pardo [295,530][974,609]  ← delante
después del like (job 102230038048) Marc Oller  [295,530][974,609]  ← delante
```

El deck avanzó exactamente una tarjeta: el like se registró y cayó sobre **Lucía
Pardo**. Y `src/data/mock/seed.ts` declara
`SEED_RECIPROCAL_IDS = ['seed-nuria', 'seed-marc', 'seed-alba']` — `seed-lucia`
no está. Con el mock, darle like a la tarjeta de delante **no genera match**, así
que no hay chat, no hay mensaje y no se llega al reinicio.

No es un fallo del E2E ni se arregla desde `e2e/`: es que el fixture que garantiza
"quien está delante ya te ha dado like" existe para Postgres
(`e2e/incoming-likes.sql`) y no tiene equivalente vigente en el mock. El orden del
deck cambió con el merge de `codex/mutual-complement` y `SEED_RECIPROCAL_IDS` se
quedó como estaba.

**Encontrado y no tocado** (`descubrir` / `datos`, dueños de `src/data/mock/`):
para que el control negativo pueda cumplir su contrato, la tarjeta que quede
primera en el orden del mock tiene que estar en `SEED_RECIPROCAL_IDS`, igual que
`incoming-likes.sql` lo garantiza en Postgres. Hoy la primera es `seed-lucia` y
no lo está. Es una línea, pero es de `src/` y desde aquí no se toca.

### La causa raíz: el fixture llevaba dos commits sin fijar nada

Con el gate del deck puesto, el segundo run de la rama
([34276300168](https://github.com/thejowe/lockin/actions/runs/34276300168), tras
`gh run rerun --failed`) dio el dato que faltaba. Los dos trabajos avanzaron, y
los dos se rompieron por **la misma causa**, que no es la que se creía.

**`supabase` ([102238000817](https://github.com/thejowe/lockin/actions/runs/34276300168/job/102238000817)):**
Maestro pasa entero otra vez —`1/1 Flow Passed in 3m 33s`, aserciones del deck
incluidas— y el oráculo falla, pero ya no en la cadena del prompt: en
`verify.mjs:44`.

```
El like no cayó sobre la primera tarjeta del deck (Núria Bosch)
+ '11111111-1111-4111-8111-000000000002'
- '11111111-1111-4111-8111-000000000001'
```

El like cayó sobre **Marc Oller**. Y esto se puede calcular, no hace falta
suponerlo. `20260907000200_discovery_mutual_complement` sustituyó
`order by p.created_at desc` por:

```sql
order by
  case ... else (me.specialties && p.seeking_specialties)::integer
             + (p.specialties && me.seeking_specialties)::integer end desc,
  p.id asc
```

`created_at` **ya no interviene**. El perfil del recorrido domina `dev` y
`marketing` y busca `diseno`, así que con los datos de `supabase/seed.sql`:

| Tarjeta | mis especialidades ∩ lo que busca | sus especialidades ∩ lo que busco | total |
| --- | --- | --- | --- |
| Núria (`…0001`) | `marketing` → 1 | `{dev,datos}` ∩ `{diseno}` = ∅ → 0 | **1** |
| Marc (`…0002`) | `dev` → 1 | `diseno` → 1 | **2** |

Marc gana por 2 a 1. Exactamente el id que devolvió el oráculo.

Es decir: **el `update` de `created_at` de `e2e/incoming-likes.sql` dejó de fijar
el orden del deck en el merge de `codex/mutual-complement`, y nadie se enteró**.
La décima pasada escribió esa suposición y hasta puso una guarda para
protegerla — `assert.match(fixture, /update public\.profiles\s+set created_at/)`
— que siguió pasando en verde todo el tiempo, porque comprobaba que la línea
existiera, no que sirviera para algo.

Y explica también por qué `assertVisible: 'Núria Bosch'` pasa mientras el like
cae en otra: el deck pinta tres tarjetas apiladas y Núria está entre ellas, solo
que detrás. `assertVisible` no dice "delante", dice "en pantalla". Quien sí
distingue es el oráculo, comparando el id sobre el que cayó la decisión — la
aserción del `.yaml` es la débil y el `verify.mjs` es el que cazó el bug.

**Arreglo, y es de este bloque** (`e2e/incoming-likes.sql`): se fija la tarjeta
de delante por el criterio que de verdad ordena. A Núria se le da la puntuación
máxima —le faltaba el segundo sumando, así que se le añade `diseno` a lo que
domina— y como su id es el más bajo del seed gana además cualquier empate. Su
fila "Busca" no se toca: el ✓ que afirma el recorrido sale de ahí.

La guarda se reescribe para comprobar el criterio nuevo, y añade
`assert.doesNotMatch(fixture, /set created_at/)` para que la línea muerta no
pueda volver disfrazada de fijación. Verificado por mutación: reponer el
mecanismo antiguo tumba el caso.

### Y la cadena capitalizada resulta ser intermitente

Dato que corrige lo escrito más arriba en esta misma pasada. Los dos runs de
`supabase` corrieron sobre **el mismo commit** (91e98a1, sin el arreglo de
`perfil`), y el primero murió en `verify.mjs:27` con
`'Una Herramienta para Construir en equipo'` mientras el segundo **pasó de largo
esa comparación** y llegó hasta la línea 44. Mismo APK, mismo emulador, mismo
texto escrito: el auto-capitalizado aparece unas veces y otras no.

No cambia la decisión —al contrario, la refuerza—: una corrupción silenciosa e
**intermitente** de un dato del usuario es de las que no caza nada salvo un
recorrido real, y desde luego no un test que renderiza sin IME. Sí cambia lo que
se puede afirmar: este E2E detecta el bug, pero no en todas las pasadas, así que
un verde suelto de la variante `supabase` no demuestra que esté arreglado.

### Estado del control negativo, que sigue sin concluir

`mock` ([102238001056](https://github.com/thejowe/lockin/actions/runs/34276300168/job/102238001056))
reprodujo su fallo **exacto** —`Assertion is false: "¡Match!" is visible`, comando
37 de 38—, así que es determinista, no una carrera. La causa es la misma de
fondo, vista desde el otro lado: con el orden nuevo la tarjeta de delante en el
mock es Lucía Pardo, y `src/data/mock/seed.ts` declara
`SEED_RECIPROCAL_IDS = ['seed-nuria', 'seed-marc', 'seed-alba']` — `seed-lucia` no
está, así que darle like no genera match y el recorrido no llega al `stopApp`.

El arreglo del fixture de Postgres no toca eso: el mock no lo lee. Ver
"Encontrado y no tocado".

### Encontrado y no tocado (`descubrir` / `datos`)

`src/data/mock/seed.ts`: el control negativo necesita que quien quede **delante**
en el orden del mock esté en `SEED_RECIPROCAL_IDS`, que es lo que
`e2e/incoming-likes.sql` garantiza en Postgres. Con el orden por
complementariedad mutua la primera es `seed-lucia`, que no está en esa lista.
Mientras siga así, el recorrido con el mock se para en el match y el control
negativo no puede cumplir su contrato. Es de `src/`, así que desde aquí solo se
reporta.

### Primer recorrido completo VERDE (2026-09-08)

[Run 34281070607, trabajo `supabase`
(102245686110)](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
commit 78c90b8. Paso **"Resultado del recorrido (supabase)": success**. El log:

```
=== Recorrido supabase, attempt-01 ===
[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 36s)
1/1 Flow Passed in 2m 36s
Postgres: alta, perfil, lo que busca, modo, like, match y mensaje verificados.
Veredicto de attempt-01: pass — recorrido completo y persistencia verificados
Recorrido supabase verde en attempt-01.
```

Al primer intento, sin reintento de Maestro y con el segundo emulador `skipped`.
Las dos líneas que importan son las dos últimas: la primera la escribe Maestro
—el recorrido de UI, reinicio incluido— y la segunda la escribe `verify.mjs`
leyendo Postgres con el cliente privilegiado, que nunca entra en el APK. Alta
anónima real, perfil, `seeking_specialties`, modo, decisión, match y mensaje:
comprobados como filas.

Ese run llevaba también el arreglo del teclado de `perfil` (4ab248a), así que
`verify.mjs:27` pasó. **Ojo con leer eso como prueba de que el auto-capitalizado
está arreglado**: se demostró más arriba que aparece de forma intermitente, y un
verde suelto no distingue "arreglado" de "esta vez no salió".

Qué NO cierra este verde: el workflow **sigue en rojo**, porque el control
negativo no concluye. El verde de arriba prueba por sí solo que la app escribió
en Postgres —lo dice el oráculo, fila a fila—; lo que falta es la otra mitad,
que el mismo caso con el APK sin credenciales se rompa en la persistencia. Eso
está parado en `src/data/mock/seed.ts`, que es de otro bloque.

### Casillas

- [x] Diagnosticar el rojo de la variante `supabase` con el log del run.
      Cerrada con evidencia: job 101896233448, paso "Resultado del recorrido
      (supabase)", `e2e/verify.mjs:27`.
- [x] Diagnosticar el rojo de la variante `mock` con el artefacto del run.
      Cerrada con evidencia, y son **dos** causas encadenadas: el ANR de SystemUI
      del primer intento (artefacto `e2e-android-mock`,
      `attempt-01/.../screen-hierarchy/step-005-assertCondition-Cofundador.json`)
      y, debajo, la que el rerun destapó — las cuatro aserciones del deck no se
      pueden cumplir con el mock (job 102222194124,
      `step-036-assertCondition-Núria_Bosch.json`: delante está Lucía Pardo).
- [x] Comprobar con `gh run rerun` sobre el mismo commit si el `mock` tenía una
      regresión de arranque en frío. **No la tenía**: el fallo no se reproduce.
- [x] Devolver al control negativo la capacidad de llegar al reinicio, sin
      relajar nada de la variante que decide el color. Hecho con `runFlow` +
      `when.true` sobre esas cuatro líneas y tres guardas de mutación.
- [x] Decidir y argumentar si el caso debe volverse inmune al auto-capitalizado.
      Decidido que **no**, con los tres motivos de arriba, y fijado con dos casos
      de `full-journey.test.mjs` verificados por mutación.
- [x] Corregir en el TODO el bloqueo de lectura de logs que ya no existe.
- [x] Verificar en un emulador real la clasificación del ANR, el reintento que
      dispara y el `runFlow` condicional. Cerrada con evidencia del run
      34276300168: veredicto `runner` por el diálogo del sistema, segundo
      emulador arrancado por ese motivo, y `runFlowCommand SKIPPED` en el
      `commands.json` del control negativo.
- [x] Encontrar por qué el like no cae sobre la tarjeta que el recorrido afirma.
      Cerrada: el `update` de `created_at` del fixture dejó de ordenar el deck en
      el merge de `codex/mutual-complement`. Arreglado en `e2e/incoming-likes.sql`.
- [x] **Recorrido completo verde en emulador** y [x] **verde en CI**. Cerradas
      las dos con el mismo enlace, porque el emulador es el de Actions:
      [job 102245686110](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
      paso "Resultado del recorrido (supabase)", `1/1 Flow Passed in 2m 36s` más
      `Postgres: alta, perfil, lo que busca, modo, like, match y mensaje
      verificados`. Es la primera vez que el recorrido entero pasa.
- [ ] **Control negativo concluyente con el `.yaml` actual.** Esta queda abierta
      y es la que mantiene el workflow en rojo. Hoy el `mock` se para en
      `¡Match!` (comando 37 de 38) porque la primera tarjeta de su orden,
      `seed-lucia`, no está en `SEED_RECIPROCAL_IDS`. Depende de
      `src/data/mock/seed.ts`: reportado abajo, no tocado.
      Antecedente que sí existe, con otro `.yaml`: run 34162107392 sobre 696408a,
      donde el control negativo pasó.

### Lo que NO se ha hecho, y por qué

- No se ha tocado `src/features/profile/profile-form.tsx`: es de `perfil` y lo
  está arreglando en paralelo. Tampoco `src/data/mock/seed.ts`, que es lo que
  hoy para el control negativo: queda reportado arriba, no corregido.
- No se ha ampliado ningún timeout, ni quitado el `stopApp` o el
  `launchApp clearState: false`, ni relajado ninguna aserción.
- No se retira la variante `probe` pese a que el bug del teclado está cerrado y
  `run.mjs` la anuncia como temporal. Ahora mismo es la única de las tres que da
  verde de punta a punta, y con dos variantes en rojo conviene conservar la
  prueba barata de que el camino APK → emulador → Maestro funciona. Se retira
  cuando `supabase` cierre.

## Undécima pasada: cubrir `seekingSpecialties` (2026-09-07)

Contexto: `arquitecto`, `datos`, `descubrir` y `perfil` entregaron la feature
(`7abbb0c`, `eb3867f`, `01c3a52`, `3eea69e`) y la migración ya está aplicada en
el proyecto real. `npm test` daba 353 verdes, `tsc` y lint limpios — pero CI en
rojo: **ninguno de los cuatro bloques corrió jest con `--coverage`**, así que
nadie vio el único gate que mira los umbrales.

    Jest: "global" coverage threshold for functions (89.84%) not met: 89.73%

`npm test` no aplica el suelo; `npm run test:coverage` sí. Es la misma lección
de la décima pasada dicha de otra forma: verificar con el comando que corre CI,
no con el que va más rápido.

### El suelo no se baja: se cubre lo que faltaba

Los huecos eran exactamente el código nuevo, más un botón que nunca se había
pulsado:

| Archivo | Hueco | Qué se cubrió |
|---|---|---|
| `catalog.ts` | ramas al 60 % (124, 148-158) | `catalog.test.ts`, nuevo |
| `profile-details.tsx` | funciones al 85,71 % (128) | la sección "Enlaces" |
| `profile-form.tsx` | 86, 289, 412, 445-454 | respaldo de `Intl`, zona horaria, cambio de pregunta, portfolio y LinkedIn |
| `controls.tsx` | función 227 | el "+" del `Stepper` |

Los tres archivos del bloque `perfil` quedan al 100 % en funciones y líneas, y
`catalog.ts` al 100 % en las cuatro métricas.

Lo que cubren esos tests no es relleno de cobertura:

- **`labelOf` cae al código si no está en el catálogo.** Un perfil guardado
  antes de retirar una opción sigue en la base de datos; pintar `quantica` es
  feo, pintar un hueco es un perfil que miente.
- **`availabilitySummary` con cero franjas** dice "sin franja". El formulario
  exige al menos una, pero la ficha también pinta filas que vienen de Supabase.
- **`deviceTimezone` sin `Intl`.** Hermes sin ICU no lo trae. Sin el respaldo el
  alta arrancaría con un campo obligatorio vacío y el formulario se negaría a
  guardar. El test lo distingue del camino feliz mockeando `Intl` para que
  devuelva `America/Bogota`: si el respaldo se rompe, los dos casos ya no dan lo
  mismo.
- **Los enlaces de la ficha.** El doble de `ExternalLink` apunta el `href` que
  recibe, así que el test comprueba que GitHub lleva a GitHub y que un portfolio
  ausente no se pinta con `href` vacío — no solo que salen tres textos.
- **Cambiar la pregunta de un prompt** sin perder la respuesta ya escrita.
- **El "+" del `Stepper` respeta el máximo.** El "−" tenía test desde la primera
  pasada; el "+" no lo había pulsado nadie.

**Comprobado que no son tests vacíos**: con seis mutaciones a la vez sobre el
código de producto —quitar el `?? value` de `labelOf`, el `?? 'Sin franja'`, el
`return 'Europe/Madrid'` del `catch`, el `updatePrompt` del chip y el `filter`
de enlaces— caen **7 de los 45** tests del bloque. Las mutaciones se revirtieron
con `git checkout`; no se ha tocado código de producto en esta pasada.

### El suelo sube: 89.82 / 82.56 / 91.49 / 91.38

De 88.87/80.24/89.84/90.31. Mismo criterio de siempre: el suelo se sube a la
cobertura real medida, nunca se baja ni se excluyen archivos para dejar pasar un
cambio. **No hizo falta tocar los umbrales a la baja**: con los tests nuevos la
suite ya pasa el suelo viejo con margen.

### Dos casillas de `TODO.md` estaban mal

En "Especialidades buscadas", ambas marcadas como pendientes cuando ya no lo
están:

- **La migración sí está aplicada.** Verificado consultando `seeking_specialties`
  con la clave `anon`: responde `42501` (RLS) y no `42703` (columna inexistente).
  La distinción es la prueba: un `42501` solo puede venir de una columna que
  existe.
- **El campo del formulario y la ficha sí está hecho**, en `3eea69e`.

De paso, la línea de "Calidad" del mismo archivo seguía diciendo 222 tests y el
suelo de la segunda pasada. Actualizada.

### Verificación de esta pasada

- `npm run test:coverage -- --ci --runInBand` — **374 tests en 34 suites**
  (27 del contrato remoto omitidos por su opt-in), cobertura
  89.82/82.56/91.49/91.38, `EXIT=0` y sin línea de `threshold`. Es el comando
  que corre CI, y es el que se saltaron los cuatro bloques.
- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre lo tocado — limpio. (`format:check` completo
  sigue fallando en este checkout Windows por CRLF, como está documentado
  arriba; en CI se comprueba sobre LF.)
- `git status` — solo tests, `jest.config.js` y los dos TODO. Ningún archivo de
  producto modificado.
- **No ejecutado aquí**: build Android, Maestro y emulador — este host sigue sin
  Android SDK, Java ni Maestro. Las dos casillas de E2E siguen abiertas y
  bloqueadas por el compositor de `chat`, igual que en las dos pasadas
  anteriores; nada de esta pasada las toca.

## Décima pasada: arreglar CI en rojo tras la novena (2026-09-07)

Contexto de arranque: CI en rojo en `cfadf27` y `cea5712` — "Formato" fallando
en `format:check`, y las 3 variantes de "E2E Android" (`probe`/`mock`/`supabase`)
en "UI y persistencia real". Se pidió revisar primero el run
[34144931734](https://github.com/thejowe/lockin/actions/runs/34144931734) para
saber si la ronda 3 del compositor (`cfadf27`) ya pasaba.

### Ronda 3 del compositor: sigue en rojo, y el reintento de la novena pasada acertó

Las 3 variantes fallan en el mismo sitio que antes de `cfadf27`: `"Enviar
mensaje"` no aparece (`Element not found` en `mock`/`supabase`, `Assertion is
false` en `probe`). Las tres se clasificaron como fallo del **caso**, no del
runner, y el paso de reintento (montado en la novena pasada) las dejó correr
una sola vez cada una — exactamente la regla que se escribió: "repetirlo lo
enmascararía". Es la primera confirmación en Actions de que esa clasificación
distingue bien un fallo real de una caída de infraestructura. El arreglo del
compositor sigue siendo trabajo de `chat` (ver su TODO); aquí no se toca.

### "Formato" en rojo: dos archivos de otros bloques sin pasar por Prettier

`npm run format:check -- --end-of-line auto` señalaba `jest.setup.js` (el mock
de `react-native-safe-area-context` que añadió `cfadf27`) y
`src/app/chat/[matchId].tsx` (la sonda de `console.log` que añadió `54359c6`).
Los dos tenían una llamada con formato de argumento distinto al que exige
Prettier — mismo patrón que el `.prettierrc` con `bracketSameLine` documentado
arriba: quien no corre `npm run format` antes de comitar dijo formatos legibles
pero distintos. `npx prettier --write` en ambos, sin tocar significado.

### El suelo de cobertura bajaba 0,03-0,04 puntos: la sonda temporal no tenía test

Con "Formato" ya arreglado, `npm run test:coverage` seguía en rojo:
`statements 88.84 → 88.77`, `functions 89.81 → 89.53`, `lines 90.28 → 90.19`.
La sonda de `54359c6` (`useKeyboardHandler(...)` en `[matchId].tsx`, explícita
en su propio commit como temporal — "se retira en cuanto ese TODO se cierre")
no tenía ningún test que disparara su `onStart`, y el mock oficial de
`react-native-keyboard-controller` no lo invoca solo. Mismo criterio que en la
novena pasada con `onContentSizeChange`: el suelo no se baja, se cubre lo que
falta.

Test nuevo en `test/app/matchId.test.tsx`: coge la última llamada registrada en
el mock de `useKeyboardHandler` y dispara `onStart` a mano, comprobando que el
`console.log` sale con la altura recibida. **Comprobado que no es un test
vacío**: cambiar el texto logueado (`height=` → `altura=`) tumba la aserción.
Se retira junto con la sonda cuando `chat` cierre esa ronda — anotado en el
propio test para que no se quede huérfano.

Suelo subido a los números exactos medidos: **88.87 / 80.24 / 89.84 / 90.31**
(sentencias/ramas/funciones/líneas). Rama sin cambio: la sonda no añade ninguna.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npm run format:check -- --end-of-line auto` — limpio (antes: 2 archivos).
- `npm run test:e2e` — 22/22.
- `npm run test:coverage -- --ci --runInBand` — **315 tests en 29 suites**
  pasan (25 del contrato remoto omitidos por opt-in), cobertura
  88.87/80.24/89.84/90.31 cumpliendo el nuevo suelo. Dos ejecuciones previas de
  esta misma pasada, con el suelo todavía viejo, dieron sendos timeouts de 5 s
  en pruebas distintas (`swipe-deck` una vez, `profile-form` la otra) con caché
  fría — mismo patrón de flake ya documentado en pasadas anteriores, no una
  regresión: una tercera ejecución con caché caliente pasó completa sin tocar
  nada.
- `npx expo export --platform web` — 14 rutas, sin cambios.
- **No ejecutado aquí**: build Android, Maestro y emulador. Su estado es el que
  reportan las tres variantes del run 34144931734, leído con `gh run view`.

### Qué queda abierto

Las mismas dos casillas de la novena pasada, sin mover: recorrido completo
verde y control negativo correcto, ambas bloqueadas por el compositor de
`chat`. Nada de esta pasada las toca ni las esquiva.
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
      Sigue abierta: en 696408a el trabajo `supabase` falla y el log y el
      artefacto piden permisos de administración del repositorio.
- [x] Comprobar estabilidad y resolver el coste de carga dentro del test de layouts.

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
Verificación adicional de flake: layouts con caché fría conserva 7/7 y el primer
caso baja a 54 ms. En la suite completa fría reapareció el timeout conocido de
ProfileForm (312/313). Se midió la inicialización diferida de los hosts nativos:
4.649 ms en los getters de React Native; al hacerla en preparación de suite,
el primer render baja a 270 ms y ProfileForm pasa 12/12. `test/native-hosts.js`
carga esos módulos para suites TSX antes de sus casos; no renderiza, no añade
dobles y no altera temporizadores. La suite completa con --ci --runInBand --no-cache pasa 313/313 en 29 suites (110,4 s), con la misma cobertura 88.74/80.03/89.5/90.17. El contrato remoto conserva sus 25 casos opt-in omitidos.
Segundo run: https://github.com/thejowe/lockin/actions/runs/34070646301 (0f9be5b).
Backend y APK release pasan (build 8m44s). El emulador arranca y ejecuta la app;
Maestro falla esperando `Cofundador` en la primera pantalla. Artefacto 10000604372
revisado: JUnit, logcat, build y fases; no hay crash JS/nativo de la app registrado.
Faltan captura y árbol: `--debug-output` no configura el destino de capturas en
Maestro 2.10; requiere `--test-output-dir`. Se añaden ambos flags y captura/árbol
por ADB independiente. No se cambian selectores ni esperas sin ver esa evidencia.
## Séptima pasada: el E2E se ejecuta de verdad (2026-09-07)

Se fusionó `codex/calidad` y se subió la rama. Corrección al contexto con el que
se abrió esta sesión: el workflow **sí se había ejecutado ya en Actions** — tres
veces antes de esta pasada. Esta sesión revisa esos resultados y los dos que se
lanzaron después.

### Lo que las ejecuciones reales demuestran

| Run | Commit | Hasta dónde llega |
|---|---|---|
| [34069732039](https://github.com/thejowe/lockin/actions/runs/34069732039) | 89a8fb2 | Supabase levanta; el bundle Android falla por los alias `@/`. Cero artefactos. |
| [34070646301](https://github.com/thejowe/lockin/actions/runs/34070646301) | 0f9be5b | `BUILD SUCCESSFUL in 8m 44s`, KVM arranca el AVD (`Boot completed in 77441 ms`), Maestro conduce la app. Falla en el primer paso por arranque en frío. |
| [34115169719](https://github.com/thejowe/lockin/actions/runs/34115169719) | b77b9d7 | **38 de 48 comandos COMPLETED** contra Supabase local real. Falla en `tapOn "Enviar mensaje"`. |

La tercera es la que importa. Sin tocar el caso, el mismo primer paso que había
fallado pasa — con lo que aquello queda identificado como arranque en frío del
emulador y no como un selector equivocado. Y a partir de ahí el recorrido
completo se ejecuta sobre la app real: alta anónima automática, selección de
modo, el formulario entero con sus scrolls, `Crear perfil`, deck, `Like`,
`¡Match!`, `Abrir chat` y el mensaje escrito en el compositor.

Es decir: la viabilidad del emulador en Actions ya no es una cita de
documentación. KVM funciona, el APK release se compila e instala, Maestro
maneja la interfaz de React Native y la app habla con Supabase local por
`adb reverse`.

### Por qué las dos casillas siguen abiertas

`tapOn "Enviar mensaje"` → `Element not found`. La captura y el volcado de
jerarquía del paso 038 dicen exactamente por qué: con el teclado abierto la
ventana no se redimensiona y el compositor entero desaparece del árbol de
accesibilidad. Es Android 15+ con edge-to-edge, donde `adjustResize` ya no
redimensiona, contra `behavior="height"` en `src/app/chat/[matchId].tsx:82`.

Es un defecto de producto del bloque `chat`, no del caso E2E. Está reportado en
`docs/plan/todo/chat.md` con la evidencia y dos caminos de arreglo. Aquí no se
toca su código —regla de alcance— y **tampoco se esquiva**: bastaría con mover
el `hideKeyboard` delante del envío para dejar el workflow en verde, y sería
declarar bueno un recorrido que un usuario real no puede completar.

Dicho de otro modo: el E2E no ha fallado. Ha encontrado un bug real que 313
tests unitarios no podían encontrar, que es exactamente para lo que se montó.

### Control negativo: montado, pendiente de poder ejecutarse

`E2E_NEGATIVE_CONTROL=1` compila el APK **sin** `EXPO_PUBLIC_SUPABASE_*`, con lo
que `src/data/active.ts` elige el mock en memoria. Todo lo demás es idéntico —
mismo Supabase levantado, mismo `adb reverse`, mismo `full-journey.yaml`—, así
que la única variable entre las dos ejecuciones son las credenciales del bundle.

En esa variante el runner invierte el criterio y exige tres cosas:

1. Maestro termina con error.
2. El primer comando fallido está **después** del `stopApp`, leído de
   `commands.json` (`maestro.xml` solo trae un mensaje; el volcado trae el orden
   y el estado de cada paso). Si el mock se rompiese antes, el control no
   probaría que lo que falta es la persistencia — y el runner lo rechaza
   diciendo en qué paso se rompió.
3. Postgres no tiene ni el perfil ni el mensaje de esa ejecución, comprobando
   antes que la base responde y tiene seed: una base caída daría "ausencia" y
   pasaría por el motivo equivocado.

Ese punto 2 es justo el que hoy no se puede satisfacer: con el bug del
compositor, el APK con mock se rompe en el mismo paso 38, antes del reinicio.
El control funciona —detecta y nombra la situación— pero no puede dar por
válida la prueba todavía.

Las dos variantes corren como matriz en el mismo workflow, con
`fail-fast: false` y artefactos separados (`e2e-android-supabase`,
`e2e-android-mock`). El negativo corre en cada push, no a mano: si algún día
pasara en verde, el caso positivo habría dejado de probar Supabase.

### Cambios de esta pasada

- `e2e/run.mjs` — variante `supabase`/`mock` por `E2E_NEGATIVE_CONTROL`,
  directorio de build y de evidencia separados por variante, `build-backend`
  por variante, y el criterio invertido con `firstFailure()` leyendo
  `commands.json`.
- `e2e/verify.mjs` — `verifyAbsence()`, el oráculo del control negativo.
- `.github/workflows/e2e.yml` — matriz de dos variantes con artefactos propios.
- `e2e/README.md` — control negativo y diagnóstico de las ejecuciones reales.
- `docs/plan/todo/chat.md` — el bug reportado con su evidencia.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre `e2e/run.mjs` y `e2e/verify.mjs` — limpio.
- `node e2e/run.mjs badcmd` y la importación de `verify.mjs` — ambos módulos
  parsean y ejecutan; el workflow parsea como YAML con la matriz esperada.
- **No ejecutado en esta máquina**: build Android, Maestro y emulador. Sigue sin
  Android SDK, Java, Maestro ni Docker. La validación es Actions, y por eso lo
  que se afirma arriba son números leídos de sus logs y artefactos, no de aquí.

## Octava pasada: primera matriz completa en emulador (2026-09-07)

[Run 34118890956](https://github.com/thejowe/lockin/actions/runs/34118890956),
commit 6563af7 — el arreglo de `chat` más el control negativo. Los dos jobs
compilan su APK y arrancan su emulador. Ninguno cierra su casilla, y por
motivos distintos.

### Variante `supabase`: el arreglo de `chat` no funcionó

Mismo `tapOn "Enviar mensaje"`, mismo `Element not found`, misma captura. El
cambio a `behavior="padding"` no basta. Reportado con la evidencia nueva en
`docs/plan/todo/chat.md`: la jerarquía del instante del tap no tiene compositor,
pero el volcado de `uiautomator` posterior sí, y ~630 px por encima del fondo —
`padding` se aplica con la magnitud correcta pero solo después de que el teclado
se cierre. El evento llega tarde; el `behavior` no es la variable que decide.

### Variante `mock`: no concluye, y el runner lo dijo mal

Maestro murió antes de ejecutar **ningún** comando:
`DeviceServerDiedException ... Command failed (tcp:34809): closed`, 341 ms. Es
una caída del driver gRPC en el dispositivo — infraestructura, sin relación con
el mock ni con las credenciales.

El control negativo falló, que es lo correcto, pero con el mensaje equivocado:
`Se esperaba un único volcado de comandos de Maestro`. Cierto y bastante inútil.
`firstFailure()` ahora distingue el caso: si no hay volcado, dice que Maestro no
ejecutó ningún comando, cita la causa que Maestro escribió en `maestro.xml` y
avisa de que un `DeviceServerDiedException` es fallo del emulador y toca
relanzar. Confundir "el driver se cayó" con "el mock se rompió antes de tiempo"
es exactamente lo que un control negativo no puede permitirse.

### Dónde queda cada casilla

- **Recorrido completo verde**: bloqueado por el bug de `chat`, todavía sin
  arreglar. Dos intentos, dos veces el mismo paso 38.
- **Control negativo**: bloqueado por lo mismo aunque el emulador no falle. Con
  el compositor roto, el APK de mock se rompe también en el 38, antes del
  reinicio, y el control lo rechaza por no probar lo que dice probar. Solo puede
  dar veredicto cuando el recorrido positivo llegue al final.

Las dos casillas se cierran en el mismo run, en cuanto `chat` cierre la suya.

## Novena pasada: reintento que distingue el runner del caso (2026-09-07)

La flake del emulador tumbó **3 de los 7 trabajos** del 2026-09-07 —`device
offline`, `StatusRuntimeException: UNAVAILABLE`, `DeviceServerDiedException`—
sin relación con el código. Cada pasada devolvía menos de la mitad de la señal,
y el bloque `chat` lo señaló al final de su TODO como trabajo de `calidad`.

- [x] Reintentar el paso "UI y persistencia real" **solo** ante caídas del runner.
- [x] Clasificación con lista cerrada y tests que la fijan (`npm run test:e2e`).
- [x] Evidencia por intento, sin que un reintento pise la del anterior.
- [ ] Confirmar primer recorrido completo verde en emulador y guardar su
      evidencia. **Ya no lo bloquea `chat`**: en el mismo run la sonda del
      teclado pasa y el control negativo llega entero hasta el reinicio. Lo que
      sigue en rojo es la variante `supabase`, en "Resultado del recorrido".
- [x] Confirmar que el control negativo falla **después** del reinicio.
      Confirmado en [run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392)
      (696408a): el trabajo `mock` pasa, y solo pasa si el primer comando
      fallido está tras el `stopApp` y Postgres no tiene ni perfil ni mensaje.

### La regla, que es lo único que importa aquí

Un reintento mal puesto es peor que no tenerlo: repetiría el bug del compositor
hasta verlo verde y convertiría el E2E en un adorno. Así que va en un solo
sentido y con lista cerrada:

> se reintenta **solo** si el fallo coincide con una firma conocida de caída de
> infraestructura. Todo lo demás —incluido lo que no se sabe clasificar— tumba
> el trabajo tal cual.

Dos detalles la sostienen, y los dos tienen su caso en `e2e/triage.test.mjs`:

- Las firmas de fallo **del caso** (`Element not found`, `Assertion is false`) se
  comprueban **antes** que las de infraestructura. Si el driver se muere después
  de que el recorrido ya haya fallado, el mensaje trae las dos cosas: manda la
  aserción. Sin esto, el fallo de hoy —`Element not found: ... Enviar mensaje`—
  se reintentaría en cuanto el emulador tosiera a destiempo.
- El estado de `adb` solo decide cuando Maestro no dejó mensaje ninguno. Y *no
  saber* en qué estado está el dispositivo no cuenta como caída: sin evidencia,
  `desconocido`, y `desconocido` no se reintenta.

### Dos niveles, porque hay dos formas de caerse

| Nivel | Qué cubre | Dónde |
|---|---|---|
| `E2E_MAESTRO_ATTEMPTS` (2 por defecto) | El driver gRPC muere con el AVD vivo. Es el caso del run 34118890956: falló en 341 ms, así que repetir cuesta segundos | Bucle en `run.mjs test` |
| Segundo paso del emulador | El AVD se cae entero o no llega a arrancar; desde dentro no hay nada que hacer | `triage` decide, `journey_retry` arranca otro AVD |

`run.mjs test` escribe `verdict.json` en la raíz de la variante: historial de
todos los intentos y `outcome` del último. `triage` lo lee y expone `retry` por
`GITHUB_OUTPUT`; el paso de reintento va condicionado a eso **y** a que el
primero fallara. Sin veredicto se reintenta, y eso no es una excepción a la
regla: significa que el proceso no sobrevivió al emulador, nunca que el caso
fallara — un fallo del caso siempre deja veredicto escrito, incluso si lo que
revienta es la preparación previa a Maestro.

Los dos pasos del emulador llevan `continue-on-error`. Quien decide el color del
trabajo es `node e2e/run.mjs gate`, al final, con todos los intentos delante y
después de subir la evidencia. Un veredicto `runner` tras agotar los reintentos
falla el trabajo diciendo que no hay veredicto sobre el caso, que es distinto de
decir que el caso está mal.

### Lo demás que cambia

- **Evidencia por intento**: `e2e/artifacts/<variante>/attempt-NN/` con su JUnit,
  su volcado de Maestro, su logcat (el buffer se vacía al empezar cada intento) y
  su `run.json`. `firstFailure()` pasa a leer un intento concreto, y su
  aserción de "un único volcado" sigue teniendo sentido con reintentos.
- **Identificador nuevo por intento**: si el primero llegó a escribir medio
  perfil, el segundo no comparte nombre con él y el `.single()` de los oráculos
  sigue siendo inequívoco.
- `adb reverse --remove` deja de ir por `run()`: lanzaba desde un `finally` y
  podía tapar el error real con uno suyo.
- `timeout-minutes` de 60 a 90: caben dos emuladores.
- `npm run test:e2e` (`node --test`) entra en la matriz de CI. `run.mjs` y
  `triage.mjs` son módulos de Node del runner, no código de la app: no están en
  `testMatch` de Jest ni en `collectCoverageFrom`, así que el suelo no se mueve
  por esto.

### El suelo de cobertura sube: 88.84 / 80.24 / 89.81 / 90.28

`cfadf27` (el arreglo del compositor de `chat`) dejó la suite 0,02 puntos por
debajo del suelo anterior en sentencias y líneas. El suelo no se baja, así que se
cubre lo que faltaba, y con algo que importa: el hilo se desplaza al final cuando
le crece el contenido (`onContentSizeChange` en `src/app/chat/[matchId].tsx` es
su único disparador; sin él un mensaje nuevo aparece fuera de pantalla y parece
no haberse enviado). **Comprobado que no es un test vacío**: sustituir el
manejador por `() => {}` lo tumba. No se ha tocado código de `chat`.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre lo tocado — limpio. (`npm run format:check`
  completo falla en 34 archivos **también sin estos cambios**: es el checkout
  Windows con CRLF de esta máquina, no el repo; en CI se comprueba sobre LF.)
- `npm run test:e2e` — **22 casos en 4 suites**, todos verdes.
- `npm run test:coverage -- --ci --runInBand` — **314 tests en 29 suites**, 25
  del contrato remoto omitidos por su opt-in, cobertura 88.84/80.24/89.81/90.28
  cumpliendo el suelo nuevo.
- `node --check e2e/run.mjs` y parseo de los dos YAML con la matriz y los pasos
  esperados — correctos.
- **No ejecutado aquí**: build Android, Maestro y emulador. Este host sigue sin
  Android SDK, Java, Maestro ni Docker. Lo que el reintento hace de verdad lo
  dirá el primer run que se cruce con la flake; hasta entonces, lo verificado es
  la clasificación, que es donde estaba el riesgo.

## Décima pasada: `seekingSpecialties` entra en el E2E (2026-09-07)

`seekingSpecialties` estaba entregada por los cuatro bloques y verificada contra
Supabase real (contrato 27/27), pero `e2e/full-journey.yaml` no la mencionaba.
El recorrido pasaba por el formulario y por el deck sin preguntar ni una vez qué
debe dominar la otra persona, así que una regresión en el pegamento pantalla ↔
repositorio no la veía nadie: los 222+ tests unitarios corren contra el mock y
los de contrato hablan con Postgres sin pasar por la interfaz.

- [x] Declarar en el formulario lo que debe dominar quien busco.
- [x] Leer en la tarjeta del deck la fila "Busca" y el ✓ de complementariedad.
- [x] Releer la propia después del reinicio, que es lo que separa Postgres del
      estado en memoria.
- [x] Fijar el orden del deck, sin el cual esas aserciones no dicen nada.
- [x] Extender el oráculo de Postgres a `seeking_specialties`.
- [x] Guardia en `node --test` para que esos pasos no se puedan borrar en
      silencio.

### Los dos lados, y por qué hacen falta los dos

La feature tiene dos mitades y solo juntas prueban algo:

1. **Escribir.** El bloque "Lo que debe dominar quien busco" solo se pinta con
   `par` o `ambos` —la invariante de `Profile.seekingSpecialties`—, y el
   recorrido ya elegía `Ambos` en la primera pantalla, así que el campo existe.
   Se toca por `Busco Diseño`, el `accessibilityLabel` que puso `perfil`: por
   texto visible, "Diseño" nombra dos chips distintos del mismo formulario.
2. **Leer la de otra persona.** En la tarjeta se afirma la fila `Busca` y los
   dos ✓ —el del chip complementario y el de la cabecera—. Ese ✓ es el cruce
   entre lo que ella busca y lo que yo domino, así que el recorrido ahora
   también domina marketing: sin eso, las dos aserciones comprobarían el vacío.

Y una tercera, que es la que distingue esta feature de un estado local: tras
`stopApp` + `launchApp`, en Perfil se vuelve a ver `Diseño`. En este recorrido lo
que domino es Desarrollo y Marketing, así que esa palabra solo puede venir de
Postgres.

### El orden del deck, que era la parte que no era obvia

`discovery_deck` ordena por `created_at desc` y `supabase/seed.sql` inserta los
ocho perfiles en la misma transacción: los ocho valores son iguales y el
desempate lo elige el planificador. Mientras el recorrido solo daba `Like` daba
igual —la fixture da likes entrantes desde los ocho, así que cualquiera
correspondía—, pero afirmar qué pone en la tarjeta exige saber de quién es.

`e2e/incoming-likes.sql` separa ahora las fechas y deja arriba a Núria Bosch,
que es el orden que `src/data/mock/seed.ts` da de todas formas: las dos
variantes ven la misma tarjeta, que es lo que el control negativo necesita para
seguir fallando donde debe. Solo toca la base desechable de `e2e/.runtime`.
`verify.mjs` comprueba en Postgres que el like cayó justo en ese id: sin eso,
"Busca" y el ✓ podrían ser de una tarjeta y el like de otra.

### Casillas que se cierran, y las tres que no

- **[x] El control negativo falla después del reinicio.**
  [Run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392)
  (696408a): el trabajo `mock` **pasa**, y en esa variante el runner solo da por
  bueno el resultado si Maestro falla, si el primer comando fallido está después
  del `stopApp` y si Postgres no tiene ni el perfil ni el mensaje. Es decir: con
  el mock el recorrido llegó **entero** hasta el reinicio, envío del mensaje
  incluido. Cierra las casillas de la octava y de la novena pasada.
  Aviso honesto: eso se midió con el `.yaml` de 696408a. Los pasos que añade esta
  pasada van antes del reinicio y todavía no han visto un emulador; si alguno
  fallara ahí, el propio control lo diría y lo rechazaría.
- **[x] Estabilidad y coste de carga del test de layouts.** El traslado de la
  importación a la preparación de la suite (séptima pasada) está verificado
  aquí: `test/app/layouts.test.tsx` da 7/7 en tres ejecuciones —dos con caché
  (11,7 s y 11,1 s) y una con `--no-cache`— y el primer caso tarda **61 ms**,
  frente a los 43,8 s de antes. El coste no desaparece, se paga una vez en la
  preparación de la suite; con caché fría son ~60 s de suite para 7 casos que
  suman 148 ms. Eso era lo que se buscaba y es estable, así que la casilla se
  cierra.
- **[ ] Recorrido completo verde en emulador** (octava y novena pasada) y
  **[ ] recorrido completo verde en CI** (séptima). No se cierran, y el motivo
  ya no es `chat`: en ese mismo run la sonda del teclado pasa y el control
  negativo llega al reinicio. Lo que falla es la variante `supabase`, en el paso
  "Resultado del recorrido".
  > **CORREGIDO el 2026-09-08.** Lo que decía este punto —que el log y el
  > artefacto respondían `403 Must have admin rights to Repository` y que por eso
  > no se podía nombrar la causa— **ya no es cierto**: `gh` CLI está instalado y
  > autenticado en esta máquina (scopes `repo` + `workflow`), y tanto
  > `gh run view --job <id> --log-failed` como `gh run download` funcionan. El
  > diagnóstico dejó de estar bloqueado y está hecho: ver "Duodécima pasada".
  > El resto del punto (que esta máquina no tiene Android SDK, Java, Maestro ni
  > Docker) sí sigue siendo cierto: aquí no se reproduce nada, solo se lee.

### Encontrado y no tocado

`chat` deja apuntado que el `hideKeyboard` posterior al envío hace `pressBack()`
cuando no hay teclado, y eso navega hacia atrás en vez de no hacer nada. Es
real y es de este bloque, pero cambiarlo ahora mueve una pieza del único tramo
del recorrido que acaba de ponerse verde bajo el mock. Se toca cuando la
variante `supabase` cierre, no antes, y con la evidencia del run delante.

### Verificación de esta pasada

- `npm run test:coverage -- --ci` — **374 tests en 34 suites** (1 suite y 27
  casos del contrato remoto omitidos por su opt-in), verde con el suelo en
  89.82/82.56/91.49/91.38. No con `npx jest` a secas: el suelo solo se evalúa
  con cobertura, y saltárselo es lo que dejó CI en rojo la vez anterior.
- `npm run test:e2e` — **29 casos en 6 suites**, verdes. Los 7 nuevos son la
  guardia de `full-journey.yaml`.
- **Comprobado que la guardia no es un test vacío**: quitando del `.yaml` el
  `tapOn: 'Busco Diseño'` y el `assertVisible` del ✓ de cabecera, caen 2 casos.
- `npm run lint` y `npm run typecheck` — limpios.
- `npm run format:check` — los archivos tocados no aparecen. El comando completo
  sigue avisando de 155 archivos **también sin estos cambios**: es el checkout
  Windows con CRLF de esta máquina (`core.autocrlf=true`), no el repo.
- **No ejecutado aquí**: build Android, Maestro y emulador, por lo dicho arriba.
