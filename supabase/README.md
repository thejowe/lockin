# `supabase/` — esquema de datos de LockIn

Diseño del esquema que sostiene el contrato de repositorio de `arquitecto`
(`src/data/repositories.ts` + `src/data/types.ts`).

> **Estado (2026-09-07): aplicada hasta 20260907000200.** La consulta
> autenticada de esta sesión devuelve los nueve perfiles y confirma los valores
> de seeking_specialties de los ocho seed (evidencia en todo/datos.md).
> **20260907000200_discovery_mutual_complement.sql aplicada por el usuario.**
> Contrato remoto verificado después: **35/35 pasados**, 53.912 s.
> No volver a aplicar ni editar migraciones anteriores.

## Migraciones

Se aplican en orden de nombre:

| Archivo | Qué hace |
|---|---|
| `20260905000100_enums_and_helpers.sql` | Enums espejo de las uniones de `types.ts` + helpers inmutables |
| `20260905000200_profiles_and_settings.sql` | `profiles` (1:1 con `auth.users`) y `user_settings` |
| `20260905000300_decisions_matches_messages.sql` | `decisions`, `matches`, `messages` y `is_match_member()` |
| `20260905000400_rls_policies.sql` | Row Level Security de las cinco tablas |
| `20260905000500_functions_and_realtime.sql` | `record_decision()`, `discovery_deck()`, trigger de `last_message_at`, realtime |
| `20260907000100_profiles_seeking_specialties.sql` | `profiles.seeking_specialties` — qué busca el perfil en la otra persona |
| `20260907000200_discovery_mutual_complement.sql` | Orden por encaje mutuo y desempate estable por id antes de paginar |

Las aplicadas no se editan nunca: un cambio de esquema entra como archivo nuevo.
Editar `20260905000200` para meterle una columna dejaría el repo diciendo una
cosa y `grrzmzktrhksbttpbblg` otra, que es exactamente la deriva que
`drift-check.mjs` existe para cazar.

Aplicar en local:

```bash
supabase start          # levanta Postgres + servicios
supabase db reset       # aplica todas las migraciones desde cero
```

Aplicar contra un proyecto remoto (necesita credenciales):

```bash
supabase link --project-ref <ref>
supabase db push
```

## Modelo

```
auth.users ──1:1── profiles ──┬── decisions (actor_id, target_id)
                              ├── matches (profile_a, profile_b)  ──< messages
                              └── user_settings (modo activo)
```

Cinco tablas, no tres. `.claude/agents/datos.md` pide `profiles`, `matches` y
`messages`; las otras dos las **exige el contrato de `arquitecto`**, no son
alcance inventado:

- **`decisions`** — `DiscoveryRepository.recordDecision` necesita saber si el
  otro lado ya dio like, y `listDecided`/`getDeck` necesitan excluir lo ya
  swipeado. En el mock esto es `state.decisions` + `state.incomingLikes`.
- **`user_settings`** — `Session.activeMode` se elige en la primera pantalla del
  onboarding, **antes** de que exista el perfil, así que no puede ser una
  columna de `profiles`.

## Mapeo tipo ↔ tabla

### `Profile` → `public.profiles`

| Campo TS | Columna | Nota |
|---|---|---|
| `id` | `id` | Es `auth.uid()`. No hay tabla de traducción |
| `name` | `name` | |
| `age` | `age` | `check (16..120)` |
| `location` | `location` | |
| `timezone` | `timezone` | IANA. Se valida en la app, no en un `check` que caduque con tzdata |
| `avatar.initials` | `avatar_initials` | 1-2 letras mayúsculas |
| `avatar.accent` | `avatar_accent` | enum `brass \| teal` |
| `specialties` | `specialties` | Lo que **domina**. `specialty[]`, 1-10, sin repetidos, índice GIN |
| `seekingSpecialties` | `seeking_specialties` | Lo que **busca en la otra persona**. `specialty[]`, 0-10, sin repetidos. Sin índice: hoy no lo filtra nadie |
| `lookingFor` | `looking_for` | enum `mode_preference` |
| `startingPoint` | `starting_point` | |
| `availability.hoursPerWeek` | `availability_hours_per_week` | |
| `availability.bands` | `availability_bands` | `time_band[]`, al menos una |
| `ambition` | `ambition` | |
| `links.github/portfolio/linkedin` | `link_github`, `link_portfolio`, `link_linkedin` | Aplanado: son tres columnas fijas, no un blob |
| `prompts` | `prompts` | `jsonb`, máx. 2. jsonb y no tabla aparte porque el orden importa y siempre se leen con el perfil |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | `timestamptz`; PostgREST los serializa como ISO |

