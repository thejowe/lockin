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
