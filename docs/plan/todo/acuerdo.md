# acuerdo — Acuerdo de socios a ciegas (Fase 3)

Spec: `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`
Plan: `docs/superpowers/plans/2026-09-24-acuerdo-socios.md`

## Tareas

- [x] Tarea 1 — Catálogo y estado por tema (`src/features/agreement/topics.ts`, `status.ts`)
- [x] Tarea 2 — Migración SQL y cobertura en PGlite
- [x] [Claude] Tarea 3 — Dominio, contrato y mock
- [x] [Claude] Tarea 4 — Repositorio de Supabase (`5040ea3`; CI verde, run 36066497602; contrato verde, run 36067948181). Revisada el 2026-09-26 contra el plan: mapeo LI004/LI005/23514, deps como `sessions.ts`, registro y fixture correctos; solo se reordenó el import en `supabase/index.ts`. Estaba en `[Codex]` y pasa a `[Claude]` por decisión del usuario (sin Codex en este dispositivo), no porque cambiara el criterio
- [ ] [Codex] Tarea 5 — Hook `useAgreement` y `TopicRow`
- [ ] [Claude] Tarea 6 — Tarjeta, pantalla, ruta y cruce con `chat`
- [ ] [Claude] Tarea 7 — E2E en la variante `supabase`
- [ ] [Claude] Tarea 8 — Verificación final y cierre
- [ ] [comprobador] Recorrer el acuerdo en el emulador (mock y Supabase local)

## Pendiente del usuario

- [ ] Aplicar `supabase/migrations/20260924000200_agreement_answers.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor. Hasta entonces, `Schema drift`
      remoto está rojo **a propósito** (excepción con fecha, ver Tarea 8).

## Hallazgos del comprobador