`ProfileInput` no tiene columnas propias: `id` es `auth.uid()`, los timestamps
los pone la base, y las iniciales las deriva el cliente (`initialsFrom`) igual
que hoy hace el mock.

**Sin `image_url`, sin sueldo, sin equity, sin rol vacante.** El MVP no sube
imágenes y el Modo Talento es Fase 4 — el enum `mode` ni siquiera puede
representarlo. `seeking_specialties` es lo más cerca que el esquema llega de
«qué busco», y es simétrico a propósito: las dos personas de un match lo
declaran, ninguna publica una vacante. No lo acompañes nunca de sueldo,
seniority ni número de puestos.

Dos cosas de `seeking_specialties` que no se ven en la tabla de arriba:

- **El vacío tiene dos lecturas**, según `looking_for`. Con `lockin` es «no
  aplica» —un compañero de enfoque se elige por franja horaria, no por skills— y
  es el único valor legal. Con `par`/`ambos` es «abierto a cualquiera». Nunca es
  «no busco a nadie», y nunca es «dato ausente».
- **Esa invariante no la fuerza la base.** El CHECK solo mira cardinalidad y
  duplicados; que un perfil de `lockin` lo lleve vacío lo mantiene quien escribe
  el perfil. Es decisión de `arquitecto` (ver `docs/plan/todo/arquitecto.md`):
  el mock tampoco la fuerza, y los dos backends cumplen el mismo contrato.

### `Match` → `public.matches`

`Match.profileIds` es la tupla `[propio, otro]`. En la base el par se guarda
**ordenado canónicamente** (`profile_a < profile_b`) con un `unique`, para que
no puedan existir dos matches entre las mismas dos personas. La tupla del
contrato se reconstruye en la capa de mapeo del cliente, poniendo primero al
usuario actual.

`lastMessageAt` es `last_message_at`, que mantiene un trigger `after insert`
sobre `messages` — el cliente nunca lo escribe.

### `MatchWithProfile`

No es una tabla. Se resuelve en una consulta con dos joins embebidos de
PostgREST (el perfil del otro lado + el último mensaje), o con una vista si
resulta lenta. `MatchRepository.list()` ordena por
`coalesce(last_message_at, created_at) desc`, que es lo que cubren los índices
`matches_profile_a_idx` / `matches_profile_b_idx`.

### `Message` → `public.messages`

Uno a uno, salvo `sentAt` → `sent_at`. Sin edición ni borrado en el MVP: no hay
políticas de `update` ni `delete`.

### `Session` → derivada

| Campo TS | De dónde sale |
|---|---|
| `profileId` | `auth.uid()` si existe fila en `profiles`; `null` si no |
| `activeMode` | `user_settings.active_mode` |

`isOnboarded()` = las dos cosas no nulas.

### `Decision` / `DecisionResult` → `public.record_decision()`

RPC. Devuelve la fila de `matches` creada o `NULL`, que es exactamente
`DecisionResult.match`.

## Seguridad

RLS activo en las cinco tablas, y `anon` revocado en todas — un usuario sin
autenticar no lee nada.

| Tabla | Lectura | Escritura |
|---|---|---|
| `profiles` | Cualquier autenticado | Solo tu propia fila |
| `user_settings` | Solo la tuya | Solo la tuya |
| `decisions` | Solo donde eres el `actor` | Solo en tu nombre. Sin update/delete |
| `matches` | Solo si eres uno de los dos | Ninguna — solo `record_decision()` |
| `messages` | Solo de tus matches | Solo en tu nombre y dentro de un match tuyo |

Tres decisiones que conviene entender antes de tocarlas:

1. **`profiles` es legible por cualquier autenticado.** Es lo que hace posible
   el deck de swipe. Aceptable en el MVP porque el perfil no lleva datos de
   contacto (nombre de pila, edad, zona, texto libre). Si se añade cualquier
   dato sensible, esta política tiene que estrecharse.

2. **Nadie puede leer `decisions` por `target_id`.** Si pudieras consultar quién
   te ha dado like, el swipe pierde el sentido. La reciprocidad solo se resuelve
   dentro de `record_decision()`, que es `SECURITY DEFINER` y salta RLS.

3. **Los matches no los crea el cliente.** Crear uno exige ver el like del otro
   lado, cosa que RLS niega. Por eso `record_decision()` es la única puerta, y
   toma el actor de `auth.uid()` — nunca de un parámetro.

Todas las funciones `SECURITY DEFINER` van con `set search_path = ''` y nombres
totalmente cualificados.

