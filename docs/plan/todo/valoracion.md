# TODO — valoracion

Plan: `docs/superpowers/plans/2026-09-15-valoracion-post-sesion.md`. Spec:
`docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`. Una
casilla por tarea del plan; se marca al hacer su commit, con la evidencia real
al lado (comando y resultado, o run de Actions con su URL) — no solo la marca.

Alcance de archivos: los mismos que `sesiones`, que es lo que hace que estos dos
bloques **nunca se lancen a la vez**. Ver `docs/plan/PLAN.md` → bloque 8.

- [ ] Tarea 1 — Dominio, reglas puras y contrato
- [ ] Tarea 2 — Mock y casos de contrato
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
