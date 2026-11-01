# Premium (suscripción) — detalle

Pedido por el usuario el 2026-10-26: monetizar como Tinder, con un solo nivel de pago, sin
anuncios y con 25 likes al día gratis. Spec: `docs/superpowers/specs/2026-10-26-premium-design.md`.
Plan de tareas: `docs/superpowers/plans/2026-10-26-premium.md` (Tareas 1–10; cubre las fases 1 y 2, con el contrato y el mock antes que el SQL).

Adelanta la Fase 5 de `CONCEPTO.md`. Las fases 1 y 2 tocan los archivos de `datos` y
`descubrir`, así que no se lanzan a la vez que esos bloques ni que `visual`. Todo agente que
escriba código pasa por `codex review` antes de commitear en la rama principal.

## Decisiones del usuario pendientes

- [x] Precios definitivos: 4,99 €/mes y 39,99 €/año (el usuario los fijó el 2026-11-01; la spec proponía 9,99 €/49,99 €).
- [x] Prueba gratis: 3 días, una por persona (decidido por el usuario el 2026-11-01). Se configura como oferta introductoria en App Store Connect y Google Play al crear los productos (Fase 3); los términos ya la recogen en el borrador.

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

- [x] [Claude] Contrato: `PremiumRepository`, `DeckProfile`, `ProfileFilter` ampliado,
  `QuotaExceededError` y `PremiumRequiredError` (spec §5). Implementación en mock y en Supabase.
  Tarea 1 del plan hecha (2026-10-29): tipos, errores, límites, contrato y mock. Tarea 5 escrita
  (2026-10-30): `src/data/supabase/premium.ts`, `getDeck`/`recordDecision` y el fixture del contrato
  Supabase, con tests unitarios del mapeo; `describe('premium')` ya no se salta en Supabase. **Casilla
  abierta hasta que el job «Contrato Supabase» de CI (`LOCKIN_SUPABASE_CONTRACT=1`, con migraciones y
  `seed.sql` del repo) la pase en verde: aquí no hay Docker y esa suite no se ha ejecutado.** Cerrada el 2026-11-01: CI (run 41147944634, `f38b363`) verde con el job «Contrato Supabase» y sus 34 tests de Premium.
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
- [x] [comprobador] Recorrido gratis en el emulador (agotar likes, hoja, número de likes, paywall)
  con mock y con Supabase real.
  **Mock comprobado el 2026-10-30** (commit 5d466e2, APK debug con Metro, backend mock; evidencia en
  `e2e/artifacts/local/2026-10-30-premium-mock/`): ✅ filtros con candado, hoja «sin likes», «Te quedan N likes»,
  Super Like/Deshacer/Boost, fila «Te han dado like (N)» y `/likes` (relleno sin Premium, perfiles con Premium),
  paywall y «Simular Premium». ⚠️ Fila Premium en Cuenta y aviso al borrar: con mock `AccountSection` no se pinta, no
  comprobables aquí. **Casilla abierta: falta la parte con Supabase real.**
  **Supabase real, parte 1 (2026-10-30, commit 4b5f01d, sin Premium):** ver «Hallazgos del comprobador». ✅ fila «Hazte Premium»/«Restaurar compras» en Cuenta, «Te han dado like (1)» y `/likes` con un candado, filtros con candado, paywall («Las compras aún no están disponibles»). ⚠️ No se pudo agotar el cupo (el deck real solo tiene ~16 perfiles) ni ver la hoja «Sin likes hasta…». **Casilla abierta:** faltan la parte con entitlement (fila Premium, aviso al borrar, `/likes` con perfiles, botones Premium) y la hoja de cupo.

## Fase 3 — cobro real (bloqueada)

Bloqueada hasta que el usuario tenga la membresía de Apple pagada con el Paid Apps Agreement, el
perfil de pagos de Google, el proyecto de RevenueCat y los productos creados en las dos tiendas.
Las claves y los secretos los pega siempre el usuario.

