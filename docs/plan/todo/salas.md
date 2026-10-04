# salas — Salas Lock-In grupales (Fase 3)

Spec: `docs/superpowers/specs/2026-10-02-salas-grupales-design.md`
Plan: `docs/superpowers/plans/2026-10-02-salas-grupales.md`
Agente: `.claude/agents/salas.md`

> **Diseñado sin el usuario delante (2026-10-02).** Antes de la Tarea 1, el
> usuario revisa la tabla «Decisiones tomadas sin el usuario (revisar)» de la
> spec. Si cambia alguna, se reabre la Tarea 0 y se corrigen spec, plan y este
> archivo antes de escribir código.

## Al retomar (estado del 2026-10-04, bloque cerrado)

**Las Tareas 0–12 están cerradas.** Todo el código está en `claude/startup-cofounder-matching-app-tfeai1`.
Sobre `22608a0` (Actions de vuelta, el repo pasó a público el 2026-10-04), las cuatro señales salen en verde:
- **E2E Android**, [run 37226087232](https://github.com/thejowe/lockin/actions/runs/37226087232):
  las tres variantes en verde. En la `supabase` sale `[Passed] Aceptar, entrar y salir de una sala
  Lock-In (2m 11s)` y «Postgres: asistencia a la sala verificada.».
- **CI**, [run 37226087427](https://github.com/thejowe/lockin/actions/runs/37226087427): verde entera,
  con «Formato» y el contrato Supabase (105 verdes y 24 saltados a propósito).
- **Schema drift**, [run 37226087236](https://github.com/thejowe/lockin/actions/runs/37226087236): verde en
  local y en remoto, ya sin excepción.

No hay nada a medias en ningún worktree.

Lo único abierto es del usuario: **revisar las decisiones tomadas sin él** (spec, primera sección;
las que más pesan son la 1 y la 6). Si cambia alguna, se reabre la Tarea 0 y se corrigen spec, plan
y este archivo antes de tocar código.

Si algo de salas sale rojo más adelante, lo depura el agente `salas`. **No lances `contract.yml` a
mano sobre esta rama**: CI ya lo incluye y comparten grupo de concurrencia, así que se cancelan
entre sí.

Deudas pequeñas anotadas, sin casilla. Cerradas el 2026-10-03: el tirar-para-refrescar de
Matches ya relee las salas (`b2651a5`, `useRefreshQuery`); `e2e/README.md` explica la cadena
`supabase` hasta `room.yaml` y `test/app/layouts.test.tsx` declara `room/new`, `room/[roomId]` y
`agreement/[matchId]` (`931be74`). Abierta: un caso intermitente de mock en `full-journey.yaml` («Tarde · 12–20»
no visible tras 4 min, probablemente lentitud del runner: la variante `supabase` lo pasó con el
rediseño).

Cómo se trabajó (para repetirlo): Codex hizo las tareas `[Codex]` (1, 2, 4, 5, 6 y 9) desde
el plugin, en worktree aislado y sin commitear, porque su sandbox no escribe en `.git`. Claude
revisó cada diff, hizo el commit con las dos líneas `Co-Authored-By` y lo integró con cherry-pick.
El trabajo de Claude pasó por `codex review` antes de cerrarse: las Tareas 7–8 necesitaron cinco
pasadas. Ver las memorias `codex-no-commitea-en-worktree`, `worktree-aislado-nace-de-origin`
y `contrato-manual-cancela-ci`.

## Tareas

Paralelo posible solo en dos parejas, cada una en su worktree: **1 ∥ 2** y **4 ∥ 5**.
El resto, en orden.

- [x] [Claude] Tarea 0 — Alta del bloque: spec, plan, sección 14 en `PLAN.md`, hito en `TODO.md`, este archivo y `.claude/agents/salas.md` (commit de diseño del 2026-10-02)
- [x] [Codex] Tarea 1 — Tipos de dominio (`src/data/types.ts`) y reglas puras (`src/data/rooms.ts` + test). Hecho el 2026-10-03: tipos y JSDoc de la spec, reglas de tiempo y validación de invitados, y exportación pública. TDD rojo → verde: 23 tests; TypeScript y lint limpios.
- [x] [Codex] Tarea 2 — Migración `20261002000100_lockin_rooms.sql` y cobertura en PGlite (`supabase/schema-embedded.test.mjs`), con el ciego de invitados como test central. Verificada el 2026-10-02: 15 casos del plan; `npm run test:schema` 21/21, 19 migraciones y 609 objetos; parseo de drift sin cambios.
- [x] [Claude] Tarea 0b — Revisión adversarial de Codex sobre `9b78e47` (nueve hallazgos, todos aceptados): spec, plan y este bloque corregidos el 2026-10-02
- [x] [Claude] Tarea 3 — Contrato `RoomRepository`, sus quince casos, mock (`src/data/mock/rooms.ts`), store y registro. Hecha el 2026-10-03 en `171719a`: `describe('rooms')` hermano de `sessions` con los quince casos (perfil propio guardado en el `beforeEach`, `itWithTimeTravel` y `startsIn` propios sobre `sessions.serverNow()`, los dos órdenes cancelar/aceptar, responder solo antes de la ventana, 21 salas sin truncar, tercero suscrito sin avisos); mock con el ciego de la política de RLS y avisos por participante (`rooms:<profileId>`). TDD: 15 rojos (`roomsFor is not a function`) → 15 verdes contra el mock, más 5 propios en `mock/rooms.test.ts`. `tsc` y `lint` limpios; `jest --coverage --ci` 1146 verdes, cobertura 95.53/90.28/95.2/97.05 sobre el suelo. Supabase lleva un `rooms`/`roomsFor` provisional que lanza `rooms: Tarea 4`: hasta la Tarea 4, los casos de salas de `contract.yml` fallan a propósito.
- [x] [Codex] Tarea 4 — Repositorio de Supabase (`src/data/supabase/rooms.ts`), tipos, registro y fixture del contrato. Hecha el 2026-10-03: seis RPC, mapeos y errores `LI001`–`LI004`/`LI006`, lecturas en lote paginadas, `fetchAllPages` trasladado sin cambios de comportamiento a `pagination.ts`, avisos locales y un único canal sobre `lockin_rooms` con resincronización al reengancharse. Sustituidos los dos stubs. TDD rojo → verde: 31 tests nuevos; suite Supabase 219 verdes y suite completa de datos 466 verdes (128 saltados); TypeScript, lint y Prettier limpios. **Verificación de `contract.yml` pendiente en CI**: no ejecutada contra Supabase local ni remoto en esta tarea. Sin staging ni commit, por instrucción del usuario.
  - 2026-10-03, arreglo tras el primer `contract.yml` (run 37123554505, rojo en «un tercero suscrito no recibe nada…», 21 avisos): fuga real, no ruido del test. Realtime no aplica RLS a los `DELETE` de `lockin_rooms`, y el canal escuchaba `'*'`. Run de diagnóstico 37124064814: los 21 avisos eran los `DELETE` de las 21 salas del caso anterior, borradas en cascada por `dev_reset_current_user()`; ninguno de la sala del propio caso (la RLS de `INSERT`/`UPDATE` sí filtraba). No rompía el ciego (solo el `id` de la sala, sin miembros), pero cualquier suscriptor recibía el id de toda sala borrada. Arreglo en `6bd289a`: el canal escucha solo `UPDATE` (crear, responder y cancelar ya llegan así por `touch_room`); el filtro lo aplica el servidor. Run 37124434840 con el cable instrumentado: 18 `postgres_changes UPDATE` y ningún `DELETE`; el caso pasa con 0 avisos y los 102 casos ejecutados, en verde. Ese job sigue rojo solo por su guarda de saltos: falta añadir «una sala empezada no se cancela; terminada sigue legible» (`itWithTimeTravel`, saltada a propósito) a la lista de `.github/workflows/contract.yml`, que es de `calidad`.
- [x] [Codex] Tarea 5 — Presencia de sala: `topicPrefix` en `supabase/presence.ts`, `roomPresence` en `active.ts`, `useRoomPresence`. Hecha el 2026-10-03: prefijo predeterminado de sesiones conservado, canal privado `lockin:room:<uuid>`, fachada perezosa con instancia mock independiente y hook público con limpieza al salir/cambiar de identidad y protección frente a eventos tardíos. Según el contrato del plan, la pantalla pasa `roomId: null` fuera de `isInRoomJoinWindow` (integración en Tarea 8). TDD rojo → verde: 8 tests nuevos; suites específicas 14/14, regresión de datos y sesiones 600 verdes (128 saltados). TypeScript, lint y Prettier limpios. Sin staging ni commit, por instrucción del usuario.
- [x] [Codex] Tarea 6 — `roomRowView`, `RoomRow` y `useLiveRooms`. Hecha el 2026-10-03: cuatro estados con el copy y los recuentos de la spec, prioridad de entrada en ventana, fila accesible con cristal e iconos compartidos, y lista viva con suscripción, relectura al recuperar el foco (sin duplicar el primero) y tic de 30 s. Exportación pública de las tres piezas. TDD rojo → verde: 21 tests nuevos; suites de salas 28/28 incluyendo presencia. TypeScript, lint y Prettier limpios. Test del hook en `.test.ts` según el alcance pedido; comandos `npx.cmd`/`npm.cmd` por la política de PowerShell. Sin staging ni commit, por instrucción del usuario.
- [x] [Claude] Tarea 7 — Pantalla «Convocar sala» (`/room/new`) e `InviteePicker`. Hecha el 2026-10-03 en `eb8896e`: chips de selección múltiple con tope de 4; con quién / cuándo / cuánto sin ningún campo de texto; tramo preseleccionado (mañana si hoy no queda); una sola escritura por doble toque (ref en vuelo); `RoomInviteError`, `SessionWindowError` y cualquier otro fallo salen como texto; con menos de 2 matches, estado vacío y «Ir a Descubrir». Cristal: `<Screen ambient="teal">`, `enterUp`, `stackHeader`. TDD: 3 tests del picker + 11 de la ruta, rojos → verdes.
- [x] [Claude] Tarea 8 — Pantalla de la sala (`/room/[roomId]`) y `RoomsSection` en Matches (cruce con `chat`). Hecha el 2026-10-03 en `1352d8e`: `useRoom` (8 tests: lectura, suscripción, `serverNow`, `pending` y una sola escritura por doble toque), `RoomsSection` (5 tests) y la ruta (22 tests: «Convoca Núria»/«Convocas tú», la invitada no ve a la otra invitada, cancelar con confirmación en línea, «No podré ir» vuelve sin pintar «no disponible», cancelación con la pantalla abierta, retirada de una aceptada con la pantalla abierta, responder cerrado en la ventana, entrar/presencia/salir/gesto atrás/reintento, terminada sin valoración, no disponible). Matches: una línea (`<RoomsSection />`) más su import, y un test. Verificación: `tsc` y `lint` limpios; `jest --coverage --ci` 1336 verdes, cobertura 95.76/90.05/95.4/97.19 sobre el suelo (el único rojo, `swipe-deck` por un timeout del primer test bajo carga, pasa 26/26 solo); `expo export --platform web` en verde con `room/new` y `room/[roomId]`. Desviaciones: `useRoom` expone además `refresh()` (botón «Reintentar» tras un fallo de lectura); la presencia del test es el `roomPresence` en memoria de `@/data` en vez de un adaptador inyectado; el doble toque de «Me apunto» lo fija `use-room.test.tsx` (en la ruta, un `act` con la escritura retenida no termina).
  - 2026-10-03, revisión de Codex (`codex review --base b051070`, dos P2) arreglada en `edea990`: la salida va detrás de la última entrada pedida (una entrada que llega tras desmontar ya no deja `joinedAt` sin `leftAt`; «Salir» espera a la entrada en vuelo y sale una vez), y `RoomsSection` enseña el fallo de `listLive()` con «Reintentar». TDD: 3 rojos → verdes. **Pendiente, a propósito**: el tirar-para-refrescar de Matches no relee las salas; conectarlo exigiría montar `useLiveRooms` también en `matches.tsx` (más de una línea en el archivo de `chat`), así que queda en el botón.
- [x] [Codex] Tarea 9 — Avisos locales de salas (`room-reminders.ts`, `RoomReminderSync`; cruce de una línea con `sesiones` y con el layout de tabs). Hecha el 2026-10-03: aviso 5 minutos antes para aceptadas (incluida quien convoca), reconciliación con `rooms.listLive()` al montar y por `rooms.subscribe`, retirada de avisos de salas canceladas/rechazadas/terminadas y claves independientes de las sesiones 1:1. Reutiliza el puerto y canal Android de sesiones; lecturas serializadas, reintento tras error y limpieza de la suscripción al desmontar. TDD rojo → verde: 16 tests nuevos; regresión de salas, sesiones y `test/app`: 47 suites, 362 tests verdes (un aviso de `act` en `sessionId.test.tsx`). TypeScript, lint, Prettier y export web limpios. Sin cambios de alcance; sin staging ni commit por instrucción del usuario.
- [x] [Claude] Tarea 10 — E2E `room.yaml` en la variante `supabase`, encadenado tras `agreement.yaml`
  - 2026-10-04, **verde en Actions sobre `22608a0`** ([E2E Android, run 37226087232](https://github.com/thejowe/lockin/actions/runs/37226087232), las tres variantes en verde; `supabase`, job 111505907087). En el log: `[Passed] Aceptar, entrar y salir de una sala Lock-In (2m 11s)`, tras el acuerdo y antes de `sign-in-abandon.yaml`, y «Postgres: asistencia a la sala verificada.». La línea de tiempos: «Sala, tiempos (reloj de Postgres): «Me apunto» a 24.6 s de sembrar (las respuestas se cierran a 120.0 s); entrada a 0.5 s de abrir la ventana; salida a 7.2 s de entrar.». Hay casi 100 s de margen sobre el cierre de respuestas, así que no hace falta subir la siembra (7 min) ni la espera (180 s). El código es el de `85964c0` y `190bd36`.
  - 2026-10-03, **pendiente de E2E verde: Actions bloqueado por facturación; infra del runner ya arreglada en la rama principal (bd3f9b2..2fd6685)**. Código en `85964c0` y `190bd36`: `room.yaml` (relanza sin borrar estado → Matches → «.\* te invita.\*» → «Me apunto» → hasta 180 s a «Empieza en» → «Salir» → «Salir de la sala» → «Entrar a la sala.\*» de vuelta en Matches); `prepareRoom` siembra la sala a 7 min (convoca la contraparte, Marc Oller aceptado, el usuario invitado) y `verifyRoomAttendance` comprueba `aceptada`, `joined_at` y `left_at`, e imprime los tiempos de cada paso con el reloj de Postgres («Sala, tiempos: …»); encadenado tras el oráculo del acuerdo y antes de `sign-in-abandon.yaml`, con `room: 'verified'`; `e2e/room.test.mjs` (5 casos) fija etiquetas, siembra y los dos números (7 min y 180 s) contra el código. `node --test e2e/room.test.mjs` 5/5; `e2e/*.test.mjs` 103/104 (el rojo es el CRLF de `full-journey`, conocido). En Actions (rama desechable con los arreglos de `e2e.yml` de `claude/visual-cristal`): runs 37145155786, 37147988585 y 37151155639 murieron por la infra del runner (disco, ANR de System UI) en `full-journey.yaml`, también en mock; en el 37154276244 la variante `supabase` pasó recorrido, sesión, valoración, racha y acuerdo, y cayó en `prepareRoom`: un insert en lote de PostgREST pone NULL (no el `default`) en la columna que falta → `status` nulo. Arreglado en `190bd36`. **`room.yaml` no ha llegado a ejecutarse en el emulador: el tiempo de espera (siembra a 7 min, 180 s) sigue sin medir**; el primer run verde debe leer «Sala, tiempos» en el log (margen de «Me apunto» frente a los 120 s y entrada tras abrir la ventana). Ese mismo run, la variante mock cayó por un caso en `full-journey.yaml` («Tarde · 12–20» no visible tras 4 min), ajeno a salas.
- [x] [Claude] Tarea 11 — Verificación final y cierre (CI, E2E, contrato, Schema drift con su excepción anotada)
  - 2026-10-04, **local sobre `021cf1e`** (encima de `22608a0` solo hay commits de ci y docs):
    - `tsc --noEmit` y `lint`, limpios.
    - `test:schema`, 75/75.
    - `expo export --platform web`, en verde con `/room/new` y `/room/[roomId]`.
    - `jest --coverage --ci`: 1392 verdes, cobertura 95.42/90.14/95.23/96.76 sobre el suelo. Hay un rojo, el timeout de 5 s de `account-section.test.tsx` bajo carga, ajeno a salas: solo pasa 23/23 y el job «Tests» de CI está en verde.
  - **En Actions sobre `22608a0`:**
    - `CI`, [run 37226087427](https://github.com/thejowe/lockin/actions/runs/37226087427): verde entera, con «Formato», «SQL embebido» y «Contrato Supabase». El contrato da 105 verdes y 24 saltados (los de viaje en el tiempo, entre ellos «una sala empezada no se cancela; terminada sigue legible»). No se lanzó `contract.yml` a mano porque CI ya lo incluye.
    - `E2E Android`, [run 37226087232](https://github.com/thejowe/lockin/actions/runs/37226087232): verde (Tarea 10).
    - `Schema drift`, [run 37226087236](https://github.com/thejowe/lockin/actions/runs/37226087236): «Huella local y controles negativos» y «Comparar grrzmzktrhksbttpbblg (solo lectura)» en verde. En el remoto: «huella SQL coincide con las migraciones de este commit».
  - El plan esperaba el remoto en rojo a propósito por la migración. Ya no aplica: `lockin_rooms` y `harden_grants_and_clock` se aplicaron el 2026-10-03, y este es el primer run remoto verde con ellas. Memoria `schema-drift-remoto-rojo-esperado` actualizada.
- [x] [comprobador] Tarea 12 — Recorrer convocar, entrar y cancelar una sala en el emulador (mock)
  - 2026-10-03, comprobador (mock, APK release sobre `107541a`): **✅ los pasos 1–6 del plan**,
    incluida la espera hasta la ventana (la sala de las 11:00 se abrió a las 10:55 y se trabajó a
    las 11:00). Una desviación de texto menor en la fila de Matches, detallada en «Hallazgos del
    comprobador». Evidencia en `e2e/artifacts/local/2026-10-03-salas-107541a/`.

## Pendiente del usuario

- [ ] Revisar las decisiones tomadas sin el usuario (spec, primera sección). Las
      que más cuesta deshacer una vez empezada la Tarea 2: cómo se forma la sala
      (desde matches) y el ciego de invitados.
- [x] Aplicar `supabase/migrations/20261002000100_lockin_rooms.sql` en
      `grrzmzktrhksbttpbblg`. Aplicada el 2026-10-03 por orden del usuario
      («aplica migraciones»), por MCP en vez de SQL Editor, antes de cerrar la
      Tarea 11. Ya no hay excepción en `Schema drift` remoto.
- [x] Texto de la fila de quien convoca con todos aceptados (hallazgo del
      comprobador abajo). La spec ya lo decía (tabla de § Matches: «Tu sala · k
      de n» solo «con pendientes»), así que el fallo era de `roomRowView`: sin
      pendientes, quien convoca ve «Sala · … · k personas». Si todas rechazan
      sigue viendo «0 de N han aceptado» (spec, «Nadie más acepta»), no
      «1 personas». Tests en `row-view.test.ts`.

## Hallazgos del comprobador

- 2026-10-04: el recorrido de la Tarea 12 (mock, `b478f90`) se paró a mitad al cerrar la
  sesión. No hay veredicto; las capturas parciales están en `e2e/artifacts/local/2026-10-04-salas/`.
  El emulador `emulator-5554` quedó encendido y libre. *(Sustituido por el recorrido del 2026-10-03,
  abajo.)*

### 2026-10-03 — Tarea 12, recorrido completo (mock, `107541a`)

APK release x86_64, con `prebuild --clean`, `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y
`createBundleReleaseJsAndAssets --rerun` (`build.log`). En logcat sale `[lockin] backend de datos: mock en
memoria`. `pm clear` antes de empezar. Reloj del AVD: domingo 4 de octubre, 10:37–11:20.
Carpeta: `e2e/artifacts/local/2026-10-03-salas-107541a/`.

1. **✅ Onboarding «Ambos» y matches.** Perfil creado (`01-`…`04-`). Like a Marc Oller y a Núria Bosch:
   los dos dan match recíproco (`07-match-nuria.xml`). Núria lleva «Quiere: Cofundador»
   (`06-nuria.xml`). Que no salga en el deck «Lock-In» **no lo comprobé**: le di like desde
   «Todo».
2. **✅ Convocar.** En Matches aparece «Salas Lock-In» y «Convocar sala Lock-In» (`08-matches.png`).
   El formulario tiene chips «Núria»/«Marc» con contador «2 de 4», día y tramo de 15 min (preseleccionado
   «Hoy 11:00», el siguiente válido) y bloques. Con menos de 2 personas dice «Elige al menos 2 personas.»
   (`09-convocar.xml`, `10-convocar-relleno.png`). Al convocar, Android pide el permiso de notificaciones.
3. **✅ La sala abre** con «Convocas tú · hoy 11:00 · 1 bloque», «Tú · Convocas» y los dos con
   «Ha aceptado» (`11-sala-abierta.png`).
4. **✅ Fila y entrada.** Antes de la ventana, la fila dice «Tu sala · hoy 11:00 · 2 de 2 han aceptado»
   (`12-matches-con-sala.xml`). A las 10:55:05 pasa sola a «Entrar a la sala · hoy 11:00 · 1 bloque»
   (`18-matches-entrar.xml`, gracias al tic de 30 s). Dentro, «Tú · Estás aquí», los otros dos
   «Aún no ha entrado» (el mock no simula su presencia), «Empieza en 4:11» y «Salir» + «Cancelar sala»
   (`19-sala-ventana.png`). A las 11:00, «24:47 · Trabajo · bloque 1 de 1»; «Cancelar sala» desaparece
   (`20-sala-trabajo.png`) y el anillo avanza (`21-sala-anillo-1min.png`). «Salir» pide confirmación
   («Saldrás antes de acabar.» + «Salir de la sala», `22-salir-confirmacion.png`) y vuelve a Matches
   con «Entrar a la sala» (`23-tras-salir.png`).
5. **✅ Cancelar.** Segunda sala con los dos, mañana 11:00 (`14-sala2.xml`). «Cancelar sala» pide
   confirmación («Se cancelará para todas las personas invitadas.», «Sí, cancelar la sala» / «No,
   mantenerla», `15-cancelar-confirmacion.xml`). Tras confirmar sale «Cancelaste la sala» con «Volver
   a Matches» (`16-tras-cancelar.xml`). En Matches solo queda la sala de hoy (`17-matches-tras-cancelar.xml`).
6. **Evidencia.** `logcat.txt` (`*:E ReactNativeJS:V`): ningún error de JS ni crash.

**Desviación menor (texto).** El plan (Tarea 12, paso 4) esperaba «Sala · … · 3 personas» en la fila de
quien convoca una vez han aceptado todos. La app pinta «Tu sala · hoy 11:00 · 2 de 2 han aceptado».
`roomRowView` (`src/features/room/row-view.ts`) usa siempre la forma «Tu sala» para quien convoca. La
spec la reserva para «Convocas, con pendientes», y la forma «Sala · {día hora} · {k} personas» es la de
«Aceptada, fuera de ventana». Con 0 pendientes, lo que la spec da a entender es «Sala · … · 3 personas».
Toca decidir: o se cambia el código, o se aclara la tabla de la spec. No rompe nada.
**Resuelto en `4a95c86`:** se cambió el código, que era lo que la spec ya decía.

**Observaciones, sin marcar como fallo.**
- En la pantalla de sala, `uiautomator dump` falla con «could not get idle state» (animación continua).
  `19-sala-ventana.png` es solo captura, sin XML.
- Al cambiar de «Hoy» a «Mañana» en «Convocar», la fila de tramos vuelve a 00:00 y el tramo elegido
  (11:00, que se conserva) queda fuera de la vista. Solo se adivina por «1 bloque · hasta 11:30»
  (`13-convocar-2.png`). Además, el número de bloques preseleccionado esta vez era 2.
  **Resuelto en `e5ab495`:** tras un cambio de día, la fila se desplaza al tramo elegido. Los 2
  bloques por defecto no son un fallo: la spec no fija ninguno y es el mismo valor que la hoja de
  sesión 1:1 (`propose-session-sheet.tsx`); el «1 bloque» de la primera sala lo eligió el comprobador.
- La franja negra a la derecha y abajo de cada pantalla es de `visual` (luz ambiental a 390×844 dp):
  anotada en `todo/visual.md`, arreglada en `90d1d7b` (pendiente de que la confirme el comprobador).

### 2026-10-04 — arreglos `e5ab495` y `4a95c86` en el emulador (mock, `5f698db`)

APK release x86_64 sobre `5f698db` (HEAD no se movió durante el build), con `prebuild --clean`,
`EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` y `createBundleReleaseJsAndAssets --rerun`. En logcat
sale `[lockin] backend de datos: mock en memoria`. `pm clear` antes de empezar. Reloj del AVD: domingo
4 de octubre, 12:48–12:57. Carpeta: `e2e/artifacts/local/2026-10-04-arreglos-5f698db/`.
Onboarding «Ambos», like a Marc Oller y a Alba Ferrer: los dos dan match (`13-`, `14-`).

1. **✅ Convocar: la fila de horas sigue al tramo al cambiar de día (`e5ab495`).** En «Convocar sala
   Lock-In», Alba y Marc («2 de 4»). En «Hoy» desplacé la fila y elegí 18:00 (`17-hoy-1800.xml`,
   `Hora 18:00` con selected=true en x 531–712). Al pulsar «Mañana», la fila se desplaza sola: «Hora
   18:00» queda seleccionada y visible en x 126–307, con 17:45 asomando a la izquierda
   (`18-manana.png`, `18-manana.xml`). No vuelve a 00:00. Al volver a «Hoy» y otra vez a «Mañana»,
   18:00 sigue seleccionada y a la vista (`19-vuelta-hoy.xml`, `20-manana-otra-vez.xml`).
2. **✅ Fila de quien convoca con todas aceptadas (`4a95c86`).** Sala convocada con los dos para mañana
   18:00, 2 bloques. En el mock aceptan solos: la sala muestra «Convocas tú · mañana 18:00 · 2
   bloques» y los dos con «Ha aceptado» (`22-sala.xml`). En Matches, la fila dice **«Sala · mañana 18:00
   · 3 personas»** (content-desc idéntico), sin «Tu sala» ni «2 de 2 han aceptado»
   (`23-matches-con-sala.png`, `23-matches-con-sala.xml`). No se comprobó la forma «Tu sala · k de n»
   con respuestas pendientes: el mock no deja ninguna.
3. `logcat.txt` (`*:E ReactNativeJS:V`): ningún error de JS ni crash.
