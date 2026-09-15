# TODO — rachas

Plan: `docs/superpowers/plans/2026-09-15-rachas.md`. Spec:
`docs/superpowers/specs/2026-09-15-rachas-design.md`. Una casilla por tarea del
plan; se marca al hacer su commit, con la evidencia real al lado (comando y
resultado, o run de Actions con su URL) — no solo la marca. Al marcarla, quita
la etiqueta de herramienta (regla 4 de `PLAN.md`).

Alcance de archivos: los mismos que `sesiones`, **más tres cruces declarados**
(`src/app/(tabs)/matches.tsx` y `src/features/chat/match-row.tsx` de `chat`;
`test/routes.tsx` de `calidad`). Nunca se lanza a la vez que `sesiones` ni que
`valoracion`. Ver `docs/plan/PLAN.md` → bloque 9.

## Reparto

Criterio de `PLAN.md`: `[Codex]` si el alcance de archivos está cerrado y el
"terminado" es objetivo; `[Claude]` si cruza bloques, pide criterio o necesita
releer el roadmap. A una sesión de Codex dale **la tarea del plan copiada
entera** más las "Global Constraints", nunca "actúa como el agente sesiones".

Orden: 1 → 2; 3 puede ir en paralelo con 1-2 **en su propio worktree** (no
comparten archivos); 4 necesita 1 y 3; 5 necesita 2; 6 necesita 5; 7 necesita
todas.

- [x] Tarea 1 — Dominio, regla pura y contrato — `MatchStreak` al final de
      `types.ts`; `src/data/streaks.ts` (`STREAK_GAP_DAYS = 7`, `pairStreak`)
      reexportado desde `@/data`; `listStreaks()` en `LockInSessionRepository`
      (después de `rate`, con la regla nueva añadida al JSDoc de la interfaz);
      y andamio `listStreaks: throw new Error('listStreaks: todavía no está
      implementado')` en el mock y en Supabase, cada uno con su caso que lo
      fija en `mock/index.test.ts` y `supabase/sessions.test.ts` —se borran en
      las Tareas 2 y 4—. 9 casos nuevos en `streaks.test.ts` (vacía, una sesión,
      cadena de 3 con huecos de 6 días, hueco de 7 días exactos que rompe,
      7 días − 1 ms que no rompe, cadena de 3 cortada por una de 1, los dos
      bordes de `aliveUntil`, y el mismo resultado con las sesiones
      desordenadas).
      TDD: `npx jest src/data/streaks.test.ts` en rojo primero (`Cannot find
      module './streaks'`), en verde tras escribir `streaks.ts` (9/9).
      Verificado 2026-09-15: `npx tsc --noEmit` limpio; `npx jest
      src/data/streaks.test.ts src/data/mock src/data/supabase/sessions.test.ts`
      115/115; `npm run lint` limpio; `npm run format:check` marca 97 archivos
      por CRLF de Windows — el mismo conjunto (todo el repo) antes y después del
      cambio, y los dos archivos nuevos no aparecen en el listado; no es
      regresión de esta tarea (ver nota de memoria sobre CRLF en Windows); y
      `npm test -- --coverage` con 574 pasando, 63 saltados (contrato opt-in) y
      sin aviso de umbral — 92.53/85.04/92.40/94.24 sobre el suelo
      89.82/82.56/91.49/91.38.
