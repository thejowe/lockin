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
- [x] Tarea 9 — Recordatorios locales — `expo-notifications` instalado (`npx expo
  install`), canal `lockin-sessions` y trigger de fecha confirmados contra los
  docs de SDK 57 (Android 12+ solo pide el permiso de manifiesto
  `SCHEDULE_EXACT_ALARM`, ya en `app.json`; no hay permiso en tiempo de
  ejecución adicional en Android 14). `reminders.ts` (reconciliación pura),
  `notifications-port.ts` (puerto real), `reminder-permission.ts` (aviso
  compartido con `SessionCard`) y `session-reminder-sync.tsx` (montado en
  `(tabs)/_layout.tsx`, reconcilia al abrir la app y en cada cambio de matches
  o sesiones). Mock de `expo-notifications` en `jest.setup.js`. `tsc --noEmit`,
  `npm test -- --coverage`, `npm run lint` y `npm run format:check` en verde
  (se añadió `reminder-permission.test.ts` para cubrir el fallback si falla la
  lectura del descarte guardado, y así no bajar el umbral de cobertura).
- [ ] Tarea 10 — E2E Android de entrar y salir
- [ ] Tarea 11 — Verificación final

## Verificación manual (no automatizable)

- [ ] Dos móviles reales: el punto "está aquí" aparece y desaparece al entrar y salir la otra persona
- [ ] Aviso real 5 minutos antes en Android con la app cerrada
- [ ] Contrato opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1`) con los casos de sesiones en verde
