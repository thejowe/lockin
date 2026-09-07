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
