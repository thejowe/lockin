# TODO — descubrir

## Deck de swipe
- [x] Componente de tarjeta de perfil (avatar/iniciales, nombre, especialidades, qué busca, prompt destacado)
- [x] Gesto de swipe (like derecha / pass izquierda) con `react-native-gesture-handler` + `react-native-reanimated` (ya instalados por el scaffold — no añadas otra librería de swipe)
- [x] Botones alternativos de like/pass (accesibilidad — no todo el mundo usa gesto)
- [x] Feedback visual claro al soltar (etiqueta LIKE / PASS)

## Filtro por modo
- [x] El deck respeta el modo activo del usuario (Par / Lock-In / ambos)

## Matching
- [x] Lógica mock: dar like a un perfil "sembrado" como recíproco genera match
- [x] Guardar el match a través de la capa de datos de `arquitecto`

## Pantalla de match
- [x] Modal/pantalla de "¡Match!" con opción directa de ir al chat
- [x] Estado vacío del deck (cuando no quedan perfiles) con mensaje útil, no una pantalla en blanco

## Especialidades buscadas en el deck (2026-09-07)
- [x] La tarjeta separa **lo que domina** de **lo que busca**: dos filas etiquetadas con los mismos acentos que `ProfileDetails` (verde-azulado / latón). En una sola lista de chips no había forma de saber cuál era cuál, y son datos opuestos
- [x] El chip de modo pasa a neutro (`Quiere: Cofundador`): antes era verde-azulado y ahora ese acento significa «domina»
- [x] Complementariedad visible **antes** del swipe: lo que yo domino ∩ lo que esa persona busca sale en latón sólido y con "✓" delante, más un `✓ Encajas` en la cabecera. El "✓" está a propósito — el color solo no lo lee un lector de pantalla ni quien no distingue latón de latón suave
- [x] El modal de match lo nombra ("Y busca justo lo que tú dominas: …"): es el mejor icebreaker que hay y llega justo cuando se decide si abrir el chat
- [x] `src/features/discover/complement.ts` + tests. Vacío cuando el perfil es `lockin` (no se elige por skills) y cuando `seekingSpecialties` está vacío (eso es «abierto a cualquiera», no «encajas con todo»)
- [x] La pantalla lee el perfil propio solo para esto; mientras carga, la tarjeta simplemente no resalta nada

### Lo que NO se ha tocado, y por qué
**La lógica de matching sigue igual: un match es un like recíproco.** Se evaluó
resaltar la complementariedad *dentro* del match y se descartó:

- Condicionarlo rompería el contrato de `src/data/repositories.contract.ts` («un
  like recíproco crea el match») y la RPC `record_decision()` de Supabase, que
  es SQL fuera del alcance de este bloque.
- Rankear el deck por complementariedad tocaría `discovery.getDeck`, o sea
  `src/data/`. `ProfileFilter.specialties` sigue filtrando por lo que la otra
  persona **domina**; un filtro sobre lo buscado sería otro campo y lo pide este
  bloque antes de que nadie lo añada.
- La complementariedad es una señal **para quien decide**, no una puerta. Puesta
  en la tarjeta llega antes del swipe, que es donde cambia algo; puesta en el
  match llegaría cuando ya no se puede hacer nada con ella.

Si en algún momento se quiere que pese de verdad, el sitio es el orden del deck
(que la traiga `getDeck`), no el match — y hay que pedírselo a `datos`.

## Ranking mutuo (2026-09-07)

- [x] Decisión de producto y orden compartido mock/SQL documentados en el JSDoc
  de DiscoveryRepository.getDeck (trabajo transversal autorizado).
- [x] El ✓ visual sigue siendo unilateral; el ranking cruza ambas direcciones.
  El match sigue siendo exclusivamente un like recíproco.
- [x] Se conserva el catálogo elegible completo, incluidos ceros: las tres
  tarjetas visibles son solo la ventana de swipe-deck, no un top 3 del ranking.
  useDeck consume la lista local sin reordenarla durante el gesto; las decisiones
  persistidas quedan fuera de nuevas cargas. Supabase sirve 50 pendientes por
  carga; el botón de recarga permite avanzar a la siguiente al agotarla. No
  reciclamos passes ni aleatorizamos recargas. Sin nuevas decisiones, la misma
  persona sigue arriba deliberadamente: eso garantiza estabilidad.
