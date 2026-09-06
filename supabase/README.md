# `supabase/` — esquema de datos de LockIn

Diseño del esquema que sostiene el contrato de repositorio de `arquitecto`
(`src/data/repositories.ts` + `src/data/types.ts`).

> **Estado: aplicado.** Las cinco migraciones están ejecutadas en el proyecto
> `grrzmzktrhksbttpbblg` (2026-09-06, pegadas en el SQL Editor), y el cliente de
> `src/data/supabase/` habla contra ellas. Comprobado en vivo con la clave
> `anon`: `profiles` y `discovery_deck()` existen y devuelven
> `42501 permission denied` sin sesión, que es justo lo que exige la migración
> de RLS. `supabase/seed.sql` todavía no se ha ejecutado.

## Migraciones

Se aplican en orden de nombre:

| Archivo | Qué hace |
|---|---|
| `20260905000100_enums_and_helpers.sql` | Enums espejo de las uniones de `types.ts` + helpers inmutables |
| `20260905000200_profiles_and_settings.sql` | `profiles` (1:1 con `auth.users`) y `user_settings` |
| `20260905000300_decisions_matches_messages.sql` | `decisions`, `matches`, `messages` y `is_match_member()` |
| `20260905000400_rls_policies.sql` | Row Level Security de las cinco tablas |
| `20260905000500_functions_and_realtime.sql` | `record_decision()`, `discovery_deck()`, trigger de `last_message_at`, realtime |

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
| `specialties` | `specialties` | `specialty[]`, 1-10, sin repetidos, índice GIN |
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
representarlo.

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

1. **SQL Editor del dashboard.** Pega los cinco archivos en orden de nombre.
   Es el camino sin credenciales extra, y el único disponible ahora mismo.
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

## Qué queda

- Ejecutar las migraciones: sigue sin hacerse. Es el único bloqueo real.
- Verificar el flujo completo (registro → perfil → deck → match → mensaje)
  contra la base ya migrada. `src/data/supabase/README.md` mapea cada test de
  `src/data/mock/index.test.ts` con la pieza que debe cumplirlo.
- `seed_incoming_likes('<email>')`, en `seed.sql`, reproduce
  `SEED_RECIPROCAL_IDS` del mock para tu usuario.
