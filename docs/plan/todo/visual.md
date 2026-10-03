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
  de match sobre el deck esmerilado.
- [x] Onboarding, perfil, matches, chat, sesión: opciones con icono y radio que
  salta, foco de campo en brasa, filas y baldosas de cristal en escalera, racha
  con llama, compositor con botón redondo, anillo de Pomodoro continuo y punto
  de presencia que respira.
- [x] Dependencias nuevas (todas en Expo Go): `expo-blur` (esmerilado de barra y
  modal), `@expo-google-fonts/inter` (tipografía), `react-native-svg` (iconos,
  halos y anillo). Las de Fraunces/Plex quedan instaladas sin usar: retirarlas
  es una tarea aparte.
- [x] Verificado en local: `tsc`, lint, Jest con cobertura sobre el suelo y
  `expo export --platform web`; recorrido visual en web (390×844) con
  Playwright headless: modo, formulario, deck, match, chat, matches y perfil.
- [ ] [comprobador] Recorrido en el emulador Android: el esmerilado nativo
  (`BlurTargetView`) de la barra, el swipe con la pila nueva y el anillo del
  Pomodoro en una sesión activa.

Textos: ningún texto ni etiqueta que usen los `e2e/*.yaml` ha cambiado. Cambia
la presentación de «Enviar» (ahora icono; su etiqueta «Enviar mensaje» sigue).