- [ ] `react-native-purchases`, con su versión verificada contra SDK 58; `logIn`/`logOut` con el uid.
- [x] Edge Functions `revenuecat-webhook` y `sync-entitlement`, con sus tests (spec §8). Escritas y con 38 tests verdes (`supabase/functions/{revenuecat-webhook,sync-entitlement}`, lógica compartida en `sync-entitlement/logic.mjs`). **Falta:** desplegar (`sync-entitlement` con `verify_jwt: true`, `revenuecat-webhook` con `false`, subiendo `../sync-entitlement/logic.mjs` como archivo) y poner los secretos `REVENUECAT_SECRET_KEY` y `REVENUECAT_WEBHOOK_SECRET`; configurar el webhook en RevenueCat con ese valor en Authorization.
- [ ] [comprobador] Compra de prueba con *license tester* en un track interno de Play.
- [ ] Compra en el sandbox de iOS (la hace el usuario: no hay macOS ni iPhone en el emulador).

## Fase 4 — legal y fichas (antes de activar productos)

- [ ] Términos (borrador en `docs/tiendas/borrador-premium-legal.md`, 2026-11-01, sin publicar): sección de suscripción y desistimiento; subir `TERMS_VERSION` para que se vuelvan
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

### 2026-10-30 — recorrido gratis con Supabase real (commit 4b5f01d), parte 1

Backend: **Supabase** (proyecto grrzmzktrhksbttpbblg; logcat: «backend de datos: Supabase»). APK debug x86_64 con Metro servido desde la copia `C:\k` (`--no-dev --minify --clear`) y `.env.local` con `EXPO_PUBLIC_REQUIRE_ACCOUNT=false` (alta anónima; la puerta de registro exigiría correo). Evidencia: `e2e/artifacts/local/2026-10-30-premium-supabase/` (capturas 01-31, `logcat.txt`). Cuenta de prueba A: «Prueba Premiumy», uid `109e1400-11fc-44f7-b29b-46705fd7a251`. Cuenta de apoyo (anónima, vía API con la clave anon): «Comprob Apoyo Premium», `b519a4f1-d744-4e06-853d-0b355895311a`, que dio like a A.

- ✅ Alta anónima y deck real (19, 20): perfiles de producción con foto e iniciales.
- ✅ Cuenta sin Premium (24): «Hazte Premium» y «Restaurar compras» entre «Asegurar mi cuenta» y «Cerrar sesión».
- ✅ Matches (27) y `/likes` (28): «Te han dado like (1)»; sin Premium un solo candado genérico y «Hazte Premium», sin datos del perfil.
- ✅ Filtros (30, 31): candado en horas, franjas, ambición, punto de partida y zona horaria; tocar uno abre el paywall.
- ✅ Paywall con Supabase y sin SDK de compras (29): beneficios, «Las compras aún no están disponibles», «Restaurar compras», términos y privacidad.
- ⚠️ Agotar likes y hoja «Sin likes hasta…» (día correcto): **no comprobable**. A dio ~16 likes reales (deck agotado, «Deck vacío», captura 26) y `Te quedan N likes` solo avisa con ≤5, así que no llegó a salir. No hay perfiles para llegar a 25; crear ~12 cuentas anónimas de relleno por API fue denegado por el sistema de permisos, y no hay helpers `dev_*` en producción. Con el deck vacío tampoco salen los cinco botones (Super Like/Deshacer/Boost) para ver sus puertas con Supabase.
- Hallazgo menor 1: el contador de `/likes` se queda en 0 en Matches hasta hacer pull-to-refresh (clave `incoming-likes-count` en caché desde la primera visita): el like entrante no aparece al volver a la pestaña (25, 26) y sí tras tirar hacia abajo (27).
- Hallazgo menor 2: el build local de release falla en CMake por rutas largas aun en `C:\k` (`rngesturehandler_codegen ... mkdir`); sirve el debug con Metro.

