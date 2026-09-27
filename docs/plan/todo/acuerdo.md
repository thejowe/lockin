# acuerdo — Acuerdo de socios a ciegas (Fase 3)

Spec: `docs/superpowers/specs/2026-09-24-acuerdo-socios-design.md`
Plan: `docs/superpowers/plans/2026-09-24-acuerdo-socios.md`

## Tareas

- [x] Tarea 1 — Catálogo y estado por tema (`src/features/agreement/topics.ts`, `status.ts`)
- [x] Tarea 2 — Migración SQL y cobertura en PGlite
- [x] [Claude] Tarea 3 — Dominio, contrato y mock
- [x] Tarea 4 — Repositorio de Supabase (`5040ea3`; CI verde, run 36066497602; contrato verde, run 36067948181, los 8 casos del acuerdo pasan)
- [x] Tarea 5 — Hook `useAgreement` y `TopicRow`. Hecho el 2026-09-27: lectura al enfocar y tras guardar, candado contra doble toque, editor con Guardar deshabilitado durante la escritura, notas de espacios a `null` y tope `AGREEMENT_NOTE_MAX`. Tests del plan primero en rojo; 29 tests del bloque en verde. Validación: `npx jest --coverage` (1024 pasan, 110 omitidos; cobertura 95.04/90.17/94.69/96.45), `npx tsc --noEmit` y `npm run lint` en verde.
- [x] Tarea 6 — Tarjeta, pantalla, ruta y cruce con `chat` (`3abe9c5`)
- [ ] [Claude] Tarea 7 — E2E en la variante `supabase`
- [ ] [Claude] Tarea 8 — Verificación final y cierre
- [ ] [comprobador] Recorrer el acuerdo en el emulador (mock y Supabase local)

## Pendiente del usuario

- [ ] Aplicar `supabase/migrations/20260924000200_agreement_answers.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor. Hasta entonces, `Schema drift`
      remoto está rojo **a propósito** (excepción con fecha, ver Tarea 8).

## Hallazgos del comprobador
