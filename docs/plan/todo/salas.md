# salas — Salas Lock-In grupales (Fase 3)

Spec: `docs/superpowers/specs/2026-10-02-salas-grupales-design.md`
Plan: `docs/superpowers/plans/2026-10-02-salas-grupales.md`
Agente: `.claude/agents/salas.md`

> **Diseñado sin el usuario delante (2026-10-02).** Antes de la Tarea 1, el
> usuario revisa la tabla «Decisiones tomadas sin el usuario (revisar)» de la
> spec. Si cambia alguna, se reabre la Tarea 0 y se corrigen spec, plan y este
> archivo antes de escribir código.

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
- [ ] [Codex] Tarea 5 — Presencia de sala: `topicPrefix` en `supabase/presence.ts`, `roomPresence` en `active.ts`, `useRoomPresence`
- [ ] [Codex] Tarea 6 — `roomRowView`, `RoomRow` y `useLiveRooms`
- [ ] [Claude] Tarea 7 — Pantalla «Convocar sala» (`/room/new`) e `InviteePicker`
- [ ] [Claude] Tarea 8 — Pantalla de la sala (`/room/[roomId]`) y `RoomsSection` en Matches (cruce con `chat`)
- [ ] [Codex] Tarea 9 — Avisos locales de salas (`room-reminders.ts`, `RoomReminderSync`; cruce de una línea con `sesiones` y con el layout de tabs)
- [ ] [Claude] Tarea 10 — E2E `room.yaml` en la variante `supabase`, encadenado tras `agreement.yaml`
- [ ] [Claude] Tarea 11 — Verificación final y cierre (CI, E2E, contrato, Schema drift con su excepción anotada)
- [ ] [comprobador] Tarea 12 — Recorrer convocar, entrar y cancelar una sala en el emulador (mock)

## Pendiente del usuario

- [ ] Revisar las decisiones tomadas sin el usuario (spec, primera sección). Las
      que más cuesta deshacer una vez empezada la Tarea 2: cómo se forma la sala
      (desde matches) y el ciego de invitados.
- [ ] Aplicar `supabase/migrations/20261002000100_lockin_rooms.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor al cerrar la Tarea 11. Hasta
      entonces el job remoto de `Schema drift` suma esta migración a la
      excepción vigente (memoria `schema-drift-remoto-rojo-esperado.md`).

## Hallazgos del comprobador

(ninguno todavía)
