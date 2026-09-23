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

- [ ] **[comprobador]** Android: compilar en local (`npx expo run:android`)
      para confirmar que el plugin nativo de `react-native-webrtc` (Tarea 1)
      compila, y en el emulador que la pantalla de sesión carga el módulo
      real (no el aviso de `'no-disponible'`) y pide permisos de cámara/mic.
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
