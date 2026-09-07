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

- [ ] **`schema-fingerprint.sql` sigue sin ejecutarse.** El lado del repo exige
      levantar la base local con Docker y en esta máquina no hay ni Docker ni
      `psql`; con media huella no se compara nada, así que no se ejecutó tampoco
      el lado remoto. Su sintaxis sí está verificada contra la gramática real de
      PostgreSQL (libpg_query, vía `pgsql-parser`), igual que la de
      `dev-teardown.sql` y las cinco migraciones. Pendiente de una máquina con
      Docker.

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

## Deuda anotada
- `initialsFrom()` está duplicada en `src/data/mock/store.ts` y `src/data/supabase/mappers.ts`. Es lógica de dominio compartida, pero subirla a `src/data/` es territorio de `arquitecto`. Si divergen, el avatar de un mismo perfil cambia al conectar Supabase.
- `MatchRepository.list()` resuelve el último mensaje de cada conversación con una ventana de los 200 mensajes más recientes (PostgREST no expone `distinct on`). El orden de la lista nunca se ve afectado — lo da `matches.last_message_at` —, solo la previsualización de un match muy antiguo.