- [x] Tarea 2 — Mock y casos de contrato — `listStreaks` en memoria filtra
      `state.matches` por `isMember`, y por cada match filtra
      `state.lockInSessions` a `aceptada` + `bothAttended` (nunca toca
      `state.ratings`) y pasa esas sesiones a `pairStreak`. `describe('rachas')`
      en `repositories.contract.ts`, dentro de `describe('sessions')` y después
      de `describe('valoración')`, con el helper local `sharedSession` (como
      `endedSession` pero sin esperar al final). 9 casos: 3 con `it` normal (los
      dos dentro suman 1 e igual para las dos personas; solo uno dentro no hay
      racha; alguien de fuera no la ve) y 6 con `itWithTimeTravel` (dos seguidas
      suman 2; un hueco de 7 días o más no las une; pasados 7 días del final ya
      no hay racha; un plantón en medio no rompe; una cancelada en medio no
      rompe; valorar no cambia la racha de ninguno de los dos). Retirado el
      andamio de la Tarea 1: el stub de `listStreaks` del mock y su caso en
      `src/data/mock/index.test.ts`.
      Verificado 2026-09-15: `npx jest src/data/mock src/data/streaks.test.ts`
      99/99, `npx tsc --noEmit` limpio, `npm run lint` limpio, y `npm test --
      coverage` con 582 pasando, 72 saltados (contrato opt-in) y sin aviso de
      umbral — 92.70/85.11/92.21/94.48 sobre el suelo 89.82/82.56/91.49/91.38.
      `npm run format:check` sigue marcando CRLF en todo el repo por el entorno
      Windows (nota de memoria); en su lugar, `npx prettier --check` sobre los
      tres archivos tocados solo difiere del formateado en los finales de línea
      (`diff --strip-trailing-cr` sin diferencias reales), salvo un `printWidth`
      real en un `itWithTimeTravel` de `repositories.contract.ts` que se
      corrigió partiendo la llamada en varias líneas.
- [ ] [Claude] Tarea 3 — Migración SQL y cobertura en PGlite —
      `20260915000200_match_streaks.sql` (`match_streaks()` `SECURITY DEFINER`)
      y sus cadenas en `schema-embedded.test.mjs`. `[Claude]` porque es la pieza
      donde se decide la privacidad: una función `SECURITY DEFINER` que filtra
      por `auth.uid()` y que no debe leer `session_ratings`, releyendo la spec
      de valoración. Terminado = `npm run test:schema` en verde, con la aserción
      de que la definición no menciona `session_ratings`.
- [ ] [Codex] Tarea 4 — Repositorio de Supabase — `MatchStreakRow`,
      `toMatchStreak`, `listStreaks` contra el RPC y retirada del andamio.
      Terminado = `npx jest src/data/supabase`, `tsc`, lint y cobertura.
- [ ] [Codex] Tarea 5 — La tarjeta del chat — `streak.ts`, `streak` en
      `useActiveSession` (dentro del `refresh` combinado) y las líneas de
      `SessionCard` por estado. Todo dentro de `src/features/session/`; los
      textos ya están fijados en la spec. Terminado = tests de tarjeta por
      estado, `tsc`, lint, formato y cobertura.
- [ ] [Claude] Tarea 6 — La lista de Matches — `useMatchStreaks`, `useFocusEffect`
      en `test/routes.tsx`, prop `streak` en `MatchRow` y composición en
      `matches.tsx`. `[Claude]` porque **cruza dos bloques** (`chat` y
      `calidad`) y hay que comprobar la firma de `useFocusEffect` en la
      documentación de Expo 57 antes de usarla. Terminado = `npx jest src/features
      test/app` en verde y cobertura sin aviso.
- [ ] [Claude] Tarea 7 — E2E Android y cierre — `prepareSessionStreak`,
      `e2e/session-streak.yaml`, guardia en `session.test.mjs`, y tablero con
      evidencia. `[Claude]` porque la señal solo existe en Actions (aquí no hay
      emulador, y `npm run test:e2e` falla por CRLF en Windows) y se diagnostica
      con `gh run download` y los volcados de Maestro.

## Pendiente del usuario

- [ ] Migración `20260915000200_match_streaks.sql` aplicada en
      `grrzmzktrhksbttpbblg` por el SQL Editor del dashboard. Usa
      `session_both_attended`, de `20260915000100_session_ratings.sql`, que ya
      está aplicada (`0430117`). Desde que se fusione la migración hasta que se
      aplique, el job remoto de `schema-drift.yml` sale en rojo y ese rojo es
      esperado; hoy está en verde, así que cualquier otro rojo es deriva real.
      Nada más depende de esto.
