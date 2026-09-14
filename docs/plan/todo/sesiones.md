# TODO — sesiones

Plan: `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`. Una casilla por tarea del plan; se marca al hacer su commit.

- [x] Tarea 1 — Dominio: tipos, reglas de tiempo, errores
- [x] Tarea 2 — Contrato de `LockInSessionRepository` y mock
- [x] Tarea 3 — Migración SQL (tablas, RLS, RPCs) y comprobación en PGlite
- [ ] Tarea 3b — Migración aplicada en `grrzmzktrhksbttpbblg` por el usuario; `schema-drift.yml` en verde
- [x] Tarea 4 — Repositorio de Supabase — `SessionRow`/`SessionAttendanceRow` y
  los RPCs `propose_session`/`respond_session`/`cancel_session`/`join_session`/
  `leave_session`/`server_now` en `database.types.ts`; `createSupabaseSessionRepository()`
  en `src/data/supabase/sessions.ts`, con mapeo, traducción de `LI00x` a los
  errores de dominio y canal de realtime por match; 13 tests sin red en
  `sessions.test.ts`. Sustituido el `pendingSessions` provisional en `index.ts`
  y las dos funciones provisionales de `contract.test.ts` por la implementación
  real. `tsc --noEmit`, `npm test` y `npm run lint` en verde. **Rehecha
  2026-09-14 tras perderse la primera vez por quedar sin commit** (ver historial
  de este archivo) — esta vez el commit incluye el código, no solo la casilla.
- [x] Tarea 5 — Presencia (memoria y Realtime)
- [x] Tarea 6 — Lógica pura de reloj, tramos y textos
- [x] Tarea 7 — Pantalla de sesión
- [x] Tarea 8 — Tarjeta del chat y hoja de propuesta
- [ ] Tarea 9 — Recordatorios locales
- [ ] Tarea 10 — E2E Android de entrar y salir
- [ ] Tarea 11 — Verificación final

## Verificación manual (no automatizable)

- [ ] Dos móviles reales: el punto "está aquí" aparece y desaparece al entrar y salir la otra persona
- [ ] Aviso real 5 minutos antes en Android con la app cerrada
- [ ] Contrato opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1`) con los casos de sesiones en verde
