# TODO — perfil

## Onboarding
- [x] Pantalla de selección de modo (Par / Lock-In / ambos)
- [x] Guardar el modo elegido (a través de la capa de datos de `arquitecto`)

## Formulario de perfil
- [x] Campos: nombre, edad, ubicación/zona horaria
- [x] Especialidades (selección múltiple de tags)
- [x] Qué busco (Cofundador / Compañero de lock-in / Ambos)
- [x] Qué debe dominar quien busco (mismos tags; solo en Cofundador / Ambos)
- [x] Punto de partida (las 3 opciones de `docs/plan/CONCEPTO.md`)
- [x] Disponibilidad (horas/semana + franja horaria)
- [x] Ambición/compromiso (escala o selección)
- [x] Enlaces opcionales (GitHub / portfolio / LinkedIn)
- [x] 1-2 prompts de texto libre corto
- [x] Validación básica (campos obligatorios mínimos)

## Teclado de los campos de texto
- [x] Cada `TextField` declara `autoCapitalize` y `autoCorrect` según lo que significa el campo
- [x] La respuesta a un prompt no se title-casea (`sentences`, corrector apagado)
- [x] Ubicación capitaliza por palabras (topónimo) y no la corrige el diccionario
- [x] Test unitario que cae si alguien quita cualquiera de los dos props, y que cuenta los campos para que uno nuevo no se cuele
- [x] Confirmar en emulador que el auto-capitalizado no vuelve — 7 verdes de `supabase` sobre commits con `48c1ac6`, ningún rojo en `verify.mjs:27` (ver abajo)

## Perfil propio
- [x] Pantalla de ver/editar perfil en la tab Perfil
- [x] Reutilizar el formulario de creación para la edición
- [x] Distinguir de un vistazo "lo que domina" de "lo que busca" en la ficha

## Datos de ejemplo
- [x] Al menos 6-8 perfiles mock variados (distintos modos, especialidades, puntos de partida) para que `descubrir` tenga un deck creíble
- [x] Al menos 2 de esos perfiles "sembrados" para dar match recíproco en el mock de `descubrir`
- [x] La tarjeta de delante del deck es uno de los recíprocos, y lo es por puntuación estricta (no por el desempate de `id`)
- [x] `supabase/seed.sql` cuenta la misma historia que `src/data/mock/seed.ts`

## Dónde ha quedado

- `src/features/profile/` — `catalog.ts` (opciones y etiquetas), `controls.tsx` (primitivas de formulario), `profile-form.tsx` (formulario único de alta y edición), `profile-details.tsx` (ficha en lectura), `profile-avatar.tsx`.
- `seekingSpecialties` (contrato de `arquitecto`): el formulario lo pregunta solo cuando `lookingFor` es `par` o `ambos` —`catalog.ts:seeksComplement`— y lo envía vacío en cualquier otro caso, aunque se hubieran marcado chips antes de cambiar de modo. La ficha lo pinta en latón, debajo de lo que domina (verde) y separado por una línea; vacío se lee como "Abierto a cualquier especialidad", que es lo que significa en el dominio. Los chips de este grupo llevan `accessibilityLabel` "Busco X" para no compartir nombre accesible con los de lo que domina.
- Rutas: `src/app/(onboarding)/mode.tsx`, `src/app/(onboarding)/profile-form.tsx`, `src/app/(tabs)/profile.tsx` — ya no usan `ScreenPlaceholder`.
- Catálogo mock: `src/data/mock/seed.ts`, 8 perfiles y 3 recíprocos (uno por modo, para que cualquier filtro de `descubrir` tenga match posible).
- Teclado (2026-09-08): la respuesta al prompt llegaba a Postgres capitalizada palabra por palabra —'Una Herramienta para Construir en equipo' tecleado en minúsculas— porque era el único campo sin `autoCapitalize` ni `autoCorrect`. Ahora los nueve campos los declaran: `words` para nombre y ubicación (nombres propios), `sentences` para las respuestas libres, `none` para edad, zona horaria y enlaces; el corrector va apagado en todos, incluidos los nombres propios, porque el diccionario los reescribe. Lo cubren dos tests en `profile-form.test.tsx`: uno por campo contra la tabla `KEYBOARD_BEHAVIOUR`, y otro que cuenta los `TextInput` del árbol para que un campo nuevo sin props rompa la suite en vez de colarse.

