# Premium (suscripción) — diseño

Fecha: 2026-10-26. Decisiones del usuario en conversación el mismo día.

## Intención

Monetizar como Tinder, pero con **un solo nivel de pago**, «Premium», que reúne lo
que Tinder reparte entre Plus y Gold. La versión gratis sigue siendo útil: se
puede swipear, hacer match y chatear sin pagar. Premium quita el límite de likes
y añade herramientas para encontrar antes a la persona adecuada.

Adelanta la Fase 5 de `CONCEPTO.md` («Premium»). `PLAN.md` → «Qué NO hacer»
prohibía adelantarla sin diseño; este documento es ese diseño. Lo demás de la
Fase 5 (partnerships B2B, gamificación avanzada) sigue fuera.

Decisiones del usuario (2026-10-26):

- **Sin anuncios.** La app admite usuarios de 16 y 17 años, y las dos fichas
  declaran «sin publicidad». Con pocos usuarios, los anuncios apenas pagan y
  restan confianza en una app de cofundador. Se puede reabrir más adelante, con
  su propia spec (CMP, ATT, DSA para menores).
- **Un solo nivel**, no Plus/Gold/Platinum.
- **25 likes al día** en la versión gratis.

Se copian las *funciones* de Tinder, no su marca: nada de «Gold», «Plus»,
«Platinum», «Tinder» ni su iconografía en textos, código o fichas.

## Fuera de alcance (YAGNI)

- Anuncios de cualquier tipo.
- Varios niveles, y compras sueltas de Super Likes o Boosts (consumibles).
- «Top Picks», «mensaje antes del match» y «likes prioritarios» (lo de Platinum).
- «Passport» como ubicación falsa: aquí la ubicación es texto libre y no filtra.
  Su equivalente útil es filtrar por zona horaria (§2.6).
- Pago fuera de las tiendas (web checkout o Stripe). Las suscripciones digitales
  van por Apple IAP y Google Play Billing.
- Estadísticas del Boost (vistas o alcance).
- Premium regalado, códigos promocionales propios y programa de referidos. Las
  ofertas de las tiendas sí se pueden usar, porque no piden código nuestro.

## 1. Catálogo

| Producto | Tipo | Precio (propuesta, **pendiente del usuario**) |
|---|---|---|
| `premium_monthly` | Suscripción auto-renovable, 1 mes | 9,99 € |
| `premium_yearly` | Suscripción auto-renovable, 1 año | 49,99 € (~58 % menos) |

- Los dos productos van en el mismo grupo de suscripción de Apple, y en Google
  son dos *base plans* de una suscripción `premium`. Así, pasar de uno a otro es
  un cambio de plan, no una segunda suscripción.
- Prueba gratis: **ninguna** al lanzar. Si se quiere, es una oferta de
  introducción en las tiendas y no toca código.
- Un solo *entitlement* en RevenueCat: `premium`.

## 2. Qué incluye

| | Gratis | Premium |
|---|---|---|
| Likes | 25 por 24 h | Sin límite (tope antiabuso, §2.1) |
| Deshacer el último swipe | — | Sí |
| Ver quién te ha dado like | Solo el número | La lista de perfiles |
| Super Like | 1 por 7 días | 5 por 7 días |
| Boost (30 min arriba del deck) | — | 1 por 30 días |
| Filtros del deck | Especialidad (como hoy) | + disponibilidad, ambición, punto de partida, zona horaria |

**Principio:** cada límite y cada permiso se comprueba **en el servidor**. El
cliente solo pinta. Un cliente modificado que llame al RPC directamente se
encuentra el mismo muro.

### 2.1 Límite de likes

- Ventana **deslizante de 24 h**, no de día natural: no depende de la zona
  horaria y no deja que alguien gaste 25 a las 23:59 y otros 25 a las 00:00.
- No se cuenta sobre `decisions`, porque esa tabla hace upsert y guarda solo la
  última decisión. Contar ahí abriría un truco: dar like a X (y, si es
  recíproco, el match nace en ese momento), cambiarlo a pass, y repetir con el
  siguiente sin gastar nada. Por eso hay un **registro aparte, solo de
  inserción**: `like_events` (§3).
- Un Super Like cuenta también como like.
- **Tope antiabuso para todos, Premium incluido:** 300 likes por 24 h. Frena el
  scraping y los bots. Ningún humano lo nota.
