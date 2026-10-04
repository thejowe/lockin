# TODO — verificacion

Plan: `docs/superpowers/plans/2026-09-16-verificacion-github.md`. Spec:
`docs/superpowers/specs/2026-09-16-verificacion-github-design.md`. Una casilla
por tarea del plan; se marca al hacer su commit, con la evidencia real al lado
(comando y resultado) — no solo la marca.

Alcance de archivos y a quién pisa: ver `docs/plan/PLAN.md` → bloque 11.
**Nunca se lanza a la vez que `perfil`, `descubrir` ni `datos`.**

Lo que este bloque promete, palabra por palabra: **que el enlace de GitHub de
un perfil es de quien controla ese perfil**. Nada más. Ni que la persona sea
buena, ni que exista, ni que se llame como dice. Si algún día el copy dice más
que eso, el sello está mintiendo.

---

## Tareas del plan

- [x] Tarea 1 — Confirmar el flujo OAuth y fijar `flowType` (`360d693`).
      Contestadas las tres preguntas que bloqueaban, contra la documentación
      viva: con `detectSessionInUrl: false` el SDK **no** canjea el `code`
      solo, así que el callback se cierra a mano con
      `exchangeCodeForSession`; `linkIdentity` sí acepta `skipBrowserRedirect`
      y devuelve la URL; y fijar PKCE **no** afecta a `signInAnonymously()` ni
      a `signInWithPassword()`, que no usan redirección. Evidencia: `npx jest
      src/data/supabase/client.test.ts` en verde con el caso nuevo de
      `flowType`.
- [x] Tarea 2 — Dominio y contrato (`5c22ad1`, `575221a`).
      `GithubVerification` y `Profile.githubVerification` en
      `src/data/types.ts` —**fuera de `ProfileInput`**, que es la mitad del
      diseño: si el formulario pudiera mandarlo, todo lo demás sobra—,
      `verifyGithub()`/`unverifyGithub()` en `ProfileRepository` y sus casos en
      `repositories.contract.ts`, con `canLinkIdentityWithoutBrowser` en
      `ContractBackend` para saltar contra Supabase los que necesitan
      navegador.
- [x] Tarea 3 — El mock (`cfb89bd`). `verifyGithub()` deriva un handle del
      nombre y enciende el sello; el JSDoc dice que es **una simulación, no una
      verificación**. Dos de los ocho perfiles de `seed.ts` nacen con sello,
      para que las pantallas tengan los dos estados que pintar sin que nadie
      toque nada.
- [x] Tarea 4 — Migración SQL y cobertura en PGlite (`d3b14a5`, `ec0e542`,
      `7330a1f`, `01ff78f`, `fc452e6`).
      `supabase/migrations/20260916000100_github_verification.sql`: las dos
      columnas, las dos `constraint`, el permiso **de columna** y
      `sync_github_verification()`. Dos correcciones que no eran cosméticas y
      quedan anotadas porque volverían solas: el `revoke` de columna intuitivo
      es un **no-op** cuando el rol tiene el privilegio de tabla (había que
      quitar el ancho y devolverlo columna a columna), y la constraint del
      enlace se colaba por la lógica de tres valores de SQL (`FALSE OR NULL` es
      `NULL`, y un CHECK solo rechaza con `FALSE`). Evidencia: `npm run
      test:schema` en verde, con la guarda de la huella vigilando que las
      columnas cerradas sigan siendo exactamente las dos del sello.
- [x] Tarea 5 — El repositorio de Supabase (`31c277f`). `linkGithubIdentity()`
      / `unlinkGithubIdentity()` en `auth.ts` (con los mensajes por su nombre
      para «Manual Linking» desactivado y para una cuenta ya linkada a otro
      perfil), y los dos métodos del contrato sobre el RPC. **Aquí no viaja
      ningún handle**: si viajara, sería falsificable.
- [x] Tarea 6 — La pantalla de perfil propio (`87ac129`). `GithubVerification`
      es el único punto de la app con acción; avisa **en pantalla**, no en un
      modal del sistema, antes de sobrescribir un `links.github` escrito a
      mano; cancelar en GitHub se cuenta como lo que es y no como un fallo; y
      con sello el campo de GitHub del formulario deja de ser editable.
      `refreshGithubVerification()` se añadió al contrato, al mock y al repo de
      Supabase para el caso que no cubre nada más —quien se renombra en GitHub
      deja el sello apuntando al handle viejo—, y la tab Perfil lo resincroniza
      al abrirse. Evidencia: `npx jest src/features/profile/ test/app/profile.test.tsx
      src/data/` en verde (299 tests); `npx jest src/constants/theme.test.ts`
      en verde con `KNOWN_GAPS` **vacío** — el sello va en `brass` sobre
      `brassSoft`, un par que ya estaba en `AA_PAIRS`, así que no hizo falta
      cambiar ningún tono ni añadir ninguna excepción.
- [x] Tarea 7 — El sello en la ficha y en el deck (`427f3ad`). `GithubSeal` es
      la única forma del sello y vive en un solo archivo: los tres sitios que
      lo pintan dicen exactamente lo mismo. En la ficha va junto al **enlace**
      (no junto al nombre: lo verificado es el enlace); en la tarjeta va
      arriba, pequeño, que es donde se decide el swipe. Sin sello no se pinta
      nada — marcar lo no verificado castigaría a las nueve especialidades sin
      GitHub. El contrato añade las dos garantías de que es señal y no puerta:
      el deck sirve verificados y no verificados por igual, y verificarse no
      reordena nada.
- [x] Tarea 8 — Verificación final y cierre (este commit).

### Desviación de la Tarea 7 que conviene saber

El plan pedía un caso de contrato que verificara **a un candidato** y
comprobara que el deck no cambia de orden. No es construible: `ProfileInput` no
lleva `githubVerification` —a propósito— y `setRankingCandidates` solo sabe
crear perfiles desde un `ProfileInput`, así que no hay forma de fabricar un
candidato sellado. Lo que sí se comprueba, y cubre el riesgo real:

- que el deck **sirve** verificados y no verificados por igual (un filtro de
  «solo verificados» lo pondría rojo), y
- que verificarse no reordena el deck de quien se verifica.

El lado del candidato queda garantizado por construcción: ningún camino del
ranking lee `githubVerification`, ni en el mock ni en `discovery_deck`.

---

