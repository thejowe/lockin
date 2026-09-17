# Órdenes — saneamiento de arquitectura (2026-09-17)

> Reparto de los 7 problemas de arquitectura detectados en la auditoría del
> 2026-09-17. Cada orden es autocontenida: se puede pegar tal cual en una sesión
> nueva (Claude Code o Codex) sin más contexto que este archivo y el repo.
>
> **Regla de oro intacta**: ningún par de órdenes de la misma ola toca el mismo
> archivo. Las olas van en orden; no adelantes una ola sin cerrar la anterior.

## Los 7 hallazgos y a quién le tocan

| # | Hallazgo | Bloque | Orden | Ola |
|---|---|---|---|---|
| 1 | No hay identidad real: la cuenta es irrecuperable | `datos` + `perfil` | D2, P1 | 2, 3 |
| 2 | Canales de vídeo y presencia sin autenticar | `datos` | D1 | 1 |
| 3 | `useQuery` sin caché: parpadeo y dos hooks duplicados | `arquitecto` | A1 | 1 |
| 4 | Dos implementaciones del dominio, contrato opt-in en CI | `calidad` | C1 | 2 |
| 5 | Cambio silencioso de backend si faltan credenciales | `arquitecto` | A1 | 1 |
| 6 | Consultas sin paginar y reloj del dispositivo | `datos` | D3 | 3 |
| 7 | Estado mutable de módulo en los dos backends | `arquitecto` | A2 | 3 |

## Olas

- **Ola 1** — `A1` y `D1` en paralelo (alcances disjuntos: `src/data/provider.tsx`
  + `src/data/active.ts` frente a `src/data/supabase/**` + `supabase/migrations/`).
- **Ola 2** — `D2` y `C1` en paralelo.
- **Ola 3** — `P1`, `D3` y `A2`. `D3` **no** puede correr a la vez que `D2`.

Si corres dos a la vez en la misma máquina, cada una en su `git worktree`
(`git worktree add ../lockin-<orden> -b fix/<orden>`), como manda `PLAN.md`.

---

# ORDEN A1 — `arquitecto` — `useQuery` y el arranque del backend

**Ola 1. Paralelizable con D1.**

## Alcance de archivos (no toques nada más)

- `src/data/provider.tsx`
- `src/data/active.ts`
- `src/features/chat/use-conversation.ts` (cruce declarado: borrar el hook duplicado)
- `src/features/session/use-resolved-or-previous.ts` (cruce declarado: borrar el archivo)
- `src/features/session/index.ts`, y los archivos de `src/features/session/` que
  importen ese hook (solo para quitar el import)
- `docs/plan/todo/arquitecto.md`

## Problema 3 — `useQuery` publica `null` en cada relectura

`src/data/provider.tsx` no tiene caché, ni deduplicación, ni coalescencia de
peticiones. En cada refetch publica `data: null, loading: true` **antes** de
tener el dato nuevo, así que la pantalla cae en su rama de carga y desmonta el
árbol. Ya causó un fallo real de E2E en el chat (compositor desmontado con el
teclado abierto, run 34160309273) y el remedio fue copiar el mismo hook dos
veces:

- `useResolvedOrPrevious` privado en `src/features/chat/use-conversation.ts`
- `src/features/session/use-resolved-or-previous.ts`

Los dos llevan escrito en su propio comentario que se borran cuando `arquitecto`
arregle `useQuery`. Esa es esta orden.

### Qué hay que conseguir

1. `useQuery` **retiene el último valor resuelto mientras relee**. Al resolver,
   manda lo que traiga, incluido `null` — un match que de verdad desapareció
   debe seguir apareciendo como desaparecido. Ese matiz está documentado en el
   JSDoc del hook duplicado del chat: cópialo al hook central, no lo pierdas.
2. Añade a `QueryState` una distinción entre "primera carga" y "releyendo":
   `loading` (no hay dato todavía) y `refreshing` (hay dato previo y se está
   releyendo). Las pantallas actuales que hacen `loading && !match` deben
   seguir funcionando sin cambios.
