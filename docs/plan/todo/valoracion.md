# TODO — valoracion

Plan: `docs/superpowers/plans/2026-09-15-valoracion-post-sesion.md`. Spec:
`docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`. Una
casilla por tarea del plan; se marca al hacer su commit, con la evidencia real
al lado (comando y resultado, o run de Actions con su URL) — no solo la marca.

Alcance de archivos: los mismos que `sesiones`, que es lo que hace que estos dos
bloques **nunca se lancen a la vez**. Ver `docs/plan/PLAN.md` → bloque 8.

- [x] Tarea 1 — Dominio, reglas puras y contrato — `SessionRating` y
      `SessionRatingEntry` en `types.ts`; `RATING_WINDOW_HOURS`,
      `isInRatingWindow` y `attendedSession` en `sessions.ts`;
      `getRatable`/`getMyRating`/`rate` en `LockInSessionRepository`, con la
      regla nueva en su JSDoc. `src/data/index.ts` **no hizo falta tocarlo**:
      reexporta `./types` y `./sessions` con `export *`, así que lo nuevo ya
      sale de `@/data` (el Step 4 del plan da por hecho una lista de nombres que
      el archivo no tiene). 7 casos nuevos en `sessions.test.ts` (bordes de la
      ventana de 24 h, los tres estados que no se valoran, y asistencia con
      `joinedAt` exclusivo, sin fila, de otra persona y con `leftAt`).
      Añadir los tres métodos a la interfaz deja sin compilar a sus dos
      implementaciones, así que el mock (`src/data/mock/sessions.ts`) y Supabase
      (`src/data/supabase/sessions.ts`) llevan de momento métodos que lanzan
      `todavía no está implementado` —visibles, sin `@ts-expect-error` ni
      `any`—, con un caso cada uno que lo fija y que **se borra** en las Tareas 2
      y 4 al escribir la implementación real (también mantienen el suelo de
      cobertura: sin ellos, funciones bajaba a 90.67 % < 91.49 %).
      Verificado 2026-09-15: `npx tsc --noEmit` limpio, `npx jest
      src/data/sessions.test.ts` 21/21, `npm run lint` limpio, y de más
      `npx jest --coverage` con 522 pasando, 52 saltados (contrato opt-in) y
      sin aviso de umbral.
- [x] Tarea 2 — Mock y casos de contrato — `ratings` en `MockState` y en
      `resetState()`; `getRatable`/`getMyRating`/`rate` en memoria, con el helper
      local `bothAttended` y **sin llamar a `changed()`** al valorar: la
      valoración es privada, y avisar publicaría por el canal del match que
      alguien acaba de valorar. Retirado el andamio de la Tarea 1 —los tres
      stubs del mock y su caso en `src/data/mock/index.test.ts`—, que es lo que
      los casos nuevos pasan a cubrir de verdad. 11 casos en
      `repositories.contract.ts` (`describe('valoración')`): 9 con
      `itWithTimeTravel`, que contra Supabase se saltarán porque `propose` exige
      5 min de margen, y 2 con `it` normal (sesión viva y tercero sin acceso).
      **Desvío del plan, a propósito:** el Step 2 dejaba que una sesión
      cancelada o rechazada saliera por `SessionWindowError` (`isInRatingWindow`
      ya es falso para esos estados), pero la tabla de errores de la spec y el
      Step 1 de la Tarea 3 piden LI004 ahí, así que `rate` mira el estado
      **antes** que la ventana y el contrato fija `SessionForbiddenError` — si
      no, el mock y Supabase discreparían en la Tarea 4. Caso de más, no listado
      en el plan: con dos sesiones terminadas sin valorar se ofrece la más
      reciente (spec § 3), que es lo que fijará el `order by starts_at desc
      limit 1` del RPC.
      Verificado 2026-09-15: `npx jest src/data/mock src/data/sessions.test.ts`
      102/102, `npx tsc --noEmit` limpio, `npm run lint` y `npm run format:check`
      limpios, y `npm test -- --coverage` con 530 pasando, 63 saltados (contrato
      opt-in) y sin aviso de umbral — 92.17/84.15/92.00/93.84 sobre el suelo
      89.82/82.56/91.49/91.38.