## Verificación final (2026-09-16)

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npm run lint` | limpio (exit 0) |
| `npx jest --coverage` | 63 suites, **698 tests** en verde (1 suite y 82 tests saltados: el contrato opt-in contra Supabase). Cobertura **93.44 / 86.61 / 92.65 / 95.31** sobre el suelo 89.82 / 82.56 / 91.49 / 91.38 |
| `npm run test:schema` | 20/20 en verde; 11 migraciones, 456 objetos, 5 mutaciones |
| `npx expo export --platform web` | verde, 15 rutas estáticas. **No hizo falta ningún `.web.ts`**: el flujo es de navegador y no importa módulo nativo |

`npm run format:check` y `npm run test:e2e` **no se usaron como veredicto**: en
esta máquina dan ruido de CRLF (~100 archivos falsos el primero, 2 fallos el
segundo). Se corrió `npx prettier --write` sobre los archivos tocados y el
veredicto de formato se lee del job «Formato» en CI.

---

## El rojo de `Schema drift`: previsto, y ya resuelto

Mientras la migración estuvo escrita y sin aplicar, el job remoto de
`Schema drift` salió **rojo a propósito** — no era deriva, era esta migración
esperando. Fue la única vez que un rojo ahí era el estado correcto, y por eso
se escribió en vez de dejar que alguien lo descubriera con un rojo confuso.

**Ya no aplica.** El usuario aplicó `20260916000100_github_verification.sql` en
`grrzmzktrhksbttpbblg` el 2026-09-17, y el cotejo remoto lo confirma sobre el
commit de cierre: [run 35211856006](https://github.com/thejowe/lockin/actions/runs/35211856006),
`remote.diff` → `Sin diferencias.`, con las dos columnas, las dos `constraint`,
`sync_github_verification()` y los permisos de columna presentes en la huella
remota (`grantcol profiles.link_github authenticated INSERT/UPDATE`, y las dos
del sello **ausentes**, que es justo lo que protege el sello).

Así que vuelve a valer lo que dice `docs/plan/TODO.md` desde el 2026-09-13: un
rojo del job remoto es deriva real.

## Pendiente del usuario

Las tres primeras eran del usuario (dashboard y SQL Editor). La cuarta la hace
el agente `comprobador` en el emulador; del usuario solo hace falta su login de
GitHub en el navegador del emulador. Hasta entonces el bloque está probado
contra el mock y contra PGlite, que es donde llega el desarrollo.

- [x] Crear una GitHub OAuth App y poner client ID y secret en
      Authentication → Providers → GitHub del dashboard de Supabase, con la
      callback URL que indique el propio dashboard.
- [x] Activar **Enable Manual Linking** en Authentication → Settings. Está
      desactivado por defecto y sin él `linkIdentity()` falla siempre. — **hecho por el usuario el 2026-09-19** (esta casilla y la anterior, según su palabra; no hay artefacto que lo pruebe hasta que el flujo se ejecute en un dispositivo)
- [x] Aplicar `20260916000100_github_verification.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor — **hecho el 2026-09-17**,
      confirmado por el cotejo remoto (ver arriba).
- [x] **[comprobador]** Verificar el flujo en el emulador con un APK nativo
      (no Expo Go) contra Supabase real: el OAuth necesita un navegador de
      verdad y un deep link de vuelta (`lockin://`). Evidencia: el sello en
      la tab Perfil y `github_*` rellenos en `profiles`. El usuario teclea su
      login de GitHub cuando el agente se lo pida. **Intentado el 2026-09-24:
      ❌ bloqueado por configuración, no por código.** El Client ID guardado en
      el dashboard es `Lockin`, no el de la OAuth App, y GitHub responde «Page
      not found» tras el login. Esto contradice la primera casilla de esta
      lista, que se marcó por palabra del usuario. Ver «Hallazgos del
      comprobador» al final del archivo. **Sigue igual el 2026-10-01:**
      `GET /auth/v1/authorize?provider=github` contra `grrzmzktrhksbttpbblg`
      responde `302` con `client_id=Lockin` en la redirección, así que no se
      relanza el comprobador hasta que el usuario ponga en el dashboard el
      Client ID real de la OAuth App (y su secret). Con este `curl` se
      confirma sin abrir el emulador. **Comprobado el 2026-10-01 tras
      corregir el usuario el Client ID (`Ov23li…`): ✅ el sello sale en la
      tab Perfil y `profiles` queda con `github_handle = thejowe` y
      `github_verified_at` relleno, y sobrevive a un reinicio en frío.** Con
      un fallo de pantalla a la vuelta del navegador («Ese enlace no ha
      funcionado») que no impide el sello pero miente al usuario — ver el
      hallazgo del 2026-10-01 abajo.

## Hallazgos de la revisión adversarial del 2026-10-02

Revisión (Codex) del flujo de vuelta de GitHub tras `17e09f6` y `5b716e5`.
1, 2, 4 y 5 los confirmó en código quien encargó el arreglo; 3 y 6 se
verificaron antes de tocarlos. Arreglo en `3c029d6` (capa de datos:
`src/data/supabase/auth.ts`, `index.ts`) y `5420ae5` (pantalla:
`src/features/profile/auth-callback.tsx`), cada hallazgo con su test rojo
primero. Evidencia local sobre `5420ae5`: `npx tsc --noEmit` y `npm run lint`
limpios; `npx jest --coverage --ci` con 96 suites y 1100 tests en verde (113
saltados, los del contrato opt-in) y cobertura 95.24/90.36/94.92/96.86, sobre
el suelo. El veredicto de CI queda para cuando se empuje.

- [x] **1. Vuelta en frío sin sello.** Si Android mataba el proceso con GitHub
      abierto, la ruta canjeaba el code y nadie llamaba a
      `sync_github_verification` (`refreshGithubVerification()` sale antes sin
      sello). Ahora `linkGithubIdentity` apunta el intento en AsyncStorage
      (`lockin.supabase.github-link-attempt`, vigente 10 min) **antes** de abrir
      GitHub; en frío, `completeAuthLink` canjea y, si el servidor dice que la
      cuenta tiene identidad `github`, pone el sello. El RPC se movió de
      `verifyGithub` a `linkGithubIdentity` para que los dos caminos lo pongan,
      y solo se llama con la identidad presente (sin ella vaciaría
      `link_github`). Tests: «la vuelta de GitHub en frío» en `auth.test.ts`.
