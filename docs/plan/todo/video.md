# TODO — video

Plan: `docs/superpowers/plans/2026-09-16-video-real-sesion.md`. Spec:
`docs/superpowers/specs/2026-09-16-video-real-sesion-design.md`. Una casilla
por tarea del plan; se marca al hacer su commit, con la evidencia real al
lado (comando y resultado) — no solo la marca.

Alcance de archivos: ver `docs/plan/PLAN.md` → bloque 10. Cruce de una línea
en `src/app/session/[sessionId].tsx` (dueño original: `sesiones`).

Orden: 1 → 2 → 3 → 4 → 5 → 6 → 7 (ver "Orden" del plan para el detalle de
qué puede solaparse).

- [ ] Tarea 1 — Dependencia, plugin de `react-native-webrtc` y mock de test
- [ ] Tarea 2 — Señalización en memoria (`src/data/video-signal.ts`)
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