3. **Deduplicación por `key`**: dos componentes que pidan la misma `key` a la vez
   no deben disparar dos peticiones. Hoy `useConversation` + la tarjeta de sesión
   piden `profile:current` por separado.
4. Borra los dos hooks duplicados y deja que las dos pantallas usen `useQuery`
   directamente. Quita también el comentario de "esto es de `arquitecto`" de
   `use-conversation.ts`, que ya no aplica.
5. El ajuste de estado durante el render que hace el hook duplicado existe por
   una razón concreta (un `useEffect` llega un render tarde, y ese render tardío
   es el que cierra el teclado en Android). Si cambias de técnica, el
   comportamiento observable tiene que ser idéntico.

## Problema 5 — cambio silencioso de backend

`src/data/active.ts` elige backend con
`hasSupabaseCredentials ? createSupabaseRepositories() : createMockRepositories()`,
evaluado al cargar el módulo. Una build de producción con el entorno mal
configurado **no falla**: arranca con perfiles semilla falsos y parece
perfectamente funcional.

### Qué hay que conseguir

1. Cuando la app no está en desarrollo (`__DEV__ === false`) y faltan
   credenciales, hay que **fallar de forma ruidosa y explicando qué falta**, no
   caer al mock. En desarrollo el mock sigue siendo el camino cómodo y no se
   toca.
2. Deja rastro visible de qué backend está activo (un `console.info` una sola
   vez al arrancar basta) — hoy no hay forma de saberlo mirando la app.
3. No cambies la forma de `Repositories` ni ninguna firma: `perfil`,
   `descubrir`, `chat`, `sesiones` y `video` construyen sobre ellas.

## Criterio de terminado

- `npm run typecheck` limpio.
- `npm run lint` limpio.
- `npm run test:coverage -- --ci --runInBand` en verde, sin bajar el suelo de
  `jest.config.js`. Si la cobertura sube, **no** toques `jest.config.js`: es de
  `calidad`, anótalo en tu TODO.
- `npx expo export --platform web` sigue generando sus rutas.
- Comprobación específica del arreglo: un test que demuestre que `useQuery`
  **no** publica `null` durante una relectura cuando ya había dato.
- `grep -r "useResolvedOrPrevious" src/` no devuelve nada.
- Anota lo hecho en `docs/plan/todo/arquitecto.md` y commitea.

---

# ORDEN D1 — `datos` — canales de Realtime sin autenticar

**Ola 1. Paralelizable con A1. Es el hallazgo más grave de seguridad.**

## Alcance de archivos

- `supabase/migrations/` (una migración nueva)
- `src/data/supabase/video-signal.ts` (cruce declarado con `video`)
- `src/data/supabase/presence.ts` (cruce declarado con `sesiones`)
- `supabase/schema-embedded.test.mjs`, `supabase/drift-check.mjs`,
  `supabase/schema-fingerprint.sql` si la migración cambia la huella
- `docs/plan/todo/datos.md`

## El problema

`src/data/supabase/video-signal.ts` abre
`client.channel('lockin:video:' + sessionId)` y `src/data/supabase/presence.ts`
abre `client.channel('lockin:presence:' + sessionId)`. Ninguno de los dos pasa
`config: { private: true }`, y **no existe ni una sola política de Realtime
Authorization en `supabase/migrations/`** (`grep -i "realtime.messages"` no
devuelve nada).

Consecuencia: como cualquiera puede crear una cuenta anónima contra este
proyecto, cualquier usuario autenticado que conozca o adivine un `sessionId`
puede unirse a la señalización WebRTC de una sesión ajena, inyectar una oferta,
o leer la presencia. Todo el modelo de seguridad del resto del repo —RLS tabla
por tabla, `is_match_member()`, RPC `SECURITY DEFINER`— queda esquivado por esta
vía.

## Qué hay que conseguir