- [x] **2. Deduplicación que no esperaba al canje.** Ahora hay una promesa
      compartida por code (canje + sello) en `githubCompletions`: quien llega
      segundo espera ese canje y ve su resultado, también si falla. Tests con
      canje diferido y rechazado, ruta primero y navegador primero.
- [x] **3. El mismo enlace reabierto tras reiniciar daba error. Se sostiene.**
      `IntentModule.getInitialURL` de React Native devuelve el `data` de
      `activity.intent` sin mirar `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`, así que
      una app abierta en frío por el deep link vuelve a recibirlo al reabrirla
      desde recientes tras morir el proceso. Ahora el último code de GitHub
      canjeado se guarda (`lockin.supabase.github-link-consumed`) y no se vuelve
      a canjear. ~~Y si el canje falla con un intento abierto pero la cuenta ya
      tiene GitHub, se pone el sello en vez de dar error~~ — **retirado tras el
      `codex review` de abajo**: la identidad no prueba que ese code la
      vinculara.
- [x] **4. Booleano global.** `githubLinkInFlight` desaparece. Con el navegador
      abierto, la ruta espera a que vuelva y compara codes: solo el que
      devolvió GitHub es de GitHub; un code de correo que llegue entretanto se
      canjea como correo. En frío decide el servidor (identidad `github`), no
      una marca local.
- [x] **5. `?error=access_denied` hablaba de correos.** Con un intento de
      GitHub abierto, `completeAuthLink` lanza un `AccountError` con
      `github = true` y un texto sobre GitHub; la pantalla pinta «La
      verificación con GitHub no se ha completado» y manda a mirar el perfil,
      sin «Pide otro correo» ni «Tu cuenta no ha cambiado». Un error sin code
      no trae nada que comparar: ahí sí decide el intento abierto, y solo
      cambia el copy.
- [x] **6. `handled.current` bloqueaba una segunda URL. Se sostiene.** El
      `StackRouter` de expo-router, ante un `NAVIGATE` a la ruta que ya está
      enfocada, reutiliza esa ruta y cambia sus parámetros: `AuthCallback` no
      se desmonta, recibe la URL nueva y el booleano la ignoraba tras un
      error. Ahora `handled` recuerda la URL; la deduplicación del code vive
      en la capa de datos.
- [x] **`codex review --base 558a75f`, P2 1: un canje fallido se perdonaba
      solo por tener GitHub.** Se sostiene: con un intento abierto y la cuenta
      ya con identidad `github`, un enlace de correo caducado (confirmación o
      recuperación) se daba por bueno y quedaba apuntado como gastado. Ahora un
      canje fallido es siempre un error, también en `settleGithubCode` (vía del
      navegador); el único code gastado que se perdona es el que se puede
      correlacionar, el apuntado en `lockin.supabase.github-link-consumed`. Si
      el proceso muere entre el canje y el sello, ese code no se puede
      correlacionar: sale el error y la persona reintenta desde su perfil.
- [x] **`codex review`, P2 2: en frío, un fallo al poner el sello salía como
      error de correo.** Se sostiene: con el canje hecho, si fallaban
      `getUserIdentities` o `sync_github_verification`, el error subía sin
      `github` y la pantalla decía «Tu cuenta no ha cambiado» con GitHub ya
      vinculado. Ahora sale con `github = true`. Tests: «un canje fallido con
      un intento abierto sigue siendo un error aunque haya GitHub», «en frío,
      si falla … tras el canje, el error es de GitHub» (dos casos) y «un canje
      fallido no pasa por bueno aunque la cuenta ya tenga GitHub», los cuatro
      en rojo antes del arreglo. Evidencia local: `tsc` y `lint` limpios;
      `jest --coverage --ci` con 96 suites, 1103 pasan y 113 saltados;
      cobertura 95.30/90.43/94.93/96.86, sobre el suelo.
- [x] **[comprobador]** Recorrer en el emulador la vuelta en frío: «Verificar
      con GitHub» → con la Custom Tab abierta, matar el proceso de la app
      (`am kill` con la app en segundo plano, no `force-stop`) → autorizar en
      GitHub. Esperado: la app arranca en `auth/callback`, pasa a Perfil sin
      «Ese enlace no ha funcionado», y el sello sale en la tab Perfil y en
      `profiles` (`github_handle`, `github_verified_at`). Después, reabrir la
      app desde recientes tras matarla otra vez: sin pantalla de error. Para
      ver la pantalla de consentimiento hay que revocar antes la OAuth App en
      github.com/settings/applications. **Recorrido el 2026-10-04 sobre
      `70e4042` contra Supabase real: ❌ falla.** La app no pasa por
      `auth/callback`: arranca en Descubrir, el code no se canjea y el sello
      no se pone, aunque GoTrue sí vincula la identidad `github`. La cuenta
      queda atascada («Verificar con GitHub» → «Identity is already linked»).
      Reabrir desde recientes: sin pantalla de error. Ver el hallazgo del
      2026-10-04 abajo. **Repetido el 2026-10-04 sobre `100ba66` contra
      Supabase real: ✅ pasa.** La defensa sella la cuenta atascada sin abrir
      el navegador, y la vuelta en frío pasa por «Un momento…» y llega a
      Perfil con el sello, sin error; reabrir desde recientes tras otro
      `am kill`, sin error. Ver «Vuelta en frío de GitHub … sobre 100ba66»
      abajo.

## Hallazgos del comprobador

### Vuelta en frío de GitHub contra Supabase real (2026-10-04, sobre 100ba66) — ✅ defensa y origen

**Fila de `profiles`, leída en el servidor** (Claude, por el MCP de Supabase,
solo lectura, tras la pasada): `github_handle = thejowe`,
`github_verified_at = 2026-10-04 17:48:55 UTC`, `link_github =
https://github.com/thejowe` y una identidad `github` en `auth.identities` para
el uid `44491308-…`. Cierra el matiz de abajo: el comprobador no pudo leerla por
REST y lo había deducido de la app.

