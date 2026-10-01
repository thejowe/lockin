# TODO — video

Plan: `docs/superpowers/plans/2026-09-16-video-real-sesion.md`. Spec:
`docs/superpowers/specs/2026-09-16-video-real-sesion-design.md`. Una casilla
por tarea del plan; se marca al hacer su commit, con la evidencia real al
lado (comando y resultado) — no solo la marca.

Alcance de archivos: ver `docs/plan/PLAN.md` → bloque 10. Cruce de una línea
en `src/app/session/[sessionId].tsx` (dueño original: `sesiones`).

Orden: 1 → 2 → 3 → 4 → 5 → 6 → 7 (ver "Orden" del plan para el detalle de
qué puede solaparse).

- [x] Tarea 1 — Dependencia, plugin de `react-native-webrtc` y mock de test
      (`9829e15`). `react-native-webrtc` + `@config-plugins/react-native-webrtc`
      en `dependencies`; plugin y permisos Android en `app.json`; mock de
      `RTCPeerConnection`/`RTCView`/`mediaDevices.getUserMedia` en
      `jest.setup.js`. Evidencia: `npx tsc --noEmit` limpio; `npm test` en
      verde (56 suites, 611 tests, nada importa el paquete real todavía);
      `npm run lint` limpio (exit 0); `node -e "require('./app.json')"` no
      falla. Pendiente del usuario: `eas build --profile development` para
      confirmar que el plugin nativo compila de verdad (no ejecutable desde
      este entorno).
- [x] Tarea 2 — Señalización en memoria (`src/data/video-signal.ts`)
      (`d0fae92`). `VideoSignalChannel` con el mismo truco que
      `createMemoryPresenceAdapter` (`Map<sessionId, Map<symbol, {profileId,
      handlers}>>`), `send` descarta al emisor comparando `from`. Reexportado
      desde `src/data/index.ts` — **desviación de alcance**: ese archivo no
      estaba en la lista de `.claude/agents/video.md`, pero el plan de esta
      tarea lo pide y `use-video-call` necesita `VideoSignalChannel` vía
      `@/data`, igual que `use-counterpart-presence` con `PresenceAdapter`.
      Evidencia: `npx jest src/data/video-signal.test.ts` en verde (5 tests:
      mensajes cruzados, sin eco propio, salir deja de recibir, sesiones
      distintas no se cruzan, enviar a sala vacía no revienta); `npx tsc
      --noEmit` limpio; `npm run lint` limpio (exit 0).
- [x] Tarea 3 — Señalización sobre Supabase Realtime Broadcast
      (`src/data/supabase/video-signal.ts`). `createSupabaseVideoSignalAdapter`
      igual que `createSupabasePresenceAdapter`: un canal
      `lockin:video:<sessionId>` por sesión, sin `track()`; `join` se suscribe
      a `broadcast`/`signal` y descarta ecos propios comparando
      `payload.from`; `send` reutiliza el canal que dejó abierto `join` para
      esa sesión (cacheado en un `Map<sessionId, RealtimeChannel>`, mismo
      truco que el mock en memoria) y no revienta si no hay canal abierto.
      `src/data/active.ts` gana `videoSignal` con la misma regla que
      `presence`. Evidencia: `npx jest src/data/supabase/video-signal.test.ts`
      en verde (9 tests: canal por sesión, `onConnection` en los tres estados
      de error, mensaje ajeno llega, eco propio no vuelve, `send` transmite
      por el canal correcto, enviar sin unirse no revienta, salir cierra el
      canal y deja de poder enviar); `npx tsc --noEmit` limpio; `npm run
      lint` limpio (exit 0); `npm test` completo en verde (58 suites, 625
      tests, 1 suite skip ya existente antes de esta tarea).
- [x] Tarea 4 — Hook `use-video-call.ts` (WebRTC, offer/answer, ICE)
      (`00e1f6f`). `RTCPeerConnection` con STUN público, offer/answer/ICE por
      `VideoSignalChannel` (vía `@/data`); el `profileId` menor en orden
      lexicográfico ofrece, sin coordinación extra. El status se deriva de un
      outcome interno en vez de fijarse con `setState` directo en el efecto
      (evita `react-hooks/set-state-in-effect` y tocar refs durante el
      render). `src/data/index.ts` reexporta ahora `videoSignal` desde
      `active.ts` — la Tarea 3 no lo hizo porque su propio plan no lo pedía,
      pero este hook lo necesita vía `@/data`, igual que
      `use-counterpart-presence` con `presence`. Evidencia: `npx jest
      src/features/session/use-video-call.test.ts` en verde (6 tests: arranca
      inactiva sin unirse al canal, pasa a conectando aunque nadie responda,
      quién ofrece según orden lexicográfico, las dos partes llegan a
      conectada tras intercambiar offer/answer/ICE, `active=false` limpia la
      conexión y suelta el stream local, `toggleMic`/`toggleCamera` cambian
      estado y tracks); `npx tsc --noEmit` limpio; `npm run lint` limpio
      (exit 0); `npm test` completo en verde (59/60 suites, 1 skip
      preexistente, 631 tests).
