# TODO — datos

## Antes de nada
- [x] Comprobar si existen credenciales de Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Si no existen: avisar al usuario y limitarse al diseño de esquema — no inventar ni hardcodear credenciales.
  - **Ya existen** (2026-09-06), en `.env.local` (que está en `.gitignore`) y contra el proyecto `grrzmzktrhksbttpbblg`. Ningún valor real vive en el repo: `.env.example` solo lleva marcadores.

## Esquema (se puede hacer sin credenciales)
- [x] Tabla `profiles` (campos de `docs/plan/CONCEPTO.md`) — 1:1 con `auth.users`; `Availability` y `ProfileLinks` aplanados en columnas, `prompts` como `jsonb` (máx. 2)
- [x] Tabla `matches` — par ordenado canónicamente (`profile_a < profile_b`) + `unique`, para que no existan dos matches entre las mismas dos personas
- [x] Tabla `messages` — con trigger que mantiene `matches.last_message_at`
- [x] Políticas de Row Level Security (cada usuario ve solo sus propios matches/mensajes) — activas en las cinco tablas, `anon` revocado en todas
- [x] Migraciones en `supabase/migrations/` — seis archivos, aplicables con `supabase db reset`. Las cinco primeras del 2026-09-05; la sexta, `20260907000100_profiles_seeking_specialties.sql`, del 2026-09-07 (ver "Especialidades buscadas" al final)

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

### Ejecutado el contrato entero contra Supabase
- [x] Instalar `dev_reset_current_user()` (final de `supabase/seed.sql`) en
      `grrzmzktrhksbttpbblg`. Hecho a mano en el SQL editor el 2026-09-06.
      Funciona: la pasada siguiente gastó 4 altas anónimas en vez de 29 y
      ningún test murió con `Request rate limit reached`.
- [x] Volver a ejecutar la suite entera. Primera pasada con la función: **24/25**,
      y el único fallo NO era ni el límite por IP ni un problema de la función.
      Era esto:

  **La propia suite envenenaba el catálogo.** Cada pasada creaba cuatro usuarios
  (el del test y los tres de apoyo) con su perfil, y no borraba ninguno: 68
  perfiles acumulados sobre los 8 de `seed.sql`, 76 en total. Como
  `discovery_deck` pagina a `p_limit default 50`, el deck sin filtrar y el
  filtrado por modo devolvían **ambos 50**, y `sin modo concreto devuelve el
  catálogo entero` —que compara los dos tamaños— fallaba con un
  `Expected: > 50 / Received: 50` que no apunta a la causa. Confirmado en vivo:
  76 perfiles (`par` 10, `lockin` 10, `ambos` 56) y `discovery_deck` con
  `p_limit=500` devolviendo los 76.

- [x] Arreglado en `src/data/supabase/contract.test.ts`, sin tocar el contrato
      compartido ni los tipos de `arquitecto`:
  - **`teardown()` deshace lo que la pasada mete en el catálogo**: llama a
    `dev_reset_current_user()` con cada uno de los cuatro clientes antes de
    cerrar sesión. Los `auth.users` anónimos sobreviven —borrarlos exige
    `service_role`— pero sin perfil no entran en ningún deck.
  - **Guardia de prerequisito en `beforeAll`**: cuenta los perfiles y, si no
    caben bajo el tope de página, falla diciendo qué ejecutar. El fallo críptico
    de tamaño se convierte en instrucción.
- [x] Limpieza puntual de los 68 residuos, ejecutada a mano por el usuario en el
      SQL editor: `delete from auth.users where is_anonymous = true;` — cascada a
      perfiles, `user_settings`, decisiones, matches y mensajes. Los ocho de
      `seed.sql` no son anónimos y quedan intactos.

      Ojo con el orden: esta casilla llegó a estar marcada **antes** de que la
      limpieza se ejecutara de verdad, y la pasada siguiente lo destapó — el
      catálogo seguía en 76 perfiles, el mismo número de antes. Lo destapó la
      guardia, no un humano leyendo el TODO.
- [x] Pasada final: **25/25**, el 2026-09-06.

      `LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts`
      → `Tests: 25 passed, 25 total` en 31.9 s. Cuatro altas anónimas en toda la
      pasada, ninguna cerca del límite de 30/hora, y el `teardown()` devuelve el
      catálogo a los ocho de `seed.sql`.

## Flujo real en la app, a mano

- [x] Recorrido de extremo a extremo el 2026-09-06: registro → perfil → deck →
      match → mensaje, en la app levantada con `.env.local` puesto. Reportado
      correcto por el usuario.
- [x] Comprobado que fue **Supabase real y no el mock**. La señal obvia —ver los
      ocho perfiles del seed— **no vale**: `supabase/seed.sql` es el catálogo de
      `src/data/mock/seed.ts` traducido a filas, así que los dos backends
      enseñan el mismo deck y los mismos nombres. La señal que sí discrimina es
      la persistencia: el mock es estado en memoria (`src/data/mock/store.ts`,
      "el MVP no promete persistencia"). El usuario cerró la app entera y al
      reabrirla seguían su perfil, sus swipes y sus mensajes.

      Se preguntó antes de marcar, a propósito: este bloque ya se llevó un susto
      marcando una casilla sin verificarla (la limpieza de los 68 residuos, más
      arriba).

- Lo que este recorrido **no** es: una prueba automatizada. Fue una pasada
  manual en un dispositivo. No hay E2E en CI, así que una regresión en el
  pegamento pantalla ↔ repositorio seguiría sin tener quien la detecte — los 222
  tests corren contra el mock y los 25 de contrato no pasan por la interfaz.

## Deuda menor cerrada (2026-09-06)

- [x] **`mailer_autoconfirm` se queda en `false`** — decisión, no olvido.
      Autoconfirmar da por buena una dirección sin comprobar que quien se
      registra la controla: permite registrarse con el email de otra persona. No
      estorba porque la vía principal es `signInAnonymously()` y el camino por
      email es solo el respaldo de `auth.ts` (cuenta de dispositivo con email y
      contraseña aleatorios) más `linkEmailToCurrentUser()`, que precisamente sí
      debe pedir confirmación. Los ocho de `seed.sql` no lo necesitan: se
      insertan con `email_confirmed_at` puesto. Escrito en `supabase/README.md`
      → "Configuración de Auth en el dashboard".
- [x] **Procedimiento para borrar los usuarios anónimos de pruebas**, escrito en
      `supabase/README.md` → "Mantenimiento: borrar los usuarios anónimos de
      pruebas". Cada pasada de la suite deja cuatro filas en `auth.users`; sus
      perfiles ya los borra el `teardown()` vía `dev_reset_current_user()`, así
      que no vuelven a saturar la paginación del deck. Los dos caminos
      documentados: `delete from auth.users where is_anonymous = true;` en el
      SQL Editor (corre como superusuario, cascada a las cinco tablas, los ocho
      del seed no son anónimos y sobreviven) o la Admin API con `service_role`.
      Con el aviso importante: ese `delete` sin filtro solo es seguro mientras la
      única fuente de cuentas anónimas sea la suite — la app usa
      `signInAnonymously()` como vía principal, así que contra un proyecto con
      usuarios reales borraría sus cuentas.

## Deriva entre `supabase/migrations/` y el esquema desplegado (2026-09-06)

El hueco: `dev_reset_current_user()` no está en `migrations/`, vive solo en
`supabase/seed.sql`, y al proyecto remoto entró pegada a mano por el SQL Editor
— igual que las cinco migraciones. Así que había dos esquemas y ninguna garantía
de que coincidieran: `e2e/run.mjs` construye la base local desde los archivos del
repo, `src/data/supabase/contract.test.ts` habla con el proyecto remoto, y los
dos podían estar en verde con las bases divergidas. El mismo patrón que ya costó
una tarde ("el seed que se había ejecutado era el anterior", en `TODO.md`).

### 1. Dónde vive `dev_reset_current_user()`

- [x] **Decidido: se queda en `supabase/seed.sql`.** Argumentado, no improvisado.

  El motivo para no meterla en `migrations/` no es que sea `SECURITY DEFINER`
  —no toma parámetros y solo mira `auth.uid()`, así que nadie puede apuntarla
  contra otra persona—. Es el **daño colateral**: borra los matches del usuario,
  y con cada match se van los mensajes de la **otra** persona y los likes que esa
  persona le dio. En producción sería un botón de "destruye datos que no son solo
  tuyos", sin confirmación, al alcance de cualquier cliente con sesión.

  Las dos alternativas que se consideraron y por qué no:

  - **Migración con guardia de entorno.** La guardia tendría que distinguir una
    base de desarrollo de una de producción y aquí no hay forma limpia: la app
    usa `signInAnonymously()` como vía principal, así que "quien llama es un
    usuario anónimo" describe igual de bien a la suite de contrato que a un
    usuario real. Y una migración condicional haría que la base local y la
    desplegada difieran *legítimamente*, que es justo lo que rompe el cotejo de
    deriva que se monta en el punto 2.
  - **Archivo aparte en `supabase/dev/`.** Se lee mejor, pero `e2e/run.mjs` copia
    solo `migrations/` y `seed.sql`: sacarla de ahí la quitaría en silencio de la
    única base local que el repo sabe construir, y `e2e/` es de `calidad`.

  Lo que faltaba no era el archivo, era que su instalación en el despliegue fuera
  **verificable** en vez de "alguien la pegó un día".

- [x] `supabase/dev-teardown.sql` — retira `dev_reset_current_user()` y
      `seed_incoming_likes(text)` de una pegada, con el motivo escrito arriba.
- [x] El razonamiento entero, en `supabase/README.md` → "Deriva de esquema", con
      referencias cruzadas desde `supabase/seed.sql` y `src/data/supabase/README.md`.

- **Nudo de fondo anotado, no resuelto:** hoy `grrzmzktrhksbttpbblg` es a la vez
  desarrollo, staging y el proyecto al que apunta la app, así que la suite de
  contrato obliga a tener instalada ahí una función que no debería estar donde
  hay usuarios reales. La salida no es esconder la función: es apuntar
  `contract.test.ts` a una base desechable (lee URL y clave de `.env.local`, así
  que basta cambiarlas por las de `supabase start` + `db reset --local`) y dejar
  el proyecto remoto limpio con `dev-teardown.sql`. Necesita Docker; en esta
  máquina no hay.

### 2. Cómo se detecta la deriva

`supabase db diff` no es una opción desde aquí, y no por pereza: `--linked`
exige `SUPABASE_ACCESS_TOKEN`, `--db-url` la contraseña de Postgres, y la
variante local necesita Docker. En esta máquina no hay Docker, ni `psql`, ni
ninguna de esas dos credenciales (`npx supabase` 2.116.0 sí está). La
`service_role` no está en el repo y no debe estarlo, así que tampoco se usó.

Dos herramientas, complementarias a propósito:

- [x] **`supabase/drift-check.mjs`** — automático, un comando, solo con la clave
      `anon` de `.env.local`. `node supabase/drift-check.mjs`; sale con 1 si hay
      deriva.

      El endpoint OpenAPI de PostgREST (`GET /rest/v1/`), que daría el catálogo
      entero de un tirón, lo bloquea la pasarela de Supabase
      (*"Only the service_role API key can be used for this endpoint"*). Así que
      el esquema se deduce a base de sondas sin efectos, leyendo los códigos de
      error: `PGRST205` tabla que falta, `42703` columna que falta, `22P02`/
      `22007` que además **nombran el tipo o el enum** de la columna, `PGRST202`
      firma de función que no existe, `42501` que `anon` sigue revocado.

      Lo esperado no está escrito a mano en ningún archivo: se **parsea de
      `supabase/migrations/`** en cada ejecución. Un archivo de referencia
      mantenido a mano sería otra copia que puede divergir, o sea el mismo
      problema otra vez. El parser es estricto y lanza si encuentra una forma que
      no sabe leer, en vez de dar un falso verde.

      Las sondas no tienen efectos: las RPC se llaman con todos los argumentos a
      `null` y el usuario de la sonda es anónimo y sin perfil, así que
      `record_decision()` muere en su propia comprobación de perfil antes de
      insertar nada. El token de sesión se cachea en el temporal del sistema
      (nunca en el repo) para no gastar altas del límite de 30/hora por IP.