- [x] Verificación remota tras pegar 20260907000200: **35/35** del contrato
  contra Supabase real el 2026-09-07 (53.912 s; véase datos.md).
- [x] Coverage completo en serie: 382 tests, 34 suites, suelo superado.
  Ocho casos nuevos del contrato prueban ranking, estabilidad, modo, consumo
  y match recíproco sin encaje. SQL validado localmente antes de LIMIT.

## Corrección: control negativo del E2E en rojo (2026-09-09)

`calidad` reportó (duodécima pasada, "Encontrado y no tocado") que el ranking
mutuo deja `seed-lucia` primera en el orden del mock y no estaba en
`SEED_RECIPROCAL_IDS`, así que el control negativo del E2E (mock) no podía
cerrar match y el recorrido se quedaba a medias.

- [x] `SEED_RECIPROCAL_IDS` (`src/data/mock/seed.ts`) incluye ahora
  `seed-lucia`, con comentario explicando que es por orden (ranking mutuo),
  no por modo — paralelo a lo que `e2e/incoming-likes.sql` ya garantiza en
  Postgres.
- [x] `src/data/mock/index.test.ts`, `use-deck.test.tsx`,
  `use-matches.test.tsx`, `use-conversation.test.tsx` referencian
  `SEED_RECIPROCAL_IDS` por índice/desestructuración, no por id literal:
  siguen en verde sin tocarlos (220 tests, 20 suites).
- [x] `tsc --noEmit` y `expo lint` limpios.

## «Reducir movimiento» en el deck (2026-09-23)

`swipe-deck.tsx` es el único archivo animado de la app y no consultaba el ajuste
de accesibilidad del sistema: un grep de `AccessibilityInfo` en `src/` no
devolvía nada. Quien lo tiene activado —mareo, vértigo, migraña vestibular— se
comía el deck entero animado.

- [x] `src/features/discover/use-reduce-motion.ts`: lee
  `AccessibilityInfo.isReduceMotionEnabled()` y se suscribe a
  `reduceMotionChanged`, así que el ajuste vale también si cambia con la app
  abierta. Hasta que el sistema responde se anima, que es el comportamiento de
  siempre.
- [x] Con el ajuste puesto, la tarjeta llega **al mismo estado final**: mismo
  perfil, misma decisión, mismo `onDecide` y por tanto la misma lógica de match
  aguas arriba. Lo que se apaga es solo el recorrido — la salida de pantalla
  (`withTiming`) y el rebote de vuelta al centro (`withSpring`).
- [x] Lo que **no** se apaga: el seguimiento del dedo, la inclinación y las
  etiquetas Like/Pasar. Eso es manipulación directa, no animación; quitarlo
  dejaría el gesto sin feedback y no es lo que pide el ajuste.
- [x] Los tres caminos cubiertos: botones (`swipeAway`), gesto que decide
  (`onEnd`) y arrastre corto que vuelve al centro sin decidir.

### Por qué `AccessibilityInfo` y no `useReducedMotion()` de Reanimated

Reanimated 4 ya trae el hook, y además `withTiming`/`withSpring` respetan el
ajuste por defecto (`ReduceMotion.System`: saltan al valor final). Pero:

- El mock oficial que carga `jest.setup.js` no incluye `useReducedMotion`
  (`// useReducedMotion: ADD ME IF NEEDED` en su fuente), así que usarlo sería
  una decisión de accesibilidad **imposible de cubrir con un test**, y arreglarlo
  significaría tocar `jest.setup.js`, que es de `calidad`.
- Confiar en el `ReduceMotion.System` implícito tampoco basta: la tarjeta
  saltaría a fuera de pantalla durante un frame antes de que `settle` la
  recolocara, y el comportamiento quedaría sin nada escrito que lo defienda.

El hook vive en `src/features/discover/` porque hoy es el único sitio con
movimiento. En cuanto haya una segunda pantalla animada, su sitio es
`src/hooks/` — está anotado en su propio JSDoc.

