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
- [x] Cotejo de esquema contra el proyecto real en Actions (`schema-drift.yml` + `SUPABASE_SCHEMA_DB_URL`) — 2026-09-13, [run 34757433478](https://github.com/thejowe/lockin/actions/runs/34757433478): remoto = migraciones + las dos funciones de desarrollo, nada más. Ver `todo/datos.md` → "Cotejo remoto ejecutado"
- [x] Retirar `dev_reset_current_user()` y `seed_incoming_likes()` del proyecto real — 2026-09-13, `dev-teardown.sql` ejecutado al alcanzarse el gatillo; [run 34760366206](https://github.com/thejowe/lockin/actions/runs/34760366206) con `remote.diff` → `Sin diferencias.` y verde también en el push siguiente ([run 34760751093](https://github.com/thejowe/lockin/actions/runs/34760751093)). **Desde aquí, un rojo del job remoto es deriva real.** Las cuentas y likes de seed siguen en la base: inventario aparte
- [x] Flujo real end-to-end **en la app** (registro → perfil → deck → match → mensaje) — recorrido a mano el 2026-09-06 contra **Supabase real**, no contra el mock. Ver "Al retomar" abajo para cómo se distinguió una cosa de la otra.

## Especialidades buscadas (post-MVP)
- [x] Contrato de dominio: `Profile.seekingSpecialties` / `ProfileInput.seekingSpecialties` — qué quiere el perfil que domine la otra persona. Decidido y escrito en el JSDoc: **vacío siempre cuando `lookingFor` es `lockin`**; vacío en `par`/`ambos` significa «abierto a cualquiera». Ver `todo/arquitecto.md`
- [x] Propagado por `src/data/mock/` (los 8 perfiles seed), `src/data/test-fixtures.ts` y `src/data/repositories.contract.ts`
- [x] Columna `seeking_specialties` en `supabase/migrations/` + mapeo real en `src/data/supabase/mappers.ts` — **hecho por `datos` el 2026-09-07**: migración nueva `20260907000100`, `ProfileRow`, los dos mapeos, los ocho perfiles de `supabase/seed.sql`, y `drift-check.mjs` enseñado a leer `alter table … add column` (solo parseaba `create table`, así que era ciego a esta columna). Ver `todo/datos.md`
- [x] **Migración pegada en el SQL Editor de `grrzmzktrhksbttpbblg`** — hecho el 2026-09-07. Comprobado consultando la columna con la clave `anon`: responde `42501` (RLS la protege) y ya no `42703` (no existe), que es la prueba de que la columna está. Escribir un perfil contra Supabase vuelve a funcionar. Instrucciones en `supabase/README.md` → "Estado"
- [x] Campo en el formulario de perfil y en la ficha — **hecho por `perfil` el 2026-09-07** (`3eea69e`): el bloque "Lo que debe dominar quien busco" aparece y desaparece con `seeksComplement(lookingFor)`, sus chips se anuncian como «Busco X» para no chocar con los de «Lo que domino», y `toInput` vacía el campo si al final se elige lock-in. `ProfileDetails` separa «Lo que domina» de «Lo que busca» y lee el vacío como «abierto a cualquier especialidad»
- [x] Uso en el deck — **hecho por `descubrir` el 2026-09-07**: la tarjeta separa «domina» de «busca» con los acentos de `ProfileDetails`, y resalta en latón sólido con "✓" lo que esa persona busca y tú ya dominas (más un `✓ Encajas` en la cabecera y una línea en el modal de match). **La lógica de matching no cambia: un match sigue siendo un like recíproco** — la complementariedad es señal para quien decide, no una puerta, y condicionarla rompería `repositories.contract.ts` y `record_decision()`. `ProfileFilter.specialties` sigue filtrando por lo que la otra persona **domina**; un filtro sobre lo buscado sería otro campo distinto, y rankear el deck por complementariedad tocaría `discovery.getDeck` — se lo pediría `descubrir` a `datos`. Ver `todo/descubrir.md`

## Fase 2 — Sesiones Lock-In
- [x] Sesión agendada + Pomodoro compartido + presencia + aviso local — plan `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`, detalle y evidencia en `todo/sesiones.md`. **Bloque cerrado el 2026-09-15**: las Tareas 1-10 y 3b ya lo estaban (CI, Schema drift y E2E Android en verde sobre 45f24f2; contrato opt-in en verde contra Supabase local en Actions — `contract.yml`, run 34897871055: 49 pasan, 0 fallan, 3 saltados a propósito por reloj simulado), y el Step 4 de la Tarea 11 lo confirmó el usuario en dos dispositivos reales con un APK de EAS contra Supabase real: flujo cruzado (alta desde el segundo móvil → su tarjeta en el deck del primero → match → agendado → chat), más la presencia "está aquí" y el aviso de 5 minutos. **Esas dos últimas se cierran con la palabra del usuario, no con un artefacto** — no hay E2E de presencia entre dos clientes ni de una notificación local con la app cerrada; ver el aviso al final de "Verificación manual" en `todo/sesiones.md` antes de fiarte de ellas
- [x] Valoración de 1 toque post-sesión — spec y plan escritos el 2026-09-15 (`docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`, `.../plans/2026-09-15-valoracion-post-sesion.md`), bloque 8 `valoracion` en `PLAN.md`, detalle y evidencia en `todo/valoracion.md`. Tres opciones de un toque sobre una sesión terminada a la que entraron los dos, ventana de 24 h, y **privada de quien la escribe** — sin nota pública ni media, que es la decisión que hay que releer antes de tocarla. Lee `session_attendance` con la semántica que fijó la spec de sesiones. Las 7 tareas del plan implementadas el 2026-09-15, con `CI` y `E2E Android` en verde sobre `387b80f` ([runs 34969393666](https://github.com/thejowe/lockin/actions/runs/34969393666) y [34969393663](https://github.com/thejowe/lockin/actions/runs/34969393663)): el toque en "Genial" se ejecutó en un emulador real y dejó su fila en Postgres. Fusionado en la rama principal (`1be154b`). Migración `20260915000100_session_ratings.sql` aplicada en `grrzmzktrhksbttpbblg`: `Schema drift` verde en local y remoto sobre `c4c7be8` ([run 34999911991](https://github.com/thejowe/lockin/actions/runs/34999911991), `remote.diff` = «Sin diferencias.»)
- [x] Rachas de pareja — spec y plan escritos el 2026-09-15 (`docs/superpowers/specs/2026-09-15-rachas-design.md`, `.../plans/2026-09-15-rachas.md`), bloque 9 `rachas` en `PLAN.md`, detalle y reparto `[Claude]`/`[Codex]` en `todo/rachas.md`. Decidido con el usuario: **de la pareja**, no de la persona; cuenta una sesión aceptada con las dos personas dentro; seguidas si entre una y otra hay **menos de 7 días** (ventana móvil, sin zona horaria); un plantón no suma ni rompe; se ve desde 2 en la tarjeta del chat y en la fila de Matches, nunca en perfil ni deck. Se calcula al leer (`match_streaks()`, sin tabla) y **no lee `session_ratings`**. Las 7 tareas del plan implementadas el 2026-09-15, con `CI` y `E2E Android` en verde en las dos variantes sobre `674c0c3` ([runs 35006640122](https://github.com/thejowe/lockin/actions/runs/35006640122) y [35006639859](https://github.com/thejowe/lockin/actions/runs/35006639859)): la variante `supabase` dejó `"streak": "verified"` en `postgres.json`. Migración `20260915000200_match_streaks.sql` aplicada por el usuario en `grrzmzktrhksbttpbblg` el mismo día: `Schema drift` en verde en local y remoto sobre `8ecb480` ([run 35010817724](https://github.com/thejowe/lockin/actions/runs/35010817724)). **Desde aquí, un rojo del job remoto es deriva real**
- [ ] Vídeo real en la sesión (spec propia)

## Calidad
- [x] ESLint/Prettier/TS estricto
- [x] Tests base (Jest + RNTL) — 509 tests en 50 suites (contado el 2026-09-14 sobre `9861cc0`), con suelo de cobertura en `jest.config.js` (89.82/82.56/91.49/91.38 %: sentencias/ramas/funciones/líneas). Más 52 opt-in de contrato contra Supabase (la suite 51, que `npm test` salta): fuera del CI de cada push, se ejecutan a mano contra una Supabase local desechable con `.github/workflows/contract.yml` (49 pasan y 3 se saltan a propósito por reloj simulado). Más 54 de E2E (`npm run test:e2e`), en 13 suites.
- [x] CI en GitHub Actions — lint, formato, tipos, tests y export web
- [x] E2E Android en CI — `.github/workflows/e2e.yml` corre `full-journey.yaml` en un emulador en cada push, en dos variantes: el APK con credenciales (pasa entero y el oráculo lee las filas en Postgres) y el control negativo sin ellas (falla **después** del `stopApp` y no escribe nada). Las dos en verde desde el 2026-09-09, [run 34409724164](https://github.com/thejowe/lockin/actions/runs/34409724164).
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

> **CORREGIDO el 2026-09-09.** La última frase ya no es cierta: hay E2E en CI y
> está en verde. `.github/workflows/e2e.yml` corre el recorrido completo en un
> emulador Android en cada push, en dos variantes sobre el mismo backend — la
> del APK con credenciales, que debe pasar entero y dejar las filas en Postgres,
> y el control negativo sin credenciales, que debe fallar **después** del
> reinicio y no escribir nada. Las dos cerraron a la vez por primera vez en el
> [run 34409724164](https://github.com/thejowe/lockin/actions/runs/34409724164).
> Ese pegamento pantalla ↔ repositorio ya tiene quien lo detecte. Detalle en
> `todo/calidad.md`, decimotercera pasada.

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
