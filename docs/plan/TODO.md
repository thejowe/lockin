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
- [x] Vídeo real en la sesión — spec y plan escritos el 2026-09-16 (`docs/superpowers/specs/2026-09-16-video-real-sesion-design.md`, `.../plans/2026-09-16-video-real-sesion.md`), bloque 10 `video` en `PLAN.md`, detalle y evidencia en `todo/video.md`. Señalización de SDP/ICE por Supabase Realtime Broadcast (mismo patrón que la presencia de `sesiones`: un canal por sesión, sin tabla ni migración); `useVideoCall` levanta un `RTCPeerConnection` (`react-native-webrtc`) con solo STUN público, el `profileId` menor en orden lexicográfico ofrece sin coordinación extra, y un timeout de 30 s da la llamada por fallida si la otra parte nunca conecta. `VideoCallView` (dos `RTCView` + mic/cámara/colgar) se monta en `[sessionId].tsx` activo solo mientras `canJoin && !ended`, sin tocar la lógica de fases/asistencia/valoración que ya tenía esa pantalla. Las 7 tareas del plan implementadas el 2026-09-16 sobre `9829e15`…`c82a3e4` (detalle commit a commit en `todo/video.md`), verificadas contra mocks. **Esa verificación fue local, y en Actions no estaba verde**: CI llevaba rojo desde `db763db` porque `npm ci` fallaba con `Missing: @emnapi/core@1.10.0 from lock file`, así que ninguno de los siete trabajos llegó a ejecutarse sobre este bloque. Lo arregló `calidad` el 2026-09-16 (lock regenerado en `977e67d`; y 8 archivos de este bloque que nunca habían pasado por Prettier, que el fallo de instalación tapaba, formateados en `77f9b61`): primer verde real en [run 35116428974](https://github.com/thejowe/lockin/actions/runs/35116428974), detalle en `todo/calidad.md`. Lo que sí se comprobó en local: `npm test` completo en verde (60/61 suites, 1 skip preexistente, 642 tests) con la cobertura por encima del suelo de `jest.config.js` (92.57/85.26/91.59/94.45 % sobre el mínimo 89.82/82.56/91.49/91.38 %), `npx tsc --noEmit` y `npm run lint` limpios, y `npx expo export --platform web` en verde — el módulo nativo nunca se importa en el bundle web gracias a `use-video-call.web.ts`/`video-call-view.web.tsx` (hallazgo real de la Tarea 5: sin ellos, `export web` ya estaba roto desde la Tarea 4). **Sin verificar y fuera del alcance de un agente**, mismo precedente que la Tarea 11 de `sesiones`: un `eas build --profile development` que confirme que el plugin nativo de `react-native-webrtc` compila de verdad, y la llamada real entre dos móviles físicos (cámara y audio en los dos sentidos). Hasta que el usuario corra esas dos cosas, todo lo de este bloque está probado solo contra mocks — no marcado como hecho, sino pendiente en `todo/video.md` → "Pendiente del usuario"

## Fase 3 — Verificación de autoría de enlaces
- [x] Sello de GitHub verificado — spec y plan escritos el 2026-09-16 (`docs/superpowers/specs/2026-09-16-verificacion-github-design.md`, `.../plans/2026-09-16-verificacion-github.md`), bloque 11 `verificacion` en `PLAN.md`, detalle y evidencia en `todo/verificacion.md`. Fase 3 son **tres sub-proyectos** («salas grupales, verificación, plantillas de acuerdo») y este es el primero; los otros dos no están empezados. El usuario linka una identidad OAuth de GitHub a la cuenta de Supabase que ya tiene (`linkIdentity()` sobre la sesión anónima) y **el cliente nunca declara su propia verificación**: el sello lo escribe `sync_github_verification()`, una función `SECURITY DEFINER` sin parámetros que lee `auth.identities`, sobre dos columnas que el rol `authenticated` no puede escribir (permiso **de columna**, que RLS es de fila y no sabe expresar). Al verificar, `link_github` pasa a derivarse de la identidad y el campo se bloquea en el formulario — eso elimina la clase entera de «verifico como `alice` y enseño `torvalds`». **Es señal, no puerta**: no filtra el deck, no lo ordena y no condiciona el match, mismo precedente que la complementariedad; y **no hay marca de "sin verificar"**, que sería filtrar por profesión por la puerta del copy. Solo GitHub: LinkedIn no se puede verificar con OIDC (el `vanityName` no sale del estándar) y el portfolio necesitaría backend propio, que este repo no tiene. Las 8 tareas del plan implementadas el 2026-09-16 (`360d693`…`427f3ad`), con `npx tsc --noEmit` y `npm run lint` limpios, `npx jest --coverage` en verde (63 suites, 698 tests, cobertura 93.44/86.61/92.65/95.31 sobre el suelo 89.82/82.56/91.49/91.38), `npm run test:schema` 20/20 y `npx expo export --platform web` en verde. Verificado en Actions sobre el commit de cierre `5170f64`: `CI` verde entera ([run 35211856053](https://github.com/thejowe/lockin/actions/runs/35211856053)) — **incluido el job «Formato»**, que es el único veredicto válido para Prettier porque en la máquina del usuario `format:check` da ~100 falsos por CRLF. `E2E Android` ([run 35214150045](https://github.com/thejowe/lockin/actions/runs/35214150045)): variante `mock` verde, variante `supabase` **roja por un fallo anterior a este bloque** — revienta en la primera aserción del recorrido, con la app enseñando «No hemos podido recuperar tu perfil» (la pantalla de error de arranque de `d76ba71`) en lugar del onboarding; el mismo fallo sale sobre `1987a9c`, el commit anterior a la Tarea 5. Diagnóstico y sospecha (límite de 30 altas anónimas por hora e IP) en `todo/verificacion.md`. **Migración `20260916000100_github_verification.sql` aplicada por el usuario en `grrzmzktrhksbttpbblg` el 2026-09-17**: `Schema drift` verde en local y remoto ([run 35211856006](https://github.com/thejowe/lockin/actions/runs/35211856006), `remote.diff` = «Sin diferencias.», con las dos columnas, las dos `constraint`, la función y los permisos de columna en la huella remota). Durante unas horas ese job estuvo rojo a propósito —era esta migración esperando, no deriva—; ya no, así que **vuelve a valer que un rojo del job remoto es deriva real**. **Sin verificar y fuera del alcance de un agente**: la GitHub OAuth App y «Enable Manual Linking» en el dashboard, y probar el flujo en un dispositivo con el dev client de EAS (el OAuth necesita un navegador de verdad y un deep link de vuelta). Ver `todo/verificacion.md` → "Pendiente del usuario"

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

## Recuperación del perfil al reabrir (2026-09-16)

- [x] Corregidos errores de arranque que enviaban al onboarding o abrían otra cuenta cuando fallaba la recuperación. Detalle y pruebas en `todo/arquitecto.md`.
- [ ] Confirmar cierre y reapertura en el Expo Go del usuario.

## Saneamiento de arquitectura (auditoría del 2026-09-17)

Siete problemas de arquitectura detectados en la auditoría del 2026-09-17, todos
verificados contra el código el mismo día. Las órdenes autocontenidas (alcance de
archivos, criterio de terminado y olas) están en
[`docs/plan/ordenes-arquitectura.md`](ordenes-arquitectura.md) — **ese archivo es
el detalle; estas casillas son solo el estado**. El detalle accionable por bloque
vive, como siempre, en `todo/<bloque>.md`.

Las olas van en orden y ninguna orden de la misma ola toca los archivos de otra:
**Ola 1** = A1 + D1 · **Ola 2** = D2 + C1 · **Ola 3** = P1 + D3 + A2 (`D3` no
puede correr a la vez que `D2`). Por eso solo la Ola 1 lleva etiqueta de
herramienta: las demás están bloqueadas por la ola anterior, no sin decidir.

**Las siete van a Claude Code**, decidido con el usuario el 2026-09-17. `D1` y
`C1` estaban anotadas como `[Codex]` por tener alcance cerrado y criterio
objetivo, que es el criterio de reparto de `PLAN.md`, y se reetiquetaron a
`[Claude]` por decisión del usuario, no porque el criterio haya cambiado. La
maquinaria de reparto entre herramientas de `PLAN.md` sigue en pie para lo que
venga después.

- [x] **[Claude]** Hallazgo 3 + 5 — `useQuery` sin caché y cambio silencioso de backend (orden `A1`, `arquitecto`, Ola 1). **Hecho el 2026-09-17.** `useQuery` retiene el último valor resuelto mientras relee (`loading` = primera carga, `refreshing` = relectura por encima de un dato) y comparte el `nonce` y la petición en vuelo por `key`, así que dos lectores de `profile:current` son una sola lectura. Las dos copias de `useResolvedOrPrevious` están borradas y sus cinco consumidores leen `query.data` directamente. `src/data/active.ts` exporta `backend` y, fuera de desarrollo, lanza nombrando las credenciales que falten en vez de caer al mock. Detalles y los cuatro matices que no hay que deshacer, en `docs/plan/todo/arquitecto.md`. Queda para `C1`: el suelo de cobertura de `jest.config.js` está ~4 puntos por debajo de lo que mide la suite
- [x] **[Claude]** Hallazgo 2 — canales de vídeo y presencia sin autenticar (orden `D1`, `datos`, Ola 1). **Hecho el 2026-09-17.** `supabase/migrations/20260917000100_realtime_authorization.sql` trae las políticas de Realtime Authorization sobre `realtime.messages` (`is_session_topic_member()`, delegando en `is_match_member()`) y `video-signal.ts`/`presence.ts` pasan a `config: { private: true }`, así que el servidor las evalúa. `npm run test:schema` cubre la política contra Postgres de verdad (Ana y Bea entran, Carla y un topic ajeno reciben `42501`) y la huella ve las dos políticas nuevas. **Migración aplicada por el usuario en `grrzmzktrhksbttpbblg` el 2026-09-18**: `Schema drift` verde en local y remoto ([run 35361939148](https://github.com/thejowe/lockin/actions/runs/35361939148)). Detalle en `docs/plan/todo/datos.md`
- [x] **[Claude]** Hallazgo 1 (capa de datos) — identidad real y recuperación de cuenta (orden `D2`, `datos`, Ola 2). **Hecho el 2026-09-17.** `src/data/supabase/auth.ts` expone el ciclo de vida completo de la cuenta: `getAccountState()` devuelve `kind` (`none`/`anonymous`/`device`/`pending-email`/`email`) y un `recoverable` que solo es `true` con el email **confirmado**; el ascenso son dos pasos (`linkEmailToCurrentUser(email)` pide la confirmación, `setAccountPassword(password)` la cierra) porque GoTrue no acepta contraseña en una cuenta anónima sin email verificado; `sendPasswordReset` y `completeAuthLink` cubren la recuperación por `lockin://auth/callback`; y `signOut()` **lanza** desde una cuenta irrecuperable salvo `acceptDataLoss: true`. Los errores llegan traducidos en `AccountError.reason`, no como texto inglés del servidor. Las cuatro decisiones de producto que tomó el usuario, lo que falta tocar en el dashboard y lo que le queda a `P1`, en `docs/plan/todo/datos.md`
- [x] Hallazgo 4 — dos implementaciones del dominio y el contrato de Supabase no corre nunca en CI (orden `C1`, `calidad`, Ola 2; bloqueada por la Ola 1). **Hecho el 2026-09-17.** `contract.yml` gana `workflow_call` y `ci.yml` lo llama en cada push a la rama principal, así que su rojo es el rojo de CI en vez de una pestaña aparte que nadie mira. Guarda `grep` de la misma clase que la del job «SQL embebido», sobre la línea de cierre que la propia suite de Jest imprime. `jest.config.js` puesto al día con los números reales de cobertura, sin bajar el suelo. Detalle en `docs/plan/todo/calidad.md`
- [x] Hallazgo 6 — consultas sin paginar y reloj del dispositivo (orden `D3`, `datos`, Ola 3). **Hecho el 2026-09-18.** `matches.list()` conserva su firma (la consumen `chat` y `sesiones`) pero pagina por dentro con `range()` en vueltas de 500, así que ya no depende del tope de fila por defecto de PostgREST. `last_messages_for_matches()` y `active_session()`, dos RPC nuevos: el primero resuelve el último mensaje de cada match con `distinct on` en SQL en vez de agrupar una ventana de 200 mensajes en el cliente; el segundo decide "viva" con el `now()` de Postgres y `is_match_member()`, no con el reloj del teléfono. `discovery_deck` gana `p_exclude_ids` (parámetro nuevo al final de la firma) para que la exclusión entre en el `where` antes del `limit`, así la página ya no encoge de forma impredecible. Los tres RPC, cubiertos contra Postgres de verdad en `schema-embedded.test.mjs`. Migración aplicada por el usuario en `grrzmzktrhksbttpbblg` el 2026-09-18, en el mismo lote que la de `D1`: `Schema drift` verde en local y remoto ([run 35361939148](https://github.com/thejowe/lockin/actions/runs/35361939148)). **El saneamiento de arquitectura del 2026-09-17 queda cerrado, 7/7.** Detalle en `docs/plan/todo/datos.md`
- [x] **[Claude]** Hallazgo 7 — estado mutable de módulo en los dos backends (orden `A2`, `arquitecto`, Ola 3). **Hecho el 2026-09-17.** El estado pasó del módulo a la instancia: `createMockStore()` devuelve un juego aislado de datos, reloj, contador de ids y suscriptores, y `createMockRepositories(store?)` / `createMockSessionRepository(actorId, store?)` construyen sobre él (sin argumento, el `defaultMockStore` de siempre, así que `resetState()`, `advanceMockClock()`, `mockNowMs()` y `CURRENT_USER_ID` no cambian). `createSupabaseRepositories()` crea su propio `Notifier` con sus listeners, canales y marcas. El `Set` de 256 con desalojo FIFO es ahora un `Map` con caducidad de 30 s: **ninguna marca se pierde por presión de tamaño**. Siete casos nuevos en `src/data/mock/instances.test.ts` y `src/data/supabase/instances.test.ts`. En la misma pasada se cerraron los dos jobs que `A1` dejó rojos (Formato, y el Export web que moría porque la guarda de backend se evaluaba al cargar el módulo: ahora salta al primer uso real). **Ojo, `D3`: `src/data/supabase/index.ts` tiene los repositorios reindentados dentro de la fábrica.** Detalle en `docs/plan/todo/arquitecto.md`
- [x] Hallazgo 1 (parte de UI) — pantalla de recuperación de cuenta (orden `P1`, `perfil`, Ola 3; **bloqueada por `D2`**, que es quien decide el contrato de vinculación). **Hecho el 2026-09-17.** `AccountSection` (`src/features/profile/account-section.tsx`), montada al final de la tab Perfil, con un bloque por estado de `AccountState` (irrecuperable, `pending-email`, `email`) y el ascenso de dos pasos que exige GoTrue. El bloqueo de cerrar sesión no lo decide la pantalla: lo lanza la capa de datos y solo desde ahí se confirma `acceptDataLoss: true`. Detalle en `docs/plan/todo/perfil.md`