- [x] Tarea 3 — Migración SQL y cobertura en PGlite —
      `supabase/migrations/20260915000100_session_ratings.sql`: enum
      `session_rating`, tabla `session_ratings` (PK `(session_id, profile_id)`,
      sin update ni delete), `session_rating_window_is_open`,
      `session_both_attended`, `rate_session` y `ratable_session`, con
      `revoke`/`grant` al final. Las dos decisiones que no se copian de
      `20260913000100`: la política de select es
      `profile_id = (select auth.uid())` —no `is_session_member`— y la tabla
      **no** entra en `supabase_realtime`; las dos quedan fijadas en la huella
      de esquema por sendas aserciones del test embebido, no solo por el
      comentario. Orden de validación de `rate_session`: estado `aceptada`
      (LI004) → ventana (LI003) → asistencia de los dos (LI004) → insert
      idempotente (`on conflict do nothing` + comparación, LI001 si difiere).
      **Corrección al plan:** el Step 1 dice que
      `session_rating_window_is_open` "ya devuelve falso para una cancelada o
      rechazada" y que apoyarse solo en ella daría LI003; no es así — su firma
      (la que fija el propio plan y la spec) no recibe el estado, así que sin
      la comprobación aparte y primera una sesión cancelada dentro de su
      ventana **se valoraría sin error ninguno**. Comprobado borrando esa
      guarda: el test embebido pasa de `LI004` a `sin error`.
      **Cobertura de más, a propósito:** el Step 2 solo pedía las cuatro
      fronteras de la ventana, los cuatro casos de asistencia y `rls=t`, pero
      los casos de contrato del RPC se saltan contra Supabase (necesitan una
      sesión terminada), así que el SQL de `rate_session`/`ratable_session` se
      quedaría sin cobertura en ningún sitio: el test embebido los ejecuta
      ahora de verdad —idempotencia, LI001, LI004 por asistencia, LI004 por
      cancelada, LI003 pasadas 24 h, y `order by starts_at desc limit 1` con
      dos valorables—, con `auth.uid()` sustituida dentro de la transacción y
      un savepoint por sonda. Todo en una transacción que acaba en `rollback`.
      Verificado 2026-09-15 con PGlite 0.3.14 instalado fuera del repo:
      `PGLITE_MODULE=… node --test supabase/schema-embedded.test.mjs` → 1/1
      («9 migraciones; digest 8cb04a016337d90f08607538bad9b748; 280 objetos»),
      y con `schema-compare.test.mjs` + `cleanup.test.mjs` → 10/10.
      `npm run lint` y `npm run format:check` limpios. `drift-check.mjs` lee la
      migración nueva sin tocarlo (8 tablas, 10 enums, 23 funciones); su sondeo
      remoto necesita credenciales y no se ejecuta aquí.