- El pass no gasta nada y no tiene límite.
- La UI sabe cuándo vuelve a haber likes: el evento más antiguo de la ventana +
  24 h.

### 2.2 Deshacer

- Solo **el último** swipe, y solo si tiene **menos de 10 minutos**.
- No se puede deshacer un like que ya creó match (el otro ya lo ha visto).
- Borra la fila de `decisions`, así que el perfil vuelve al deck. **No** devuelve
  el like gastado ni el Super Like (`like_events` es solo de inserción). Para
  Premium da igual, y así no se abre un truco de recarga.
- Solo Premium. Gratis: el botón existe y abre el paywall.

### 2.3 Ver quién te ha dado like

Revoca a propósito la regla de `20260905000300_decisions_matches_messages.sql`
(«saber quién te ha dado like antes de corresponder rompería el producto»):
ahora es justo lo que se vende. La regla sigue valiendo para la versión gratis,
y la RLS de `decisions` **no cambia**: la lista solo sale por RPC.

- `incoming_likes_count()`: para todos. Cuenta los likes y Super Likes que me han
  dado y que yo no he decidido todavía, sin bloqueos en ninguna dirección.
- `incoming_likes(p_limit, p_before)`: solo Premium (`42501` si no). Mismos
  perfiles, como `Profile` completo, con `is_super` y la fecha. Primero los Super
  Likes, luego del más reciente al más antiguo.
- Gratis ve el número y unas tarjetas de **relleno genérico**, no las fotos
  reales emborronadas: el emborronado se deshace en el cliente, así que mandar la
  foto ya sería filtrarla.
- Desde la lista se decide con `record_decision` de siempre. Un like ahí siempre
  es recíproco, así que crea match en el momento y **gasta** del cupo de likes
  igual que en el deck.

### 2.4 Super Like

- Es un like con la marca `is_super`. Crea match igual que un like.
- Quien lo recibe ve la tarjeta de quien se lo dio **antes** en su deck, con una
  insignia «Te ha dado un Super Like». Es lo único que revela, y lo revela a
  propósito: sin esto, el Super Like no tendría ningún efecto.
- Cupo: 1 cada 7 días gratis y 5 cada 7 días con Premium, en ventana deslizante
  sobre `like_events.kind = 'super'`.
- Sin notificación push por ahora (el proyecto no tiene push).

### 2.5 Boost

- `activate_boost()`: solo Premium, 1 por 30 días deslizantes y 30 minutos de
  duración. Falla si ya hay uno activo.
- Mientras dura, el perfil sale **delante** en el deck de los demás: se ordena
  primero por «boost activo», y después por el orden de siempre (puntuación de
  encaje y desempate por id). Los filtros siguen mandando: un Boost no mete el
  perfil en decks que lo excluyen.
- Orden total del deck: Super Like que me han dado → Boost activo → orden de
  siempre.
- Aviso honesto en la UI: con pocos usuarios, el Boost se nota poco. No
  prometemos cifras.

### 2.6 Filtros avanzados

`ProfileFilter` gana campos solo para Premium. Todos filtran sobre campos que el
perfil ya tiene:

- `availability?: Availability[]`
- `ambition?: Ambition[]`
- `startingPoint?: StartingPoint[]`
- `timezoneWindowHours?: number` (0–12): solo perfiles cuyo desfase UTC
  **actual** queda a ±N h del mío. Se calcula en SQL con
  `now() at time zone p.timezone`, así que el horario de verano lo resuelve
  Postgres.

Si alguien sin Premium pasa cualquiera de estos campos, `discovery_deck` falla
con `42501`. No los ignora en silencio, porque si no el usuario vería un deck
sin filtrar creyendo que está filtrado. El filtro de especialidad sigue gratis.

## 3. Datos (Supabase)

Una migración nueva, `2026xxxx_premium.sql`:

- **`entitlements`** (`user_id` PK → `profiles.id` con cascade,
  `premium_until timestamptz null`, `product_id text`, `store text check in
  ('app_store','play_store')`, `updated_at`). RLS: el usuario solo puede leer su
  fila. **Ningún grant de escritura al cliente**: solo escribe la service role
  (§4), igual que el sello de GitHub o `avatar_url`.
