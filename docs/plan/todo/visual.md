# visual — pulido visual de la app

Bloque 13 de `PLAN.md`. Agente: `.claude/agents/visual.md`. Abierto el 2026-09-29
a petición del usuario («tenemos que mejorar la parte visual de la aplicación»).
Todos los bloques de producto están cerrados; este pule lo que ya existe sin
tocar lógica ni datos.

> **2026-09-30 — rehecho desde cero.** Una primera tanda (rama
> `worktree-agent-af9a6170154931ee5`, commits `6a9462d`…`cdce4f6`) no llegó a
> fusionarse ni a subirse, y su worktree desapareció. Su rama y sus objetos ya
> no existen en ningún sitio. Este registro es el de la segunda tanda, rama
> `claude/visual-pulido`, sobre `42fa260`.

## Auditoría

- [x] **[Claude]** Auditoría visual de todas las pantallas: hallazgos
  priorizados con `archivo:línea`, capturas «antes» en web (390×844, claro y
  oscuro). Hecha sobre `42fa260` con un recorrido Playwright en mock (modo →
  formulario → deck → arrastre → match → chat → propuesta → acuerdo → Matches →
  Perfil → deck vacío → rutas inexistentes). Los números de línea son de
  `42fa260`. No se invocaron las skills de frontend en esta pasada: la
  auditoría sale de las capturas y del código.

  **Rotos (se ven mal o no se leen)**
  1. `src/components/app-tabs.web.tsx:84` — en web la barra de pestañas flota
     con `position: 'absolute'` y tapa la cabecera de cada pestaña: el
     «DESCUBRIR / Quién está» y el «Con quién has conectado» salen cortados
     por la mitad.
  2. `src/features/chat/match-row.tsx:55`, `matches-empty.tsx:32`,
     `src/app/chat/[matchId].tsx:220` — `Link asChild` en web descarta el
     `style` en forma de función del `Pressable`. La fila de Matches sale sin
     fondo ni borde y con el avatar apilado encima del nombre; «Ir a
     Descubrir» y «Volver a Matches» son texto blanco sobre el fondo claro
     (invisibles).
  3. `src/features/chat/message-bubble.tsx:42` — la hora de una burbuja propia
     va al 75 % de opacidad sobre latón: ≈3.7:1 con 12 px, por debajo de AA.
  4. `src/features/session/session-card.tsx:298` — el botón compacto de la
     tarjeta de sesión mide 40 de alto, por debajo del mínimo táctil de 44.

  **Incoherentes (cada pantalla a su manera)**
  5. Estados de carga, vacío y error: `Centered` propio en
     `src/app/(tabs)/discover.tsx:119`, en el chat y en el acuerdo, `Notice`
     en `src/app/session/[sessionId].tsx:249`, `Button` nativo de React
     Native en `src/app/index.tsx:38`. Unos con botón sólido, otros con
     enlace de texto (`src/app/agreement/[matchId].tsx:51`), huecos y tamaños
     distintos.
  6. Pantalla en blanco mientras carga: `src/app/index.tsx:20` y
     `src/app/(tabs)/profile.tsx:76` devuelven `null`. Con Supabase la
     consulta cruza la red y el blanco no distingue «tarda» de «colgado».
  7. Botones duplicados con medidas y opacidades distintas:
     `src/features/discover/action-button.tsx:49` y
     `src/features/profile/controls.tsx:385` (los dos a 52 de alto, copiados),
     `ActionButton` propio en `src/app/session/[sessionId].tsx:276`. Al pulsar
     se atenúan a 0.85, 0.7 o 0.55 según la pantalla
     (`deck-actions.tsx:94`, `controls.tsx:257`).
  8. `src/features/profile/controls.tsx:74` — la tarjeta de modo engorda el
     borde a 1.5 al seleccionarse y el contenido salta un píxel.
  9. Números sueltos: 44/48/52/88, `hitSlop` de 4/6/8, opacidades,
     `borderWidth: 2`, anchos de columna (64/132), miniatura de cámara
     (96×128), bloque del Pomodoro (32×8) y `StyleSheet.hairlineWidth` repetido
     en 20 archivos.

  **Movimiento**
  10. `src/features/discover/swipe-deck.tsx:204` — las tarjetas de detrás son
      estáticas: al salir la superior, la siguiente pega un salto de escala y
      posición en vez de avanzar.
  11. `swipe-deck.tsx:213` — la tarjeta superior no se separa de las de detrás
      (sin elevación); en claro se confunden.
  12. `src/features/discover/match-modal.tsx:50` — el match solo funde con el
      `animationType` del `Modal`: se lee como un aviso, no como un
      acontecimiento.
  13. Sin press state físico en ningún control: solo opacidad.
  14. `src/app/session/[sessionId].tsx:201` — la cuenta atrás del Pomodoro usa
      cifras proporcionales y «baila» cada segundo.
  15. `message-bubble.tsx:23` — un mensaje enviado aparece de golpe.

## Tokens

- [x] **[Claude]** Afinar `src/constants/theme.ts`: escala tipográfica,
  espaciado, radios, elevación y tokens de movimiento (duraciones, springs).
  `theme.test.ts` sigue verde con `KNOWN_GAPS` vacío. Escala tipográfica,
  espaciado y radios ya estaban bien; se añaden `Stroke`, `Control`,
  `HitSlop`, `Opacity`, `Elevation` (claro y oscuro, tinta con alfa),
  `ScrimAlpha`, `Curves`, `Springs` y `PressScale`. No hay colores nuevos.
- [x] **[Claude]** Sustituir números sueltos de estilo en pantallas por tokens.
  Solo quedan dos medidas propias de un componente, como constantes con nombre
  y comentario (`POMODORO_BLOCK`, `SELF_PREVIEW`), y los anchos de columna de la
  tarjeta (`ROW_LABEL_WIDTH`, `FACT_LABEL_WIDTH`).

## Pantallas (por impacto)

- [x] **[Claude]** Descubrir: tarjeta, deck, feedback de like/pass, modal de match.
- [x] **[Claude]** Onboarding (selección de modo, formulario) y perfil propio.
- [x] **[Claude]** Matches y chat (lista, burbujas, icebreakers, tarjeta de sesión).
- [x] **[Claude]** Sesión (Pomodoro, presencia, valoración) y acuerdo.
- [x] **[Claude]** Estados vacíos, de carga y de error coherentes en toda la app.
  Excepción consciente: las puertas del onboarding (`mode.tsx`,
  `profile-form.tsx`, `register-form.tsx`) siguen devolviendo `null` mientras
  comprueban. Es un instante entre dos pasos del mismo flujo, y un indicador
  ahí parpadearía entre pantallas.