**Entorno.** Emulador Android 16 (AVD `lockin`). APK release local desde HEAD
`100ba66` (árbol limpio): `expo prebuild --clean` (tras él,
`MainActivity.kt` tiene el `onNewIntent` con `setIntent(intent)` del plugin
`with-new-intent-initial-url`, líneas 32-35 en `build.log`) y `./gradlew
app:createBundleReleaseJsAndAssets --rerun app:assembleRelease`, solo con las
dos `EXPO_PUBLIC_SUPABASE_*` de `.env.local`, sin
`EXPO_PUBLIC_LOCKIN_ALLOW_MOCK`; `adb install -r` sin borrar datos (la sesión
de «Verif GH», `+lockingh1001`, seguía viva). **Supabase real**: `[lockin]
backend de datos: Supabase` en logcat en cada arranque.

**1. Defensa (`adoptLinkedGithubIdentity`).** Cuenta atascada como la dejó la
pasada sobre `70e4042` (identidad `github` vinculada, sello a `null`; la app
mostraba «Verificar con GitHub» sin sello, `02-perfil-antes.*`). Pulsar
«Verificar con GitHub»: **no se abre el navegador** (la actividad arriba
sigue siendo `MainActivity` y no hay ningún `START` en
`logcat-defensa.txt`), no sale «Identity is already linked», y Perfil pasa a
«✓ @thejowe · verificado» con «Quitar verificación» (`03-tras-defensa.*`).
Tras `force-stop` + relanzar, el sello sigue (`04-perfil-frio-defensa.*`).

**2. Origen (`setIntent` en `onNewIntent`).** «Quitar verificación» → sin
sello, también tras `force-stop` (`05-tras-quitar.*`,
`06-perfil-frio-quitado.*`). «Verificar con GitHub» → en cuanto
`CustomTabActivity` queda arriba, modo avión: Custom Tab de `github.com` sin
red (`08-customtab.png`). `am kill app.lockin.mobile` con la app detrás →
`Killing 18333:app.lockin.mobile/u0a218 (adj 700): kill background`, `pidof`
vacío (`pid-tras-am-kill.txt`). Fuera el modo avión: GitHub autoriza solo y
Supabase redirige; logcat: `START u0 {act=VIEW cat=[BROWSABLE]
dat=lockin://auth/... cmp=app.lockin.mobile/.MainActivity} with
LAUNCH_SINGLE_TASK ... result code=2` y `Start proc 18866:app.lockin.mobile
... for next-top-activity` (`logcat-tras-red.txt`): el mismo
`START_DELIVERED_TO_TOP` que el 2026-10-04 sobre `70e4042`, pero ahora **la
app arranca en `auth/callback`**: «Un momento… Estamos actualizando tu
cuenta.» (`rafaga-vuelta/16-18.png`) y pasa directa a Perfil con el sello
(`rafaga-vuelta/19-30.png`, `09-perfil-tras-vuelta.*`), sin «Ese enlace no ha
funcionado». En este logcat no sale «Tried to access onNewIntent while
context is not ready» (no se registra al nivel que vuelca `adb logcat -d`, o
no se dio); da igual, porque la app llegó a `auth/callback`. Después: HOME →
`am kill` (`pidof` vacío) → recientes → tarjeta de LockIn: «Abriendo
LockIn…» → Descubrir, **sin pantalla de error** y sin volver a pasar por
`auth/callback` (`rafaga-recientes/`, `11-tras-recientes.*`); Perfil con el
sello (`12-perfil-tras-recientes.*`) y también tras `force-stop` + relanzar
(`13-perfil-frio-final.*`).

**`profiles`.** No se ha leído por REST esta vez (no hay credencial de la
cuenta a mano para hacerlo). Lo que hay: la app no guarda el perfil en local
(solo sesión e intentos de GitHub en `AsyncStorage`), así que el sello que
sale tras cada `force-stop` + relanzar viene de `profiles` en Supabase; y el
handle `thejowe` es el de la identidad `github`. Si se quiere la fila,
`select github_handle, github_verified_at from profiles where id =
'44491308-7cb4-458b-8789-d41b9a5a4411'` desde el dashboard.

**Estado final de la cuenta.** «Verif GH» queda **verificada** (identidad
`github` vinculada + sello), no atascada.

**Evidencia** (local, ignorada por git):
`e2e/artifacts/local/2026-10-04-github-frio-100ba66/` — `head.txt`,
`build.sh`, `build.log`, `01-arranque.*` … `13-perfil-frio-final.*`,
`rafaga-vuelta/` (con `top.txt`), `rafaga-recientes/`, `pid-tras-am-kill.txt`,
`logcat-arranque.txt`, `logcat-defensa.txt`, `logcat-hasta-kill.txt`,
`logcat-tras-red.txt`, `logcat-vuelta-fria-completo.txt`,
`logcat-recientes.txt`.

### Vuelta en frío de GitHub contra Supabase real (2026-10-04, sobre 70e4042) — ❌ la app no ve el deep link

**Entorno.** Emulador Android 16 (AVD `lockin`). APK release local compilado
desde HEAD `70e4042` (árbol limpio) con `./gradlew
app:createBundleReleaseJsAndAssets --rerun app:assembleRelease`, solo con las
dos `EXPO_PUBLIC_SUPABASE_*` de `.env.local` y sin
`EXPO_PUBLIC_LOCKIN_ALLOW_MOCK`; instalado con `adb install -r`. **Supabase
real**: `[lockin] backend de datos: Supabase` en logcat en cada arranque. La
sesión no había sobrevivido a las pasadas con mock, así que se entró con
«Ya tengo cuenta» en la cuenta «Verif GH» (`+lockingh1001`, uid
`44491308-…`). `profiles` se lee como el 2026-10-01 (login por contraseña
con la anon key y `GET /rest/v1/profiles`).

**Pasos.**
1. Perfil → «Quitar verificación» → `profiles` con `link_github`,
   `github_handle` y `github_verified_at` a `null`, solo la identidad `email`
   (`profiles-tras-quitar.txt`).
2. «Verificar con GitHub». GitHub autoriza solo en ~3 s (la OAuth App sigue
   autorizada en `thejowe`), así que para tener la Custom Tab abierta sin que
   vuelva se activó el modo avión en cuanto `CustomTabActivity` quedó arriba:
   Custom Tab de `github.com` parada, cargando (`11-customtab.*`).
3. Con la app en segundo plano detrás de la Custom Tab: `am kill
   app.lockin.mobile` → logcat `Killing 14318:app.lockin.mobile/u0a218 (adj
   700): kill background`, `pidof` vacío (`pid-tras-am-kill.txt`,
   `logcat-hasta-kill.txt`).