#### Fase 1 (cupo agotado sembrado por SQL, cuenta 109e1400…, sin Premium; capturas 40-55, `logcat-fase1.txt`)

Backend: Supabase. Hora del emulador: 30 oct 23:38.
- ✅ Deck con cupo agotado (40): «Te quedan 0 likes»; el gesto a la derecha devuelve la tarjeta y abre la hoja (41).
- ✅ Hoja del botón like (45): «Sin likes hasta **mañana** a las 22:36» y «Has gastado tus 25 likes de hoy»; el día es correcto (reset ≈ 23 h tras el evento más antiguo, de madrugada del día siguiente). Arreglo de 4b5f01d confirmado con Supabase.
- ✅ «Hazte Premium» desde la hoja abre el paywall (47); «Ahora no» cierra la hoja y la tarjeta sigue ahí.
- ✅ Deshacer (52) y Boost (54) gratis abren el paywall.
- ⚠️ Super Like gratis (49, 50): con el cupo de likes agotado el servidor responde con la hoja de cupo las dos veces; no se llegó a ver «Sin Super Likes» (haría falta un cupo de likes libre).

#### Fase 2 (con Premium concedido por SQL, 2 días, play_store; cuenta 109e1400…; capturas 60-79, `logcat-fase2.txt`)

Backend: Supabase. Reinicio en frío para refrescar el entitlement.
- ✅ Fila Premium en Cuenta (77): «Activo hasta 1 nov 2026», «Gestionar suscripción» y «Restaurar compras»; ya no sale «Hazte Premium».
- ✅ Aviso al borrar (78): «Tu suscripción no se cancela sola: cancélala en la tienda o se seguirá cobrando», con «Gestionar suscripción»; «Mejor no» cancela (79) y no se borró nada.
- ✅ Matches y `/likes` (71-73): «Te han dado like (1)»; con Premium sale el perfil real «Comprob Apoyo Premium» con insignia «Super Like» y «Te ha dado un Super Like · Barcelona»; «Me gusta» da ¡Match! y «Abrir chat» (75, 76); la lista queda en «Nadie te ha dado like todavía».
- ✅ Deck con Premium (60): sin «Te quedan N likes» y los cinco botones activos.
- ✅ Boost (61, 62): «Boost activo durante 30 minutos» y, al segundo intento, «Boost no disponible… domingo, 29 de noviembre a las 23:42».
- ✅ Deshacer (63, 64): tras un like, repone la tarjeta anterior.
- ✅ Super Like con Premium (65): pasa sin hoja, el deck avanza (no hay aviso ni contador de Super Likes restantes).
- ✅ Filtros avanzados (66-70): sin candados; Noche + Apostarlo todo + 5 h aplican («Filtros (3)») sin error y sin LQ005 en el logcat; añadir Legal vacía el deck («Filtros (4)», 70), así que filtran de verdad.
- Sin ver: tocar «Gestionar suscripción» y «Restaurar compras» con Premium; el tope de 5 Super Likes/semana; la paginación de `/likes`; «Sin Super Likes» en gratis (cupo de likes agotado a la vez); compra real (fase 3).

### 2026-10-30 — cierre
- Hallazgo del contador «Te han dado like (N)» sin refrescar al volver a Matches: resuelto en `matches.tsx` (relee al enfocar si la carga inicial ya terminó; `codex review` lo pidió así por el montaje anticipado de las pestañas). Comprobado con Jest; **no re-visto en dispositivo**.
- Cuentas de prueba `109e1400-…` y `b519a4f1-…` borradas de `auth.users` el 2026-10-30; comprobado que no quedan decisiones, eventos ni entitlements.
- Sin ver nunca: tope de 5 Super Likes/semana, «Sin Super Likes» con Supabase, paginación de `/likes`, «Gestionar suscripción»/«Restaurar compras» tocados y la compra real (Fase 3).