- [x] Tarea 4 — Repositorio de Supabase — `SessionRatingRow` y
      `toSessionRatingEntry` (con `toIso` sobre `rated_at`), y los tres métodos
      contra los RPCs de la Tarea 3: `getRatable` → `ratable_session` (`setof`,
      cero o una fila, pasada por `remember()` para que `matchOfSession` quede
      al día), `getMyRating` → **select directo** a `session_ratings` y `rate` →
      `rate_session`. Retirado el andamio de la Tarea 1: los tres stubs y su
      caso en `src/data/supabase/sessions.test.ts`. Las dos decisiones que el
      patrón del archivo invita a desandar quedan fijadas por un test, no solo
      por el comentario: `getMyRating` **no filtra por `profile_id`** —lo hace
      la política `profile_id = auth.uid()`, y el caso comprueba que la cadena
      de la consulta no lo menciona, para que una política relajada salga en el
      caso de privacidad del contrato en vez de quedar tapada por un `where`
      nuestro— y `rate` **no llama a `notifyForSession`**, con `join` en el
      mismo caso como contraste (el listener sigue en 0 tras valorar y pasa a 1
      tras entrar).
      **Hueco del plan, no desvío:** el Step 1 pide «`SessionRatingRow` y las
      dos funciones nuevas», pero `getMyRating` hace `from('session_ratings')`
      con el cliente tipado, así que hace falta además la entrada de la tabla en
      `Database['public']['Tables']` (sin ella no compila) y el enum
      `session_rating` en `Enums`, que es donde ya están los otros ocho. Con la
      tabla declarada, `.select('rating').maybeSingle()` tipa como
      `{ rating: SessionRating } | null` y no necesita el `as` que sí llevan las
      lecturas con `select('*')` del mismo archivo.
      Verificado 2026-09-15: `npx jest src/data/supabase` 49/49 (63 saltados,
      contrato opt-in — no se ejecuta contra Supabase real: no hay credenciales
      y los casos de valoración se saltarían igual por necesitar una sesión
      terminada), `npx tsc --noEmit`, `npm run lint` y `npm run format:check`
      limpios, y `npm test -- --coverage` con 537 pasando y sin aviso de umbral
      — 92.13/84.11/92.01/93.88 sobre el suelo 89.82/82.56/91.49/91.38, que era
      justo lo que sostenía el andamio borrado.
- [x] Tarea 5 — La pantalla de sesión — `rating.ts` (`RATING_OPTIONS`,
      `ratingLabel`, `endingView`), `rating-chips.tsx` (tres `Pressable` con
      `accessibilityRole="radio"`, 44 de alto y `Spacing.two` de separación) y
      `use-rating.ts` (dos `useQuery` —`getMyRating` y `listAttendance`— más la
      escritura). `useAttendance` **no se toca**: sigue siendo el efecto de
      entrar y salir, y las filas que mira `endingView` se leen aparte. La rama
      `ended` de `src/app/session/[sessionId].tsx` pasa a los tres finales de la
      spec § 2, con la línea "Gracias — solo lo ves tú" y sin navegar al tocar.
      Cuatro cosas que el plan no fijaba y se decidieron leyendo el código:
      **(a)** el test de la pantalla vive en `test/app/sessionId.test.tsx`, no en
      `src/app/` (`jest.config.js` lo explica: un test ahí arrastraría RNTL al
      bundle de expo-router), así que el `Verify` del plan —`npx jest
      src/features/session src/app`— no lo ejecuta; se corrió también `test/app`.
      **(b)** `endingView` no recibe `nowMs`: lo que mira es quién entró antes de
      `endsAt`, que sale de la propia sesión, y cruzar las 24 h con la pantalla
      abierta lo resuelve el error de `rate` (spec § 3), no una comprobación
      previa. **(c)** ante `SessionWindowError`/`SessionForbiddenError` los chips
      **desaparecen** y queda "Ya no se puede valorar": el Step 3 decía
      "deshabilita los chips", pero la spec § 2 manda pasar al tercer caso —un
      mensaje y el botón de volver—, y un chip deshabilitado invita a insistir.
      Para distinguir ese error del reintentable, los dos textos viven en
      `rating.ts` como `RATING_CLOSED`/`RATING_FAILED` y se exportan del barril:
      dos nombres más de los que lista el Step 5. **(d)** `useRating` devuelve
      `attendance: SessionAttendance[] | null` —`null` mientras se lee— y la
      pantalla espera también a `me`: con `[]` por defecto se vería "Núria no
      entró" un instante antes de preguntar.
      **Hueco conocido, no tapado:** `endingView` tiene tres casos para cuatro
      combinaciones de asistencia, así que si la otra persona sí entró y **tú
      no**, la pantalla dice "{nombre} no entró", que es inexacto. Solo se llega
      abriendo una sesión terminada a la que nunca entraste, y arreglarlo pedía
      un cuarto caso que ni la spec ni el plan tienen.
      Caso de más, no listado en el Step 6: un `SessionConflictError` no enseña
      nada (spec § 3, "toque en dos chips seguidos").
      Verificado 2026-09-15: `npx jest src/features/session src/app test/app`
      133/133 (22 suites), `npx tsc --noEmit`, `npm run lint` y
      `npm run format:check` limpios, y `npm test -- --coverage` con 554 pasando
      (537 antes), 63 saltados (contrato opt-in) y sin aviso de umbral —
      92.30/84.66/92.14/94.03 sobre el suelo 89.82/82.56/91.49/91.38.