4. Fuera el modo avión: Chrome recarga solo, GitHub autoriza y Supabase
   redirige a `lockin://auth/...`. logcat (`logcat-tras-red.txt`):
   `START u0 {act=VIEW cat=[BROWSABLE] dat=lockin://auth/... flg=0x14000000
   cmp=app.lockin.mobile/.MainActivity} with LAUNCH_SINGLE_TASK ... result
   code=2`, `onActivityRestartAttempt: topActivity=...MainActivity`, y
   `Start proc 15620:app.lockin.mobile ... for next-top-activity`.
5. **La app arranca en Descubrir, no en `auth/callback`** (`14-app-tras-vuelta.*`).
   Ninguna pantalla de «Un momento…» ni de error; logcat de JS solo dice
   `Running "main"` y el backend. (Chrome se quedó colgado con un ANR encima;
   se cerró con «Close app», que solo mata Chrome.)
6. Tab Perfil: **sin sello**, sigue «Verificar con GitHub» (`19-perfil-tras-vuelta.*`).
   En el servidor: identidad `github` (`thejowe`) **creada a las 13:47:36**,
   pero `link_github`, `github_handle` y `github_verified_at` **a `null`**
   (`profiles-tras-vuelta-fria.txt`, igual en `profiles-final.txt`).
7. Segunda parte: HOME → `am kill` (pid vacío) → recientes → tarjeta de
   LockIn: «Abriendo LockIn…» → Descubrir, **sin pantalla de error**
   (`rafaga-recientes/`, `21-tras-recientes.*`). Pero como el code nunca se
   llegó a canjear, esto no ejercita la guarda de «code ya gastado» del
   hallazgo 3; solo dice que no sale error.
8. Consecuencia: «Verificar con GitHub» en caliente ya no sirve. La primera
   vez la Custom Tab no llegó a abrirse (Chrome recién matado; «La
   verificación no se completó. No ha cambiado nada.»,
   `rafaga-caliente-2/`); la segunda sí, y vuelve con **«La verificación con
   GitHub no se ha completado · GitHub no ha completado la verificación
   (Identity is already linked)»** (`26-tras-caliente-3.*`). Y sin sello no
   aparece «Quitar verificación». **La cuenta se queda atascada:** GitHub
   vinculado en GoTrue, sin sello en `profiles` y sin forma de salir desde la
   app.

**Lectura (para `verificacion`; causa probable, no medida en JS).**
`result code=2` es `START_DELIVERED_TO_TOP`: con `launchMode="singleTask"` y
la tarea de LockIn aún en recientes (solo había muerto el proceso), Android
no lanza la actividad con el intent `VIEW`. Recrea `MainActivity` con su
intent de origen (el `MAIN` del lanzador) y entrega el `lockin://` por
`onNewIntent`. Entonces `Linking.getInitialURL()` / expo-router ven el `MAIN`
y arrancan en `/`, y el evento `url` de `onNewIntent` llega antes de que JS
escuche y se pierde. Por eso no se monta `AuthCallback`, no se llama a
`completeAuthLink` y el arreglo del hallazgo 1 (`3c029d6`) nunca llega a
ejecutarse. El test de `auth.test.ts` cubre `completeAuthLink` en frío, pero
no que la URL llegue a la ruta. Hay que capturar el intent nuevo en el lado
nativo, o sacar el deep link de `onNewIntent` cuando la app arranca. Y en
cualquier caso conviene que la tab Perfil (o `refreshGithubVerification()`)
ponga el sello si encuentra una identidad `github` sin sello, porque si no
cualquier vuelta perdida deja la cuenta como en el paso 8. Para
desatascar «Verif GH» antes de repetir: llamar a `sync_github_verification`
con su sesión, o desvincular la identidad desde el dashboard. **No se ha
tocado**: se deja así como evidencia.

**Evidencia** (local, ignorada por git):
`e2e/artifacts/local/2026-10-04-github-frio/` — `build.log`,
`profiles-antes.txt`, `profiles-tras-quitar.txt`,
`profiles-tras-vuelta-fria.txt`, `profiles-final.txt`,
`pid-tras-am-kill.txt`, `01-arranque.*` … `26-tras-caliente-3.*`,
`rafaga-recientes/`, `rafaga-caliente-2/`, `rafaga-caliente-3/`,
`logcat-hasta-kill.txt`, `logcat-tras-red.txt`, `logcat-tras-vuelta.txt`,
`logcat-vuelta-fria-completo.txt`, `logcat-recientes.txt`,
`logcat-caliente*.txt`. (`rafaga-caliente/` está vacía o con un toque
fallido en la tab Matches: no cuenta.)

### Verificar con GitHub contra Supabase real (2026-10-01, tras 17e09f6) — ✅ sin pantalla de error

Repetición de la casilla tras el arreglo del hallazgo de abajo. **El arreglo
es `17e09f6`** (`fix(verificacion): la vuelta de GitHub ya no se canjea dos
veces`, solo `src/data/supabase/auth.ts`).

**Entorno.** Emulador Android 16 (AVD `lockin`), APK release local compilado
desde HEAD `17e09f6` con el árbol limpio (`createBundleReleaseJsAndAssets` se
ejecutó, no salió UP-TO-DATE) e instalado como actualización
(`firstInstallTime` intacto, sesión conservada). **Supabase real**
(`[lockin] backend de datos: Supabase` en logcat). Cuenta «Verif GH»
(`+lockingh1001`, uid `44491308-…`).

**Pasos (dos pasadas, mismo resultado).**
1. Perfil → «Quitar verificación» (se quita sin diálogo) → `profiles` con
   `link_github`, `github_handle` y `github_verified_at` a `null` y solo la
   identidad `email` (`profiles-tras-quitar.txt`, `-2.txt`).
2. «Verificar con GitHub» → Custom Tab de `github.com`. GitHub **no enseña la
   pantalla «Authorize»**: la OAuth App ya estaba autorizada en la cuenta
   `thejowe` desde la prueba anterior y GitHub redirige solo, en ~3 s.
3. Vuelta: un único intent `VIEW lockin://auth/...` a `MainActivity`
   (`START ... result code=2`, entregado a la actividad ya abierta), antes de
   que se cierre la Custom Tab. No hay un evento aparte de «vuelta del
   navegador»: `openAuthSessionAsync` y la ruta de callback salen de ese mismo
   intent, y la app no registra en logcat cuál de los dos canjea primero.