### 2026-11-01 — lo que faltaba, con Supabase real (commit 5050343)

Backend: **Supabase** (logcat: «backend de datos: Supabase»). APK debug x86_64 con Metro desde `C:\k` con `src/` de HEAD (`git archive`), `EXPO_PUBLIC_REQUIRE_ACCOUNT=false`. Evidencia: `e2e/artifacts/local/2026-11-01-premium-supabase-restante/` (capturas 00-43, `logcat.txt`). Cuenta A «Prueba Restante» `6eab25bc-8198-41cc-8699-11a8e14e1f22` (sin Premium) y cuenta de apoyo anónima `acce2d3f-6877-4f80-9060-fb47b465ee21`. **Esta sesión no tenía acceso SQL a producción** (ni MCP de Supabase ni clave de servicio), así que no se pudo conceder Premium: lo que exige entitlement queda sin ver.

- ✅ «Sin Super Likes» con Supabase, gratis (20, 21): el primer Super Like pasa y avanza la tarjeta; el segundo abre la hoja «Sin Super Likes por ahora — Tu próximo Super Like llega el domingo, 8 de noviembre a las 16:07. Con Premium tienes 5 a la semana», con «Hazte Premium» y «Ahora no». Cupo de likes libre (cuenta nueva), así que es el cupo de Super Likes y no el de likes.
- ✅ «Restaurar compras» tocado (gratis, 23-25): sin SDK de compras muestra «Las compras aún no están disponibles.» bajo el botón; sin cierre ni error en logcat.
- ✅ Contador «Te han dado like (N)» al volver a Matches (30, 31): en Matches no hay fila; en Descubrir la cuenta de apoyo da like a A por API; al volver a Matches aparece «Te han dado like (1)» **sin pull-to-refresh**. Cierra el hallazgo menor 1 del 2026-10-30 (fix 8151c75) en dispositivo.
- ✅ Borrado de cuenta de prueba con Supabase (41-43): «Eliminar mi cuenta para siempre» → «Eliminando…» → vuelve a la bienvenida.
- ⚠️ Tope de 5 Super Likes/semana con Premium: no comprobable aquí, hace falta entitlement por SQL (`entitlements`) en producción y no hay `dev_set_premium`. El gratis (tope 1) sí funciona.
- ⚠️ «Gestionar suscripción» tocado: solo sale con Premium activo; no comprobable sin SQL. Sigue sin ver.
- ⚠️ Paginación de `/likes` (`PAGE_SIZE` 20): exige más de 20 likes entrantes **y** Premium para ver perfiles; crear ~21 cuentas de relleno en producción no se hizo (ya se denegó el 2026-10-30) y no hay Premium. Sigue sin ver.
- Entorno: el primer arranque tras `pm clear` mostró «Unable to load script» (Metro aún sin bundle, 40 s para el primero); un `force-stop` + relanzar bastó. El toast «Open debugger to view warnings» tapa «Registrarse» en la bienvenida.
- Limpieza: apoyo borrada con `delete_my_account` (ok); A borrada desde la app. Sin acceso SQL no se pudo comprobar en `auth.users`; el RPC `delete_my_account` arrastra decisiones y eventos (comprobado así el 2026-10-30). **Conviene una consulta de confirmación de `6eab25bc…` y `acce2d3f…` por quien tenga MCP.**
- Hecho el 2026-11-01 (Fase 2 con Premium concedido por SQL a una cuenta de prueba, luego borrada): tope de 5, «Gestionar suscripción» y «Restaurar compras» pasan. Deshacer **no devuelve** el cupo por diseño (`undo_last_decision` borra la decisión pero no `like_events`) y el contrato SQL lo prueba («sin devolver el Super Like», `contract.test.ts:1052`). La paginación de `/likes` por (is_super, liked_at, id) la prueba el contrato SQL (`contract.test.ts:1216`); no se siembran >20 cuentas en producción, así que no se ve en dispositivo.