### Cómo se prueba que NO anima

El mock de Reanimated resuelve `withTiming` al instante y llama a su callback,
así que el resultado de una decisión es idéntico con y sin animación: mirando
solo `onDecide` no se distingue nada. `swipe-deck.test.tsx` envuelve ahora
`withTiming` y `withSpring` con espías (`jest.mock` local sobre el mock oficial)
y cada caso afirma las dos mitades: el resultado igual y cero animaciones
pedidas. Hay además dos casos de **control** sin el ajuste que exigen que sí se
anime — sin ellos, un deck que dejara de animar por su cuenta pasaría los ocho
casos nuevos sin probar nada.

Trampa encontrada por el camino: en RNTL 14 `render`, `renderHook` y `unmount`
devuelven promesas. Sin `await`, React avisa de `overlapping act() calls` y
`screen` se queda sin árbol a partir del segundo test del archivo.

- [x] `npm run typecheck` y `npm run lint` limpios.
- [x] `npm test -- --ci --runInBand`: 80 suites, 948 pasados, 84 saltados.
- [x] Cobertura por encima del suelo: **94.64 / 89.52 / 94.27 / 96.19** frente a
  94.36 / 89.09 / 93.94 / 95.96. `use-reduce-motion.ts` al 100 % en los cuatro.
  El suelo de `jest.config.js` **no se toca**: esa medida incluye trabajo sin
  commitear de otra sesión en el mismo árbol, y subirlo desde aquí ataría el
  umbral a algo que todavía no está en la rama. Le toca a `calidad` cuando el
  árbol esté limpio.
- [x] El veredicto de formato se lee del job «Formato» de CI: `format:check` en
  local da ~100 falsos por CRLF.

## Hallazgos del comprobador

### 2026-09-29 — ❌ el modo del match ignora el chip del deck

Backend **mock**, APK release local sobre `b27481e`. Evidencia (local,
ignorada): `e2e/artifacts/local/2026-09-29-acuerdo/`.

- Pasos: onboarding «Cofundador» (`active_mode = par`) → Descubrir → chip
  **LOCK-IN** → sale Alba Ferrer («QUIERE: COMPAÑERO DE LOCK-IN») → Like.
- Esperado: match Lock-In (Alba solo busca Lock-In y yo la encontré en el
  chip Lock-In).
- Pasó: «¡Match!» con **«MODO COFUNDADOR»**; en el chat, «MATCH DE COFUNDADOR
  · HOY» y la tarjeta del acuerdo de socios (`22-match-alba.*`,
  `23-chat-lockin.*`). Editar el perfil a «Ambos» antes del like no cambia
  nada: solo mueve `looking_for`, no `active_mode`.
- Con onboarding «Ambos» el mismo like da «MODO COMPAÑERO DE LOCK-IN»
  (`34-match-alba.*`), así que es la regla, no el gesto.
- Causa (por código): `recordDecision` usa `resolveMatchMode(effectiveMode(),
  other.lookingFor)`, y `effectiveMode()` es `session.activeMode ??
  lookingFor` — el chip del deck (`override` en `discover.tsx`) no llega.
  `record_decision` en SQL (`20260905000500_functions_and_realtime.sql`) hace
  lo mismo con `coalesce(s.active_mode, p.looking_for)`: el fallo también
  estará en Supabase (no comprobado en dispositivo contra Supabase).
- Efecto: una persona que solo quiere Lock-In acaba en un match de
  cofundador, con acuerdo de socios incluido. Salida posible: pasar el modo
  del chip a `record_decision`, o que un `looking_for` concreto de la otra
  parte gane a un `active_mode` distinto.

### 2026-09-29 — ✅ (mock) tras `9cfddac` el match nace en el modo del chip

Backend **mock** (logcat: «backend de datos: mock en memoria»), APK release
local sobre `83b338a` (incluye `9cfddac`), bundle regenerado con
`createBundleReleaseJsAndAssets --rerun` (no salió UP-TO-DATE). Evidencia
(local, ignorada): `e2e/artifacts/local/2026-09-29-modo-chip/`.

