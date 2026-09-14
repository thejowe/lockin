# TODO — sesiones

Plan: `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`. Una casilla por tarea del plan; se marca al hacer su commit.

- [x] Tarea 1 — Dominio: tipos, reglas de tiempo, errores
- [x] Tarea 2 — Contrato de `LockInSessionRepository` y mock
- [x] Tarea 3 — Migración SQL (tablas, RLS, RPCs) y comprobación en PGlite
- [x] Tarea 3b — Migración aplicada en `grrzmzktrhksbttpbblg` por el usuario; `schema-drift.yml` en verde —
  comprobado 2026-09-14 en el push de f7e9e37:
  https://github.com/thejowe/lockin/actions/runs/34895140336, con el job
  remoto `Comparar grrzmzktrhksbttpbblg (solo lectura)` ejecutado (no
  `skipped`) y `remote.diff` → `Sin diferencias.`. En el push anterior
  (6c6a8f8, run 34893680909) el diff aún tenía 119 líneas, 0 con `+`: solo
  faltaban `lockin_sessions`, `session_attendance` y sus políticas, índices y
  grants, o sea, la migración de sesiones sin aplicar y nada más.
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
- [x] Tarea 10 — E2E Android de entrar y salir — `e2e/session-now.sql` (trigger
  `e2e_session_now`, inserta una sesión aceptada a 3 minutos al ver el mensaje
  E2E), `e2e/session.yaml` (entra, confirma "Salir" → "Salir de la sesión"),
  `verifySessionAttendance` en `e2e/verify.mjs`. `e2e/run.mjs` engancha el caso
  tras `full-journey.yaml` y su oráculo, añade `session-now.sql` al seed y
  escribe su propia carpeta de evidencia (`session/`). Guardia
  `session.test.mjs` (4 casos) en verde; `tsc --noEmit` y `npm run lint` en
  verde. `E2E Android (supabase)` y `E2E Android (mock)` en verde en Actions:
  https://github.com/thejowe/lockin/actions/runs/34891490592 — con las dos
  líneas de oráculo (`Postgres: alta, perfil, ... verificados.` y `Postgres:
  entrada y salida de la sesión Lock-In verificadas.`) en el log del job
  `supabase`. El E2E usa Postgres local desechable (`supabase db reset --local`
  con las migraciones del repo), así que no depende de la Tarea 3b —esa
  bloquea `schema-drift.yml` contra el proyecto real `grrzmzktrhksbttpbblg`,
  no este workflow. De paso, se regeneró `package-lock.json`
  (`fix(deps)`, commit 914ebf7): la Tarea 9 lo había dejado sin sincronizar
  para el npm que trae Node 22 en Actions (npm 10 pedía `@emnapi/core` y
  `@emnapi/runtime@1.11.3` que el lock no traía), aunque npm 11 local no lo
  detectaba.
- [ ] Tarea 11 — Verificación final — abierta; faltan el E2E del Step 2 y los
  Steps 3 y 4.
  - [x] Step 1, todo el repo en verde en local (2026-09-14, sobre f7e9e37):
    `npm run lint` limpio; `npm test -- --coverage` con 509 tests en 50
    suites (1 suite y 52 tests skipped, los de contrato opt-in) y Jest salió
    con 0, así que se cumple el suelo 89.82/82.56/91.49/91.38 de
    `jest.config.js`. `prettier --check --end-of-line auto .` solo marca
    `supabase/drift-check.mjs`, y es un falso positivo de Windows: la copia
    local mezcla CRLF y LF, y el blob commiteado pasa `prettier --check`. El
    grep de `LockInCta|pendingSessions|Pendiente de la Tarea 4` sale vacío
    (el único resultado era un comentario de `session-card.tsx`, reescrito
    en f7e9e37). `tsc --noEmit` falla aquí con `'/session/[sessionId]'` no
    asignable a las rutas tipadas, pero es por `.expo/types/router.d.ts`:
    lo genera Expo, está en gitignore y está desactualizado (no conoce la ruta
    de sesión). Sin ese archivo `tsc` sale con 0, igual que el job `Tipos` de
    CI, que parte de un checkout limpio. Antes, en f7e9e37, se pasó prettier a
    `seed.ts`, `supabase/index.ts`, `sessions.ts` y `sessions.test.ts`, que
    tenían el job `Formato` en rojo desde 82e4088.
  - [ ] Step 2, CI completo del último commit (f7e9e37). `CI` en `success`
    (Tipos, Lint, Formato, Tests, Runner E2E y Export web):
    https://github.com/thejowe/lockin/actions/runs/34895140293. `Schema
    drift` en `success`, con el job remoto ejecutado y `Sin diferencias.`
    (ver Tarea 3b). **`E2E Android` en rojo, pero por el runner y no por el
    caso**: los dos jobs caen en `android-actions/setup-android@v4` con
    `Warning: Failed to find package 'tools'` y `Error: The process
    '/usr/local/lib/android/sdk/cmdline-tools/20.0/bin/sdkmanager' failed
    with exit code 1`, antes de compilar nada. Pasa igual en el run
    https://github.com/thejowe/lockin/actions/runs/34895140288 (f7e9e37) y en
    los dos intentos del 34893680768 (6c6a8f8). `e2e.yml` no ha cambiado
    desde el run verde 34891490592 (914ebf7, 30 minutos antes), así que el
    cambio viene de fuera: el sdkmanager de `cmdline-tools` 20.0, fijado en
    `e2e.yml`, ya no encuentra el paquete `tools` que instala la acción. No
    se toca `e2e.yml` desde este bloque porque es terreno de `calidad`.
  - [ ] Step 3, contrato opt-in: **no se ejecuta, a propósito** (ver la
    casilla en "Verificación manual").
  - [ ] Step 4, dos móviles: sin confirmar por el usuario todavía.

## Verificación manual (no automatizable)

- [ ] Dos móviles reales: el punto "está aquí" aparece y desaparece al entrar y salir la otra persona
- [ ] Aviso real 5 minutos antes en Android con la app cerrada
- [ ] Contrato opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1`) con los casos de sesiones en verde —
  **abierta a propósito, no se ejecuta contra `grrzmzktrhksbttpbblg`**. La
  suite limpiaba entre casos con `dev_reset_current_user()`, que se retiró del
  proyecto real el 2026-09-13. Sin ella cae al respaldo de un alta anónima por
  caso, y con los casos de sesiones pasa del límite de 30 altas por hora e IP:
  forzar un verde ensuciaría la base real y chocaría con el límite. Las reglas
  sí están cubiertas contra Postgres real por el E2E (entrar y salir, oráculo
  en `e2e/verify.mjs`) y por `session_is_live()` en PGlite. Dos salidas, a
  decidir por el usuario: (a) una base local con Docker (`supabase start` más
  las migraciones del repo), donde reinstalar la función de limpieza no toca
  producción; o (b) un proyecto Supabase de pruebas separado, con una función
  de limpieza que solo exista allí.