- [x] Tarea 5 — Pantalla `video-call-view.tsx` e integración en la sesión
      (`5853e10`). `VideoCallView` pinta dos `RTCView` (remoto grande, propio en
      esquina) sobre `useVideoCall`, con controles de mic/cámara/colgar; se
      monta siempre en el bloque `clock` de `[sessionId].tsx` y decide sola si
      pinta algo (`active = canJoin && !ended`), sin que la pantalla tenga que
      condicionar su presencia en el árbol ni se tocara su lógica de
      fases/asistencia/valoración. **Desviación de alcance, con hallazgo real**:
      al verificar `npx expo export --platform web` (no pedido explícitamente
      por el criterio de esta tarea, pero sí por el de la Tarea 7 y por la
      propia spec: "el CI de `export web` sigue en verde") se confirmó que ya
      estaba roto *desde la Tarea 4* — `use-video-call.ts` importa
      `react-native-webrtc` sin guardar por plataforma, y `index.ts` ya lo
      reexportaba con `[sessionId].tsx` importando ese barrel, así que el
      módulo nativo se evaluaba igual en el bundle web
      (`requireNativeComponent is not a function`). Un `if (Platform.OS ===
      'web')` dentro del archivo no lo habría arreglado: el `import` se
      ejecuta al cargar el archivo, no al entrar en la rama — hueco que la
      spec no cubre explícitamente. Se resolvió con el mecanismo de extensión
      de plataforma que ya usa el repo (`app-tabs.web.tsx`,
      `use-color-scheme.web.ts`): `use-video-call.web.ts` y
      `video-call-view.web.tsx` (nuevos, sin importar `react-native-webrtc`)
      que Metro resuelve en vez de sus pares nativos para cualquier bundle
      web. Evidencia: `npx expo export --platform web --output-dir <tmp>`
      fallaba con `TypeError: requireNativeComponent is not a function` antes
      del fix, en verde (15 rutas exportadas, incluida `/session/[sessionId]`)
      después; `npx jest src/features/session/video-call-view.test.tsx` en
      verde (5 tests: no pinta nada fuera de ventana, controles + aviso
      mientras conecta, los dos `RTCView` cuando conecta de verdad,
      mic/cámara cambian de etiqueta, colgar limpia sin desmontar el hueco);
      `npx jest test/app/sessionId.test.tsx` en verde (14 tests, incluido el
      nuevo "el hueco de vídeo aparece solo dentro de la ventana de la sesión,
      no antes ni después" — test de pantalla que ya existía, extendido según
      pedía el criterio); `npx tsc --noEmit` limpio; `npm run lint` limpio
      (exit 0); `npm test` completo en verde (60/61 suites, 1 skip
      preexistente, 637 tests).
