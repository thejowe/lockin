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
- [ ] **[comprobador]** Recorrido completo en el emulador (mock) con capturas
  antes/después de cada pantalla pulida. **Aparcada**: por decisión del
  usuario del 2026-09-26 esta máquina no usa el `comprobador` (ver
  `acuerdo.md`). Hasta que haya otro dispositivo con emulador, la evidencia en
  Android es el job «E2E Android» de Actions, y la visual, las capturas web.
  Al retomarla, mirar en especial el relevo del deck: la tarjeta de detrás
  avanza con el arrastre, y en el frame en que la superior se reinicia podría
  verse un salto de un 4 %.

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