- Caso de Alba: onboarding «Cofundador» → Descubrir → chip **LOCK-IN** →
  Alba Ferrer («QUIERE: COMPAÑERO DE LOCK-IN», `36-lockin-deck.*`) → Like →
  «¡Match!» con **«MODO COMPAÑERO DE LOCK-IN»** (`37-match-alba.*`). Chat:
  «MATCH DE LOCK-IN · HOY», solo «Agendar sesión Lock-In», **sin** tarjeta de
  acuerdo de socios (`38-chat-alba.*`; «acuerdo» no aparece en el volcado).
- Control, misma sesión: chip **COFUNDADOR** → Núria Bosch → Like → «MODO
  COFUNDADOR» (`45-match-nuria.*`); chat «MATCH DE COFUNDADOR · HOY» con la
  tarjeta «Acuerdo de socios» (`46-chat-nuria.*`).
- `logcat.txt` sin errores de JS. La mitad Supabase sigue sin comprobar: el
  remoto aún no tiene `20260929000100`.

### 2026-09-30 — ✅ (Supabase real) el caso de Alba nace en Lock-In

APK release local sobre `4a698f1`, compilado con las `EXPO_PUBLIC_SUPABASE_*`
de `.env.local` y `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` (alta anónima, sin gastar
cupo de correo), con `createBundleReleaseJsAndAssets --rerun`. En logcat:
`[lockin] backend de datos: Supabase`. Proyecto `grrzmzktrhksbttpbblg`.
Evidencia (local, ignorada): `e2e/artifacts/local/2026-09-30-alba-supabase/`
(la pasada válida es `intento3/`).

- En el remoto no existe Alba Ferrer: el seed del mock no está en producción.
  La hace un perfil de apoyo anónimo, «Alba Comprob» (`d19053ca-…`,
  `looking_for = lockin`, creado por script con la clave anon), que da like
  primero a la cuenta de la app por `record_decision`.
- Pasos: onboarding «Cofundador» («Comprob AlbaSB3», `a1a876b3-…`, perfil
  `looking_for = par`) → Descubrir → chip **LOCK-IN** → pasar adwa, Video
  Comprob, Comprob Video y Verif → Alba Comprob («QUIERE: COMPAÑERO DE
  LOCK-IN», `05-alba-deck.png`) → Like → «¡Match!» con **«MODO COMPAÑERO DE
  LOCK-IN»** (`06-match.*`). Chat: «MATCH DE LOCK-IN · HOY», solo «Agendar
  sesión Lock-In», **sin** tarjeta de acuerdo («acuerdo» no sale en
  `07-chat.xml`).
- En Postgres el match `f744436a-…` tiene **`mode = lockin`**
  (`match-postgres.txt`, leído como la otra parte). Sin errores de JS en
  `logcat.txt`.
- Dos intentos anteriores se perdieron por el método, no por la app. Un
  `uiautomator dump` desfasado me hizo pasar a Alba sin verla, así que en
  `intento3` fui con captura antes de cada toque. En ese intento el orden del
  deck en pantalla coincidió con `discovery_deck(p_mode => 'lockin')` llamado
  desde un script.
- Observación sin reproducir: en el primer intento, el primer toque en
  «Pasar» justo después del onboarding abrió el teclado sobre Descubrir sin
  ningún campo visible (`07-estado.png`), y los toques siguientes cayeron en
  el teclado. Cerrándolo con BACK, el deck volvió a funcionar. No se repitió
  en los otros dos intentos.

**Limpieza.** «Alba Comprob» borró su perfil y su `user_settings`; por
cascada se fue el match (`limpieza.txt`). **Quedan** en el remoto, y solo se
quitan desde el dashboard (perfil + `auth.users`), tres perfiles anónimos de la
app: «Comprob AlbaSB» (`fa877b9b-…`), «Comprob AlbaSB2» (`8fa0c009-…`) y
«Comprob AlbaSB3» (`a1a876b3-…`). También quedan dos filas de `auth.users` sin
perfil: `4864366f-…` y `14a05a19-…` (sondas de script). Las tres cuentas de la
app dejaron decisiones «pasar» sobre perfiles reales del deck.