- [x] **Verificado que detecta de verdad**, no solo que sale verde. Control
      negativo con copias de las migraciones en un directorio temporal, con una
      columna, un valor de enum y una función inventados: los tres salieron
      marcados y el proceso terminó con código 1.

- [x] **`supabase/schema-fingerprint.sql`** — el cotejo exacto. Una línea por
      objeto (tablas, columnas con tipo/nullable/default, constraints, índices,
      enums, funciones con seguridad y md5 del cuerpo, triggers, políticas RLS
      con sus expresiones, GRANTs de tablas y de funciones, y pertenencia a la
      publicación de realtime) más un `digest` md5 de todo como primera fila. Se
      ejecuta en los dos lados y se comparan primero los digest, y si difieren,
      `diff`. Procedimiento en la cabecera del archivo.

      Cubre justo lo que `drift-check.mjs` no puede ver: políticas, CHECKs,
      índices, triggers, defaults, permisos y los objetos que sobren.

### 3. Ejecutado contra el proyecto real

- [x] `node supabase/drift-check.mjs` contra `grrzmzktrhksbttpbblg`,
      2026-09-06: **sin deriva**.
  - 5 tablas y sus 38 columnas, con el tipo que declaran las migraciones.
  - 8 enums, con sus 29 valores.
  - Las 6 funciones que PostgREST expone, con la firma esperada
    (`array_has_duplicates`, `is_valid_prompts`, `is_match_member`,
    `resolve_match_mode`, `record_decision`, `discovery_deck`). Las dos que
    devuelven `trigger` (`touch_updated_at`, `messages_touch_match`) PostgREST no
    las expone: se declaran no sondeables en vez de darse por buenas.
  - `anon` sin sesión sigue recibiendo `42501` en las cinco tablas.
  - `dev_reset_current_user()` y `seed_incoming_likes(p_email)` **están
    instaladas** — esperado hoy, y lo que hay que retirar antes de que el
    proyecto tenga usuarios reales.

