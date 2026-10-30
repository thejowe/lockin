# Premium (suscripción) — detalle

Pedido por el usuario el 2026-10-26: monetizar como Tinder, con un solo nivel de pago, sin
anuncios y con 25 likes al día gratis. Spec: `docs/superpowers/specs/2026-10-26-premium-design.md`.
Plan de tareas: `docs/superpowers/plans/2026-10-26-premium.md` (Tareas 1–10; cubre las fases 1 y 2, con el contrato y el mock antes que el SQL).

Adelanta la Fase 5 de `CONCEPTO.md`. Las fases 1 y 2 tocan los archivos de `datos` y
`descubrir`, así que no se lanzan a la vez que esos bloques ni que `visual`. Todo agente que
escriba código pasa por `codex review` antes de commitear en la rama principal.

## Decisiones del usuario pendientes

- [ ] Precios definitivos (la spec propone 9,99 €/mes y 49,99 €/año).
- [ ] ¿Prueba gratis de lanzamiento? (Por defecto, no.)

## Fase 0 — plan

- [x] Plan de implementación por tareas en `docs/superpowers/plans/2026-10-26-premium.md`,
  a partir de la spec (§9). Lo escribió Claude el 2026-10-26 (era diseño). Dos desvíos de la spec,
  anotados en el plan: hacer falta Premium da `LQ005` y no `42501`, y el filtro de disponibilidad
  es `minHoursPerWeek` + `timeBands`, porque `Availability` no es un enum.

## Fase 1 — servidor (Supabase)

- [x] [Claude] Migración `premium`: `entitlements`, `is_premium()`, `like_events`,
  `decisions.is_super`, `boosts`, `revenuecat_events`, y el `pg_cron` de purga (spec §3).
  Hecho el 2026-10-29 en `20261030120000_premium_tables.sql` (Tarea 2). Solo en el repo: **sin aplicar en producción**.
  Añade `premium_limits()` (los siete límites, comparados con `premium-limits.ts` por un test) y
  `dev_set_premium`/`dev_add_like_events`/`dev_age_last_decision`/`dev_add_boost` en `seed.sql`
  (retiradas por `dev-teardown.sql`).
- [x] [Claude] `record_decision` con Super Like, cupos (`LQ001`/`LQ002`/`LQ004`), cerrojo por actor
  e idempotencia. Borrar antes la firma anterior para no dejar una sobrecarga.
  Hecho el 2026-10-29 en `20261030120100_premium_rpcs.sql` (Tarea 3), sin aplicar en producción.
- [x] [Claude] `undo_last_decision()`, `activate_boost()`, `premium_quotas()`,
  `incoming_likes_count()` e `incoming_likes()`. Misma migración. Desvíos: `incoming_likes` lleva dos
  parámetros opcionales más (`p_before_super`, `p_before_id`) para paginar sobre el orden completo
  (Super Likes primero), y hay una auxiliar interna `like_window_reset`. El `undo` es más estricto que
  el mock: con match no deshace ni un pass posterior.
- [x] [Claude] `discovery_deck` con los filtros premium (`LQ005` sin Premium), y el orden Super
  Like → Boost → el de siempre, con `super_liked_me`. Hecho el 2026-10-29 en
  `20261030120200_premium_deck.sql` (Tarea 4), sin aplicar en producción. Pasa a `security definer`
  y devuelve una tabla con las columnas de `profiles` + `super_liked_me` (si `profiles` gana una
  columna visible, hay que añadirla en `discovery_deck` e `incoming_likes`).
- [ ] [Codex] Tests de contrato SQL de la spec §8 (lista cerrada; el patrón son los tests de
  contrato de Supabase existentes).
- [ ] [Claude] Aplicar en producción por MCP, byte a byte (memoria
  `aplicar-migraciones-por-mcp-byte-a-byte`), y dejar Schema drift en verde. **Con orden del
  usuario.**

## Fase 2 — cliente con mock

- [ ] [Claude] Contrato: `PremiumRepository`, `DeckProfile`, `ProfileFilter` ampliado,
  `QuotaExceededError` y `PremiumRequiredError` (spec §5). Implementación en mock y en Supabase.
  Tarea 1 del plan hecha (2026-10-29): tipos, errores, límites, contrato y mock. Tarea 5 escrita
  (2026-10-30): `src/data/supabase/premium.ts`, `getDeck`/`recordDecision` y el fixture del contrato
  Supabase, con tests unitarios del mapeo; `describe('premium')` ya no se salta en Supabase. **Casilla
  abierta hasta que el job «Contrato Supabase» de CI (`LOCKIN_SUPABASE_CONTRACT=1`, con migraciones y
  `seed.sql` del repo) la pase en verde: aquí no hay Docker y esa suite no se ha ejecutado.**
- [x] [Claude] Deck: deshacer, Super Like y Boost; aviso de likes restantes; hoja «sin likes»;
  insignia de Super Like. Hecho el 2026-10-30 (Tarea 6): `usePremium`, `OutOfLikesSheet`, cinco botones
  en `DeckActions`, `useDeck` con `blocked`/`superLike`/`undo`/`boost`, y el gesto a la derecha sin cupo
  que devuelve la tarjeta (`likeLocked` en `SwipeDeck`, que no figuraba en los archivos de la tarea).
  `/premium` es un stub (`src/app/premium.tsx`) hasta la Tarea 9. Solo probado con Jest: **sin ver en
  dispositivo** (lo cubre la casilla `[comprobador]`) y `codex review` pendiente.
- [ ] [Claude] Matches: fila «Te han dado like (N)» y la cuadrícula premium (gratis ve relleno
  genérico, nunca fotos reales).
- [ ] [Claude] Filtros avanzados con candado; paywall (`src/lib/purchases.ts` con ofertas falsas en
  mock); fila Premium en Cuenta; aviso al borrar la cuenta.
- [ ] [comprobador] Recorrido gratis en el emulador (agotar likes, hoja, número de likes, paywall)
  con mock y con Supabase real.

## Fase 3 — cobro real (bloqueada)

Bloqueada hasta que el usuario tenga la membresía de Apple pagada con el Paid Apps Agreement, el
perfil de pagos de Google, el proyecto de RevenueCat y los productos creados en las dos tiendas.
Las claves y los secretos los pega siempre el usuario.

- [ ] `react-native-purchases`, con su versión verificada contra SDK 58; `logIn`/`logOut` con el uid.
- [ ] Edge Functions `revenuecat-webhook` y `sync-entitlement`, con sus tests (spec §8).
- [ ] [comprobador] Compra de prueba con *license tester* en un track interno de Play.
- [ ] Compra en el sandbox de iOS (la hace el usuario: no hay macOS ni iPhone en el emulador).

## Fase 4 — legal y fichas (antes de activar productos)

- [ ] Términos: sección de suscripción y desistimiento; subir `TERMS_VERSION` para que se vuelvan
  a aceptar.
- [ ] Privacidad: RevenueCat como encargado del tratamiento, con su transferencia internacional.
- [ ] Fichas: «Compras dentro de la app: sí»; Data safety con «Historial de compras»; App Privacy
  con «Purchases». Siguen sin anuncios.
