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
- [ ] Tarea 6 — Cobertura de casos límite (permiso denegado, timeout, colgar)
- [ ] Tarea 7 — Cierre del bloque y actualización de `docs/plan/TODO.md`

## Bloqueo conocido

La verificación real de la llamada entre dos dispositivos (cámara y audio en
los dos sentidos) necesita un build de dev client de EAS y dos móviles
físicos — no es algo que un agente pueda ejecutar. No bloquea las Tareas 1-7,
que avanzan contra mocks; se cierra al final con la palabra del usuario,
igual que la Tarea 11 de `sesiones`.