- **`public.is_premium(uid)`**: `security definer`, `stable`. Devuelve
  `premium_until > now()`. Se le da un **margen de gracia de 0**: las tiendas ya
  tienen su propio periodo de gracia por cobro fallido y lo reflejan alargando
  `premium_until`.
- **`like_events`** (`id`, `actor_id` → profiles cascade, `target_id`,
  `kind text check in ('like','super')`, `created_at default now()`). Índice
  `(actor_id, kind, created_at desc)`. Sin grants al cliente: solo lo escribe
  `record_decision`. Para mantenerla pequeña, `pg_cron` borra las filas de más de
  30 días (el cupo más largo es de 7).
- **`decisions.is_super boolean not null default false`**. No es un valor nuevo
  del enum: `Decision` sigue siendo `'like' | 'pass'`, así que no se rompen los
  mappers ni los fixtures existentes.
- **`boosts`** (`id`, `user_id` → profiles cascade, `starts_at`, `ends_at`).
  Índice por `ends_at`. Sin grants.
- **`revenuecat_events`** (`event_id text` PK, `received_at`): da idempotencia al
  webhook. Se purga a los 90 días.
- **`record_decision`**: gana `p_super boolean default false`, con
  `CREATE OR REPLACE` y la firma ampliada. Ojo con la sobrecarga: hay que borrar
  antes la firma de tres argumentos, como en
  `20260929000200_drop_discovery_deck_overload.sql`. Con like o Super Like:
  1. bloquea con `pg_advisory_xact_lock` sobre el actor, para que dos llamadas a
     la vez no se cuelen las dos en el cupo;
  2. si la decisión previa sobre ese target ya era un like del mismo tipo, no
     gasta nada (es idempotente: un reintento de red no cobra dos veces);
  3. comprueba el cupo y, si no queda, `raise` con `errcode 'LQ001'` (likes),
     `'LQ002'` (Super Likes) o `'LQ004'` (tope antiabuso);
  4. inserta en `like_events` y sigue como hoy.
- **`undo_last_decision()`**: aplica las reglas de §2.2. Devuelve el `target_id`
  deshecho, o `null` si no había nada que deshacer. `42501` sin Premium.
- **`activate_boost()`**: aplica §2.5. Devuelve `ends_at`. Usa `'LQ003'` si no
  queda Boost.
- **`premium_quotas()`**: una sola lectura para la UI. Devuelve `is_premium`,
  `premium_until`, `likes_left`, `likes_reset_at`, `supers_left`,
  `supers_reset_at`, `boost_available_at` y `boost_active_until`.
- **`discovery_deck`**: gana los parámetros de §2.6 y el orden de §2.4–2.5.
  Devuelve también `super_liked_me boolean` por fila. Al cambiar la firma, hay
  que borrar la anterior en la misma migración.
- Los nuevos `security definer` siguen el patrón de
  `20261003000100_harden_grants_and_clock.sql`: `revoke execute from public`,
  `grant` solo a `authenticated`, y `search_path = ''`.
- Borrar la cuenta: las tablas nuevas caen por cascade. **La suscripción de la
  tienda no se cancela** (no podemos hacerlo nosotros; ver el aviso de §6).

## 4. Cobro: RevenueCat

Se elige `react-native-purchases` (RevenueCat) y no `expo-iap`. RevenueCat
valida los recibos en su servidor y manda webhooks, lo que nos ahorra escribir y
mantener la validación de StoreKit 2 y de Play Billing. Es gratis hasta 2.500 $
de ingresos al mes. Expo lo documenta como camino soportado. **No funciona en
Expo Go**, solo en development build, y el proyecto ya compila APK propio.
Antes de instalar, verificar la versión compatible con SDK 58 contra
https://docs.expo.dev/versions/v58.0.0/ y la guía
https://docs.expo.dev/guides/in-app-purchases/.

- **Identidad:** `app_user_id` de RevenueCat = `auth.uid()` de Supabase.
  `Purchases.logIn(uid)` al iniciar sesión y `logOut()` al cerrarla. Nunca
  usuarios anónimos de RevenueCat: así una compra no puede quedar sin dueño.
