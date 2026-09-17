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

## El rojo de `Schema drift` que es el estado correcto

> Hasta que la migración se aplique en el proyecto real, el job remoto de
> `Schema drift` **debe salir rojo**, y eso no es deriva: es esta migración
> esperando. Es la única vez que un rojo ahí es el estado correcto. En cuanto
> se aplique, vuelve a ser deriva real.

Esto contradice temporalmente lo que dice `docs/plan/TODO.md` desde el
2026-09-13 («desde aquí, un rojo del job remoto es deriva real»), y por eso se
escribe explícitamente aquí y allí — para que nadie lo descubra a base de un
rojo confuso y se ponga a «arreglar» una deriva que no existe.

---

## Pendiente del usuario

Ninguna de estas cuatro la puede cerrar un agente. Hasta entonces el bloque
está probado contra el mock y contra PGlite, que es donde llega el desarrollo.

- [ ] Crear una GitHub OAuth App y poner client ID y secret en
      Authentication → Providers → GitHub del dashboard de Supabase, con la
      callback URL que indique el propio dashboard.
- [ ] Activar **Enable Manual Linking** en Authentication → Settings. Está
      desactivado por defecto y sin él `linkIdentity()` falla siempre.
- [ ] Aplicar `20260916000100_github_verification.sql` en
      `grrzmzktrhksbttpbblg` por el SQL Editor.
- [ ] Verificar el flujo en un dispositivo con el dev client de EAS: el OAuth
      necesita un navegador de verdad y un deep link de vuelta.

## Runs de CI

- [ ] Anotar aquí `CI` y `E2E Android` sobre el commit de cierre. Una pasada
      local no es el veredicto: este repo lo aprendió a base de tres commits
      con CI rojo que nadie miró porque «en local iba».