- [x] Tarea 6 — Cobertura de casos límite (permiso denegado, timeout, colgar)
      (`c82a3e4`). Hallazgo real: el timeout de conexión de 30 s que
      describe la spec §6 ("La otra persona no tiene cámara... mi lado se
      queda en 'conectando' indefinidamente salvo timeout razonable") no
      estaba implementado en `use-video-call.ts` pese al criterio de la Tarea
      4 ("transición de estados") — se añadió `CONNECT_TIMEOUT_MS = 30_000`
      (exportada) con un `setTimeout` que pasa a `'error'` con "No se pudo
      conectar el vídeo." si nadie completa la conexión a tiempo, limpiado en
      `cleanup()`, al conectar y al fallar por permiso denegado (para no pisar
      30 s después el mensaje de permiso con el genérico de timeout). Tests
      añadidos en `use-video-call.test.ts` (4 nuevos): `getUserMedia`
      rechazado deja `error` sin crashear; sin respuesta de la otra parte,
      `jest.useFakeTimers()` + `advanceTimersByTime(CONNECT_TIMEOUT_MS)` pasa
      de `'conectando'` a `'error'`; colgar cierra el `RTCPeerConnection`
      (`close()` una vez) y sale del canal — un `offer` tardío del otro lado
      ya no llega ni revive el estado; volver a entrar tras colgar levanta un
      `RTCPeerConnection` nuevo (instancia distinta) sin arrastrar el mic
      muteado ni el error de la llamada anterior. `video-call-view.test.tsx`
      gana un test: permiso denegado pinta el aviso de texto sin desmontar los
      controles. Evidencia: `npx jest src/features/session/use-video-call.test.ts
      src/features/session/video-call-view.test.tsx` en verde (10 + 6 = 16
      tests); `npm test -- --coverage` en verde (60/61 suites, 1 skip
      preexistente, 642 tests, cobertura global 92.57/85.26/91.59/94.45 %,
      por encima del suelo de `jest.config.js` 89.82/82.56/91.49/91.38 %,
      exit 0); `npx tsc --noEmit` limpio; `npm run lint` limpio (exit 0);
      `npx expo export --platform web` sigue en verde (15 rutas exportadas)
      tras tocar `use-video-call.ts` (el sibling `.web.ts` no importa nada de
      ese archivo en runtime, solo tipos).
- [x] Tarea 7 — Cierre del bloque y actualización de `docs/plan/TODO.md`.
      Commits de código del bloque (6, por `git log --oneline`): `9829e15`
      (Tarea 1, dependencia + plugin + mock), `d0fae92` (Tarea 2,
      señalización en memoria), `de3c140` (Tarea 3, señalización sobre
      Supabase Realtime Broadcast), `00e1f6f` (Tarea 4, hook
      `use-video-call`), `5853e10` (Tarea 5, `VideoCallView` + integración +
      siblings `.web`), `c82a3e4` (Tarea 6, casos límite). Entrada de "Vídeo
      real en la sesión" añadida a `docs/plan/TODO.md`
      sustituyendo la línea suelta "Vídeo real en la sesión (spec propia)".
      Verificación final sobre el estado acumulado de las Tareas 1-6: `npm
      test` completo en verde (60/61 suites, 1 skip preexistente, 642 tests);
      `npm test -- --coverage` sin bajar el suelo de `jest.config.js`
      (92.57/85.26/91.59/94.45 % sobre el mínimo 89.82/82.56/91.49/91.38 %,
      exit 0 — los dos `.web.*` nuevos de la Tarea 5 quedan a 0 % de cobertura
      propia porque Jest nunca los resuelve bajo el preset nativo, igual que
      `use-color-scheme.web.ts`, y el conjunto sigue por encima del suelo);
      `npx tsc --noEmit` limpio; `npm run lint` limpio (exit 0); `npx expo
      export --platform web` en verde (15 rutas, incluida
      `/session/[sessionId]`). `test/app/layouts.test.tsx` dio un timeout
      aislado corriendo la suite completa con `--coverage`
      ("Exceeded timeout of 5000 ms"); repetido en solitario pasa limpio
      (7/7) — flakiness de carga de máquina en este entorno, no una
      regresión de este bloque (el archivo no toca nada de `video`).
      **Sin verificar, y no ejecutable desde un agente** (mismo precedente
      que la Tarea 11 de `sesiones`): la llamada real entre dos dispositivos
      físicos (cámara y audio en los dos sentidos) y que el config plugin de
      `react-native-webrtc` compile de verdad en un build de EAS — las dos
      necesitan `eas build --profile development` y hardware real. Hasta que
      el usuario las corra, todo lo marcado en este bloque está verificado
      solo contra mocks (`jest.setup.js`) y contra `expo export --platform
      web`, nunca contra WebRTC nativo de verdad.

## Pendiente del usuario

- [x] **[comprobador]** Android: compilar en local (`npx expo run:android`)
      para confirmar que el plugin nativo de `react-native-webrtc` (Tarea 1)
      compila, y en el emulador que la pantalla de sesión carga el módulo
      real (no el aviso de `'no-disponible'`) y pide permisos de cámara/mic.
      Hecho el 2026-09-27; detalle y un bug de señalización en «Hallazgos
      del comprobador» abajo.
- [ ] iOS (usuario): `eas build --profile development` para confirmar que
      el plugin compila también en iOS — el emulador no lo cubre.
- [ ] (usuario — el emulador no sirve: su cámara es una escena de juguete)
      Con ese build en dos móviles reales: abrir la misma sesión Lock-In
      desde los dos, comprobar que la llamada conecta (STUN público, sin
      TURN — puede no conectar en redes con NAT simétrico, ver la spec,
      "Qué problema resuelve, y cuál no") y que cámara y audio se ven/oyen
      en los dos sentidos, que mic/cámara/colgar responden, y que salir de
      la sesión o volver a entrar deja la llamada en el estado esperado.

## Fallback en Expo Go (2026-09-19)

- [x] `react-native-webrtc` se carga de forma perezosa
      (`src/features/session/webrtc.ts`, `loadWebRTC()`): `require` dentro de
      `try`, tras comprobar `NativeModules.WebRTCModule`. `use-video-call.ts`
      y `video-call-view.tsx` ya no lo importan en estático (solo `import
      type`). Sin módulo nativo (Expo Go) el hook devuelve el estado
      `'no-disponible'` sin tocar la señalización y la vista pinta «La
      videollamada necesita la app de desarrollo.»; el resto de la sesión
      arranca normal. Tests: `webrtc-unavailable.test.tsx`; `jest.setup.js`
      registra `NativeModules.WebRTCModule` para el doble.
- [ ] Sin verificar en dispositivo: abrir la app en Expo Go (iPhone) y
      comprobar que arranca y que la pantalla de sesión muestra el aviso.
      Es iOS: sigue siendo del usuario. **[comprobador]** puede cubrir la
      mitad Android (Expo Go en el emulador + `npx expo start`).

## Hallazgos del comprobador

### 2026-09-27 — WebRTC nativo en Android: compila, carga y pide permisos

Evidencia (local, ignorada por git): `e2e/artifacts/local/2026-09-27-webrtc/`.

**1. El plugin compila ✅** (backend mock, commit `61c9eaa`). `npx expo
prebuild --clean --platform android` + `npx expo run:android --variant
release --no-bundler` con `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`
→ `BUILD SUCCESSFUL in 28m 18s`; el APK lleva
`lib/{arm64-v8a,armeabi-v7a,x86,x86_64}/libjingle_peerconnection_so.so`
(`build.log`). No se instaló: el emulador tenía el APK preview de EAS del
2026-09-23 (otra firma, `INSTALL_FAILED_UPDATE_INCOMPATIBLE`) con la sesión
de Verif iniciada, y se usó ese para lo demás. Antes hubo que rehacer
`node_modules` con `npm ci`: estaba a medias desde el 2026-09-24, sin `expo`
ni `react-native` y sin `.package-lock.json`, y ninguna build nativa podía
salir así.

**2. Carga el módulo real y pide los permisos ✅** (APK de EAS del 23-sep,
**Supabase real**: `[lockin] backend de datos: Supabase` en logcat).
- Al arrancar: `Loading library: jingle_peerconnection_so … ok` y
  `com.oney.WebRTCModule` crea sus fábricas de códec (`logcat-arranque.txt`).
- Pasos: «Video Prueba» (cuenta anónima `e139c7ab-…`, que quedó del
  2026-09-24) da like a Verif por `record_decision` → Like en la app →
  «¡Match!» (`02-match.png`) → «Video Prueba» propone por
  `propose_session` para las 20:29:51 UTC → «Aceptar sesión» en el chat
  (`04-aceptada.*`) → «Entrar a la sesión» a las 20:25:07.
- Sale el diálogo del sistema «Allow lockin to record audio?»
  (`06-permiso.*`) y luego «…take pictures and record video?»
  (`07-permiso2.xml`); tras conceder los dos, `getUserMedia(audio)` y
  `getUserMedia(video)` en logcat, y la vista propia pinta la cámara del
  emulador con «Silenciar micrófono / Apagar cámara / Colgar»
  (`08-video.png`). No sale «La videollamada necesita la app de
  desarrollo».
- La llamada 1:1 en sí no se puede dar por comprobada con un solo emulador
  (la otra parte era un script, sin medios).

**3. ❌ Bug: la llamada solo conecta si quien ofrece entra el último.**
`use-video-call.ts` manda el `offer` **una sola vez**, al arrancar, por un
Broadcast que no guarda nada. Si la otra persona todavía no está en el canal,
la oferta se pierde y nadie la repite: quien contesta nunca ofrece, así que la
llamada no conecta nunca, y a los 30 s quien ofrece ve «No se pudo conectar
el vídeo.» aunque la otra persona entre después. Aquí ofrece Verif
(`a5fe4d5c… < e139c7ab…`).
- Con la app ya dentro, «Video Prueba» se une a `lockin:video:<sesión>` y
  escucha 25 s: **no recibe nada** (`escucha-1-app-ya-dentro.txt`).
- Con «Video Prueba» ya escuchando, la app sale y vuelve a entrar: recibe
  `offer` y 11 `ice-candidate` en el mismo segundo
  (`escucha-2-app-entra-despues.txt`).

Con la ventana de 5 minutos, lo normal es que las dos personas lleguen con
minutos de diferencia, así que esto rompe más o menos la mitad de las
llamadas, según quién tenga el id menor. Una salida posible: que quien
contesta mande un `ready`/`hello` al unirse y quien ofrece (re)envíe la
oferta al recibirlo; o volver a ofrecer cuando la presencia pase a «Está
aquí».

**4. ⚠️ Relacionado, visto en la misma captura.** En la escucha llegó un
`ice-candidate` *antes* que el `offer`. `handleMessage` hace
`addIceCandidate` sin cola y se traga el error, así que los candidatos que
llegan antes que la oferta, o mientras `setRemoteDescription` sigue en
vuelo, se pierden sin avisar. Aquí no llegó a conectar nada, así que no se
sabe si rompe la llamada, pero merece una cola de candidatos pendientes.

**Arreglo de 3 y 4 (2026-09-27), solo contra mocks.** Nuevo mensaje `ready`
en `VideoSignalKind`. Cada lado lo manda al tener cámara y micrófono; quien
contesta responde `ready` a un `ready`, y quien ofrece contesta a un `ready`
con su offer (creado una vez y reenviado tal cual). Un offer o answer repetido
tras aplicar la descripción remota se ignora. Los candidatos que llegan antes
de la descripción remota se encolan y se aplican al tenerla. Tests nuevos en
`use-video-call.test.ts`: conecta con quien ofrece llegando primero (fallaba
antes del arreglo, se quedaba en `conectando`), conecta con quien contesta
llegando primero, y un candidato anterior al offer se aplica (fallaba antes:
se perdía). El contrato del canal cubre ya `ready`. `npm test -- --coverage`
en verde (83 suites, 978 tests, 94.73/89.58/94.47/96.26 %), `npx tsc
--noEmit` y `npm run lint` limpios. **Falta en dispositivo:** el APK del
emulador es el de EAS del 23-sep, sin este arreglo. Hay que instalar una build
nueva (otra firma: desinstalar el de EAS e iniciar sesión otra vez) y repetir
la escucha de arriba contestando `ready`.

**5. ⚠️ El timeout de 30 s cuenta desde antes del diálogo de permisos.**
`RTCPeerConnection` se crea a las 20:25:08 y `getUserMedia` resuelve a las
20:25:40, porque el diálogo de permisos estuvo abierto 32 s. A los pocos
segundos de conceder ya se ve «No se pudo conectar el vídeo.» (`08-video.png`).
Con el bug 3 arreglado seguiría pasando la primera vez que alguien tarde en
leer el diálogo.

**Arreglo de 5 y de volver a entrar (2026-09-27), solo contra mocks.**
- El tiempo de espera arranca cuando `getUserMedia` resuelve, no al crear
  la conexión. Un error por tiempo de espera ya no es definitivo: si la otra
  parte llega después, la llamada conecta y el error se borra.
- Volver a entrar (spec §6): cada `ready` lleva `{ entry }`, un id por
  entrada. Si llega un `ready` de una entrada distinta a la ya negociada, es
  que la otra parte salió y volvió: quien se queda tira su
  `RTCPeerConnection` y levanta uno nuevo con los mismos medios. No hace
  falta ICE restart, porque es una conexión nueva.
- La limpieza (colgar o salir de la sesión) manda `hangup`. **Cambio de
  comportamiento**: al recibirlo, el otro lado ya no cuelga del todo. Tira la
  conexión muerta, sin vídeo remoto congelado, y espera con su cámara en
  `'conectando'` y sin tiempo de espera, para que quien colgó pueda volver a
  entrar. `video-call-view.test.tsx` («colgar deja de pintar el vídeo…») se
  ajustó a esto.
- Tests nuevos en `use-video-call.test.ts`: el tiempo de espera no cuenta
  mientras se piden los permisos; tras el tiempo de espera, una llegada
  tardía conecta igual; volver a entrar, tanto quien ofrece como quien
  contesta; desaparecer sin `hangup` (app cerrada) y volver; un `ready`
  repetido de la misma entrada no tira la llamada; `failed` pasa a error;
  salir mientras se piden los permisos suelta la cámara.
- `npm test -- --coverage` en verde (83 suites, 986 tests,
  94.91/89.67/94.61/96.5 %); `npx tsc --noEmit` y `npm run lint` limpios.

**Limpieza.** «Video Prueba» borró su perfil y su `user_settings`; por
cascada se fueron el match `0e606c2e-…` y la sesión `efb0449a-…`
(`limpieza.txt`: no queda nada). Su fila en `auth.users` sigue ahí, como las
dos anteriores: solo se quita desde el dashboard. Los permisos de cámara y
micrófono se revocaron con `pm revoke` para dejar la app como estaba.

**Mitad Android del fallback en Expo Go: ⚠️ sin hacer.** El aviso sale en
la misma pantalla de sesión; para llegar hace falta iniciar sesión en Expo Go
con una cuenta real (la contraseña de `+lockin3`) y montar otra sesión
aceptada como la de arriba.

### 2026-09-29 — tras `fd3a2cd` y `b27481e`: carga, pide permisos y el offer ya llega

APK release local sobre `b27481e`, **Supabase real** (`[lockin] backend de
datos: Supabase` en logcat). Evidencia (local, ignorada):
`e2e/artifacts/local/2026-09-29-webrtc/`. Ojo al compilar: al cambiar de mock
a Supabase, Gradle dio `createBundleReleaseJsAndAssets UP-TO-DATE` y el primer
APK seguía siendo mock; hubo que forzar `--rerun` (ver memoria local).

- ✅ **Módulo nativo**: al arrancar, `Loading library: jingle_peerconnection_so
  … ok` y `com.oney.WebRTCModule` crea sus fábricas (`logcat-arranque.txt`).
- ✅ **Permisos**: cuenta nueva `+lockinvideo29` (perfil «Video Comprob»,
  Lock-In) y cuenta anónima de apoyo «Comprob Apoyo» → match Lock-In
  `42b4c98b-…` → el apoyo propone por `propose_session` para las 17:39:32 UTC
  → «Aceptar sesión» → «Entrar a la sesión» a las 17:35:15. Salen «Allow lockin
  to record audio?» (`20-permiso-mic.*`) y «…take pictures and record video?»
  (`22-permiso-cam.*`); tras conceder, `getUserMedia(audio)` y
  `getUserMedia(video)` a las 17:36:10 (`logcat-sesion.txt`) y la vista propia
  pinta la cámara del emulador con «Silenciar micrófono / Apagar cámara /
  Colgar» (`23-tras-permisos.png`). No sale «La videollamada necesita la app
  de desarrollo».
- ✅ **Hallazgo 5 arreglado en dispositivo**: el diálogo de micrófono estuvo
  abierto 55 s a propósito (`21-permiso-mic-35s.*`). A las 17:36:37, 82 s
  después de entrar, la vista sigue en «Conectando…» (`23-tras-permisos.png`);
  el 2026-09-27 a esas alturas ya salía «No se pudo conectar el vídeo.». El
  error llega después, a los ~30 s de `getUserMedia` (`24-tras-escucha.*`),
  como toca sin nadie que conteste.
- ✅ **Hallazgo 3 arreglado en dispositivo**: aquí ofrece la app
  (`63f4f872… < f7955fda…`) y entra **primero**. El apoyo se une al canal 1 min
  40 s después y manda `ready`: en el mismo segundo recibe `offer` (SDP 3736
  chars) y 11 `ice-candidate` (`escucha-apoyo-entra-despues.txt`). El
  2026-09-27, en esta misma situación, no recibía nada.
- ⚠️ La conexión completa (answer, medios en los dos sentidos, volver a entrar,
  tiempo de espera superado y llegada tardía) sigue sin comprobar: el apoyo
  es un script sin medios y la cámara del emulador es de juguete. Sigue siendo
  la casilla del usuario con dos móviles.

**Limpieza.** «Comprob Apoyo» borró su perfil y su `user_settings`; por
cascada se fueron el match y la sesión `16b8414c-…` (`limpieza.txt`). Permisos
de cámara y micrófono revocados con `pm revoke`. **Queda** el perfil «Video
Comprob» (`63f4f872-…`, cuenta `joeldetorres123+lockinvideo29@gmail.com`): la
contraseña elegida en la app no sirvió para iniciar sesión desde un script
(probablemente la tocó el autocompletado de Google al escribirla), y la app no
tiene borrar cuenta. También siguen en el deck real dos restos de sesiones
anteriores: «Comprob Video» y «Verif». Los tres solo se quitan desde el
dashboard (perfil + `auth.users`).

### 2026-09-29 — mitad Android del fallback en Expo Go: ❌ la app no llega a la sesión

Expo Go 57.0.9 (`host.exp.exponent`, instalado por `npx expo start --go
--android` en el AVD `lockin`) sobre `21bdd67` — lo que falla no cambia
hasta `9cfddac`. **Backend mock**: `EXPO_NO_DOTENV=1
EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`, y el log dice `[lockin] backend de datos:
mock en memoria`. El SDK es compatible: el proyecto es SDK 57, que es el
`latest` de npm, y Expo Go carga el manifiesto (`SDK version: 57.0.0`).
Evidencia (local, ignorada): `e2e/artifacts/local/2026-09-29-expo-go/`.

- **Arranca, pero solo hasta el onboarding.** Al cargar el bundle,
  `require('expo-notifications')` lanza en Expo Go Android: *«Android Push
  notifications (remote notifications) functionality provided by
  expo-notifications was removed from Expo Go with the release of SDK 53»*
  (`03-app.png`, `expo-start.log`). El `require` se evalúa al importar el
  módulo: `session-reminder-sync.tsx:22` llama a `createNotificationsPort()`
  en el ámbito del módulo, `features/session/index.ts` lo reexporta y
  `(tabs)/_layout.tsx` importa de ahí. Por eso Expo Router da `(tabs)/_layout`,
  `(tabs)/matches`, `chat/[matchId]` y `session/[sessionId]` como *«missing
  the required default export»*.
- El onboarding sí se ve y se puede recorrer (`06-app.png`). Pero al pulsar
  «Crear perfil», la navegación a `(tabs)` revienta con `TypeError: Cannot
  read property 'ErrorBoundary' of undefined` (`src/app/_layout.tsx:73`,
  `<Stack>`), y la app se queda en el splash de Expo Go
  (`17-tras-descartar.png`, `18-15s-despues.png`, `logcat.txt`).
- Así que **la pantalla de sesión no se puede abrir en Expo Go Android**: no
  se ha podido ver «La videollamada necesita la app de desarrollo.», ni el
  Pomodoro, ni la presencia. El fallback de WebRTC no se ha llegado a
  ejercitar. Quien bloquea es `expo-notifications`, no `react-native-webrtc`.
- Arreglo propuesto (es de **sesiones**, anotado también en
  `docs/plan/todo/sesiones.md`): que `createNotificationsPort()` devuelva
  `null` en Expo Go Android, igual que `loadWebRTC()` —con un `try` alrededor
  del `require` o mirando `Constants.executionEnvironment === 'storeClient'`—,
  o que el puerto se cree de forma perezosa y no al importar el módulo.
- **iPhone**: no se ha comprobado. El mensaje habla solo de Android, así que
  en iOS podría no lanzar, pero eso sigue siendo cosa del usuario. La casilla
  de «Fallback en Expo Go» sigue sin marcar.

### 2026-09-29 (2.ª pasada) — mitad Android del fallback en Expo Go: ⚠️ la app ya llega al chat, pero el mock no deja abrir una sesión aceptada

Expo Go 57.0.9 en el AVD `lockin`, `HEAD` = `a7a1527` (incluye `56fec3a`).
**Backend mock**: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1 npx expo
start --go` (la primera vez con `--clear`), y Metro y logcat dicen
`[lockin] backend de datos: mock en memoria`. Evidencia (local, ignorada):
`e2e/artifacts/local/2026-09-29-expo-go-2/` — la pasada válida es la posterior
al reinicio del emulador (`28-…` a `46-…`, `expo-start-2.log`, `logcat.txt`).

- ✅ **Lo de `56fec3a` se sostiene.** El bundle carga sin el aviso rojo de
  `expo-notifications`; onboarding → «Crear perfil» → tabs sin
  `ErrorBoundary` (`35-…`, `36-…`); Descubrir, like a Marc → «¡Match!»
  (`39-…`) → chat (`40-…`) → «Agendar sesión Lock-In» → propuesta enviada,
  «Esperando a Marc · hoy 21:30 · 1 bloque» (`41-…`, `42-…`); tab Matches
  (`46-…`). Un enlace directo a `/session/inexistente` pinta «Esta sesión no
  está disponible» (`43-…`): el módulo de la ruta de sesión, que antes era
  *«missing the required default export»*, ya se evalúa. En `logcat.txt`
  (desde el reinicio) no hay ni un error de `ReactNativeJS`, ni
  `ErrorBoundary`, ni *default export*, ni `expo-notifications`.
- ⚠️ **No se ha visto «La videollamada necesita la app de desarrollo.», ni el
  Pomodoro, ni la presencia.** La pantalla solo monta `VideoCallView` con la
  sesión `aceptada` y dentro de la ventana de entrada
  (`src/app/session/[sessionId].tsx:103-120`), y en el mock nadie acepta: la
  otra parte no responde nunca (`src/data/mock/sessions.ts:124-135`, sin
  autoaceptación ni sesión sembrada; `incomingLikes` sí existe para los
  matches, pero no hay equivalente para las propuestas). Tampoco se puede
  forzar desde fuera: el inspector de Expo Go solo expone el agente de host
  (`Runtime.evaluate` → `-32601`), así que no hay forma de llamar a
  `respond()` como Marc sin tocar código. **Lo que falta no es un fallo de
  la app, es una vía para tener una sesión viva en el mock.** Propuesta para
  **sesiones**/**datos**: que los perfiles de `SEED_RECIPROCAL_IDS` acepten
  al instante las propuestas que reciben en el mock, como ya hacen con los
  likes; con eso el recorrido entero se puede repetir aquí y en el E2E de
  mock.
- Entorno, para quien repita: el host (8 GB) iba justo de memoria y el
  emulador acabó con ANR en Expo Go y en `com.google.android.tts`, `adb` que se
  colgaba y un `app.lockin.mobile` de otra sesión atascado en primer plano.
  La primera tanda (`01-…` a `27-…`, `logcat-1.txt`) se perdió por eso, y
  además el Metro lanzado por WMI murió a las 08:37. Nada de eso es de la app:
  en esa tanda no hay ningún error JS. Lo arregló `adb reboot`. Con el
  emulador lento, `uiautomator dump` no termina (hay animación continua) y
  `screencap` a veces tampoco: la consola del emulador (`screenrecord
  screenshot <dir>`) sí responde.
- **iPhone**: sigue sin comprobar; es del usuario. La casilla de «Fallback en
  Expo Go» sigue abierta.

### 2026-09-30 — mitad Android del fallback en Expo Go: ✅ la sesión monta la vista de vídeo con el aviso

Expo Go 57.0.9 en el AVD `lockin`, `HEAD` = `4a698f1` (incluye `73ec64f`).
**Backend mock**: `CI=1 EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1 npx
expo start --go --android --clear`; Metro dice `[lockin] backend de datos:
mock en memoria`. Evidencia (local, ignorada):
`e2e/artifacts/local/2026-09-30-expo-go/`.

- Onboarding «Compañero de Lock-In» → formulario → «Crear perfil» → tabs
  (`12-tras-crear.*`) → like a Alba Ferrer (recíproca) → «¡Match!» «MODO
  COMPAÑERO DE LOCK-IN» (`13-match.*`) → chat (`14-chat.*`) → «Agendar sesión
  Lock-In», hoy 20:30, 1 bloque → **«Sesión acordada»** al instante
  (`17-propuesta.*`): `73ec64f` hace que Alba acepte sola.
- A las 20:25:33 (sala abierta) sale «Es la hora · Entrar a la sesión»
  (`19-entrar.*`). Al entrar, la pantalla «Sesión Lock-In» monta la vista de
  vídeo con **«La videollamada necesita la app de desarrollo.»**, Alba «Aún no
  ha entrado», cuenta atrás «EMPIEZA EN 3:54» y «Salir» (`21-sesion.png`). El
  resto de la sesión arranca normal. `uiautomator dump` no sirve en esa
  pantalla (animación continua): la evidencia es la captura.
- Tab Matches con Alba (`23-matches.*`). `logcat.txt` (`*:E ReactNativeJS:V`)
  sin un solo error ni aviso de JS; Metro tampoco registra errores.
- **iPhone** sigue sin comprobar (del usuario): la casilla de «Fallback en
  Expo Go» queda abierta solo por esa mitad.

### 2026-09-30 — controles de la videollamada desbordados (APK nativo, mock)

En el Pixel 7 del emulador (412 dp), la fila «Silenciar micrófono / Apagar
cámara / Colgar» es más ancha que la vista remota y se corta por los dos lados.
Además, «No se pudo conectar el vídeo.» queda debajo de la miniatura propia.
Causa y capturas en `docs/plan/todo/visual.md` → «Hallazgos del comprobador»,
2026-09-30, punto 3 (`styles.controls` de `video-call-view.tsx`: fila absoluta
sin `flexWrap` ni límites laterales).

*2026-10-01, arreglado en `dc29e08`:* la fila va de borde a borde
(`left`/`right` = `Spacing.two`), centrada y con `flexWrap`; el botón del micro
muestra «Silenciar» / «Activar mic» con la etiqueta de accesibilidad entera; y
el aviso de estado se estrecha por los dos lados cuando está la miniatura
propia, para no quedar debajo. Tests en `video-call-view.test.tsx`. Falta verlo
en el emulador (412 dp, claro y oscuro): queda en la casilla `[comprobador]`
de `visual.md`.
*2026-10-01, comprobador: ⚠️ no comprobable* — el toolchain de Android ha
vuelto a desaparecer de esta máquina; ver `visual.md` → «Hallazgos del
comprobador», 2026-10-01.
