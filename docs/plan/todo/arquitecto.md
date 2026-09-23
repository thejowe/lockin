# TODO — arquitecto

> **Estado: bloque completado (2026-09-05).** El contrato de `src/data/` queda
> **congelado**: `perfil`, `descubrir`, `chat` y `datos` construyen sobre él.
> Cualquier cambio de tipos o de firmas de repositorio debe avisarse antes,
> porque rompe pantallas de otros bloques.
>
> **Ampliado el 2026-09-07** con `Profile.seekingSpecialties` — aditivo, no
> rompe nada hoy, pero deja trabajo a `datos`, `perfil` y `descubrir`. Ver
> "Especialidades buscadas" al final de este archivo.

## Proyecto base
- [x] Scaffold Expo + TypeScript + Expo Router (SDK 57)
- [x] Eliminar el contenido de demo de Expo (pantalla "Welcome to Expo", `animated-icon`, `web-badge`, `hint-row`) una vez sustituido por el shell real

## Sistema de diseño
- [x] Sustituir `src/constants/theme.ts`: colores de marca (latón / grafito-salvia / verde-azulado, claro y oscuro — ver `docs/plan/CONCEPTO.md`)
- [x] Cargar tipografías Fraunces / IBM Plex Sans / IBM Plex Mono (`expo-font` + `@expo-google-fonts/*` o Google Fonts)
- [x] Escala tipográfica y espaciado consistente (reusar `Spacing` existente o redefinir)

## Navegación
- [x] Grupo de rutas `(onboarding)`: selección de modo → formulario de perfil
- [x] Shell de tabs: Descubrir / Matches / Perfil (sustituir Home/Explore actuales)
- [x] Ruta `chat/[matchId]` fuera de las tabs

## Capa de datos
- [x] Definir tipos: `Profile`, `Mode` (`par` | `lockin`), `Match`, `Message`
- [x] Definir interfaz de repositorio (p. ej. `ProfileRepository`, `MatchRepository`, `MessageRepository`)
- [x] Implementación mock en memoria con datos de ejemplo mínimos
- [x] Punto único de acceso (p. ej. `src/data/index.ts`) que expone la implementación activa — para que `datos` pueda sustituirla por Supabase sin tocar pantallas

## Entrega
- [x] Confirmar que `npx expo start --web` levanta sin errores
- [x] Dejar constancia (en este archivo y avisando en el chat) de cuándo el contrato de `src/data/` queda congelado — los demás bloques dependen de que no cambie sin avisar

---

## Qué quedó montado

### Sistema de diseño — `src/constants/`
- `theme.ts`: `Colors` (claro/oscuro con los cinco tokens de marca más superficies,
  texto secundario, bordes y variantes suaves de cada acento), `Typography`
  (escala cerrada de 12 roles), `FontFamily`, `Spacing`, `Radii`, `Duration`.
  Ningún componente debe declarar un color literal: si falta un token, se añade aquí.
- `fonts.ts`: mapa que carga `src/app/_layout.tsx` con `expo-font`.
- `ThemedText` consume `Typography` — usa `<ThemedText type="label">` etc.,
  no `fontSize` sueltos.

### Navegación — `src/app/`
```
_layout.tsx            Stack raíz: fuentes, tema, DataProvider, GestureHandlerRootView
index.tsx              Puerta: pregunta a la capa de datos y redirige a /mode o /discover
(onboarding)/mode.tsx          → perfil
(onboarding)/profile-form.tsx  → perfil
(tabs)/discover.tsx            → descubrir
(tabs)/matches.tsx             → chat
(tabs)/profile.tsx             → perfil
chat/[matchId].tsx             → chat
```
Las tabs nativas viven en `src/components/app-tabs.tsx` (SF Symbols en iOS,
Material Symbols en Android — sin assets propios) y la variante web en
`app-tabs.web.tsx`.

### Capa de datos — `src/data/`
| Archivo | Qué es |
|---|---|
| `types.ts` | `Profile`, `Mode`, `Match`, `Message` y demás tipos de dominio |
| `repositories.ts` | Interfaces: `session`, `profiles`, `discovery`, `matches`, `messages` |
| `mock/` | Implementación en memoria + semillas |
| `active.ts` | **El único sitio que elige backend.** Aquí entra Supabase |
| `provider.tsx` | `DataProvider`, `useRepositories()`, `useQuery(key, run)` |
| `index.ts` | Lo que importan las pantallas: `import { ... } from '@/data'` |

Regla: las pantallas importan siempre de `@/data`, nunca de `@/data/mock`.

## Andamios que hay que retirar
- ~~`src/components/screen-placeholder.tsx`~~ — retirado el 2026-09-06.
  Era temporal: existía para que las rutas resolvieran mientras cada bloque
  sustituía las suyas. Las 6 pantallas ya son reales y no quedaba ni un import.
- ~~`src/components/themed-view.tsx`~~ — retirado el 2026-09-06 en la misma
  pasada. Andamio del scaffold de Expo: el sistema de diseño acabó siendo
  `themed-text.tsx` + los tokens de `@/constants/theme`, y las vistas pintan su
  fondo con `useTheme()`. Cero referencias en `src/`, `app/` y `test/`.