1. Migración nueva que active **Realtime Authorization** con políticas RLS sobre
   `realtime.messages`, de forma que solo se pueda leer/escribir en los topics
   `lockin:video:<sessionId>` y `lockin:presence:<sessionId>` cuando
   `auth.uid()` es parte del match dueño de esa sesión. Ya tienes las piezas:
   `public.is_match_member(match_id)` y la tabla `lockin_sessions` con su
   `match_id`. Necesitarás extraer el `sessionId` del nombre del topic
   (`realtime.topic()`).
2. Los dos adaptadores pasan a `config: { private: true }` en su `channel(...)`.
   Ese flag es lo que hace que el servidor evalúe las políticas; sin él la
   migración no protege nada.
3. Cubre en `supabase/schema-embedded.test.mjs` que la política deniega a un
   tercero y permite a los dos miembros del match.
4. Si el fingerprint del esquema cambia, actualiza lo que haga falta para que
   `schema-drift.yml` no se ponga en rojo por un cambio esperado.

## Avisos

- Lee la documentación exacta de Supabase Realtime Authorization antes de
  escribir SQL: la forma de las políticas sobre `realtime.messages` es específica
  y ha cambiado entre versiones.
- El cambio en los dos adaptadores es de **una línea cada uno**. No reescribas
  esos archivos ni toques su lógica: son de `video` y de `sesiones`.
- Esta migración la tiene que **aplicar el usuario** en `grrzmzktrhksbttpbblg`.
  Déjalo escrito, bien visible, en `docs/plan/todo/datos.md`.

## Criterio de terminado

- `npm run test:schema` en verde, con los casos nuevos ejecutándose de verdad
  (la guarda de `ci.yml` exige que la línea final de cada archivo se imprima).
- `npm run typecheck` y `npm run lint` limpios.
- `npm test -- --ci --runInBand` sin regresiones.
- Commit, y aviso al usuario de que falta aplicar la migración.

---

# ORDEN D2 — `datos` — identidad real y recuperación de cuenta

**Ola 2. No la lances a la vez que D3.**

## Alcance de archivos

- `src/data/supabase/auth.ts`
- `src/data/supabase/index.ts` (solo los re-exports, si hacen falta más)
- `docs/plan/todo/datos.md`
- **No toques `src/app/` ni `src/features/`** — la pantalla es la orden P1.

## El problema

Hoy toda persona que usa la app es una sesión anónima o, si el proyecto no
permite anónimos, una cuenta sintética `device-<hex>@lockin.app` cuya contraseña
se genera en el dispositivo y se guarda en `AsyncStorage`
(`DEVICE_ACCOUNT_KEY = 'lockin.supabase.device-account'`).

Eso significa que **desinstalar la app, limpiar datos o cambiar de teléfono
destruye la cuenta de forma permanente**: perfil, matches y conversaciones
quedan huérfanos y no hay ningún camino de recuperación. `signInWithEmail`,
`signUpWithEmail` y `linkEmailToCurrentUser` ya existen en `auth.ts`, pero
**ninguna pantalla de `src/app/` los llama jamás**.

Para un producto cuyo valor entero es la relación con otra persona, esto es
pérdida de datos silenciosa.

## Qué hay que conseguir

1. Extiende el contrato de auth de esta capa con lo que necesita una pantalla de
   recuperación, **sin romper nada de lo que ya hay**:
   - saber si la sesión actual es anónima/de dispositivo o ya tiene email
     asociado (algo como `getAccountState()`);
   - `linkEmailToCurrentUser` debe propagar con mensaje claro los fallos
     típicos: email ya en uso, contraseña débil, email inválido;
   - recuperación de contraseña (`resetPasswordForEmail`) con el `redirectTo`
     del esquema `lockin://`, que ya está configurado.
2. `signOut()` hoy borra las credenciales del dispositivo. Con cuenta con email
   eso está bien; **con cuenta anónima sin email es destruir los datos sin
   avisar**. Haz que `signOut()` se niegue a ejecutarse (o exija un flag
   explícito) cuando la cuenta no tenga forma de recuperarse, y expón esa
   información para que la pantalla pueda advertir.
