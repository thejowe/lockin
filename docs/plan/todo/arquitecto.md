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
