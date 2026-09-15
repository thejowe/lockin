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

- [ ] [Codex] Tarea 1 — Dominio, regla pura y contrato — `MatchStreak`,
      `src/data/streaks.ts` (`STREAK_GAP_DAYS`, `pairStreak`) con sus bordes en
      test, `listStreaks` en `LockInSessionRepository`, y andamio en mock y
      Supabase. Terminado = `tsc`, lint y `npm test -- --coverage` sin aviso de
      umbral.
- [ ] [Codex] Tarea 2 — Mock y casos de contrato — `listStreaks` en memoria sin
      leer `ratings`, los nueve casos de `describe('rachas')` (3 con `it`, 6 con
      `itWithTimeTravel`) y retirada del andamio del mock. Terminado = los casos
      pasan contra el mock y la cobertura no baja.
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