## Realtime

`matches` y `messages` están en la publicación `supabase_realtime` con
`replica identity full`. Las políticas de `select` también filtran el stream,
así que cada usuario solo recibe eventos de lo suyo. Eso es lo que sostiene
`MatchRepository.subscribe` y `MessageRepository.subscribe`.

## Cómo aplicarlas

Ninguno de los tres caminos necesita Docker: el proyecto es remoto.

1. **SQL Editor del dashboard.** Pega los archivos en orden de nombre. Es el
   camino sin credenciales extra, y el único disponible ahora mismo. Sobre una
   base que ya tiene las cinco primeras aplicadas basta con pegar las nuevas —
   hoy, `20260907000100_profiles_seeking_specialties.sql`.
2. **`supabase db push` con la contraseña de Postgres.** Con un
   `SUPABASE_ACCESS_TOKEN` (Account → Access Tokens) en el entorno:

   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```

3. **`supabase db push --db-url`**, si tienes la cadena de conexión del pooler.
   El host directo `db.<ref>.supabase.co` solo resuelve por IPv6 y falla desde
   una red sin IPv6; usa el pooler (`aws-0-<region>.pooler.supabase.com`).

Después, para sembrar datos de desarrollo, ejecuta `supabase/seed.sql` (crea
ocho usuarios con contraseña conocida: **nunca contra producción**).

## Deriva de esquema

Hay dos bases y ningún mecanismo que garantizara que coinciden:

- La **local**, que `e2e/run.mjs` construye copiando `supabase/migrations/` y
  `supabase/seed.sql` a una Supabase desechable. Sale de los archivos del repo,
  así que es reproducible por definición.
- La **desplegada** (`grrzmzktrhksbttpbblg`), cuyo esquema se aplicó pegando SQL
  a mano en el SQL Editor, porque el CLI exige un `SUPABASE_ACCESS_TOKEN` o la
  contraseña de Postgres y ninguna de las dos está —ni debe estar— en el repo.

`src/data/supabase/contract.test.ts` habla con la desplegada. O sea que el 25/25
de esa suite y el verde del E2E local pueden convivir con las dos bases
divergidas y nadie se enteraría. Es el mismo patrón que ya costó una tarde
("el seed que se había ejecutado era el anterior", en `docs/plan/TODO.md`).

Dos herramientas lo detectan, y son complementarias a propósito:

| | `supabase/drift-check.mjs` | `supabase/schema-fingerprint.sql` |
|---|---|---|
| Cómo se ejecuta | `node supabase/drift-check.mjs` | pegar en el SQL Editor, y en la base local |
| Qué necesita | la clave `anon` de `.env.local` | acceso SQL a las dos bases (Docker para la local) |
| Qué ve | tablas, columnas y sus tipos, valores de enum, firmas de las funciones RPC, y que `anon` siga revocado | **todo**: además políticas, CHECKs, índices, triggers, defaults, permisos, y los objetos que sobren |
| Qué NO ve | nada de lo anterior, ni los objetos que existan **de más** en el despliegue | — |
| Automatizable | sí, sale con código 1 si hay deriva | no, son dos pegadas manuales |

Ninguna de las dos usa `service_role`. `drift-check.mjs` no puede: el endpoint
OpenAPI de PostgREST (`GET /rest/v1/`), que daría el catálogo entero de un
tirón, lo bloquea la pasarela de Supabase con *"Only the service_role API key
can be used for this endpoint"*. Así que deduce el esquema a base de sondas sin
efectos, leyendo los códigos de error de PostgREST (`PGRST205` tabla que falta,
`42703` columna que falta, `22P02` que además nombra el tipo o el enum,
`PGRST202` firma de función que no existe). Lo esperado no está escrito a mano
en ningún sitio: se saca de `supabase/migrations/` en cada ejecución, para que
la referencia no pueda quedarse atrás.

`schema-fingerprint.sql` emite una línea por objeto y, la primera, un `digest`
md5 de todas: si los dos `digest` coinciden no hay nada más que mirar. Sus
instrucciones de uso están en la cabecera del propio archivo.

### Dónde vive `dev_reset_current_user()`, y por qué

**Se queda en `supabase/seed.sql`.** No entra en `supabase/migrations/`.

El motivo no es que sea `SECURITY DEFINER`: no toma parámetros y solo mira
`auth.uid()`, así que nadie puede apuntarla contra otra persona. El motivo es el
daño colateral. Borra los matches del usuario, y con cada match se van los
mensajes de la **otra** persona y los likes que esa persona le dio. En
producción sería un botón de "destruye datos que no son solo tuyos" sin
confirmación, al alcance de cualquier cliente con sesión. Si algún día hace
falta un borrado de cuenta de verdad, se diseña como tal.

Las otras dos opciones que se consideraron, y por qué no:

- **Una migración con guardia de entorno.** La guardia tendría que distinguir
  una base de desarrollo de una de producción, y aquí no hay forma limpia de
  hacerlo: la app usa `signInAnonymously()` como vía principal, así que "el que
  llama es un usuario anónimo" describe tanto a la suite de contrato como a un
  usuario real. Y una migración condicional haría que la base local y la
  desplegada difieran *legítimamente*, que es exactamente lo que rompe el
  cotejo que acabamos de montar.
- **Un archivo aparte en `supabase/dev/`.** Más limpio de leer, pero
  `e2e/run.mjs` copia solo `migrations/` y `seed.sql`: sacarla de ahí la
  quitaría en silencio de la única base local que el repo sabe construir, y
  `e2e/` es de otro bloque.

Lo que sí faltaba no era el archivo, era que su instalación en el despliegue
fuera **verificable** en vez de "alguien la pegó un día". Ahora:

- `drift-check.mjs` informa en cada ejecución de si está instalada.
- `supabase/dev-teardown.sql` la retira (y a `seed_incoming_likes`) de una
  pegada.

Y queda apuntado el nudo de fondo: hoy `grrzmzktrhksbttpbblg` es a la vez
desarrollo, staging y el proyecto al que apunta la app, así que la suite de
contrato obliga a tener instalada en él una función que no debería estar donde
hay usuarios reales. La salida no es esconder la función: es que la suite corra
contra una base desechable. `contract.test.ts` lee la URL y la clave de
`.env.local`, así que basta apuntarlo a una Supabase local
(`supabase start` + `supabase db reset --local`, que aplica migraciones y seed)
para que el proyecto remoto pueda quedarse limpio.

### Resultado de la ejecución del 2026-09-06

`node supabase/drift-check.mjs` contra `grrzmzktrhksbttpbblg`: **sin deriva**.

- Las 5 tablas y sus 38 columnas existen con el tipo que declaran las
  migraciones.
- Los 8 enums admiten sus 29 valores.
- Las 6 funciones que PostgREST expone responden con la firma esperada
  (`array_has_duplicates`, `is_valid_prompts`, `is_match_member`,
  `resolve_match_mode`, `record_decision`, `discovery_deck`). Las dos que
  devuelven `trigger` —`touch_updated_at`, `messages_touch_match`— PostgREST no
  las expone y no se pueden sondear desde el cliente.
- `anon` sin sesión sigue recibiendo `42501` en las cinco tablas.
- `dev_reset_current_user()` y `seed_incoming_likes(p_email)` están instaladas,
  como se esperaba y como no debería quedarse cuando haya usuarios reales.

`schema-fingerprint.sql` **no se ha ejecutado todavía**: el lado del repo exige
Docker para levantar la base local y en esta máquina no hay ni Docker ni `psql`,
así que solo se habría podido generar la mitad del cotejo, y media huella no
compara con nada. Su sintaxis sí está verificada contra la gramática real de
PostgreSQL (libpg_query). Queda pendiente ejecutarlo en una máquina con Docker.

## Configuración de Auth en el dashboard

Dos interruptores de Authentication → Providers importan aquí, y el estado
actual del proyecto `grrzmzktrhksbttpbblg` es este:

- **`external.anonymous_users: true`** (activado). Es la vía principal de
  `src/data/supabase/auth.ts`: `signInAnonymously()` abre sesión sin pedir nada
  al usuario, que es lo que permite que el contrato de repositorio no tenga
  login y que ninguna pantalla sepa de autenticación. Verificable con
  `GET /auth/v1/settings`.
- **`mailer_autoconfirm: false`** (desactivado). **Decisión tomada: se queda
  así.** Autoconfirmar da por buena cualquier dirección sin comprobar que quien
  se registra la controla, o sea, permite registrarse con el email de otra
  persona. No estorba porque el camino por email es solo el respaldo de
  `auth.ts` (cuenta de dispositivo con email y contraseña aleatorios, que nadie
  tiene que leer) y `linkEmailToCurrentUser()`, que sí debe pedir confirmación.
  Los ocho usuarios de `seed.sql` no lo necesitan: se insertan con
  `email_confirmed_at` ya puesto. Si algún día el registro por email se vuelve
  la vía principal, se activa el envío de correos de verdad, no el autoconfirm.

## Mantenimiento: borrar los usuarios anónimos de pruebas

Cada pasada de `src/data/supabase/contract.test.ts` da de alta **cuatro**
usuarios anónimos (el del test y tres de apoyo). Su `teardown()` llama a
`dev_reset_current_user()` con los cuatro, así que sus perfiles, decisiones,
matches y mensajes sí desaparecen y el catálogo vuelve a los ocho de
`seed.sql`. Lo que sobrevive es la fila de `auth.users`: borrar ahí exige
privilegios que la clave `anon` no tiene.

No es urgente —sin perfil, esas cuentas no entran en ningún deck ni en ninguna
consulta— pero conviene vaciarlas de vez en cuando para que la tabla no crezca
sin fin. Dos caminos:

**1. SQL Editor del dashboard** (corre como superusuario; es el camino usado
hasta ahora). Mira primero cuántas hay:

```sql
select count(*) from auth.users where is_anonymous = true;
```

y bórralas:

```sql
delete from auth.users where is_anonymous = true;
```

El borrado va en cascada a `profiles`, `user_settings`, `decisions`, `matches`
y `messages`. Los ocho de `seed.sql` **no** son anónimos y quedan intactos.

> Este `delete` sin más filtro solo es seguro mientras la única fuente de
> cuentas anónimas sea la suite de contrato. En cuanto la app tenga usuarios
> reales entrando por `signInAnonymously()` —que es la vía principal— borraría
> también sus cuentas. Acota entonces por antigüedad, p. ej.
> `and created_at < now() - interval '1 day'`, o mejor: no ejecutes esto contra
> un proyecto con usuarios reales.

**2. Admin API con `service_role`** (Project Settings → API). La clave da acceso
total saltándose RLS: úsala solo desde una terminal, nunca en el cliente ni en
un `.env` versionado.

```bash
# Listar y quedarte con los anónimos
curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=200" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  | jq -r '.users[] | select(.is_anonymous == true) | .id'