3. Documenta en el encabezado del archivo el ciclo de vida completo de la cuenta:
   anónima → con email → recuperable. Hoy el encabezado describe el estado
   provisional como si fuera definitivo.
4. Cobertura en `src/data/supabase/auth.test.ts` de cada rama nueva.

## Lo que NO hay que hacer

- No metas una pantalla de login obligatoria. El arranque sin fricción es una
  decisión de producto deliberada: se entra anónimo y se **asciende** la cuenta
  después. No la rompas.
- No cambies `auth.uid()` en el ascenso: `linkEmailToCurrentUser` conserva el id,
  y eso es justo lo que salva perfil, matches y mensajes.

## Criterio de terminado

- `npm run typecheck`, `npm run lint` limpios.
- `npm test -- --ci --runInBand` en verde, con los casos nuevos.
- Anotado en `docs/plan/todo/datos.md` qué le queda a `perfil` (orden P1).

---

# ORDEN C1 — `calidad` — el contrato de Supabase no corre nunca

**Ola 2. Paralelizable con D2.**

## Alcance de archivos

- `.github/workflows/` (`ci.yml`, `contract.yml`)
- `jest.config.js`
- `docs/plan/todo/calidad.md`
- **No toques `src/` ni `supabase/`.**

## El problema

`src/data/mock/` y `src/data/supabase/` implementan por separado las mismas
reglas de negocio: ventanas de sesión, rachas, ranking del deck, resolución de
matches. Lo único que las mantiene alineadas es
`src/data/repositories.contract.ts` — 48 KB de casos compartidos.

Pero la mitad de Supabase de ese contrato es **opt-in**
(`LOCKIN_SUPABASE_CONTRACT=1`, `contract.test.ts:162`), así que el CI normal
nunca la ejecuta. El precedente está documentado en
`docs/plan/todo/arquitecto.md`: `seeking_specialties` se perdía silenciosamente
al guardar contra Supabase mientras todos los tests por defecto seguían verdes.
El aviso solo existía como un test rojo que nadie corría.

## Qué hay que conseguir

1. Que **el contrato contra un backend real forme parte del camino que sí se
   ejecuta**. Ya existe la infraestructura: `supabase/schema-embedded.test.mjs`
   levanta PostgreSQL embebido y el job `schema` de `ci.yml` lo corre en cada
   push. Lo que falta es que la suite de contrato pueda apuntar a ese Postgres
   embebido en vez de exigir el proyecto remoto.
   - Si eso resulta inviable en esta pasada, la alternativa mínima aceptable es:
     que `contract.yml` corra en cada push a `main` (no solo manualmente) y que
     **falle ruidosamente** si se salta por falta de credenciales, en vez de
     pasar en verde sin haber ejecutado nada. Un job que pasa sin ejecutar nada
     es peor que un job rojo.
2. Añade al `ci.yml` la misma clase de guarda que ya usa el job `schema`: una
   línea que el contrato imprime al terminar y que el workflow exige con
   `grep -q`. Es el patrón que este repo ya usa para detectar "el test no llegó
   a ejecutarse".
3. `jest.config.js` es tuyo: `docs/plan/todo/arquitecto.md` deja anotado que el
   suelo de cobertura lleva tiempo desfasado respecto a los números reales.
   Ponlo al día con lo que mida ahora, sin bajarlo nunca.

## Criterio de terminado

- El CI verde demuestra que el contrato se ejecutó de verdad (la guarda `grep`
  lo prueba).
- Comprueba que la guarda funciona: rómpela a propósito una vez y verifica que
  el job se pone rojo. Anótalo.
- `docs/plan/todo/calidad.md` actualizado.

---

# ORDEN P1 — `perfil` — pantalla de recuperación de cuenta

**Ola 3. Requiere D2 entregado.**

## Alcance de archivos