- [x] Tarea 6 — La tarjeta del chat — `CardView` gana `valorar` y `cardView`
      pasa a `(live, ratable, myProfileId, nowMs)`, con la lógica de la sesión
      viva movida tal cual a un `liveView` privado para que **la viva gana
      siempre** se lea en una línea (`if (view.kind !== 'agendar') return view`).
      `useActiveSession` añade el `useQuery` de `session:ratable:${matchId}` y
      devuelve `ratable`; los dos `refresh` de `useQuery` se juntan en uno solo
      con `useCallback`, que es lo que hace imposible olvidar el segundo desde el
      `subscribe` y desde el tic de 30 s. La tarjeta pinta `valorar` con
      `RatingPrompt`, un subcomponente que monta `useRating` **solo cuando toca**:
      llamarlo desde `SessionCard` obligaría a pasarle un `sessionId` vacío en
      todos los demás estados y lanzaría dos consultas por chat abierto.
      **Tres cosas que el plan no fijaba:** (a) el hook no tenía test propio, así
      que se crea `use-active-session.test.tsx` (no está en la lista de Files del
      plan) con el tic y el aviso del repositorio comprobando **las dos**
      consultas; verificado por mutación —quitando `refreshRatable()` del
      `refresh` combinado se ponen en rojo 3 casos, dos de ese archivo y el de la
      tarjeta volviendo a `agendar` tras valorar—. (b) El Step 3 solo describe
      pregunta → "Gracias", pero `useRating` puede devolver error: la tarjeta
      enseña los dos mensajes, y con `RATING_CLOSED` retira los chips igual que
      la pantalla (decisión (c) de la Tarea 5), porque un chip que el servidor no
      va a aceptar invita a insistir. (c) `index.ts` no hace falta tocarlo:
      `cardView`/`CardView` ya salían del barril y `SESSION_TICK_MS` sigue siendo
      interno del bloque.
      Verificado 2026-09-15: `npx jest src/features/session test/app` 142/142
      (23 suites) —el `Verify` del plan no incluye `test/app`, donde vive el test
      de la pantalla de sesión, así que se corrieron los dos—, `npx tsc --noEmit`,
      `npm run lint` y `npm run format:check` limpios, y `npm test -- --coverage`
      con 563 pasando (554 antes), 63 saltados (contrato opt-in) y sin aviso de
      umbral — 92.47/84.95/92.35/94.20 sobre el suelo 89.82/82.56/91.49/91.38.