- Los perfiles semilla de `src/data/mock/seed.ts` son 3, el mínimo para que el
  shell enseñe algo. `perfil` es el dueño del catálogo: amplía esa lista hasta
  los 6-8 perfiles, sin crear otra aparte. `SEED_RECIPROCAL_IDS` marca quién da
  match recíproco.
- ~~`src/components/ui/collapsible.tsx`~~ — retirado por `calidad` el 2026-09-06.
  No lo importaba nadie. Con él desaparece el único uso de `expo-symbols` en el
  código: **queda decidir si se quita la dependencia de `package.json`**. Es tuya
  esa llamada — puede que la quieras para los iconos de las tabs nativas.

## Archivos tocados fuera del alcance declarado
Se avisa por si choca con otra sesión:
- `src/components/themed-text.tsx`, `src/components/app-tabs.web.tsx`,
  `src/hooks/use-theme.ts`, `src/global.css` — primitivas compartidas del
  scaffold; sin actualizarlas el sistema de diseño quedaba a medias.
- `src/hooks/use-color-scheme.web.ts` — la detección de hidratación usaba un
  `setState` dentro de un efecto, que el lint de React marca como error. Ahora
  usa `useSyncExternalStore`; el comportamiento es el mismo.
- `eslint.config.js` + devDeps de ESLint — los creó `npx expo lint` al ejecutarlo
  para validar este bloque. **Es territorio de `calidad`**: quédatelo y amplíalo
  (Prettier, reglas propias, CI) o rehazlo, pero no lo dupliques.

## Verificación hecha
- `npx tsc --noEmit`: limpio.
- `npx eslint src`: 0 errores, 0 avisos.
- `npx expo export --platform web`: 14 rutas generadas sin errores.
- `npx expo start --web`: levanta sin errores; `/`, `/discover`, `/matches`,
  `/profile`, `/mode`, `/profile-form` y `/chat/[matchId]` responden 200, y el
  HTML servido lleva ya los colores de marca y las `@font-face` de Fraunces e
  IBM Plex.
- Capa de datos: 23 comprobaciones de comportamiento sobre el mock (onboarding,
  filtrado del deck por modo, pass, like recíproco, lista de matches con
  contraparte resuelta, mensajería y suscripciones) — todas en verde. Se hicieron
  con un script desechable: los tests de verdad son de `calidad`.

---

## Reportado por `calidad` (2026-09-05) — contraste de la paleta

`src/constants/theme.test.ts` mide el ratio WCAG de cada par de tokens que la app
usa de verdad. Casi todo cumple AA. Estos cuatro pares no, y el arreglo es una
decisión de paleta, no de una pantalla:

| Par | Claro | Oscuro | Umbral | Dónde se ve |
|---|---|---|---|---|
| `textMuted` sobre `background` | 3.42 | 4.84 | 4.5 | metadatos, marcas de tiempo |
| `textMuted` sobre `backgroundElement` | 3.14 | 4.26 | 4.5 | placeholder y contador de campo |
| `border` sobre `background` | 1.28 | 1.53 | 3 | borde de tarjeta y de campo |
| `border` sobre `backgroundElement` | 1.17 | 1.34 | 3 | separador dentro de tarjeta |

- [x] **`textMuted` — decidido (2026-09-06): en claro se retira el tercer nivel.**
      Se comprobó numéricamente que no hay salida: para llegar a 4.5:1 sobre la
      superficie más oscura, `textMuted` tiene que caer en torno a `#646F60`, que
      queda a 1.17 de `textSecondary` — la misma tinta a ojo. Subir las dos
      superficies tampoco abre hueco (se probaron tres pares, ninguno pasa). Así
      que en claro `textMuted` vale `#5A6459`, igual que `textSecondary`: 5.38 y
      4.93, ambos AA. En oscuro el tercer nivel sí cabe y se conserva,
      `#7D8874` → `#828D79`: 5.17 y 4.56, manteniendo la separación con
      `textSecondary` (1.47, frente a 1.57 de antes). El token sigue existiendo en
      los dos temas para que ninguna pantalla tenga que ramificar por tema.

- [x] **`border` — decidido (2026-09-06): no aplica, no es deuda.**
      El planteamiento original era demasiado amplio. La regla WCAG 1.4.11 cubre
      los componentes de interfaz cuyo límite hace falta para identificarlos: el
      borde de una tarjeta es decoración y está exento, y los campos del
      formulario se identifican por su etiqueta visible permanente
      (`src/features/profile/controls.tsx`), no por el trazo. De los cuatro pares
      reportados, los dos de `border` no aplicaban. No se cambia ningún color.
      Si algún día un control depende solo del borde para distinguirse, ese
      control sí entra en la lista.

Con las dos decisiones aplicadas, `KNOWN_GAPS` en `theme.test.ts` queda vacío:
los dos pares de `textMuted` subieron a `AA_PAIRS` y los dos de `border` se
retiraron por no aplicar. El razonamiento completo vive en el comentario de
`KNOWN_GAPS`, para que quien lo lea dentro de un año no lo reabra sin contexto.

