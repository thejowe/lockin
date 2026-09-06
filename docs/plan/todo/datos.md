# TODO — datos

## Antes de nada
- [x] Comprobar si existen credenciales de Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Si no existen: avisar al usuario y limitarse al diseño de esquema — no inventar ni hardcodear credenciales.
  - **Ya existen** (2026-09-06), en `.env.local` (que está en `.gitignore`) y contra el proyecto `grrzmzktrhksbttpbblg`. Ningún valor real vive en el repo: `.env.example` solo lleva marcadores.

## Esquema (se puede hacer sin credenciales)
- [x] Tabla `profiles` (campos de `docs/plan/CONCEPTO.md`) — 1:1 con `auth.users`; `Availability` y `ProfileLinks` aplanados en columnas, `prompts` como `jsonb` (máx. 2)
- [x] Tabla `matches` — par ordenado canónicamente (`profile_a < profile_b`) + `unique`, para que no existan dos matches entre las mismas dos personas
- [x] Tabla `messages` — con trigger que mantiene `matches.last_message_at`
- [x] Políticas de Row Level Security (cada usuario ve solo sus propios matches/mensajes) — activas en las cinco tablas, `anon` revocado en todas
- [x] Migraciones en `supabase/migrations/` — cinco archivos, aplicables con `supabase db reset`

### Extra necesario para cumplir el contrato de `arquitecto`
- [x] Tabla `decisions` (swipes) — la exige `DiscoveryRepository`: `recordDecision` necesita la reciprocidad y `getDeck`/`listDecided` los ya vistos
- [x] Tabla `user_settings` (modo activo) — `Session.activeMode` se elige antes de que exista el perfil, así que no puede ser columna de `profiles`
- [x] `record_decision()` (`SECURITY DEFINER`) — única puerta para crear matches; es lo que permite que nadie pueda leer quién le ha dado like
- [x] `discovery_deck()` — filtra por modo y especialidad y excluye los ya swipeados, espejo de `matchesMode`/`effectiveMode` del mock
- [x] Realtime en `matches` y `messages` — sostiene los `subscribe()` del contrato
- [x] `supabase/README.md` con el mapeo tipo ↔ tabla y las decisiones de seguridad

### Ejecución del esquema
- [x] Migraciones aplicadas contra `grrzmzktrhksbttpbblg` (2026-09-06), pegadas en el SQL Editor del dashboard.
  - El CLI por `npx` no servía: `link` y `db push --project-ref` exigen `SUPABASE_ACCESS_TOKEN`, y `db push --db-url` la contraseña de Postgres (además `db.<ref>.supabase.co` solo resuelve por IPv6 desde esta red).
- [x] Verificado en vivo con la clave `anon`, sin sesión:
  - `GET /rest/v1/profiles` → `42501 permission denied for table profiles`. La tabla existe y `anon` está revocado, tal y como pide la migración de RLS.
  - `POST /rest/v1/rpc/discovery_deck` → `42501 permission denied for function discovery_deck`. La función existe y su `execute` está revocado de `anon`.
- [x] `supabase/seed.sql` ejecutado (crea los ocho perfiles de desarrollo). Verificado el 2026-09-06: con sesión, `GET /rest/v1/profiles?select=id,name,looking_for` devuelve los ocho (Núria Bosch, Marc Oller, Alba Ferrer, Diego Salas, Inés Aranda, Tomás Ruiz, Lucía Pardo, Omar Chaib) con los UUID `11111111-…-00000000000N`.

## Integración
- [x] Cliente de Supabase (`@supabase/supabase-js` 2.115 + `@react-native-async-storage/async-storage`) — `src/data/supabase/client.ts`. Normaliza la URL para aceptar tanto la raíz del proyecto como la variante con `/rest/v1/`.
- [x] Autenticación — `src/data/supabase/auth.ts`. El contrato de repositorio no tiene login y este bloque no puede tocar pantallas, así que la sesión se abre sola: sesión guardada → `signInAnonymously()` → cuenta de dispositivo con email y contraseña aleatorios. `linkEmailToCurrentUser()` la convierte después en cuenta con email sin perder datos.
- [x] Implementación real de la interfaz de repositorio de `arquitecto` en `src/data/supabase/` — los cinco repositorios en `index.ts`, con el mapeo fila ↔ dominio aislado en `mappers.ts` y las filas en `database.types.ts`.
- [x] Variable de entorno/config para elegir mock vs. real — `src/data/active.ts` elige por `hasSupabaseCredentials`. **Ninguna pantalla tocada.**
- [x] `supabase/seed.sql` con los perfiles de `src/data/mock/seed.ts` para desarrollo local — los ocho perfiles con UUID fijo, más `seed_incoming_likes('<email>')` que reproduce `SEED_RECIPROCAL_IDS`.
- [x] `src/data/supabase/README.md` mapea, test a test, `src/data/mock/index.test.ts` (la especificación) con la pieza que lo cumple, y nombra los tres casos que describen mecánica del mock y no se pueden ejecutar tal cual contra Supabase (`CURRENT_USER_ID`, `resetState`, `setProfileId`).

