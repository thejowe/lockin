# TODO — sesiones

Plan: `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`. Una casilla por tarea del plan; se marca al hacer su commit.

- [x] Tarea 1 — Dominio: tipos, reglas de tiempo, errores
- [x] Tarea 2 — Contrato de `LockInSessionRepository` y mock
- [x] Tarea 3 — Migración SQL (tablas, RLS, RPCs) y comprobación en PGlite
- [ ] Tarea 3b — Migración aplicada en `grrzmzktrhksbttpbblg` por el usuario; `schema-drift.yml` en verde
- [ ] Tarea 4 — Repositorio de Supabase — **hecha una vez (2026-09-14) y perdida
  sin commitear**: el trabajo (`sessions.ts`, `database.types.ts`,
  `index.ts` sin `pendingSessions`, `contract.test.ts`) se completó y verificó
  en verde, pero se quedó sin commit en el working tree y algo lo borró antes
  de que ninguna sesión posterior lo commiteara. La nota de esta casilla se
  escribió describiéndolo como hecho sin comprobar que estuviera commiteado —
  no repetir ese error. Hay que rehacerla desde cero; `index.ts` tiene otra
  vez el `pendingSessions` provisional.
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