**Verificación de limpieza (2026-11-01, SQL de solo lectura):** las dos cuentas de prueba de esa pasada (`6eab25bc…`, `acce2d3f…`) no existen en `auth.users` ni en `profiles`. Producción limpia.

#### 2026-11-01 — Fase 2 con Premium concedido por SQL (commit 5050343)

Backend: **Supabase** (logcat: «backend de datos: Supabase»). Cuenta `1862c710-ce03-469b-a2ec-584cf290304e` («Prueba Premium Fase», anónima), entitlement insertado por la orquestadora (Premium hasta 2026-11-02 16:17 UTC). Reinicio en frío (`force-stop` + monkey, sin `pm clear`). Evidencia: `e2e/artifacts/local/2026-11-01-premium-supabase-restante/` (`60`, `sl1`-`sl17`, `logcat-fase2.txt`).

- ✅ **Tope de 5 Super Likes/semana con Premium** (sl1-sl6): cinco Super Likes seguidos pasan y la tarjeta avanza cada vez (Roger → Joel 20 → Joel 18 → Joel 17 → piplop → Jo); el sexto abre «Sin Super Likes por ahora — Tu próximo Super Like llega el domingo, 8 de noviembre a las 16:19. Con Premium tienes 5 a la semana», con un solo botón «Entendido» (sin «Hazte Premium»). Repetirlo (sl10, sl11) devuelve la misma hoja y la tarjeta Jo vuelve; la captura sl9 pilla el vuelo de salida de la tarjeta antes de que vuelva y no es un séptimo Super Like colado. Hubo 5 tarjetas distintas disponibles.
- ✅ **«Gestionar suscripción»** (sl15, sl16): visible con «Activo hasta 2 nov 2026»; tocado lanza un `VIEW` a `https://play.google.com/...` y se abre Chrome (con el AVD de Google APIs sin sesión de Play, la página queda en blanco); la app sigue viva y al volver (atrás) está en Cuenta. Sin cierre ni FATAL en logcat. No se comprobó el destino exacto de la URL de Play (el volcado solo muestra `play.google.com/...`).
- ✅ **«Restaurar compras» con Premium** (sl17): muestra «Las compras aún no están disponibles.» sin cierre (igual que en gratis, esperado hasta la Fase 3).
- ✅ Con Premium (60, sl12-sl14): sin «Te quedan N likes» y los cinco botones activos; Deshacer repone la tarjeta anterior (piplop, sl12); Boost da «Boost activo durante 30 minutos» (sl13); Filtros sin ningún candado (sl14).
- Hallazgo menor: la hoja «Sin Super Likes» con Premium no ofrece más Super Likes ni compra (solo «Entendido»); bien. Que Deshacer tras un Super Like no devuelve el cupo no se comprobó.
- Sin comprobar aún: paginación de `/likes` (hacen falta >20 likes entrantes; orden dada de no sembrar cuentas) y la compra real (Fase 3).

**Limpieza final (2026-11-01):** borradas la cuenta Premium de prueba y una anónima huérfana; consulta posterior: 0 filas en users, profiles, entitlements, boosts, decisions y like_events para las 6 cuentas de prueba y 0 usuarios nuevos desde las 16:00 UTC.

**Revisión de Codex a las Edge Functions de RevenueCat (2026-11-01):** corregidos el cuerpo 200 ilegible (ya no borra Premium; reintenta) y los eventos `REFUND_REVERSED` y `TEMPORARY_ENTITLEMENT_GRANT`. **Abierto antes de desplegar:** refrescos solapados del mismo usuario pueden pisarse (una `EXPIRATION` lenta tras una `RENEWAL` deja caducado); serializar por usuario o rechazar instantáneas más viejas (p. ej. columna de versión en `entitlements` o `pg_advisory_xact_lock` en un RPC).