- **La verdad está en el servidor:** la Edge Function **`revenuecat-webhook`**
  (`verify_jwt = false`). Comprueba la cabecera `Authorization` contra un secreto
  compartido con comparación de tiempo constante, y descarta los eventos ya
  vistos (`revenuecat_events`). Por cada evento **no se fía del cuerpo**: pide
  el estado actual a la API REST de RevenueCat (`GET /subscribers/{id}`) y
  escribe `premium_until` con lo que diga. Así, el orden de llegada de los
  eventos da igual. Si el `app_user_id` no tiene perfil (cuenta borrada),
  responde 200 y no hace nada.
- **Sin esperar al webhook:** tras comprar o restaurar, el cliente llama a la
  Edge Function **`sync-entitlement`** (`verify_jwt`), que hace la misma consulta
  REST para *su propio* uid. La UI se desbloquea cuando `premium_quotas()` dice
  `is_premium`, **no** cuando lo dice el SDK. El SDK solo sirve para pintar el
  paywall y para comprar.
- **Secretos:** la clave REST secreta de RevenueCat y el secreto del webhook van
  en secretos de Edge Function. Las claves públicas del SDK (una de iOS y otra de
  Android) van en `EXPO_PUBLIC_REVENUECAT_*`. Recordar que Gradle no rastrea los
  `EXPO_PUBLIC_*` (memoria `gradle-no-rastrea-expo-public`).
- **Backend mock:** no hay SDK. `MockPremiumRepository` tiene un interruptor de
  desarrollo («Simular Premium») y aplica los mismos cupos en memoria, para que
  los tests y el deck mock se comporten igual que en Supabase.

## 5. Capa de datos (contrato)

- Nuevo `PremiumRepository` en `repositories.ts`:
  - `getQuotas(): Promise<PremiumQuotas>` y `subscribeQuotas(cb)`. El refresco
    llega tras cada decisión, Boost, deshacer o sincronización. Sin realtime.
  - `undoLastDecision(): Promise<string | null>`
  - `activateBoost(): Promise<string>` (devuelve `ends_at` en ISO)
  - `countIncomingLikes(): Promise<number>`
  - `listIncomingLikes(page?): Promise<IncomingLike[]>`
  - `syncEntitlement(): Promise<void>`
- `DiscoveryRepository.recordDecision` gana `options?: { super?: boolean }`.
  `getDeck` devuelve `superLikedMe` en cada perfil, como dato de deck y no de
  `Profile` (va en un tipo envoltorio `DeckProfile`, para no ensuciar `Profile`).
- Errores traducidos a `QuotaExceededError { kind: 'likes' | 'supers' | 'boost' |
  'abuse', resetsAt }` y `PremiumRequiredError`. La UI reacciona a estos tipos,
  nunca a los códigos SQL.
- La compra (`src/lib/purchases.ts`) **no** es un repositorio: es un envoltorio
  del SDK (`getOfferings`, `purchase(pkg)`, `restore()`, `manageUrl()`) que solo
  usa el paywall. Con el mock devuelve ofertas falsas.

## 6. UI

- **Deck** (`discover/deck-actions.tsx`): pasa a tener cinco botones: deshacer,
  pass, Super Like, like y Boost. Deshacer y Boost llevan candado sin Premium.
  Con ≤ 5 likes, una línea discreta: «Te quedan N likes». Sin likes, el botón de
  like (y el gesto a la derecha) abre una hoja: «Sin likes hasta las HH:MM ·
  Hazte Premium». El pass sigue funcionando.
- **Tarjeta:** insignia «Te ha dado un Super Like» si `superLikedMe`.
- **Matches:** fila arriba, «Te han dado like (N)». Con Premium abre una
  cuadrícula y, al tocar un perfil, la tarjeta con like y pass. Sin Premium,
  relleno genérico y el paywall.
- **Filtros del deck:** los nuevos aparecen con candado sin Premium.
- **Paywall** (ruta modal `premium`): beneficios, los dos planes con precio
  localizado **sacado de la tienda** (nunca escrito a mano), y lo que Apple 3.1.2
  y Google obligan a mostrar: duración, precio por periodo, renovación
  automática, cómo cancelar y enlaces a Términos y Privacidad. Botones «Restaurar
  compras» y «Continuar». Estados: cargando ofertas, error con reintento,
  comprando y pendiente (pagos diferidos de Play).
- **Perfil → Cuenta:** fila «Premium». Muestra «Activo hasta …» y «Gestionar
  suscripción» (abre la gestión de la tienda) o «Hazte Premium». Siempre muestra
  también «Restaurar compras».