- [x] **Cotejo completo de `schema-fingerprint.sql` local Supabase ↔ remoto.**
      **Cerrado el 2026-09-13** con el [run 34757433478](https://github.com/thejowe/lockin/actions/runs/34757433478)
      (`9666b4e`): el remoto es las migraciones más exactamente las dos funciones
      de desarrollo, nada más. Detalle en "Cotejo remoto ejecutado" al final.
      Actualización 2026-09-09: el SQL sí se ejecutó en PostgreSQL embebido;
      ver evidencia y workflow al final. Esto no cierra el cotejo contra
      `grrzmzktrhksbttpbblg`. El diagnóstico que sigue es histórico (2026-09-07).
      El lado del repo exige
      levantar la base local con Docker y en esta máquina no hay ni Docker ni
      `psql`; con media huella no se compara nada, así que no se ejecutó tampoco
      el lado remoto. Su sintaxis sí está verificada contra la gramática real de
      PostgreSQL (libpg_query, vía `pgsql-parser`), igual que la de
      `dev-teardown.sql` y las cinco migraciones. Pendiente de una máquina con
      Docker.

      Comprobado a conciencia el 2026-09-07 en esta máquina, no dado por
      supuesto — la ausencia es el hallazgo, así que se deja con evidencia:

      - Ni en `PATH` ni instalados: `docker`, `docker-compose`, `psql`,
        `pg_dump`, `pg_ctl`, `postgres`. No existen `C:\Program Files\Docker`,
        `C:\Program Files\PostgreSQL`, `%LOCALAPPDATA%\Programs\Docker` ni
        `pgAdmin 4`, y `Get-Service *docker* *postgres*` no devuelve nada.
      - `wsl.exe` existe pero **sin distribuciones instaladas**, así que tampoco
        hay esa vía para un Postgres local.
      - `npx supabase` está, pero no sirve: `supabase start` necesita Docker, y
        `db diff --linked` / `--db-url` siguen exigiendo `SUPABASE_ACCESS_TOKEN`
        o la contraseña de Postgres, que no están aquí y no deben estar en el
        repo.
      - Tampoco vale hacer solo el lado remoto: la huella lee `pg_catalog`, que
        la clave `anon` no alcanza, y aunque se alcanzara una huella sin la otra
        no compara nada.

      Lo que sí se reverificó hoy, que es todo lo que esta máquina puede dar:
      `node supabase/drift-check.mjs` contra `grrzmzktrhksbttpbblg` → **sin
      deriva**, código de salida 0 (5 tablas / 38 columnas, 8 enums / 29
      valores, 6 funciones con su firma, `anon` denegado en las cinco tablas).
      Sigue sin ver políticas, CHECKs, índices, triggers ni objetos de más:
      justo el hueco que esta casilla cubriría.

      **Cómo cerrarla** cuando haya una máquina con Docker y `psql`
      (procedimiento completo en la cabecera del propio archivo):
      `npx supabase start` + `npx supabase db reset` para el lado del repo, la
      huella contra la base local, la misma huella contra el proyecto remoto por
      la cadena de conexión de Postgres, y `diff` de las dos salidas — o solo de
      la primera fila, el `digest`, si coinciden.

### Deuda de documentación cerrada de paso

- [x] `src/data/supabase/README.md` decía que ver los ocho perfiles del seed
      confirmaba estar contra Supabase. No confirma nada: `supabase/seed.sql` es
      el catálogo del mock traducido a filas y los dos backends enseñan los
      mismos nombres. Sustituido por la señal que sí discrimina, la persistencia
      tras cerrar y reabrir la app. Ya estaba anotado más arriba en este archivo,
      pero el README seguía diciendo lo contrario.
- [x] La cabecera de `supabase/README.md` decía "`supabase/seed.sql` todavía no
      se ha ejecutado" mientras su propia sección "Estado", al final, decía que
      sí. Corregido.

## Especialidades buscadas — `seeking_specialties` (2026-09-07)

`arquitecto` amplió el contrato con `Profile.seekingSpecialties` (commit
`7abbb0c`) y dejó el lado de Postgres marcado como trabajo de este bloque, con
un `TODO(datos)` en `mappers.ts` y un caso de contrato en rojo a propósito para
que la pérdida de datos no fuera muda. Esto lo cierra por el lado del repo.

### Lo que se hizo

- [x] **Migración nueva**, `supabase/migrations/20260907000100_profiles_seeking_specialties.sql`.
      No se tocó `20260905000200`: ya está aplicada contra `grrzmzktrhksbttpbblg`,
      y reescribir una migración aplicada es fabricar deriva.
      `add column seeking_specialties public.specialty[] not null default '{}'`
      con `check (cardinality <= 10 and not array_has_duplicates)`.
- [x] **Tres decisiones de esquema, escritas en la propia migración:**
  - **El vacío es válido** (`<= 10`, no `between 1 and 10` como `specialties`):
    es el único valor legal en `lockin` y significa «abierto a cualquiera» en
    `par`/`ambos`.
  - **La invariante de lockin NO se fuerza en la base.** Un `check (looking_for
    <> 'lockin' or cardinality = 0)` era tentador; lo decidido por `arquitecto`
    es que la mantenga quien escribe el perfil. Meterla aquí la pondría en un
    sitio que el mock no puede replicar, y los dos backends cumplen el mismo
    contrato.
  - **`default '{}'`**, para que la columna sea retrocompatible sin backfill:
    las filas que ya existen quedan con un valor que significa algo, no con un
    `null` que habría que interpretar.
- [x] **Sin índice GIN, y argumentado.** `specialties` lo tiene porque el deck
      filtra por él (`discovery_deck` hace `&&`, y `ProfileFilter.specialties`
      se traduce a `overlaps`). Sobre lo *buscado* no hay hoy ninguna consulta:
      `arquitecto` dejó escrito que un filtro así sería otro campo de
      `ProfileFilter` y hay que hablarlo con `descubrir`. Un GIN que nadie lee
      solo cuesta mantenimiento en cada escritura de perfil. El `create index`
      exacto queda escrito en la migración para cuando llegue ese filtro.
- [x] `src/data/supabase/database.types.ts` — `seeking_specialties` en `ProfileRow`.
- [x] `src/data/supabase/mappers.ts` — `toProfile` lee la columna y
      `toProfileInsert` la escribe; fuera los dos `TODO(datos)`. Sin
      `seekingSpecialties` en el input se escribe `[]` y **no** se hereda del
      perfil existente, al revés que el acento del avatar: heredar dejaría al
      usuario con una preferencia que su formulario todavía no le deja ver ni
      cambiar. Cuatro tests nuevos en `mappers.test.ts` cubren las dos
      direcciones, el vacío, y que no se crucen `specialties` y lo buscado.
- [x] `src/data/supabase/index.ts` — **sin cambios, y no es un olvido**: todas
      sus lecturas de perfil son `select('*')` y todas sus escrituras pasan por
      `toProfileInsert`, así que la columna nueva entra sola. El único filtro por
      especialidad que tiene (`overlaps('specialties', …)`) es el de lo que la
      otra persona **domina**, que es lo que `ProfileFilter` sigue declarando.
- [x] `supabase/seed.sql` — los ocho perfiles la rellenan igual que
      `src/data/mock/seed.ts`, verificado campo a campo: Alba y Tomás vacíos por
      ser `lockin`, Omar vacío siendo `ambos` (la otra lectura del vacío), y los
      cinco restantes complementando a `specialties` sin repetirla.
- [x] **`supabase/drift-check.mjs` parseaba solo `create table`.** Una columna
      añadida por una migración posterior era invisible para él: habría dado
      «sin deriva» con la columna sin aplicar. Ahora también lee
      `alter table … add column`. Es justo el punto ciego que este cambio
      estrenaba, porque es la primera migración que añade una columna.

### Verificación

- `npx tsc --noEmit` — limpio.
- `npm run lint` — limpio.
- `npx jest --ci --runInBand` — **338 pasados, 31 suites**, 27 omitidos (la
  suite de contrato remota, que es opt-in). Sin fallos.
- `node supabase/drift-check.mjs` — **1 deriva**, exactamente la esperada:
  `falta la columna profiles.seeking_specialties`, código de salida 1. Sirve de
  control positivo del parser nuevo: la columna no aparece en ningún
  `create table`, así que solo puede haber salido de la rama nueva. Y no inventa
  ninguna otra: las otras cuatro tablas siguen dando su cuenta de columnas.
- Control del parser aparte, con el mismo método que la vez anterior (copia de
  `supabase/` en un temporal, migración inventada): dos `add column` en **una
  sola** sentencia, uno `text` y otro `specialty[]`. Los dos salieron marcados
  y el proceso terminó con código 1. La copia se borró después, porque para
  ejecutarse necesita una copia de `.env.local`.
- Sintaxis SQL de la migración nueva y del `seed.sql` modificado, validada
  contra la gramática real de PostgreSQL (libpg_query vía `pgsql-parser`), como
  se hizo con las cinco anteriores: 2 y 10 sentencias, sin errores. Con control
  negativo — un `alter table` con un corchete sin cerrar sí revienta.
- Prettier: los cuatro archivos de código tocados salen conformes con final de
  línea LF. `prettier --check` sobre el árbol de trabajo los marca igual **antes
  y después** del cambio, por el CRLF de este checkout de Windows contra el
  `endOfLine: "lf"` de `.prettierrc`; en CI (Linux) no pasa. Ya estaba anotado
  por `arquitecto`.

### Despliegue anterior (cerrado por consulta propia el 2026-09-07)

Evidencia de esta sesión: GET autenticado con sesión anónima a
`/rest/v1/profiles?select=id,name,seeking_specialties&order=id` en
`grrzmzktrhksbttpbblg` devolvió HTTP 200 y 9 filas. Los ocho UUID semilla
terminados en 001–008 dieron, respectivamente: `[marketing, ventas]`,
`[dev, ventas]`, `[]`, `[dev, producto]`, `[diseno, marketing]`, `[]`,
`[dev, producto]`, `[]`. Coinciden con el UPDATE de `supabase/seed.sql`: la
columna existe y el backfill está hecho. El noveno perfil tiene `[]`.
El diagnóstico de fallo que sigue es histórico, anterior a esta verificación.

- [x] **Pegar `20260907000100_profiles_seeking_specialties.sql` en el SQL Editor
      del dashboard.** Desde esta máquina no hay forma: solo está la clave
      `anon`, y `db push` exige `SUPABASE_ACCESS_TOKEN` o la contraseña de
      Postgres (mismo motivo por el que las cinco anteriores también se pegaron
      a mano). **Hasta que se pegue, escribir un perfil contra Supabase falla**,
      y el alcance real es mayor de lo que anticipaba `arquitecto` — medido, no
      supuesto:

      `LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts`
      → **27 fallidos de 27**, todos con el mismo error:

          Could not find the 'seeking_specialties' column of 'profiles'
          in the schema cache

      No es que fallen los dos casos de `seekingSpecialties`: es que casi todos
      los casos empiezan creando un perfil, y `saveCurrent` ahora manda la
      columna. PostgREST la rechaza y la pasada entera se cae en 3,5 s.

      Lo mismo le pasa a **la app** mientras apunte a este proyecto con
      `.env.local`: crear o editar perfil devuelve error. No hay a medias —
      antes el campo se perdía en silencio, ahora la escritura no pasa. Es lo
      correcto (un perfil guardado a medias no lo nota nadie; esto sí) y se
      arregla pegando la migración, pero conviene saberlo antes de abrir la app
      y pensar que se ha roto otra cosa.
- [x] **Actualizar los ocho perfiles ya sembrados.** El `on conflict (id) do
      nothing` del seed no toca filas existentes, así que volver a ejecutarlo NO
      les pone el campo: se quedan con el `{}` del `default`, que en `par`/`ambos`
      se lee como «abierto a cualquiera» y disimula la diferencia. El `update`
      exacto está en `supabase/seed.sql`, justo debajo del insert de perfiles.

### Hallazgo colateral: las funciones de desarrollo ya no están instaladas

`node supabase/drift-check.mjs` del 2026-09-07 dice que
`dev_reset_current_user()` y `seed_incoming_likes(p_email)` **NO están
instaladas** en `grrzmzktrhksbttpbblg`. El 2026-09-06 sí lo estaban (ver más
arriba, sección "Deriva … / 3. Ejecutado contra el proyecto real"). Alguien
ejecutó `supabase/dev-teardown.sql`, o el proyecto se reconstruyó.

Consecuencia práctica, y explica un fallo que si no parecería aleatorio: sin
`dev_reset_current_user()` la suite de contrato necesita **un alta anónima por
test** en vez de cuatro por pasada, y con 27 casos se come el límite de GoTrue
de 30 altas por hora e IP. La pasada de referencia de hoy murió justamente así
en el último test (`Request rate limit reached`), no por nada del esquema.

Para volver a poder ejecutar el contrato entero hay que reinstalarla pegando el
final de `supabase/seed.sql`. Y el límite ya gastado no se reinicia borrando
nada: hay que esperar a la hora siguiente.

## Deuda anotada
- `initialsFrom()` está duplicada en `src/data/mock/store.ts` y `src/data/supabase/mappers.ts`. Es lógica de dominio compartida, pero subirla a `src/data/` es territorio de `arquitecto`. Si divergen, el avatar de un mismo perfil cambia al conectar Supabase.
- ~~`MatchRepository.list()` resuelve el último mensaje de cada conversación con una ventana de los 200 mensajes más recientes~~ — cerrado por la orden `D3` (2026-09-18): ahora es el RPC `last_messages_for_matches` (`distinct on` en SQL). Ver esa sección.

## Orden por complementariedad mutua (2026-09-07)

- [x] Criterio de producto en JSDoc de DiscoveryRepository.getDeck: dos
  intersecciones booleanas con igual peso; 2 > 1 > 0, id ascendente; vacío no
  puntúa y Lock-In es neutral. No afecta al like recíproco.
- [x] Mock ordenado y migración nueva
  20260907000200_discovery_mutual_complement.sql preparada; conserva firma,
  permisos y RLS. Clasifica antes del límite de 50 sin eliminar puntuación cero.
- [x] Casos compartidos añadidos en repositories.contract.ts; los actores remotos
  son los tres usuarios de apoyo existentes, sin modificar semillas reales.
- [x] Migración nueva ejecutada por el usuario en SQL Editor de grrzmzktrhksbttpbblg
  (2026-09-07); comportamiento desplegado verificado con los ocho casos de ranking.
- [x] LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts:
  **35/35 pasados**, una suite, 53.912 s (2026-09-07), contra el proyecto real.
  Incluye orden mutuo, empates por id, vacíos, Lock-In, edición de perfil,
  consumo completo y match recíproco con cero encaje.

### Verificación local de esta entrega

- PostgreSQL embebido (PGlite, base temporal con auth.uid de prueba): las siete
  migraciones se aplicaron completas. Catálogo de 62 perfiles: el de encaje
  mutuo con id mayor quedó primero incluso con LIMIT 1; recargas idénticas;
  tras decidirlo, 50 pendientes y luego los 10 restantes. Lock-In quedó por id.
  Esto valida SQL y paginación, no sustituye la suite contra Supabase real.
- TypeScript: npm run typecheck, sin errores. Lint: npm run lint sin errores;
  corregidos dos avisos de import duplicado en el arnés mock y comprobado con
  ESLint sobre ese archivo. Prettier conforme en los siete archivos TS tocados.
- npm run test:coverage -- --ci --runInBand: **382/382**, 34 suites;
  35 casos remotos omitidos por opt-in. Suelo superado sin tocar jest.config.js:
  **90.43 / 82.65 / 91.98 / 91.93 %** (sentencias/ramas/funciones/líneas).
  La primera ejecución paralela tuvo un timeout de formulario y la primera
  en serie otro de render inicial de swipe-deck; repetición completa en serie
  verde (63 s), sin modificar tests, timeouts ni umbrales para ocultarlos.

## Cotejo de esquema en Actions (2026-09-09, bloque datos)

- [x] **Workflow propio implementado**, `.github/workflows/schema-drift.yml`,
  sin editar `ci.yml`, E2E ni código de producto. Evidencia de validación YAML:
  `Workflow YAML: push, workflow_dispatch, 2 jobs OK`. El checkout contiene
  `.github/workflows/e2e.yml`, no `e2e-android.yml`; se leyó el primero y
  `e2e/run.mjs:prepare` como patrón. CLI fijado a 2.116.0, runtime separado.
  Esto certifica implementación/estructura, **no una ejecución en Actions**.
- [x] **Comparador que falla y muestra diferencias**, validado con
  `node --test supabase/schema-compare.test.mjs`: `tests 8`, `pass 8`,
  `fail 0`. Rechaza salidas vacías/truncadas/digest incoherente; detecta
  columnas, índices, políticas, funciones, GRANTs y duplicados. No hay
  digest de referencia inventado: se genera desde migraciones sin seed.
- [x] **Huella SQL ejecutada parcialmente sin Docker**, con PGlite 0.3.14
  instalado en `%TEMP%/lockin-schema-validation`, sin cambiar dependencias
  del repo. Reproducción en `supabase/schema-embedded.test.mjs`; README
  explica `PGLITE_MODULE`. Salida literal:

  ```text
  SQL ejecutado: 7 migraciones; digest   34f1c73e81848bf08a31a5395a0edb50; 174 objetos
  Funciones de desarrollo retiradas; no se han borrado datos.
  Funciones de desarrollo retiradas; no se han borrado datos.
  Rol lector, 4 mutaciones, teardown dos veces y guardia de sobrecarga: OK
  ```

  Pasada conjunta del comparador y SQL embebido: `tests 9`, `pass 9`,
  `fail 0`, `skipped 0` (3.57 s). **Fixture mínima de Auth**: no GoTrue,
  no permisos iniciales de Supabase, no seed de cuentas ni comparación con
  el remoto. Ese digest no se adopta como huella esperada de Supabase.
- [x] **Ausencia del secreto verificada y omisión implementada**. Lectura
  autenticada de GitHub (solo nombres):
  `gh secret list --repo thejowe/lockin --json name` → `[]`, exit 0.
  En `.env.local` sí están URL/anon; no hay ACCESS_TOKEN, DB_PASSWORD ni
  SCHEMA_DB_URL. En PATH no hay docker ni psql. La primera consulta a GitHub
  estaba bloqueada por la red del sandbox; repetida con acceso de lectura
  autorizado devolvió la lista vacía anterior. No confundir ese primer error
  con un token inválido ni con prueba de ausencia de secretos.
  El workflow tiene warning + resumen explícito y job remoto skipped si
  falta `SUPABASE_SCHEMA_DB_URL`; un secreto presente pero erróneo falla.
- [x] **Auditoría del detector y decisión de retirada escritas**, en
  `supabase/README.md` → "Cotejo SQL en Actions". Evidencia del punto ciego:
  `discovery_deck` se define tanto en 20260905000500 como en 20260907000200;
  `parseMigrations()` acumula ambas y la sonda solo manda argumentos NULL.
  El cuerpo nuevo puede pasar sin verificarse. Índices y políticas no se
  parsean; DROP/RENAME/ALTER TYPE y otras DDL también pueden omitirse.
  No se reescribió el parser. La huella añade argumentos/defaults/retorno,
  search_path fijo y orden C; las cuatro mutaciones SQL sí se detectaron.
  El teardown ahora es atómico y rechaza sobrecargas/dependencias inesperadas;
  la prueba embebida anterior acredita idempotencia y rechazo de sobrecarga.
  Gatillo acordado por esta implementación: **antes del primer APK/enlace
  fuera del equipo de pruebas o primera cuenta real importada**. Retirar
  herramientas no elimina cuentas/likes de seed; requiere inventario separado.
- [x] **Ejecutar el workflow en GitHub Actions y pegar el enlace al run**.
  [Run 34415065493](https://github.com/thejowe/lockin/actions/runs/34415065493),
  commit `a6e4c9b`, job local `success`, remoto `skipped` por secreto ausente.
  Supabase/PostgreSQL 17.6: reset sin seed = reset con seed + teardown;
  rol lector, segundo teardown y cuatro controles SQL vía psql verificados.
  `schema-local` descargado y leído: `local.diff`, `reader.diff`,
  `teardown-twice.diff`, `after-controls.diff` → `Sin diferencias.`;
  las cuatro mutaciones tienen diffs no vacíos. Salida literal y rutas abajo.
  No existe `schema-remote`: este cierre verifica exclusivamente el job local.
- [x] **Activar y ejecutar la comparación remota**. Crear rol lector y
  guardar únicamente `SUPABASE_SCHEMA_DB_URL` según README; ejecutar el
  workflow y adjuntar `remote.diff` y enlace al run. **Hecho el 2026-09-13**:
  rol `lockin_schema_reader` y secreto creados por el usuario; runs
  [34756968269](https://github.com/thejowe/lockin/actions/runs/34756968269) y
  [34757433478](https://github.com/thejowe/lockin/actions/runs/34757433478),
  `remote.diff` de los dos en `supabase/evidence/`. Ver "Cotejo remoto ejecutado".
- [x] **Retirada verificada en el proyecto real** cuando se alcance el
  gatillo anterior: ejecutar dev-teardown.sql con autoridad de administrador
  y pegar su respuesta SQL aquí. **Hecho el 2026-09-13**, gatillo alcanzado.
  El usuario ejecutó `supabase/dev-teardown.sql` en el SQL Editor y, después,
  la consulta de solo lectura sobre `pg_proc` de los dos nombres en cualquier
  esquema. Respuesta SQL pegada por el usuario, literal:

  ```text
  Success. No rows returned
  ```

  Es la salida de la consulta de verificación (0 filas). La fila de
  `select … as resultado` del teardown no llegó al chat, así que no se cita
  como obtenida; lo que demuestra la retirada es el run siguiente, no esa fila.
  [Run 34760366206](https://github.com/thejowe/lockin/actions/runs/34760366206),
  `93a0020`, `workflow_dispatch`: los dos jobs `success`. Antes, el
  [run 34757718092](https://github.com/thejowe/lockin/actions/runs/34757718092)
  del mismo commit seguía dando las diez líneas `+` de las dos funciones.
  Artefactos en `supabase/evidence/34760366206/`. `remote.diff` literal:

  ```text
  Sin diferencias.
  ```

  Log del job remoto: `Remoto grrzmzktrhksbttpbblg: huella SQL coincide con
  las migraciones de este commit. Funciones de desarrollo no permitidas.`
  Digest de `remote.txt` = `expected.txt` = `22a5e5ccfffa27129df754ecd87c7480`
  (antes `0a7ec9c0…`, el de migraciones + seed), y `remote.txt` no contiene
  `dev_reset_current_user` ni `seed_incoming_likes`. En el job local,
  `local`/`reader`/`teardown-twice`/`after-controls.diff` → `Sin diferencias.`
  y los cuatro controles negativos siguen dando diff.

Verificación final local: ESLint sobre los cinco `.mjs` de esta entrega, exit 0;
Prettier sobre el workflow y los cuatro `.mjs` nuevos →
`All matched files use Prettier code style!`; `git diff --check` de los archivos
editados sin errores. Repetición final comparador + PGlite: `tests 9`, `pass 9`,
`fail 0`, `skipped 0` (4.84 s). Verificación previa al commit; no se ha hecho push.

### Continuación: ejecución real en Actions (2026-09-09)

Rama desechable `codex/datos-verificar-schema-drift`, publicada sin cambiar la
rama del worktree compartido. Commit inicial `dcfda36`: su mensaje explica la
pregunta de verificación y que no está destinado a fusionarse. Los commits de
prueba usan un índice temporal y `git add` por ruta; no incluyen trabajo pendiente
de otros bloques. No se ha publicado la rama principal.

Hallazgos conservados, sin convertir intentos en verificación:

- [Run 34413868903](https://github.com/thejowe/lockin/actions/runs/34413868903),
  `dcfda36`: `failure`, **0 jobs**. `actionlint` identificó literalmente
  `context "runner" is not allowed here` en las líneas 22, 23 y 75 del workflow.
  YAML válido no validaba los contextos de Actions. Corrección `5253dcf`:
  inicializar rutas con `RUNNER_TEMP` y `GITHUB_ENV` en pasos.
- [Run 34414099509](https://github.com/thejowe/lockin/actions/runs/34414099509),
  `5253dcf`: siete migraciones aplicadas, pero
  `AssertionError [ERR_ASSERTION]: psql falló (exit=2); no hay verificación`.
  `gh run download` para ambos runs anteriores devolvió literalmente
  `no valid artifacts found to download`. Log del segundo conservado en
  `supabase/evidence/34414099509/failed.log`.
- [Run 34414441294](https://github.com/thejowe/lockin/actions/runs/34414441294),
  `c78d1d2`: conexión corregida separando campos `PG*`; `gh run download`
  terminó con exit 0 y sin salida. Artefacto `schema-local` descargado en
  `supabase/evidence/34414441294/schema-local/`: `expected.txt` y
  `postgres-version.txt`, **sin local.txt ni diffs todavía**. Salida literal:

  ```text
  psql: reset --local --no-seed capturado en expected.txt.
  17.6
  digest   22a5e5ccfffa27129df754ecd87c7480
  AssertionError [ERR_ASSERTION]: psql falló (exit=3); no hay verificación
  ```

  Falló al capturar bajo el rol lector; no se afirma equivalencia con seed.
  Log conservado en `supabase/evidence/34414441294/failed.log`.

Secreto: nueva consulta autenticada
`gh secret list --repo thejowe/lockin --json name` → `[]`, exit 0.
En el segundo run la anotación literal fue:

```text
Falta SUPABASE_SCHEMA_DB_URL. No se ha comparado grrzmzktrhksbttpbblg; el verde local no verifica el remoto.
```

La casilla de cotejo remoto sigue abierta. El SQL exacto de creación del rol y
los pasos de SQL Editor → Connect/Session pooler → GitHub Actions secret están
en `supabase/README.md`, sección «Activar el remoto: un secreto». Solo el usuario
puede crear ese secreto. Ninguna credencial inventada o guardada en el repo.
La casilla de retirada y su gatillo no se modifican; no se ha ejecutado SQL
administrativo ni teardown contra el proyecto remoto.

El [run de diagnóstico 34414726526](https://github.com/thejowe/lockin/actions/runs/34414726526)
(`8af2215`) produjo `schema-local`, descargado con `gh run download` (exit 0,
sin salida). `supabase/evidence/34414726526/schema-local/local-psql-error.txt`
contiene literalmente:

```text
ERROR:  permission denied to set role "lockin_schema_reader"
```

La consulta de catálogo aún no había empezado bajo el lector. Corrección
`a6e4c9b`: `grant lockin_schema_reader to current_user with set true;` únicamente
en la base desechable, para que el administrador de la prueba pueda asumir el
rol. No se amplían los privilegios del lector ni se ejecuta ese GRANT en remoto.

#### Resultado verificado y artefactos leídos

[Run 34415065493](https://github.com/thejowe/lockin/actions/runs/34415065493),
commit `a6e4c9b45cf85493d5fb55091e752b72aabd1e33` en la rama desechable. Respuesta literal de
`gh run view 34415065493 --repo thejowe/lockin --json status,conclusion,jobs`
proyectada a estado y jobs:

```json
{"conclusion":"success","jobs":[{"conclusion":"success","name":"Huella local y controles negativos","status":"completed"},{"conclusion":"skipped","name":"Comparar grrzmzktrhksbttpbblg (solo lectura)","status":"completed"}],"status":"completed"}
```

`gh run download 34415065493 --repo thejowe/lockin --dir
supabase/evidence/34415065493` → exit 0, sin salida. API de artefactos:

```json
{"artifacts":[{"digest":"sha256:e8765d78d0a96aa595fd969d57e5533539a2cc1c491f8c27f336ac3cd3cf932b","name":"schema-local","size_in_bytes":35871}],"total_count":1}
```

Los **19 archivos** descargados viven en
`supabase/evidence/34415065493/schema-local/`. `expected.txt`, `local.txt`,
`reader.txt`, `teardown-twice.txt` y `after-controls.txt` tienen la huella
`digest   22a5e5ccfffa27129df754ecd87c7480` (PostgreSQL `17.6`).
`development.txt` conserva ambas funciones de seed antes de la retirada local.
El log completo está en `supabase/evidence/34415065493/run.log`.
Fragmentos literales del log (sin prefijos de job/fecha):

```text
Falta SUPABASE_SCHEMA_DB_URL. No se ha comparado grrzmzktrhksbttpbblg; el verde local no verifica el remoto.
psql: reset --local --no-seed capturado en expected.txt.
psql: rol lector produce la misma huella (reader.diff).
Seeding data from supabase/seed.sql...
psql: reset con seed + teardown = reset sin seed (local.diff).
psql: segundo teardown sin diferencias (teardown-twice.diff).
psql: control negativo column detectado; transacción revertida.
psql: control negativo index detectado; transacción revertida.
psql: control negativo policy detectado; transacción revertida.
psql: control negativo function detectado; transacción revertida.
Local: migraciones = reset con seed + teardown. Rol lector, idempotencia y cuatro controles negativos PASADOS. Esto no verifica el proyecto remoto.
```

Contenido literal de cada uno de `local.diff`, `reader.diff`,
`teardown-twice.diff` y `after-controls.diff`:

```text
Sin diferencias.
```

`negative-column.diff`:

```diff
--- esperado: migrations/
+++ observado
+ column   profiles.schema_drift_probe text notnull=f default=-
```

`negative-index.diff`:

```diff
--- esperado: migrations/
+++ observado
+ index    profiles.schema_drift_probe CREATE INDEX schema_drift_probe ON public.profiles USING btree (name)
```

`negative-policy.diff`:

```diff
--- esperado: migrations/
+++ observado
- policy   profiles.profiles: cualquier autenticado puede leer cmd=SELECT permissive=PERMISSIVE roles=authenticated using=true check=-
+ policy   profiles.profiles: cualquier autenticado puede leer cmd=SELECT permissive=PERMISSIVE roles=authenticated using=false check=-
```

`negative-function.diff`:

```diff
--- esperado: migrations/
+++ observado
- func     public.is_valid_prompts(jsonb) args=prompts jsonb returns=boolean lang=sql security=invoker volatile=i config=search_path="" body_md5=48cc8b2cc8bbf2c8a79ab32eb99dfa8e
+ func     public.is_valid_prompts(jsonb) args=prompts jsonb returns=boolean lang=sql security=invoker volatile=i config=search_path="" body_md5=7330325ebbea3b41b64113c40e7a7d39
```

No se descargó `schema-remote` porque la API confirma que no existe: no hay
`remote.txt` ni `remote.diff`. Las dos casillas de comparación remota permanecen
abiertas hasta que el usuario cree `SUPABASE_SCHEMA_DB_URL` y haya un run remoto
con artefactos. La casilla de retirada permanece intacta y sin ejecutar.

Validación de las correcciones: actionlint exit 0; ESLint de schema-ci.mjs exit 0;
Prettier del script/workflow conforme; comparador Node `tests 8`, `pass 8`,
`fail 0`, `skipped 0`. Estas comprobaciones acompañan al run, no lo sustituyen.

Relectura independiente de las huellas descargadas con compareFingerprints:
`Artefactos descargados: 4 igualdades y 4 diffs negativos reproducidos, OK`.

## Cotejo remoto ejecutado (2026-09-13)

El usuario creó `lockin_schema_reader` y el secreto `SUPABASE_SCHEMA_DB_URL`
(Session pooler, `sslmode=require`); `gh secret list` lo lista desde
2026-09-13T12:23:09Z. Ninguna credencial pasó por el chat ni está en el repo.

### Primer run: diez cuerpos «distintos», todos por CRLF

[Run 34756968269](https://github.com/thejowe/lockin/actions/runs/34756968269),
`7f986af`, `workflow_dispatch`. Local `success`; remoto `failure` — se conectó
y comparó, no es un skip. Tablas, columnas, constraints, índices, enums,
triggers, políticas, grants de tabla y publicación: **iguales**. Lo distinto:
el `body_md5` de las diez funciones, más las dos de desarrollo.

Que cambiaran las diez a la vez, incluida `touch_updated_at`, olía a formato y
no a lógica. Comprobado fuera de CI, extrayendo de `git show HEAD:` cada cuerpo
entre sus delimitadores `$…$`: `md5(cuerpo LF)` = esperado en las diez, y
`md5(cuerpo CRLF)` = remoto en las diez. Se pegaron en el SQL Editor desde este
checkout de Windows (`core.autocrlf=true`, sin `.gitattributes`), y Postgres
guarda `prosrc` byte a byte. Evidencia: `supabase/evidence/34756968269/schema-remote/`
(`remote.diff`, `remote.txt`, `expected.txt`).

Arreglo, `9666b4e`: la huella calcula `md5(replace(prosrc, E'\r\n', E'\n'))`, y
`.gitattributes` fija `*.sql text eol=lf`. Descartado recrear las diez
funciones en producción: escribir en el remoto por un salto de línea. Con
PGlite, el mismo cuerpo en CRLF y en LF da la misma línea y un cuerpo distinto
da otra; `node --test schema-compare.test.mjs schema-embedded.test.mjs` →
`tests 9`, `pass 9`, `fail 0`.

### Segundo run: el remoto es migraciones + funciones de desarrollo

[Run 34757433478](https://github.com/thejowe/lockin/actions/runs/34757433478),
`9666b4e`, push. Local `success`: `local.diff`, `reader.diff`,
`teardown-twice.diff` y `after-controls.diff` → `Sin diferencias.`; el control
negativo de función sigue dando diff (`body_md5=7330325e…`), así que la
normalización no lo ha cegado. Remoto `failure` con
`AssertionError [ERR_ASSERTION]: DERIVA: ver remote.diff`, y `remote.diff`
literal:

```diff
--- esperado: migrations/
+++ observado
+ func     public.dev_reset_current_user() args= returns=void lang=plpgsql security=definer volatile=v config=search_path="" body_md5=89ce06b5f02a64f43388edbdbbcc0d91
+ func     public.seed_incoming_likes(text) args=p_email text returns=integer lang=plpgsql security=invoker volatile=v config=- body_md5=c13ae5ded7edad2ac1e28ecbdfcecb97
+ grantfn  public.dev_reset_current_user() authenticated EXECUTE
+ grantfn  public.dev_reset_current_user() postgres EXECUTE
+ grantfn  public.dev_reset_current_user() service_role EXECUTE
+ grantfn  public.seed_incoming_likes(text) PUBLIC EXECUTE
+ grantfn  public.seed_incoming_likes(text) anon EXECUTE
+ grantfn  public.seed_incoming_likes(text) authenticated EXECUTE
+ grantfn  public.seed_incoming_likes(text) postgres EXECUTE
+ grantfn  public.seed_incoming_likes(text) service_role EXECUTE
```

Solo líneas `+`, y solo de las dos funciones de seed. Quitadas esas líneas,
`expected.txt` y `remote.txt` son idénticos (`diff` sin salida). Además el
digest remoto `0a7ec9c04c40aa4d5fe9e87cf51c40bd` es el mismo que el de
`development.txt` local (migraciones + seed antes del teardown) del primer run:
el proyecto real está exactamente donde deben dejarlo migraciones más
`seed.sql`. Artefactos completos en `supabase/evidence/34757433478/`.

### Lo que queda

Actualizado el 2026-09-13, tras la retirada (run 34760366206):

- **El job remoto de `schema-drift.yml` ya debe salir verde.** Un rojo a
  partir de aquí es deriva real, incluidas las dos funciones de desarrollo si
  alguien vuelve a pegar `seed.sql` contra el proyecto.
- **Cuentas y datos de seed siguen en la base.** La retirada quitó funciones,
  no filas: las ocho cuentas de `seed.sql` (contraseña de desarrollo conocida),
  sus perfiles y los likes sembrados, más los usuarios anónimos de pasadas de la
  suite. Retirarlos es otro inventario: UUID concretos y revisión de cascadas,
  nunca por `is_anonymous` ni por edad. Ver `supabase/README.md` → "Retirada".
- **La suite de contrato remota ya no es ejecutable** contra este proyecto sin
  `dev_reset_current_user()`: gasta un alta anónima por test y choca con el
  límite de 30/hora. Hay que apuntarla a una base desechable
  (`supabase start` + `db reset`), y no reinstalar la función en el remoto.

## Limpieza de cuentas de seed y pruebas en `grrzmzktrhksbttpbblg`

- [x] Inventario de solo lectura de qué filas son de seed, de pruebas o posibles
      usuarios reales, y SQL de borrado para ejecutar como administrador —
      **preparados y probados en PostgreSQL embebido (2026-09-13)**; ver abajo
- [ ] Inventario ejecutado en el SQL Editor de `grrzmzktrhksbttpbblg` y su
      resultado revisado y confirmado por el usuario — **pendiente del usuario**
- [ ] `borrado.sql` ejecutado con los UUID y el acuse confirmados, y su fila de
      resultado adjunta aquí — **no antes de la casilla anterior**

### Por qué no lo ha ejecutado `datos`

Ninguna credencial al alcance de este bloque lee esas filas: la clave `anon`
pasa por RLS (sin `auth.users`, y de `decisions`/`matches`/`messages` solo lo
propio), y `lockin_schema_reader` tiene `usage` sobre `public` pero ningún
`select` sobre tablas. Abrir sesión para mirar tampoco es de solo lectura: un
`signInAnonymously()` crea una cuenta más, y entrar como una de seed escribe
sesión y `last_sign_in_at`. El inventario lo corre quien tenga el SQL Editor.

### Qué hay

- `supabase/cleanup/inventario.sql` — un único `select`, sin escrituras.
  Una fila por cuenta de `auth.users` con categoría, perfil, swipes, matches,
  mensajes y, en las cuentas que se quedan, el **colateral**: decisiones,
  matches y mensajes suyos que caerían en cascada al borrar seed y pruebas (un
  match con Núria se lleva los mensajes que escribió la otra persona). La
  última fila suma ese colateral. Categorías:
  - `seed` — UUID fijo **y** email `@seed.lockin.app` (si solo una:
    `revisar: seed incoherente`).
  - `prueba: contrato con perfil` — anónimo con perfil «Recíproca Par/Lockin/
    Ambos» o «Perfil Prueba» (nombres de `contract.test.ts` y
    `test-fixtures.ts`): pasada que murió antes del teardown.
  - `prueba: contrato sin perfil (ráfaga)` — anónimo sin perfil con al menos
    otros 3 anónimos a menos de 5 minutos: cada pasada da cuatro altas seguidas.
  - `prueba: cuenta de dispositivo sin perfil` — `device-…@lockin.app`.
  - `revisar: posible usuario real` — el resto, incluido el recorrido a mano
    del 2026-09-06 y los anónimos sueltos sin perfil, que no se distinguen de
    un onboarding abandonado. Nunca se clasifica por `is_anonymous` ni por edad.
- `supabase/cleanup/borrado.sql` — una transacción. Los ocho UUID de seed van
  fijos; los de prueba se pegan a mano (EDITAR 1/2) y el colateral total del
  inventario se copia al acuse (EDITAR 2/2, que viene a `-1` para no pasar sin
  mirarlo). Aborta sin borrar nada si un id no existe, si un UUID de seed no
  tiene su email, si un id de prueba tiene perfil con otro nombre (no se borra
  un perfil real desde aquí aunque se pegue), si el colateral real no coincide
  con el acuse, si no borra exactamente tantas filas como ids, o si queda algún
  perfil de ellos o alguna cuenta `@seed.lockin.app`. Borra solo en
  `auth.users`; el resto cae por las FK de `migrations/`.
- `supabase/cleanup.test.mjs` — ambos contra PGlite 0.3.14 con las siete
  migraciones y la parte de cuentas y perfiles de `seed.sql` real, más: un
  anónimo «Joel» con like cruzado, match y mensaje con Núria y un pass a Marc;
  un anónimo suelto sin perfil; dos ráfagas de cuatro (una tras el teardown,
  otra muerta con perfiles); y una cuenta de dispositivo. Salida:
  `19 cuentas → 8 «seed», 1 dispositivo, 4 ráfaga, 4 con perfil, 2 «revisar»;
  TOTAL colateral 3/1/1`, el inventario no cambia ninguna fila, el acuse a `-1`
  aborta con `Colateral sobre cuentas que se quedan: 3 decisiones, 1 matches,
  1 mensajes`, pegar a Joel aborta con `No son reconocibles como prueba, revisar
  a mano: aaaaaaaa-… (Joel)`, un id inexistente aborta, los rechazos no borran
  nada, y el borrado bueno deja `cuentas_restantes 2, seed_restantes 0,
  perfiles_restantes 1` con Joel y el suelto; repetirlo aborta. `tests 1`,
  `pass 1`, `fail 0`.
  Verificado por mutación: umbral de ráfaga a `>= 9` → `fail 1`; guardia de
  colateral anulada → `fail 1, Missing expected rejection`. Evidencia en
  `supabase/evidence/limpieza-2026-09-13/pglite.txt`. Desde el 2026-09-15 ya no
  se salta ni se queda fuera de CI: entra en `npm run test:schema` y lo corre el
  job «SQL embebido» (ver "`cleanup.test.mjs` entra en `test:schema`" al final).
  Lo que no prueba: GoTrue ni sus tablas hijas de `auth` (sesiones,
  identidades), cuyas cascadas son de Supabase y no de este repo.

### Para el usuario

1. SQL Editor → pegar `supabase/cleanup/inventario.sql` → ejecutar →
   descargar CSV. Guardarlo (o pasarlo) para
   `supabase/evidence/limpieza-2026-09-13/inventario-remoto.csv`: los UUID
   anónimos no son secretos, pero si hay emails reales, quitarlos antes.
2. Confirmar fila a fila qué `prueba:` y qué `revisar:` son de verdad pruebas.
   Si se borra alguna `revisar`, su colateral deja de contar y el acuse cambia:
   la propia guardia dice el número real al abortar.
3. Rellenar los dos EDITAR de `borrado.sql`, ejecutarlo y adjuntar su fila de
   resultado aquí.

El README (`supabase/README.md` → "Mantenimiento") recomendaba
`delete from auth.users where is_anonymous = true`; queda marcado como
obsoleto para este proyecto y remite aquí. El mismo consejo sigue en el mensaje
de error de `assertCatalogFitsInOneDeckPage()` en `contract.test.ts`, que ya
solo debe correr contra una base desechable, donde es correcto.

## `cleanup.test.mjs` entra en `test:schema` (2026-09-15)

Las dos casillas que `calidad` dejó abiertas en `docs/plan/todo/calidad.md` →
"El SQL embebido entra en CI", por ser archivos de este bloque.

- [x] **Comprobado primero que tiene sentido correrlo en cada push**, que era la
  duda razonable: lo que prueba es un borrado. Sí lo tiene, por cuatro cosas
  medidas y no supuestas. (a) **No alcanza a ningún proyecto**: sus únicos
  `import` son `node:*` y el dinámico de PGlite — ni `@supabase/supabase-js` ni
  `fetch` ni `.env`—, y cada pasada crea una base **en memoria** nueva; el
  `delete from auth.users` de `borrado.sql` cae sobre esa base y muere con el
  proceso. (b) **No depende de nada que en CI no exista**: lee del propio repo
  `migrations/*.sql`, `seed.sql` y `cleanup/*.sql`, y monta a mano la fixture de
  `auth`. (c) **No es lento**: 2,4 s el archivo suelto y 2,7 s el script entero
  —`node --test` corre los tres archivos en paralelo—, o sea ~0,2 s sobre los
  2,5 s que ya costaba. (d) **No caduca**: ni `inventario.sql` ni `borrado.sql`
  usan `now()`; la única ventana temporal es entre cuentas (±5 min sobre
  `created_at`, la ráfaga), así que el veredicto no depende del reloj del runner
  ni de cuánto envejezcan las fechas del fixture.
- [x] **Mismo cambio que hizo `calidad` en `schema-embedded.test.mjs`**: fuera el
  `skip`, y el módulo se resuelve con `PGLITE_MODULE` si está —se sigue
  admitiendo y tiene prioridad, para no invalidar el README— y si no con
  `@electric-sql/pglite` del árbol, que llega con `npm ci` desde el 2026-09-15.
  **Ninguna aserción tocada**: 19 sitios de aserción antes y 19 después (18
  líneas con `assert.` + un `assert(` en `fillDeletion`); `git diff -w` son 17
  inserciones y 8 borrados, todas en la cabecera, la constante del módulo y la
  firma del test. El resto del diff es reindentado de Prettier al pasar el test
  de tres argumentos a dos.
- [x] **`npm run test:schema`** pasa a ser `node --test
  supabase/schema-compare.test.mjs supabase/schema-embedded.test.mjs
  supabase/cleanup.test.mjs` (único cambio en `package.json`; sigue siendo lista
  explícita y no glob, por lo que anotó `calidad`).
- [x] **`supabase/README.md` (línea 467) al día**: el camino normal pasa a ser
  `npm ci` + `npm run test:schema`, con los tres archivos y la mención de que es
  lo mismo que corre el job de `ci.yml`. El camino a mano **no se borra** —sigue
  descrito, con la nota de que `PGLITE_MODULE` tiene prioridad sobre el paquete
  del árbol—, y se añade un párrafo de qué cubre `cleanup.test.mjs` y por qué
  puede correr en CI.

### Verificación (2026-09-15, en este entorno)

- `npm run test:schema` → `# tests 10`, `# pass 10`, `# fail 0`, **`# skipped 0`**,
  2,7 s. Con las tres líneas de log del limpiador: `Inventario: 19 cuentas → …
  TOTAL colateral 3/1/1`, `Borrado: 19 → {"cuentas_restantes":2,…}` y
  `Guardias: acuse sin rellenar, perfil no reconocible, id inexistente y
  repetición: OK`. Mismo veredicto que tenía con `PGLITE_MODULE` a mano, ahora
  con nueve migraciones (se escribió con siete).
- **Puede fallar** —tres controles negativos, restaurados después
  (`git status` limpio para `supabase/cleanup/`)—:
  1. `inventario.sql`, umbral de ráfaga `>= 3` → `>= 9`: `# fail 1`,
     `expected: 'prueba: contrato sin perfil (ráfaga)'` /
     `actual: 'revisar: posible usuario real'`.
  2. `borrado.sql`, guardia del acuse de colateral puesta a `if false then`:
     `# fail 1`, `error: 'Missing expected rejection.'`, `operator: 'rejects'`.
  3. Sin PGlite (`node_modules/@electric-sql` apartado): `# fail 1`,
     `code: 'ERR_MODULE_NOT_FOUND'`, exit 1 — **no** `# skipped 1`, que es lo
     que habría dado el `skip` de antes.
- **El paso del job, tal cual**: extraído del YAML ya parseado
  (`jobs.schema.steps[-1].run`) y ejecutado con `RUNNER_TEMP` puesto → exit 0,
  con la línea de la guarda en el log. No se tocó `ci.yml`.
- Sin romper nada de paso: `npm run lint`, `npm run format:check` y
  `npm run typecheck` limpios; `npm test -- --ci` con **563 pasando**, 63
  saltados (contrato opt-in) y 53 suites — los mismos números que dejó
  `calidad`.

### Lo que queda

- [x] **Verlo verde en Actions**: `CI` sobre `5af44db`,
  [run 34996605601](https://github.com/thejowe/lockin/actions/runs/34996605601),
  con los siete jobs en verde; en el log de `SQL embebido` salen las dos líneas
  de guarda (`Guardias: … : OK` y `Rol lector, … : OK`) y `# pass 10`, `# fail 0`.
- [x] **Resuelto en `6e860ce`**: la guarda del paso ahora exige una línea por
  archivo, también la de `cleanup.test.mjs`. **Para `calidad`, en su archivo**: la guarda de `grep` del paso solo exige
  la última línea del **embebido**. Si alguien quitara `cleanup.test.mjs` de la
  lista o lo renombrara, el job seguiría verde sin ejecutarlo — exactamente el
  agujero que la guarda venía a tapar. La línea que serviría ya la imprime el
  test justo antes de cerrar: `Guardias: acuse sin rellenar, perfil no
  reconocible, id inexistente y repetición: OK`. No se ha tocado porque
  `.github/workflows/` es alcance de `calidad`.

## Saneamiento de arquitectura (auditoría del 2026-09-17)

Tres de los siete hallazgos de la auditoría del 2026-09-17 son de este bloque —
es el que más carga. Las órdenes completas, con alcance de archivos y criterio de
terminado, están en `docs/plan/ordenes-arquitectura.md`. **`D3` no puede correr a
la vez que `D2`**: se pisan en `src/data/supabase/index.ts`.

### Orden `D1` — canales de Realtime sin autenticar (Ola 1) — **[Claude]**

- [x] **Hallazgo 2, y es el más grave de seguridad.** `client.channel('lockin:video:<sessionId>')` en `src/data/supabase/video-signal.ts:24` y `client.channel('lockin:presence:<sessionId>')` en `presence.ts:19` son canales de broadcast **públicos**: ninguno pasa `config: { private: true }` y no hay una sola política de Realtime Authorization en `supabase/migrations/` (comprobado el 2026-09-17: cero coincidencias de `realtime.messages` en todo el directorio). Como cualquiera puede darse de alta anónimamente, quien conozca o adivine un `sessionId` entra en la señalización WebRTC, puede inyectar una `offer` y leer la presencia de la pareja. **Todas las tablas están cuidadosamente protegidas por RLS y este camino se salta ese modelo entero** — es la excepción, no una laguna menor
- [x] Migración nueva con las políticas sobre `realtime.messages` que dejen entrar solo a las dos personas del match de esa sesión, `npm run test:schema` en verde y `drift-check.mjs` enseñado a verlas si hace falta
- [x] **Pendiente del usuario, cerrado el 2026-09-18**: migración pegada en el SQL Editor de `grrzmzktrhksbttpbblg`. `Schema drift` verde en local y remoto ([run 35361939148](https://github.com/thejowe/lockin/actions/runs/35361939148), `remote.diff` = «Sin diferencias.»). **La excepción queda cerrada: desde aquí, un rojo del job remoto vuelve a ser deriva real**

#### Lo que se entregó (2026-09-17)

**El candado son dos mitades y hacen falta las dos.** La migración sola no
protege nada si el cliente no marca el canal como privado, y el flag del cliente
solo no protege nada si no hay políticas. Van en el mismo commit a propósito.

- [x] **`supabase/migrations/20260917000100_realtime_authorization.sql`**, nueva.
  Trae tres cosas:
  - Una **guarda** que mata la migración si `realtime.messages` no existe o no
    tiene RLS activo. Supabase lo trae activado de fábrica; si algún día no lo
    estuviera, es preferible morir a dejar creado un candado que no cierra. No
    se activa desde el SQL a propósito: el esquema `realtime` está **cerrado**
    (crear tablas o funciones dentro falla con permiso denegado), y lo único que
    Supabase permite ahí es gestionar las políticas de `realtime.messages`. Por
    eso la lógica vive en `public` y la política solo la llama.
  - `public.is_session_topic_member(text)`: saca el `sessionId` del nombre del
    topic y delega en `public.is_session_member()`, que ya era `SECURITY
    DEFINER` y ya estaba concedida a `authenticated`. La expresión regular exige
    el UUID completo y el topic entero (`^lockin:(?:video|presence):<uuid>$`).
    Estricta a propósito: un patrón laxo tipo `[0-9a-f-]{36}` dejaría llegar
    cadenas que no son UUID al `::uuid`, y **un error dentro de una política no
    es un «no», es una puerta rota**. Sin coincidencia, `substring` devuelve
    NULL y la respuesta es `false`.
  - Dos políticas sobre `realtime.messages`, `for select` y `for insert`, `to
    authenticated`, con `extension in ('broadcast', 'presence')`. Las dos
    extensiones van juntas en la misma política y no una por canal: al unirse,
    Realtime comprueba los permisos de ambas para decidir qué puede hacer la
    conexión, y afinar más aquí solo serviría para que un `join` legítimo
    fallara por el lado que no usa. La puerta que importa —de quién es la
    sesión— es la misma para vídeo y para presencia.
- [x] **Una línea en cada adaptador**, sin tocar su lógica (son de `video` y de
  `sesiones`): `config: { private: true }` en
  `src/data/supabase/video-signal.ts` y en `src/data/supabase/presence.ts`. Ese
  flag es lo que hace que el servidor **evalúe** las políticas. Sus dos tests
  (`video-signal.test.ts`, `presence.test.ts`) pasan a exigirlo con un comentario
  que dice por qué, para que quitarlo no sea un cambio silencioso.
- [x] **`supabase/schema-embedded.test.mjs`** cubre la política contra Postgres
  de verdad, como la evalúa Realtime: unirse a un topic privado es insertar un
  mensaje en `realtime.messages` y leerlo con el nombre del canal en
  `realtime.topic()`. Ana y Bea (el match) entran en los dos canales; Carla
  —perfil y cuenta propios, o sea exactamente el atacante— recibe `42501` en
  los cuatro intentos, igual que un `sessionId` inexistente, un topic sin UUID
  (`42501`, **no** `22P02`) y un topic ajeno. Aparte, la mitad de lectura: el
  mensaje que escribe Ana lo ve Bea y no lo ve Carla. Hay fixture nueva del
  esquema `realtime` (tabla, RLS, permisos y `realtime.topic()`), por el mismo
  motivo que ya había una de `auth`: sin ella la migración ni se ejecuta.
- [x] **La huella ve las políticas.** `supabase/schema-fingerprint.sql` solo
  miraba `public`, así que borrar estas políticas en el proyecto real habría
  dejado `Schema drift` en verde sobre el agujero. Nueva línea `rtpolicy`, y
  **solo para las políticas que empiezan por `lockin`**: las que Supabase pueda
  traer de fábrica dependen de la versión de Realtime desplegada, y compararlas
  pondría el job en rojo por algo que este repo ni pone ni puede quitar. De ahí
  el prefijo en los nombres de las dos políticas — no es decoración.
- [x] **`supabase/drift-check.mjs`** las lee de las migraciones y las **declara
  no comprobables** desde ahí, que es la regla de ese archivo. No asoman por
  PostgREST —el esquema `realtime` no está expuesto— y verificarlas de verdad
  exigiría abrir un canal privado por WebSocket, que es otro programa. Quien las
  coteja contra el despliegue es la huella; quien prueba que dicen lo que deben
  es el SQL embebido.

##### Controles negativos, ejecutados aquí

Ninguna de las tres comprobaciones se da por buena sin haberla visto fallar:

1. Política permisiva (`and true` en vez de la llamada al helper) →
   `# fail 1`, con `carla_video: 'dentro'` y `carla_presencia: 'dentro'` donde
   se esperaba `'42501'`.
2. Huella ciega (el filtro `like 'lockin%'` cambiado para no coincidir) →
   `# fail 1`, `AssertionError: la huella debe traer las dos políticas de
   realtime`.
3. `private: true` quitado de `presence.ts` → `Tests: 1 failed`, con
   `- "private": true` en el diff de Jest.

Y el control negativo *dentro* del test: se borra una de las dos políticas y se
comprueba que la huella cambia. Va suelto y **no** en la lista `mutations` de ese
archivo porque la guarda de `ci.yml` exige literalmente la línea `Rol lector, 5
mutaciones, teardown dos veces y guardia de sobrecarga: OK`, y
`.github/workflows/` es alcance de `calidad`.

##### Verificación (2026-09-17, en este entorno)

- `npm run test:schema` → `# tests 21`, `# pass 21`, `# fail 0`, `# skipped 0`,
  con las dos líneas de guarda impresas y `SQL ejecutado: 12 migraciones;
  digest 6b1bbe086c6a6f0512e9a5a741cafc71; 461 objetos`.
- `npm run typecheck` y `npm run lint`: limpios.
- `npx prettier --check` sobre los archivos tocados: limpio. (El `format:check`
  completo sigue siendo ruido CRLF en este equipo; el veredicto se lee del log
  de CI.)
- `npm test -- --ci --runInBand`: **2 fallos, y no son de aquí.** Los dos están
  en `src/data/provider.test.tsx`, archivo **sin commitear** de la orden `A1`
  (`arquitecto`), que estaba corriendo en paralelo en este mismo worktree.
  Excluyendo los dos archivos en vuelo de `A1`
  (`--testPathIgnorePatterns src/data/provider.test.tsx src/data/active.test.ts`):
  **63 suites pasando, 698 tests pasando, 0 fallos**, 82 saltados (contrato
  opt-in). Ni un solo archivo de `A1` tocado por esta orden.

##### Archivos fuera del alcance literal de la orden, y por qué

- `supabase/schema-compare.mjs` y `supabase/schema-compare.test.mjs`: el
  comparador valida la huella contra una lista blanca de prefijos de línea. Sin
  añadir `rtpolicy` ahí, la huella entera se declara inválida y el cotejo no
  llega a comparar nada. Es consecuencia obligada de tocar
  `schema-fingerprint.sql`, que sí está en el alcance.
- `supabase/cleanup.test.mjs`: monta su propia fixture y aplica **todas** las
  migraciones. Sin el mínimo de `realtime` ahí, la migración nueva mata ese test.
  Se le ha puesto lo justo (tabla + RLS + `realtime.topic()`); no prueba nada de
  Realtime, eso es del embebido.
- `src/data/supabase/video-signal.test.ts` y `presence.test.ts`: sus aserciones
  comparaban los argumentos exactos de `channel(...)`. Sin actualizarlas, el
  cambio de una línea no cumple el criterio de «sin regresiones».

##### Lo que NO se ha tocado

- `.github/workflows/`: es de `calidad`. La línea de guarda del job sigue
  diciendo «5 mutaciones» y sigue siendo cierta: se refiere a la lista
  `mutations` de `schema-embedded.test.mjs`, que no ha cambiado.
- `supabase/README.md`: no está en el alcance de la orden. **Para quien venga
  detrás**: su tabla de migraciones está tres filas por detrás del directorio —
  le faltan `20260915000200_match_streaks.sql`,
  `20260916000100_github_verification.sql` y
  `20260917000100_realtime_authorization.sql`.
- `src/data/provider.tsx` y `src/data/active.ts`: son de `A1`, que corría a la vez.

#### Pendiente del usuario — cerrado el 2026-09-18

Las dos cosas, hechas: **1.** `supabase/migrations/20260917000100_realtime_authorization.sql`
pegada en el SQL Editor de `grrzmzktrhksbttpbblg`. **2.** «Allow public access»
desactivado en Realtime → Settings — sin esto el flag `private: true` del
cliente no bastaba, porque el acceso público seguía dejando entrar a cualquiera
al margen de las políticas nuevas.

##### El rojo esperado de `Schema drift`, declarado por escrito

Esto es lo que la memoria del proyecto exige anotar. Partimos de que el remoto
estaba **al día**: la migración de verificación de GitHub (`20260916000100`) la
aplicó el usuario el 2026-09-16 y el run 35211856006 dejó `remote.diff` en «Sin
diferencias.». Desde ese punto, **todo rojo del job remoto es deriva real**.

Con este commit, el job `Comparar grrzmzktrhksbttpbblg (solo lectura)` se va a
poner **rojo a propósito**, y lo hará por estas líneas y solo por estas:

```
- func     public.is_session_topic_member(text) …
- grantfn  public.is_session_topic_member(text) authenticated EXECUTE
- grantfn  public.is_session_topic_member(text) postgres EXECUTE
- rtpolicy lockin: envías a los canales de tus sesiones cmd=INSERT …
- rtpolicy lockin: recibes de los canales de tus sesiones cmd=SELECT …
```

(Con `-`, es decir: están en las migraciones y **faltan** en el despliegue.)

**Así pasó.** El `run 35361097480` (workflow_dispatch, antes de que el usuario
aplicara esta migración) trajo el `remote.diff` exacto de arriba, y solo esas
cinco líneas — confirmado que era esta excepción y no deriva de otra cosa. Tras
aplicarla, el `run 35361939148` salió verde en local **y** remoto (`Sin
diferencias.`). **Excepción cerrada**: desde aquí, un rojo del job remoto vuelve
a leerse como deriva real.


### Orden `D2` — identidad real y recuperación de cuenta (Ola 2) — ENTREGADA 2026-09-17

- [x] **Hallazgo 1, el más grave del producto: las cuentas son irrecuperables por diseño.** Cada usuario es una sesión anónima o una cuenta sintética `device-…@lockin.app` cuya contraseña se genera en el dispositivo y vive en AsyncStorage (`src/data/supabase/auth.ts`). Desinstalar la app, limpiar el almacenamiento o cambiar de móvil deja el perfil, los matches y los chats huérfanos para siempre, sin ninguna vía de recuperación. `signInWithEmail` y `linkEmailToCurrentUser` existen y se reexportan en `src/data/supabase/index.ts`, pero **nada de `src/app/` los llama nunca** (verificado el 2026-09-17). Para un producto de matching esto destruye datos de usuario en silencio
  - La capa de datos ya está: falta la pantalla, que es la orden `P1` de `perfil`. Ver "Lo que le queda a `perfil`" abajo
- [x] Decidido y escrito **con el usuario** qué se le promete (2026-09-17). Las cuatro respuestas, que son ahora el contrato:
  1. **Vincular email es opcional siempre.** No hay pantalla de login obligatoria, ni recordatorio, ni puerta antes del primer chat. Se entra anónimo y se asciende la cuenta cuando al usuario le apetece, desde Perfil. El arranque sin fricción de `CONCEPTO.md` queda intacto
  2. **La cuenta solo es recuperable tras confirmar el correo.** `linkEmailToCurrentUser` no la salva: solo pide la confirmación. Hasta que el usuario pincha el enlace, `recoverable` sigue en `false` y la app no puede prometer nada. Es el estado `pending-email`
  3. **Si el email ya está en uso, error claro y sin salida.** Nada de ofrecer entrar en la otra cuenta: eso abandonaría el perfil, los matches y los chats de este dispositivo, y no es algo que se proponga de pasada en un mensaje de error
  4. **`signOut()` desde una cuenta sin email lanza**, salvo `signOut({ acceptDataLoss: true })`. El flag existe para que la pantalla tenga que haber avisado antes de pasarlo
- [x] `getAccountState()` nuevo en `src/data/supabase/auth.ts`: devuelve `{ kind, userId, email, pendingEmail, recoverable }` con `kind` en `'none' | 'anonymous' | 'device' | 'pending-email' | 'email'`. Pregunta al servidor con `getUser()` y no a la sesión guardada, porque la confirmación del email ocurre fuera de la app —en el cliente de correo— y el JWT de `AsyncStorage` sigue diciendo lo de antes. Si el servidor no contesta se cae a la sesión local: sin red la pantalla queda desactualizada, no en blanco
- [x] `AccountError` con `reason` tipado (`email-in-use`, `weak-password`, `invalid-email`, `same-password`, `too-many-emails`, `needs-confirmed-email`, `unrecoverable-account`, `no-session`, `offline`, `unknown`). Traduce los `code` de GoTrue una sola vez, para que `perfil` no tenga que hacer expresiones regulares sobre el texto inglés del servidor, que cambia entre versiones
- [x] `linkEmailToCurrentUser(email)` — **cambió de firma**: ya no acepta contraseña. GoTrue exige el email verificado antes de aceptar una contraseña en una cuenta anónima ([docs de Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)), así que el ascenso es de dos pasos. Nadie la consumía todavía, así que no rompe nada
- [x] `setAccountPassword(password)` — el segundo paso, ya con el email confirmado. Es también el que cierra una recuperación de contraseña
- [x] `sendPasswordReset(email)` — `resetPasswordForEmail` con `redirectTo` al `lockin://auth/callback` que ya usa el flujo de GitHub. No dice si el email existe: responder distinto sería contarle a cualquiera quién tiene cuenta en LockIn
- [x] `completeAuthLink(url)` — cierra el enlace que llega por `lockin://auth/callback`. Acepta las dos formas (`?code=` PKCE y `?token_hash=&type=`), traduce los enlaces caducados en vez de dejar al usuario esperando, y cuando la cuenta ya es recuperable borra `DEVICE_ACCOUNT_KEY`: seguir guardándolo dejaría una segunda puerta a la misma cuenta escrita en claro en el teléfono
- [x] `signOut({ acceptDataLoss })` — se niega si `recoverable` es `false`
- [x] Encabezado de `auth.ts` reescrito con el ciclo de vida completo (anónima/dispositivo → `pending-email` → `email`) y con lo que hace falta tocar en el dashboard. Antes describía el estado provisional como si fuera definitivo
- [x] Los nuevos exports salen por `src/data/supabase/index.ts`, tipos incluidos
- [x] Cobertura en `src/data/supabase/auth.test.ts`: 43 casos, uno por rama nueva. `npm run typecheck`, `npm run lint` y `npm test -- --ci --runInBand` (743 pasados, 82 saltados, 0 rojos) verdes el 2026-09-17

#### Falta que el usuario toque el dashboard de `grrzmzktrhksbttpbblg`

Sin esto, el estado `pending-email` no existe y la promesa "solo tras confirmar
el correo" es falsa:

1. **Authentication → Providers → Email → "Confirm email": ACTIVAR.** Ojo al
   efecto colateral: eso inutiliza el paso 3 de `auth.ts` (la cuenta de
   dispositivo con email sintético, que necesita justo lo contrario). Mientras
   "Anonymous sign-ins" siga activo el paso 3 no se ejecuta nunca, así que el
   coste real es cero — pero si algún día se apagan los anónimos, el arranque se
   queda sin red de seguridad y hay que replantearlo.
2. **Authentication → Providers → Email → "Secure email change": DESACTIVAR.**
   Con él, ascender una cuenta de dispositivo mandaría también una confirmación
   al buzón `device-…@lockin.app`, que no existe, y el ascenso no se completaría
   jamás.
3. **Authentication → URL Configuration → Redirect URLs:** añadir
   `lockin://auth/callback` si no está ya (lo usa el flujo de GitHub, así que es
   probable que sí).

#### Lo que le queda a `perfil` (orden `P1`, Ola 3)

La capa de datos no necesita nada más. `P1` consume esto y nada de `src/data/`
tiene que volver a tocarse:

- `getAccountState()` decide qué se enseña. `kind === 'anonymous' | 'device'` →
  el aviso de "tus datos viven solo en este teléfono" y el formulario de email.
  `kind === 'pending-email'` → "te hemos mandado un correo a `pendingEmail`,
  pínchalo"; **no** es el estado a salvo, no lo pintes como tal.
  `kind === 'email'` → enseña `email` y ofrece cerrar sesión.
- El ascenso son **dos pasos**, no uno: `linkEmailToCurrentUser(email)` primero
  y `setAccountPassword(password)` solo después de que el usuario vuelva del
  correo. Un formulario con email y contraseña juntos no funciona contra GoTrue.
- El enlace del correo lo tiene que recoger la app: un handler de deep link que
  llame a `completeAuthLink(url)` y repinte con el `AccountState` que devuelve.
  `src/data/` no puede registrar ese handler — es `src/app/`, o sea tuyo.
- Los errores vienen ya traducidos: `catch` → `error instanceof AccountError` →
  `error.reason`. Enseña `error.message`, que está escrito en español y para el
  usuario. Nada de mirar el texto del servidor.
- Cerrar sesión desde `recoverable === false` lanza `reason:
  'unrecoverable-account'`. Si el copy decide ofrecerlo igualmente, hay que pasar
  `signOut({ acceptDataLoss: true })` **después** de una confirmación explícita,
  no antes.
- Vincular GitHub (`linkGithubIdentity`) **no** hace la cuenta recuperable y
  `AccountState` no lo cuenta como tal: en LockIn es el distintivo de
  verificación y la app no ofrece "entrar con GitHub". No lo presentes como una
  vía de recuperación.
- El copy que manda `P1`: no es "crear cuenta" ni "registrarse". La cuenta ya
  existe; esto es **asegurarla**.

### Orden `D3` — consultas sin paginar y reloj del dispositivo (Ola 3) — ENTREGADA 2026-09-18

Sin etiqueta: bloqueada por las olas 1 y 2, y **nunca a la vez que `D2`**. Se
comprobó antes de lanzarla que no hay trabajo sin fusionar de `D2` en este
worktree (`git status` limpio, `git log` con `D2`/`C1`/`P1` ya en el historial).

- [x] **Hallazgo 6a: `matches.list()` no pagina.** Trae todos los matches de la cuenta sin límite (`src/data/supabase/index.ts:434`: sin `where`, apoyándose solo en que la política «matches: solo los tuyos» acota la lectura)
- [x] **Hallazgo 6b: las vistas previas del último mensaje son una heurística.** Se reconstruyen en el cliente trayendo los `RECENT_MESSAGES_WINDOW = 200` mensajes más recientes y agrupándolos (`index.ts:74-79`, `386`). El propio comentario lo admite: «correcto salvo que alguien tenga más de 200»
- [x] **Hallazgo 6c: `getDeck` encoge las páginas.** El RPC `discovery_deck` pagina a 50 filas en SQL y **después** `excludeIds` se aplica en JS (`index.ts:324-325`), así que el tamaño de página varía de forma impredecible según lo que ya hayas swipeado
- [x] **Hallazgo 6d: `sessions.getActive` usa el reloj del dispositivo.** `src/data/supabase/sessions.ts:136` decide si una sesión está viva con `Date.now()`, cuando `serverNow()` existe en la interfaz (`src/data/repositories.ts:182`) precisamente porque ese reloj no es de fiar. El comentario de al lado dice que se acepta «donde no importa» — hay que releerlo y decidir si aquí importa, que es justo donde se decide si alguien entra o no a su sesión

#### Cómo quedó (2026-09-18)

Los cuatro, en `supabase/migrations/20260918000100_deck_exclude_last_messages_active_session.sql`
(migración nueva; ninguna de las aplicadas se reescribe):

- **6a — `matches.list()` paginado por dentro, sin cambiar su firma.** `MatchRepository.list()` la consumen `chat` (`use-matches.ts`) y `sesiones` (`session-reminder-sync.tsx`), y las dos esperan la lista completa — no un cursor —, así que **no** se tocó la firma del contrato (la orden pedía parar y avisar si hiciera falta; no hizo falta). El riesgo real no era "trae demasiado": es que un `select('*')` sin `range()` se apoya en el tope de fila por defecto de PostgREST (`max-rows`, 1000 en un proyecto nuevo de Supabase) y **lo supera en silencio** — no falla, corta la respuesta. `fetchAllPages()` (nueva, en `index.ts`) pide en vueltas de 500 con `range()` y `order('id')` hasta que una vuelta vuelve corta, así que ninguna cuenta con más matches que el tope pierde los de más allá. `resolveMatches()` sigue ordenando el resultado por actividad reciente; el `order('id')` de la paginación es solo para que las vueltas no se salten ni repitan filas.
- **6b — `last_messages_for_matches(p_match_ids)`, RPC nuevo.** `distinct on (match_id)` en SQL, que PostgREST no expone directamente. Sustituye la ventana de 200 mensajes agrupada en el cliente: exacto para cualquier historial, no solo "salvo que alguien tenga más de 200 mensajes por delante". `SECURITY INVOKER` (el valor por defecto, sin declararlo aparte): la política `messages: lees los de tus matches` ya limita las filas a los matches de quien llama, así que pasar el id de un match ajeno en `p_match_ids` simplemente no devuelve nada para ese id — RLS, no un chequeo aparte en la función.
- **6c — `excludeIds` bajado al `where` de `discovery_deck`.** Parámetro nuevo `p_exclude_ids uuid[] default null`, **añadido al final** de la firma (no reordena `p_mode`/`p_specialties`/`p_limit`), así que `create or replace function` conserva la identidad de la función y cualquier llamada vieja sin este argumento sigue funcionando. Antes `getDeck` traía la página de 50 y **después** quitaba `excludeIds` en JS, así que la página encogía de forma impredecible; ahora la exclusión entra en el mismo `where` que el resto de filtros, antes del `limit`, así que la página siempre sale completa. Cubierto en `schema-embedded.test.mjs` con el caso que distingue las dos versiones: `p_limit=2` con el primer candidato excluido devuelve **dos** filas, no una.
- **6d — `active_session(p_match_id)`, RPC nuevo.** Resuelve "viva" con el `now()` de Postgres (`session_is_live`, ya existía desde `20260913000100`), no con `Date.now()` del teléfono. Mismo patrón defensivo que `ratable_session`: `SECURITY DEFINER` con `is_match_member(p_match_id)` explícito en el `where`, aunque la política de `lockin_sessions` ya acota la lectura — es el estilo que ya sigue el resto del archivo, y aquí importa de verdad: un teléfono desfasado ya no puede abrir o cerrar la ventana de la sesión antes de tiempo.
- **Fixture de la suite embebida ampliada.** Cubrir 6b (SECURITY INVOKER puro) expuso que `schema-embedded.test.mjs` nunca había ejercitado una política RLS que llama a `auth.uid()` directamente bajo el rol `authenticated` sin pasar antes por una función `SECURITY DEFINER` que ya eleva el privilegio — las que sí lo hacían (el resto del archivo) siempre pasaban por una. La fixture de `auth` no concedía `usage on schema auth` ni `execute on function auth.uid()` a `authenticated`, algo que Supabase da por hecho fuera de cualquier migración (el esquema `auth` lo gestiona la plataforma). Añadidos los dos grants en la fixture, con el motivo escrito ahí mismo — no es una migración nueva, es solo que la fixture mentía por omisión en una ruta que hasta ahora nadie había tomado.

##### Verificación (2026-09-18)

- `npm run test:schema` → `# tests 21`, `# pass 21`, `# fail 0`, con `SQL
  ejecutado: 13 migraciones; digest f684f00c2a79143420b8c8e6a32b453b; 470
  objetos`. Los tres RPC nuevos, cubiertos dentro de la misma prueba
  embebida: `discovery_deck` con y sin `p_exclude_ids` (incluida la
  distinción de página que antes se encogía), `last_messages_for_matches`
  con un match ajeno en la consulta que RLS deja fuera (verificado también
  que **sin** el rol `authenticated` de verdad el test daba falso verde —
  se detectó al escribirlo, no se asumió), y `active_session` con una
  sesión rechazada (no cuenta como viva) y una sesión viva de un match
  ajeno que `is_match_member` bloquea a quien no es parte.
- `npm run typecheck`, `npm run lint`: limpios.
- `npm test -- --ci --runInBand`: **788 pasados, 71 suites** (82 saltados,
  la suite de contrato remota, opt-in), 0 fallos. `getActive` en
  `src/data/supabase/sessions.test.ts` reescrito: ya no simula la
  liviandad en el cliente (ese comportamiento lo cubre ahora
  `schema-embedded.test.mjs` contra Postgres de verdad), solo que el
  repositorio llama al RPC con el `matchId` correcto y traduce la fila
  (o su ausencia).
- `node supabase/drift-check.mjs` no se ejecutó contra el proyecto remoto
  (necesita `grrzmzktrhksbttpbblg` real); su parser es genérico sobre
  `create or replace function` y `drift-check.test.mjs` sigue en verde, así
  que recoge los tres RPC nuevos sin cambios propios.

##### Pendiente del usuario — cerrado el 2026-09-18

Migración `20260918000100_deck_exclude_last_messages_active_session.sql`
pegada en el SQL Editor de `grrzmzktrhksbttpbblg`, en el mismo lote que la
de `D1`. `Schema drift` verde en local y remoto
([run 35361939148](https://github.com/thejowe/lockin/actions/runs/35361939148)),
así que `getDeck`, `matches.list()` y `sessions.getActive` ya pueden
desplegarse contra Supabase real sin el riesgo de `PGRST202`.

**Con esto, los 7 hallazgos del saneamiento de arquitectura del
2026-09-17 quedan cerrados** — el último en pie era este `D3`.

### Orden `D4` — los dos rojos del CI sobre `34df7e9` (Ola 3) — ENTREGADA 2026-09-19

El run [35362453548](https://github.com/thejowe/lockin/actions/runs/35362453548)
dejó dos jobs en rojo, los dos de este bloque. Ninguno de los dos era una
regresión de `D3`.

#### Job «Formato»: dos archivos, no uno

- [x] `src/data/supabase/auth.test.ts` (lo dejó `D2`) — una sola expresión, tres líneas
- [x] `supabase/schema-embedded.test.mjs` (lo dejó `D3`) — dos expresiones, siete líneas

El aviso de la orden decía «solo ese archivo», pero el log del job listaba
**dos**: `Code style issues found in 2 files`. Arreglar solo el primero habría
dejado el job igual de rojo. Ninguno de los dos se ve desde aquí con
`npm run format:check` —el ruido de CRLF de Windows tapa los dos de verdad entre
~100 falsos—, así que se comprobaron copiando cada archivo con finales LF a un
directorio temporal y pasándole `prettier --check` con el `.prettierrc` del
repo: exactamente lo que hace el runner de Linux. `core.autocrlf=true` y el blob
de git guarda LF, así que esa copia es byte a byte lo que ve el CI.

#### Job «Contrato Supabase»: ni la política ni `D3`. Es una carrera del test

- [x] Descartada la sospecha 1 (`private: true` de `D1` + políticas de `realtime.messages`)
- [x] Descartada la sospecha 2 (`active_session()` y `sessions.ts` de `D3`)
- [x] Causa real encontrada y medida
- [x] Arreglada donde estaba, sin tocar la política ni `private: true`

**La política no tiene nada que ver, y no se ha relajado ni un milímetro.** El
canal del caso que fallaba es `lockin:sessions:<matchId>`, que es
`postgres_changes` y es **público**: las políticas de
`20260917000100_realtime_authorization.sql` filtran por
`extension in ('broadcast', 'presence')` y Realtime solo las evalúa en canales
**privados**. Por eso `presence.ts` y `video-signal.ts` llevan `private: true` y
este no. El candado del hallazgo 2 sigue entero.

##### Cómo se descartaron las dos sospechas

Aquí no hay Docker, así que el diagnóstico se hizo con ramas desechables
—creadas con `read-tree`/`commit-tree` sobre un `GIT_INDEX_FILE` temporal, sin
un solo `git add` en el worktree compartido— y `workflow_dispatch` sobre
`contract.yml`:

| Rama | Qué lleva | Resultado |
|---|---|---|
| `datos-diag-sin-d3` (`d63c139`) | `D1` sí, `D3` no | [35436179475](https://github.com/thejowe/lockin/actions/runs/35436179475) **verde** |
| `datos-diag-sin-realtime-auth` | `D3` sí, migración de `D1` fuera | [35436180772](https://github.com/thejowe/lockin/actions/runs/35436180772) **verde** |
| `datos-diag-tal-cual-a` (`34df7e9` intacto) | las dos | [35436373530](https://github.com/thejowe/lockin/actions/runs/35436373530) **verde** |
| `datos-diag-tal-cual-b` (`34df7e9` intacto) | las dos | [35436375506](https://github.com/thejowe/lockin/actions/runs/35436375506) **verde** |

El commit rojo, sin tocarle nada, pasa. Es intermitente: no es ninguna de las
dos sospechas.

##### La causa, cronometrada

Una quinta rama instrumentó `sessions.ts` para imprimir el instante del
`SUBSCRIBED` de cada canal y el del insert. El
[run 35436601088](https://github.com/thejowe/lockin/actions/runs/35436601088)
—verde— dejó esto:

```
[diag] repo#16 join 34370247-… -> SUBSCRIBED @1789812683306
[diag] repo#1  propose 34370247-… insertado  @1789812683308
```

**Dos milisegundos.** `repo#16` es la otra persona; `repo#1`, quien propone.

`subscribe()` vuelve antes de que el servidor haya registrado la suscripción, y
`postgres_changes` **no reemite nada**: entrega solo lo que ocurre después de
ese registro. El caso hacía **un** cambio y luego esperaba 10 s. Si el cambio
cae dentro de esa ventana, el aviso no se pierde «con retraso»: no existe, y
esperar más no sirve de nada. El `mineListener` siempre pasaba porque `changed()`
avisa en local sin tocar el cable; el que se quedaba a cero era el de la otra
persona. Eso es exactamente el `10099 ms` del run rojo.

##### Qué se cambió, y qué NO

Arreglado en `src/data/repositories.contract.ts`: el caso **repite el cambio**
hasta que la otra persona lo ve (`propose` → comprobar 2 s → `cancel` → repetir,
con tope de 30 s) en vez de hacerlo una vez y esperar. Reintentar el cambio, y
no solo la comprobación, quita la carrera **sin rebajar lo que demuestra**: el
aviso sigue teniendo que llegar por el cable, porque `theirs` no escribe nada.

Ese archivo está fuera del alcance que traía la orden (`src/data/supabase/`,
`supabase/`), aunque tampoco en la lista de lo prohibido. Se tocó porque el
defecto está literalmente ahí y no hay ningún otro sitio desde el que
arreglarlo. Queda anotado a propósito.

**Vía descartada, y por qué.** El primer intento fue arreglarlo en producción:
avisar una vez al llegar el `SUBSCRIBED` (`resyncOnJoin`), en los tres canales.
Cierra la ventana de verdad, pero rompe otro caso del contrato —
`messages › avisa solo a los suscriptores de ese hilo`, que exige **exactamente
un** aviso por `send` ([run 35437206224](https://github.com/thejowe/lockin/actions/runs/35437206224):
`Expected 1, Received 2`). Esa cuenta exacta es lo que protege la lógica de
marcas de escritura propia (`emittedLocally`), y vale más que el parche.
Aplicarlo solo al canal de sesiones habría puesto el job en verde dejando que el
caso pasara aunque realtime estuviera roto del todo, que es peor que un job rojo.
Revertido entero.

##### Lo que queda abierto (hallazgo nuevo, para otra orden)

Diagnosticando salió un agujero de producto que **no** se ha arreglado aquí,
porque excede la orden y no se puede verificar de punta a punta desde este job:

- **Hallazgo 8: al reconectar, la app pierde en silencio todo lo ocurrido
  mientras estuvo desconectada.** Los tres canales (`lockin:matches`,
  `lockin:messages:<matchId>`, `lockin:sessions:<matchId>`) son
  `postgres_changes`, que no reemite: tras una caída de red, el `phx_join` nuevo
  no trae nada de lo perdido y la pantalla se queda con el dato viejo hasta el
  siguiente cambio. La misma ventana existe, más corta, entre `subscribe()` y el
  primer `SUBSCRIBED`. El arreglo natural es releer al reengancharse, pero tiene
  que distinguir el **reenganche** del primer `join` — si avisa también en el
  primero, choca con la cuenta exacta del caso de `messages` (ver arriba).

##### Verificación (2026-09-19)

- **Job «Contrato Supabase»**, rama `datos-fix-carrera`:
  [run 35437524543](https://github.com/thejowe/lockin/actions/runs/35437524543)
  **verde** — `23 skipped, 59 passed, 82 total`, `numFailedTests: 0`. Los 23
  saltos son los declarados en `contract.yml`; el caso que fallaba ya no salta,
  pasa.
- **Job «Formato»**: los tres archivos tocados, copiados con finales LF y
  pasados por `prettier --check` con el `.prettierrc` del repo → limpios. El
  veredicto del runner, en el CI de la rama.
- `npm run test:schema` → `pass 21`, `fail 0`.
- `npm run typecheck`, `npm run lint`: limpios.
- `npm test -- --ci --runInBand` → **795 pasados**, 82 saltados, 0 fallos, 71
  suites.
