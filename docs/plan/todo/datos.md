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
- [ ] `supabase/seed.sql` ejecutado (crea los ocho perfiles de desarrollo). Sin hacer.

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
- [ ] Flujo real contra Supabase (registro → perfil → deck → match → mensaje). **Bloqueado por la configuración de Auth del proyecto**, no por el código. Según `GET /auth/v1/settings`:
  - `external.anonymous_users: false` → `signInAnonymously()` devuelve `422 anonymous_provider_disabled`.
  - `mailer_autoconfirm: false` → la cuenta de dispositivo de respaldo se crea pero no recibe sesión, y encima mandaría correo a un buzón inexistente.
  - Con las dos cerradas, `auth.ts` no puede abrir sesión y la app falla en la primera consulta con el mensaje explícito que lanza `signInWithDeviceAccount`.
  - **Arreglo: un interruptor del dashboard.** Recomendado: activar Authentication → Providers → *Anonymous sign-ins* (después `linkEmailToCurrentUser()` convierte la cuenta en una con email sin perder datos). Alternativa: Authentication → Providers → Email → desactivar *Confirm email*.

## Delegado desde `calidad`
- [ ] Ejecutar `src/data/mock/index.test.ts` contra el repositorio de Supabase.
      Es la especificación del contrato y `src/data/supabase/README.md` ya la mapea
      test a test, pero hoy nadie la corre: `calidad` no puede, porque abrir sesión
      está bloqueado por la configuración de Auth del proyecto (ver arriba), y el
      mapeo es papel hasta que una ejecución lo confirme. Cuando *Anonymous
      sign-ins* esté activado, el trabajo es de este bloque: parametrizar esa suite
      por backend y saltarse los tres casos que describen mecánica del mock
      (`CURRENT_USER_ID`, `resetState`, `setProfileId`). Mientras tanto,
      `src/data/supabase/` está al 6 % de cobertura y arrastra el suelo global.
- [ ] `mappers.ts` está al 0 % y **no depende del bloqueo de Auth**: son funciones
      puras fila ↔ dominio. Se pueden probar hoy mismo, sin red ni sesión.

## Deuda anotada
- `initialsFrom()` está duplicada en `src/data/mock/store.ts` y `src/data/supabase/mappers.ts`. Es lógica de dominio compartida, pero subirla a `src/data/` es territorio de `arquitecto`. Si divergen, el avatar de un mismo perfil cambia al conectar Supabase.
- `MatchRepository.list()` resuelve el último mensaje de cada conversación con una ventana de los 200 mensajes más recientes (PostgREST no expone `distinct on`). El orden de la lista nunca se ve afectado — lo da `matches.last_message_at` —, solo la previsualización de un match muy antiguo.