- **Borrar cuenta:** si `is_premium`, aviso previo: «Tu suscripción no se cancela
  sola: cancélala en la tienda o se seguirá cobrando», con el enlace de gestión.
- Copys en español. El estilo visual (sin dorados de Tinder) es del sistema de
  diseño actual. Pulido posterior por `visual`.

## 7. Legal y tiendas

- **Términos:** sustituir la línea «Hoy el uso de la app es gratuito…» por una
  sección de suscripción: qué incluye, precio y periodo según la tienda,
  renovación automática, cancelación desde la tienda, reembolsos según la
  política de cada tienda, y desistimiento. Para contenido digital que empieza
  al momento, el usuario consiente perder el derecho de desistimiento (art.
  103.m TRLGDCU), y lo canaliza la tienda. Versión nueva y re-aceptación con
  `terms_acceptances`.
- **Privacidad:** RevenueCat como encargado del tratamiento (DPA), con los datos
  que trata (uid, historial de compras y estado de la suscripción) y la
  transferencia a EE. UU. (DPF o SCC). Las tiendas actúan como responsables
  propios del cobro.
- **Fichas:** «Compras dentro de la app: sí» en las dos. En Data safety de Play,
  «Historial de compras». En App Store Privacy, «Purchases» (no vinculado a
  tracking). Siguen sin anuncios.
- **Cuentas y contratos (del usuario):**
  - Apple: membresía pagada, Paid Apps Agreement, datos bancarios y fiscales, y
    los productos en App Store Connect.
  - Google: perfil de pagos, y Play mostrará la dirección del vendedor.
  - RevenueCat: proyecto, apps y webhook.

## 8. Pruebas

- **Contrato SQL** (el patrón de los tests de contrato de Supabase):
  - el like 26 en 24 h falla con `LQ001`, y el 25 pasa;
  - like → pass → like sobre el mismo target gasta dos;
  - reintentar el mismo like no gasta;
  - dos llamadas concurrentes no superan el cupo;
  - deshacer: menos de 10 min sí; con match no; sin Premium `42501`;
  - `incoming_likes` sin Premium da `42501`, y nunca devuelve bloqueados;
  - los filtros premium sin Premium dan `42501`;
  - Boost: el orden y el cupo de 30 días;
  - `entitlements` no se puede escribir con la clave anon ni con la de
    usuario.
- **Edge Functions:** firma inválida → 401; evento repetido → no-op;
  `app_user_id` sin perfil → 200; error de la API de RevenueCat → 5xx (para que
  RevenueCat reintente).
- **Jest:** el mock aplica los mismos cupos; los hooks de cuota; el deck con
  cada error; el paywall con cada estado.
- **`[comprobador]`:** recorrido gratis (agotar los likes, ver la hoja, ver el
  número de likes) en el emulador con mock y con Supabase. La compra real exige
  Play Console con track interno y cuenta de *license tester*: queda bloqueada
  hasta que exista. iOS sandbox es tarea del usuario.

## 9. Entrega por fases

1. **Servidor:** migración, RPCs y contrato SQL. Se prueba sin tiendas, poniendo
   `premium_until` a mano en los tests.
2. **Cliente con mock:** contrato, mock, deck, Matches, filtros y paywall con
   ofertas falsas.
3. **Cobro real:** SDK, `revenuecat-webhook`, `sync-entitlement` y productos.
   **Bloqueado** por las cuentas de §7.
4. **Legal y fichas**, antes de activar los productos en las tiendas.

Las fases 1 y 2 tocan los archivos de `datos` y `descubrir`. No se lanzan a la
vez que esos bloques ni que `visual`.

## 10. Riesgos

- **Pool pequeño:** con pocos perfiles, 25 likes casi no limitan, y el Boost se
  nota poco. Valor real al empezar: ver quién te ha dado like. Revisar el límite
  con datos de uso, no a ojo.
- **Se rompe una promesa:** «nadie ve quién le dio like» deja de valer para
  Premium. No hay que tocar normas ni privacidad, porque son datos propios de la
  app, pero no debe filtrarse a gratis por ningún otro sitio: los tests de
  `incoming_likes` lo vigilan.
- **Coste de RevenueCat:** pasa a cobrar a partir de 2.500 $ al mes. Es un
  problema bueno de tener.
