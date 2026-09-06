# `src/data/supabase` — el backend real

Implementación de `src/data/repositories.ts` contra Supabase. Misma forma que el
mock de `src/data/mock/`, así que ninguna pantalla cambia: `src/data/active.ts`
elige una u otra según haya credenciales en `.env.local`.

```
active.ts ─┬─ hay EXPO_PUBLIC_SUPABASE_URL + ANON_KEY → createSupabaseRepositories()
           └─ no las hay                              → createMockRepositories()
```

## Archivos

| Archivo             | Qué hace                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| `client.ts`         | Lee las variables `EXPO_PUBLIC_*` y construye el cliente una sola vez.          |
| `auth.ts`           | Consigue una sesión sin pantalla de login. Ver "La sesión" más abajo.           |
| `database.types.ts` | Las filas de `supabase/migrations/`, escritas a mano.                           |
| `mappers.ts`        | Traducción fila ↔ tipo de dominio. Lo único que sabe de nombres de columna.     |
| `index.ts`          | Los cinco repositorios y los avisos a las pantallas.                            |

## La sesión

El contrato no tiene login: `SessionRepository` solo habla de modo activo y
perfil propio, y las pantallas ya están construidas contra él. Como este bloque
no puede tocar pantallas, `auth.ts` abre sesión por su cuenta antes de la primera
consulta, en este orden:

1. Sesión guardada en `AsyncStorage`, si la hay.
2. `signInAnonymously()` — el camino bueno. Requiere **Anonymous sign-ins**
   activado (Authentication → Providers).
3. Cuenta de dispositivo con email y contraseña aleatorios. Requiere **Confirm
   email desactivado**, porque ese buzón no existe.

`linkEmailToCurrentUser()` convierte después la cuenta anónima en una con email
sin perder perfil, matches ni mensajes: el `auth.uid()` no cambia. `signInWithEmail`
y `signUpWithEmail` ya están exportados para cuando exista pantalla de login.

## Qué hace SQL y qué hace TypeScript

Lo que decide **quién ve qué** vive en la base, no aquí:

- `discovery_deck()` filtra el deck por modo y especialidad y excluye lo ya
  swipeado. Es `effectiveMode()` + `matchesMode()` del mock, en SQL.
- `record_decision()` es la única puerta que crea matches. Es `SECURITY DEFINER`
  porque es lo único que puede mirar el lado contrario de `decisions`: si el
  cliente pudiera consultar quién le ha dado like, el swipe no significaría nada.
- Las políticas RLS limitan matches y mensajes a los del usuario. Por eso
  `matches.list()` no lleva `where`: duplicar el filtro aquí daría una falsa
  sensación de que la regla vive en el cliente.

## Los tests del mock como especificación

`src/data/mock/index.test.ts` es el contrato ejecutable. Esta tabla dice qué
cumple cada bloque de tests y dónde:

| Test del mock                                        | Aquí lo cumple                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `getDeck` nunca incluye el perfil propio             | `discovery_deck`: `p.id <> auth.uid()`                                   |
| `getDeck` filtra por modo Par / Lock-In              | `discovery_deck`: `looking_for = 'ambos' or looking_for = v.mode`        |
| `getDeck` sin modo → catálogo entero                 | `p_mode = 'ambos'` desactiva el filtro                                   |
| `getDeck` usa el modo activo de la sesión            | `coalesce(p_mode, user_settings.active_mode, profiles.looking_for)`      |
| `getDeck` cae al modo del perfil                     | tercer término del mismo `coalesce`                                      |
| `getDeck` no repite lo ya decidido                   | `not exists (select … from decisions …)`                                 |
| `getDeck` respeta `excludeIds`                       | filtro en cliente, `discovery.getDeck`                                   |
| `getDeck` filtra por especialidad                    | `p.specialties && p_specialties` (índice GIN)                            |
| like recíproco crea el match                         | `record_decision`, rama `v_reciprocal`                                   |
| like sin reciprocidad no crea match                  | `record_decision` devuelve `null`                                        |
| `pass` nunca crea match                              | `if p_decision <> 'like' then return null`                               |
| perfil inexistente no revienta                       | la función lanza `23503` y `recordDecision` lo traduce a `match: null`   |
| el match nace en el modo concreto                    | `resolve_match_mode()`, espejo de `resolveMatchMode`                     |
| la decisión queda en `listDecided`                   | `insert … on conflict` en `decisions` + `discovery.listDecided`          |
| avisa a los suscriptores de matches, una sola vez    | `notify(MATCHES_TOPIC)` local + `emittedLocally` descarta el eco         |
| `matches` resuelve el perfil del otro lado           | `counterpartIdOf()` + `resolveMatches()`                                 |
| ordena por actividad reciente                        | `byRecentActivity()` sobre `last_message_at` (lo mueve un trigger)       |
| `getById` devuelve `null` para un id desconocido     | `.maybeSingle()`                                                         |
| el mensaje queda en el hilo y actualiza el match     | `insert` + trigger `messages_touch_match_after_insert`                   |
| un hilo no se cuela en otro                          | `.eq('match_id', matchId)` y la política `is_match_member`               |
| avisa solo a los suscriptores de ese hilo            | canal con `filter: match_id=eq.<id>` + topic `messages:<id>`             |
| deriva las iniciales si no hay avatar                | `initialsFrom()` en `mappers.ts`                                         |
| conserva `createdAt` y mueve `updatedAt`             | `default now()` + trigger `profiles_touch_updated_at`                    |
| no está onboarded hasta tener perfil y modo          | `session.isOnboarded()`                                                  |

### Lo que no se puede reproducir tal cual

Tres tests describen mecánica del mock, no comportamiento de producto, y por eso
no se pueden ejecutar contra Supabase sin adaptarlos:

- **`CURRENT_USER_ID`.** En el mock es la constante `'me'`; aquí es el
  `auth.uid()` del usuario, un UUID que no se conoce hasta abrir sesión.
- **`resetState()`.** No existe: el estado está en Postgres. El equivalente es
  `supabase db reset` con `supabase/seed.sql`.
- **`session.setProfileId()`.** En el mock escribe un dato; aquí `profileId` es
  derivado (hay perfil si existe la fila en `profiles`), así que es un no-op y
  `isOnboarded()` solo pasa a `true` cuando `saveCurrent` ha creado la fila.

Los ids `seed-*` tampoco existen: el catálogo equivalente está en
`supabase/seed.sql`, y `seed_incoming_likes()` reproduce `SEED_RECIPROCAL_IDS`.

## Estado

Las migraciones **sí están aplicadas** en `grrzmzktrhksbttpbblg`, y se ha
comprobado en vivo con la clave `anon` que las tablas y las funciones existen y
que `anon` no puede tocarlas (`42501 permission denied`). El código compila con
`tsc --noEmit`, pasa `expo lint` y no rompe los 154 tests actuales.

Lo que falta es el flujo completo (registro → perfil → deck → match → mensaje), y
está bloqueado por la configuración de Auth del proyecto, no por el código:
`anonymous_users` está desactivado y `mailer_autoconfirm` también, así que
ninguno de los dos caminos de `auth.ts` puede abrir sesión. Se arregla con un
interruptor del dashboard — ver `docs/plan/todo/datos.md`.
