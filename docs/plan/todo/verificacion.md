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

Ninguna de estas cuatro la puede cerrar un agente. Hasta entonces el bloque
está probado contra el mock y contra PGlite, que es donde llega el desarrollo.

- [ ] Crear una GitHub OAuth App y poner client ID y secret en
      Authentication → Providers → GitHub del dashboard de Supabase, con la
      callback URL que indique el propio dashboard.
- [ ] Activar **Enable Manual Linking** en Authentication → Settings. Está
      desactivado por defecto y sin él `linkIdentity()` falla siempre.
- [x] Aplicar `20260916000100_github_verification.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor — **hecho el 2026-09-17**,
      confirmado por el cotejo remoto (ver arriba).
- [ ] Verificar el flujo en un dispositivo con el dev client de EAS: el OAuth
      necesita un navegador de verdad y un deep link de vuelta.

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