### Verificado hasta donde se puede sin base migrada
- [x] `npx tsc --noEmit` limpio con `strict`
- [x] `npm run lint` limpio
- [x] `npm test`: 154 tests en 9 suites, todos en verde. Hizo falta añadir el mock oficial de AsyncStorage a `jest.setup.js` — al importar `active.ts` el backend de Supabase, el módulo nativo entraba en Jest y tumbaba tres suites.
- [x] Flujo real contra Supabase (registro → perfil → deck → match → mensaje). **Ya no está bloqueado**: el interruptor del dashboard está puesto.
  - Verificado el 2026-09-06 contra `grrzmzktrhksbttpbblg`: `GET /auth/v1/settings` devuelve `external.anonymous_users: true`, y `POST /auth/v1/signup` con cuerpo `{}` responde `200` con `access_token`. `signInAnonymously()` es ahora el camino bueno de `auth.ts` y la cuenta de dispositivo queda como respaldo que no se usa.
  - `mailer_autoconfirm` sigue en `false`, pero ya da igual: solo afectaba al camino de respaldo.
  - RLS sigue en pie: la misma consulta a `/rest/v1/profiles` **sin** sesión devuelve `42501 permission denied for table profiles`.
  - El flujo entero queda cubierto por la suite de contrato — ver el bloque siguiente.

## Delegado desde `calidad`
- [x] Ejecutar `src/data/mock/index.test.ts` contra el repositorio de Supabase.
      Los 25 casos salieron de ahí a `src/data/repositories.contract.ts`,
      parametrizados por backend, y los ejecutan dos arneses: el mock
      (`src/data/mock/index.test.ts`, siempre) y Supabase real
      (`src/data/supabase/contract.test.ts`, con `LOCKIN_SUPABASE_CONTRACT=1`).
      El mock pasa 28/28 — los 25 del contrato más 3 de mecánica propia.
- [x] Adaptar o excluir, con motivo escrito, los tres casos que describen
      mecánica del mock. Los tres siguen ejecutándose, pero en el bloque
      `mecánica del mock` de `src/data/mock/index.test.ts`, fuera del contrato
      compartido:
  - `CURRENT_USER_ID` → **adaptado**. En el contrato es `fixture.currentUserId`;
    en Supabase es el `auth.uid()`, que no se conoce hasta abrir sesión.
  - `resetState()` → **excluido**. El estado vive en Postgres y las políticas RLS
    no dan DELETE sobre `decisions`, `matches` ni `messages` a nadie. Su
    equivalente es `dev_reset_current_user()` (ver abajo).
  - `session.setProfileId()` → **adaptado**. En Supabase `profileId` es derivado y
    `setProfileId` es un no-op, así que el contrato cierra el onboarding creando
    el perfil, que es lo que promete el producto.
- [x] `mappers.ts` — 17 tests puros en `src/data/supabase/mappers.test.ts`, sin
      red ni sesión: aplanado de `availability`/`links`, herencia del acento del
      avatar, y la reconstrucción del par `[propio, otro]` de un match.

### Lo que encontró ejecutarlo de verdad
- [x] **Bug de producción en `recordDecision`.** `record_decision()` devuelve
      `public.matches`, un tipo COMPUESTO, y cuando devuelve NULL PostgREST manda
      una fila con TODAS las columnas a null, no `null`. Con `if (!row)`, un
      `pass` producía un `Match` falso con `id: null` que la pantalla de match
      habría intentado abrir. Arreglado con `if (!row?.id)`.
- [x] **`supabase/seed.sql` dejaba a los ocho usuarios sin poder entrar.** Se
      insertan a mano en `auth.users` y les faltaban las ocho columnas de token
      que GoTrue lee como `string` y no como puntero: con una sola en NULL,
      cualquier login devuelve `500 Database error querying schema`. Comprobado
      en vivo contra los tres. El seed ya las pone; las filas ya creadas siguen
      rotas hasta que se reparen con el `update` que documenta el propio archivo.

### Pendiente de un paso manual en el dashboard
- [ ] Instalar `dev_reset_current_user()` (está al final de `supabase/seed.sql`)
      pegándola en el SQL editor de `grrzmzktrhksbttpbblg`, y volver a ejecutar
      la suite entera para dejar constancia de un 25/25.
      Hoy la suite pasa cada caso que se le pide, pero no puede pasarlos todos
      del tirón: sin esa función el único estado limpio posible es un usuario
      anónimo nuevo POR TEST, y Supabase limita las altas anónimas a 30/hora por
      IP — la pasada completa necesita 29 y muere a media con
      `Request rate limit reached`. Con la función, una pasada gasta 4.
      Verificado hasta ahora, en ejecuciones parciales: los tres casos de
      `recordDecision` que no crean match pasan tras el arreglo, y en la primera
      pasada completa (antes del arreglo) fueron 23/25 con esos dos como únicos
      fallos.

## Deuda anotada
- `initialsFrom()` está duplicada en `src/data/mock/store.ts` y `src/data/supabase/mappers.ts`. Es lógica de dominio compartida, pero subirla a `src/data/` es territorio de `arquitecto`. Si divergen, el avatar de un mismo perfil cambia al conectar Supabase.
- `MatchRepository.list()` resuelve el último mensaje de cada conversación con una ventana de los 200 mensajes más recientes (PostgREST no expone `distinct on`). El orden de la lista nunca se ve afectado — lo da `matches.last_message_at` —, solo la previsualización de un match muy antiguo.