### 2026-09-30 — relevo del deck: fotograma con la tarjeta equivocada

Visto en el recorrido de `visual` (mock, APK nativo). `settle()` en
`swipe-deck.tsx:95-100` (de `25f71c6`) reinicia `translateX` en el hilo de UI
antes de que el commit de React retire la tarjeta decidida, y nada ordena las
dos cosas. En 3 de 4 relevos grabados sale un fotograma con la tarjeta ya
decidida de vuelta en el centro, o con la de dos puestos atrás en el sitio de
la superior. Detalle, vídeos y salidas posibles en
`docs/plan/todo/visual.md` → «Hallazgos del comprobador», 2026-09-30.

*2026-10-01, comprobador (mock, APK release sobre `692561c` = `7415e7a` en
código): ✅ el arreglo `c96c8a9` se sostiene.* Seis relevos grabados
fotograma a fotograma con `screenrecord --output-format=frames` (cada
composición de pantalla, sin pasar por H.264): like y pasar arrastrando
(750–900 ms), un fling de 250 ms, y Pasar y Like con los botones. En ninguno
vuelve la tarjeta decidida al centro ni aparece la de dos puestos atrás: la
decidida sigue su salida hasta el borde y la nueva superior queda quieta y a
tamaño completo. Detalle en `visual.md` → «Hallazgos del comprobador»,
2026-10-01 (segunda entrada).

## Corrección: el match nace en el modo del chip (2026-09-29)

- [x] [Claude] El modo con el que se decide (el del chip del deck) viaja hasta
      `recordDecision(profileId, decision, mode?)` en la interfaz, el mock y
      Supabase; sin modo, el criterio de siempre (`active_mode ?? looking_for`).
      Commit `9cfddac`. Tests que fallaban antes: contrato de `Repositories`
      (sesión par + decisión lockin → lockin, y al revés), `use-deck.test.tsx`
      (el caso de Alba del comprobador), `supabase/instances.test.ts` (argumentos
      del RPC con y sin `p_mode`) y `schema-embedded.test.mjs` en PGlite.
      Local: `tsc` 0 errores, jest `src/data` + `src/features/discover` 447
      pasados, `test:schema` 21/21.
- Migración nueva `supabase/migrations/20260929000100_record_decision_deck_mode.sql`:
  DROP + CREATE (no OR REPLACE, que dejaría una sobrecarga ambigua), con
  `p_mode public.mode_preference default null`. Los clientes ya instalados
  llaman con dos argumentos y siguen funcionando; el cliente nuevo solo manda
  `p_mode` cuando hay modo, así que también funciona contra un remoto sin la
  migración (con el bug viejo).

### Pendiente del usuario

- [x] Aplicar `20260929000100_record_decision_deck_mode.sql` en
      `grrzmzktrhksbttpbblg`. **Aplicada el 2026-09-30 por el MCP de Supabase**
      (a petición del usuario). Verificado en remoto: `record_decision(uuid,
      decision, mode_preference)` es la única firma, SECURITY DEFINER,
      `search_path=""`, EXECUTE solo `authenticated`.
- [x] [comprobador] Tras aplicarla: repetir el caso de Alba (onboarding
      «Cofundador», chip LOCK-IN, like a Alba → «MODO COMPAÑERO DE LOCK-IN» y
      sin tarjeta de acuerdo) contra **Supabase real**, y con mock sobre un APK
      que incluya `9cfddac`. **Mitad mock ✅** (2026-09-29, ver «Hallazgos del
      comprobador»); sigue abierta por la mitad Supabase.
      *2026-09-30: mitad Supabase ✅* (APK release sobre `4a698f1`, logcat
      «backend de datos: Supabase»). Ver «Hallazgos del comprobador».
- Para `datos` (sin verificar en remoto): `20260918000100` añadió un argumento
  a `discovery_deck` con `CREATE OR REPLACE` sin borrar la firma vieja, así que
  probablemente conviven dos sobrecargas en la base. PostgREST las distingue por
  nombre de argumentos; conviene revisarlo.
