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
- [x] Tarea 11 — Verificación final — cerrada el 2026-09-15 con el Step 4
  confirmado por el usuario en dos dispositivos reales.
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
  - [x] Step 2, CI completo del último commit: **cerrado en 45f24f2**
    (2026-09-14), con los tres workflows en verde sobre el mismo commit:
    `CI` (Tipos, Lint, Formato, Tests, Runner E2E y Export web)
    https://github.com/thejowe/lockin/actions/runs/34899687002; `Schema
    drift` con el job remoto ejecutado y `remote.diff` → `Sin diferencias.`
    https://github.com/thejowe/lockin/actions/runs/34899686848; y `E2E
    Android` (`supabase` y `mock`)
    https://github.com/thejowe/lockin/actions/runs/34899686933, con las
    líneas de oráculo `Postgres: alta, perfil, lo que busca, modo, like, match
    y mensaje verificados.`, `Postgres: entrada y salida de la sesión Lock-In
    verificadas.` y, en el control negativo, `Postgres: el APK sin
    credenciales no ha escrito perfil ni mensaje.`. El arreglo del E2E lo hizo
    `calidad` en 26be92e (instalar solo `platform-tools`; detalle en
    `todo/calidad.md`). Historial del rojo previo, en f7e9e37: `CI` y `Schema
    drift` ya estaban en verde (runs 34895140293 y 34895140336), pero **`E2E
    Android` salía en rojo por el runner y no por el caso**: los dos jobs caían
    en `android-actions/setup-android@v4` con
    `Warning: Failed to find package 'tools'` y `Error: The process
    '/usr/local/lib/android/sdk/cmdline-tools/20.0/bin/sdkmanager' failed
    with exit code 1`, antes de compilar nada. Pasó igual en el run
    https://github.com/thejowe/lockin/actions/runs/34895140288 (f7e9e37) y en
    los dos intentos del 34893680768 (6c6a8f8). La causa venía de fuera y no
    del repo: Google retiró el paquete obsoleto `tools` de su repositorio del
    SDK, y la acción lo instala por defecto. Como `e2e.yml` es terreno de
    `calidad`, el arreglo se le encargó a ese bloque.
  - [x] Step 3, contrato opt-in: en verde contra Supabase local en Actions,
    nunca contra el proyecto real (ver la casilla en "Verificación manual").
  - [x] Step 4, dos móviles: **confirmado por el usuario el 2026-09-15** sobre
    un APK de EAS instalado en dos dispositivos reales contra Supabase real.
    Recorrió el flujo cruzado completo —alta desde el segundo móvil, su tarjeta
    apareciendo en el deck del primero, match, agendado y chat— y después las
    dos comprobaciones de "Verificación manual" de abajo. Ver el aviso sobre la
    naturaleza de esta evidencia allí.

## Verificación manual (no automatizable)

- [x] Dos móviles reales: el punto "está aquí" aparece y desaparece al entrar y salir la otra persona
- [x] Aviso real 5 minutos antes en Android con la app cerrada

> **Qué clase de evidencia es esta.** Las dos casillas de arriba las cierra la
> palabra del usuario el 2026-09-15 («todo bien»), no una captura, un log ni un
> run de Actions. Se le pasaron los pasos exactos —para la presencia, que el
> indicador pase a «está aquí» al entrar la otra persona en la pantalla de la
> sesión **y** vuelva a «ausente» al salir (`useCounterpartPresence` tiene tres
> estados, y un indicador que se queda pegado en «aquí» es un fallo que este
> recorrido debía destapar); para el aviso, agendar a 20-35 minutos vista,
> aceptar desde el otro móvil, volver a la app para que `syncReminders`
> programe, cerrar la app del todo y esperar— pero **no hay constancia paso a
> paso de cada resultado**. Quien vuelva a tocar presencia o recordatorios y
> necesite una red de seguridad de verdad, que no dé estas dos por una prueba
> automatizada: no existe E2E de presencia entre dos clientes ni de una
> notificación local disparándose con la app cerrada, y `TODO.md` ya deja
> escrito, a cuenta de otro episodio, que marcar una casilla no es haberla
> verificado.
- [ ] **[comprobador]** Volver a comprobar con evidencia el aviso de 5
  minutos antes con la app cerrada, en el emulador contra Supabase real
  (captura de la notificación + logcat), para que la casilla de arriba deje
  de descansar solo en la palabra del usuario. La presencia entre dos
  clientes sigue necesitando dos dispositivos.
- [x] Contrato opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1`) con los casos de sesiones en verde —
  **contra Supabase local desechable, no contra `grrzmzktrhksbttpbblg`**
  (2026-09-14, decisión del usuario: salida Docker local). No se ejecuta
  contra el proyecto real porque allí se retiró `dev_reset_current_user()` el
  2026-09-13, y sin ella la suite gasta un alta anónima por caso y choca con
  el límite de 30 por hora. En esta máquina no hay Docker (WSL sin kernel ni
  distribuciones), así que corre en el Docker del runner: workflow manual
  `.github/workflows/contract.yml` (ef50681, guardia ajustada en 49b5a46).
  Levanta Supabase con las migraciones del repo más `supabase/seed.sql`, que
  trae la función de limpieza. Exige `API_URL` `http://127.0.0.1:54321` y que
  no exista `.env.local`, porque la suite lo lee antes que el entorno. Y falla
  si la suite se salta. Verde en
  https://github.com/thejowe/lockin/actions/runs/34897871055: **49 pasan, 0
  fallan, 3 saltados**. Los tres saltados son los `itWithTimeTravel`
  (propuesta caducada, sesión que termina sola, sesión empezada que no se
  cancela), porque el backend declara `canTimeTravel: false`; esas reglas las
  cubren el mock y `session_is_live()` en PGlite. Los 14 casos de sesiones sin
  reloj simulado pasan, incluidos RLS con alguien de fuera del match, entrar y
  salir, y el aviso por Realtime a las dos personas. La primera pasada
  (run 34897347871) dio el mismo 49/0/3 pero salió en rojo: la guardia exigía
  cero saltos.
