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
- [x] Tests de contrato SQL de la spec §8 (lista cerrada; el patrón son los tests de
  contrato de Supabase existentes).
  Hecho el 2026-10-30: 34 casos SQL directos en `src/data/supabase/contract.test.ts` (códigos y
  `detail`, atomicidad, concurrencia, cursores compuestos, orden y permisos), complementando el
  contrato compartido. ESLint y salto sin la variable verificados; `tsc --noEmit` solo falla en
  el artefacto E2E local de Deno `2026-10-14-avatar-fallo-cerrado/edge-runner.ts`, ajeno a esta tarea.
  Ejecución contra Supabase pendiente de CI: aquí no hay Docker.
- [x] [Claude] Aplicar en producción por MCP, byte a byte (memoria
  `aplicar-migraciones-por-mcp-byte-a-byte`), y dejar Schema drift en verde.
  Hecho el 2026-10-30 con orden del usuario: `premium_tables`, `premium_rpcs`, `premium_deck` y
  `premium_hardening` (esta última, `20261030120300`, también estaba sin aplicar). Comprobado en
  producción: 4 tablas, 9 funciones sin sobrecargas y el cron `lockin-purge-old-premium-records`.
  Schema drift (workflow_dispatch) verde.

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
  dispositivo** (lo cubre la casilla `[comprobador]`). `codex review` pasado en 5 rondas (commits
  d28302a..5f46b18). Queda anotado un P2 de carrera muy estrecha: carta repuesta que se vuelve a
  decidir, con refresco solapado, bloqueo del perfil y fallo del guardado → puede reaparecer hasta el
  siguiente refresco (`use-deck.ts`, validación de cartas repuestas omite las de `decided`).
- [x] [Claude] Matches: fila «Te han dado like (N)» y la cuadrícula premium (gratis ve relleno
  genérico, nunca fotos reales).
  Hecho el 2026-10-30 (Tarea 8): `LikesRow` en Matches, ruta `/likes` con `IncomingLikes` (relleno sin Premium, perfiles con Premium, Super Likes primero, paginación por cursor, hoja/paywall si el like choca con cupo o Premium, `MatchModal` si hay match). Solo probado con Jest: **sin ver en dispositivo** (lo cubre la casilla `[comprobador]`). Pendiente `codex review`.
- [x] [Claude] Filtros avanzados con candado; paywall (`src/lib/purchases.ts` con ofertas falsas en
  mock); fila Premium en Cuenta; aviso al borrar la cuenta.
  Filtros con candado hechos el 2026-10-30 (Tarea 7): `DeckFilters` (`deck-filters.tsx`), botón «Filtros»
  con hoja en Descubrir, `useDeck(mode, filter, { onPremiumFiltersRemoved })` y aviso «Tus filtros Premium
  se han quitado» si el servidor rechaza con `PremiumRequiredError`. Solo Jest: **falta verlo en
  dispositivo** (`[comprobador]`). Quedan el paywall, la fila de Cuenta y el aviso al borrar (Tareas 9-10).
  Tarea 9 hecha el 2026-10-30: `src/lib/purchases.ts` (ofertas falsas con mock; con Supabase y sin SDK
  lanza `PurchasesUnavailableError`), `Paywall` (`/premium` ya no es stub), `PremiumRow` y aviso de
  suscripción al borrar la cuenta (`AccountSection`), «Simular Premium» solo en `__DEV__` con mock (dentro
  del paywall: `AccountSection` no pinta nada con el mock, así que ahí no se ve la fila). Solo Jest:
  **sin ver en dispositivo** (Tarea 10, `[comprobador]`). Pendiente `codex review`.
- [ ] [comprobador] Recorrido gratis en el emulador (agotar likes, hoja, número de likes, paywall)
  con mock y con Supabase real.
  **Mock comprobado el 2026-10-30** (commit 5d466e2, APK debug con Metro, backend mock; evidencia en
  `e2e/artifacts/local/2026-10-30-premium-mock/`): ✅ filtros con candado, hoja «sin likes», «Te quedan N likes»,
  Super Like/Deshacer/Boost, fila «Te han dado like (N)» y `/likes` (relleno sin Premium, perfiles con Premium),
  paywall y «Simular Premium». ⚠️ Fila Premium en Cuenta y aviso al borrar: con mock `AccountSection` no se pinta, no
  comprobables aquí. **Casilla abierta: falta la parte con Supabase real.**

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

## Hallazgos del comprobador

### 2026-10-30 — recorrido gratis con mock (commit 5d466e2)

Backend: **mock** (logcat: «backend de datos: mock en memoria»). APK debug x86_64 con Metro; los likes se agotaron
sembrando 22 eventos con `seedMockLikeEvents('like', 22, 1)` por CDP (el mock solo trae ~9 perfiles, no se
llega a 25 solo con la UI). Evidencia: `e2e/artifacts/local/2026-10-30-premium-mock/` (capturas 13-54, `logcat.txt`).

- ✅ Filtros (13, 14): hoja con candados en horas, franjas, ambición, punto de partida y zona horaria; tocar uno abre el paywall.
- ✅ Hoja «sin likes» (34, 35): «Te quedan 3 likes» (31) → 0 (33) → «Sin likes hasta las 21:45»; el gesto a la derecha sin cupo devuelve la tarjeta.
- ✅ Super Like gratis (19, 20): el primero pasa; el segundo da «Sin Super Likes por ahora» con la fecha de reposición (6 nov).
- ✅ Boost gratis (16) y Deshacer gratis (17) abren el paywall. Con Premium: Deshacer repone la tarjeta (41, 42); Boost activa y el segundo da «Boost no disponible… 29 de noviembre» (43).
- ✅ Matches (45, 46, 48, 49): «Te han dado like (3)»; con Premium, perfiles con nombre y foto, «Me gusta» da ¡Match!; sin Premium, solo candados genéricos y «Hazte Premium».
- ✅ Paywall `/premium` (15, 36, 37, 54): beneficios, 9,99 €/mes y 49,99 €/año, restaurar, términos; «Simular Premium» (solo __DEV__ con mock) cierra el paywall y activa los botones; «Hazte Premium» con ofertas falsas concede Premium.
- ⚠️ Fila Premium en Cuenta y aviso al borrar la cuenta (50, 51): con mock el Perfil no muestra ni fila Premium ni borrado; no comprobables sin Supabase.
- Hallazgos menores (no bloquean), para el bloque `descubrir`/`visual`:
  1. ✅ Resuelto (2026-10-30): aviso «Boost activo durante 30 minutos». Un Boost con éxito no da ningún aviso (captura 40: sin hoja ni toast tras pulsarlo; solo se nota al intentar otro).
  2. ✅ Resuelto: el mock ya lo prohibía; ahora avisa «No se puede deshacer un match». Deshacer justo después de un like que hizo match no hace nada y no avisa (38 → 39 siguen en la misma tarjeta); el SQL lo prohíbe, el mock debería comportarse igual y/o avisar.
  3. ✅ Resuelto (rejilla centrada). `/likes` sin Premium: la rejilla de candados queda pegada a la izquierda (márgenes 35 px / 100 px, captura 49).
  4. ✅ Resuelto (`reset-time.ts`: «mañana a las…» / fecha). «Sin likes hasta las 21:45» no dice el día cuando falta casi un día entero.
- Entorno: el build local de Windows exige `-PreactNativeArchitectures=x86_64` y una copia en ruta corta (`C:\k`): reanimated
  falla en arm64 por rutas >260 caracteres. Metro tardó 26 min en el primer bundle y, mientras otros agentes editan `src/`,
  hace recarga rápida y pierde el estado del mock.