## Movimiento

- [x] **[Claude]** Swipe con física de spring e interrupción limpia; entrada del
  match; press states. Todo respeta reduced-motion.

## Cierre

- [x] **[Claude]** `tsc`, lint, jest con cobertura sobre el suelo, export web, y
  los `e2e/*.yaml` sin textos rotos. CI verde en Actions. En local, sobre
  `1931d64`: `tsc` y lint limpios, jest con 1067 pasados y 113 saltados en 95
  suites, cobertura 95.21/90.22/94.82/96.75 (por encima del suelo), y
  `expo export --platform web` sin errores. En Actions, sobre `daa18e5`: «CI»
  ([run 36711286542](https://github.com/thejowe/lockin/actions/runs/36711286542))
  y «Schema drift»
  ([run 36711285999](https://github.com/thejowe/lockin/actions/runs/36711285999))
  en verde. «E2E Android» (registro) salió rojo en [run 36711286245](https://github.com/thejowe/lockin/actions/runs/36711286245) por un fallo real del pulido: Fabric aplanaba la vista interna de `Button` y la app se quedaba en blanco tras «Guardar y continuar». Arreglado en `a72025f`. Sobre `02bb9e3`, los tres en verde: «CI» ([run 36714020781](https://github.com/thejowe/lockin/actions/runs/36714020781), «Formato» incluido), «Schema drift» ([run 36714019745](https://github.com/thejowe/lockin/actions/runs/36714019745)) y «E2E Android» con registro, supabase y mock ([run 36714019899](https://github.com/thejowe/lockin/actions/runs/36714019899)). El job «Formato» venía rojo desde `d449df9`
  por `e2e/run.mjs`; se arregla en `daa18e5` (solo formato).
- [x] **[Claude]** Capturas «antes» (`42fa260`) y «después» en web a 390×844,
  claro y oscuro, reiniciando `expo start` antes de cada tanda: dieciséis
  pantallas del recorrido en mock, publicadas lado a lado en
  <https://claude.ai/artifact/7JBDkaztck7XPv42xnph1v> (privado; hay que
  compartirlo para que lo vea otra persona). No se commitean los PNG: son 6 MB.
- [x] **[comprobador]** Recorrido completo en el emulador (mock) con capturas
  antes/después de cada pantalla pulida. ~~Aparcada: por decisión del
  usuario del 2026-09-26 esta máquina no usa el `comprobador`.~~ **Revocado por
  el usuario el 2026-10-01: en este dispositivo sí se usa el `comprobador`**
  (anotado también en `acuerdo.md`). Al retomarla, mirar en especial el relevo del deck: la tarjeta de detrás
  avanza con el arrastre, y en el frame en que la superior se reinicia podría
  verse un salto de un 4 %.
  *2026-09-30, comprobador (mock, APK release sobre `4a698f1`): recorrido
  hecho, ❌ por el relevo del deck* — no es un salto del 4 %, es peor: un
  fotograma con la tarjeta equivocada. Dos arreglos visuales más. Detalle en
  «Hallazgos del comprobador» abajo. Sigue abierta hasta que se arreglen y se
  repita el relevo. En Android no hay «antes»: la comparación antes/después
  sigue siendo la de las capturas web.
  *2026-10-01: los tres ❌ arreglados en código (`c96c8a9`, `2e47a68`,
  `dc29e08`; detalle en «Hallazgos del comprobador» abajo).* Sigue abierta: hay
  que repetir en el emulador el relevo (grabando con `screenrecord`, varios
  swipes y también con los botones), la hoja «Proponer sesión» y los controles
  de la videollamada en claro y oscuro.
  *2026-10-01, comprobador: ⚠️ no comprobable* — el toolchain de Android
  (SDK, AVD `lockin`, JDK, `~/.gradle`) y la evidencia del 2026-09-30 han
  vuelto a desaparecer de esta máquina. Detalle en «Hallazgos del comprobador».
  *2026-10-01 (tarde), comprobador (mock, APK release sobre `692561c`, igual a
  `7415e7a` en código): ✅, cerrada.* Toolchain reinstalado. Recorrido
  completo de onboarding a deck vacío, en claro y en oscuro, y los tres
  arreglos se sostienen en el emulador: relevo sin fotograma fantasma en 6 de 6
  relevos grabados (arrastre, fling y botones), hoja «Proponer» fuera de la
  barra de estado, y controles de la videollamada dentro de su caja. El «antes»
  sigue siendo el de las capturas web. Detalle en «Hallazgos del comprobador»,
  2026-10-01 (segunda entrada).

## Hallazgos del comprobador

### 2026-09-30 — recorrido completo en el emulador (mock)

APK release local sobre `4a698f1`, x86_64, compilado con
`EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun`. Logcat: `[lockin] backend de datos:
mock en memoria`. AVD `lockin` (Pixel 7, 1080×2400, 412 dp de ancho).
Evidencia (local, ignorada; los PNG no se commitean):
`e2e/artifacts/local/2026-09-30-visual/`. Los vídeos del relevo se grabaron con
`adb shell screenrecord` y se sacaron fotograma a fotograma con ffmpeg.

**✅ Lo que se sostiene.** Onboarding: la tarjeta de modo se selecciona sin
salto (bounds iguales antes y después, anillo interior; `01-`, `02-`), y los
errores del formulario vacío salen en cada campo (`04-form-errores.png`).
Descubrir con chips y tarjeta (`06-deck.png`), el modal «¡Match!» con Lucía
(`08-match.png`), Matches (`09-matches.png`), el chat con un mensaje enviado
(`12-chat-enviado.png`), el acuerdo con una respuesta guardada
(`13-`, `15-acuerdo-guardado.png`), Perfil (`19-`, `20-`), el deck vacío
(`21-deck-vacio.png`) y la confirmación de salir de la sesión
(`26-tras-salir.png`). **Los arreglos de Fabric de `a72025f` se sostienen**:
«Crear perfil», «Abrir chat», «Agendar sesión Lock-In», «Proponer», «Ver mis
matches», «Verificar con GitHub» y «Editar perfil» se pintan con su fondo, y la
fila de match conserva fondo y borde, también pulsada: escala y oscurece sin
aplanarse (`10-fila-pulsada.png`, capturada con `input motionevent DOWN`). Sin
errores de JS en `logcat.txt`. El estado de carga no se deja ver: en el mock la
recarga es instantánea (`carga-sheet.png`), y el de error no lo pude provocar
desde la UI.

**❌ 1. El relevo del deck pinta un fotograma con la tarjeta equivocada.** Pasé
tarjetas arrastrando (`input swipe … 700–900 ms`) y grabé la pantalla. En 3 de
los 4 relevos grabados sale un fotograma suelto con una tarjeta que no toca,
entre fotogramas buenos:
- `relevo3.mp4`, f023 (t = 2,40 s): Alba ya está arriba y **Marc, al que acabo
  de pasar, vuelve un fotograma al centro** con su sombra, y luego desaparece
  (`relevo3-ghost1.png`). Lo mismo en f082 con Inés sobre Lucía
  (`relevo3-ghost2.png`).
- `relevo2.mp4`, f026 (t = 2,73 s): el caso contrario. Marc ya está arriba y
  sale un fotograma con **Alba, la tarjeta de dos puestos atrás**, en el sitio
  de la superior y a tamaño completo (`relevo2-tail.png`).

La causa, por el código (`src/features/discover/swipe-deck.tsx:95-100`):
`settle()` hace `translateX.set(0)` (se aplica en el hilo de UI) y luego
`onDecide()` (setState en JS, que quita la tarjeta en el siguiente commit de
Fabric). Nada ordena las dos cosas. Si la UI llega antes, la tarjeta decidida
vuelve al centro un fotograma y la de detrás se encoge al 96 %. Si llega antes
el commit, la nueva superior hereda el `translateX` de salida (queda fuera de
pantalla) y la de detrás, con `progress` = 1, ocupa su sitio a escala 1. Es
decir, el salto del 4 % que se temía existe, pero tapado por algo más visible.
`settle()` es del bloque descubrir (`25f71c6`), no de `c435f84`.
Salidas posibles: reiniciar `translateX`/`translateY` en un `useLayoutEffect`
que dependa de `top.id` (después del commit que retira la tarjeta), o dar a
cada tarjeta sus propios valores compartidos para que la nueva superior nazca
en 0. Aparte, la grabación no muestra ni un fotograma de la salida de 220 ms,
pero `screenrecord` en el emulador va a unos 13–20 fps, así que eso no prueba
nada.

**❌ 2. La hoja «Proponer sesión Lock-In» se monta bajo la barra de estado.** En
el APK nativo el título queda en y = 63–142, debajo del reloj
(`16-proponer.png`). En Expo Go el mismo título sale en y = 199–278
(`../2026-09-30-expo-go/15-proponer.xml`). Es el `Modal`
`presentationStyle="pageSheet"` de
`src/features/session/propose-session-sheet.tsx:62-67` con Android
edge-to-edge (`edgeToEdgeEnabled=true`): en Android, `pageSheet` ocupa toda la
pantalla y la vista no reserva el inset de arriba. Pide un `SafeAreaView` o un
`paddingTop` con `useSafeAreaInsets()`.

**❌ 3. Los controles de la videollamada desbordan su caja.** Con la cámara
concedida, la fila «Silenciar micrófono / Apagar cámara / Colgar» es más ancha
que la vista remota: «Silenciar…» se corta por la izquierda y «Colgar» por la
derecha, en claro y en oscuro (`24-sesion-video.png`, `25-sesion-oscuro.png`).
`styles.controls` (`src/features/session/video-call-view.tsx:181-186`) es una
fila absoluta sin `flexWrap`, sin `left`/`right` y sin ancho máximo, y cada
botón lleva `paddingHorizontal: Spacing.three`. En la misma captura, el texto
«No se pudo conectar el vídeo.» queda debajo de la miniatura propia (`local`,
arriba a la derecha).

**Arreglos (2026-10-01, sin probar todavía en el emulador).**
- 1 → `c96c8a9` fix(descubrir). El arrastre ya no se devuelve al centro al
  decidir. Pertenece a un *turno* (`owner`: la superior de ese render, con un
  contador que sube cada vez que cambia la superior) y la decidida se queda
  fuera marcada `exited`, que en el mismo fotograma del hilo de UI la oculta
  (opacidad 0) y sube un puesto a las de detrás. Así los dos órdenes posibles
  entre el hilo de UI y el commit de Fabric pintan lo mismo: la decidida no
  vuelve al centro y la nueva superior no hereda la salida, porque no es su
  turno. El arrastre se reinicia solo cuando el turno nuevo lo toma (al tocar o
  con los botones), en un único `runOnUI`. La de detrás deja de seguir el
  arrastre en cuanto la superior sale (antes, con `progress` = 1, ocupaba el
  sitio de la superior a escala 1). Una tarjeta que vuelve arriba (guardado
  fallido, cambio de modo) nace con turno nuevo, visible y centrada. Tests en
  `swipe-deck.test.tsx` → «SwipeDeck en el relevo» (4), con `useSharedValue`
  del mock hecho persistente entre renders en ese archivo.
- 2 → `2e47a68` fix(sesiones). La hoja suma `useSafeAreaInsets().top` solo en
  Android (en iOS `pageSheet` ya baja de la barra de estado) y el inset de
  abajo en los dos. Tests de los dos sistemas en
  `propose-session-sheet.test.tsx`.
- 3 → `dc29e08` fix(video). La fila de controles va de `left` a `right`
  (`Spacing.two`), centrada y con `flexWrap`; el botón del micro muestra
  «Silenciar» / «Activar mic» (la etiqueta de accesibilidad sigue entera y
  empieza igual que el texto visible). Con la miniatura propia en pantalla, el
  aviso se estrecha por los dos lados (96 + 2·`Spacing.two`) para no quedar
  debajo. Cuentas: «Activar mic» + «Activar cámara» + «Colgar» con su relleno
  y huecos ≈ 310 dp, por debajo de los ~380 dp de la vista en 412 dp; sin
  medir en dispositivo. Tests en `video-call-view.test.tsx`.

**Observación, sin marcar como fallo.** Con este perfil (Ambos, Desarrollo)
encabeza el deck Diego Salas, que no está en `SEED_RECIPROCAL_IDS`
(`06-deck.png`). La regla de `seed.ts` solo la fija `seed.test.ts` para el
perfil del E2E, así que puede ser lo esperado.

### 2026-10-01 — repetir los tres ❌ en el emulador: ⚠️ no comprobable (sin toolchain)

Encargo: sobre `490ccfb`, backend mock, APK release (`EXPO_NO_DOTENV=1
EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`), repetir (1) el relevo del deck grabando con
`screenrecord` swipes arrastrados de 700–900 ms y con los botones, (2) la hoja
«Proponer sesión Lock-In» fuera de la barra de estado y (3) la fila de
controles y el aviso «No se pudo conectar el vídeo.» en claro y oscuro.

No se llegó a compilar ni a instalar nada: en `DESKTOP-R6TDDTP` **no existe**
`%LOCALAPPDATA%\Android` (ni SDK, ni `adb`, ni `emulator`), ni `~/.android`
(el AVD `lockin`), ni el JDK de `%LOCALAPPDATA%\Programs\Java` (`JAVA_HOME` y
`ANDROID_HOME` vacíos, `java`/`adb`/`ffmpeg` fuera del PATH), ni `~/.gradle`,
ni el `android/` generado del repo. Tampoco queda `e2e/artifacts/` (la
evidencia del 2026-09-30 citada arriba ya no está en disco). Es la misma
limpieza externa que el 2026-09-26 (`acuerdo.md` → «Hallazgos del
comprobador»); disco con ~12 GB libres. No lo reinstalé: son varios GB y la
decisión de reinstalar es del usuario.

Los tres puntos: **⚠️ no comprobables aquí**. La casilla sigue abierta; los
arreglos `c96c8a9`, `2e47a68` y `dc29e08` solo están respaldados por los tests
de Jest. Para cerrarla hace falta reinstalar SDK + AVD `lockin` + JDK 17 +
ffmpeg (o otro dispositivo con emulador) y repetir este encargo.

### 2026-10-01 (tarde) — los tres arreglos en el emulador: ✅ (mock)

El usuario reinstaló SDK, AVD `lockin` y JDK 17.0.20 y revocó la decisión del
2026-09-26: en este dispositivo sí se usa el `comprobador`. APK release x86_64
sobre `692561c` (en `src/` igual a `7415e7a`; solo cambia `calidad.md`),
compilado con `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun` (la tarea se ejecutó, no salió
`UP-TO-DATE`). Logcat: `[lockin] backend de datos: mock en memoria`. Pixel 7,
1080×2400, 412 dp. Evidencia (local, ignorada):
`e2e/artifacts/local/2026-10-01-relevo/`.

**Cómo se grabó el relevo sin ffmpeg.** `adb exec-out screenrecord
--output-format=frames --size 216x480 -` saca un fotograma RGB888 crudo (con
cabecera de 20 bytes) por cada composición de la pantalla, sin pasar por
H.264; un script de Python los pasa a PNG y a hojas de contacto. Ojo: en este
modo `--time-limit` no corta; hay que parar con `adb shell pkill -INT
screenrecord`.

**✅ 1. Relevo del deck (`c96c8a9`).** Seis relevos, hojas de contacto en
`r1/`…`r6/`:
- `r1`: like a Marc arrastrando 800 ms (match). `relevo1-like-marc-f018-f021.png`:
  en f020 Diego ya está arriba a tamaño completo y Marc sigue saliendo por el
  borde derecho; no vuelve al centro.
- `r2`: pasar a Diego arrastrando 750 ms a la izquierda.
  `relevo2-pasar-diego-f021-f024.png`: Diego sale de forma continua y Lucía
  no se mueve hasta quedar sola.
- `r3`: botón Pasar sobre Lucía (Alba arriba en f003, limpio en f004).
- `r4`: botón Like sobre Alba (match; Inés arriba).
- `r5`: pasar a Inés arrastrando 900 ms (Núria arriba).
- `r6`: fling de 250 ms a la derecha sobre Núria (match; Omar arriba).
En ninguno sale la tarjeta decidida de vuelta en el centro ni la de dos puestos
atrás en el sitio de la superior. Límite: es un emulador x86_64 con WHPX; el
canal de fotogramas no garantiza los 60 fps (un arrastre de 800 ms dio unos 20
fotogramas), así que «sin fantasma» vale para lo grabado, que ahora son 6 de 6
relevos frente a los 3 de 4 con fantasma del 2026-09-30.

**✅ 2. Hoja «Proponer sesión Lock-In» (`2e47a68`).** El título sale en
y = 199–278 (antes 63–142, bajo el reloj), igual que en Expo Go; «Cancelar»
en y = 2169–2232, por encima de la barra de gestos. Claro (`12-proponer.png`)
y oscuro (`20-proponer-oscuro.png`).

**✅ 3. Controles de la videollamada (`dc29e08`).** Sesión con Núria
propuesta para dentro de 12 min y abierta al entrar en la ventana de 5 min;
micro y cámara concedidos. `uiautomator dump` no funciona con la cámara en vivo
(«could not get idle state»), así que medí sobre la captura: caja remota de
x = 64 a 1015; «Silenciar / Apagar cámara / Colgar» en x = 142–937; la fila
más ancha, «Activar mic / Activar cámara / Colgar», en x = 123–957; igual en
claro y en oscuro. El aviso «No se pudo conectar el vídeo.» acaba en x = 709 y
la miniatura propia empieza en 743. Capturas `23-sesion-video.png`,
`24-sesion-video-oscuro.png`, `25-sesion-mic-cam-off-oscuro.png`,
`26-salir-confirmar.png`. No demuestra la videollamada 1:1 (un solo
emulador; la cámara es la escena de juguete).

**✅ Resto del recorrido.** Onboarding (`00-`, `01-`, `02-`…`06-form*`), deck
(`09-deck.xml`), match (`10-match.xml`), chat con mensaje enviado
(`14-chat-enviado.png`), acuerdo con una respuesta guardada
(`17-acuerdo-guardado.png`), Matches (`18-`), Perfil (`19-`), salir de la
sesión → vuelta al chat (`27-tras-salir.xml`), deck vacío (`28-`), y en oscuro
deck vacío, Matches, Perfil y chat (`oscuro-tira.png`). `logcat.txt`
(`*:E ReactNativeJS:V`): sin errores de JS ni crash; solo `SoftException` no
fatales de `react-native-keyboard-controller` («Fabric View [-1] does not have
SurfaceId») al abrir cada `Modal`.

**Observaciones, sin marcar como fallo.**
- Con «Activar cámara» (cámara apagada) la miniatura propia sigue mostrando
  imagen. La escena del emulador es estática, así que no distingo un fotograma
  congelado de uno vivo; anotado en `video.md`.
- En el formulario, «28», «Barcelona» y los demás valores de ejemplo son
  placeholders: si no se escriben, «Crear perfil» no avanza y el error queda
  arriba, fuera de la vista (no hay desplazamiento al primer error). Ya visto
  en `04-form-errores.png` del 2026-09-30.

### 2026-10-03 — dirección «cristal» en el emulador (mock)

APK release x86_64 sobre `107541a`, con `prebuild --clean`,
`EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun`. En logcat sale `[lockin] backend de datos: mock
en memoria`. AVD `lockin`, 1080×2400 a 420 dpi (411×914 dp). Evidencia en
`e2e/artifacts/local/2026-10-03-visual-107541a/` (y en `…/2026-10-03-salas-107541a/`).

**✅ Esmerilado de la barra (`BlurTargetView`).** En Perfil, a mitad del
desplazamiento, el botón «Verificar con GitHub» pasa por debajo de la píldora.
Fuera, el canto del botón es nítido. Dentro sale como un degradado suave y las
letras no se distinguen. Es desenfoque de verdad, no un velo
(`08-perfil-scroll-medio.png`, `08-recorte-barra.png`).

**✅ Swipe con la pila nueva.** Arrastre sostenido con `input motionevent` a
mitad de camino. Hacia la derecha, la tarjeta gira y aparece el sello «Like»
(`02-deck-arrastre-derecha.png`); al soltar, sale «¡Match!»
(`03-deck-tras-like.png`). Hacia la izquierda, sello «Pasar» y la tarjeta de detrás
asoma con el texto oculto (`04-deck-arrastre-izquierda.png`, `05-deck-tras-pasar.png`).

**✅ Anillo del Pomodoro en una sesión activa.** Sesión 1:1 con Marc a las 11:15, de
1 bloque. Antes de empezar marca «Empieza en 4:13» con el punto arriba
(`12-sesion-sala-espera.png`). A las 11:19 marca «20:56 · Trabajo · bloque 1 de 1» y el arco
cubre ~16 % (`15-sesion-anillo-3min.png`), proporcional a lo que ha pasado del bloque. La sala usa
el mismo `PomodoroRing` y avanza igual (`…/2026-10-03-salas-107541a/20-` y `21-`).
El vídeo dice «No se pudo conectar el vídeo»: con el mock y un solo emulador no hay
par. La videollamada no queda comprobada.

**❌ La luz ambiental no llena la pantalla (todas las pantallas con `Screen`).**
Queda una franja negra de unos 56 px a la derecha (la imagen termina en x≈1024) y otra
abajo (termina en y≈2215). 1024×2215 px a 420 dpi son **390×844 dp**: el
tamaño intrínseco de `assets/images/ambient-*.jpg`, el mismo viewport del
Playwright web. En Android, el `<Image style={StyleSheet.absoluteFill}
resizeMode="cover">` de `src/components/ambient-background.tsx` se pinta a su
tamaño propio y no al del contenedor. En un dispositivo de 390×844 no se notaría;
en el Pixel 7 se ve en cada captura: `01-deck-reposo.png` (franja vertical a
la derecha de las tarjetas) y, en la carpeta de salas, `01-arranque.png`, `08-matches.png`,
`10-convocar-relleno.png` y `11-sala-abierta.png`. Medido por píxel: en y=1500
el color pasa de (43,23,14) a (10,10,11) entre x=1022 y x=1026. La barra de
pestañas queda justo sobre el borde inferior de la imagen. Sugerencia sin
probar: dar `width: '100%', height: '100%'` explícitos, o usar `expo-image` con
`contentFit="cover"`.
*2026-10-04: resuelto en `90d1d7b`, comprobado en el emulador (mock). Ver la
entrada del 2026-10-04 abajo.*

**Observaciones, sin marcar como fallo.**
- El modal de «¡Match!» en Android **no esmerila** el deck, solo lo oscurece:
  el texto de detrás se lee nítido (`03-recorte-fondo-modal.png`). Es el
  comportamiento documentado de `BlurView` sin `blurTarget` (`glass.tsx`);
  `match-modal.tsx` no le pasa ninguno. En Android, la línea «modal de match sobre
  el deck esmerilado» de la segunda pasada es un velo, no un esmerilado.
  *2026-10-04: se acepta el velo y se corrige la línea de la casilla. El modal
  de RN es otra ventana en Android y no alcanza el `BlurTargetView` del deck;
  esmerilar ahí exigiría sacar el modal a una capa propia, sin ganancia que
  compense. En iOS y web sí esmerila.*
- En el arrastre a la derecha, el sello «Like» queda en parte tapado por el
  avatar (se lee «Mike»; `02-deck-arrastre-derecha.png`). El de «Pasar», a la
  derecha del nombre, se ve entero.
  *2026-10-04: resuelto. El sello era tinte translúcido y dejaba ver las
  iniciales; ahora lleva base opaca (`surfaceOpaque`) con el tinte encima
  (`stampFill` en `swipe-deck.tsx`, test en `swipe-deck.test.tsx`). Sin
  verificar aún en el emulador.*
  *2026-10-04, comprobador (mock, `5f698db`): ❌ a mitad de arrastre. La
  base es opaca, pero la opacidad animada del sello deja ver «DS» debajo. Ver
  la entrada del 2026-10-04 «sello Like con base opaca».*
- En la pantalla de sala y en la de sesión, `uiautomator dump` falla con
  «could not get idle state» (animación continua: anillo y punto que respira).
  Maestro no espera a que la pantalla quede quieta, así que no debería afectarle, pero
  cualquier herramienta que use `waitForIdle` se quedará sin jerarquía ahí.

### 2026-10-04 — luz ambiental, pasada de contención y barra (mock)

APK release x86_64 con `prebuild --clean`, `EXPO_NO_DOTENV=1
EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y `createBundleReleaseJsAndAssets --rerun`.
En logcat sale `[lockin] backend de datos: mock en memoria`. **Árbol del bundle:**
el código de `4a95c86` más una edición de `src/app/room/new.tsx` que otro agente
tenía sin commitear (luego `e5ab495`, el scroll del selector de horas). Lo
comprobé comparando el `sourcesContent` del source map con git. Nada de eso toca lo
que se revisa aquí. Evidencia en `e2e/artifacts/local/2026-10-03-visual-90d1d7b/`.
Recorrido: onboarding (Compañero de Lock-In) → formulario → deck → Like → «¡Match!»
→ chat con mensaje → Matches → Perfil → sesión 1:1 propuesta a las 12:00, en
espera y activa.

**✅ La luz ambiental llena la pantalla (`90d1d7b`).** Ya no queda franja a la
derecha. Medido por píxel en las filas de arriba, donde la luz es más intensa: el
salto máximo entre columnas vecinas entre x=900 y 1079 es de 3 niveles en
onboarding, Descubrir y Matches. Antes era de 78 en x=1023
(`107541a/01-deck-reposo.png`). En Descubrir, a y=150, x=1040 vale (49,25,13);
antes era negro (10,10,11). En Perfil, el único salto es la barra de
desplazamiento del sistema, a x≈1068, que se desvanece. En chat y sesión, la
columna derecha sigue el degradado sin cortes. Abajo no queda borde: en x=30 el
salto entre y=1900 y 2399 es ≤6, que es el tramado. Antes era de 69 en y=2215 en
Perfil. Ver `01-onboarding-modo.png`, `07-deck.png`, `10-chat-enviado.png`,
`11-matches.png`, `12-perfil.png` y `18-sesion-anillo-3min.png`.

**✅ Pasada de contención (`6145e93`), nada roto ni ilegible.**
- Una sola luz tenue por pantalla: brasa arriba en onboarding, Descubrir, Perfil y
  sesión; verde azulado arriba a la izquierda en Matches y chat. Se acabaron las tres
  manchas: en `107541a/01-` había una verde a la izquierda.
- Sin halos. «Crear perfil» (`06-`), Like (`07-`, sin galones »»» ni resplandor
  a la derecha), la tarjeta del deck (sin el resplandor de color en la esquina),
  «¡Match!» y «Abrir chat» (`08-`), enviar (`09-`) y anillo del Pomodoro
  (`18-`). En la zona justo encima del arco, la media pasa de (31,28,25) a
  (17,17,17).
- Etiquetas de cabecera en gris: «Descubrir», «Matches», «Perfil», «Paso 1 de 2» y
  las de sección del formulario. Dentro de las tarjetas siguen con color
  «Quiere encontrar» (brasa) y «Lo que domina» (verde azulado) en Perfil (`12-`).
  Encaja con «el acento queda para señales con significado».
- Los radios se ven más contenidos: tarjeta del deck, filas y hoja de match.
  «¡Match!» sale en blanco, con «Modo Compañero de Lock-In» en verde azulado
  encima (`08-tras-like.png`).
- El anillo avanza: «Empieza en 1:05» con el punto arriba (`17-`). A las 12:03
  marca «21:45 · Trabajo · bloque 1 de 1» con el arco en ~13 % (`18-`). El vídeo
  dice «No se pudo conectar el vídeo»: con mock y un solo emulador no hay par, así
  que la videollamada sigue sin comprobar.
- Sin errores de JS en `logcat.txt`.
- No comprobado: el encaje del deck en tinta de brasa. Con el perfil en modo
  Lock-In, ninguna tarjeta mostró «Encajas».

**✅ La barra en Android, igual que antes de `5351a3f`.** `hasNativeGlass()` exige
`Platform.OS === 'ios'`, así que en Android `Frosted` sigue por `BlurView`. En el
dispositivo, con «Verificar con GitHub» entrando bajo la píldora, el canto del
botón es nítido fuera y difuso dentro. Mismo relleno, borde y resalte de la
pestaña activa que en `107541a` (`13-recorte-barra-antes-despues.png`: arriba
`107541a`, abajo ahora).

**Fila de sala de `4a95c86`:** no aparece. En este recorrido no se convocó
ninguna sala y en Matches solo está Alba (`11-matches.png`).

### 2026-10-04 — sello «Like» con base opaca (`5f698db`): ❌ a mitad de arrastre (mock)

APK release x86_64 sobre `5f698db` (HEAD no se movió durante el build), con
`prebuild --clean`, `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun` (`build.log`). En logcat sale
`[lockin] backend de datos: mock en memoria`. `pm clear` antes de empezar.
Evidencia en `e2e/artifacts/local/2026-10-04-arreglos-5f698db/`.

Pasos: onboarding «Ambos» → deck (Diego Salas arriba, avatar «DS»). Arrastre
sostenido con `input motionevent` (DOWN en 540,1250 → MOVE hasta x=820, ≈280 px,
mismo recorrido que `107541a/02-`), captura y vuelta al centro sin soltar. Luego lo
mismo hacia la izquierda (hasta x=260) y otro a la derecha más largo (hasta x=950,
pasado el umbral).

- **❌ «Like» a mitad de camino.** Se siguen viendo las iniciales bajo el sello:
  en `09-recorte-like.png` (ampliado de `09-arrastre-derecha.png`) se lee «DS»
  en gris detrás de «Like», como en `00-antes-107541a-arrastre-derecha.png`. Mejora
  algo: «Like» ya se lee entero, cosa que antes no pasaba («Mike»). Pero el avatar sigue
  asomando a través del relleno.
- **Con el arrastre largo, ✅.** En `11-recorte-like-largo.png` la base es opaca
  del todo y no asoma nada del avatar. Así que `stampFill` funciona. Lo que falla es
  la opacidad del conjunto: `likeStyle` anima `opacity: progress` en la vista que
  lleva la base opaca (`swipe-deck.tsx`, ~l. 313). A mitad de arrastre todo el sello,
  base incluida, va a ~0,5–0,7 y deja pasar el avatar. Sugerencia sin probar: animar la
  opacidad solo del tinte, el borde y el texto, y dejar la base a 1 en cuanto
  `progress > 0`. O bien sacar el sello de encima del avatar.
- **✅ «Pasar» a la izquierda.** Se ve entero y limpio (`10-recorte-pasar.png`).
  Cae a la derecha del nombre, sin nada debajo, así que esto no demuestra la base
  opaca.
- `logcat.txt`: ningún error de JS.

### 2026-10-04 — sello opaco en un tercio del umbral (`1f0b6be`): ✅ a medio arrastre (mock)

APK release x86_64 sobre `1f0b6be` (`git rev-parse HEAD` igual antes y después del
build), con `prebuild --clean`, `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun` (`build.log`). En logcat sale `[lockin] backend
de datos: mock en memoria`. `pm clear` antes de empezar. Evidencia en
`e2e/artifacts/local/2026-10-04-sello-1f0b6be/`.

Pasos: onboarding «Ambos» → deck (Diego Salas arriba, avatar «DS», `11-deck.png`).
Tres arrastres sostenidos a la derecha con `input motionevent` (DOWN en 540,1250 → 8
MOVE hasta +280, +60 y +30 px, captura y vuelta al centro sin soltar). Los recortes
de la zona del sello (`*-zona.png`) siguen a la tarjeta y están ampliados ×2.

- **✅ +280 px (el caso ❌ de `5f698db`).** En `12-recorte-280-zona.png` la base del
  sello es opaca del todo: no se ve nada de «DS» y «Like» se lee limpio.
  `16-comparativa-5f698db-vs-1f0b6be.png` lo pone al lado del recorte de `5f698db`,
  donde se leía «DS» bajo el sello.
- **+60 px (≈23 dp, opacidad ≈0,6): se mezcla.** En `13-recorte-60-zona.png` el sello
  todavía está apareciendo. «DS» se ve claro y pisa la «L» de «Like» (se lee «DSike»).
  Es el fundido de entrada, que ahora dura un tercio del recorrido de antes. Solo se
  ve si el dedo se para ahí: no lo cuento como fallo, pero el cruce de las letras
  sigue existiendo en ese tramo.
- **+30 px (≈11 dp): casi nada.** En `14-recorte-30-zona.png` solo se adivina el
  contorno del sello, muy tenue. «DS» se ve entero y nítido.
- Reposo (`15-reposo-zona.png`): sin sello. `logcat.txt` (desde los arrastres):
  ningún error de JS.

*Decisión (2026-10-04, Claude): se acepta el cruce de +60 px.* Cualquier fundido
sobre el avatar lo tiene; lo que había que evitar era el sello ilegible durante el
arrastre, y eso ya no pasa. La alternativa de verdad es sacar «Like» de encima del
avatar, que cambia la composición de la tarjeta: queda para una pasada de diseño
si alguna vez molesta, no como fallo abierto.

## Registro

Rama `claude/visual-pulido` (worktree `../lockin-visual`), sobre `42fa260`.

- `9f484c1` feat(visual): tokens de control, trazo, opacidad, elevación y
  movimiento. `useReduceMotion` pasa de `features/discover` a `src/hooks`.
- `50484be` feat(visual): `Button`, `LoadingState`/`MessageState` y
  `usePressScale` compartidos. `ActionButton`, `PrimaryButton` y
  `SecondaryButton` delegan en `Button` (mismos nombres, nadie más cambia).
- `1694846` fix(visual): barra web en flujo (hallazgo 1) y botones/filas con
  `Link` que perdían el fondo (hallazgo 2).
- `c435f84` style(descubrir): la tarjeta de detrás avanza ligada al arrastre,
  sombra `raised` en la superior, sellos Like/Pasar que crecen al aparecer,
  salida con curva `out`, botones del deck con press state, match con muelle
  `pop` y sombra `overlay`, y estados del deck con `LoadingState`/`MessageState`.
- `996f8e5` style(visual): `Stroke`, `Opacity` y `Control.minTouch` en todas las
  pantallas. La sugerencia del chat pasa de 44 justos a 48 táctiles.
- `f014075` style(estados): arranque, perfil, chat, sesión, acuerdo y callback
  de correo con `LoadingState`/`MessageState` y `Button`. Cuenta atrás con
  cifras tabulares.
- `fd3a714` style(chat): los mensajes recién llegados entran con `FadeInDown`
  (el historial no se anima); la hora propia vuelve a AA (hallazgo 3).
- `1931d64` style(onboarding): tarjeta de modo sin salto al seleccionar
  (anillo interior en vez de engordar el borde); botón de la tarjeta de sesión
  a 44.

Textos: ningún texto que busquen los `e2e/*.yaml` ha cambiado. Sí cambian dos
textos que no usa ningún flujo: la carga del acuerdo («Cargando…» →
«Cargando el acuerdo…») y la nueva carga del arranque y del perfil («Abriendo
LockIn…», «Cargando tu perfil…»), que antes eran pantalla en blanco.
Dependencias nuevas: ninguna. Todo sigue corriendo en Expo Go.

## Segunda pasada — dirección «cristal» (2026-10-03)

Pedida por el usuario: «que se parezca a la referencia (Hume), efecto cristal,
su tipografía, elegante como Apple, con motion clean». Diseño previo en el canvas
«LockIn — Rediseño» (claude.ai/artifact/8iVZPbM9CwEoq1Do7KFS4X). Decisión del
usuario por el camino: **solo modo oscuro**. Rama `claude/visual-cristal`.

- [x] Tokens: paleta única oscura con superficies de cristal en alfa, acento
  brasa `#FF8645`, Inter (300–700) con tracking negativo, radios grandes,
  `Springs.glide`, `Stagger`, `BlurIntensity`, `surfaceOpaque`, `AmbientPeak`.
  `light` es alias de `dark`.
- [x] Contraste: `theme.test.ts` compone el cristal sobre el fondo **y** sobre el
  punto más claro de la luz ambiental. 0 huecos.
- [x] Luz ambiental: `assets/images/ambient-{ember,teal,plum}.jpg` (~23 KB),
  generadas con un script de PIL (manchas con desenfoque gaussiano + tramado
  contra el banding). Si se regeneran, actualizar `AmbientPeak`.
- [x] Componentes: `AmbientBackground`/`Screen`, `Glass`/`glassStyle`/`Frosted`,
  `Icon` (juego propio sobre `react-native-svg`), `Glow`, `motion.ts`.
- [x] Pestañas: una sola barra para las tres plataformas (sustituye a
  `NativeTabs` y a la barra web): píldora de cristal flotante, resalte que se
  desliza con muelle, la activa con nombre. Etiquetas accesibles intactas.
- [x] Descubrir: tarjeta opaca con halo del color de la persona y baldosas de
  cristal; las de detrás se apagan y esconden su texto; Pasar (cristal) / Like
  (brasa con halo y galones); filtro segmentado con pastilla deslizante; modal
  de match sobre el deck esmerilado en iOS y web (en Android, oscurecido: ver
  «Hallazgos del comprobador», observaciones del 2026-10-03).
- [x] Onboarding, perfil, matches, chat, sesión: opciones con icono y radio que
  salta, foco de campo en brasa, filas y baldosas de cristal en escalera, racha
  con llama, compositor con botón redondo, anillo de Pomodoro continuo y punto
  de presencia que respira.
- [x] Dependencias nuevas (todas en Expo Go): `expo-blur` (esmerilado de barra y
  modal), `@expo-google-fonts/inter` (tipografía), `react-native-svg` (iconos,
  halos y anillo). Fraunces e IBM Plex, retiradas (`d838ef6`).
- [x] Verificado en local: `tsc`, lint, Jest con cobertura sobre el suelo y
  `expo export --platform web`; recorrido visual en web (390×844) con
  Playwright headless: modo, formulario, deck, match, chat, matches y perfil.
- [x] E2E Android en Actions, con el rediseño (runs 37150674444 y
  37154154048 sobre `claude/visual-cristal`): **pasan todos los flujos de UI**
  en las tres variantes — alta → deck → match → mensaje, sesión, valoración,
  racha, acuerdo, entrar en otra cuenta; registro con correo y entrada desde
  instalación limpia; la `mock` en verde. Para llegar ahí hubo que arreglar el
  runner, que desde el 2026-10-03 hacia las 13:20 UTC arranca con 14 GB libres
  y 7.8 GB de RAM y fallaba en todas las ramas (`e2e.yml`: liberar ~28 GB,
  swap de 4 GB, parar Gradle/Kotlin tras el build, `hide_error_dialogs` contra
  el ANR de arranque del AVD).
- [x] Pasada de contención (2026-10-04, «que no parezca diseñado con IA»): una
  sola luz ambiental tenue por pantalla en vez de tres manchas de color; fuera
  halos (`Glow` retirado), galones del Like, candado decorativo del onboarding
  e icono de expandir; etiquetas de cabecera en gris; radios contenidos (card
  30→22); el encaje del deck en tinta de brasa sobre relleno tenue; el prompt
  del perfil ocupa el hueco de la tarjeta en grande; «¡Match!» en blanco.
- [x] Oráculo final de `supabase` y `registro`: «fetch failed» en la primera
  llamada de administración a GoTrue tras el último flujo (~40 min después de
  levantar el Supabase local). Sospecha: un contenedor muerto por OOM en el
  runner de 7.8 GB. El paso «Memoria y contenedores al final» de `e2e.yml` lo
  confirmará en el próximo run. **Bloqueado**: desde el 2026-10-03 22:00 UTC
  Actions no arranca jobs en este repo privado («recent account payments have
  failed or your spending limit needs to be increased»): lo resuelve el
  usuario en Billing.
  *2026-10-04: cerrada con el run 37226087232 de `E2E Android` sobre `22608a0`:
  `supabase` y `registro` con su veredicto «pass» en attempt-01, sin «fetch
  failed». El bloqueo era la cuota de Actions; el repo pasó a público y su
  runner tiene ahora 15 GB de RAM. «Memoria y contenedores al final»: todos los
  contenedores siguen «Up», 13 GB disponibles, 36 MB de swap usados y ningún OOM.*
  *Reabierta el mismo día: el cierre era prematuro. En `supabase` vuelve
  «fetch failed» (`getUserById` tras `sign-in-abandon.yaml`) en los tres intentos
  posteriores: attempt-02 de 37228331950, 37231590523 y su rerun. La petición no
  llega a Kong y no hay OOM, así que la sospecha de memoria queda descartada. El
  diagnóstico sigue en `todo/verificacion.md`.*
  *2026-10-05: cerrada con el run 37239076782 de `E2E Android` sobre `33378bc`,
  las tres variantes en verde. `registro` pasa en attempt-01. `supabase` pierde
  attempt-01 por el runner («adb ve el dispositivo offline», ajeno a la app) y
  pasa en attempt-02. En ese intento la repetición del GET actúa dos veces:
  `UND_ERR_SOCKET` («other side closed») y la segunda llamada responde 200. Es la
  conexión keep-alive que Kong ya había cerrado, y el arreglo de `33378bc` la cubre.*
- [x] [comprobador] Recorrido en el emulador Android: el esmerilado nativo
  (`BlurTargetView`) de la barra, el swipe con la pila nueva y el anillo del
  Pomodoro en una sesión activa.
  *2026-10-03, comprobador (mock, APK release sobre `107541a`): ✅ los tres.*
  Barra: el borde del botón naranja que pasa por debajo sale desenfocado dentro
  de la píldora (`08-recorte-barra.png`). Swipe: la tarjeta sigue al dedo con
  giro y sello «Like»/«Pasar», la de detrás asoma y Like da el match
  (`02-`…`05-deck*`). Anillo: avanza con el tiempo en la sesión 1:1 activa
  (`13-`…`15-sesion-anillo*`) y en la sala. Capturas en
  `e2e/artifacts/local/2026-10-03-visual-107541a/`. **Fallo aparte, en todas las
  pantallas:** la luz ambiental no llena la pantalla; queda una franja negra a la
  derecha y abajo (ver «Hallazgos del comprobador», 2026-10-03).
  *2026-10-04, comprobador (mock, bundle con el código de `4a95c86`):* franja
  resuelta por `90d1d7b`. La pasada de contención y la barra en Android, ✅
  (ver «Hallazgos del comprobador», 2026-10-04).

- [x] Liquid Glass nativo en iOS 26+ (`5351a3f`, pedido por el usuario el
  2026-10-03): `Frosted` —la barra de pestañas— usa `GlassView` de
  `expo-glass-effect` cuando hay iOS, la app compilada con Liquid Glass y el API
  en el dispositivo (`hasNativeGlass()`); sin relleno, canto, sombra ni
  `overflow` propios. Si falta algo, el esmerilado de `BlurView` de siempre.
  Android y web sin cambios (confirmado en el emulador el 2026-10-04).
  `expo-glass-effect` pasa a dependencia directa. El modal de match no cambia:
  su fondo es un desenfoque de pantalla, no una superficie de cristal.
- [ ] (usuario — iPhone con iOS 26) Ver la barra en Expo Go o en un build de
  desarrollo: que sea el cristal del sistema y que «Descubrir», «Matches» y
  «Perfil» se lean bien encima de la luz ambiental. Ojo con cualquier
  `opacity: 0` en un padre de `Frosted`: deja el cristal sin pintar.

Textos: ningún texto ni etiqueta que usen los `e2e/*.yaml` ha cambiado. Cambia
la presentación de «Enviar» (ahora icono; su etiqueta «Enviar mensaje» sigue).
