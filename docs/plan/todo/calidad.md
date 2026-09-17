# TODO — calidad

## CI en rojo desde `db763db`: al lock le faltaban `@emnapi/core` y `@emnapi/runtime` (2026-09-16)

CI llevaba tres commits en rojo —`db763db`, `0c124b9`, `d7b2581`— y el rojo
no era de nadie en particular: `npm ci` fallaba, o sea que **caían los siete
trabajos a la vez**, y con ellos `E2E Android`. Último verde antes del corte:
[run 35011460081](https://github.com/thejowe/lockin/actions/runs/35011460081) (`dc7343c`).

- [x] **La causa, leída del log y no adivinada.** En
  [run 35111658929](https://github.com/thejowe/lockin/actions/runs/35111658929) (`d7b2581`), paso `npm ci`:

  ```
  npm error code EUSAGE
  npm error `npm ci` can only install packages when your package.json and
  package-lock.json or npm-shrinkwrap.json are in sync.
  npm error Missing: @emnapi/core@1.11.3 from lock file
  npm error Missing: @emnapi/runtime@1.11.3 from lock file
  npm error Invalid: lock file's @emnapi/wasi-threads@1.2.1 does not satisfy @emnapi/wasi-threads@1.2.3
  npm error Missing: @emnapi/core@1.10.0 from lock file
  npm error Missing: @emnapi/runtime@1.10.0 from lock file
  ```

  Quien las pide es `@unrs/resolver-binding-wasm32-wasi` (vía `unrs-resolver`,
  que arrastra `eslint-import-resolver-typescript`): las declara como
  **dependencias directas y exactas**, `@emnapi/core@1.10.0` y
  `@emnapi/runtime@1.10.0`, y el lock tenía `@emnapi/wasi-threads` pero no esas
  dos. El segundo par (1.11.3) sale de resolver los `peerDependencies`
  `^1.7.1 || ^2.0.0-alpha.4` de `@napi-rs/wasm-runtime` contra el registro. Es
  el **árbol resuelto** el que estaba incompleto, no un rango mal puesto: por
  eso `package.json` no se toca.

- [x] **Lock regenerado desde cero**, no parcheado a mano:
  `rm -rf node_modules package-lock.json && npm install`. El diff es
  auditable y pequeño —136 líneas añadidas, 89 quitadas— y se comprobó entrada
  a entrada antes de commitear:
  - **+2 paquetes, −0**. `diff` de la lista de claves `node_modules/*` entre el
    lock viejo y el nuevo: aparecen `@emnapi/core` y `@emnapi/runtime`, y no
    desaparece ninguno. 1174 → 1176 entradas.
  - **Las 17 entradas `"linux"` siguen ahí**, las mismas que antes. Era el
    riesgo real de regenerar en Windows —que npm se dejara fuera los binarios
    opcionales del otro sistema y el lock solo sirviera aquí— y no ocurrió;
    npm guarda el árbol completo con sus campos `os`/`cpu`/`libc`.
  - El resto del diff son **metadatos que recalcula npm 11**: marcas `peer` que
    entran y salen, y campos `libc: [glibc|musl]` nuevos en los binarios de
    Linux. Más dos transitivas al día (`@expo-google-fonts/material-symbols`
    0.4.47 → 0.4.48, `brace-expansion` 5.0.9 → 5.0.12) y `@types/node`
    26.5.1 → 22.20.3 con su `undici-types` (ninguna de las dos está declarada
    en `package.json`: son resoluciones transitivas, y la de `@types/node`
    queda además alineada con el Node 22 de CI).
  - `git diff package.json` **vacío**, comprobado antes del commit.

- [x] **Trabajo `Formato` en rojo, tapado por el anterior.** Con `npm ci`
  arreglado, CI llegó por primera vez desde `db763db` a ejecutar los trabajos
  de verdad, y ahí salió lo que el fallo de instalación escondía: 8 archivos
  del bloque `video` que nunca habían pasado por Prettier —`jest.setup.js`,
  `src/data/video-signal.ts`, `src/data/supabase/video-signal.test.ts`,
  `src/features/session/use-video-call.ts` y `.test.ts`, y las tres vistas
  `video-call-view.tsx` / `.web.tsx` / `.test.tsx`—. `prettier --write` sobre
  esos ocho y nada más; el diff entero son saltos de línea en props JSX y
  argumentos que pasaban de 100 columnas, ni una expresión cambia.

  **Es un cruce de alcance** (`src/features/session/` es de `video`), con el
  precedente de la décima pasada: el trabajo `Formato` es de este bloque y su
  rojo se arregla aquí.

  Por qué no se vio en local antes de empujar: en esta máquina
  `npm run format:check` avisa de **104 archivos** por el checkout con CRLF
  (`core.autocrlf=true`), el mismo ruido ya documentado en pasadas anteriores,
  y esos 8 se pierden dentro. Con el nombre de los archivos delante,
  `npx prettier --check` sobre la lista exacta sí da señal limpia. **Regla para
  la próxima**: cuando `format:check` local avise en masa, el veredicto se lee
  del log de CI, no de aquí.

### Qué queda abierto: `E2E Android` se cae en Gradle por Metaspace

No lo arregla esta pasada y no es del lock, pero sale de ella: con `npm ci`
otra vez en pie, `E2E Android` llegó por fin a compilar —primera vez desde
`dc7343c`— y se cayó antes de arrancar Maestro.
[run 35116867137](https://github.com/thejowe/lockin/actions/runs/35116867137), variante `mock`,
`BUILD FAILED in 13m` con `app:assembleRelease` en ✗:

```
Execution failed for task ':react-native-async-storage_async-storage:lintVitalAnalyzeRelease'.
> A failure occurred while executing com.android.build.gradle.internal.lint.AndroidLintWorkAction
   > Metaspace
```

Es agotamiento de Metaspace de la JVM dentro de Android Lint, no una aserción
del recorrido ni un fallo del emulador: el triage no llegó a correr y la
variante `supabase` quedó cancelada por el fail-fast de la matriz. `e2e.yml` no
fija memoria para Gradle en ninguna parte —solo `gradle/actions/setup-gradle@v6`
en la línea 64—, y el árbol nativo acaba de crecer con `react-native-webrtc`
del bloque `video`, que es el cambio que hace que el mismo `lintVital` que antes
cabía ahora no quepa.

Dos salidas, las dos dentro de `e2e.yml` y por tanto de este bloque, pendientes
de decidir con el run delante: subir `org.gradle.jvmargs` con un
`-XX:MaxMetaspaceSize` explícito, o saltarse `lintVitalRelease` en el build de
E2E (lo que comprueba ese lint no es lo que este workflow viene a comprobar).

### Verificación de esta pasada

- **`npm ci` sobre árbol limpio**: 1139 paquetes, sin `EUSAGE`.
- `npm run lint` y `npx tsc --noEmit` — limpios.
- `npm run test:coverage -- --ci` — **642 tests en 60 suites** (1 suite y 72
  casos omitidos por su opt-in), verde con **92.57 / 85.26 / 91.59 / 94.45**
  sobre el suelo 89.82/82.56/91.49/91.38 de `jest.config.js`. El suelo no se
  toca.
- `npm run format:check` — los 8 archivos tocados salen limpios uno a uno; el
  comando completo sigue avisando en masa por el CRLF de esta máquina, también
  sin estos cambios.
- **El criterio de terminado no es ninguna de las líneas de arriba, sino el
  run**: [run 35116428974](https://github.com/thejowe/lockin/actions/runs/35116428974)
  sobre `77f9b61`, **CI entero en verde** — Lint, Formato, Tipos, Tests, Runner
  E2E, SQL embebido y Export web, los siete. Es el primer verde desde
  `dc7343c`.
- El commit intermedio `977e67d` (solo el lock) ya dejó
  [run 35114296282](https://github.com/thejowe/lockin/actions/runs/35114296282)
  con los siete `npm ci` pasados y 6/7 trabajos verdes: ahí se separó lo que
  arreglaba el lock de lo que no, antes de tocar el formato.

## El SQL embebido entra en CI: PGlite como devDependency (2026-09-15)

Deuda que dejó anotada `valoracion` en `docs/plan/todo/valoracion.md` →
"Deuda detectada, fuera del alcance de este bloque":
`supabase/schema-embedded.test.mjs` no lo corría ningún workflow, y es la única
cobertura ejecutable del **comportamiento** de los RPC —`rate_session`,
`ratable_session`, `session_rating_window_is_open`, `session_both_attended` y
`session_is_live`—. Los casos de contrato que los prueban se saltan contra
cualquier backend real (necesitan una sesión ya terminada y `propose_session`
exige 5 minutos de margen), y lo que cubre `schema-drift.yml` es la *forma* del
esquema: `schema-ci.mjs local` aplica las migraciones a una Supabase desechable
y compara la huella, que dice qué objetos existen, no qué hacen.

- [x] **Por qué PGlite estaba fuera del árbol: no había razón técnica.** Se
  buscó el motivo antes de meterlo como dependencia. `supabase/README.md`
  (línea 467) lo presenta como "verificación parcial reproducible sin Docker" y
  explica la instalación en un directorio temporal, sin desaconsejar nada;
  `docs/plan/todo/datos.md` lo anota como "instalado en
  `%TEMP%/lockin-schema-validation`, **sin cambiar dependencias del repo**"; y
  la cabecera del propio test decía "instalado fuera del repo; **sin cambios en
  package.json/package-lock.json**". Las tres dicen lo mismo: `package.json` es
  alcance de `calidad` y `datos`/`sesiones` no podían tocarlo (regla de oro de
  `PLAN.md`). Es una frontera de reparto de archivos, no una propiedad del
  paquete. Comprobado además que el paquete no trae contraindicaciones: **cero
  dependencias transitivas**, **ningún script de instalación** (`npm view
  @electric-sql/pglite@0.3.14 scripts --json` → sin `preinstall`, `install`,
  `postinstall` ni `prepare`) y 20 MB desempaquetados sobre los 745 MB que ya
  ocupa `node_modules`, un 2,7 % más en cada `npm ci`. Así que dependencia de
  desarrollo y script npm, que es lo natural.
- [x] **`@electric-sql/pglite` 0.3.14 en `devDependencies`**, con versión exacta
  (como `@types/jest`) y no un rango: esa versión es la que fijan el README y
  los TODO de `datos`, y una menor nueva cambiaría el Postgres embebido bajo los
  pies de la huella. El lock queda con su integridad
  (`sha512-3DB258dhqdsArOI1fIt7cb9RpUOgcDg5hXWVgVHAeqVQ/qxtFy605QKs4gx6mFq3jWsSPqDN8TgSEsqC3OfV9Q==`,
  la misma que publica el registro), que es lo que `npm ci` verifica y lo que la
  instalación a mano no daba. `npm ci --dry-run` sin error: lock y
  `package.json` en sincronía.
- [x] **`npm run test:schema`** = `node --test supabase/schema-compare.test.mjs
  supabase/schema-embedded.test.mjs`. Con lista explícita y no con el glob
  `supabase/*.test.mjs` por dos motivos: el glob arrastraría
  `supabase/cleanup.test.mjs`, que sigue saltándose sin `PGLITE_MODULE` (ver
  "Lo que queda"), y `node --test` sale en **verde** cuando un patrón no casa
  con nada. Entra también el comparador porque el test embebido importa
  `compareFingerprints` de él; `schema-drift.yml` lo seguirá corriendo por su
  cuenta, son 0,2 s.
- [x] **`skip` retirado de `supabase/schema-embedded.test.mjs`** (único cambio
  en ese archivo, junto con la cabecera; **no se tocó ni una aserción** —
  `git diff -w` son 20 líneas, el resto del diff es reindentado de Prettier al
  pasar el test de tres argumentos a dos). El módulo se resuelve ahora así:
  `PGLITE_MODULE` si está —sigue admitido, para no invalidar el README de
  `datos`— y si no, `@electric-sql/pglite` del árbol. Sin `skip` porque con el
  paquete en `npm ci` que falte ya no es "no lo tengo instalado" sino un
  entorno a medias, y un salto silencioso dejaría el job verde sin ejecutar una
  línea de SQL.
- [x] **Job `schema` ("SQL embebido") en `ci.yml`**, no en `schema-drift.yml`.
  Las dos razones, escritas también en el propio YAML: (a) cuesta **2,5 s**
  sobre un `npm ci` que CI ya paga y cachea, así que no hay nada que aligerar
  llevándolo a otro ritmo; `schema-drift.yml`, en cambio, no corre `npm ci`
  —desactiva hasta el caché de npm a propósito— y habría que instalarle 745 MB
  de árbol o volver a una instalación suelta sin lock. (b) El trabajo `remote`
  de `schema-drift.yml` está **en rojo** mientras el usuario no aplique
  `20260915000100_session_ratings.sql`, y ese rojo es el esperado: meter ahí la
  única cobertura de los RPC sería esconder un rojo nuevo detrás de uno viejo.
  De paso, `ci.yml` corre también en `pull_request` y `schema-drift.yml` solo en
  `push`.
- [x] **Guarda contra el job que pasa sin ejecutar nada.** Medido, no supuesto:
  `node --test supabase/schema-compare.test.mjs supabase/nope.test.mjs` sale con
  **exit 0** e ignora en silencio el archivo que no existe (con la lista entera
  inexistente sí falla, pero basta con que uno exista para que se lo trague).
  Así que el paso no se fía del código de salida: pasa la salida por `tee` y
  exige la última línea que imprime el test —`Rol lector, 4 mutaciones, teardown
  dos veces y guardia de sobrecarga: OK`—, que solo se escribe si el cuerpo
  llegó al final. Es independiente del reporter y del nombre del archivo.

### Verificación (2026-09-15, en este entorno)

- `npm run test:schema` → `# tests 9`, `# pass 9`, `# fail 0`, `# skipped 0`,
  2,5 s. Log del embebido: `SQL ejecutado: 9 migraciones; digest
  8cb04a016337d90f08607538bad9b748; 280 objetos` — el mismo digest que anotó
  `valoracion` en su Tarea 3.
- **El paso del workflow, literal**: extraído del YAML ya parseado
  (`yaml.safe_load(...)['jobs']['schema']['steps'][-1]['run']`) y ejecutado tal
  cual con `RUNNER_TEMP` puesto → exit 0, con la línea de la guarda en el log.
  Los cuatro workflows parsean (`ci.yml` → `quality`, `build`, `schema`).
- **Controles negativos, los tres en rojo:**
  1. Archivo renombrado en la lista (`schema-embedded-RENOMBRADO.test.mjs`):
     `node --test` da `# pass 8`, `# skipped 0` y exit 0 — y la guarda corta con
     `El SQL embebido no llegó a ejecutarse entero`, exit 1. Sin guarda, ese
     caso habría sido un verde vacío.
  2. Sin PGlite (`node_modules/@electric-sql` apartado): `not ok 9 …
     code: 'ERR_MODULE_NOT_FOUND'`, `# fail 1`, exit 1. Con el `skip` de antes
     habría sido `# skipped 1` y exit 0.
  3. **Regla de SQL rota a propósito**: en
     `supabase/migrations/20260915000100_session_ratings.sql`, la guarda de
     estado de `rate_session` (`if v_session.status <> 'aceptada' then`) puesta
     a `if false then` → `# fail 1` con `expected: cancelada: 'LI004'` /
     `actual: cancelada: 'sin error'`. Migración restaurada a continuación
     (`git status` limpio para `supabase/migrations/`) y verde otra vez.
- De paso, y sin romper nada: `npm run lint`, `npm run format:check`,
  `npm run typecheck` limpios; `npm test -- --ci` con **563 pasando**, 63
  saltados (contrato opt-in) y 53 suites; `npm run test:e2e` 58/58; y
  `npx expo export --platform web` en verde, que es lo que comprueba que la
  dependencia nueva no entra en el bundle ni molesta a Metro.

### Lo que queda

- [x] **Verlo verde en Actions.** Duplicado de la casilla siguiente, que ya
  lo cierra: `CI` sobre `890dc16`,
  [run 34992782667](https://github.com/thejowe/lockin/actions/runs/34992782667).
- [x] **Verde en Actions**, que es lo que faltaba para dar el job por bueno:
  `CI` sobre `890dc16`,
  [run 34992782667](https://github.com/thejowe/lockin/actions/runs/34992782667),
  con los siete jobs en verde — `SQL embebido` incluido, o sea que la guarda del
  `grep` no se disparó y el SQL se ejecutó entero en el runner, no solo aquí.
  En el mismo commit, `E2E Android`
  ([run 34992782434](https://github.com/thejowe/lockin/actions/runs/34992782434))
  con sus dos variantes en verde, y `Schema drift`
  ([run 34992782362](https://github.com/thejowe/lockin/actions/runs/34992782362))
  con el job local en verde y solo el remoto en rojo, que es el esperado
  mientras la migración de `valoracion` no esté aplicada en el proyecto real.
- [x] ~~**`supabase/cleanup.test.mjs` sigue sin correr en ningún sitio.**~~
  **Hecho por `datos` el 2026-09-15** (`25bf903`), que era de quien eran esos
  archivos. Antes de moverlo comprobó que correrlo en cada push es seguro pese
  a que toca SQL destructivo: base en memoria nueva por pasada, sin red ni
  `.env`, y el `delete from auth.users` muere con el proceso. Entró en
  `test:schema`, que pasa a 10 tests y 0 saltos. Detalle en `todo/datos.md`.
- [x] ~~**`supabase/README.md` (línea 467) se ha quedado corto.**~~ Hecho en el
  mismo commit: abre con `npm ci` + `npm run test:schema` y mantiene el camino
  manual con `PGLITE_MODULE`, que sigue siendo válido.
- [x] **Agujero que destapó ese cambio, y que sí era de aquí** (`6e860ce`): con
  `test:schema` corriendo dos archivos, la guarda del job solo exigía la línea
  final del embebido, así que borrar o renombrar `cleanup.test.mjs` habría
  dejado el job verde sin ejecutarlo — el mismo fallo que la guarda existe para
  evitar. Ahora exige una línea por archivo. Verificado ejecutando el paso tal
  cual (las dos pasan) y quitando del log la del limpiador (la guarda corta).
  `CI` verde sobre `6e860ce` con los siete jobs.

## La lista blanca de `contract.yml` se había quedado corta (2026-09-15)

- [x] Encontrado al revisar los workflows para lo de arriba, y arreglado aquí
  porque `.github/workflows/` es alcance de este bloque. El paso "Suite de
  contrato" exige con `jq` que no haya saltos inesperados, con una lista de tres
  títulos: son los `itWithTimeTravel` de `repositories.contract.ts`, que contra
  Supabase local se saltan siempre (`canTimeTravel: false` → `it.skip`). La
  pieza `valoracion` añadió **nueve** casos de ese tipo el 2026-09-15 y la lista
  no se movió, así que la siguiente ejecución a mano de `Contrato Supabase`
  habría caído en `La suite no corrió entera` sin que nada estuviera roto —el
  peor tipo de rojo, el que enseña a ignorar el workflow—. No se ha notado antes
  porque ese workflow es solo `workflow_dispatch`.
  **Arreglo:** los nueve títulos añadidos a la lista, que es justo lo que pide
  el comentario del propio paso ("Un caso nuevo de ese tipo obliga a añadirlo a
  esta lista a propósito"), con la razón al lado: necesitan una sesión ya
  terminada y su SQL lo ejecuta ahora el job `SQL embebido` de `ci.yml`.
  **Verificación sin Docker**, que es lo que hay aquí: se extrajo el programa
  `jq` del YAML ya parseado y se corrió contra un `contract-result.json`
  sintético con las 12 pendientes reales (sacadas del propio
  `repositories.contract.ts`) más un caso pasado. Con la lista de tres →
  `false`, exit 1 (el rojo que habría salido). Con la lista de doce → `true`,
  exit 0. Y sigue cortando lo que tiene que cortar: una pendiente no declarada
  → `false`, exit 1; `numPassedTests = 0` → `false`, exit 1.
  Queda **sin comprobar en un runner**: el workflow necesita Docker y Supabase
  CLI, y se lanza a mano.

## E2E Android rojo en setup-android: Google retiró `tools` (2026-09-14)

- [x] Los dos jobs de `e2e.yml` caían antes de compilar, en
  `android-actions/setup-android@v4`:
  `Warning: Failed to find package 'tools'` y
  `sdkmanager failed with exit code 1`. Runs rojos: 34893680768 (6c6a8f8,
  intentos 1 y 2), 34895140288 (f7e9e37) y 34895721643 (994df44).
  **Causa, confirmada y no supuesta:** entre el último verde (34891490592,
  914ebf7) y el primer rojo no cambió nada propio. Misma SHA de la acción
  (`40fd30fb`), misma imagen del runner (`ubuntu-24.04` 20260907.300.1), mismo
  cmdline-tools 20.0 y mismas entradas. La acción instala por defecto
  `packages: 'tools platform-tools'` (`action.yml`), y `src/main.ts` llama a
  `sdkmanager <pkg>` por cada paquete. `repository2-3.xml` y `-4.xml` de
  `dl.google.com` ya no publican `path="tools"` (el SDK Tools 26, obsoleto);
  sí siguen `platform-tools` y `emulator`. El cambio vino del repositorio de
  Google.
  **Arreglo** (`26be92e`): `packages: 'platform-tools'` en el paso. Antes se
  comprobó que nada necesita `tools`: `e2e/run.mjs` solo llama a `adb`, y
  `android-emulator-runner` (a421e43) instala por su cuenta build-tools,
  platform-tools, platform, emulator e imagen del sistema.
  **Verificación:** el run de la rama compartida (34897134446) lo canceló
  `cancel-in-progress` por un push de otro bloque (`ef50681`). Relanzarlo
  habría cancelado el run ajeno, así que se subió `26be92e` sin cambios a la
  rama desechable `ci/e2e-setup-android-tools`, ya borrada. Run **34897503004**
  (https://github.com/thejowe/lockin/actions/runs/34897503004): mock y
  supabase en `success`, setup-android en verde, el recorrido pasó al primer
  emulador (reintento `skipped`) y `gate` en `success`. Duración: 19 min 55 s
  (mock) y 21 min 33 s (supabase).

## Acciones sobre Node 24 (2026-09-13)

- [x] Acciones de GitHub Actions actualizadas fuera de Node 20 — verificado en
  la rama desechable `ci/acciones-node24` sobre `a072cc1`, ya borrada.
  Versiones: checkout v7, setup-node v7, setup-java v6, upload-artifact v7,
  download-artifact v8, setup-android v4, setup-gradle v6 y setup-cli v3.
  android-emulator-runner sigue en v2 (v2.38.0). Revisadas las notas de cada
  salto mayor con `gh release list/view` y las últimas versiones con `gh api`.
  Gradle usa `cache-disabled: true`: Expo genera sus archivos después y fuera
  del checkout, así que el proveedor básico no tiene archivos que hashear;
  tampoco se carga el proveedor propietario predeterminado de v6.
  Android fija cmdline-tools 20.0; Supabase conserva la CLI
  2.116.0, comprobada en npm. El ZIP `schema-local` se descarga por nombre en
  la misma ruta, con error si no coincide el hash. Schema drift desactiva el
  caché automático de npm. El Node 22 del proyecto y Java 17 no cambian.
  `diagnose()` lee cada volcado con `readCommandDump`: devuelve null ante error
  de lectura o JSON truncado y `parseCommandFailures` lo trata como evidencia
  vacía. Test explícito para null y objeto: **35/35**; `npm run lint` verde.
  Primera verificación E2E: run **34787201307**, rojo en setup-gradle por la
  ausencia de archivos para la clave del caché básico. Diagnosticado con
  `gh run view --log-failed` y los artefactos descargados antes de corregirlo;
  no fue una caída de emulador ni se relanzó a ciegas.
  Verificación final sobre `a072cc1`, los tres workflows en verde:
  CI run **34787322427** (6/6 jobs), E2E Android run **34787322395** (mock y
  supabase) y Schema drift run **34787322436**, con el job remoto ejecutado y
  no `skipped`. Ningún job tiene anotaciones, así que ya no aparecen los avisos
  de Node 20 ni de acciones deprecadas. Sin caché de Gradle, el E2E tarda
  19 min 44 s (mock) y 23 min 59 s (supabase). Los 8 runs verdes anteriores,
  con caché, tardaron entre 16 y 23 min: coste comparable, en la parte alta del
  rango.

## Triage de commands.json (2026-09-13)

- [x] Triage E2E: device offline en commands.json clasificado como runner
  `parseCommandFailures` recoge los mensajes de comandos `FAILED`; `diagnose()`
  los une al informe JUnit para reconocer `device offline` aunque este solo
  diga `Unknown error` y adb ya vuelva a responder. Se mantiene la prioridad
  de `CASE_SIGNATURES` y la lista cerrada: las aserciones y los errores
  desconocidos siguen siendo del caso. Los dos mensajes del control negativo
  muestran ahora el número de paso empezando en 1.
  Verificado: `node --test e2e/triage.test.mjs` **34/34** y `npm run lint` verde.
  `npm run format:check` falla en **37 archivos fuera del alcance**, ninguno de
  los tres `.mjs` modificados. En los tres archivos comprobados como muestra
  (`e2e/full-journey.test.mjs`, `e2e/full-journey.yaml`, `eslint.config.js`),
  normalizar CRLF a LF en memoria basta para pasar Prettier. No se modifican.
  No se ejecutó el emulador ni se corrigieron los fallos conocidos por CRLF
  de `npm run test:e2e`.

> **Estado actual: decimocuarta pasada (2026-09-11).** **El workflow E2E Android está verde en la rama principal, dos veces seguidas y al primer intento**: [run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963) sobre `b863e5f` y [run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422) sobre `74897b4`. Con esa evidencia se cierran las tres casillas de "recorrido completo verde" que quedaban abiertas (sexta, séptima y novena pasada). No queda ninguna casilla abierta en este TODO. Detalle en "Decimocuarta pasada", justo debajo. Lo de más abajo es el historial de las pasadas anteriores.

> **Tercera pasada (histórico).** La primera dejó el repo con
> lint, formato, tipos, CI y 102 tests. La segunda cubrió el bloque `chat` y el
> gesto del deck y puso suelo de cobertura (154 tests). Esta cierra el último
> hueco del bloque `chat`: `icebreakers.ts` — las reglas que eligen el primer
> mensaje, que estaban a 0 % — y sus tres componentes presentacionales. 207 tests
> en 13 suites. Lo que queda abierto está al final, en "Pendiente".

## Base
- [x] ESLint + Prettier configurados y sin errores (`npm run lint`)
- [x] `tsc --noEmit` limpio

## Tests
- [x] Jest + React Native Testing Library instalados y configurados
- [x] Test de la lógica de matching mock
- [x] Test de al menos una pantalla crítica (formulario de perfil o deck de swipe)

## CI
- [x] Workflow de GitHub Actions: lint + test + `expo export` en cada push/PR

## Accesibilidad
- [x] Labels en todos los inputs de formularios
- [x] Contraste de color verificado con los tokens del tema
- [x] Tamaño táctil mínimo (44×44) en botones interactivos

---

## Qué quedó montado

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint (config de Expo, sin las reglas que chocan con Prettier) |
| `npm run format` / `format:check` | Prettier sobre el código; `:check` es el que corre en CI |
| `npm run typecheck` | `tsc --noEmit`, tests incluidos |
| `npm test` / `test:watch` / `test:coverage` | Jest; `test:coverage` es el que corre en CI, porque es el que aplica el suelo de cobertura |

### Configuración
- `.prettierrc` — `printWidth: 100`, comillas simples, `bracketSameLine: true`.
  Lo último es para respetar el estilo que ya tenían los cuatro bloques: sin eso,
  el formateo movía el `>` de cierre de 34 archivos ajenos sin cambiar nada.
- `.prettierignore` — deja fuera la prosa (`*.md`, `docs/`, `.claude/`) y
  `package-lock.json`. Reformatear tablas y listas de Markdown ensucia el diff
  sin mejorar nada, y el lock lo escribe npm.
- `eslint.config.js` — añade `eslint-config-prettier` (apaga las reglas de estilo:
  el formato lo decide Prettier, no el linter) y los globals de Jest en los tests.
- `jest.config.js` — preset `jest-expo`, alias `@/`, stub de CSS (`test/style-stub.js`,
  porque `theme.ts` importa `global.css` para web) y la lista de paquetes ESM a
  transpilar. Además:
  - `resolver: 'react-native-worklets/jest/resolver.js'`. Sin él, cualquier test
    que importe un módulo con Reanimated muere en `Cannot read properties of
    undefined (reading 'loadUnpackers')`: Worklets resuelve su `.native.ts`, que
    busca el TurboModule real. El resolver oficial de Worklets descarta esa
    extensión. Los tests anteriores no lo notaban porque ninguno llegaba a
    importar Reanimated de verdad.
  - `standard-navigation` en `transformIgnorePatterns`: lo trae `expo-router` en
    ESM sin transpilar, y entra en cuanto un test toca una pantalla que importa
    `ExternalLink`.
  - `coverageThreshold` global: 55 % de sentencias, líneas y funciones, 47 % de
    ramas.
- `jest.setup.js` — mocks de `react-native-reanimated`, `react-native-gesture-handler`
  y `expo-font`, más los matchers de accesibilidad de RNTL (`toBeSelected`,
  `toHaveAccessibleName`…).
- `tsconfig.json` — `types: ["jest", "node"]`. Sin eso, `tsc` no ve `describe`/`expect`
  y el typecheck de los tests falla.

### Tests — 207, en 13 archivos

| Archivo | Qué cubre |
|---|---|
| `src/data/mock/store.test.ts` | `initialsFrom`, `matchesMode`, `resolveMatchMode` — las funciones puras que deciden a quién ves y bajo qué modo nace un match |
| `src/data/mock/index.test.ts` | El repositorio entero: filtrado del deck por modo/especialidad/decidido, reciprocidad, orden de matches por actividad, aislamiento de hilos, suscripciones, alta y edición de perfil |
| `src/features/discover/use-deck.test.tsx` | El estado del deck: descarte optimista, match, devolución de la tarjeta si el guardado falla, cambio de modo, `refresh` |
| `src/features/profile/profile-form.test.tsx` | Validación, normalización del `ProfileInput`, precarga al editar, error de guardado, y que todo control pulsable tenga nombre accesible |
| `src/constants/theme.test.ts` | Ratio WCAG de cada par de tokens que la app usa de verdad, en claro y oscuro |
| `src/features/chat/format.test.ts` | Las fechas del chat: cada rama de `formatRelative` con sus bordes (el minuto exacto, la hora exacta, "ayer a las 23:55" que son 15 minutos), `formatDayHeading` y `isSameDayIso` |
| `src/features/chat/use-matches.test.tsx` | La lista de matches: carga, resolución del perfil del otro lado, un match nuevo entrando sin remontar, el reordenado al llegar un mensaje, error de lectura y baja de la suscripción al desmontar |
| `src/features/chat/use-conversation.test.tsx` | La conversación: las tres lecturas, el envío recortado, el vacío que no llega al repositorio, el fallo expuesto en `sendError` y limpiado al reintentar, y la baja de la suscripción |
| `src/features/discover/swipe-deck.test.tsx` | El gesto: umbral de desplazamiento, flick corto pero rápido, arrastre insuficiente que no decide, los botones como camino equivalente, y que el deck nunca pinte más de tres tarjetas |
| `src/features/chat/icebreakers.test.ts` | Las nueve reglas que proponen el primer mensaje: cada una con su caso que dispara y su caso que calla, el orden en que compiten por las tres plazas, y el recorte |
| `src/features/chat/match-row.test.tsx` | La fila de la lista: el prefijo "Tú:", la pista cuando no hay mensajes, la marca de nuevo, qué fecha manda, y el nombre accesible del destino |
| `src/features/chat/message-bubble.test.tsx` | La burbuja: cuerpo, hora, y de qué lado cae según `isMine` — que es lo único suyo que se puede romper sin que se note |
| `src/features/chat/message-composer.test.tsx` | `canSend`: vacío, solo espacios y envío en vuelo bloquean el botón; con texto envía una vez. Más el `ref` que la pantalla usa para devolver el foco |

`src/data/test-fixtures.ts` es la fábrica de `Profile`/`ProfileInput` para los
tests: si `Profile` gana un campo obligatorio, se añade ahí una vez y no en cada
test. No lo importes desde código de producción.

**Cómo se dispara el gesto del deck.** `swipe-deck.tsx` marca su `Gesture.Pan`
con `.withTestId(PAN_TEST_ID)`; el test lo recupera con `getByGestureTestId` y le
inyecta eventos con `fireGestureHandler`, ambos de
`react-native-gesture-handler/jest-utils`. Es la vía oficial para la API nueva de
gestos — el `jestSetup` que carga `jest.setup.js` solo evita que el módulo nativo
reviente, no permite emitir eventos. Dos detalles que cuestan una tarde:

- La secuencia necesita un evento **sin `state`** entre el `ACTIVE` y el `END`.
  El que estrena `ACTIVE` abre el gesto; los que vienen después son los que
  llegan a `onUpdate`, que es donde el componente guarda el desplazamiento que
  juzga al soltar. Sin ese evento intermedio, el gesto se cierra con la tarjeta
  todavía en el centro y ningún swipe decide nunca.
- Las tarjetas de detrás llevan `aria-hidden`, así que hay que buscarlas con
  `{ includeHiddenElements: true }` o RNTL no las ve.

**Cómo se prueban los componentes presentacionales de `chat`.** No tienen estado
propio, así que el test ataca lo único que sí pueden romper en silencio:

- `match-row.test.tsx` **mockea `expo-router`** con un `Link` que solo devuelve a
  su hijo. Montar el router entero aquí no aporta nada y arrastra contexto de
  navegación que la fila no usa. Lo que sí se comprueba es el nombre accesible,
  que es lo que anuncia a dónde lleva.
- `message-bubble.test.tsx` lee la alineación de la fila exterior con
  `StyleSheet.flatten(screen.toJSON().props.style)`. Es la única forma de aseverar
  de qué lado cae la burbuja: si `isMine` deja de decidirla, la conversación queda
  ilegible aunque todos los textos estén bien y ningún test de texto se entere.
- Las fechas relativas se construyen con `Date.now()` menos N minutos en vez de
  fijarlas: `formatRelative` mide contra el ahora real, y clavar una fecha
  obligaría a congelar el reloj para nada.

**Ojo con los mocks de repositorio.** `createMockRepositories()` devuelve siempre
los mismos objetos de módulo, así que un `jest.spyOn` sobre `repositories.messages`
sobrevive al test que lo puso. Los tests de `chat` llaman a `jest.restoreAllMocks()`
en `afterEach`; si añades otro que espíe un repositorio, haz lo mismo.

**Ojo con RNTL 14:** `render`, `fireEvent`, `renderHook` y `rerender` son
**asíncronos**. Sin `await`, el árbol no llega a montarse y las queries fallan con
`` `render` function has not been called ``.

### CI — `.github/workflows/ci.yml`
Cinco trabajos en paralelo sobre `npm ci` y Node 22: lint, formato, tipos, tests
y `expo export --platform web`. Sin `fail-fast`: un lint roto no debe ocultar un
test roto. `concurrency` cancela la ejecución anterior de la misma rama.

### Accesibilidad
- **Labels.** Los nueve `TextInput` del formulario de perfil y el del chat ya
  traían `accessibilityLabel`. Añadido un test que lo guarda: recorre los
  controles con rol `button`/`radio`/`checkbox` del formulario y exige que todos
  tengan nombre accesible.
- **Contraste.** `src/constants/theme.test.ts` mide los 21 pares de tokens que la
  app usa. 17 cumplen AA en claro y oscuro. Los 4 que no (`textMuted` sobre las
  dos superficies y `border` sobre las dos) están reportados en
  `docs/plan/todo/arquitecto.md` con los números medidos, porque el arreglo es una
  decisión de paleta y no de una pantalla. El test fija el ratio actual como
  suelo: no exige el arreglo, pero impide que empeore en silencio.
- **Tamaño táctil.** Cuatro controles se quedaban por debajo de 44 px de alto.
  Arreglados con `hitSlop`, que agranda el área de toque sin tocar el diseño:
  `features/profile/controls.tsx` (chip, 36 px), `features/discover/mode-filter.tsx`
  (chip de filtro, 32 px), `features/chat/icebreaker-suggestions.tsx` (sugerencia,
  36 px) y `components/app-tabs.web.tsx` (pastilla de tab, 28 px). El resto ya
  cumplía.

### Cobertura
`coverageThreshold` global en `jest.config.js`, y CI pasa a `npm run test:coverage`
para que se aplique. Los números son un **suelo unos puntos por debajo de la
cobertura real de hoy** (61,2 % de sentencias, 53,0 % de ramas), no un objetivo:
sirven para que un PR no pueda borrar tests ni meter un bloque grande sin tocarlos.
Se suben cuando la cobertura suba; no se bajan para dejar pasar un cambio. En esta
pasada subieron de 50/42/50/50 a 55/47/55/55.

Dónde está hoy: la capa de datos y `data/mock` al 100 %, `features/chat` al 86 %
(con `icebreakers.ts`, `message-bubble.tsx`, `match-row.tsx`, `use-matches.ts` y
`use-conversation.ts` al 100 %), `swipe-deck.tsx` al 94 %, `profile-form.tsx` al
92 %. Lo que arrastra la media hacia abajo son las rutas de `app/` (0 %),
`src/data/supabase/` (6 %, porque sus tests no se pueden ejecutar todavía — ver
"Pendiente") y los componentes presentacionales que quedan en `chat` y `discover`
(`conversation-intro`, `lock-in-cta`, `matches-empty`, `deck-empty`,
`match-modal`, `mode-filter`), que casi no tienen lógica que guardar.

## Cambios en archivos de otros bloques
- **Formato.** Prettier tocó 13 archivos de `arquitecto`, `perfil`, `descubrir` y
  `chat`. Son cambios de formato puros — ninguna línea cambia de significado.
- **`hitSlop`.** Los cuatro controles de arriba. Una prop añadida cada uno, sin
  tocar estilos ni lógica.
- **`src/features/discover/swipe-deck.tsx`.** Añadido `.withTestId(PAN_TEST_ID)`
  al `Gesture.Pan` y exportada esa constante. Es la única forma de alcanzar el
  gesto desde un test; no cambia el comportamiento, igual que un `testID` en una
  vista.
- **`src/components/ui/collapsible.tsx`.** Borrado. Era andamio del scaffold de
  Expo y no lo importaba nadie. Con él se va el único uso de `expo-symbols`: la
  dependencia sigue en `package.json`, y quitarla es decisión de `arquitecto` —
  anotado en su TODO.
- **`src/constants/theme.ts`.** `brassSoft` claro pasa de `#F0E3C9` a `#F2E5CB`:
  el chip de marca seleccionado estaba en 4.44:1, a un pelo de AA. Es el mismo
  color a ojo y no toca ninguno de los cinco literales de marca de `CONCEPTO.md`.
  Anotado también en el TODO de `arquitecto`.

La tercera pasada **no tocó ningún archivo de otro bloque**: los cuatro tests
nuevos leen los componentes por su API pública y por sus etiquetas accesibles, sin
necesitar un `testID` ni un export extra.

## Verificación hecha (2026-09-06, tercera pasada)
- `npm run lint` — 0 errores, 0 avisos.
- `npm run typecheck` — limpio.
- `npm run format:check` — todo formateado.
- `npm run test:coverage` — 207 tests en 13 suites, todos en verde, umbral nuevo
  (55/47/55/55) cumplido.
- `npx expo export --platform web` — 14 rutas generadas sin errores.

## Pendiente
- [x] Tests del bloque `chat` (`use-conversation`, `use-matches`, `format.ts` con
      sus fechas relativas). Era el hueco de cobertura más grande que quedaba.
- [x] Test de la pantalla de swipe (`swipe-deck.tsx`), gesto incluido.
- [x] Umbral de cobertura en `jest.config.js`, con CI corriendo `test:coverage`.
- [x] Retirado `src/components/ui/collapsible.tsx`, andamio del scaffold.
- [x] Tests de la parte presentacional de `chat` (`match-row`, `message-bubble`,
      `message-composer`, `icebreakers.ts`). `icebreakers.ts` estaba a 0 % y era el
      que más lo pedía: los cuatro quedan al 100 % de sentencias.
- [x] **Delegado a `datos`, y ya hecho por otra vía.** La casilla estaba abierta
      esperando a poder reutilizar `src/data/mock/index.test.ts` contra Supabase,
      bloqueada por la configuración de Auth del proyecto (con *Anonymous
      sign-ins* cerrado, `auth.ts` no abría sesión y ninguna consulta llegaba a
      correr). Desde el commit b1472a6 ese interruptor está activo y el contrato
      se ejecuta de verdad: `src/data/supabase/contract.test.ts` pasa **25/25**
      contra el proyecto real, opt-in y fuera de `npm test` y de CI. No se
      reutilizó el test del mock tal cual —tres de sus casos describen mecánica
      interna del mock (`CURRENT_USER_ID`, `resetState`, `setProfileId`) y no son
      trasladables—, pero el contrato que importaba está cubierto. El trabajo
      queda en `datos`; `calidad` vuelve al suelo de cobertura, que ya no lo
      arrastra `src/data/supabase/`.

## Siguiente hueco de cobertura
Lo que queda sin tocar y sí tiene algo que guardar, por orden:
1. ~~`src/data/supabase/mappers.ts` (0 %)~~ — **ya no aplica**: existe
   `src/data/supabase/mappers.test.ts` y el archivo está al 90 % de sentencias.
   Lo escribió `datos`, que es dueño de esa carpeta.
2. [x] Los componentes presentacionales que quedan de `discover` (`mode-filter`,
   `match-modal`, `deck-empty`) y de `chat` (`icebreaker-suggestions`,
   `conversation-intro`, `lock-in-cta`).
3. [x] Las rutas de `app/` (0 %). Es lo más caro y lo que menos lógica tiene.

## Cuarta pasada: deuda menor (2026-09-06)

Trabajo aislado en el worktree ../lockin-codex-calidad, rama codex/calidad,
partiendo de c546476 de claude/startup-cofounder-matching-app-tfeai1.
Los apartados anteriores conservan el historial de las primeras pasadas.

- [x] Quitar expo-symbols como dependencia directa y actualizar el lockfile.
- [x] Revisar @expo/ui, expo-glass-effect, expo-device, expo-linking y expo-constants.
- [x] Ignorar supabase/.temp/ generado por el CLI.
- [x] Medir la cobertura real y subir coverageThreshold sin cambiar las exclusiones.
- [x] Verificar instalación, lint, formato, tipos, tests con cobertura y export web.

Se conservan expo-linking y expo-constants: son peers obligatorios de
expo-router 57.0.19. @expo/ui, expo-glass-effect y expo-symbols son dependencias
propias de ese router; quitar sus declaraciones directas no elimina sus
entradas transitivas del lockfile. expo-device no tiene consumidores en la app
ni en el árbol de dependencias del lockfile.

### Resultado y verificación de la cuarta pasada

- Retiradas de package.json las dependencias directas expo-symbols, @expo/ui,
  expo-glass-effect y expo-device. npm actualizó el lockfile sin actualizar
  versiones ajenas; desaparecen expo-device y su dependencia ua-parser-js.
- expo-linking y expo-constants se conservan como peers obligatorios. Los otros
  tres módulos siguen instalados de forma transitiva por expo-router, verificado
  con npm ls y con las dependencies/peerDependencies del paquete 57.0.19.
- /supabase/.temp/ queda ignorado; no se borra su contenido.
- coverageThreshold pasa de 65/53/64/65 a **69.29/57.57/68.09/69.47**
  (sentencias/ramas/funciones/líneas), exactamente los porcentajes medidos por
  Jest. No se cambian collectCoverageFrom, las exclusiones ni los tests.
- Ajuste de configuración necesario en checkout limpio: tsconfig.json declara
  expo/types junto a jest y node. Sin ello tsc daba TS2882 al importar el CSS,
  porque expo-env.d.ts está ignorado y solo existía en la carpeta original.
  Los tipos oficiales de Expo ya declaran CSS; no se añade un stub propio.

Comprobaciones sobre una instalación nueva en el worktree, sin compartir
node_modules ni copiar variables de Supabase:

- npm uninstall desde node_modules inexistente instaló el árbol actualizado.
- npm run lint: limpio.
- npm run typecheck: limpio con expo/types, sin necesitar expo-env.d.ts.
- npm run test:coverage -- --ci --runInBand: **222 tests en 14 suites pasan**;
  25 tests de contrato remoto omitidos por su opt-in. Cobertura: 650/938
  sentencias, 327/568 ramas, 222/326 funciones y 569/819 líneas. Los nuevos
  mínimos pasan. La primera ejecución, concurrente con export/lint/tipos y con
  caché fría, agotó 5 s en un test de ProfileForm; la repetición completa aislada
  pasó sin cambiar timeouts ni tests (48.8 s).
- npx expo export --platform web: correcto, **14 rutas estáticas** generadas.
- npm run format:check -- --end-of-line auto: limpio. El comando sin override
  señala CRLF en 95 archivos debido al core.autocrlf=true local, mientras el
  repositorio exige LF. Se formatearon solo package.json, jest.config.js y
  tsconfig.json; no se reescribieron archivos de producto para resolver una
  conversión local de Git.
- git diff --check: limpio.

No se modifica src/data/supabase/ ni supabase/seed.sql, ni se ejecuta la suite
contra el proyecto Supabase real. Su verificación continúa en el bloque datos.
Se consultó la documentación exacta del SDK antes de editar:
https://docs.expo.dev/versions/v57.0.0/.

## Quinta pasada: presentacionales que faltaban y rutas de `app/` (2026-09-06)

Cierra los puntos 2 y 3 de "Siguiente hueco de cobertura". Solo se escriben
tests: no se ha tocado el código de producto de `discover` ni de `chat`.

- [x] Presentacionales de `discover`: `mode-filter`, `deck-empty`, `match-modal`.
- [x] Presentacionales de `chat`: `icebreaker-suggestions`, `conversation-intro`,
      `lock-in-cta`.
- [x] Las siete rutas de `app/`: `index`, `(onboarding)/mode`,
      `(onboarding)/profile-form`, `(tabs)/discover`, `(tabs)/matches`,
      `(tabs)/profile` y `chat/[matchId]`.
- [x] Los tres `_layout.tsx` (raíz, `(onboarding)` y `(tabs)`).
- [x] Subido `coverageThreshold` a la cobertura medida.

### Dónde viven los tests de ruta, y por qué no en `src/app/`

`src/app/` es la raíz de `expo-router`: **todo** `.tsx` que cuelga de ahí entra
en el bundle como ruta, así que un `discover.test.tsx` colocado al lado de
`discover.tsx` arrastraría `@testing-library/react-native` a la app. Los tests de
ruta viven por eso en `test/app/`, con `testMatch` de `jest.config.js` ampliado a
`test/**`. Comprobado: `npx expo export --platform web` sigue generando las
mismas **14 rutas** que antes de esta pasada.

`test/routes.tsx` es el andamiaje común: el mock de `expo-router` (con espías de
`push`/`replace` y el destino de cada `<Redirect>`), los repositorios mock, y un
`renderRoute` que envuelve en `DataProvider` y `SafeAreaProvider` — sin el
segundo, `useSafeAreaInsets` del chat lanza "No safe area value available".
`resetRepositories()` llama a `jest.restoreAllMocks()` a propósito:
`createMockRepositories()` devuelve siempre los mismos objetos de módulo, así que
un `jest.spyOn` sobre un repositorio sobrevive al test siguiente si no se deshace.

El test del chat se llama `matchId.test.tsx`, sin corchetes: `[matchId]` es
sintaxis de ruta de `expo-router`, no de Jest, y un patrón `-t` sobre ella no
encuentra nada.

### Qué se prueba, y qué no

Los presentacionales se leen por su API pública y por sus etiquetas accesibles
(rol `radio` y `accessibilityState.selected` en el filtro, la pista "Escribe esta
frase…" en los icebreakers, el `expanded` del CTA de Lock-In). En las rutas se
prueban las decisiones que **no** viven en sus hooks: a dónde redirige `index`,
que `mode` guarde antes de navegar, que `profile` cierre la edición **y** relea
al guardar, que `discover` conserve el deck cuando falla guardar una decisión, y
que el chat deje de ofrecer icebreakers en cuanto hay un mensaje.

Dos dobles a propósito: `SwipeDeck` en el test de `discover` (su gesto ya está
probado en `swipe-deck.test.tsx` y montarlo arrastraría Reanimated) y
`ProfileForm` en los de `profile` y `profile-form` (ya tiene sus tests en
`perfil`; aquí solo importa cuándo se monta y qué se hace con lo que envía).

**Sin cubrir, y por qué:** el tirar-para-refrescar de `(tabs)/matches`. El
`RefreshControl` no es alcanzable desde RNTL sin ponerle un `testID` a la
`FlatList`, y esta pasada no toca código de producto. Su `refresh` ya está al
100 % en `use-matches.test.tsx`. Es la línea 30 que aparece descubierta en
`matches.tsx`.

### Cobertura

`coverageThreshold` pasa de **69.29/57.57/68.09/69.47** a
**87.52/78.87/87.73/88.76** (sentencias/ramas/funciones/líneas), que son los
porcentajes exactos medidos por Jest, no un número redondo. Sigue la misma regla:
se suben cuando la cobertura suba, no se bajan ni se excluyen archivos para dejar
pasar un cambio.

Todo `app/` queda al 100 % salvo `(tabs)/matches.tsx` (87,5 %, la línea del
`RefreshControl`), `(onboarding)/mode.tsx` (94,4 %) y `chat/[matchId].tsx`
(96,5 %). `features/chat` sube a 99,5 % y `features/discover` a 97,5 %.

Parte de la subida no es de esta pasada: `src/data/supabase/` va del 6 % al
24,7 % gracias a `mappers.test.ts`, que es trabajo de `datos`.

### Verificación hecha (2026-09-06, quinta pasada)

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check --end-of-line auto` sobre los archivos nuevos — limpio.
- `npm run test:coverage -- --ci --runInBand` — **307 tests en 28 suites** pasan
  (25 del contrato remoto omitidos por su opt-in) y el umbral nuevo se cumple.
- `npx expo export --platform web` — 14 rutas, las mismas de antes.

Aviso conocido, no es un fallo: el test de `(tabs)/matches` deja un `act(...)`
warning de `VirtualizedList`, que viene de un `setTimeout` interno de
`FlatList`. Y con caché fría el primer `render` de `test/app/layouts.test.tsx`
tarda ~6 s (0,6 s en caliente), lo bastante cerca del timeout de 5 s de Jest para
haber fallado una vez en una ejecución concurrente con `expo export`. No se tocan
timeouts —misma decisión que en la cuarta pasada con `ProfileForm`—, pero queda
anotado por si reaparece en CI.

## Siguiente hueco de cobertura (tras la quinta pasada)

Lo que queda a 0 % ya no es de este bloque, así que va como aviso:

1. `src/components/screen-placeholder.tsx` y `src/components/themed-view.tsx`
   están a 0 % y **no los importa nadie**. Es el mismo caso que
   `components/ui/collapsible.tsx`, que se retiró en la tercera pasada: andamio
   del scaffold de Expo. Borrarlos es decisión de `arquitecto` — no se tocan aquí
   con otra sesión trabajando en paralelo.
2. `src/components/app-tabs.tsx` y `app-tabs.web.tsx` (0 %). Son configuración
   declarativa de `NativeTabs`; probarlos cuesta más de lo que protege.
3. `src/data/supabase/auth.ts` (3 %) y `client.ts` (33 %). Alcance de `datos`:
   solo se ejercitan contra el proyecto real, y ese contrato es opt-in.
4. `src/hooks/use-color-scheme.ts` y `.web.ts` (0 %). Un re-export y un
   equivalente para web; alcance de `arquitecto`.

## Sexta pasada: E2E Android (2026-09-06)

Worktree `../lockin-codex-calidad`, actualizado con `git fetch` y
`git reset --hard 4cce6e0` como se pidió. Se conserva el historial anterior.

- [x] Evaluar herramienta: Maestro, sin instrumentar componentes/hooks ni repositorios.
- [x] Escribir registro anónimo → perfil → deck → match → mensaje en
      `e2e/full-journey.yaml`, con parada del proceso, relanzamiento y recuperación
      del perfil y mensaje por la UI.
- [x] Aviso contra falsos positivos del mock en el propio caso: mismo catálogo,
      backend elegido por credenciales; el reinicio y las lecturas de Postgres
      son obligatorios.
- [x] Runner local aislado con migraciones y seed reales, fixture de likes
      entrantes y verificación de las filas creadas por la UI.
- [x] Evaluar emulador en GitHub Actions y preparar workflow **activo** en
      push/PR/manual: Ubuntu 24.04 + KVM + API 36, APK release, Supabase local,
      artefactos de Maestro/logcat y parada del backend incluso al fallar.
- [x] Documentar comandos, requisitos, aislamiento, fuentes y limitaciones en
      `e2e/README.md`.
- [x] Ejecutar el workflow en Actions y revisar su primer resultado real
      (build, KVM, emulador y Maestro conduciendo la app: ver séptima pasada).
- [x] Montar el control negativo con APK sin credenciales: variante del runner,
      oráculo invertido y matriz en el workflow.
- [x] Confirmar primer recorrido completo verde en emulador y guardar su
      evidencia. **Cerrada el 2026-09-11** con el
      [run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963) (`b863e5f`, rama principal):
      `supabase` da `1/1 Flow Passed in 2m 56s`, los 63 comandos del recorrido
      en `COMPLETED` y `verify.mjs:27` —la comparación que capitalizaba el
      teclado— en verde. Confirmada por el
      [run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422) (`74897b4`). Evidencia en la
      decimocuarta pasada.
- [x] Confirmar que el control negativo falla **después** del reinicio.
      Cerrado en 696408a, ver novena pasada: el APK con mock llega al reinicio,
      falla allí y no escribe nada.

### Alcance y viabilidad

No se toca `src/components/`, `src/hooks/`, `src/data/`, `supabase/` ni
`docs/plan/TODO.md`. La fixture E2E copia los SQL del repo a una base
desechable; solo simula los likes de la otra parte. El perfil propio, la decisión,
el match y el mensaje se generan al interactuar con la app. La comprobación
administrativa posterior es de solo lectura y nunca entra en el bundle.

GitHub Actions sí admite este emulador mediante KVM. No se desactiva el workflow
ni se necesitan secretos: Auth/Postgres/REST/Realtime corren localmente en Docker.
No se ha ejecutado Actions desde esta sesión: falta subir/integrar la rama y
revisar el primer resultado. El host de trabajo carece de Android SDK, Java,
Maestro y Docker; `node e2e/run.mjs prepare` se ha intentado y termina en
`spawnSync docker ENOENT`. No se presenta YAML válido como prueba E2E superada.

La copia de build vive dentro de `e2e/.runtime/node_modules/lockin-e2e-app`
para que la resolución habitual de TypeScript no incorpore sus fuentes al
checkout. Prettier y ESLint ignoran únicamente runtime/artefactos generados;
no se modifica la lista de archivos medida por cobertura.
### Verificación de esta pasada

- `npm run lint`: limpio.
- `npm run typecheck`: limpio.
- Sintaxis de ambos módulos Node y parseo de los dos YAML: correctos.
- Prettier sobre archivos nuevos y configuración modificada: limpio.
- `npm run test:coverage -- --ci --runInBand`: **307 tests en 28 suites**
  pasan; 25 de contrato real omitidos por su opt-in. Cobertura final:
  **87.52/78.87/87.73/88.76**; se conserva el suelo exactamente, sin exclusiones.
- La primera ejecución tuvo un timeout de 5 s en el caso de ChatScreen con id
  inexistente (306 pasaron). La repetición completa pasó en 41,6 s sin tocar
  timeout, test ni código de producto. Se conserva el antecedente de lentitud
  con caché fría documentado en pasadas anteriores.

## Decimocuarta pasada: las tres casillas del recorrido verde, leídas y cerradas (2026-09-11)

Alcance: **solo `docs/plan/todo/calidad.md`**. Esta pasada no arregla nada ni
toca código: lee la evidencia de runs ya ejecutados y decide si respalda las tres
casillas de "recorrido completo verde" que seguían abiertas. Aquí no hay
emulador, ni Android SDK, ni Docker, así que todo lo de abajo sale de
`gh run view` y `gh run download`, no de una ejecución local.

### Primero, una corrección sobre qué runs son

El encargo hablaba de dos runs verdes "sobre la rama principal", 34409724164 y
34415842422. Solo el segundo lo es:

| run | commit | rama | conclusión |
| --- | --- | --- | --- |
| [34409724164](https://github.com/thejowe/lockin/actions/runs/34409724164) | `d4f0810` | `calidad/verificar-control-negativo` | success (3 variantes: supabase, probe, mock) |
| [34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963) | `b863e5f` | **`claude/startup-cofounder-matching-app-tfeai1`** | success |
| [34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422) | `74897b4` | **`claude/startup-cofounder-matching-app-tfeai1`** | success |

34409724164 es el run de la rama desechable de la decimotercera pasada —el que
cerró el control negativo—, y por eso todavía trae la variante `probe`, retirada
después. Los dos verdes **en la rama principal** son 34413652963 y 34415842422, y
son esos los que cierran las casillas. La diferencia importa: una casilla que
dice "recorrido completo verde en CI" no la cierra un run de una rama que ya no
existe.

Entre los dos hay un tercer run,
[34415283401](https://github.com/thejowe/lockin/actions/runs/34415283401) sobre
`1159e97`, en `cancelled`. No es un rojo escondido: `.github/workflows/e2e.yml:10`
declara `concurrency: e2e-${{ github.ref }}` con `cancel-in-progress: true`, y el
push de `74897b4` llegó siete minutos después del de `1159e97`. Los dos trabajos
murieron a la vez, sin veredicto.

### La evidencia, sin interpretar

Descargados los artefactos de los dos runs de la rama principal. Los dos traen
**solo `attempt-01`** en las dos variantes: ni un reintento de emulador, que es
lo que el log dice con `Reintentar el emulador: false — el recorrido pasó`.

| | 34413652963 (`b863e5f`) | 34415842422 (`74897b4`) |
| --- | --- | --- |
| `supabase` — Maestro | `tests=1 failures=0`, 175,73 s | `tests=1 failures=0`, 184,92 s |
| `supabase` — comandos | 63/63 `COMPLETED` | 63/63 `COMPLETED` |
| `supabase` — Postgres | `alta, perfil, lo que busca, modo, like, match y mensaje verificados` | ídem |
| `mock` — Maestro | `failures=1`: `Assertion is false: "Descubrir" is visible` | ídem |
| `mock` — comandos | 46 `COMPLETED`, 1 `SKIPPED`, 1 `FAILED` (#47) | ídem |
| `mock` — `postgres.json` | `failedCommand: 47`, `stopAppCommand: 45`, `persistence: ausente, como se esperaba` | ídem |
| veredictos | `pass` / `pass`, un intento cada uno | `pass` / `pass`, un intento cada uno |

Los 63 comandos de `supabase` incluyen los doce de después del `stopApp`: el
relanzado, Perfil con `Lo que busca` → `Diseño`, Matches y la burbuja del mensaje
otra vez. El recorrido no acaba al enviar, acaba **después** de que el proceso se
reinicie y la app vuelva a leer de Postgres.

Lo más concluyente no es ninguna de esas cifras, sino los dos `window.xml`
finales, que son la misma pantalla en el mismo punto del recorrido y dicen lo
contrario el uno del otro:

- `supabase` de 34415842422: `Núria Bosch`, `Escribe a Núria`,
  `Mensaje E2E 458ff1da-e4ba-49c3-9797-653ce58853ca`. Ese sufijo es el `runId`
  de `run.json` y de `postgres.json` de ese mismo intento, así que la burbuja que
  se ve tras el reinicio es la que escribió **esta** ejecución, no un residuo.
- `mock` del mismo run: `PASO 1 DE 2`, `¿Qué buscas?`, `Cofundador` /
  `Compañero de Lock-In` / `Ambos`. El APK sin credenciales vuelve al alta,
  porque su estado vivía en memoria del proceso.

Esa pareja es exactamente lo que las tres casillas pedían demostrar: que lo que
separa a las dos variantes es la persistencia real y no otra cosa que se rompa
por el camino.

### Qué cierra cada casilla, y con qué run

- **Sexta pasada (`calidad.md:421`), "primer recorrido completo verde en
  emulador"** →
  **[run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963)**
  (`b863e5f`). Es la primera vez que el recorrido entero pasa en la rama
  principal. Su texto nombraba el único rojo que quedaba —`verify.mjs:27`, la
  comparación contra la respuesta del prompt que el teclado capitalizaba—; en
  este run esa aserción está entre las que pasan.
- **Séptima pasada (`calidad.md:1505`), "recorrido completo verde en CI, con
  evidencia de UI y Postgres"** →
  **[run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422)**
  (`74897b4`). Pide las dos evidencias por separado y las dos están: UI en el
  `window.xml` posterior al reinicio, Postgres en la línea de `verify.mjs`. Se le
  asigna el run más reciente a propósito: es el HEAD actual de la rama, así que
  lo verde es lo publicado, no un commit anterior.
- **Novena pasada (`calidad.md:1695`), "primer recorrido completo verde en
  emulador"** → los **dos** runs. Su texto decía que lo único rojo era la
  variante `supabase` en "Resultado del recorrido"; ese paso da `pass` en
  34413652963 y otra vez en 34415842422. Una casilla que llevaba cuatro pasadas
  abierta no se cierra con una sola muestra, y aquí hay dos consecutivas al
  primer intento.

### Lo que esta evidencia **no** dice

- **El auto-capitalizado del prompt de texto libre sigue sin estar descartado.**
  La decisión de la duodécima pasada —no hacer el caso inmune— se mantiene. Lo
  que hay ahora son seis trabajos `supabase` verdes seguidos (`78c90b8`,
  `e0f4ca7`, `ce7ccc6`, `d4f0810`, `b863e5f`, `74897b4`), y eso es una señal
  fuerte, no una prueba: si el teclado vuelve a capitalizar, `verify.mjs:27`
  volverá a ponerse rojo, y entonces será flake de producto, no de runner.
- **Las tres casillas piden un recorrido verde, no un workflow a prueba de
  flakes.** `triage.mjs` sigue siendo lo que distingue la caída del emulador del
  fallo del caso; que estos dos runs no lo hayan necesitado no lo vuelve
  innecesario.
- **`e2e-android-supabase` no guarda capturas paso a paso**: Maestro solo las
  escribe al fallar, y por eso el único `.png` con jerarquía asociada del par es
  el del `mock` en el comando 47. La evidencia visual del recorrido verde es el
  `window.xml` final más los 63 comandos con su estado, no un carrete de
  imágenes.

### Por qué el oráculo de Postgres cuenta como evidencia

`Postgres: alta, perfil, lo que busca, modo, like, match y mensaje verificados`
es una sola línea, y conviene dejar dicho lo que hay detrás para que no se lea
como un sello. `e2e/verify.mjs` la imprime **al final**, después de más de veinte
aserciones con el cliente de service-role —que nunca entra en el APK— sobre
cinco tablas más la sesión de `auth`: `profiles` (edad, ubicación,
`looking_for`, `specialties`, `seeking_specialties`, `starting_point`,
`ambition`, `availability_bands` y la respuesta del prompt), `user_settings`,
`messages`, `matches`, `decisions`, y `auth.admin.getUserById` con
`is_anonymous === true`.
Cualquiera que falle tira `assert` y la línea no se imprime. Que aparezca es, por
construcción, que pasaron todas.

Dos de esas aserciones son las que impiden un falso positivo silencioso: la que
fija que el like cayó sobre `11111111-1111-4111-8111-000000000001` (Núria, la
tarjeta que el fixture pone delante) y la que exige `match.last_message_at`, o
sea que el trigger corrió. Sin la primera, "Busca" y el ✓ del deck podrían ser de
una tarjeta y el like de otra.

### El primer verde histórico, y por qué no cierra estas casillas

La duodécima pasada dejó registrado el primer recorrido completo verde:
[job 102245686110](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
commit `78c90b8`, del 2026-09-08. Se ha vuelto a comprobar en esta pasada y
sigue en pie: `tests=1 failures=0`, `SUCCESS`, `persistence: verified`,
veredicto `pass — recorrido completo y persistencia verificados`.

No se usa para cerrar ninguna de las tres casillas, y la razón no es la fecha:
el **run** de ese job estaba en `failure` —el `mock` fallaba— y vivía en la rama
`calidad/e2e-anr-y-deck-condicional`. Cerrar con él dejaría las casillas
apoyadas en media matriz y en una rama de trabajo. Queda citado donde estaba,
como el primer verde del recorrido, que es lo que es.

### Encontrado y no tocado: `codex/android-prompt` está obsoleta, no en regresión

Al listar los runs recientes del workflow aparece uno rojo y hay que dejar dicho
que **no es una regresión de la rama principal**:
[run 34415611322](https://github.com/thejowe/lockin/actions/runs/34415611322)
sobre `6d44307` ("Conservar la voz del prompt y adaptar E2E al ranking mutuo").
Su trabajo `mock` falla en `Assertion is false: "¡Match!" is visible` y la guarda
del control negativo lo rechaza con el veredicto correcto: `caso — El caso ya no
reinicia la app: el control negativo perdería su sentido`. Eso es el síntoma de
antes de `3eb5059`, y `git merge-base --is-ancestor 3eb5059 6d44307` dice que no
lo lleva: la rama sale de `d28baa6` y le faltan los cinco commits siguientes de
la principal. Que el run tenga tres trabajos en vez de dos —todavía arrastra la
variante `probe`— lo confirma.

El aviso, para quien la tenga abierta: `git diff HEAD 6d44307` son **5667 líneas
borradas** en `e2e/`, `supabase/` y `.github/workflows/` — la decimotercera
pasada entera, el `triage.mjs` con firmas, `schema-drift.yml` y el trabajo de
`datos`. Esa rama hay que **rebasarla** sobre la principal, no fusionarla. Desde
aquí no se toca: el cambio de ranking y la voz del prompt son de otros bloques.

### Verificación de esta pasada

- `gh run view 34413652963 / 34415842422 --json ...` — rama, commit, conclusión y
  jobs de cada uno, transcritos arriba sin redondear.
- `gh run download` de los dos runs y lectura directa de `verdict.json`,
  `postgres.json`, `run.json`, `maestro.xml`, `commands.json` y `window.xml` de
  las cuatro variantes.
- `gh run view --job <id> --log` de los cuatro trabajos, para las líneas de
  `verify.mjs` y del veredicto.
- `gh run list --workflow "E2E Android"` para barrer los runs recientes, y
  `gh run view` + `gh run download -n e2e-android-mock` sobre 34415611322 y
  34281070607 para los dos que no son de la rama principal.
- `git merge-base --is-ancestor` y `git diff --stat` para situar `6d44307`
  respecto al HEAD de la rama.
- **No ejecutado aquí**: nada de Jest, Maestro, Gradle ni emulador. Esta pasada
  no toca código, así que no hay suite que pueda romper; el único archivo
  modificado es este TODO, y `.prettierignore` excluye `*.md` y `docs`, así que
  tampoco hay formato que correr.

## Decimotercera pasada: el workflow entero en verde (2026-09-09)

Alcance: `e2e/`, `.github/workflows/` y los TODO. **No se toca `src/` ni
`supabase/`**, que era la condición de esta pasada.

Al empezar quedaba una sola casilla abierta —el control negativo con el `.yaml`
actual— y su causa no era mía: la tarjeta de delante del mock. Al cerrarla, el
workflow queda en verde por primera vez desde que existe.

### El arreglo estaba en el worktree, sin commitear, y eso obligó a un rodeo

El worktree es compartido. Al llegar, `git status` mostraba el arreglo de
`perfil` **staged pero sin commit**: `src/data/mock/seed.ts` y
`supabase/seed.sql` dan a Lucía Pardo `seekingSpecialties = ['ventas','datos']`,
más un `src/data/mock/seed.test.ts` nuevo que fija la invariante. Sin commit no
hay run, y sin run no hay nada que verificar en Actions.

Lo que se hizo, y por qué así: se construyó una rama desechable
`calidad/verificar-control-negativo` con **plumbing puro** —`read-tree` sobre un
`GIT_INDEX_FILE` temporal, `update-index --cacheinfo` con los blobs ya staged,
`write-tree` y `commit-tree`—, de modo que el índice y el working tree
compartidos no se tocan en ningún momento. Ni un `git add`. Se comprobó después
que `git status` seguía exactamente igual. La rama es HEAD (`8c94e3e`) más esos
cuatro archivos, nada más, y no está pensada para fusionarse: existe para
responder una pregunta que en esta máquina no se puede responder — aquí no hay
emulador, ni Android SDK, ni Docker.

Por qué el arreglo tenía que funcionar, antes de gastar 18 minutos de runner. El
perfil del recorrido domina `dev` y `marketing` y busca `diseno`, así que una
tarjeta puntúa `(lo que domino ∩ lo que ella busca) + (lo que ella domina ∩ lo
que busco)`. Antes, Lucía (diseño, buscando dev) y Marc (diseño, buscando dev)
empataban a 2 y `seed-lucia` ganaba el desempate alfabético sin ser recíproca.
Con el cambio Lucía baja a 1 y **Marc queda solo en el máximo** — y `seed-marc`
sí está en `SEED_RECIPROCAL_IDS`. En Postgres no cambia nada: Núria (id
`…0001`) ya puntuaba 2 por el `update` de `incoming-likes.sql` y gana cualquier
empate por id, así que la variante `supabase` no se movía. Las dos predicciones
se cumplieron.

### El control negativo, concluyente

[Run 34409724164](https://github.com/thejowe/lockin/actions/runs/34409724164),
commit `d4f0810`. **Las tres variantes en verde, todas al primer intento y sin
reintento de emulador** — es la primera vez que el workflow entero está verde.

Lo que importa es el `mock`, y se lee del `commands.json` de su intento
([job 102661076938](https://github.com/thejowe/lockin/actions/runs/34409724164/job/102661076938)),
sin interpretar nada:

| #   | comando                                    | estado     |
| --- | ------------------------------------------ | ---------- |
| 44  | `assertVisible: ${MESSAGE}`                | COMPLETED  |
| 45  | `stopApp`                                  | COMPLETED  |
| 46  | `launchApp clearState: false`              | COMPLETED  |
| 47  | `extendedWaitUntil: visible 'Descubrir'`   | **FAILED** |

Es decir: con el APK sin credenciales el recorrido llegó **entero** hasta el
reinicio —match, chat, envío y burbuja incluidos— y se rompió justo al otro
lado, porque el mock guarda el estado en módulo y al relanzar el proceso vuelve
al alta. El `postgres.json` del artefacto lo dice en números:
`failedCommand: 47`, `stopAppCommand: 45`. Y el oráculo cierra la otra mitad:
`Postgres: el APK sin credenciales no ha escrito perfil ni mensaje`. Veredicto
literal del runner: `pass — el mock falló después del reinicio y no escribió
nada`.

Eso es exactamente lo que el control negativo tiene que demostrar, y lo que no
demostraba mientras se paraba en `¡Match!`: que lo que distingue a las dos
variantes es **la persistencia**, no cualquier otra cosa que se rompa por el
camino. Con las dos mitades a la vez —`supabase` deja las filas, `mock` no las
deja y además falla donde debe— el caso positivo prueba integración de verdad.

### La sonda `probe`, retirada

`run.mjs` la anunciaba como temporal desde que nació y nombraba su condición:
"se retira junto con el .yaml en cuanto eso esté verificado". La casilla de la
duodécima pasada la ataba además a que `supabase` cerrase. Las dos condiciones
se cumplen, así que se retira — y conviene decir por qué la respuesta no es
"pues déjala, que es verde".

Existía por dos razones, y las dos se han agotado:

1. **La pregunta.** Con el teclado abierto, ¿sigue visible el compositor? Hoy la
   responde `full-journey.yaml` y con más fuerza: su `tapOn: 'Enviar mensaje'`
   ocurre con el teclado delante —y un tap no aterriza sobre un botón que no
   está en el árbol de accesibilidad, que era justo el síntoma—, detrás afirma
   el compositor deshabilitado y la burbuja **sin cerrar el teclado** (`8c94e3e`
   quitó el `hideKeyboard`), y tras el reinicio vuelve a entrar al chat desde
   Matches y afirma el compositor otra vez. La sonda paraba en la primera
   burbuja y no reiniciaba: hoy afirma un subconjunto estricto.
2. **El seguro contra la flake.** La mitad de comandos es la mitad de superficie
   para el `device offline` que se llevó 3 de 7 trabajos el 2026-09-07. Ese
   seguro lo da ahora `triage.mjs`: distingue la caída del runner del fallo del
   caso y arranca un segundo emulador solo en el primer supuesto (`91e98a1`).
   Cubre las dos variantes que deciden el color, no un atajo paralelo.

Y la evidencia de que ya no hace falta: `supabase` verde **al primer intento en
tres commits seguidos** — `78c90b8`
([job 102245686110](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110)),
`e0f4ca7`
([job 102253132113](https://github.com/thejowe/lockin/actions/runs/34283362375/job/102253132113))
y `d4f0810`
([job 102661076506](https://github.com/thejowe/lockin/actions/runs/34409724164/job/102661076506)).
Ninguno pidió segundo emulador.

Lo que costaba conservarla: un trabajo entero de Actions en cada push —17 min 1 s
en el run 34283362375— para repetir una pregunta cerrada. Se borran
`e2e/keyboard-probe.yaml`, la rama `probe` de `e2e/run.mjs` y su entrada en la
matriz del workflow. `e2e/hide-keyboard.test.mjs` pasa de dos flujos a uno; sus
tres casos que caen afirmaban sobre el `.yaml` que ya no existe, así que no se
pierde cobertura de nada que siga existiendo.

Lo que **no** se ha hecho al retirarla: no se ha tocado `full-journey.yaml`. Si
alguna vez hay que reabrir la pregunta del teclado, la sonda está entera en el
historial, que es más barato que mantenerla viva por si acaso.

**Y la retirada está verificada, no razonada a secas.**
[Run 34411945877](https://github.com/thejowe/lockin/actions/runs/34411945877)
sobre `ce7ccc6`, ya sin la sonda: dos trabajos en vez de tres, los dos en verde
al primer intento —
[`supabase` 102668149112](https://github.com/thejowe/lockin/actions/runs/34411945877/job/102668149112)
con `1/1 Flow Passed in 3m` y las filas verificadas;
[`mock` 102668149385](https://github.com/thejowe/lockin/actions/runs/34411945877/job/102668149385)
con `pass — el mock falló después del reinicio y no escribió nada`. Es la
segunda pasada consecutiva con el workflow entero en verde, así que el verde
tampoco depende de la sonda que se acaba de quitar. El trabajo `Runner E2E` de
[la CI de ese commit](https://github.com/thejowe/lockin/actions/runs/34411945864)
da `43 tests, 43 pass, 0 fail` — el único rojo local (`relee la suya de Postgres
después del reinicio`) es el CRLF de esta máquina, que ya fallaba antes y no
existe en CI.

### Corregida una casilla obsoleta de `chat`

`docs/plan/todo/chat.md:643` seguía diciendo que el recorrido completo no estaba
verde porque `supabase` acababa en rojo en el paso `gate`. Ya no es cierto desde
el 2026-09-08 y se ha cerrado con los dos jobs que lo demuestran. El apartado
que venía detrás —"en qué falla `supabase`", con el `gh` ausente y el
diagnóstico a ciegas— se conserva como registro de la ronda 4, marcado como tal:
describe una situación que dejó de existir.

### Lo que sigue sin poder decirse desde aquí

- **El auto-capitalizado del prompt de texto libre** sigue siendo intermitente y
  un verde suelto no lo distingue de "esta vez no salió". Varios recorridos
  `supabase` seguidos sin que aparezca son una señal, no una prueba. La decisión
  de la duodécima pasada —no hacer el caso inmune— se mantiene.
- ~~El verde vive todavía en la rama de verificación, no en la principal.~~
  **Ya no: medido en la rama principal.**
  [Run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963)
  sobre `b863e5f` —el commit de esta pasada, encima del arreglo de `perfil`
  (`3eb5059`)— deja `supabase` y `mock` en verde al primer intento, con el mismo
  veredicto literal: `pass — el mock falló después del reinicio y no escribió
  nada`. Es la tercera pasada consecutiva con el workflow entero en verde y la
  primera en la rama que cuenta. `git diff d4f0810 HEAD -- src/data/mock/seed.ts
  src/data/mock/seed.test.ts supabase/seed.sql` sale vacío, así que lo publicado
  es byte a byte lo que se verificó en la rama desechable.

## Duodécima pasada: los dos rojos del E2E, leídos (2026-09-08)

[Run 34172803719](https://github.com/thejowe/lockin/actions/runs/34172803719)
sobre d28baa6. Alcance de esta pasada: `e2e/` y `.github/workflows/`. No se toca
`src/` ni `supabase/`.

### Lo primero: el bloqueo que este TODO daba por vigente ya no existe

La décima pasada anotó que el log del trabajo y el artefacto respondían
`403 Must have admin rights to Repository` y que por eso el diagnóstico se
quedaba a medias. **Eso ya no es cierto**: `gh` CLI está instalado y autenticado
en esta máquina (`gh auth status` → cuenta `thejowe`, scopes `gist`, `read:org`,
`repo`, `workflow`), y tanto `gh run view --job <id> --log-failed` como
`gh run download` funcionan. El punto correspondiente de la décima pasada lleva
ahora una nota de corrección; `e2e/README.md` también. Lo que sí sigue siendo
cierto es que este host no tiene Android SDK, Java, Maestro ni Docker: desde aquí
se **lee** el emulador, no se reproduce.

### Los dos trabajos fallan por motivos distintos

| Variante | Trabajo | Resultado |
| --- | --- | --- |
| `probe` | pasa | la sonda del teclado sigue verde |
| `supabase` | [101896233448](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233448) | Maestro **1/1 Flow Passed en 2m 59s**; rojo solo en el oráculo, `e2e/verify.mjs:27` |
| `mock` | [101896233240](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233240) | falla en `full-journey.yaml:17`, la primera espera, antes de tocar nada |
| `mock` (rerun del mismo commit) | [102222194124](https://github.com/thejowe/lockin/actions/runs/34172803719/job/102222194124) | ese fallo **no se reproduce**; llega al deck y muere en la aserción del nombre, todavía antes del reinicio |

### `supabase`: el recorrido entero pasa en el emulador

Esto es más de lo que decía el TODO. El log del trabajo trae, literal:

```
[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 59s)
1/1 Flow Passed in 2m 59s
```

Es decir: formulario, chips de `seekingSpecialties`, deck ordenado, ✓ de
complementariedad, like, match, envío del mensaje, `stopApp`,
`launchApp clearState: false` y la relectura del perfil y del mensaje desde
Postgres — **todo verde en el emulador**. El compositor de `chat`, que bloqueó
tres pasadas, está cerrado de verdad.

Lo único rojo es la comparación del oráculo:

```
+ 'Una Herramienta para Construir en equipo'   ← fila en Postgres
- 'Una herramienta para construir en equipo'   ← lo que escribió la UI
```

Algo capitaliza palabra por palabra entre el `inputText` de Maestro y la fila
guardada. Es de `src/features/profile/profile-form.tsx` y **no se toca desde
aquí**: es del bloque `perfil`, que ya lo está arreglando en paralelo (en el
árbol de trabajo se ve `autoCapitalize="sentences"` + `autoCorrect={false}` sin
commitear en ese `TextField`).

### La decisión que había que argumentar: el caso NO se hace inmune

La alternativa era darle al recorrido una entrada determinista —escribir algo ya
capitalizado, o comparar sin distinguir mayúsculas— para que el E2E dejara de ser
sensible a esto. Se descarta, por tres razones:

1. **Es un bug real, y del tipo peor.** El campo es prosa libre ("Lo que quiero
   construir es…"). Que el teclado la reescriba no rompe nada visible: guarda un
   dato del usuario distinto del que el usuario escribió, en silencio.
2. **Ningún otro nivel del repo lo puede ver.** Jest + RNTL renderizan sin IME,
   así que `autoCapitalize` no se manifiesta nunca ahí; los tests de contrato de
   `src/data/supabase/` escriben en Postgres sin pasar por la pantalla. El único
   sitio donde este bug existe es esta comparación, después de un teclado real.
   Hacerla inmune no arregla nada: apaga el único detector que hay.
3. **Relajarla es exactamente lo que las reglas del E2E prohíben.** Copiar a
   `verify.mjs` la cadena capitalizada cierra el rojo sin cambiar el producto.

Lo que sí había que arreglar es que la sensibilidad era **accidental**: venía de
que la cadena elegida tenía interiores en minúscula, no de una decisión escrita.
Ahora `e2e/full-journey.test.mjs` la fija con dos casos:

- el `.yaml` escribe **byte a byte** lo que `verify.mjs` espera leer — mutación
  comprobada: capitalizar solo la expectativa del oráculo tumba este caso;
- la cadena conserva su forma de sonda: mayúscula inicial e interiores en
  minúscula, con al menos cuatro palabras — mutación comprobada: capitalizarla en
  los dos sitios a la vez tumba este otro.

La mayúscula inicial es deliberada y marca el límite de lo que el E2E exige:
`autoCapitalize="sentences"` en prosa es comportamiento deseado, no un bug. Con
esta sonda pasa `sentences` y pasa `none`, y falla `words` o un corrector activo.
El E2E no le impone a `perfil` cuál de los dos elegir; solo se niega a aceptar
que le cambien las palabras de dentro.

### `mock`, primer intento: no es una regresión del arranque, es un ANR del sistema

El síntoma era `Assertion is false: "Cofundador" is visible` a los 72 s, en el
primer `extendedWaitUntil` tras `launchApp clearState: true`. Parecía que la app
no llegaba a pintar la pantalla de modo. No es eso. El artefacto
`e2e-android-mock` lo desmiente en dos sitios:

- `logcat.txt`:
  `Displayed app.lockin.mobile/.MainActivity for user 0: +3s934ms`. La app
  arrancó y pintó, cuatro segundos después del `launchApp`.
- el volcado de jerarquía del paso que falla
  (`step-005-assertCondition-Cofundador.json`) tiene **tres nodos con texto y
  ninguno es de la app**:

  ```
  android:id/alertTitle  "System UI isn't responding"
  android:id/aerr_close  "Close app"
  android:id/aerr_wait   "Wait"
  ```

Un diálogo modal del sistema encima. Android entonces solo expone esa ventana, y
el `assertVisible` estuvo preguntando por la pantalla de SystemUI, no por la app.
Eso no es una respuesta sobre el caso, ni verde ni roja. El contexto encaja:
Maestro arranca justo tras `Boot completed in 65487 ms`, con el sistema todavía
instalando paquetes, y el logcat va lleno de `Slow dispatch` / `Slow operation`
de `system_server`.

### El rerun sobre el mismo commit: el ANR no se repite, y aparece la causa de verdad

`gh run rerun 34172803719 --job 101896233240` sobre d28baa6, sin tocar nada
([job 102222194124](https://github.com/thejowe/lockin/actions/runs/34172803719/job/102222194124)).
Resultado: **el fallo no se reproduce**, y el recorrido llega mucho más lejos —
2m 24s frente a 1m 12s:

```
[Failed] Alta, perfil, deck, match, mensaje y persistencia (2m 24s)
         (Assertion is false: "Núria Bosch" is visible)
```

Dos conclusiones, y la segunda es la que importa:

1. **No había regresión del arranque en frío.** El `"Cofundador"` del primer
   intento era el ANR de SystemUI y nada más: en el rerun el mismo APK, el mismo
   commit y el mismo AVD pasan de largo esa pantalla y 34 comandos más. Eso es lo
   que el `gh run rerun` costaba responder, y lo responde.
2. **El control negativo tiene un problema estructural, no ambiental.** Ahora
   falla en el comando 35 de 36 — `assertVisible: 'Núria Bosch'`, la primera de
   las cuatro aserciones del deck— y sigue estando **antes** del `stopApp`.

El artefacto lo explica sin ambigüedad. El volcado de la pantalla en ese paso
(`step-036-assertCondition-Núria_Bosch.json`) trae el deck cargado y delante
**no está Núria Bosch**. Cuál es la de delante se lee en los `bounds`, no en el
orden del volcado: la de delante es la única tarjeta a tamaño completo, y las de
detrás salen escaladas.

```
Lucía Pardo  [295,530][974,609]   ← delante
Marc Oller   [305,587][957,663]
Diego Salas  [315,641][939,714]
```

Es exactamente lo que la décima pasada dejó anotado como riesgo, palabra por
palabra: *"los pasos que añade esta pasada van antes del reinicio y todavía no
han visto un emulador; si alguno fallara ahí, el propio control lo diría y lo
rechazaría"*. Pasó eso. Esas cuatro aserciones nombran a la persona que el
`update` de `created_at` de `incoming-likes.sql` pone arriba, y ese fixture es de
Postgres: con el APK sin credenciales el deck lo ordena `src/data/mock/seed.ts` y
arriba hay otra persona. No es que la aserción sea débil con el mock — es que no
puede cumplirse allí por construcción.

### El arreglo: condicionar esas cuatro líneas, y solo esas

Se descartan las dos salidas fáciles. Relajar la aserción (comparar "algún
nombre" en vez de uno concreto) le quitaría al deck lo único que lo hace
comprobable, que es hablar de datos de una persona conocida. Y darle al control
negativo un `.yaml` propio rompería su garantía central: que las dos variantes
corren **el mismo caso**.

Lo que se hace es marcarlas como lo que son — el único tramo del recorrido que
depende de una fila que solo existe en Postgres — con la condición de Maestro:

```yaml
- runFlow:
    when:
      true: ${DECK_FIXTURE == 'postgres'}
    commands:
      - assertVisible: 'Núria Bosch'
      - assertVisible: '(?i)busca'
      - assertVisible: '(?i)✓ marketing'
      - assertVisible: '(?i)✓ encajas'
```

`run.mjs` pasa `DECK_FIXTURE=postgres` en la variante con credenciales y
`memoria` en el control negativo. Qué **no** cambia: la variante que decide el
color del E2E las ejecuta todas, igual que antes; el `tapOn: 'Like'`, el
`stopApp`, el `launchApp clearState: false` y toda la relectura de persistencia
corren idénticos en las dos. Lo que se recupera es que el control negativo pueda
llegar al reinicio, que es lo único que le da sentido.

Tres guardas nuevas en `full-journey.test.mjs`, las tres verificadas por mutación
(cada una se rompe al introducir el error que vigila):

- el bloque condicional contiene **exactamente** esas cuatro líneas — colar
  cualquier otro paso dentro, o meter ahí el `stopApp`, tumba el caso;
- hay **un solo** `runFlow` en todo el recorrido, y el `stopApp` sigue al margen
  izquierdo, fuera de él;
- el primer `assertTrue` del recorrido exige que `DECK_FIXTURE` valga `postgres`
  o `memoria`, así que dejar de pasar la variable rompe el recorrido en vez de
  saltarse las cuatro aserciones en silencio.

La sintaxis de `runFlow` + `when.true` con `commands:` en línea está contrastada
contra la documentación de Maestro
(https://docs.maestro.dev/maestro-flows/flow-control-and-logic/conditions.md).
Aquí no hay Maestro para ejecutarla: lo dice el próximo run.

### La guarda del control negativo acertó, pero por el motivo equivocado

Al fallar antes del `stopApp`, el `commands.json` de Maestro traía 5 comandos y
ninguno era el reinicio — **Maestro solo vuelca lo que llegó a ejecutar**.
`run.mjs` leía ese `-1` y respondía *"El caso ya no reinicia la app: el control
negativo perdería su sentido"*, que es falso: `full-journey.yaml:114` lo declara.
El trabajo se puso rojo, que es lo correcto, pero con un diagnóstico que apuntaba
a una regresión inexistente.

Ahora se distinguen las dos causas: primero se comprueba en el `.yaml` que el
`stopApp` sigue declarado (esa sí es la regresión que este control existe para
impedir, y conserva su mensaje) y, si está, se dice lo que de verdad pasó — el
recorrido no llegó al reinicio, así que el control negativo no concluye nada
sobre la persistencia.

### Cambio en `triage.mjs`: una excepción, y por evidencia

`e2e/triage.mjs` clasificaba —correctamente, según su propia regla— este fallo
como del caso: `Assertion is false` está en `CASE_SIGNATURES` y las firmas del
caso ganan siempre. Esa regla existe para que un bug real no se reintente hasta
verlo verde, y no se toca.

Se añade una única excepción, decidida por **evidencia del volcado, no por texto
del mensaje**: si el paso que falla trae un diálogo ANR de Android
(`android:id/aerr_*`, buscado por id y no por texto para que no dependa del
idioma del emulador) y el título **no** nombra a la app (`expo.name` de
`app.json`), es caída del runner y se reintenta. Si el que no responde es la app
bajo prueba, sigue siendo fallo del caso y no se reintenta nunca. Sin saber cómo
se llama la app no se decide por el diálogo: se cae a las reglas de siempre.

Justificación de que esto no relaja nada: la regla protege contra repetir una
aserción fallida **sobre la app**. Aquí la aserción no llegó a mirar la app —
había una ventana del sistema delante, y el sistema no expone otra cosa. Los
cuatro casos nuevos de `e2e/triage.test.mjs` fijan las cuatro ramas, y el parser
se ha validado contra el volcado real del run (devuelve
`{"title":"System UI isn't responding"}` y clasifica `runner`).

### Lo que el run de la rama demuestra, y lo que destapa

Rama `calidad/e2e-anr-y-deck-condicional`, commit 91e98a1.
[Run 34276300168](https://github.com/thejowe/lockin/actions/runs/34276300168).
CI verde entero (Lint, Formato, Tipos, Tests, **Runner E2E**, Export web).

**Las tres piezas de esta pasada funcionan en un emulador de verdad**, y esto ya
no es "pasa el YAML":

1. **La clasificación del ANR.** El trabajo `mock` volvió a encontrarse el
   diálogo del sistema, dos veces seguidas en el mismo AVD, y el veredicto lo
   dijo con todas las letras en vez de culpar al caso:
   `Veredicto de attempt-01: runner — un diálogo ANR del sistema tapaba la
   pantalla ("System UI isn't responding"): la aserción no llegó a mirar la app`.
   O sea que el ANR no era una casualidad de un run: es reproducible.
2. **El reintento de emulador se disparó por ese motivo**, que es justo para lo
   que existe: `Reintentar el emulador: true`, y el paso "segundo emulador" corrió
   por primera vez con una causa legítima. En el AVD nuevo no hubo ANR.
3. **El `runFlow` condicional hace lo que dice.** En el `commands.json` del
   tercer intento el comando 35 es `runFlowCommand SKIPPED` con el mock, y el
   recorrido siguió adelante: 38 comandos en vez de los 36 de antes, y llegó a
   `tapOn: 'Like'` (COMPLETED). La sintaxis es correcta y el gate no toca al
   resto del recorrido.
4. **El mensaje de la guarda ya no miente.** Donde antes decía "El caso ya no
   reinicia la app", ahora dice: *"El recorrido no llegó al reinicio: Maestro
   ejecutó 38 comando(s) y falló en el 37. `full-journey.yaml` sí declara el
   `stopApp`, así que esto no dice nada sobre la persistencia"*.

**Y destapa el siguiente eslabón, que no es de este bloque.** Con el gate puesto,
el control negativo ya no muere en el nombre de la tarjeta: muere en el comando
37 de 38, `Assertion is false: "¡Match!" is visible`. Sigue siendo antes del
`stopApp`, así que sigue sin concluir.

La causa está en el artefacto y es concreta. Comparando los `bounds` de la
tarjeta de delante antes y después del like:

```
antes del like (job 102222194124)   Lucía Pardo [295,530][974,609]  ← delante
después del like (job 102230038048) Marc Oller  [295,530][974,609]  ← delante
```

El deck avanzó exactamente una tarjeta: el like se registró y cayó sobre **Lucía
Pardo**. Y `src/data/mock/seed.ts` declara
`SEED_RECIPROCAL_IDS = ['seed-nuria', 'seed-marc', 'seed-alba']` — `seed-lucia`
no está. Con el mock, darle like a la tarjeta de delante **no genera match**, así
que no hay chat, no hay mensaje y no se llega al reinicio.

No es un fallo del E2E ni se arregla desde `e2e/`: es que el fixture que garantiza
"quien está delante ya te ha dado like" existe para Postgres
(`e2e/incoming-likes.sql`) y no tiene equivalente vigente en el mock. El orden del
deck cambió con el merge de `codex/mutual-complement` y `SEED_RECIPROCAL_IDS` se
quedó como estaba.

**Encontrado y no tocado** (`descubrir` / `datos`, dueños de `src/data/mock/`):
para que el control negativo pueda cumplir su contrato, la tarjeta que quede
primera en el orden del mock tiene que estar en `SEED_RECIPROCAL_IDS`, igual que
`incoming-likes.sql` lo garantiza en Postgres. Hoy la primera es `seed-lucia` y
no lo está. Es una línea, pero es de `src/` y desde aquí no se toca.

### La causa raíz: el fixture llevaba dos commits sin fijar nada

Con el gate del deck puesto, el segundo run de la rama
([34276300168](https://github.com/thejowe/lockin/actions/runs/34276300168), tras
`gh run rerun --failed`) dio el dato que faltaba. Los dos trabajos avanzaron, y
los dos se rompieron por **la misma causa**, que no es la que se creía.

**`supabase` ([102238000817](https://github.com/thejowe/lockin/actions/runs/34276300168/job/102238000817)):**
Maestro pasa entero otra vez —`1/1 Flow Passed in 3m 33s`, aserciones del deck
incluidas— y el oráculo falla, pero ya no en la cadena del prompt: en
`verify.mjs:44`.

```
El like no cayó sobre la primera tarjeta del deck (Núria Bosch)
+ '11111111-1111-4111-8111-000000000002'
- '11111111-1111-4111-8111-000000000001'
```

El like cayó sobre **Marc Oller**. Y esto se puede calcular, no hace falta
suponerlo. `20260907000200_discovery_mutual_complement` sustituyó
`order by p.created_at desc` por:

```sql
order by
  case ... else (me.specialties && p.seeking_specialties)::integer
             + (p.specialties && me.seeking_specialties)::integer end desc,
  p.id asc
```

`created_at` **ya no interviene**. El perfil del recorrido domina `dev` y
`marketing` y busca `diseno`, así que con los datos de `supabase/seed.sql`:

| Tarjeta | mis especialidades ∩ lo que busca | sus especialidades ∩ lo que busco | total |
| --- | --- | --- | --- |
| Núria (`…0001`) | `marketing` → 1 | `{dev,datos}` ∩ `{diseno}` = ∅ → 0 | **1** |
| Marc (`…0002`) | `dev` → 1 | `diseno` → 1 | **2** |

Marc gana por 2 a 1. Exactamente el id que devolvió el oráculo.

Es decir: **el `update` de `created_at` de `e2e/incoming-likes.sql` dejó de fijar
el orden del deck en el merge de `codex/mutual-complement`, y nadie se enteró**.
La décima pasada escribió esa suposición y hasta puso una guarda para
protegerla — `assert.match(fixture, /update public\.profiles\s+set created_at/)`
— que siguió pasando en verde todo el tiempo, porque comprobaba que la línea
existiera, no que sirviera para algo.

Y explica también por qué `assertVisible: 'Núria Bosch'` pasa mientras el like
cae en otra: el deck pinta tres tarjetas apiladas y Núria está entre ellas, solo
que detrás. `assertVisible` no dice "delante", dice "en pantalla". Quien sí
distingue es el oráculo, comparando el id sobre el que cayó la decisión — la
aserción del `.yaml` es la débil y el `verify.mjs` es el que cazó el bug.

**Arreglo, y es de este bloque** (`e2e/incoming-likes.sql`): se fija la tarjeta
de delante por el criterio que de verdad ordena. A Núria se le da la puntuación
máxima —le faltaba el segundo sumando, así que se le añade `diseno` a lo que
domina— y como su id es el más bajo del seed gana además cualquier empate. Su
fila "Busca" no se toca: el ✓ que afirma el recorrido sale de ahí.

La guarda se reescribe para comprobar el criterio nuevo, y añade
`assert.doesNotMatch(fixture, /set created_at/)` para que la línea muerta no
pueda volver disfrazada de fijación. Verificado por mutación: reponer el
mecanismo antiguo tumba el caso.

### Y la cadena capitalizada resulta ser intermitente

Dato que corrige lo escrito más arriba en esta misma pasada. Los dos runs de
`supabase` corrieron sobre **el mismo commit** (91e98a1, sin el arreglo de
`perfil`), y el primero murió en `verify.mjs:27` con
`'Una Herramienta para Construir en equipo'` mientras el segundo **pasó de largo
esa comparación** y llegó hasta la línea 44. Mismo APK, mismo emulador, mismo
texto escrito: el auto-capitalizado aparece unas veces y otras no.

No cambia la decisión —al contrario, la refuerza—: una corrupción silenciosa e
**intermitente** de un dato del usuario es de las que no caza nada salvo un
recorrido real, y desde luego no un test que renderiza sin IME. Sí cambia lo que
se puede afirmar: este E2E detecta el bug, pero no en todas las pasadas, así que
un verde suelto de la variante `supabase` no demuestra que esté arreglado.

### Estado del control negativo, que sigue sin concluir

`mock` ([102238001056](https://github.com/thejowe/lockin/actions/runs/34276300168/job/102238001056))
reprodujo su fallo **exacto** —`Assertion is false: "¡Match!" is visible`, comando
37 de 38—, así que es determinista, no una carrera. La causa es la misma de
fondo, vista desde el otro lado: con el orden nuevo la tarjeta de delante en el
mock es Lucía Pardo, y `src/data/mock/seed.ts` declara
`SEED_RECIPROCAL_IDS = ['seed-nuria', 'seed-marc', 'seed-alba']` — `seed-lucia` no
está, así que darle like no genera match y el recorrido no llega al `stopApp`.

El arreglo del fixture de Postgres no toca eso: el mock no lo lee. Ver
"Encontrado y no tocado".

### Encontrado y no tocado (`descubrir` / `datos`)

`src/data/mock/seed.ts`: el control negativo necesita que quien quede **delante**
en el orden del mock esté en `SEED_RECIPROCAL_IDS`, que es lo que
`e2e/incoming-likes.sql` garantiza en Postgres. Con el orden por
complementariedad mutua la primera es `seed-lucia`, que no está en esa lista.
Mientras siga así, el recorrido con el mock se para en el match y el control
negativo no puede cumplir su contrato. Es de `src/`, así que desde aquí solo se
reporta.

### Primer recorrido completo VERDE (2026-09-08)

[Run 34281070607, trabajo `supabase`
(102245686110)](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
commit 78c90b8. Paso **"Resultado del recorrido (supabase)": success**. El log:

```
=== Recorrido supabase, attempt-01 ===
[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 36s)
1/1 Flow Passed in 2m 36s
Postgres: alta, perfil, lo que busca, modo, like, match y mensaje verificados.
Veredicto de attempt-01: pass — recorrido completo y persistencia verificados
Recorrido supabase verde en attempt-01.
```

Al primer intento, sin reintento de Maestro y con el segundo emulador `skipped`.
Las dos líneas que importan son las dos últimas: la primera la escribe Maestro
—el recorrido de UI, reinicio incluido— y la segunda la escribe `verify.mjs`
leyendo Postgres con el cliente privilegiado, que nunca entra en el APK. Alta
anónima real, perfil, `seeking_specialties`, modo, decisión, match y mensaje:
comprobados como filas.

Ese run llevaba también el arreglo del teclado de `perfil` (4ab248a), así que
`verify.mjs:27` pasó. **Ojo con leer eso como prueba de que el auto-capitalizado
está arreglado**: se demostró más arriba que aparece de forma intermitente, y un
verde suelto no distingue "arreglado" de "esta vez no salió".

Qué NO cierra este verde: el workflow **sigue en rojo**, porque el control
negativo no concluye. El verde de arriba prueba por sí solo que la app escribió
en Postgres —lo dice el oráculo, fila a fila—; lo que falta es la otra mitad,
que el mismo caso con el APK sin credenciales se rompa en la persistencia. Eso
está parado en `src/data/mock/seed.ts`, que es de otro bloque.

### Casillas

- [x] Diagnosticar el rojo de la variante `supabase` con el log del run.
      Cerrada con evidencia: job 101896233448, paso "Resultado del recorrido
      (supabase)", `e2e/verify.mjs:27`.
- [x] Diagnosticar el rojo de la variante `mock` con el artefacto del run.
      Cerrada con evidencia, y son **dos** causas encadenadas: el ANR de SystemUI
      del primer intento (artefacto `e2e-android-mock`,
      `attempt-01/.../screen-hierarchy/step-005-assertCondition-Cofundador.json`)
      y, debajo, la que el rerun destapó — las cuatro aserciones del deck no se
      pueden cumplir con el mock (job 102222194124,
      `step-036-assertCondition-Núria_Bosch.json`: delante está Lucía Pardo).
- [x] Comprobar con `gh run rerun` sobre el mismo commit si el `mock` tenía una
      regresión de arranque en frío. **No la tenía**: el fallo no se reproduce.
- [x] Devolver al control negativo la capacidad de llegar al reinicio, sin
      relajar nada de la variante que decide el color. Hecho con `runFlow` +
      `when.true` sobre esas cuatro líneas y tres guardas de mutación.
- [x] Decidir y argumentar si el caso debe volverse inmune al auto-capitalizado.
      Decidido que **no**, con los tres motivos de arriba, y fijado con dos casos
      de `full-journey.test.mjs` verificados por mutación.
- [x] Corregir en el TODO el bloqueo de lectura de logs que ya no existe.
- [x] Verificar en un emulador real la clasificación del ANR, el reintento que
      dispara y el `runFlow` condicional. Cerrada con evidencia del run
      34276300168: veredicto `runner` por el diálogo del sistema, segundo
      emulador arrancado por ese motivo, y `runFlowCommand SKIPPED` en el
      `commands.json` del control negativo.
- [x] Encontrar por qué el like no cae sobre la tarjeta que el recorrido afirma.
      Cerrada: el `update` de `created_at` del fixture dejó de ordenar el deck en
      el merge de `codex/mutual-complement`. Arreglado en `e2e/incoming-likes.sql`.
- [x] **Recorrido completo verde en emulador** y [x] **verde en CI**. Cerradas
      las dos con el mismo enlace, porque el emulador es el de Actions:
      [job 102245686110](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
      paso "Resultado del recorrido (supabase)", `1/1 Flow Passed in 2m 36s` más
      `Postgres: alta, perfil, lo que busca, modo, like, match y mensaje
      verificados`. Es la primera vez que el recorrido entero pasa.
- [x] **Control negativo concluyente con el `.yaml` actual.** Cerrada el
      2026-09-09 con
      [job 102661076938](https://github.com/thejowe/lockin/actions/runs/34409724164/job/102661076938).
      El `mock` ya no se para en `¡Match!`: llega al reinicio y rompe donde
      tiene que romper. Del `commands.json` del intento, sin interpretar nada:
      comando 44 `assertVisible ${MESSAGE}` COMPLETED, 45 `stopApp` COMPLETED,
      46 `launchApp clearState: false` COMPLETED, **47 `Descubrir` FAILED**. Y
      el oráculo: `Postgres: el APK sin credenciales no ha escrito perfil ni
      mensaje`. Veredicto del runner, literal: `pass — el mock falló después del
      reinicio y no escribió nada`. Con esto **el workflow entero queda en
      verde**, las tres variantes al primer intento. Detalle en la decimotercera
      pasada.

### Lo que NO se ha hecho, y por qué

- No se ha tocado `src/features/profile/profile-form.tsx`: es de `perfil` y lo
  está arreglando en paralelo. Tampoco `src/data/mock/seed.ts`, que es lo que
  hoy para el control negativo: queda reportado arriba, no corregido.
- No se ha ampliado ningún timeout, ni quitado el `stopApp` o el
  `launchApp clearState: false`, ni relajado ninguna aserción.
- No se retira la variante `probe` pese a que el bug del teclado está cerrado y
  `run.mjs` la anuncia como temporal. Ahora mismo es la única de las tres que da
  verde de punta a punta, y con dos variantes en rojo conviene conservar la
  prueba barata de que el camino APK → emulador → Maestro funciona. Se retira
  cuando `supabase` cierre.

  > **HECHO el 2026-09-09.** `supabase` cerró y `mock` también, así que la
  > condición se cumplió y la sonda se retiró en esa misma pasada. El
  > razonamiento y la evidencia están en la decimotercera pasada.

## Undécima pasada: cubrir `seekingSpecialties` (2026-09-07)

Contexto: `arquitecto`, `datos`, `descubrir` y `perfil` entregaron la feature
(`7abbb0c`, `eb3867f`, `01c3a52`, `3eea69e`) y la migración ya está aplicada en
el proyecto real. `npm test` daba 353 verdes, `tsc` y lint limpios — pero CI en
rojo: **ninguno de los cuatro bloques corrió jest con `--coverage`**, así que
nadie vio el único gate que mira los umbrales.

    Jest: "global" coverage threshold for functions (89.84%) not met: 89.73%

`npm test` no aplica el suelo; `npm run test:coverage` sí. Es la misma lección
de la décima pasada dicha de otra forma: verificar con el comando que corre CI,
no con el que va más rápido.

### El suelo no se baja: se cubre lo que faltaba

Los huecos eran exactamente el código nuevo, más un botón que nunca se había
pulsado:

| Archivo | Hueco | Qué se cubrió |
|---|---|---|
| `catalog.ts` | ramas al 60 % (124, 148-158) | `catalog.test.ts`, nuevo |
| `profile-details.tsx` | funciones al 85,71 % (128) | la sección "Enlaces" |
| `profile-form.tsx` | 86, 289, 412, 445-454 | respaldo de `Intl`, zona horaria, cambio de pregunta, portfolio y LinkedIn |
| `controls.tsx` | función 227 | el "+" del `Stepper` |

Los tres archivos del bloque `perfil` quedan al 100 % en funciones y líneas, y
`catalog.ts` al 100 % en las cuatro métricas.

Lo que cubren esos tests no es relleno de cobertura:

- **`labelOf` cae al código si no está en el catálogo.** Un perfil guardado
  antes de retirar una opción sigue en la base de datos; pintar `quantica` es
  feo, pintar un hueco es un perfil que miente.
- **`availabilitySummary` con cero franjas** dice "sin franja". El formulario
  exige al menos una, pero la ficha también pinta filas que vienen de Supabase.
- **`deviceTimezone` sin `Intl`.** Hermes sin ICU no lo trae. Sin el respaldo el
  alta arrancaría con un campo obligatorio vacío y el formulario se negaría a
  guardar. El test lo distingue del camino feliz mockeando `Intl` para que
  devuelva `America/Bogota`: si el respaldo se rompe, los dos casos ya no dan lo
  mismo.
- **Los enlaces de la ficha.** El doble de `ExternalLink` apunta el `href` que
  recibe, así que el test comprueba que GitHub lleva a GitHub y que un portfolio
  ausente no se pinta con `href` vacío — no solo que salen tres textos.
- **Cambiar la pregunta de un prompt** sin perder la respuesta ya escrita.
- **El "+" del `Stepper` respeta el máximo.** El "−" tenía test desde la primera
  pasada; el "+" no lo había pulsado nadie.

**Comprobado que no son tests vacíos**: con seis mutaciones a la vez sobre el
código de producto —quitar el `?? value` de `labelOf`, el `?? 'Sin franja'`, el
`return 'Europe/Madrid'` del `catch`, el `updatePrompt` del chip y el `filter`
de enlaces— caen **7 de los 45** tests del bloque. Las mutaciones se revirtieron
con `git checkout`; no se ha tocado código de producto en esta pasada.

### El suelo sube: 89.82 / 82.56 / 91.49 / 91.38

De 88.87/80.24/89.84/90.31. Mismo criterio de siempre: el suelo se sube a la
cobertura real medida, nunca se baja ni se excluyen archivos para dejar pasar un
cambio. **No hizo falta tocar los umbrales a la baja**: con los tests nuevos la
suite ya pasa el suelo viejo con margen.

### Dos casillas de `TODO.md` estaban mal

En "Especialidades buscadas", ambas marcadas como pendientes cuando ya no lo
están:

- **La migración sí está aplicada.** Verificado consultando `seeking_specialties`
  con la clave `anon`: responde `42501` (RLS) y no `42703` (columna inexistente).
  La distinción es la prueba: un `42501` solo puede venir de una columna que
  existe.
- **El campo del formulario y la ficha sí está hecho**, en `3eea69e`.

De paso, la línea de "Calidad" del mismo archivo seguía diciendo 222 tests y el
suelo de la segunda pasada. Actualizada.

### Verificación de esta pasada

- `npm run test:coverage -- --ci --runInBand` — **374 tests en 34 suites**
  (27 del contrato remoto omitidos por su opt-in), cobertura
  89.82/82.56/91.49/91.38, `EXIT=0` y sin línea de `threshold`. Es el comando
  que corre CI, y es el que se saltaron los cuatro bloques.
- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre lo tocado — limpio. (`format:check` completo
  sigue fallando en este checkout Windows por CRLF, como está documentado
  arriba; en CI se comprueba sobre LF.)
- `git status` — solo tests, `jest.config.js` y los dos TODO. Ningún archivo de
  producto modificado.
- **No ejecutado aquí**: build Android, Maestro y emulador — este host sigue sin
  Android SDK, Java ni Maestro. Las dos casillas de E2E siguen abiertas y
  bloqueadas por el compositor de `chat`, igual que en las dos pasadas
  anteriores; nada de esta pasada las toca.

## Décima pasada: arreglar CI en rojo tras la novena (2026-09-07)

Contexto de arranque: CI en rojo en `cfadf27` y `cea5712` — "Formato" fallando
en `format:check`, y las 3 variantes de "E2E Android" (`probe`/`mock`/`supabase`)
en "UI y persistencia real". Se pidió revisar primero el run
[34144931734](https://github.com/thejowe/lockin/actions/runs/34144931734) para
saber si la ronda 3 del compositor (`cfadf27`) ya pasaba.

### Ronda 3 del compositor: sigue en rojo, y el reintento de la novena pasada acertó

Las 3 variantes fallan en el mismo sitio que antes de `cfadf27`: `"Enviar
mensaje"` no aparece (`Element not found` en `mock`/`supabase`, `Assertion is
false` en `probe`). Las tres se clasificaron como fallo del **caso**, no del
runner, y el paso de reintento (montado en la novena pasada) las dejó correr
una sola vez cada una — exactamente la regla que se escribió: "repetirlo lo
enmascararía". Es la primera confirmación en Actions de que esa clasificación
distingue bien un fallo real de una caída de infraestructura. El arreglo del
compositor sigue siendo trabajo de `chat` (ver su TODO); aquí no se toca.

### "Formato" en rojo: dos archivos de otros bloques sin pasar por Prettier

`npm run format:check -- --end-of-line auto` señalaba `jest.setup.js` (el mock
de `react-native-safe-area-context` que añadió `cfadf27`) y
`src/app/chat/[matchId].tsx` (la sonda de `console.log` que añadió `54359c6`).
Los dos tenían una llamada con formato de argumento distinto al que exige
Prettier — mismo patrón que el `.prettierrc` con `bracketSameLine` documentado
arriba: quien no corre `npm run format` antes de comitar dijo formatos legibles
pero distintos. `npx prettier --write` en ambos, sin tocar significado.

### El suelo de cobertura bajaba 0,03-0,04 puntos: la sonda temporal no tenía test

Con "Formato" ya arreglado, `npm run test:coverage` seguía en rojo:
`statements 88.84 → 88.77`, `functions 89.81 → 89.53`, `lines 90.28 → 90.19`.
La sonda de `54359c6` (`useKeyboardHandler(...)` en `[matchId].tsx`, explícita
en su propio commit como temporal — "se retira en cuanto ese TODO se cierre")
no tenía ningún test que disparara su `onStart`, y el mock oficial de
`react-native-keyboard-controller` no lo invoca solo. Mismo criterio que en la
novena pasada con `onContentSizeChange`: el suelo no se baja, se cubre lo que
falta.

Test nuevo en `test/app/matchId.test.tsx`: coge la última llamada registrada en
el mock de `useKeyboardHandler` y dispara `onStart` a mano, comprobando que el
`console.log` sale con la altura recibida. **Comprobado que no es un test
vacío**: cambiar el texto logueado (`height=` → `altura=`) tumba la aserción.
Se retira junto con la sonda cuando `chat` cierre esa ronda — anotado en el
propio test para que no se quede huérfano.

Suelo subido a los números exactos medidos: **88.87 / 80.24 / 89.84 / 90.31**
(sentencias/ramas/funciones/líneas). Rama sin cambio: la sonda no añade ninguna.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npm run format:check -- --end-of-line auto` — limpio (antes: 2 archivos).
- `npm run test:e2e` — 22/22.
- `npm run test:coverage -- --ci --runInBand` — **315 tests en 29 suites**
  pasan (25 del contrato remoto omitidos por opt-in), cobertura
  88.87/80.24/89.84/90.31 cumpliendo el nuevo suelo. Dos ejecuciones previas de
  esta misma pasada, con el suelo todavía viejo, dieron sendos timeouts de 5 s
  en pruebas distintas (`swipe-deck` una vez, `profile-form` la otra) con caché
  fría — mismo patrón de flake ya documentado en pasadas anteriores, no una
  regresión: una tercera ejecución con caché caliente pasó completa sin tocar
  nada.
- `npx expo export --platform web` — 14 rutas, sin cambios.
- **No ejecutado aquí**: build Android, Maestro y emulador. Su estado es el que
  reportan las tres variantes del run 34144931734, leído con `gh run view`.

### Qué queda abierto

Las mismas dos casillas de la novena pasada, sin mover: recorrido completo
verde y control negativo correcto, ambas bloqueadas por el compositor de
`chat`. Nada de esta pasada las toca ni las esquiva.
- Comprobado que el oráculo rechaza una URL remota antes de intentar conectar.
- `git diff --check`: limpio.
- **No ejecutados**: build Android, Maestro en emulador y workflow remoto,
  por los requisitos del host anotados arriba. Las casillas correspondientes
  continúan abiertas; no se modifica el estado global del MVP en TODO.md.
## Sexta pasada — integración de `arquitecto` + E2E (2026-09-06)

Costura entre las dos sesiones paralelas, hecha desde la principal tras
fusionar `codex/calidad`. Ninguna de las dos podía cerrarla sola: cada una veía
solo la mitad del cambio.

- `coverageThreshold` sube a **88.74 / 80.03 / 89.5 / 90.17**
  (sentencias/ramas/funciones/líneas). Dos causas suman: el borrado de
  `screen-placeholder.tsx` y `themed-view.tsx` por `arquitecto` encogió el
  denominador sin tocar el numerador, y el test nuevo de `app-tabs.web.tsx`
  añade cobertura. Medidos por Jest, no redondeados.
- `src/components/app-tabs.web.test.tsx` — cierra la casilla que `arquitecto`
  dejó abierta al rechazar la exención de este archivo. Ver su TODO para el
  razonamiento; aquí lo relevante es que **se verificó que no son tests vacíos
  mutando el componente**: quitar el `hitSlop` tumba 1 test, fijar el fondo a
  `transparent` tumba 3.
- `app-tabs.tsx` (el nativo) sigue exento a propósito y a 0 %. El argumento de
  la quinta pasada se mantiene y `arquitecto` lo compró explícitamente.

**Verificación:** `npm run lint` limpio, `npm run typecheck` limpio,
`npx prettier --check` limpio, `npm run test:coverage -- --ci --runInBand` con
**313 tests en 29 suites** (25 del contrato remoto omitidos por su opt-in) y el
umbral nuevo cumpliéndose, `npx expo export --platform web` con 14 rutas.

**Sigue pendiente y no lo tapa nada de esto:** el caso E2E de `e2e/` nunca se ha
ejecutado en un emulador. Su propio README lo dice y hace bien: "no se declara un
E2E verde por validar YAML, ni por pasar Jest". Hasta esa primera pasada, el
workflow `e2e.yml` es código sin ejecutar.

## Séptima pasada — primer CI real (2026-09-07 UTC)

Worktree actualizado a `origin/claude/startup-cofounder-matching-app-tfeai1`
(89a8fb2). Alcance exclusivo de calidad; sin tocar `supabase/`, `src/data/`
ni `docs/plan/TODO.md`. Se conserva la integración y el umbral 88.74/80.03/89.5/90.17.

- [x] Leer la primera ejecución y comprobar los artefactos disponibles.
- [x] Diagnosticar el fallo de bundle con logs y código del resolver instalado.
- [x] Corregir la ubicación de la copia de build y recoger evidencia antes de Maestro.
- [x] Confirmar recorrido completo verde en CI, con evidencia de UI y Postgres.
      **Cerrada el 2026-09-11 con el [run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422)
      (`74897b4`, rama principal).** La UI, en el `window.xml` posterior al
      reinicio: el chat de Núria Bosch con `Mensaje E2E 458ff1da…`, que es el
      `runId` de ese intento. Postgres, en el log del trabajo: `Postgres: alta,
      perfil, lo que busca, modo, like, match y mensaje verificados.`. Lo que
      decía esta casilla sobre los permisos de administración dejó de ser
      cierto el 2026-09-08 (ver duodécima pasada).
- [x] Comprobar estabilidad y resolver el coste de carga dentro del test de layouts.

Primera ejecución: https://github.com/thejowe/lockin/actions/runs/34069732039.
Supabase local pasó. Falló `:app:createBundleReleaseJsAndAssets`: Metro no resolvía
`@/components/themed-text`. El resolver del CLI omite los alias para orígenes bajo
`node_modules`, donde el runner colocaba la app. Corregido a un directorio temporal
por checkout, fuera de ese segmento y del include de TypeScript. No se han
relajado aserciones E2E ni cambiado el producto.

No había `e2e-android` para descargar: la API devuelve `total_count: 0` y el log
de upload-artifact dice `No files were found`. El runner solo creaba evidencias
al entrar en test. El workflow ahora conserva log del build, estados de fases
y disco incluso cuando no se llega a Maestro; conserva el fallo con pipefail.

CI general del mismo commit: https://github.com/thejowe/lockin/actions/runs/34069732040,
verde, 313 tests/29 suites, 25 del contrato remoto omitidos por opt-in.
El test de layouts local con `--no-cache` pasó pero tardó 43,8 s en su primer caso.
Una medición temporal separada confirmó 58,4 s dentro del `require` del layout
y aproximadamente 0,1 s para el resto del caso. Se traslada la importación a la
preparación de la suite: el mock de useFonts se configura por render, no por
carga de módulo. Sin nuevos timeouts, mocks ni aserciones retiradas.
Verificación adicional de flake: layouts con caché fría conserva 7/7 y el primer
caso baja a 54 ms. En la suite completa fría reapareció el timeout conocido de
ProfileForm (312/313). Se midió la inicialización diferida de los hosts nativos:
4.649 ms en los getters de React Native; al hacerla en preparación de suite,
el primer render baja a 270 ms y ProfileForm pasa 12/12. `test/native-hosts.js`
carga esos módulos para suites TSX antes de sus casos; no renderiza, no añade
dobles y no altera temporizadores. La suite completa con --ci --runInBand --no-cache pasa 313/313 en 29 suites (110,4 s), con la misma cobertura 88.74/80.03/89.5/90.17. El contrato remoto conserva sus 25 casos opt-in omitidos.
Segundo run: https://github.com/thejowe/lockin/actions/runs/34070646301 (0f9be5b).
Backend y APK release pasan (build 8m44s). El emulador arranca y ejecuta la app;
Maestro falla esperando `Cofundador` en la primera pantalla. Artefacto 10000604372
revisado: JUnit, logcat, build y fases; no hay crash JS/nativo de la app registrado.
Faltan captura y árbol: `--debug-output` no configura el destino de capturas en
Maestro 2.10; requiere `--test-output-dir`. Se añaden ambos flags y captura/árbol
por ADB independiente. No se cambian selectores ni esperas sin ver esa evidencia.
## Séptima pasada: el E2E se ejecuta de verdad (2026-09-07)

Se fusionó `codex/calidad` y se subió la rama. Corrección al contexto con el que
se abrió esta sesión: el workflow **sí se había ejecutado ya en Actions** — tres
veces antes de esta pasada. Esta sesión revisa esos resultados y los dos que se
lanzaron después.

### Lo que las ejecuciones reales demuestran

| Run | Commit | Hasta dónde llega |
|---|---|---|
| [34069732039](https://github.com/thejowe/lockin/actions/runs/34069732039) | 89a8fb2 | Supabase levanta; el bundle Android falla por los alias `@/`. Cero artefactos. |
| [34070646301](https://github.com/thejowe/lockin/actions/runs/34070646301) | 0f9be5b | `BUILD SUCCESSFUL in 8m 44s`, KVM arranca el AVD (`Boot completed in 77441 ms`), Maestro conduce la app. Falla en el primer paso por arranque en frío. |
| [34115169719](https://github.com/thejowe/lockin/actions/runs/34115169719) | b77b9d7 | **38 de 48 comandos COMPLETED** contra Supabase local real. Falla en `tapOn "Enviar mensaje"`. |

La tercera es la que importa. Sin tocar el caso, el mismo primer paso que había
fallado pasa — con lo que aquello queda identificado como arranque en frío del
emulador y no como un selector equivocado. Y a partir de ahí el recorrido
completo se ejecuta sobre la app real: alta anónima automática, selección de
modo, el formulario entero con sus scrolls, `Crear perfil`, deck, `Like`,
`¡Match!`, `Abrir chat` y el mensaje escrito en el compositor.

Es decir: la viabilidad del emulador en Actions ya no es una cita de
documentación. KVM funciona, el APK release se compila e instala, Maestro
maneja la interfaz de React Native y la app habla con Supabase local por
`adb reverse`.

### Por qué las dos casillas siguen abiertas

`tapOn "Enviar mensaje"` → `Element not found`. La captura y el volcado de
jerarquía del paso 038 dicen exactamente por qué: con el teclado abierto la
ventana no se redimensiona y el compositor entero desaparece del árbol de
accesibilidad. Es Android 15+ con edge-to-edge, donde `adjustResize` ya no
redimensiona, contra `behavior="height"` en `src/app/chat/[matchId].tsx:82`.

Es un defecto de producto del bloque `chat`, no del caso E2E. Está reportado en
`docs/plan/todo/chat.md` con la evidencia y dos caminos de arreglo. Aquí no se
toca su código —regla de alcance— y **tampoco se esquiva**: bastaría con mover
el `hideKeyboard` delante del envío para dejar el workflow en verde, y sería
declarar bueno un recorrido que un usuario real no puede completar.

Dicho de otro modo: el E2E no ha fallado. Ha encontrado un bug real que 313
tests unitarios no podían encontrar, que es exactamente para lo que se montó.

### Control negativo: montado, pendiente de poder ejecutarse

`E2E_NEGATIVE_CONTROL=1` compila el APK **sin** `EXPO_PUBLIC_SUPABASE_*`, con lo
que `src/data/active.ts` elige el mock en memoria. Todo lo demás es idéntico —
mismo Supabase levantado, mismo `adb reverse`, mismo `full-journey.yaml`—, así
que la única variable entre las dos ejecuciones son las credenciales del bundle.

En esa variante el runner invierte el criterio y exige tres cosas:

1. Maestro termina con error.
2. El primer comando fallido está **después** del `stopApp`, leído de
   `commands.json` (`maestro.xml` solo trae un mensaje; el volcado trae el orden
   y el estado de cada paso). Si el mock se rompiese antes, el control no
   probaría que lo que falta es la persistencia — y el runner lo rechaza
   diciendo en qué paso se rompió.
3. Postgres no tiene ni el perfil ni el mensaje de esa ejecución, comprobando
   antes que la base responde y tiene seed: una base caída daría "ausencia" y
   pasaría por el motivo equivocado.

Ese punto 2 es justo el que hoy no se puede satisfacer: con el bug del
compositor, el APK con mock se rompe en el mismo paso 38, antes del reinicio.
El control funciona —detecta y nombra la situación— pero no puede dar por
válida la prueba todavía.

Las dos variantes corren como matriz en el mismo workflow, con
`fail-fast: false` y artefactos separados (`e2e-android-supabase`,
`e2e-android-mock`). El negativo corre en cada push, no a mano: si algún día
pasara en verde, el caso positivo habría dejado de probar Supabase.

### Cambios de esta pasada

- `e2e/run.mjs` — variante `supabase`/`mock` por `E2E_NEGATIVE_CONTROL`,
  directorio de build y de evidencia separados por variante, `build-backend`
  por variante, y el criterio invertido con `firstFailure()` leyendo
  `commands.json`.
- `e2e/verify.mjs` — `verifyAbsence()`, el oráculo del control negativo.
- `.github/workflows/e2e.yml` — matriz de dos variantes con artefactos propios.
- `e2e/README.md` — control negativo y diagnóstico de las ejecuciones reales.
- `docs/plan/todo/chat.md` — el bug reportado con su evidencia.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre `e2e/run.mjs` y `e2e/verify.mjs` — limpio.
- `node e2e/run.mjs badcmd` y la importación de `verify.mjs` — ambos módulos
  parsean y ejecutan; el workflow parsea como YAML con la matriz esperada.
- **No ejecutado en esta máquina**: build Android, Maestro y emulador. Sigue sin
  Android SDK, Java, Maestro ni Docker. La validación es Actions, y por eso lo
  que se afirma arriba son números leídos de sus logs y artefactos, no de aquí.

## Octava pasada: primera matriz completa en emulador (2026-09-07)

[Run 34118890956](https://github.com/thejowe/lockin/actions/runs/34118890956),
commit 6563af7 — el arreglo de `chat` más el control negativo. Los dos jobs
compilan su APK y arrancan su emulador. Ninguno cierra su casilla, y por
motivos distintos.

### Variante `supabase`: el arreglo de `chat` no funcionó

Mismo `tapOn "Enviar mensaje"`, mismo `Element not found`, misma captura. El
cambio a `behavior="padding"` no basta. Reportado con la evidencia nueva en
`docs/plan/todo/chat.md`: la jerarquía del instante del tap no tiene compositor,
pero el volcado de `uiautomator` posterior sí, y ~630 px por encima del fondo —
`padding` se aplica con la magnitud correcta pero solo después de que el teclado
se cierre. El evento llega tarde; el `behavior` no es la variable que decide.

### Variante `mock`: no concluye, y el runner lo dijo mal

Maestro murió antes de ejecutar **ningún** comando:
`DeviceServerDiedException ... Command failed (tcp:34809): closed`, 341 ms. Es
una caída del driver gRPC en el dispositivo — infraestructura, sin relación con
el mock ni con las credenciales.

El control negativo falló, que es lo correcto, pero con el mensaje equivocado:
`Se esperaba un único volcado de comandos de Maestro`. Cierto y bastante inútil.
`firstFailure()` ahora distingue el caso: si no hay volcado, dice que Maestro no
ejecutó ningún comando, cita la causa que Maestro escribió en `maestro.xml` y
avisa de que un `DeviceServerDiedException` es fallo del emulador y toca
relanzar. Confundir "el driver se cayó" con "el mock se rompió antes de tiempo"
es exactamente lo que un control negativo no puede permitirse.

### Dónde queda cada casilla

- **Recorrido completo verde**: bloqueado por el bug de `chat`, todavía sin
  arreglar. Dos intentos, dos veces el mismo paso 38.
- **Control negativo**: bloqueado por lo mismo aunque el emulador no falle. Con
  el compositor roto, el APK de mock se rompe también en el 38, antes del
  reinicio, y el control lo rechaza por no probar lo que dice probar. Solo puede
  dar veredicto cuando el recorrido positivo llegue al final.

Las dos casillas se cierran en el mismo run, en cuanto `chat` cierre la suya.

## Novena pasada: reintento que distingue el runner del caso (2026-09-07)

La flake del emulador tumbó **3 de los 7 trabajos** del 2026-09-07 —`device
offline`, `StatusRuntimeException: UNAVAILABLE`, `DeviceServerDiedException`—
sin relación con el código. Cada pasada devolvía menos de la mitad de la señal,
y el bloque `chat` lo señaló al final de su TODO como trabajo de `calidad`.

- [x] Reintentar el paso "UI y persistencia real" **solo** ante caídas del runner.
- [x] Clasificación con lista cerrada y tests que la fijan (`npm run test:e2e`).
- [x] Evidencia por intento, sin que un reintento pise la del anterior.
- [x] Confirmar primer recorrido completo verde en emulador y guardar su
      evidencia. **Cerrada el 2026-09-11**: la variante `supabase` que seguía
      en rojo pasa en el [run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963)
      (`b863e5f`) y otra vez en el [run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422)
      (`74897b4`), las dos veces al primer intento y con la evidencia guardada
      en el artefacto `e2e-android-supabase`.
- [x] Confirmar que el control negativo falla **después** del reinicio.
      Confirmado en [run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392)
      (696408a): el trabajo `mock` pasa, y solo pasa si el primer comando
      fallido está tras el `stopApp` y Postgres no tiene ni perfil ni mensaje.

### La regla, que es lo único que importa aquí

Un reintento mal puesto es peor que no tenerlo: repetiría el bug del compositor
hasta verlo verde y convertiría el E2E en un adorno. Así que va en un solo
sentido y con lista cerrada:

> se reintenta **solo** si el fallo coincide con una firma conocida de caída de
> infraestructura. Todo lo demás —incluido lo que no se sabe clasificar— tumba
> el trabajo tal cual.

Dos detalles la sostienen, y los dos tienen su caso en `e2e/triage.test.mjs`:

- Las firmas de fallo **del caso** (`Element not found`, `Assertion is false`) se
  comprueban **antes** que las de infraestructura. Si el driver se muere después
  de que el recorrido ya haya fallado, el mensaje trae las dos cosas: manda la
  aserción. Sin esto, el fallo de hoy —`Element not found: ... Enviar mensaje`—
  se reintentaría en cuanto el emulador tosiera a destiempo.
- El estado de `adb` solo decide cuando Maestro no dejó mensaje ninguno. Y *no
  saber* en qué estado está el dispositivo no cuenta como caída: sin evidencia,
  `desconocido`, y `desconocido` no se reintenta.

### Dos niveles, porque hay dos formas de caerse

| Nivel | Qué cubre | Dónde |
|---|---|---|
| `E2E_MAESTRO_ATTEMPTS` (2 por defecto) | El driver gRPC muere con el AVD vivo. Es el caso del run 34118890956: falló en 341 ms, así que repetir cuesta segundos | Bucle en `run.mjs test` |
| Segundo paso del emulador | El AVD se cae entero o no llega a arrancar; desde dentro no hay nada que hacer | `triage` decide, `journey_retry` arranca otro AVD |

`run.mjs test` escribe `verdict.json` en la raíz de la variante: historial de
todos los intentos y `outcome` del último. `triage` lo lee y expone `retry` por
`GITHUB_OUTPUT`; el paso de reintento va condicionado a eso **y** a que el
primero fallara. Sin veredicto se reintenta, y eso no es una excepción a la
regla: significa que el proceso no sobrevivió al emulador, nunca que el caso
fallara — un fallo del caso siempre deja veredicto escrito, incluso si lo que
revienta es la preparación previa a Maestro.

Los dos pasos del emulador llevan `continue-on-error`. Quien decide el color del
trabajo es `node e2e/run.mjs gate`, al final, con todos los intentos delante y
después de subir la evidencia. Un veredicto `runner` tras agotar los reintentos
falla el trabajo diciendo que no hay veredicto sobre el caso, que es distinto de
decir que el caso está mal.

### Lo demás que cambia

- **Evidencia por intento**: `e2e/artifacts/<variante>/attempt-NN/` con su JUnit,
  su volcado de Maestro, su logcat (el buffer se vacía al empezar cada intento) y
  su `run.json`. `firstFailure()` pasa a leer un intento concreto, y su
  aserción de "un único volcado" sigue teniendo sentido con reintentos.
- **Identificador nuevo por intento**: si el primero llegó a escribir medio
  perfil, el segundo no comparte nombre con él y el `.single()` de los oráculos
  sigue siendo inequívoco.
- `adb reverse --remove` deja de ir por `run()`: lanzaba desde un `finally` y
  podía tapar el error real con uno suyo.
- `timeout-minutes` de 60 a 90: caben dos emuladores.
- `npm run test:e2e` (`node --test`) entra en la matriz de CI. `run.mjs` y
  `triage.mjs` son módulos de Node del runner, no código de la app: no están en
  `testMatch` de Jest ni en `collectCoverageFrom`, así que el suelo no se mueve
  por esto.

### El suelo de cobertura sube: 88.84 / 80.24 / 89.81 / 90.28

`cfadf27` (el arreglo del compositor de `chat`) dejó la suite 0,02 puntos por
debajo del suelo anterior en sentencias y líneas. El suelo no se baja, así que se
cubre lo que faltaba, y con algo que importa: el hilo se desplaza al final cuando
le crece el contenido (`onContentSizeChange` en `src/app/chat/[matchId].tsx` es
su único disparador; sin él un mensaje nuevo aparece fuera de pantalla y parece
no haberse enviado). **Comprobado que no es un test vacío**: sustituir el
manejador por `() => {}` lo tumba. No se ha tocado código de `chat`.

### Verificación de esta pasada

- `npm run lint` — limpio.
- `npm run typecheck` — limpio.
- `npx prettier --check` sobre lo tocado — limpio. (`npm run format:check`
  completo falla en 34 archivos **también sin estos cambios**: es el checkout
  Windows con CRLF de esta máquina, no el repo; en CI se comprueba sobre LF.)
- `npm run test:e2e` — **22 casos en 4 suites**, todos verdes.
- `npm run test:coverage -- --ci --runInBand` — **314 tests en 29 suites**, 25
  del contrato remoto omitidos por su opt-in, cobertura 88.84/80.24/89.81/90.28
  cumpliendo el suelo nuevo.
- `node --check e2e/run.mjs` y parseo de los dos YAML con la matriz y los pasos
  esperados — correctos.
- **No ejecutado aquí**: build Android, Maestro y emulador. Este host sigue sin
  Android SDK, Java, Maestro ni Docker. Lo que el reintento hace de verdad lo
  dirá el primer run que se cruce con la flake; hasta entonces, lo verificado es
  la clasificación, que es donde estaba el riesgo.

## Décima pasada: `seekingSpecialties` entra en el E2E (2026-09-07)

`seekingSpecialties` estaba entregada por los cuatro bloques y verificada contra
Supabase real (contrato 27/27), pero `e2e/full-journey.yaml` no la mencionaba.
El recorrido pasaba por el formulario y por el deck sin preguntar ni una vez qué
debe dominar la otra persona, así que una regresión en el pegamento pantalla ↔
repositorio no la veía nadie: los 222+ tests unitarios corren contra el mock y
los de contrato hablan con Postgres sin pasar por la interfaz.

- [x] Declarar en el formulario lo que debe dominar quien busco.
- [x] Leer en la tarjeta del deck la fila "Busca" y el ✓ de complementariedad.
- [x] Releer la propia después del reinicio, que es lo que separa Postgres del
      estado en memoria.
- [x] Fijar el orden del deck, sin el cual esas aserciones no dicen nada.
- [x] Extender el oráculo de Postgres a `seeking_specialties`.
- [x] Guardia en `node --test` para que esos pasos no se puedan borrar en
      silencio.

### Los dos lados, y por qué hacen falta los dos

La feature tiene dos mitades y solo juntas prueban algo:

1. **Escribir.** El bloque "Lo que debe dominar quien busco" solo se pinta con
   `par` o `ambos` —la invariante de `Profile.seekingSpecialties`—, y el
   recorrido ya elegía `Ambos` en la primera pantalla, así que el campo existe.
   Se toca por `Busco Diseño`, el `accessibilityLabel` que puso `perfil`: por
   texto visible, "Diseño" nombra dos chips distintos del mismo formulario.
2. **Leer la de otra persona.** En la tarjeta se afirma la fila `Busca` y los
   dos ✓ —el del chip complementario y el de la cabecera—. Ese ✓ es el cruce
   entre lo que ella busca y lo que yo domino, así que el recorrido ahora
   también domina marketing: sin eso, las dos aserciones comprobarían el vacío.

Y una tercera, que es la que distingue esta feature de un estado local: tras
`stopApp` + `launchApp`, en Perfil se vuelve a ver `Diseño`. En este recorrido lo
que domino es Desarrollo y Marketing, así que esa palabra solo puede venir de
Postgres.

### El orden del deck, que era la parte que no era obvia

`discovery_deck` ordena por `created_at desc` y `supabase/seed.sql` inserta los
ocho perfiles en la misma transacción: los ocho valores son iguales y el
desempate lo elige el planificador. Mientras el recorrido solo daba `Like` daba
igual —la fixture da likes entrantes desde los ocho, así que cualquiera
correspondía—, pero afirmar qué pone en la tarjeta exige saber de quién es.

`e2e/incoming-likes.sql` separa ahora las fechas y deja arriba a Núria Bosch,
que es el orden que `src/data/mock/seed.ts` da de todas formas: las dos
variantes ven la misma tarjeta, que es lo que el control negativo necesita para
seguir fallando donde debe. Solo toca la base desechable de `e2e/.runtime`.
`verify.mjs` comprueba en Postgres que el like cayó justo en ese id: sin eso,
"Busca" y el ✓ podrían ser de una tarjeta y el like de otra.

### Casillas que se cierran, y las tres que no

- **[x] El control negativo falla después del reinicio.**
  [Run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392)
  (696408a): el trabajo `mock` **pasa**, y en esa variante el runner solo da por
  bueno el resultado si Maestro falla, si el primer comando fallido está después
  del `stopApp` y si Postgres no tiene ni el perfil ni el mensaje. Es decir: con
  el mock el recorrido llegó **entero** hasta el reinicio, envío del mensaje
  incluido. Cierra las casillas de la octava y de la novena pasada.
  Aviso honesto: eso se midió con el `.yaml` de 696408a. Los pasos que añade esta
  pasada van antes del reinicio y todavía no han visto un emulador; si alguno
  fallara ahí, el propio control lo diría y lo rechazaría.
- **[x] Estabilidad y coste de carga del test de layouts.** El traslado de la
  importación a la preparación de la suite (séptima pasada) está verificado
  aquí: `test/app/layouts.test.tsx` da 7/7 en tres ejecuciones —dos con caché
  (11,7 s y 11,1 s) y una con `--no-cache`— y el primer caso tarda **61 ms**,
  frente a los 43,8 s de antes. El coste no desaparece, se paga una vez en la
  preparación de la suite; con caché fría son ~60 s de suite para 7 casos que
  suman 148 ms. Eso era lo que se buscaba y es estable, así que la casilla se
  cierra.
- **[ ] Recorrido completo verde en emulador** (octava y novena pasada) y
  **[ ] recorrido completo verde en CI** (séptima). No se cierran, y el motivo
  ya no es `chat`: en ese mismo run la sonda del teclado pasa y el control
  negativo llega al reinicio. Lo que falla es la variante `supabase`, en el paso
  "Resultado del recorrido".
  > **CORREGIDO el 2026-09-08.** Lo que decía este punto —que el log y el
  > artefacto respondían `403 Must have admin rights to Repository` y que por eso
  > no se podía nombrar la causa— **ya no es cierto**: `gh` CLI está instalado y
  > autenticado en esta máquina (scopes `repo` + `workflow`), y tanto
  > `gh run view --job <id> --log-failed` como `gh run download` funcionan. El
  > diagnóstico dejó de estar bloqueado y está hecho: ver "Duodécima pasada".
  > El resto del punto (que esta máquina no tiene Android SDK, Java, Maestro ni
  > Docker) sí sigue siendo cierto: aquí no se reproduce nada, solo se lee.
  >
  > **CERRADAS el 2026-09-11.** Las dos casillas de este punto están marcadas
  > arriba: [run 34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963) (`b863e5f`) y
  > [run 34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422) (`74897b4`), los dos sobre la rama
  > principal y los dos con `supabase` y `mock` en verde al primer intento.

### Encontrado y no tocado

`chat` deja apuntado que el `hideKeyboard` posterior al envío hace `pressBack()`
cuando no hay teclado, y eso navega hacia atrás en vez de no hacer nada. Es
real y es de este bloque, pero cambiarlo ahora mueve una pieza del único tramo
del recorrido que acaba de ponerse verde bajo el mock. Se toca cuando la
variante `supabase` cierre, no antes, y con la evidencia del run delante.

> **HECHO el 2026-09-09, por `chat`.** `supabase` cerró en verde
> ([run 34281070607](https://github.com/thejowe/lockin/actions/runs/34281070607),
> commit `78c90b8`), que era la condición que ponía este punto. Los dos
> `hideKeyboard` de después del envío están fuera de `e2e/full-journey.yaml` y
> `e2e/keyboard-probe.yaml`: no se sustituyen por nada, porque el compositor ya
> queda por encima del teclado y el hilo hace `scrollToEnd`, así que la burbuja
> se afirma con el teclado delante — que comprueba más, no menos. Los tres
> `hideKeyboard` del formulario de perfil se quedan: van pegados a un
> `inputText`, o sea que ahí sí hay teclado que cerrar.
>
> Lo fija `e2e/hide-keyboard.test.mjs` (nuevo, 7 casos): con el comando puesto
> caen 3 de 7, comprobado revirtiendo los `.yaml`. `npm run test:e2e` pasa a
> **46 casos, 45 verdes** — el rojo sigue siendo el de CRLF de esta máquina
> (`relee la suya de Postgres después del reinicio`), que ya fallaba antes.
> `e2e/run.mjs` no se toca y no se entera: busca `stopApp` por nombre
> (`firstFailure`, `:196`), no por índice.
>
> **Es un cruce de alcance**: `e2e/` es de este bloque. Lo pidió el dueño del
> proyecto ahora que hay red debajo. Razonamiento completo y evidencia en
> `docs/plan/todo/chat.md`, sección "El `hideKeyboard` de después de enviar,
> quitado". Lo que falta por confirmar es lo único que un `.mjs` no puede decir:
> que el recorrido siga verde en emulador. Lo dirá la próxima pasada de
> `E2E Android` sobre esta rama.

### Verificación de esta pasada

- `npm run test:coverage -- --ci` — **374 tests en 34 suites** (1 suite y 27
  casos del contrato remoto omitidos por su opt-in), verde con el suelo en
  89.82/82.56/91.49/91.38. No con `npx jest` a secas: el suelo solo se evalúa
  con cobertura, y saltárselo es lo que dejó CI en rojo la vez anterior.
- `npm run test:e2e` — **29 casos en 6 suites**, verdes. Los 7 nuevos son la
  guardia de `full-journey.yaml`.
- **Comprobado que la guardia no es un test vacío**: quitando del `.yaml` el
  `tapOn: 'Busco Diseño'` y el `assertVisible` del ✓ de cabecera, caen 2 casos.
- `npm run lint` y `npm run typecheck` — limpios.
- `npm run format:check` — los archivos tocados no aparecen. El comando completo
  sigue avisando de 155 archivos **también sin estos cambios**: es el checkout
  Windows con CRLF de esta máquina (`core.autocrlf=true`), no el repo.
- **No ejecutado aquí**: build Android, Maestro y emulador, por lo dicho arriba.

## Los dos rojos de CI que dejó abiertos la pasada del lock (2026-09-16)

Cierra lo que la pasada anterior dejó anotado y añade un segundo rojo que no
estaba visto, porque el del lock lo tapaba. Los dos son de infraestructura, no
de código de producto, y ninguno toca `src/`.

- [x] **`SQL embebido`: la guarda esperaba 4 mutaciones y ya son 5** (`ffebe59`).
      `7330a1f` —la huella que vigila los permisos de columna del sello de
      GitHub— añadió la quinta mutación y subió la línea de cierre del test a
      «Rol lector, 5 mutaciones, …», sin tocar el `grep` de `ci.yml:109`.
      Es el peor modo de fallo para una guarda: `npm run test:schema` pasaba
      20/20 y el job moría igualmente diciendo «El SQL embebido no llegó a
      ejecutarse entero», o sea, justo lo contrario de lo que ocurría. Las
      guardas de las líneas 101-108 siguen intactas: se actualizó el número, no
      se debilitó el control.

- [x] **`E2E Android`: el daemon de Gradle se quedaba sin Metaspace** (`5e015f5`).
      Diagnosticado en la sección anterior, resuelto aquí. Se toma la salida del
      Metaspace y no la de saltarse `lintVitalRelease`, y el motivo lo da el
      propio log del [run 35116867137](https://github.com/thejowe/lockin/actions/runs/35116867137):
      nombra el mando («These settings can be adjusted by setting
      `org.gradle.jvmargs`») y publica los valores vigentes —heap 2 GiB,
      metaspace **512 MiB**—, que son el stock que planta `expo prebuild` y se
      han quedado cortos para Android Lint con el árbol nativo de después de
      `react-native-webrtc`. Pasa a `-Xmx4g -XX:MaxMetaspaceSize=1g`; el runner
      de Actions tiene 16 GB, así que no se acerca al límite.

      Excluir el lint por nombre de tarea (`-x lintVitalAnalyzeRelease`) queda
      escrito como plan B en el comentario, sin ejecutar: el fallo estaba en un
      **módulo de librería** (`:react-native-async-storage_async-storage:`), no
      en `app:`, así que depende de que la exclusión por nombre case también
      ahí, y comprobarlo cuesta otro build de 13 minutos.

      Va parcheado en `e2e/run.mjs` justo después de `expo prebuild`, no en un
      `android/gradle.properties` del repo, porque `android/` se regenera en
      cada pasada y está en `.gitignore` — el mismo motivo por el que el
      `AndroidManifest.xml` también se parchea ahí al lado. Con una guarda
      (`assert.notEqual`): si Expo renombra o comenta esa línea de su plantilla,
      el `.replace` se quedaría en nada y el build volvería a morir igual 13
      minutos después sin que nada dijera por qué. Un no-op silencioso ahí
      cuesta un run entero, así que falla ruidosamente.

### Verificación de esta pasada

- `npm run test:schema` — 20 tests, 20 pass, 0 fail. Imprime exactamente
  `Rol lector, 5 mutaciones, teardown dos veces y guardia de sobrecarga: OK`,
  que es la cadena que ahora busca `ci.yml`, carácter a carácter.
- `node --check e2e/run.mjs` — limpio.
- `npx prettier --check .github/workflows/ci.yml` — limpio. `e2e/run.mjs` sale
  avisado, **pero también sale avisado su versión de HEAD sin tocar**
  (`git show HEAD:e2e/run.mjs`): es el CRLF de esta máquina, no el cambio. El
  veredicto de formato se lee del job «Formato» en CI, como siempre aquí.
- `git diff --numstat e2e/run.mjs` → `37 0`: solo inserciones, ninguna línea
  reescrita por finales de línea. Con `core.autocrlf=true` el blob se guarda en
  LF igual que el resto.
- **El criterio de terminado no es nada de lo anterior, sino el run**: hacen
  falta `CI` con sus siete trabajos en verde y `E2E Android` con las **dos**
  variantes (`mock` y `supabase`) en verde sobre el commit empujado. Pendiente
  de anotar aquí cuando salga.

> Recordatorio, que esta pasada no lo cambia: el trabajo remoto de
> `Schema drift` **debe** seguir en rojo hasta que el usuario aplique
> `supabase/migrations/20260916000100_github_verification.sql` en
> `grrzmzktrhksbttpbblg`. Ese rojo no es deriva ni es de esta pasada.

## `Contrato Supabase`: once saltos sin declarar, y por qué nadie los vio (2026-09-16)

- [x] **La lista blanca de saltos de `contract.yml:90` iba once entradas por
      detrás de la suite** (`ad69754`). El [run 35210842158](https://github.com/thejowe/lockin/actions/runs/35210842158)
      sobre `31c277f` salía rojo diciendo «La suite no corrió entera», y era
      justo lo contrario: 57 passed, **0 failed**, `"numFailedTests": 0`. El que
      reventaba era el `jq -e` de la guarda, que resta los tests saltados menos
      una lista blanca explícita y falla si queda algo — comportamiento buscado,
      lo dice su propio comentario. Faltaban los **seis de rachas** y los
      **cinco de verificación**.

      Los dos grupos se saltan por motivos distintos, y el comentario ahora los
      separa: los de rachas son de reloj (`itWithTimeTravel`, sin viaje en el
      tiempo no se fabrican sesiones pasadas), los de verificación son de
      navegador (`canLinkIdentityWithoutBrowser: false`, un OAuth de verdad
      necesita a una persona al otro lado). Contra el mock corren enteros los
      veintitrés. Es el mismo modo de fallo que el `SQL embebido` de la pasada
      anterior: la guarda dice lo contrario de lo que pasa.

- [x] **El hallazgo: el rojo de rachas llevaba desde el 2026-09-15 sin que
      nadie lo viera porque este job es `workflow_dispatch`.** `contract.yml` no
      tiene `push` ni `pull_request` — necesita levantar un Supabase local, así
      que es opt-in a propósito. Un job que solo corre cuando alguien lo lanza a
      mano **no se pone rojo solo**: se queda con el último veredicto que se le
      pidió, y ese era anterior a los tests de rachas. La deuda no se acumuló en
      el job, se acumuló en el hueco entre dos ejecuciones manuales, y por eso
      salieron once entradas de golpe en vez de seis y luego cinco. La lección
      para el siguiente bloque que toque `repositories.contract.ts`: si el test
      nuevo se salta en CI, la entrada en la lista blanca va **en el mismo
      commit**, porque el rojo no llega hasta que alguien dispare el job.

      Y no es la primera vez: la pasada «La lista blanca de `contract.yml` se
      había quedado corta» (2026-09-15) arregló exactamente esto para los nueve
      casos de `valoracion`, con el mismo diagnóstico escrito al final —«no se
      ha notado antes porque ese workflow es solo `workflow_dispatch`»—. Los
      seis de rachas entraron **el mismo día**, después de ese arreglo. Van tres
      repeticiones del mismo tropiezo: la nota no basta, y la única guarda que
      lo cerraría de verdad es que el job deje de ser solo a mano.

### Verificación de esta pasada

- **El veredicto es el [run 35213552961](https://github.com/thejowe/lockin/actions/runs/35213552961),
  en verde** sobre `ad69754` — lanzado a mano con
  `gh workflow run "Contrato Supabase"`, porque no se dispara solo. Imprime
  `Tests: 23 skipped, 59 passed, 82 total` y `"numFailedTests": 0`, y la guarda
  pasa: `$unexpected` queda vacío.
- Antes de commitear, los conjuntos comparados a máquina y no a ojo: los títulos
  de `itIfLinkable` + `itWithTimeTravel` de `src/data/repositories.contract.ts`
  son **23** y la lista blanca **23**, idénticos en los dos sentidos. Y los 21
  `○ skipped` del log del run rojo tienen entrada exacta en la lista, carácter a
  carácter.
- Las dos entradas de verificación que **no** salen en aquel log
  (`resincronizar mantiene el sello que ya estaba` y `verificarse no reordena el
  deck de quien se verifica`) no sobran: nacieron en `87ac129` y `427f3ad`,
  posteriores al commit del run. La lista está escrita contra HEAD, que es
  contra lo que se va a ejecutar.
- El diff venía ya escrito y sin commitear de otra sesión; se revisó y se
  commiteó tal cual, sin reescribirlo. `git add` con **ruta explícita**: este
  worktree lo comparten varios bloques y `docs/plan/TODO.md` y
  `docs/plan/todo/verificacion.md` siguen modificados sin commitear, son de
  `verificacion`.
- De propina sobre `ad69754`: `CI` y `Schema drift` verdes. `E2E Android` se
  relanzó sobre este commit — el anterior sobre `5170f64` salió **cancelled**,
  no rojo: `e2e.yml:10` lleva `cancel-in-progress: true` y el push lo mató.

## Saneamiento de arquitectura (auditoría del 2026-09-17)

Uno de los siete hallazgos de la auditoría del 2026-09-17 es de este bloque. La
orden completa está en `docs/plan/ordenes-arquitectura.md` → `ORDEN C1`.

### Orden `C1` — el contrato de Supabase no corre nunca (Ola 2)

Sin etiqueta de herramienta: bloqueada por la Ola 1. Cuando se desbloquee va a
`[Claude]`, como las otras seis — decidido con el usuario el 2026-09-17. Por el
criterio de `PLAN.md` sería `[Codex]` (alcance cerrado en `.github/workflows/`,
criterio objetivo); se cambió por decisión suya, no porque el criterio falle.

- [x] **Hallazgo 4: hay dos implementaciones completas de las mismas reglas de negocio y lo único que las mantiene honestas no se ejecuta en CI.** `src/data/mock/` y `src/data/supabase/` implementan por separado ventanas de sesión, rachas, ranking y resolución de match. El árbitro es `src/data/repositories.contract.ts` (**48 215 bytes**), y su mitad de Supabase es opt-in con `LOCKIN_SUPABASE_CONTRACT=1`. `.github/workflows/contract.yml` se dispara **solo con `workflow_dispatch`** (verificado el 2026-09-17, `contract.yml:10-11`), con el motivo escrito en su cabecera: escribe usuarios y tarda más que CI. Resultado: el CI de cada push no ejecuta jamás la mitad de Supabase del contrato
- [x] El precedente que dice por qué esto cuesta dinero está ya en este archivo y en `TODO.md`: **`seeking_specialties` desaparecía en silencio al guardar contra Supabase mientras todos los tests por defecto seguían verdes**. No es un riesgo hipotético, pasó
- [x] Decidido el compromiso y escrito **dónde se decidió**: el motivo de `workflow_dispatch` es real (el contrato contra Supabase local levanta Docker y tarda), así que la salida no es «ponlo en cada push» sin más. Las palancas: un `schedule` nocturno, un `push` solo a la rama principal, o un job que corra únicamente los casos que cubren la deriva de mapeo. Elige una, escribe el porqué, y que quede un artefacto verde que se pueda citar

### Cómo quedó (2026-09-17)

**La opción 1 de la orden —apuntar la suite de contrato al Postgres embebido—
no era alcanzable, y no por falta de ganas.** `supabase/schema-embedded.test.mjs`
levanta PGlite, que es Postgres a secas: no trae PostgREST ni GoTrue.
`src/data/supabase/` no habla SQL, habla HTTP a través de
`@supabase/supabase-js` —`from().select()`, `rpc()` y `auth.signInAnonymously()`—,
así que apuntarla ahí obligaría a escribir un sustituto de PostgREST **y** de
Auth. Y aunque saliera, ese código viviría en `src/` o en `supabase/`, los dos
fuera del alcance de esta orden. Se toma la alternativa que la propia orden
declara aceptable, con la palanca elegida y escrita aquí.

- [x] **`contract.yml` deja de ser solo a mano: gana `workflow_call` y lo llama
      `ci.yml`.** El job nuevo `Contrato Supabase` de `ci.yml` corre en cada
      push a la rama principal. No se deja como `push:` dentro de
      `contract.yml` a propósito: llamándolo desde `ci.yml`, **su rojo es el
      rojo de CI**, que es exactamente lo que pide el criterio de terminado. Un
      workflow aparte en rojo es otra pestaña que nadie mira — el modo de fallo
      que esta orden viene a cerrar.

      La condición es
      `github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`
      y no el nombre a pelo: la rama principal de este repo se llama
      `claude/startup-cofounder-matching-app-tfeai1` y una copia más de esa
      cadena es una copia más que mantener.

      **Por qué esta palanca y no las otras dos.** Un `schedule` nocturno tiene
      el mismo problema que el `workflow_dispatch`: el rojo llega cuando ya no
      hay nadie mirando ese commit, y además se desengancha del cambio que lo
      causó. Un subconjunto de casos «los que cubren la deriva de mapeo» exige
      decidir cuáles son, y el precedente de `seeking_specialties` dice
      precisamente que la deriva aparece donde nadie la esperaba. Correrlo en
      cada push de cualquier rama tampoco: levanta Docker y tarda ~10 minutos,
      diez veces lo que el resto de la matriz. Lo que cuesta la ventana elegida
      es **un push de retraso**; lo que costaba no tenerla fueron los nueve
      saltos sin declarar del 2026-09-15 y los once del 2026-09-16.

- [x] **Guarda `grep` de la misma clase que la del job `SQL embebido`**, en el
      paso «Suite de contrato». La salida de Jest se guarda con `tee` y se
      exige con `grep -q` la línea que la propia suite imprime al cerrar:

      ```
      Test Suites: 1 passed, 1 total
      ```

      Comprobado aquí que esa línea distingue los dos casos, ejecutando el
      archivo real:

      | Situación | Línea de cierre | Salida de Jest |
      |---|---|---|
      | Sin `LOCKIN_SUPABASE_CONTRACT` / sin credenciales | `Test Suites: 1 skipped, 0 of 1 total` | **0 — verde** |
      | Suite ejecutada | `Test Suites: 1 passed, 1 total` | 0 |

      Es decir: sin credenciales, `contract.test.ts:397` degrada su `describe`
      a `describe.skip`, Jest reporta `82 skipped, 82 total` y **sale en
      verde**. Ese es el «job que pasa sin ejecutar nada» que la orden llama
      peor que un job rojo.

      Honestidad sobre el alcance de esta guarda: el `jq -e` que ya estaba
      (ahora «Guarda 2») **ya cubría** ese caso concreto, porque exige
      `numPassedTests > 0`. Lo que añade la guarda nueva es la forma que pide
      la orden —una línea nombrada, greppable, idéntica en clase a las dos de
      `ci.yml:134-139`— y una segunda comprobación que no depende de que el
      JSON se haya escrito. No se ha tocado el `jq`: sigue siendo el que
      detecta los saltos sin declarar, que es el fallo que ha aparecido tres
      veces.

- [x] **Suelo de cobertura al día en `jest.config.js`.** Llevaba fijo desde el
      2026-09-07 y estaba muy por debajo de lo que mide la suite hoy, con las
      dos suites que `arquitecto` entregó en `fa3759c`
      (`src/data/provider.test.tsx` y `src/data/active.test.ts`) ya dentro.
      Medido con `npx jest --coverage --ci --runInBand`: 715 pasados, 82
      saltados, 65 de 66 suites.

      | | Antes (2026-09-07) | Ahora (2026-09-17) |
      |---|---|---|
      | statements | 89.82 | **93.58** (2394/2558) |
      | branches | 82.56 | **87.56** (1176/1343) |
      | functions | 91.49 | **92.76** (705/760) |
      | lines | 91.38 | **95.38** (2148/2252) |

      Los cuatro suben. Ninguno baja, que es la única regla que el comentario
      del archivo nunca ha permitido romper.

### Verificación de esta pasada

Local:

- `npm run test:coverage -- --ci --runInBand` — **verde con el suelo nuevo**:
  715 pasados, 0 fallos, y los cuatro umbrales por encima con margen
  (93.5887 ≥ 93.58, 87.5651 ≥ 87.56, 92.7631 ≥ 92.76, 95.3819 ≥ 95.38).
- `npm run lint` y `npm run typecheck` — limpios.
- Los dos workflows parsean como YAML (`require('yaml').parse`) y `ci.yml`
  declara ahora cuatro trabajos: `quality`, `build`, **`contract`**, `schema`.
- `npx prettier` sobre `.github/workflows/contract.yml`: la salida formateada
  es **byte a byte igual** al archivo salvo los finales de línea
  (`diff` tras `tr -d ''` sale vacío). El aviso de `format:check` aquí es el
  CRLF de esta máquina, como siempre; el veredicto se lee del job «Formato».
- **No ejecutado aquí**: el contrato contra Supabase. Necesita Docker y el CLI
  de Supabase, y escribe usuarios; por eso existe el job.

En CI, que es el criterio de terminado de verdad — sobre `6414da0`,
[run 35281202527](https://github.com/thejowe/lockin/actions/runs/35281202527):

- [x] **El job `Contrato Supabase` se ejecutó y salió en verde.** No
      `skipped`: `success`, con `Test Suites: 1 passed, 1 total` y
      `Tests: 23 skipped, 59 passed, 82 total`. Es la primera vez que la mitad
      de Supabase del contrato corre sin que nadie la lance a mano.
- [x] **La puerta `if` funciona en los dos sentidos.** En el mismo commit sobre
      una rama que no es la principal
      ([run 35281233442](https://github.com/thejowe/lockin/actions/runs/35281233442)),
      el job sale `skipped` — que es lo buscado: ahí no se levanta Docker.
- [x] **La guarda rota a propósito, y el job rojo por ella.**
      [run 35281256165](https://github.com/thejowe/lockin/actions/runs/35281256165),
      rama desechable `calidad-c1-guarda-rota` (`66f4d87`), con la cadena del
      `grep` cambiada por una que nadie imprime. El log es concluyente: la
      suite **pasó igual** —`Test Suites: 1 passed, 1 total`,
      `23 skipped, 59 passed`— y el paso murió después con

      ```
      El contrato contra Supabase no llegó a ejecutarse entero (suite saltada: ¿faltan credenciales?)
      ##[error]Process completed with exit code 1.
      ```

      O sea: el rojo vino de la guarda y de nada más. El commit se publicó con
      plumbing (`read-tree`/`commit-tree` sobre un `GIT_INDEX_FILE` temporal),
      sin un solo `git add` en este worktree compartido.

### Lo que sigue rojo en `CI`, y no es de este bloque

Ese mismo run tiene dos trabajos en rojo. **Ninguno de los dos lo causa `C1`**:
salen los dos igual en la rama desechable, cuyo único cambio respecto a
`6414da0` es la cadena del `grep`. Último `CI` verde: `9089c56`. `9cc0f1c`
(D1) y `fa3759c` (A1) no llegaron a tener run propio —estaban commiteados en
local y se empujaron junto con `6414da0`—, así que este es el primer veredicto
de la Ola 1 entera.

- **`Export web` — es el Problema 5 de la orden A1, que ha hecho exactamente
  lo que se le pidió y se ha llevado por delante el job.** `expo export`
  compila con `__DEV__ === false` y el runner no tiene credenciales, así que la
  guarda nueva de `src/data/active.ts` corta el render estático:

  ```
  Metro error: LockIn no puede arrancar sin backend: faltan EXPO_PUBLIC_SUPABASE_URL
  y EXPO_PUBLIC_SUPABASE_ANON_KEY.
  ```

  Hay dos arreglos posibles y la elección no es mía: **(a)** darle al job
  credenciales de relleno en `ci.yml` —el export es una prueba de humo del
  bundle, no una release, y las de verdad viven en el perfil de EAS—, o **(b)**
  que `active.ts` distinga el render estático de Expo de una app arrancando.
  `src/data/active.ts` es de `arquitecto` y el criterio de terminado de A1
  incluía `npx expo export --platform web`, así que la decisión le toca a ese
  bloque. Si elige (a), el cambio es de una sola clave `env:` en `ci.yml` y lo
  hace este bloque en cuanto lo pida.

- **`Formato` — dos archivos que A1 tocó, sin pasar por Prettier.**
  `src/features/session/use-active-session.ts` y
  `src/features/session/use-session-room.ts`. Los dos están en `src/`, fuera
  del alcance de C1 y dentro del de A1 (son los archivos de los que la orden le
  pedía quitar el import de `useResolvedOrPrevious`). Se arregla con
  `npx prettier --write` sobre esos dos y nada más.

> Queda publicada la rama desechable `calidad-c1-guarda-rota`. No se fusiona:
> existe solo para que el run 35281256165 se pueda volver a leer. Se puede
> borrar en cuanto alguien lea esta sección.
