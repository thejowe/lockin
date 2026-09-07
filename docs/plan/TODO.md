# TODO maestro — LockIn MVP

Solo hitos de alto nivel. El detalle accionable vive en `docs/plan/todo/<bloque>.md` — márcalo ahí, no aquí.

## Arquitectura
- [x] Scaffold inicial de Expo + TypeScript + Expo Router
- [x] Sistema de diseño con la paleta de marca
- [x] Shell de navegación (tabs + onboarding)
- [x] Capa de datos abstracta (interfaz + implementación mock)

## Onboarding y perfil
- [x] Selección de modo (Par / Lock-In)
- [x] Formulario de creación de perfil
- [x] Pantalla de perfil propio
- [x] Perfiles de ejemplo (seed)

## Descubrir (swipe y matching)
- [x] Deck de tarjetas con gesto
- [x] Lógica de match mock
- [x] Pantalla de match

## Chat
- [x] Lista de matches
- [x] Chat 1:1 mock
- [x] Icebreakers sugeridos
- [x] Hueco visible para "agendar sesión Lock-In"

## Datos y Supabase
- [x] Esquema SQL (perfiles, matches, mensajes) — escrito **y aplicado** contra el proyecto real por el SQL Editor del dashboard
- [x] Integración de auth — `src/data/supabase/auth.ts`, sesión automática sin tocar pantallas
- [x] Sustituir mock por Supabase real — `src/data/supabase/`; `active.ts` elige por presencia de credenciales
- [x] Ejecutar `supabase/seed.sql` — los ocho perfiles están en el proyecto (verificado: con sesión devuelve las 8 filas, sin sesión da `42501`, o sea RLS funcionando)
- [x] Configuración de Auth — `anonymous_users: true`; `POST /auth/v1/signup` devuelve `200` con `access_token`
- [x] Contrato de `Repositories` ejecutable contra Supabase real — `src/data/supabase/contract.test.ts`, opt-in con `LOCKIN_SUPABASE_CONTRACT=1`
- [x] **Instalar `dev_reset_current_user()`** y dejar constancia de un 25/25 en la suite de contrato — hecho el 2026-09-06, ver "Al retomar" abajo
- [x] Flujo real end-to-end **en la app** (registro → perfil → deck → match → mensaje) — recorrido a mano el 2026-09-06 contra **Supabase real**, no contra el mock. Ver "Al retomar" abajo para cómo se distinguió una cosa de la otra.

## Especialidades buscadas (post-MVP)
- [x] Contrato de dominio: `Profile.seekingSpecialties` / `ProfileInput.seekingSpecialties` — qué quiere el perfil que domine la otra persona. Decidido y escrito en el JSDoc: **vacío siempre cuando `lookingFor` es `lockin`**; vacío en `par`/`ambos` significa «abierto a cualquiera». Ver `todo/arquitecto.md`
- [x] Propagado por `src/data/mock/` (los 8 perfiles seed), `src/data/test-fixtures.ts` y `src/data/repositories.contract.ts`
- [ ] Columna `seeking_specialties` en `supabase/migrations/` + mapeo real en `src/data/supabase/mappers.ts` — **de `datos`**. Hoy el mapper devuelve `[]` y el insert descarta el campo, así que contra Supabase el dato se pierde. El caso «guarda seekingSpecialties tal y como se envía» del contrato lo deja en rojo a propósito hasta que exista la columna
- [ ] Campo en el formulario de perfil y en la ficha — **de `perfil`**. `ProfileInput` lo declara opcional justo para que el formulario actual siga compilando mientras tanto
- [ ] Uso en el deck / matching — **de `descubrir`**. `ProfileFilter.specialties` sigue filtrando por lo que la otra persona **domina**; un filtro sobre lo buscado sería otro campo distinto

## Calidad
- [x] ESLint/Prettier/TS estricto
- [x] Tests base (Jest + RNTL) — 222 tests en 14 suites, con suelo de cobertura en `jest.config.js` (69.29/57.57/68.09/69.47 %: sentencias/ramas/funciones/líneas). Más 25 opt-in de contrato contra Supabase, fuera de `npm test` y de CI.
- [x] CI en GitHub Actions — lint, formato, tipos, tests y export web
- [x] Accesibilidad básica — labels, tamaño táctil y test de contraste. Los 4 pares que estaban por debajo de AA se cerraron el 2026-09-06: `KNOWN_GAPS` en `theme.test.ts` está vacío (ver `todo/arquitecto.md`)

---

## Al retomar (estado del 2026-09-06)

Los seis bloques están entregados y fusionados en
`claude/startup-cofounder-matching-app-tfeai1`. `npm test` pasa: **222 tests en
14 suites**, `tsc --noEmit` limpio con `strict`, lint limpio, y la suite de
contrato contra Supabase real da **25/25**. El hueco de verificación que quedaba
—recorrer la app entera a mano— está cerrado (punto 2).