- [x] Tarea 7 — E2E Android y cierre — `e2e/session-rate.yaml` (relanza la app,
      abre el chat, toca `Genial` y espera "Gracias — solo lo ves tú"),
      `prepareSessionRating` y `verifySessionRating` en `e2e/verify.mjs`, y el
      encadenado en `e2e/run.mjs` justo tras `verifySessionAttendance`, con su
      propia carpeta de evidencia (`rating/`) y `rating: 'verified'` en
      `postgres.json`. Cuatro casos nuevos en `e2e/session.test.mjs`.
      **Sin fixture de seed, a propósito:** `session-now.sql` deja una sesión
      viva media hora y salir no la termina, así que un segundo trigger dejaría
      dos sesiones en el match y la viva tapa a la valorable (`cardView`) — la
      tarjeta nunca llegaría a preguntar y el caso fallaría sin que nada
      estuviera roto. Se reaprovecha la sesión que el recorrido acaba de vivir,
      envejeciéndola entre flujos. **Y se mueve también `joined_at`**, no solo
      `starts_at`: asistir es haber entrado antes del final, así que dejar la
      entrada real (de hace segundos) por detrás del nuevo final rompería justo
      la regla que el caso prueba. Hay un test que lo fija.
      Verificado aquí el 2026-09-15: `npm run test:e2e` 58/58 (la guardia del
      runner, que incluye los cuatro casos nuevos), `npx tsc --noEmit`,
      `npm run lint` y `npx prettier --check e2e/` limpios, y
      `npm test -- --coverage` con 563 pasando y 63 saltados.
      **Verde en Actions sobre este mismo commit (`387b80f`)**, que es lo que
      convierte esta casilla en recorrido comprobado y no solo código escrito:
      - `E2E Android`, [run 34969393663](https://github.com/thejowe/lockin/actions/runs/34969393663):
        las dos variantes en verde, `supabase` a la primera («Recorrido supabase
        verde tras 1 intento(s)», fase `journey` en `success`). El toque en
        "Genial" ocurrió en un emulador de verdad.
      - `CI`, [run 34969393666](https://github.com/thejowe/lockin/actions/runs/34969393666).
      - `Schema drift`, [run 34969393633](https://github.com/thejowe/lockin/actions/runs/34969393633):
        el job local **en verde** —la migración se aplica sola a una Supabase
        desechable y la huella cuadra— y **solo en rojo el job remoto**, que es
        el esperado hasta que se aplique la migración (ver "Pendiente del
        usuario"). Falla en el paso "Huella remota y diff contra las
        migraciones", que es exactamente donde tiene que fallar.

      **Matiz sobre la evidencia, para no venderla por más de lo que es:** no se
      ha leído con los ojos la línea de oráculo «Postgres: valoración de la
      sesión Lock-In verificada.» en el log. El `tail` de la API de Actions está
      capado y no alcanza ese paso, y el artefacto con `postgres.json` vive en
      un host que el proxy de salida de este entorno bloquea. Lo que sí sostiene
      la afirmación es la estructura: la variante `supabase` solo llega a
      veredicto verde pasando por `prepareSessionRating`, el flujo
      `session-rate.yaml` y `verifySessionRating`, y ese orden lo fija un caso
      de `e2e/session.test.mjs`. Un fallo de cualquiera de los tres habría
      dejado el job en rojo.

## Deuda detectada, fuera del alcance de este bloque

- [ ] **`supabase/schema-embedded.test.mjs` no lo corre ningún workflow.**
      Comprobado el 2026-09-15: no aparece en `ci.yml`, `contract.yml`,
      `e2e.yml` ni `schema-drift.yml`, y PGlite no está en `package.json` — hay
      que instalarlo fuera del árbol a mano (`supabase/README.md` → línea 469).
      Es una condición heredada de la pieza `sesiones`, no algo que introduzca
      la valoración, pero ahora pesa más: como los casos de contrato del RPC se
      saltan contra cualquier backend real (necesitan una sesión terminada, y
      `propose_session` no deja crearla), **ese test es la única cobertura
      ejecutable del comportamiento de `rate_session` y `ratable_session`**, y
      depende de que alguien se acuerde de correrlo. Lo que sí cubre CI es la
      *forma* del esquema: `schema-ci.mjs local` aplica las migraciones a una
      Supabase desechable y compara la huella.
      Arreglarlo es de `calidad`, no de aquí: toca `package.json` y
      `.github/workflows/`, que son su alcance de archivos.

## Pendiente del usuario

- [ ] Migración `20260915000100_session_ratings.sql` aplicada en
      `grrzmzktrhksbttpbblg` por el SQL Editor del dashboard. Hasta entonces el
      job remoto de `schema-drift.yml` sale en rojo, y **ese rojo es esperado,
      no deriva** — es la misma situación que tuvo la Tarea 3b de `sesiones`.
      Nada más depende de esto: el mock y la Supabase local de `contract.yml`
      avanzan igual.