**Ya arreglado por `calidad`:** `brassSoft` claro pasa de `#F0E3C9` a `#F2E5CB`
(el chip de marca seleccionado estaba en 4.44:1, a un pelo de AA). Es el mismo
color a ojo y no toca ninguno de los cinco literales de marca de `CONCEPTO.md`.

## Limpieza de código muerto y cobertura (2026-09-06)

Pasada delegada por `calidad` desde su quinta ronda ("Siguiente hueco de
cobertura"): borrar archivos de este alcance no le tocaba a ella con otra
sesión trabajando en paralelo.

Retirados `screen-placeholder.tsx` y `themed-view.tsx` (anotado arriba). Se
confirmó a mano que no quedaba ni una referencia en `src/`, `app/` ni `test/`
antes de borrar: los únicos aciertos del grep eran sus propias definiciones,
artefactos de `coverage/` y estas notas.

**`src/hooks/use-color-scheme.ts` no se toca.** Sale al 0 % en la misma lista,
pero no está muerto: `use-theme.ts` lo importa y `test/app/layouts.test.tsx` lo
mockea. Es cobertura ausente, no código muerto — el 0 % viene de que todo lo
que lo consume lo hace a través de un mock. Borrarlo rompería la app.

### Decidido — cobertura de `app-tabs`

`calidad` propone eximir `app-tabs.tsx` y `app-tabs.web.tsx` porque son
"configuración declarativa de NativeTabs; probarlos cuesta más de lo que
protege". El veredicto se parte: comparten nombre pero no son el mismo caso.

- [x] **`app-tabs.tsx` — exento, se compra el argumento.** Es JSX declarativo
      sin una sola rama; la única expresión es `Colors[useThemeName()]`, y
      `use-theme.ts` ya está al 100 %. Probarlo obliga a mockear
      `expo-router/unstable-native-tabs` entero y después afirmar sobre los
      props que reciben los mocks: el test sería una transcripción del JSX y
      rompería al renombrar un SF Symbol sin que nada se hubiera roto de
      verdad. Lo que sí importa —que las rutas `discover` / `matches` /
      `profile` existan y resuelvan— ya lo cubre `npx expo export` con sus 14
      rutas. Exento a propósito, no por olvido.

- [x] **`app-tabs.web.tsx` — NO exento; tiene lógica real.** No es declarativo.
      `TabButton` ramifica dos veces sobre `isFocused` (el `backgroundColor` de
      la pastilla y el `themeColor` del label) y lleva un
      `hitSlop={{ top: 8, bottom: 8 }}` que es una decisión de accesibilidad
      deliberada y comentada: la pastilla mide 28 px de alto y el hitSlop la
      lleva al objetivo mínimo de 44. Eso es justo lo que una regresión
      silenciosa se lleva por delante, y se prueba con RNTL sin mockear nada
      exótico. Detalle de resolución para quien lo escriba: bajo el preset
      `jest-expo` de este repo ganan las extensiones nativas, así que el test
      tiene que importar `@/components/app-tabs.web` explícitamente —
      `@/components/app-tabs` a secas resuelve al `.tsx`. Escribirlo cae en
      `test/`, que es alcance de `calidad`, no de este bloque.

### Efecto en cobertura

Las cuatro métricas suben y ninguna baja. El numerador es idéntico antes y
después: solo encogió el denominador, que es exactamente lo que tiene que
pasar al borrar código muerto.

| Métrica | Antes | Ahora |
|---|---|---|
| statements | 87.52 (821/938) | **88.00** (821/933) |
| branches | 78.87 (448/568) | **79.15** (448/566) |
| functions | 87.73 (286/326) | **88.27** (286/324) |
| lines | 88.76 (727/819) | **89.31** (727/814) |

**Para `calidad`:** el `coverageThreshold` de `jest.config.js` sigue clavado en
el suelo viejo (87.52 / 78.87 / 87.73 / 88.76). Pasa, porque es un suelo, pero
por vuestra propia regla ("se sube cuando la cobertura suba") toca subirlo a
los números de arriba. No se toca aquí: `jest.config.js` es vuestro y estáis
en paralelo montando el E2E. Ojo también con `coverage/coverage-summary.json`,
que está obsoleto — `json-summary` no está en `coverageReporters`, así que ese
archivo no lo regenera `npm run test:coverage` y todavía lista los dos
componentes borrados. El fresco es `coverage-final.json`.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npm run test:coverage -- --ci --runInBand` — **307 tests en 28 suites**, los
  mismos de antes (25 omitidos por el opt-in del contrato remoto).
- `npx expo export --platform web` — **14 rutas**, las mismas de antes.

**Cerrado el 2026-09-06** en `src/components/app-tabs.web.test.tsx` (6 tests):
las dos ramas de `isFocused` en los dos sitios donde decide, el `hitSlop` de las
tres pastillas y la paleta oscura. Se comprobó que no son tests vacíos mutando
el componente: quitar el `hitSlop` tumba 1 test, fijar el fondo a `transparent`
tumba 3. Vive en `src/components/` y no en `test/` porque solo `src/app/` es
raíz de expo-router — el aviso de `calidad` sobre arrastrar RNTL al bundle no
aplica aquí. La trampa de resolución que avisabas es real: el import es
`@/components/app-tabs.web` explícito. `jest.mock` se iza por encima de los
imports, así que la fábrica usa alias `mockCloneElement` / `MockView` en vez de
`require()`, que el lint prohíbe.

---

## Especialidades buscadas — `seekingSpecialties` (2026-09-07)

Primera ampliación del contrato **después** de haberlo congelado. Se avisa aquí
porque `perfil`, `descubrir` y `datos` construyen sobre `src/data/`: el cambio
es aditivo y no rompe nada suyo hoy, pero les deja trabajo.

### Qué se añadió

- [x] `Profile.seekingSpecialties: Specialty[]` — lo que la persona quiere que
      **domine la otra**, frente a `specialties`, que es lo que domina ella.
- [x] `ProfileInput.seekingSpecialties?: Specialty[]` — opcional, igual que
      `avatar` y por el mismo motivo (ver más abajo).
- [x] Propagado a los ocho perfiles de `src/data/mock/seed.ts`.
- [x] Propagado a `src/data/test-fixtures.ts`.
- [x] Dos casos nuevos en `src/data/repositories.contract.ts`.
- [x] `src/data/mock/index.ts`: `saveCurrent` guarda `[]` si no se envía.
- [x] `src/data/supabase/mappers.ts`: tapado con `[]` y un `TODO(datos)`.

### Las dos decisiones que había que tomar

**1. Va siempre vacío cuando `lookingFor` es `'lockin'`.** Escrito en el JSDoc
de `types.ts`. Un compañero de lock-in se elige por franja horaria y compromiso
con la sesión — cada uno trabaja en lo suyo, así que no hay complementariedad de
skills que declarar. Con `'par'` o `'ambos'` sí puede llevar valores.

Corolario: el array vacío tiene **dos** lecturas según el modo. En `lockin` es
«no aplica»; en `par`/`ambos` es «me da igual, ábreme a cualquiera». Nunca es
«no busco a nadie». El catálogo seed cubre los dos casos a propósito — Alba y
Tomás son `lockin` con `[]`, y Omar es `ambos` con `[]` — para que nadie que lea
los datos de ejemplo se lleve una sola de las dos lecturas.

La invariante **no la fuerza el repositorio**: la mantiene quien escribe el
perfil (formulario o seed). Meter la validación en el repositorio significaría
que el mock y Supabase tienen que coincidir en una regla de producto que hoy no
tiene ninguna pantalla detrás; cuando `perfil` construya el campo, el sitio
natural para exigirla es el formulario. `buildProfile`/`buildProfileInput` sí la
aplican solos (`withSeekingRule` en `test-fixtures.ts`), porque el caso típico
de un test es `buildProfile({ lookingFor: 'lockin' })` y ahí el campo es relleno.

**2. Opcional en `ProfileInput`, obligatorio en `Profile`.** El contrato de
lectura queda firme: toda pantalla que pinte un perfil recibe el array, aunque
sea vacío, y no tiene que ramificar por `undefined`. El de escritura es
tolerante, exactamente como ya lo era `avatar`: un formulario que todavía no
pregunta por el campo no se inventa un valor, y el repositorio guarda `[]`.

Esto es lo que permite cumplir el encargo de no tocar `src/features/**`: con el
campo obligatorio en `ProfileInput`, `src/features/profile/profile-form.tsx:151`
dejaba de compilar y había que entrar en territorio de `perfil`.

### Y el principio innegociable

`seekingSpecialties` es simétrico: las dos personas de un match lo declaran y
ninguna «ofrece» nada a la otra. Eso es complementariedad, no una vacante. El
JSDoc lo dice explícitamente y prohíbe lo que lo convertiría en Modo Talento:
nada de sueldo, equity, seniority ni número de puestos, y nada de renombrarlo a
`role` o `hiringFor`.

### Lo que queda, y de quién es

- **`datos`** — la columna `seeking_specialties` no existe en
  `supabase/migrations/`, que es alcance suyo y estaba fuera del encargo. Hoy
  `toProfile` devuelve `[]` y `toProfileInsert` descarta el campo: **contra
  Supabase el dato se pierde al guardar**. Está marcado con `TODO(datos)` en
  `mappers.ts`, y el caso «guarda seekingSpecialties tal y como se envía» del
  contrato **falla contra Supabase a propósito** hasta que exista la columna. Es
  el aviso, no un descuido: sin ese test en rojo la pérdida de datos sería muda.
  La suite remota es opt-in (`LOCKIN_SUPABASE_CONTRACT=1`), así que ni `npm test`
  ni CI se ven afectados — pasa de 25 casos a 27, con 2 en rojo.
- **`perfil`** — el formulario y la ficha de perfil. Mientras no lo construya,
  todo perfil creado desde la app nace con `[]`.
- **`descubrir`** — cualquier uso en el deck. `ProfileFilter.specialties` se
  dejó como estaba: filtra por lo que el otro **domina**. Un filtro sobre lo
  buscado sería un campo distinto del filtro, y eso hay que hablarlo antes.

### Verificación de esta pasada

- `npx tsc --noEmit` — limpio (exit 0).
- `npm run lint` — limpio.
- `npm test -- --ci --runInBand` — **322 pasados, 30 suites**; 27 omitidos, que
  son los 25 del contrato remoto más los 2 nuevos.
- Prettier — los seis archivos tocados salen conformes. Ojo: `npm run
  format:check` falla en este checkout de Windows **antes y después** del
  cambio (34 archivos en `HEAD`, 29 después), porque el árbol de trabajo está en
  CRLF y `.prettierrc` pide `endOfLine: "lf"`. Es artefacto de `core.autocrlf`,
  no del contenido; en CI (Linux) no se da.

### Aviso para `calidad` — el suelo de cobertura ya estaba en rojo

`npm run test:coverage` no pasa, y **no es por este cambio**. En `HEAD`
(`696408a`) da 88.72 / 80.24 / 89.32 / 90.22 contra un suelo de
88.87 / 80.24 / 89.84 / 90.31: tres métricas por debajo. Este cambio las **sube**
a 88.80 / 80.24 / 89.39 / 90.31 (líneas vuelve a cumplir), porque los dos casos
nuevos del contrato ejecutan más de `repositories.contract.ts`. Sigue faltando
en sentencias y funciones. No se ha tocado `jest.config.js`: es vuestro, y
bajar un suelo para dejar pasar un cambio va contra vuestra propia regla — lo
que toca es cubrir lo que entró con `696408a`.

## Recuperación del perfil al reabrir (2026-09-16)

- [x] La ruta inicial muestra un error recuperable y permite reintentar si falla `isOnboarded`, en lugar de enviar al usuario al onboarding.
- [x] `ensureUserId` y `currentUserId` propagan errores de recuperación de sesión; un error de renovación no inicia otra cuenta anónima.
- [x] Regresiones automatizadas para sesión guardada, error de renovación y reintento desde la ruta inicial.
- [ ] **[comprobador]** Verificar en el emulador Android con Supabase real (antes: en el Expo Go del usuario): cerrar por completo (`am force-stop`) y reabrir con el mismo perfil. La causa concreta en ese dispositivo no se ha confirmado; estos cambios corrigen dos fallos comprobados del arranque.

Validación: `typecheck` detecta errores ajenos a este cambio en la integración de GitHub: faltan `verifyGithub`/`unverifyGithub` en `src/data/supabase/index.ts` y `githubVerification` en `mappers.ts`. Esos archivos no se han modificado.
Las 6 pruebas de `test/app/index.test.tsx` y `src/data/supabase/auth.test.ts` pasan (2 suites).

## Saneamiento de arquitectura (auditoría del 2026-09-17)

Dos de los siete hallazgos de la auditoría del 2026-09-17 son de este bloque. La
orden completa —alcance de archivos cerrado, criterio de terminado y en qué ola
va— está en `docs/plan/ordenes-arquitectura.md`; aquí solo se marca el estado.
**Lee la orden antes de tocar nada**: `A1` cambia la API que consumen todas las
pantallas, así que no es un cambio local por mucho que lo parezca.

### Orden `A1` — `useQuery` y el arranque del backend (Ola 1) — **[Claude]**

- [x] **Hallazgo 3: `useQuery` publica `data: null, loading: true` en cada relectura.** `src/data/provider.tsx` no tenía caché, ni deduplicado, ni coalescencia de peticiones. El parpadeo que provocaba ya causó un fallo real de E2E, y el codebase **estaba esquivando la abstracción**: dos copias del mismo hook, `src/features/chat/use-conversation.ts` y `src/features/session/use-resolved-or-previous.ts`, con sus propios comentarios pidiendo borrarlas cuando esto se arreglara
- [x] **Hallazgo 5: cambio silencioso de backend.** `src/data/active.ts` evaluaba `hasSupabaseCredentials ? supabase : mock` **al cargar el módulo**. Una build de producción con el entorno mal configurado no fallaba: publicaba una app llena de perfiles de seed que parecía funcionar perfectamente
- [x] Borradas las dos copias de `useResolvedOrPrevious`. `grep -r "useResolvedOrPrevious" src/` no devuelve nada

### Cómo quedó `A1` (2026-09-17)

**Hallazgo 3 — `useQuery` con retención, `refreshing` y una petición por `key`.**

`QueryState` gana un campo: `loading` es ahora "no hay dato todavía" (primera
carga) y `refreshing` es "hay dato de antes y se está releyendo por encima". Las
pantallas que hacen `loading && !match` siguen funcionando sin tocarlas, porque
en la primera carga `loading` sigue siendo cierto y `data` sigue siendo `null`.

Cuatro decisiones que conviene no deshacer sin leer esto:

1. **Lo resuelto se guarda etiquetado con su `key` y su `requestKey`, y es el
   render el que decide si sirve.** Así no hay que ajustar estado durante el
   render (lo que hacían las copias) ni hace falta un `useEffect`, que llegaría
   un render tarde: ese render tardío era justo el que desmontaba el compositor
   y cerraba el teclado de Android. No existe ningún render intermedio con
   `data: null`, y hay un test que lo comprueba render a render.
2. **La retención no cruza el cambio de `key`.** Las copias sí lo hacían (solo
   miraban `data`/`loading`), y eso enseñaba el perfil de Ana en el chat de
   Bruno durante la carga. `use-session-room.ts` depende de ello: su `key` pasa
   de `match:ninguno` a `match:<id>` cuando resuelve la sesión.
3. **Un fallo no deja dato que retener.** El reintento vuelve a ser una primera
   carga (`loading: true`, `error: null`), no una relectura con el hueco de la
   petición que falló. Sin esto, `test/app/index.test.tsx` se iba a `/mode` al
   pulsar Reintentar: veía `data: null` con `loading: false` y `error: null`, y
   lo leía como "no hay onboarding".
4. **El `nonce` y la petición en vuelo se comparten por `key`**, en un registro
   particionado por juego de repositorios (`WeakMap<Repositories, …>`). Por eso
   `useConversation` y la tarjeta de sesión, que piden `profile:current` por
   separado en el mismo commit, hacen una sola lectura; y un `refresh` de
   cualquiera relee para todos. La partición por repositorios es lo que evita
   que dos árboles con `DataProvider` distintos —dos tests, o la app y un
   Storybook— se pasen datos de un backend al otro. La entrada se borra cuando
   se desmonta su último lector: nada sobrevive a la pantalla que lo pidió.

**Hallazgo 5 — el backend ya no cambia en silencio.** `active.ts` exporta
`backend: 'supabase' | 'mock'` y, si `__DEV__ === false` y faltan credenciales,
lanza al cargar el módulo nombrando las que faltan y explicando que las
`EXPO_PUBLIC_*` se inlinean en tiempo de build. En desarrollo el respaldo al
mock sigue igual. Un `console.info` al arrancar dice qué backend está activo
(se calla bajo Jest, donde lo importa cada archivo de suite y no aporta nada);
se ve en la salida de `npx expo export`. La forma de `Repositories` no cambia.

**Lo que se borró.** `src/features/session/use-resolved-or-previous.ts` entero, y
la función privada del final de `use-conversation.ts` con su comentario de "esto
es de `arquitecto`". Los cinco consumidores (`use-conversation.ts`,
`use-active-session.ts`, `use-rating.ts`, `use-session-room.ts`) leen ya
`query.data` directamente.

Validación: `typecheck` y `lint` limpios; `npm run test:coverage -- --ci
--runInBand` en verde (65 suites, 715 tests) sin tocar `jest.config.js`;
`npx expo export --platform web` genera sus 15 rutas. 17 casos nuevos en
`src/data/provider.test.tsx` y `src/data/active.test.ts`.

#### Aviso para `calidad` — el suelo de cobertura está muy por debajo de lo real

`jest.config.js` pide 89.82 / 82.56 / 91.49 / 91.38 y la suite mide ahora
**93.58 / 87.56 / 92.76 / 95.38** (`data/` al 99.02 / 97.24 / 97.88 / 99.69, con
`provider.tsx` al 100 en las cuatro). Es vuestro archivo y la orden `A1` dice
explícitamente que no lo toque: ponedlo al día en `C1`.

#### Ojo con `act()` en RNTL 14

`rerender` y `unmount` de `renderHook` son **asíncronos**, igual que `render`.
Sin `await`, dejan un `act()` abierto que se cuela en los tests siguientes del
mismo archivo: el síntoma es "You seem to have overlapping act() calls" y un
`result.current` que se queda en `null` hasta que `waitFor` agota su espera, en
un test que pasa perfectamente si se corre solo. Costó un buen rato en
`provider.test.tsx`.

### Orden `A2` — estado mutable de módulo (Ola 3)

Sin etiqueta de herramienta **a propósito**: está bloqueada por las olas 1 y 2.

- [x] **Hallazgo 7.** `src/data/mock/store.ts` guarda un `state` a nivel de módulo, y la implementación de Supabase mantiene listeners, canales y un `emittedLocally` con tope de 256 y desalojo FIFO (`src/data/supabase/index.ts:91-110`). Ese deduplicado es best-effort **por construcción**: una cuenta activa puede desalojar un marcador antes de que llegue su eco, y ahí empieza una tormenta de relecturas duplicadas. `DataProvider` sugiere que los repositorios son inyectables, pero son singletons creados al importar

#### Lo que rompió `A1` en CI, y cómo quedó (2026-09-17)

`A1` se entregó con dos jobs rojos. Los dos eran suyos y se cerraron antes de
empezar `A2`:

- **Formato.** `use-active-session.ts` y `use-session-room.ts` se quedaron con
  una línea en blanco de más donde estaba el import del hook borrado. En esta
  máquina `format:check` da ~100 falsos por CRLF, así que el veredicto bueno es
  el del job de Actions: nombra exactamente esos dos archivos.
- **Export web.** La guarda del hallazgo 5 se evaluaba **en el cuerpo del
  módulo**, y `npx expo export --platform web` compila sin ninguna variable de
  entorno (`ci.yml:70`, job `build`, sin bloque `env:`) recorriendo los módulos
  para descubrir las rutas. Resultado: el export moría con «LockIn no puede
  arrancar sin backend» sin generar ni una ruta.

El arreglo es **perezoso, no permisivo**: `repositories`, `presence` y
`videoSignal` son fachadas de propiedades/métodos que resuelven el backend en el
primer acceso real, y es ahí donde lanza. Una build de release mal configurada
sigue reventando ruidosamente en cuanto pide un dato; el export vuelve a sacar
sus 15 rutas. `backend` pasó a ser `activeBackend()` (resuelve igual); nadie
fuera de `active.ts` y su test lo usaba. No se tocó `.github/workflows/`.

### Cómo quedó `A2` (2026-09-17)

**El estado dejó de ser del módulo y pasó a ser de la instancia.**

*Mock.* `src/data/mock/store.ts` expone `createMockStore()`, que devuelve un
`MockStore` con sus datos, su reloj (`nowMs`/`advanceClock`), su contador de ids
y sus suscriptores. `createMockRepositories(store?)` y
`createMockSessionRepository(actorId, store?)` construyen sobre el que se les
pase. Sin argumento usan `defaultMockStore`, que es lo que hace la app y sobre
lo que siguen operando `resetState()`, `advanceMockClock()` y `mockNowMs()` con
su forma exacta: la suite de contrato, las de sesiones y `CURRENT_USER_ID` no
cambian ni una línea.

*Supabase.* `createSupabaseRepositories()` crea su propio `Notifier` con los
`listeners`, los `channels` y las marcas de escritura propia. Dos instancias no
comparten nada, así que un test puede aislarlas.

**El `Set` de 256 con desalojo FIFO ya no existe.** Las marcas son ahora un
`Map<id, instante de caducidad>` con `EMITTED_MARK_TTL_MS = 30_000`: caducan
**por tiempo y solo por tiempo**, así que una ráfaga de escrituras no puede
tirar la marca de una fila cuyo eco aún viene de camino — que era justo el
mecanismo que, combinado con el hallazgo 3, produjo el incidente del chat. La
purga recorre el mapa en cada marca nueva y tira solo lo ya caducado.

**`provider.tsx` no hizo falta tocarlo.** `A1` ya lo dejó particionado por juego
de repositorios con un `WeakMap<Repositories, …>`, que es exactamente lo que
pedía el hallazgo; la parte de "singletons creados al importar" la resolvió la
fachada perezosa de `active.ts`.

#### Archivos tocados fuera del alcance declarado de `A2`

La orden listaba `src/data/mock/store.ts` y «solo el bloque de
listeners/canales/`emittedLocally`» de `src/data/supabase/index.ts`. Eso no
alcanza para lo que pide el hallazgo, porque los consumidores del estado están
en otros archivos:

- `src/data/mock/index.ts` y `src/data/mock/sessions.ts`: los repositorios eran
  constantes de módulo que llamaban a `getState()`/`notify()`/`subscribeTo()`
  directamente. Ahora se construyen dentro de la fábrica, cerrando sobre el
  store. Son archivos de `arquitecto` y no están en el alcance de ninguna orden
  de la Ola 3.
- `src/data/supabase/index.ts`: por lo mismo, los cinco repositorios se movieron
  dentro de `createSupabaseRepositories()`. `lastMessagesByMatch` y
  `resolveMatches` no tocan estado compartido y se quedaron a nivel de módulo,
  justo encima de la fábrica. **Ojo, `datos`: la orden `D3` edita este archivo y
  el contenido está reindentado un nivel.**

Sin scope creep: no se tocó `.github/workflows/`, ni `src/app/`, ni
`src/features/`.

#### Recado para `perfil` (orden `P1`)

`src/features/profile/github-verification.test.tsx:36` lleva el comentario
«`createMockRepositories()` devuelve siempre los mismos objetos de módulo». Ya
no es cierto: cada llamada devuelve objetos nuevos (los datos sí se comparten,
vía `defaultMockStore`). El test pasa igual y el `jest.restoreAllMocks()` sigue
haciendo falta, pero el porqué es otro. No lo toco: ese archivo es vuestro.

#### Verificación de esta pasada

- `npm run typecheck` y `npx eslint src --no-cache` limpios.
- `npm run test:coverage -- --ci --runInBand` en verde: 71 suites, 787 tests,
  sin tocar `jest.config.js`.
- `npx expo export --platform web` genera sus 15 rutas, y con
  `EXPO_NO_DOTENV=1` —sin ninguna credencial, como en CI— también.
- Tests nuevos: `src/data/mock/instances.test.ts` (4 casos: datos, suscriptores
  y reloj aislados, más el store por defecto que se sigue compartiendo) y
  `src/data/supabase/instances.test.ts` (3 casos: listeners y canales propios,
  marcas propias, y una ráfaga de 301 escrituras que antes habría desalojado la
  primera marca y ahora no).

#### Aviso para `calidad` — el suelo de cobertura sigue por debajo de lo real

`jest.config.js` pide **93.58 / 87.56 / 92.76 / 95.38** y la suite mide ahora
**93.94 / 87.91 / 93.64 / 95.81**. Es vuestro archivo: subidlo cuando toque.


---

## Orden `A3` — el arranque mudo y la variante `mock` del E2E (2026-09-18)

`E2E Android` llevaba rojo desde la Ola 1 en las **dos** variantes y nadie podía
leer la causa desde CI. Esta pasada arregla la variante `mock` entera (menos una
línea que es de `calidad`, abajo) y hace que la de `supabase` diga por qué falla.

### Lo hecho

- [x] **La causa deja rastro.** `useQuery` (`src/data/provider.tsx`) escribe
  `console.error('[lockin] la consulta "<key>" falló: <message>', error)` cuando
  una consulta falla, con el objeto entero y no solo el `message` — en un
  `PostgrestError` la corrección literal viene en `hint` y el código estable en
  `code`. Se calla bajo Jest, mismo criterio que el rastro de backend de `A1`.
- [x] **Y la deja en pantalla.** `src/app/index.tsx` pinta `error.message` bajo
  el texto fijo. No es decorado: el E2E sube el volcado de jerarquía de la
  pantalla (`window.xml`), así que a partir de ahora el motivo se lee ahí sin
  tener que cruzar el logcat.
- [x] **Un `run` que revienta antes de devolver promesa ya no tumba la app.**
  `fetchShared` llamaba a `run()` fuera del `try`. La fachada de `active.ts`
  resuelve el backend al leer `repositories.session`, así que sin credenciales
  lanzaba **síncronamente**, el fallo escapaba del efecto y mataba el árbol
  entero. Ahora cae en `error` como cualquier otro.
- [x] **Los fallos que no heredan de `Error` conservan su motivo.** `toError`
  traduce un objeto con `message` en vez de dejar `String(cause)` →
  «[object Object]», y guarda el original en `cause`.
- [x] **Permiso explícito para el mock en release.** `active.ts` acepta
  `EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`, y solo ese valor exacto. Sigue reventando
  quien se olvide de configurar el entorno; pasa solo quien lo escribió a mano.
- [x] Tests nuevos: 4 en `src/data/provider.test.tsx` (fallo síncrono, objeto
  con `message`, rastro en el log, `cause` conservada), 3 en
  `src/data/active.test.ts` (permiso concedido, valor aproximado rechazado,
  rastro que lo dice) y 1 en `test/app/index.test.tsx` (la causa en pantalla).

### La causa de la variante `mock`, con la evidencia delante

No era de `datos` ni de `perfil`: era mía, de `A1`. El APK del control negativo
es una release **a propósito** sin credenciales (`e2e/run.mjs`, `buildEnv`), y
la guarda de `A1` lo mata en la primera pantalla. Está escrito con todas las
letras en el artefacto `e2e-android-mock` del run 35362453233,
`attempt-01/.../logs/crash-report.txt`:

    FATAL EXCEPTION: expo-updates-error-recovery
    com.facebook.react.common.JavascriptException: Error: LockIn no puede
    arrancar sin backend: faltan EXPO_PUBLIC_SUPABASE_URL y
    EXPO_PUBLIC_SUPABASE_ANON_KEY...
        at IndexRoute (...)

Por eso Maestro moría en el comando 5 sin ver «Cofundador»: no había app. Y por
eso el control negativo no valía: `run.mjs` exige que el mock falle **después**
del reinicio («el mock falló ANTES del reinicio»), que es lo único que prueba
que las aserciones del caso positivo necesitan Postgres.

### Lo que falta y es de `calidad` — una línea en `e2e/run.mjs`

Con lo de arriba el APK ya no crashea, pero la guarda sigue negando el mock, así
que la variante seguirá roja hasta que el build del control negativo conceda el
permiso. En `buildEnv`, donde hoy pone `if (negative) return base;`:

```js
if (negative) return { ...base, EXPO_PUBLIC_LOCKIN_ALLOW_MOCK: '1' };
```

El `assert` de `build` no se entera: solo mira `EXPO_PUBLIC_SUPABASE_URL` y
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. No lo toco yo: `e2e/` es vuestro y hay sesión
abierta encima.

### La variante `supabase` sigue roja, y ahora se podrá leer por qué

El APK arranca bien (`[lockin] backend de datos: Supabase` en el logcat) y muere
en la pantalla de error de `index.tsx`: `session.isOnboarded()` **rechaza**. El
logcat del run 35362453233 no tiene ni una línea de `ReactNativeJS` que lo
explique, porque hasta hoy no había ninguna que escribir. Con el rastro nuevo,
la próxima vuelta nombra la causa en el logcat **y** en `window.xml`. Los dos
sospechosos que quedan están fuera de mi alcance —`src/data/supabase/**` y las
migraciones de `D3`—, así que no se investiga más desde aquí.

### Verificación de esta pasada

Medida sobre un árbol limpio (HEAD + solo mis seis archivos, en un clon
desechable), porque el worktree tiene trabajo sin commitear de `datos` y de
`calidad` que mueve los números:

- `npm run typecheck` y `npm run lint` limpios.
- `npx jest --coverage --ci --runInBand`: 71 suites, 795 tests, 82 saltados.
- Cobertura **93.97 / 88.02 / 93.65 / 95.83**, por encima del suelo de `calidad`
  (93.94 / 87.98 / 93.63 / 95.81). No hace falta bajar nada.
- `npx expo export --platform web` con `EXPO_NO_DOTENV=1`: 16 rutas.
