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

## El contrato, ejecutado

`src/data/mock/index.test.ts` era la especificación del contrato, pero solo se
ejecutaba contra el mock: esta sección era una tabla de correspondencias escrita
a mano, y "el backend de Supabase cumple el contrato" no lo comprobaba nadie.

Ya no. Los casos viven en `src/data/repositories.contract.ts`, parametrizados
por backend, y los ejecutan dos arneses:

| Arnés                                | Backend            | Cuándo corre                        |
| ------------------------------------ | ------------------ | ----------------------------------- |
| `src/data/mock/index.test.ts`        | mock en memoria    | siempre (`npm test`)                |
| `src/data/supabase/contract.test.ts` | Supabase real      | solo con `LOCKIN_SUPABASE_CONTRACT=1` |

    LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts

La cabecera de `contract.test.ts` explica por qué es opt-in (escribe en un
proyecto real, gasta altas anónimas, deja rastro) y qué necesita de la base.

### Lo que encontró la primera ejecución

Un bug de producción que el mock no podía ver. `record_decision()` devuelve
`public.matches`, que es un tipo COMPUESTO; cuando devuelve NULL, PostgREST no
manda `null` sino **una fila con todas las columnas a null**. `recordDecision`
comprobaba `if (!row)`, así que un `pass` —o un like sin reciprocidad— producía
un `Match` de mentira con `id: null` que la pantalla de match habría intentado
abrir. Arreglado mirando `row?.id`.

De propina, en `supabase/seed.sql`: los ocho usuarios de desarrollo se insertan
a mano en `auth.users` y les faltaban las columnas de token de GoTrue, que ese
servicio lee como `string` y no como puntero. Con una sola en NULL, cualquier
login con esos usuarios devuelve `500 Database error querying schema`.

### Lo que no se puede reproducir tal cual

Tres casos describían mecánica del mock, no comportamiento de producto. Se
quedaron fuera del contrato compartido y viven en el bloque `mecánica del mock`
de `src/data/mock/index.test.ts`:

- **`CURRENT_USER_ID`.** En el mock es la constante `'me'`; aquí es el
  `auth.uid()`, un UUID que no se conoce hasta abrir sesión. En el contrato es
  `fixture.currentUserId`, que cada arnés resuelve a su manera.
- **`resetState()`.** No existe: el estado está en Postgres y las políticas RLS
  no dan DELETE sobre `decisions`, `matches` ni `messages` a nadie. El
  equivalente es `dev_reset_current_user()`, una función SOLO de desarrollo que
  vive en `supabase/seed.sql` — nunca en `migrations/`.
- **`session.setProfileId()`.** En el mock escribe un dato; aquí `profileId` es
  derivado (hay perfil si existe la fila en `profiles`), así que es un no-op y
  `isOnboarded()` solo pasa a `true` cuando `saveCurrent` ha creado la fila. El
  contrato cierra el onboarding creando el perfil, que es lo portable.

Los ids `seed-*` tampoco existen aquí: el catálogo equivalente está en
`supabase/seed.sql`. Los likes entrantes tampoco se siembran — en Supabase
alguien tiene que darlos de verdad, y eso es lo que hace `prepareSwiper()` del
fixture.

## Estado

Las migraciones están aplicadas en `grrzmzktrhksbttpbblg` y `supabase/seed.sql`
ejecutado: con sesión, `/rest/v1/profiles` devuelve los ocho perfiles; sin
sesión, `42501 permission denied`. *Anonymous sign-ins* está activado, así que
`signInAnonymously()` —el camino bueno de `auth.ts`— funciona y la cuenta de
dispositivo queda como respaldo que no se usa.

El código compila con `tsc --noEmit`, pasa `expo lint` y la suite de contrato
corre contra Supabase de verdad. Lo que falta está anotado en
`docs/plan/todo/datos.md`.