### 1. La suite de contrato pasa 25/25 — cerrado el 2026-09-06

    LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts
    → Tests: 25 passed, 25 total  (31.9 s)

Hizo falta desenredar dos causas encadenadas, y ninguna era un bug del código de
producto:

1. **Faltaba `dev_reset_current_user()` en el proyecto.** Se añadió a
   `supabase/seed.sql` en el mismo lote que la suite, y el seed que se había
   ejecutado era el anterior. Sin ella el único estado limpio posible es un
   usuario nuevo por test — las políticas RLS no dan `DELETE` sobre `decisions`,
   `matches` ni `messages` a nadie, con razón: un swipe no se deshace — y eso
   agota el límite de 30 altas anónimas por hora e IP. Resuelto pegándola en el
   SQL Editor. Con ella, una pasada gasta cuatro altas en total.
2. **La suite envenenaba el catálogo.** Su `teardown()` no borraba los cuatro
   perfiles que creaba cada pasada: 68 residuos sobre los 8 de `seed.sql`. Como
   `discovery_deck` pagina a `p_limit default 50`, el deck sin filtrar y el
   filtrado por modo salían ambos llenos y «sin modo concreto devuelve el
   catálogo entero» fallaba con un `Expected: > 50 / Received: 50` mudo.
   Arreglado en `contract.test.ts`: el `teardown()` llama a
   `dev_reset_current_user()` con los cuatro clientes, y una guardia en
   `beforeAll` cuenta los perfiles y, si no caben en una página, falla diciendo
   qué SQL ejecutar. Los residuos ya acumulados se limpiaron a mano con
   `delete from auth.users where is_anonymous = true;`.

Lección de proceso: el punto 2 estuvo un rato marcado como hecho en
`todo/datos.md` sin estarlo, y lo destapó la guardia en la pasada siguiente, no
nadie releyendo el TODO. Marcar una casilla no es haber verificado.

### 2. El flujo real en la app — recorrido el 2026-09-06, contra Supabase real

El usuario levantó Expo con `.env.local` puesto y recorrió registro → perfil →
deck → match → mensaje. Todo correcto. Era el hueco de verificación más grande
que quedaba: los 222 tests corren contra el mock, y los de contrato hablan con
la base sin pasar por la interfaz.

**Cómo se comprobó que fue Supabase y no el mock.** `src/data/active.ts` elige
por presencia de credenciales, así que un recorrido contra el mock no habría
demostrado nada. Y el deck **no** sirve de señal: `supabase/seed.sql` es el
catálogo de `src/data/mock/seed.ts` traducido a filas, así que los mismos ocho
nombres (Núria Bosch … Omar Chaib) salen con los dos backends. Lo que sí
distingue es la persistencia: el mock es estado en memoria
(`src/data/mock/store.ts`, "el MVP no promete persistencia"). El usuario cerró
la app entera y al reabrirla seguían su perfil, sus swipes y sus mensajes — eso
solo puede venir de Postgres.

Lo que **no** cubre este recorrido, por si alguien lo da por más de lo que es:
fue una pasada manual en un dispositivo, no una prueba automatizada. No hay
E2E en CI, así que una regresión en el pegamento pantalla ↔ repositorio seguiría
sin tener quien la detecte.

### Trampa de GoTrue, por si reaparece

Insertar en `auth.users` a mano tiene una trampa cara de diagnosticar: GoTrue
mapea sus ocho columnas de token a `string` de Go, no a puntero, así que **una
sola en `NULL` hace que todo login con ese usuario devuelva `500 Database error
querying schema`**. El seed ya las rellena a cadena vacía, y lleva anotado el
`UPDATE` de reparación para bases sembradas antes de ese arreglo.

### Deuda menor

- [x] Limpieza de dependencias directas, ignore de Supabase y subida del suelo de cobertura cerrados. Detalle y verificaciones en `todo/calidad.md`, cuarta pasada. `expo-symbols` sigue transitivamente por `expo-router`.
- [x] `mailer_autoconfirm`: **decisión tomada, se queda en `false`** — y ya no
  es deuda. Autoconfirmar da por buena una dirección sin comprobar que quien se
  registra la controla, o sea, permite registrarse con el email de otra
  persona. No estorba porque la vía principal es la sesión anónima y el camino
  por email es solo el respaldo de `auth.ts`. Escrito, con el porqué, en
  `supabase/README.md` → "Configuración de Auth en el dashboard".
- [x] Las cuatro filas de `auth.users` que deja cada pasada de la suite de
  contrato: **procedimiento de limpieza documentado** en `supabase/README.md` →
  "Mantenimiento: borrar los usuarios anónimos de pruebas" (SQL Editor o Admin
  API con `service_role`, con el aviso de que el `delete` sin filtro deja de ser
  seguro en cuanto haya usuarios reales entrando por `signInAnonymously()`).
  Sus perfiles ya los borra el `teardown()`, así que no saturan la paginación
  del deck; queda solo la fila de la cuenta.