- Tarjeta de delante del deck (2026-09-09): el E2E `mock` moría en el comando 37 de 38 con `Assertion is false: "¡Match!" is visible` — [run 34283362375](https://github.com/thejowe/lockin/actions/runs/34283362375/job/102253132068). No era el recorrido: `getDeck` ordena por complementariedad mutua y desempata por `id`, y para el perfil que teclea el `.yaml` (domina Desarrollo y Marketing, busca Diseño) empataban **dos** perfiles en la puntuación máxima —Marc y Lucía, los dos «diseño buscando desarrollo»—; ganaba `seed-lucia` por alfabético y Lucía no está en `SEED_RECIPROCAL_IDS`, así que el like no podía cerrar match.

  **Por qué el arreglo es cambiar a Lucía y no meterla en los recíprocos.** Meterla habría puesto el verde en el sitio, pero deja el defecto intacto: dos de ocho perfiles ocupando la misma casilla en un catálogo cuya cabecera presume de cubrir el abanico —y el empate siguiente, con otro perfil propio, habría vuelto a salir por donde nadie mira. El defecto real es que Lucía busca `dev`/`producto`, que es lo mismo que buscan Marc y Diego, y contradice su propio prompt: fundió una marca de cerámica preciosa que no vendió nada y aprendió a validar antes. Lo que busca es quien venda y quien mida. Con `['ventas', 'datos']` la puntuación máxima vuelve a ser única (Marc, que sí es recíproco), el desempate de `id` deja de decidir nada, y `datos` pasa a estar buscado por alguien, que antes no lo estaba por nadie. Orden resultante: `seed-marc > seed-diego > seed-ines > seed-lucia > seed-nuria > seed-alba > seed-omar > seed-tomas`.

  No se tocó `e2e/`, ni la aserción del match, ni `getDeck`. La variante `supabase` lo había resuelto por su lado (`e2e/incoming-likes.sql`, de `calidad`, sube a Núria a puntuación 2 y su UUID es el más bajo); el mock no tiene esa palanca porque el `update` es de la base desechable de e2e, así que el arreglo tenía que estar en el catálogo.

  Lo fija `src/data/mock/seed.test.ts`, con la invariante escrita: **quien encabeza el deck tiene que estar en `SEED_RECIPROCAL_IDS`, y por puntuación estricta**. Está en `npm test` y no en `e2e/` a propósito: un fallo de catálogo debe caer en segundos, no media hora después en un emulador. Verificado por mutación — los dos casos caen con el catálogo anterior.

  Asimetría que queda anotada y no se ha tocado: el desempate por `id` no ordena igual en los dos backends (aquí `seed-<nombre>`, alfabético; en Postgres UUID por orden de siembra), así que dos perfiles empatados salen en distinto orden en mock y en Supabase. Deja de importar en cuanto la cabeza del deck no empata, que es lo que ahora garantiza el test, pero si alguna vez hace falta que el deck entero coincida, la palanca es renombrar los ids del mock con su ordinal.

- `supabase/seed.sql` se actualizó con el mismo cambio (fila de Lucía y la receta de `update` comentada del final). Su cabecera lo exige: es el catálogo del mock traducido a filas reales, y dos catálogos con historias distintas hacen que "funciona con el mock" no signifique nada. No es un archivo de `e2e/`.

- Teclado, estado real (2026-09-09): `autoCapitalize` **sí sigue puesto**. Los ocho `<TextField>` de `profile-form.tsx` lo declaran junto con `autoCorrect={false}` (nueve `TextInput` renderizados: el del prompt se pinta dos veces), y `controls.tsx:TextField` los reenvía al `TextInput` nativo con `{...rest}`, así que llegan. El APK del run rojo ya los llevaba: `48c1ac6` es ancestro de `e0f4ca7`. Ninguna capitalización sale de código nuestro — lo único que llama a `toUpperCase` son las iniciales del avatar.

  Pero el verde **no lo cierra**, por lo que documenta `calidad.md:826`: el auto-capitalizado es intermitente (dos runs sobre el mismo commit `91e98a1`, uno murió en `verify.mjs:27` con `'Una Herramienta para Construir en equipo'` y el otro pasó de largo). Y de los tres verdes seguidos de `supabase` solo **uno** —`e0f4ca7`, run 34283362375— lleva el arreglo dentro: `78c90b8` y `0149634` salen de la rama de `calidad`, que forkeó antes. Un verde con ~50% de intermitencia medida es 50% de probabilidad de falso negativo. Lo que lo cierra es acumular pasadas de `supabase` sobre commits que contengan `48c1ac6`, cada una comparando la cadena exacta en `verify.mjs:27`; a cinco seguidas el falso negativo baja al 3%. Contador: **7** (2026-09-13) — runs [34283362375](https://github.com/thejowe/lockin/actions/runs/34283362375) (`e0f4ca7`), [34409724164](https://github.com/thejowe/lockin/actions/runs/34409724164) (`d4f0810`), [34411945877](https://github.com/thejowe/lockin/actions/runs/34411945877) (`ce7ccc6`), [34413652963](https://github.com/thejowe/lockin/actions/runs/34413652963) (`b863e5f`), [34415065566](https://github.com/thejowe/lockin/actions/runs/34415065566) (`a6e4c9b`), [34415842422](https://github.com/thejowe/lockin/actions/runs/34415842422) (`74897b4`), [34657015107](https://github.com/thejowe/lockin/actions/runs/34657015107) (`7f986af`). Los siete: job `E2E Android (supabase)` en `success`, `48c1ac6` ancestro del commit (`git merge-base --is-ancestor`), y la línea «Postgres: alta, perfil…» en el log, que `verify.mjs` solo imprime después de pasar la comparación de la línea 27. Ningún rojo de `supabase` con el arreglo dentro muere en `verify.mjs:27` (revisados los `failure` de los últimos 200 runs). Con ~50% de intermitencia, siete pasadas dejan el falso negativo por debajo del 1%: casilla cerrada. Si vuelve a salir `'Una Herramienta para Construir en equipo'`, se reabre. Los tests unitarios no pueden ayudar aquí —renderizan sin IME, así que prueban que los props están declarados, no que Android los respete.

## Saneamiento de arquitectura (auditoría del 2026-09-17)

Uno de los siete hallazgos de la auditoría del 2026-09-17 llega a este bloque: la
mitad de UI del hallazgo 1 (cuentas irrecuperables). La orden completa está en
`docs/plan/ordenes-arquitectura.md` → `ORDEN P1`.

### Orden `P1` — pantalla de recuperación de cuenta (Ola 3)

Sin etiqueta de herramienta, y no por falta de decisión: **está bloqueada por
`D2`** (`datos`), que es quien fija el contrato de vinculación. Empezar la
pantalla antes de eso es escribir UI contra una API que todavía no existe.

- [x] **Hallazgo 1, la parte que se ve.** `AccountSection` (`src/features/profile/account-section.tsx`), montada al final de la tab Perfil. Los tres estados de `AccountState` tienen bloque propio: irrecuperable (`anonymous` / `device`) avisa y pide email; `pending-email` dice a qué correo y **no** se pinta como estado a salvo; `email` enseña la dirección y ofrece contraseña, recuperación y cierre de sesión
- [x] Copy y UX decididos con el criterio de este bloque, no improvisados. Ver «Cómo quedó la orden `P1`» abajo
- [x] Lo de siempre de este bloque: labels de accesibilidad, tamaño táctil y contraste AA — `theme.test.ts` sigue con `KNOWN_GAPS` vacío. Los dos campos llevan `accessibilityLabel` propio porque la etiqueta visible de `Field` no se asocia sola en React Native, y todo el color sale de `@/constants/theme`

#### Cómo quedó la orden `P1` (2026-09-17)

**Dónde está.** `src/features/profile/account-section.tsx` (la sección),
`account-gateway.ts` (el puente con la capa de cuentas), `auth-callback.tsx` (la
vuelta del enlace del correo) y `src/app/auth/callback.tsx` (la ruta de tres
líneas que la monta). La tab Perfil solo añade `<AccountSection />`.

**Por qué hay un `account-gateway.ts`.** La regla del proyecto es que las
pantallas importen de `@/data` y nunca de `@/data/supabase`. La cuenta es la
única excepción y está encerrada ahí a propósito: el contrato de
`src/data/repositories.ts` no tiene login —`SessionRepository` solo habla de modo
activo y de perfil propio—, así que no hay forma de preguntarle por el estado de
la cuenta, y `P1` prohíbe tocar `src/data/` para ampliarlo. Con la excepción en
un solo archivo, el día que la cuenta entre en `Repositories` solo cambia ese.
Además le da su única decisión propia: sin credenciales de Supabase,
`readAccountState()` devuelve `null` en vez de llamar a `getSupabaseClient()`,
que lanzaría — en el arranque de desarrollo con el mock en memoria no hay
ninguna cuenta que asegurar, y la sección no pinta nada.

**El bloqueo de cerrar sesión no lo decide la pantalla.** `handleSignOut` llama a
`signOut()` sin flag y deja que la capa de datos se niegue; el
`unrecoverable-account` que lanza es lo que abre el panel de confirmación, y solo
desde ahí se pasa `signOut({ acceptDataLoss: true })`. Duplicar la regla aquí
habría dejado dos copias que se pueden desincronizar. Verificado por mutación:
cambiar esa llamada por la de `acceptDataLoss: true` tira 4 tests.

**El ascenso son dos pasos y se nota en la UI.** El formulario pide email a
secas, no email y contraseña juntos: GoTrue no acepta contraseña en una cuenta
anónima hasta que el email está verificado. El campo de contraseña solo aparece
cuando `recoverable` es cierto. Desde `pending-email` se puede reenviar el correo
o cambiar de email sin salir de la pantalla, y «Ya lo he confirmado» relee el
estado —`getAccountState()` pregunta al servidor, así que se entera aunque el
enlace se haya pinchado en otro sitio—.

**Fuera del alcance de archivos que enumera la orden**, y por qué: `P1` lista
`(tabs)/profile.tsx`, `src/features/profile/` y este TODO, pero pide «ofrezca
recuperar contraseña», y una recuperación no se puede cerrar sin recoger el
enlace del correo — es el canje del `code` lo que abre la sesión en la que
después se pone la contraseña nueva. Sin ruta, `lockin://auth/callback` cae en la
pantalla de «ruta no encontrada» de expo-router. De ahí `src/app/auth/callback.tsx`,
que además es lo que `datos` dejó escrito que era de este bloque
(`docs/plan/todo/datos.md` → «El enlace del correo lo tiene que recoger la app…
`src/data/` no puede registrar ese handler — es `src/app/`, o sea tuyo»). No
toca `_layout.tsx` (es de `arquitecto`): expo-router monta la ruta por el árbol
de archivos y los `<Stack.Screen>` explícitos solo fijan opciones.

**Lo que NO se hizo, y es decisión y no olvido.** Si el email ya está en uso, el
error se queda ahí: no se ofrece entrar en la otra cuenta, porque eso abandonaría
el perfil, los matches y los chats de este dispositivo. Tampoco se ofrece
«recuperar contraseña» desde una cuenta sin email, que sería lo mismo por la
puerta de atrás. Y no hay ningún empujón a vincular email fuera de esta pantalla:
vincular es opcional siempre, y el onboarding —donde más se abandona— sigue sin
pedir nada.

**Verificación (2026-09-17).** `npm run typecheck` y `npm run lint` limpios.
`npm test -- --ci --runInBand`: 787 pasados, 82 saltados, 0 rojos. Cobertura
global por encima de los umbrales de `jest.config.js` (93.94 / 87.91 / 93.64 /
95.81 frente a 93.58 / 87.56 / 92.76 / 95.38). Tests nuevos: `account-section.test.tsx`
(23 casos: los tres estados, el bloqueo de cierre de sesión y su confirmación, y
los errores de email en uso, sin conexión y rechazo que no es `Error`),
`account-gateway.test.ts`, `auth-callback.test.tsx` y `test/app/auth-callback.test.tsx`.

**Para `calidad`.** Los umbrales de `jest.config.js` se quedaron como estaban
aunque la cobertura ha subido. Su propio comentario dice que se suben cuando
sube; no se han tocado aquí porque el archivo es de ese bloque y las órdenes
`A2` y `D3` corren en paralelo, y subir el suelo ahora les pondría en rojo por
algo que no es suyo.

## «Ya tengo cuenta» en el onboarding (2026-09-19)

Hueco detectado por el usuario: `signInWithEmail()` existe en la capa de cuentas pero ninguna pantalla la llama, así que quien reinstala o cambia de móvil entra siempre como anónimo nuevo y no puede volver a su cuenta con email. **Opcional, no un muro**: `ordenes-arquitectura.md` ("Lo que NO hay que hacer") sigue prohibiendo el login obligatorio.

- [x] **[Claude]** Enlace «Ya tengo cuenta» en el onboarding → pantalla email + contraseña (`signInWithEmail`) con «He olvidado mi contraseña» (`sendPasswordReset`); oculto sin credenciales de Supabase; aviso antes de abandonar una cuenta anónima que ya tiene perfil; relectura de `session:onboarded` y `profile:current` y redirección (perfil → tabs, sin perfil → onboarding). Alcance: `src/app/(onboarding)/`, `src/features/profile/` (incluido el re-export en `account-gateway.ts`) y sus tests; **no** `src/data/`

### Cómo quedó «Ya tengo cuenta» (2026-09-19)

**Dónde está.** `src/features/profile/sign-in-form.tsx` (el formulario y toda su
lógica), `src/app/(onboarding)/sign-in.tsx` (la ruta) y un enlace secundario en
`src/app/(onboarding)/mode.tsx`. `account-gateway.ts` reexporta
`signInWithEmail` y añade `accountsAvailable` (= `hasSupabaseCredentials`): es lo que
oculta el enlace sin credenciales, y la ruta, si alguien llega igualmente, vuelve
a `/mode` en vez de pintar un formulario que reventaría. No se ha tocado `src/data/`.

**Decisiones.**
- **Tras entrar, `router.replace('/')`**: la puerta de entrada (`src/app/index.tsx`)
  relee `session:onboarded` desde cero y decide —perfil → `/discover`, sin perfil →
  `/mode`—. No hay una segunda copia de esa regla. Y como la caché de `useQuery`
  muere con cada pantalla, nada montado antes del login puede seguir enseñando el
  perfil de la cuenta anterior.
- **El aviso de abandonar el perfil no lee la caché.** Al pulsar «Entrar» se pregunta
  en el momento (`readAccountState()` + `profiles.getCurrent()`): si la cuenta no
  es recuperable y tiene perfil, sale un panel de confirmación en la propia pantalla
  (igual que el de cerrar sesión) y solo «Entrar y dejar este perfil» sigue adelante.
  Si esa comprobación falla, **no se entra**: perder un perfil sin avisar es peor que
  pedir que se reintente.
- **Credenciales erróneas.** `auth.ts` no traduce `invalid_credentials` y lo dejaría
  en inglés («Invalid login credentials»); el formulario lo reconoce por el `code`
  de la causa y enseña un mensaje único que no distingue email inexistente de
  contraseña errónea.
- **«He olvidado mi contraseña»** usa el email ya escrito y responde igual exista o no
  la cuenta.
- Copy: «Entrar» y «Ya tengo cuenta», nunca «registrarse».

**Verificación (2026-09-19).** `npm run typecheck` y `npm run lint` limpios.
`npm test -- --ci --runInBand --coverage`: 869 pasados, 84 saltados, 0 rojos; cobertura
global 94.45 / 89.14 / 94.09 / 96.09 frente al suelo de `jest.config.js` (94.36 / 89.09
/ 93.94 / 95.96), sin tocar los umbrales. Tests nuevos: `sign-in-form.test.tsx` (éxito,
credenciales erróneas, error traducido y no-`Error`, campos vacíos, doble pulsación,
aviso de cuenta anónima con perfil —confirmar, «Mejor no», sin perfil, cuenta
recuperable, comprobación fallida—, reset de contraseña, a11y) y
`test/app/sign-in.test.tsx` (enlace oculto sin credenciales, la ruta, `replace('/')`, y
la puerta de entrada relanzada con otra cuenta debajo: perfil → `/discover`, sin
perfil → `/mode`). Prettier: los ficheros nuevos pasan; los tres tocados
(`mode.tsx`, `account-gateway.ts`, `index.ts`) solo avisan por CRLF local.

**Lo que NO se pudo verificar.**
- El flujo real contra Supabase en un dispositivo: `signInWithPassword` con una cuenta
  con email, el cambio de `auth.uid()` y que la puerta de entrada encuentre el perfil
  de la cuenta recuperada. Todo lo anterior va con dobles y el mock en memoria.
- Que `router.replace('/')` desmonte de verdad el onboarding en expo-router (los tests
  usan un router de mentira). Es el mismo patrón que `profile-form.tsx` con `/discover`.
- El correo de recuperación desde el onboarding: el enlace cae en `auth/callback`, que
  termina en `/profile`; para quien recupera en un móvil nuevo y sin perfil local eso
  no se ha probado, y `src/app/auth/` queda fuera de este alcance.
- `typecheck` local: `.expo/types/router.d.ts` (gitignored) está obsoleto y no conoce
  `/sign-in`; se comprobó sin él, como en CI. `expo start` lo regenera.

## Registro con email en el onboarding (2026-09-20)

Hueco detectado por el usuario al probar «Ya tengo cuenta» (`9818fbb`): la pantalla de entrada pide email y contraseña, pero el alta **no pide ninguno de los dos** — se entra anónimo y solo se puede ascender la cuenta después, desde la tab Perfil (`AccountSection`). Quien cambia de dispositivo puede entrar, pero quien se registra nunca ha tenido ocasión de crear esas credenciales, salvo que se haya acordado de ascender. La persistencia de la sesión en el dispositivo **sí funciona** (verificado por el usuario el 2026-09-20 en Expo Go, iPhone).

- [x] **[Claude]** Interfaz de registro en el onboarding: pantalla de alta con email y contraseña, en el flujo del alta y no escondida en Perfil. Copy: «Crear cuenta» para el alta y «Ya tengo cuenta» para entrar, coherente con la pantalla existente (la regla de copy de «Ya tengo cuenta» de no usar «registrarse» se **revoca** aquí: el usuario pide un registro explícito). Alcance: `src/app/(onboarding)/`, `src/features/profile/` (y el re-export en `account-gateway.ts`) y sus tests; **no** `src/data/`. Copy de errores vía `AccountError.reason`, no el texto del servidor
- [x] **[Claude]** Decidir y dejar escrito, antes de implementar, cómo se crea la cuenta. **Decidido el 2026-09-20: opción (a)**, ver «Decisión de alta» abajo. **Restricciones reales de GoTrue** (ver `src/data/supabase/auth.ts` y `todo/datos.md`, orden `D2`):
  - `mailer_autoconfirm` está en `false` **a propósito** (`supabase/README.md` → "Configuración de Auth en el dashboard"): sin confirmar el email no hay cuenta recuperable, y GoTrue no acepta contraseña en una cuenta anónima sin email verificado.
  - Opción (a): `linkEmailToCurrentUser(email)` sobre la sesión anónima (**conserva `auth.uid()`**) y pedir la contraseña **después** de confirmar el enlace (`setAccountPassword`), que es lo que ya hace `AccountSection`. El alta puede continuar mientras el email está pendiente (`pending-email`).
  - Opción (b): `signUpWithEmail(email, password)` en el onboarding. Aún no hay perfil ni matches en la sesión anónima, así que cambiar de `auth.uid()` en este punto no pierde datos; pero con confirmación de email activa no hay sesión hasta confirmar y hay que decidir qué ve la persona mientras tanto.
  - Cualquiera de las dos debe reutilizar `AccountSection` o compartir su lógica, no duplicarla.
- [x] **Decisión de producto, resuelta por el usuario el 2026-09-20: el registro es OBLIGATORIO.** Revoca «no metas una pantalla de login obligatoria» para el alta; anotado con fecha en `docs/plan/ordenes-arquitectura.md`. Pregunta original: ¿el alta con email es **obligatoria** o hay un «Ahora no»? El default recomendado es opcional y bien visible: `docs/plan/ordenes-arquitectura.md` ("Lo que NO hay que hacer") prohíbe el login obligatorio por decisión deliberada del 2026-09-17, y hacerla obligatoria la revoca. Si el usuario la quiere obligatoria, anotarlo allí con fecha
- [ ] Verificar en un dispositivo real contra Supabase (alta con email → correo de confirmación → cuenta recuperable → entrar desde otro dispositivo con «Ya tengo cuenta»). **No lo puede cerrar un agente**

### Decisión de alta (2026-09-20)

**Se asciende la sesión anónima: `linkEmailToCurrentUser(email)` y, ya confirmado el correo, `setAccountPassword(password)`. No `signUpWithEmail`.**

- **Restricción de GoTrue, que manda.** `mailer_autoconfirm` está en `false` a propósito (`supabase/README.md`): no hay cuenta recuperable hasta que se pincha el enlace, y GoTrue no acepta contraseña en una cuenta anónima sin email verificado. Por eso la contraseña **no se puede pedir en el mismo paso que el email**: el alta son tres tiempos —email, confirmar el correo, contraseña—, y la pantalla lo dice tal cual en vez de fingir un formulario de un solo paso.
- **Por qué no `signUpWithEmail`.** (1) Con confirmación activa no devuelve sesión: la app se queda con la sesión anónima y con un usuario nuevo sin sesión —dos identidades a la vez y un anónimo huérfano en la base—. (2) Para un email que ya existe GoTrue **no da error** (anti-enumeración): la persona espera un correo que no llega y `email-in-use` nunca se dispara; `updateUser({ email })` sí devuelve `email_exists`, que `auth.ts` ya traduce. (3) Su única ventaja, la contraseña en el mismo paso, no cuenta: hay que esperar a la confirmación de todos modos.
- **`auth.uid()` no cambia**, la invariante de `ordenes-arquitectura.md`. Y el alta y el ascenso desde Perfil pasan a ser **el mismo camino**: no hay dos formas de crear una cuenta que se puedan desincronizar.
- **Lógica compartida, no duplicada.** Los pasos y sus avisos salen de `AccountSection` a un hook (`use-account-actions.ts`) que usan las dos pantallas. `AccountSection` no cambia de cara al usuario y sus tests siguen igual.
- **Qué significa «obligatorio» aquí.** Es una puerta en el **alta**: `mode` y `profile-form` mandan a `/register` mientras la cuenta no sea recuperable (email confirmado). Quien ya tiene perfil no pasa por ahí (la puerta de entrada lo lleva a `/discover`). La contraseña se pide en la pantalla y no se puede saltar **dentro de ella**, pero **no se puede exigir entre reinicios**: `AccountState` no dice si la cuenta tiene contraseña y `src/data/` es intocable aquí. Si alguien cierra la app entre confirmar y poner la contraseña, la puerta ya está abierta —la cuenta es recuperable por correo y Perfil sigue ofreciendo la contraseña—. Exigirla de verdad necesita un campo nuevo en `AccountState` (bloque `datos`).
- **«Ya tengo cuenta» sale desde el registro** cuando el email ya está en uso: en el alta no hay perfil que abandonar, así que la razón de la decisión del 2026-09-17 (no ofrecer entrar en otra cuenta) no aplica aquí.
- **Sin capa de cuentas** (mock en memoria) no hay puerta: no hay servidor al que registrarse.

### Cómo quedó el registro (2026-09-20)

**Dónde está.** `src/features/profile/register-form.tsx` (la pantalla, con los tres pasos), `use-account-actions.ts` (el hook que comparten el registro y `AccountSection`: ocupado, aviso, errores y las cuatro operaciones), `use-registration-gate.ts` (la puerta) y `account-gateway.ts` (`registrationRequired`). Rutas: `src/app/(onboarding)/register.tsx` nueva; `mode.tsx` y `profile-form.tsx` llevan la guarda. `AccountSection` se refactorizó para usar el hook: mismo aspecto y mismos 23 tests sin tocar.

**Cómo funciona la puerta.** `mode` y `profile-form` mandan a `/register` mientras `AccountState.recoverable` sea falso. Pregunta al servidor en cada montaje, **falla cerrado** (si no puede leer la cuenta no deja pasar) y no parpadea (`checking` no pinta nada ni redirige). En `/register` hay siempre «Ya tengo cuenta» hasta que la cuenta está hecha: quien reinstala aterriza ahí y `mode`, con su propio enlace, ya no es alcanzable. `sign-in` no cambia: al entrar, `replace('/')` y la puerta de entrada decide.

**El enlace del correo, fuera del alcance literal de la orden.** `src/app/auth/callback.tsx` mandaba siempre a `/profile`; con el alta obligatoria eso dejaba a quien confirma el correo en una tab vacía y sin elegir contraseña. Ahora, sin perfil, va a `/register` (donde toca la contraseña); con perfil, sigue yendo a `/profile`; si no puede saber si hay perfil, a `/`. Son cinco líneas de ruta y su test (`test/app/auth-callback.test.tsx`); no toca `src/data/`.

**Un interruptor que hay que conocer: `EXPO_PUBLIC_REQUIRE_ACCOUNT=false`.** Apaga la puerta en tiempo de compilación. Existe porque el E2E de la variante `supabase` (`e2e/full-journey.yaml`) entra anónimo, elige modo y crea el perfil, y **no tiene buzón donde pinchar el enlace**: con la puerta encendida se quedaría en «Crea tu cuenta» y el job caería en rojo. `e2e/` y `.github/` son de `calidad` y no se han tocado: **hasta que ese job compile con `EXPO_PUBLIC_REQUIRE_ACCOUNT=false`, `E2E Android (supabase)` fallará por diseño**. Una build de usuario no lo lleva. Pendiente de `calidad`.

**Lo que se sigue sin poder garantizar.** (1) Que la contraseña se ponga entre reinicios (ver «Decisión de alta»). (2) Quien ya tiene perfil anónimo de antes de esta orden no pasa por el registro: la puerta solo cierra el alta, y `AccountSection` sigue siendo su única invitación. Si se quiere forzar también a esos, es otra decisión de producto (y borra `ordenes-arquitectura.md` → «no rompas el arranque sin fricción» para usuarios existentes).

**Verificación (2026-09-20).** `npm run typecheck` y `npm run lint` limpios. `npm test -- --ci --runInBand --coverage`: 911 pasados, 84 saltados, 0 rojos; cobertura global 94.56 / 89.28 / 94.23 / 96.13 frente al suelo de `jest.config.js` (94.36 / 89.09 / 93.94 / 95.96), sin tocar umbrales. Verificado por mutación: quitar la redirección de `mode.tsx` tira 3 tests de `test/app/register.test.tsx`. Tests nuevos: `register-form.test.tsx` (20: los tres pasos, email en uso, sin «Ahora no», salida a «Ya tengo cuenta», error de lectura), `test/app/register.test.tsx` (10: la puerta en `mode`, la ruta y su recorrido), y casos nuevos en `account-gateway.test.ts`, `test/app/profile-form.test.tsx` y `test/app/auth-callback.test.tsx`.

**Lo que NO se ha verificado** (y no lo puede cerrar un agente, es el último punto de la lista de arriba, que sigue **sin marcar**):
- El flujo real contra Supabase: que `updateUser({ email })` mande el correo de confirmación desde una sesión anónima, que el enlace vuelva a la app y `completeAuthLink` deje la cuenta recuperable, y que `setAccountPassword` la acepte justo después. Todo va con dobles y el mock en memoria.
- Que la cuenta sea recuperable de verdad y se pueda entrar desde otro dispositivo con «Ya tengo cuenta».
- Que expo-router monte `/register` y respete los `replace` (los tests usan un router de mentira), ni cómo se ve en un móvil.
- Que el correo llegue: el proveedor de correo del proyecto Supabase no se ha tocado ni mirado.
- `typecheck` local: `.expo/types/router.d.ts` (gitignored) puede no conocer `/register`; se comprobó sin él, como en CI.

## Recuerda
Nadie contrata a nadie: no metas campos de "salario" o "equity que ofrezco" — eso es Modo Talento, Fase 4, fuera de este MVP.
