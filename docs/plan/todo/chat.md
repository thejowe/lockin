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