- `src/app/(tabs)/profile.tsx`
- `src/features/profile/` (componentes nuevos)
- `docs/plan/todo/perfil.md`
- **No toques `src/data/`** — lo que necesitas ya te lo dejó D2.

## El problema

La cuenta de cualquier usuario vive solo en el `AsyncStorage` de su teléfono.
Desinstalar la app o cambiar de móvil borra perfil, matches y conversaciones
para siempre, y la app **nunca se lo dice**. La orden D2 deja lista la capa de
datos; falta la única parte que ve el usuario.

## Qué hay que conseguir

1. En la pantalla de Perfil, una sección de cuenta que:
   - cuando la cuenta **no** tiene email, avise con claridad y sin alarmismo de
     que los datos viven solo en este dispositivo, y ofrezca añadir email y
     contraseña para poder recuperarla;
   - cuando **sí** lo tiene, muestre qué email es y ofrezca cerrar sesión;
   - ofrezca recuperar contraseña.
2. El copy manda: no es "crear cuenta" ni "registrarse" —la cuenta ya existe—.
   Es **asegurar** o **proteger** la cuenta que ya tienes. Ese matiz es lo que
   preserva el arranque sin fricción que decidió `CONCEPTO.md`.
3. Cerrar sesión desde una cuenta sin email tiene que estar **bloqueado o
   avisado de forma inequívoca**: es destruir los datos. D2 te da la información
   para saberlo.
4. Estados de error visibles y recuperables: email ya en uso, contraseña débil,
   sin conexión. Nada de fallos mudos.
5. Respeta el sistema de diseño: `Typography`, `Spacing`, `Colors` de
   `@/constants/theme`. Ni un color literal, ni un `fontSize` suelto.
6. Accesibilidad: `accessibilityLabel` en los controles, etiquetas visibles
   permanentes en los campos (es lo que exime a los bordes del requisito de
   contraste, según la decisión registrada en `docs/plan/todo/arquitecto.md`).

## Criterio de terminado

- `npm run typecheck`, `npm run lint` limpios.
- Tests con RNTL de los tres estados (sin email, con email, error) y del bloqueo
  de cierre de sesión.
- `npm test -- --ci --runInBand` en verde.
- `docs/plan/todo/perfil.md` actualizado.

---

# ORDEN D3 — `datos` — consultas sin paginar y reloj del dispositivo

**Ola 3. No la lances a la vez que D2.**

## Alcance de archivos

- `src/data/supabase/index.ts`
- `src/data/supabase/sessions.ts`
- `supabase/migrations/` si hace falta un RPC nuevo
- `docs/plan/todo/datos.md`

## Los problemas, uno a uno

1. **`matches.list()` no pagina.** Trae todos los matches del usuario de una vez.
   Crece sin techo.
2. **La previsualización del último mensaje es una heurística.**
   `lastMessagesByMatch` se trae los 200 mensajes más recientes
   (`RECENT_MESSAGES_WINDOW`) y los agrupa en el cliente. El propio comentario
   admite que es correcto "salvo que alguien tenga más de 200 mensajes por
   delante del último de alguna conversación vieja". Postgres resuelve esto con
   `distinct on`; PostgREST no lo expone, pero **un RPC sí**. Ese es el arreglo.
3. **`getDeck` filtra después de paginar.** `discovery_deck` devuelve hasta 50
   filas y `excludeIds` se aplica en JS **encima** de esa página, así que la
   página encoge de forma impredecible. El filtro tiene que bajar al SQL.
4. **`getActive` usa el reloj del dispositivo.** Decide qué sesión está viva con
   `Date.now()`, cuando `serverNow()` existe precisamente porque ese reloj no es
   de fiar. Un teléfono desfasado abre o cierra la ventana de sesión antes de
   tiempo. Lo correcto es resolver "viva" en el servidor.

## Qué hay que conseguir

