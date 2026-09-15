# TODO — valoracion

Plan: `docs/superpowers/plans/2026-09-15-valoracion-post-sesion.md`. Spec:
`docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`. Una
casilla por tarea del plan; se marca al hacer su commit, con la evidencia real
al lado (comando y resultado, o run de Actions con su URL) — no solo la marca.

Alcance de archivos: los mismos que `sesiones`, que es lo que hace que estos dos
bloques **nunca se lancen a la vez**. Ver `docs/plan/PLAN.md` → bloque 8.

- [x] Tarea 1 — Dominio, reglas puras y contrato — `SessionRating` y
      `SessionRatingEntry` en `types.ts`; `RATING_WINDOW_HOURS`,
      `isInRatingWindow` y `attendedSession` en `sessions.ts`;
      `getRatable`/`getMyRating`/`rate` en `LockInSessionRepository`, con la
      regla nueva en su JSDoc. `src/data/index.ts` **no hizo falta tocarlo**:
      reexporta `./types` y `./sessions` con `export *`, así que lo nuevo ya
      sale de `@/data` (el Step 4 del plan da por hecho una lista de nombres que
      el archivo no tiene). 7 casos nuevos en `sessions.test.ts` (bordes de la
      ventana de 24 h, los tres estados que no se valoran, y asistencia con
      `joinedAt` exclusivo, sin fila, de otra persona y con `leftAt`).
      Añadir los tres métodos a la interfaz deja sin compilar a sus dos
      implementaciones, así que el mock (`src/data/mock/sessions.ts`) y Supabase
      (`src/data/supabase/sessions.ts`) llevan de momento métodos que lanzan
      `todavía no está implementado` —visibles, sin `@ts-expect-error` ni
      `any`—, con un caso cada uno que lo fija y que **se borra** en las Tareas 2
      y 4 al escribir la implementación real (también mantienen el suelo de
      cobertura: sin ellos, funciones bajaba a 90.67 % < 91.49 %).
      Verificado 2026-09-15: `npx tsc --noEmit` limpio, `npx jest
      src/data/sessions.test.ts` 21/21, `npm run lint` limpio, y de más
      `npx jest --coverage` con 522 pasando, 52 saltados (contrato opt-in) y
      sin aviso de umbral.
- [x] Tarea 2 — Mock y casos de contrato — `ratings` en `MockState` y en
      `resetState()`; `getRatable`/`getMyRating`/`rate` en memoria, con el helper
      local `bothAttended` y **sin llamar a `changed()`** al valorar: la
      valoración es privada, y avisar publicaría por el canal del match que
      alguien acaba de valorar. Retirado el andamio de la Tarea 1 —los tres
      stubs del mock y su caso en `src/data/mock/index.test.ts`—, que es lo que
      los casos nuevos pasan a cubrir de verdad. 11 casos en
      `repositories.contract.ts` (`describe('valoración')`): 9 con
      `itWithTimeTravel`, que contra Supabase se saltarán porque `propose` exige
      5 min de margen, y 2 con `it` normal (sesión viva y tercero sin acceso).
      **Desvío del plan, a propósito:** el Step 2 dejaba que una sesión
      cancelada o rechazada saliera por `SessionWindowError` (`isInRatingWindow`
      ya es falso para esos estados), pero la tabla de errores de la spec y el
      Step 1 de la Tarea 3 piden LI004 ahí, así que `rate` mira el estado
      **antes** que la ventana y el contrato fija `SessionForbiddenError` — si
      no, el mock y Supabase discreparían en la Tarea 4. Caso de más, no listado
      en el plan: con dos sesiones terminadas sin valorar se ofrece la más
      reciente (spec § 3), que es lo que fijará el `order by starts_at desc
      limit 1` del RPC.
      Verificado 2026-09-15: `npx jest src/data/mock src/data/sessions.test.ts`
      102/102, `npx tsc --noEmit` limpio, `npm run lint` y `npm run format:check`
      limpios, y `npm test -- --coverage` con 530 pasando, 63 saltados (contrato
      opt-in) y sin aviso de umbral — 92.17/84.15/92.00/93.84 sobre el suelo
      89.82/82.56/91.49/91.38.
- [ ] Tarea 3 — Migración SQL y cobertura en PGlite
- [ ] Tarea 4 — Repositorio de Supabase
- [ ] Tarea 5 — La pantalla de sesión
- [ ] Tarea 6 — La tarjeta del chat
- [ ] Tarea 7 — E2E Android y cierre

## Pendiente del usuario

- [ ] Migración `20260915000100_session_ratings.sql` aplicada en
      `grrzmzktrhksbttpbblg` por el SQL Editor del dashboard. Hasta entonces el
      job remoto de `schema-drift.yml` sale en rojo, y **ese rojo es esperado,
      no deriva** — es la misma situación que tuvo la Tarea 3b de `sesiones`.
      Nada más depende de esto: el mock y la Supabase local de `contract.yml`
      avanzan igual.
