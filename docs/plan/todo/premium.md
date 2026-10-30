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

- [ ] [Claude] Migración `premium`: `entitlements`, `is_premium()`, `like_events`,
  `decisions.is_super`, `boosts`, `revenuecat_events`, y el `pg_cron` de purga (spec §3).
- [ ] [Claude] `record_decision` con Super Like, cupos (`LQ001`/`LQ002`/`LQ004`), cerrojo por actor
  e idempotencia. Borrar antes la firma anterior para no dejar una sobrecarga.
- [ ] [Claude] `undo_last_decision()`, `activate_boost()`, `premium_quotas()`,
  `incoming_likes_count()` e `incoming_likes()`.
- [ ] [Claude] `discovery_deck` con los filtros premium (`42501` sin Premium), y el orden Super
  Like → Boost → el de siempre, con `super_liked_me`.
- [ ] [Codex] Tests de contrato SQL de la spec §8 (lista cerrada; el patrón son los tests de
  contrato de Supabase existentes).
- [ ] [Claude] Aplicar en producción por MCP, byte a byte (memoria
  `aplicar-migraciones-por-mcp-byte-a-byte`), y dejar Schema drift en verde. **Con orden del
  usuario.**

## Fase 2 — cliente con mock

- [ ] [Claude] Contrato: `PremiumRepository`, `DeckProfile`, `ProfileFilter` ampliado,
  `QuotaExceededError` y `PremiumRequiredError` (spec §5). Implementación en mock y en Supabase.
  Tarea 1 del plan hecha (2026-10-29): tipos, errores, límites, contrato y mock. Falta Supabase
  (Tarea 5; en `supabase/index.ts` hay un `premium` provisional que lanza «pendiente: Tarea 5»).
- [ ] [Claude] Deck: deshacer, Super Like y Boost; aviso de likes restantes; hoja «sin likes»;
  insignia de Super Like.
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