4. Ráfaga de capturas de la segunda pasada (`rafaga/`): Custom Tab → splash →
   «Un momento… Estamos aplicando el enlace de tu correo.» (~1 s) → Perfil.
   **Ningún fotograma con «Ese enlace no ha funcionado».**
5. Perfil → «✓ @thejowe · verificado» en Enlaces y en Verificación
   (`07-perfil-sello.*`). `profiles` con `github_handle = thejowe` y
   `github_verified_at` relleno; identidad `github` nueva en cada pasada
   (`profiles-tras-verificar.txt`, `-2.txt`).
6. `am force-stop` + relanzar → el sello sigue (`09-perfil-frio.*`).

**Detalles menores (no bloquean la casilla).**
- La pantalla intermedia dice «Estamos aplicando el enlace de tu correo.»
  (`src/features/profile/auth-callback.tsx:96`) también en la vuelta de
  GitHub. Dura un segundo, pero el texto no corresponde. **Arreglado
  después:** ahora dice «Estamos actualizando tu cuenta.», que vale para los
  dos casos (solo copy; ningún test fijaba la frase). En Actions sobre
  `5b716e5` (arreglo `17e09f6` + este copy): `CI` verde entera ([run 36932387031](https://github.com/thejowe/lockin/actions/runs/36932387031)),
  `Schema drift` verde en local y remoto ([run 36932386535](https://github.com/thejowe/lockin/actions/runs/36932386535))
  y `E2E Android` verde en las tres variantes ([run 36932386681](https://github.com/thejowe/lockin/actions/runs/36932386681)).
- logcat: `WebCrypto API is not supported. Code challenge method will default
  to use plain instead of sha256.` en cada `linkIdentity`: el PKCE va con
  `plain`, no con `S256`.
- La pantalla de consentimiento de GitHub no se ha vuelto a ver en esta
  pasada (ver paso 2). Para verla habría que revocar la app en
  github.com/settings/applications.

**Evidencia** (local, ignorada por git):
`e2e/artifacts/local/2026-10-01-github-sello-17e09f6/` — `build.log`,
`01-arranque.*` … `09-perfil-frio.*`, `rafaga/01…30-*.png`,
`profiles-tras-quitar*.txt`, `profiles-tras-verificar*.txt`, `logcat.txt`,
`logcat-full.txt`, `logcat-full-2.txt`.

### Verificar con GitHub contra Supabase real (2026-10-01) — ✅ sello, ❌ pantalla de error a la vuelta

**Entorno.** Emulador Android 16 (AVD `lockin`), APK release local
(`android/app/build/outputs/apk/release/app-release.apk`, compilado el
2026-10-01 21:14 UTC e instalado a las 21:17; posterior al último cambio de
`src/data/supabase/auth.ts`, `src/app/auth/callback.tsx` y
`src/features/profile/`, así que equivale a HEAD `4b9c1bf` en lo que toca
aquí). **Supabase real** (`[lockin] backend de datos: Supabase` en logcat).
El dashboard ya redirige con `client_id=Ov23liktGQvjwB1jS3qK`.

**Cuenta.** La sesión de `+lockin3` ya no estaba en el emulador (los datos de
la app se habían borrado) y su contraseña no consta en ningún sitio, así que
se dio de alta una cuenta nueva: `joeldetorres123+lockingh1001@gmail.com`,
perfil «Verif GH», uid `44491308-7cb4-458b-8789-d41b9a5a4411`. Gastó un
correo de confirmación de GoTrue (abierto en el Gmail del emulador). Queda en
la base de datos real; se puede borrar desde el dashboard.

**Pasos.**
1. `profiles` antes: `link_github`, `github_handle` y `github_verified_at` a
   `null`; una sola identidad, `email` (`profiles-antes.txt`).
2. Perfil → «Verificar con GitHub» → Custom Tab de Chrome con **«Authorize
   LockIn» by thejowe**, «Authorizing will redirect to
   https://grrzmzktrhksbttpbblg.supabase.co» (`22-navegador.png`). La sesión
   de GitHub seguía iniciada: no hizo falta login. El Client ID ya es bueno.
3. «Authorize thejowe» → GitHub → Supabase → `lockin://auth/...` abre
   `MainActivity` (logcat 21:34:30). **La app enseña «CUENTA · Ese enlace no
   ha funcionado · No hemos podido completar la operación. Inténtalo otra
   vez. Tu cuenta no ha cambiado.»** (`23-tras-authorize.png`).
4. Pero en el servidor sí cambió: identidad `github` (`thejowe`) creada a las
   21:34:32 y `profiles` con `link_github = https://github.com/thejowe`,
   `github_handle = thejowe`, `github_verified_at = 2026-10-01T21:34:33Z`
   (`profiles-tras-authorize.txt`). Client Secret y callback URL, por tanto,
   correctos.
5. «Volver a mi perfil» → sello **«✓ @thejowe · verificado»** en Enlaces y en
   Verificación, con «Quitar verificación» (`25-perfil-sello.png`).
6. `am force-stop` + relanzar → el sello sigue (`26-perfil-frio.*`).

**El fallo (para `verificacion`).** `linkIdentity` usa como `redirectTo`
`lockin://auth/callback`, la misma ruta que los enlaces de los correos de
cuenta. En Android la vuelta del navegador llega también como intent a
`MainActivity`, expo-router monta `src/app/auth/callback.tsx` y `AuthCallback`
trata el código como un enlace de correo. Leyendo el código: el mismo
`code` PKCE, que es de un solo uso, se canjea dos veces —
`completeOAuthCallback` (`src/data/supabase/auth.ts:596`, tras
`openAuthSessionAsync`) y el canje de enlaces de correo (`auth.ts:520`, desde
la ruta de callback)—; gana uno (el sello queda puesto) y el otro pinta el
error. Qué canje gana no se ha medido. Resultado: quien verifica ve «Tu cuenta no
ha cambiado» justo cuando acaba de cambiar, y tiene que volver a Perfil para
descubrir el sello. Arreglo probable: un `redirectTo` propio para el OAuth
(p. ej. `lockin://auth/github`) que la ruta de correos no intercepte, o que
`AuthCallback` ignore la vuelta de `linkIdentity`. Repetir esta casilla
después del arreglo. **Arreglado en `17e09f6` y repetido el mismo día: ✅
sin pantalla de error (ver el hallazgo «tras 17e09f6» arriba).**

**Evidencia** (local, ignorada por git):
`e2e/artifacts/local/2026-10-01-github-sello/` — `20-perfil-antes.*`,
`21-verificacion.*`, `22-navegador.png`, `23-tras-authorize.*`,
`24-perfil-tras-volver.*`, `25-perfil-sello.*`, `26-perfil-frio.*`,
`profiles-antes.txt`, `profiles-tras-authorize.txt`, `logcat.txt`,
`logcat-full.txt`.

### Verificar con GitHub contra Supabase real (2026-09-24) — ❌ Client ID mal puesto

**Entorno.** Emulador Android 16 (AVD `lockin`), APK universal `preview` de
EAS (`app.lockin.mobile`, construido desde `21418ee`; entre ese commit y
`c81e124` no cambia `src/data/supabase/auth.ts` ni la tab Perfil). **Supabase
real** (`[lockin] backend de datos: Supabase` en logcat). Cuenta `+lockin3` /
perfil «Verif» (`a5fe4d5c-…`).

**Pasos.**
1. `profiles` de Verif antes de empezar: `link_github`, `github_handle` y
   `github_verified_at` a `null` (`profiles-antes.txt`).
2. Perfil → «Verificar con GitHub» → se abre una Custom Tab de Chrome en
   `github.com` con «Sign in to GitHub» (`04-login.png`). Hasta aquí, bien:
   `linkIdentity` responde, así que Enable Manual Linking está activo.
3. El usuario inicia sesión en GitHub → **«Page not found · GitHub»**
   (`05-vuelta.png`). No hay pantalla de «Authorize» ni vuelta a `lockin://`.
4. Al cerrar la pestaña, la app dice «La verificación no se completó. No ha
   cambiado nada.» (`06-tras-cerrar-tab.png`). `profiles` sigue igual, todo a
   `null` (`profiles-despues.txt`). El fallo se maneja bien.

**Causa.** `GET /auth/v1/authorize?provider=github` del proyecto redirige a
`https://github.com/login/oauth/authorize?client_id=Lockin&…`. **`Lockin` no es
un Client ID de GitHub**: los reales tienen la forma `Ov23li…` y se copian de
Settings → Developer settings → OAuth Apps. Con un `client_id` que no existe,
GitHub manda al login y, con la sesión ya iniciada, responde 404. Es
configuración del dashboard: no es código ni SQL.

**Qué hace falta (usuario).** En Authentication → Providers → GitHub,
sustituir el Client ID por el de la OAuth App y volver a pegar su Client
Secret, porque probablemente también esté mal. La Authorization callback URL
de la OAuth App tiene que ser
`https://grrzmzktrhksbttpbblg.supabase.co/auth/v1/callback`. Después, que el
comprobador repita la casilla de arriba.

**Visto de paso (para `verificacion`, menor):** al pulsar el botón, logcat
dice `WebCrypto API is not supported. Code challenge method will default to
use plain instead of sha256.` Es decir, el PKCE de `linkIdentity` va en
`plain` en React Native. Funciona, pero sin la protección de S256.

**Evidencia** (local, ignorada por git):
`e2e/artifacts/local/2026-09-24-github-sello/` — `01-perfil-antes.*`,
`02-verificacion.*`, `03-navegador.png`, `04-login.png`, `05-vuelta.*`,
`06-tras-cerrar-tab.*`, `profiles-antes.txt`, `profiles-despues.txt`,
`logcat.txt`.

## Runs de CI sobre el commit de cierre (`5170f64`)

Una pasada local no es el veredicto: este repo lo aprendió a base de tres
commits con CI rojo que nadie miró porque «en local iba».

- [x] `CI` — [run 35211856053](https://github.com/thejowe/lockin/actions/runs/35211856053),
      **verde entera**: Lint, Formato, Tipos, Tests, Export web, SQL embebido y
      Runner E2E. El **Formato en verde** es lo que cierra el punto ciego de
      esta máquina: en local `npm run format:check` da ~100 archivos falsos por
      CRLF, así que el veredicto solo se puede leer aquí.
- [x] `Schema drift` — [run 35211856006](https://github.com/thejowe/lockin/actions/runs/35211856006),
      verde en local **y en remoto**.
- [x] `E2E Android` — [run 35214150045](https://github.com/thejowe/lockin/actions/runs/35214150045)
      sobre `4427d21` (el primer HEAD que incluye `5170f64` y llegó a terminar;
      los cuatro intentos anteriores salieron `cancelled` porque `calidad`
      empujó documentación mientras corrían y el grupo de concurrencia cancela
      la pasada previa en cada push). **Variante `mock` verde; variante
      `supabase` roja, y no por este bloque** — ver abajo.

### El rojo de `E2E Android (supabase)` es anterior a este bloque

Falla en la **primerísima aserción** del recorrido, antes de tocar nada de
verificación: `extendedWaitUntil visible: 'Cofundador'` con 60 s de margen, o
sea la pantalla de modo del onboarding recién arrancada la app. El volcado de
Maestro (`window.xml` de `attempt-02`) enseña lo que hay en pantalla en su
lugar:

    No hemos podido recuperar tu perfil
    Comprueba tu conexión y vuelve a intentarlo.
    REINTENTAR

Eso es la pantalla de error de arranque que introdujo `d76ba71`
(`fix: handle profile and session recovery errors on startup`, de
`arquitecto`): la app no pudo resolver su sesión contra Supabase real y lo dijo
en vez de mandar al onboarding. La variante `mock` pasa entera, que es lo que
descarta que sea la UI.

**No lo causa `verificacion`.** El mismo fallo, con la misma aserción y la
misma variante, sale en el [run 35154808314](https://github.com/thejowe/lockin/actions/runs/35154808314)
sobre `1987a9c` —el commit *anterior* a la Tarea 5 de este bloque— y en las
pasadas del 2026-09-16 desde `docs(video): cierra el bloque`. Es decir: la
variante `supabase` lleva roja desde antes de que existiera una sola línea de
sello.

Sospecha para quien lo coja (no verificada, y por eso se escribe como
sospecha): el arranque usa `signInAnonymously()`, y el proyecto tiene un límite
de **30 altas anónimas por hora e IP** que `supabase/README.md` ya documenta.
El 2026-09-16 y el 2026-09-17 se encadenaron muchas pasadas de E2E y de la
suite de contrato desde la misma IP de Actions. Antes de tocar código conviene
descartarlo mirando la respuesta real del endpoint de auth.

> **DESCARTADA el 2026-09-18, por `calidad`.** La variante `supabase` de
> `E2E Android` habla con un Supabase **local desechable** (`127.0.0.1:54321`,
> Docker, levantado y tirado en cada run — `e2e/run.mjs:108`), nunca con el
> proyecto cloud `grrzmzktrhksbttpbblg` al que sí aplica el límite de 30/hora
> que documenta `supabase/README.md:392-393`. Y solo hay una llamada a
> `signInAnonymously()` antes de la aserción que falla, contra un `auth.users`
> recién creado. No puede ser el límite. Causa real seguida buscando en el
> arranque, sin cerrar; detalle en `docs/plan/todo/calidad.md` →
> "`E2E Android (supabase)` en rojo desde antes de `verificacion`".

### Y el que sí cerró

- [x] `Contrato Supabase` (opt-in) — [run 35213552961](https://github.com/thejowe/lockin/actions/runs/35213552961),
      **verde**: 57 pasan, 0 fallan, 21 saltados y todos declarados. Es la
      primera pasada verde de este job desde el 2026-09-15.

### El rojo de `Contrato Supabase`, que no era de este bloque solo

Ese job llevaba **rojo desde el 2026-09-15** sin que nadie lo viera: su guarda
compara los tests saltados contra una lista blanca explícita y revienta si
aparece uno sin declarar, y los **seis casos de `rachas`** nunca se añadieron.
Como el job es `workflow_dispatch`, no se ejecuta solo y el rojo no se vio.

Los **cinco de verificación** de este bloque se sumaban al problema, y no son
saltos de reloj como los demás: se saltan por `canLinkIdentityWithoutBrowser:
false`, porque un OAuth de verdad necesita un navegador y una persona al otro
lado. Contra el mock corren enteros.

Los once se declararon en `ad69754` y el job volvió a verde a la primera.

### El E2E Android cayó con `100ba66` (2026-10-04)

Los tres jobs de `E2E Android` (mock, registro, supabase) fallaron en «Build
release del APK» con `PluginError: Failed to resolve plugin for module
"./plugins/with-new-intent-initial-url"`. `e2e/run.mjs` copia a la app
desechable una lista cerrada de entradas y `plugins/` no estaba: es el primer
config plugin local, los anteriores venían de `node_modules`. Arreglado
añadiendo `plugins` a esa lista.

### «Recuperar contraseña por correo» cayó en `registro` sobre `46cd3e0` (2026-10-04) — no era `setIntent`

Run 37228331950, fase `password-reset-confirm`: tras pulsar «Guardar
contraseña» no aparece «Contraseña guardada…» y la app está en Matches. El
mismo caso había pasado sobre `22608a0` (run 37226087232), el primer E2E con
`plugins/with-new-intent-initial-url.js`, y se sospechó del `setIntent`.

**Descartado.** El enlace se canjeó bien: el caso llegó a Perfil, encontró
«Email de tu cuenta: …» y escribió la contraseña. Lo que cambió de pestaña
fue el propio toque. `maestro.log` de los dos runs:

| run | «Contraseña de tu cuenta» | «Guardar contraseña» | toque |
| --- | --- | --- | --- |
| 37226087232 (verde) | y=1809–1941 | y=2005–2063 | (539, 2034) |
| 37228331950 (rojo) | y=1980–2112 | y=2176–2234 | (539, **2205**) |

La barra de pestañas flotante (`app-tabs.tsx`, `position: absolute`) ocupa
y=2171–2291 en el emulador de CI (`window.xml`). Maestro no la cuenta como
tapa: `scrollUntilVisible` da el botón por visible al 100 % y deja de
desplazar, y el toque cae en la barra. La jerarquía del fallo tiene Matches
`selected`. Que unas veces pase y otras no es el recorrido del gesto de
desplazar, que no es siempre igual (dos swipes en los dos runs, 171 px de
diferencia al final).

**Arreglo, solo en el caso** (la app sí deja el botón por encima de la barra
si se desplaza: el `ScrollView` de Perfil lleva `BottomTabInset` de relleno
inferior): `centerElement: true` en los dos `scrollUntilVisible` que preceden
a un `tapOn` en `e2e/password-reset.yaml`. Con él Maestro 2.10 sigue
desplazando hasta que el centro del elemento queda por encima de y≈1680 (o
hasta el final de la lista). Guardia nueva `e2e/tab-bar-overlap.test.mjs`
(`npm run test:e2e`), roja antes del cambio y verde después.

**Resultado** (run 37231590523 de `E2E Android` sobre `a768426`): `registro` y
`mock` en verde. En `password-reset-confirm` el campo sube de y=1891 a y=1324
con un swipe más y el toque de «Guardar contraseña» cae en (539, 1549), lejos
de la barra.

**Aparte, sin relación con este arreglo:** `supabase` sigue rojo, y no por la
app. Los siete flujos de UI pasan; lo que falla es el oráculo del runner justo
después de `sign-in-abandon.yaml`, en `admin.auth.admin.getUserById` («fetch
failed»). La petición no llega a Kong: su log de acceso, en
`memoria-contenedores.txt`, no tiene ninguna petición `node` después de las
de antes del flujo. Los contenedores siguen «Up» y quedan 13 GB libres, así
que no es el OOM que sospechaba `visual.md`. Ha fallado en los tres intentos
que llegaron ahí desde `22608a0`: el attempt-02 de 37228331950 y el
attempt-01 de 37231590523 y de su relanzamiento. Con `22608a0` (run
37226087232) pasó. Entre medias no cambió nada de `e2e/` ni de `supabase/`,
solo `paths-ignore` en los workflows. Probé si era un socket keep-alive
caducado mientras `spawnSync` bloquea el event loop, con un servidor aparte
que cierra a los 3 s y un bloqueo de 6 s, pero undici no falla. Queda
**abierto**. El siguiente paso es instrumentar el `fetch` del cliente `admin`
(`global.fetch` envuelto) para guardar `error.cause`, que auth-js descarta al
crear `AuthRetryableFetchError`.
