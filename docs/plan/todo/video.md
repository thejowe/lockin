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
- [ ] Tarea 3 — Señalización sobre Supabase Realtime Broadcast
- [ ] Tarea 4 — Hook `use-video-call.ts` (WebRTC, offer/answer, ICE)
- [ ] Tarea 5 — Pantalla `video-call-view.tsx` e integración en la sesión
- [ ] Tarea 6 — Cobertura de casos límite (permiso denegado, timeout, colgar)
- [ ] Tarea 7 — Cierre del bloque y actualización de `docs/plan/TODO.md`

## Bloqueo conocido

La verificación real de la llamada entre dos dispositivos (cámara y audio en
los dos sentidos) necesita un build de dev client de EAS y dos móviles
físicos — no es algo que un agente pueda ejecutar. No bloquea las Tareas 1-7,
que avanzan contra mocks; se cierra al final con la palabra del usuario,
igual que la Tarea 11 de `sesiones`.