# Borrar uno
curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/<user-id>" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Si en una pasada saltara `Request rate limit reached`, el motivo no es esta
tabla sino el límite de GoTrue de 30 altas por hora e IP. Borrar las filas no lo
reinicia: hay que esperar.

## Estado

Las cinco primeras migraciones y `seed.sql` están **aplicados** contra
`grrzmzktrhksbttpbblg` (2026-09-06), pegados en el SQL Editor, más
`dev_reset_current_user()` del final de `seed.sql`.

La columna y el backfill de 20260907000100 están verificados por lectura
propia el 2026-09-07: nueve perfiles, ocho semillas con sus arrays esperados.

**20260907000200_discovery_mutual_complement.sql** ejecutada por el usuario
en el SQL Editor de grrzmzktrhksbttpbblg el 2026-09-07. Verificación posterior:
**35/35 casos pasados**, una suite, 53.912 s. Comando desde el worktree:

```powershell
$env:LOCKIN_SUPABASE_CONTRACT = '1'
npx jest src/data/supabase/contract.test.ts
Remove-Item Env:LOCKIN_SUPABASE_CONTRACT
```

Ahora son 35 casos (27 anteriores + 8 de ranking). El arnés reutiliza sus
cuatro usuarios de prueba y restablece los perfiles de apoyo entre casos;
requiere dev_reset_current_user(), como antes. La validación SQL embebida local
no sustituye esta pasada contra la API real y sus políticas.

Que sigan coincidiendo con `supabase/migrations/` ya no es un acto de fe:
`node supabase/drift-check.mjs` lo comprueba en un comando y con la clave `anon`
(última pasada, 2026-09-06: sin deriva). Lo que ese script no alcanza a ver
—políticas, CHECKs, índices, triggers, permisos, objetos de más— lo cubre
`supabase/schema-fingerprint.sql`, pendiente de una máquina con Docker. Ver
"Deriva de esquema".

El flujo completo (registro → perfil → deck → match → mensaje) está verificado
por dos caminos: la suite de contrato, 25/25 contra este proyecto el 2026-09-06
(`LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts`), y un
recorrido a mano en la app con `.env.local` puesto, confirmado como Supabase
real porque el estado sobrevivió a cerrar y reabrir la app — el mock es
memoria y no habría sobrevivido.

El 2026-09-07 la suite pasó de 25 a 27 casos por seekingSpecialties y después
a 35 por el ranking mutuo. Los 35 están verificados contra este proyecto.

`seed_incoming_likes('<email>')`, en `seed.sql`, reproduce `SEED_RECIPROCAL_IDS`
del mock para tu usuario, por si quieres que el deck te dé un match al primer
like.