Arregla los cuatro. Para 2 y 3, RPC nuevo o ampliación del existente; para 1,
paginación en el contrato de lectura sin romper a `chat` (que consume
`matches.list()`); para 4, que la vivacidad la decida Postgres.

**Si arreglar la paginación de `matches.list()` obliga a cambiar la firma de
`MatchRepository`, PARA y dilo**: ese contrato está congelado y lo consumen
`chat` y `rachas`. Propón el cambio, no lo hagas por tu cuenta.

## Criterio de terminado

- `npm run test:schema` en verde con los RPC nuevos cubiertos.
- La suite de contrato sigue pasando contra el mock.
- `npm run typecheck`, `npm run lint` limpios.
- `npm test -- --ci --runInBand` en verde.
- Cualquier migración nueva, avisada al usuario para que la aplique.

---

# ORDEN A2 — `arquitecto` — estado mutable de módulo

**Ola 3. Requiere A1 entregado (toca los mismos archivos).**

## Alcance de archivos

- `src/data/active.ts`
- `src/data/provider.tsx`
- `src/data/mock/store.ts`
- `src/data/supabase/index.ts` (solo el bloque de listeners/canales/`emittedLocally`)
- `docs/plan/todo/arquitecto.md`

## El problema

Los dos backends guardan estado en variables de módulo:

- `src/data/mock/store.ts`: un `let state` global más `clockOffsetMs` y
  `sequence`.
- `src/data/supabase/index.ts`: `listeners`, `channels` y `emittedLocally`, este
  último un `Set` limitado a 256 entradas con desalojo FIFO del más antiguo.

Ese desalojo es el detalle importante: **la deduplicación es "lo mejor que se
pueda" por construcción**. Una cuenta activa puede desalojar la marca de una
fila antes de que llegue su eco de realtime, y entonces el eco dispara una
relectura duplicada. Combinado con el problema 3 (cada relectura vaciaba la
pantalla), eso es exactamente el fallo que costó el incidente del chat.

Además `DataProvider` sugiere que los repositorios son inyectables, pero
`active.ts` los crea como singletons en tiempo de import: en los tests no hay
forma limpia de aislar dos instancias.

## Qué hay que conseguir

1. Que el estado compartido viva **dentro de la instancia que devuelve la
   fábrica**, no en el módulo. `createSupabaseRepositories()` y
   `createMockRepositories()` ya son fábricas: úsalas de verdad.
2. Sustituye el `Set` con desalojo por un mecanismo correcto: marcas con
   caducidad por tiempo, o comparación por el propio contenido de la fila. Lo
   que elijas, que no pueda perder una marca por presión de tamaño.
3. Que dos instancias de repositorio no compartan listeners ni canales, para que
   los tests puedan aislarlas.
4. Compatibilidad hacia atrás: `resetState()`, `advanceMockClock()`,
   `CURRENT_USER_ID` y `mockNowMs()` los usan las suites de contrato y de
   sesiones. Si cambias su forma, actualiza a quien las llame **dentro de tu
   alcance** y avisa de lo que quede fuera.

## Criterio de terminado

- `npm run typecheck`, `npm run lint` limpios.
- `npm test -- --ci --runInBand` en verde, incluida la suite de contrato.
- Un test que demuestre que dos instancias de repositorio no se contaminan.
- `npx expo export --platform web` sin errores.
- `docs/plan/todo/arquitecto.md` actualizado.

---

## Cierre para todas las órdenes

1. Commitea a medida que avanzas, con commits pequeños y en el estilo del repo
   (español, imperativo, con el bloque entre paréntesis).
2. Marca lo hecho en `docs/plan/todo/<bloque>.md` y en `docs/plan/TODO.md`.
3. Si te topas con algo fuera de tu alcance de archivos, **para y dilo** en vez
   de improvisar — puede haber otra sesión trabajando en paralelo.
4. Nunca bajes un suelo de cobertura para que pase un cambio.
5. Expo SDK 57: consulta `https://docs.expo.dev/versions/v57.0.0/` antes de
   escribir código que toque APIs de Expo.
