# Valoración de 1 toque post-sesión — diseño

Fecha: 2026-09-15. Estado: escrito a partir de la descomposición de Fase 2 de
`docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md`; pendiente de
revisión del usuario.

## Contexto

`docs/plan/CONCEPTO.md` pone la valoración en el paso 6 del flujo, ya en Fase 2:
"Rating de 1 toque post-sesión". La spec de sesiones la declaró como la segunda
pieza de la Fase 2 y le dejó dos cosas hechas:

- La tabla `session_attendance`, con la semántica escrita allí y que esta spec
  **no redefine**: asistió = tiene fila con `joinedAt < endsAt`; abandonó =
  `leftAt` no nulo y `leftAt < endsAt`; un `leftAt` nulo **no** distingue "se
  quedó hasta el final" de "cerró la app".
- El final de la sesión ya tiene pantalla: `src/app/session/[sessionId].tsx`
  pinta "Sesión completada" y un botón de volver al chat. Ahí no hay nada que
  rediseñar, solo algo que poner.

Las sesiones están cerradas salvo la verificación con dos móviles, que es del
usuario. Esta pieza no depende de ella.

## Qué problema resuelve, y cuál no

Resuelve **cerrar el bucle**: la sesión termina y la app pregunta una cosa, una
sola vez, de un toque. Sin eso, una sesión Lock-In acaba en una pantalla que se
despide y ya está, y no queda ni rastro de si valió la pena.

No resuelve reputación. **No hay nota pública, ni media, ni estrellas visibles a
nadie.** Es deliberado y conviene dejarlo escrito, porque es la decisión que más
fácil se desanda por inercia: un número público al lado de una cara convierte a
las dos personas de un match en evaluador y evaluado, y eso choca de frente con
el principio innegociable de `CONCEPTO.md` — nadie contrata a nadie, los dos
lados son pares. Una valoración privada no crea esa asimetría.

### Para qué sirve entonces lo que se guarda

Con honestidad sobre el estado real: hoy el consumidor de la valoración es la
propia UI (te confirma lo que acabas de valorar y deja de preguntar). El valor a
plazo es ser la señal que lean piezas posteriores — Rachas primero, y cualquier
trabajo de calidad del deck después. Eso es suficiente para construirla **porque
es barata** (una tabla, un RPC, tres botones) y porque la señal solo se puede
recoger en el momento: una sesión de hace un mes ya no la valora nadie. No es
suficiente para construir encima nada más todavía: cualquier agregado espera a
tener datos y a su propia spec.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| Qué se valora | **La sesión**, no la persona |
| Escala | Tres opciones de un toque: `floja` · `bien` · `genial` |
| Quién la ve | **Solo quien la escribe.** La otra persona no la ve nunca |
| Quién puede valorar | Quien asistió, y **solo si la otra persona también asistió** |
| Cuándo | Desde que la sesión termina hasta 24 h después |
| Se puede cambiar | No. Un toque y queda escrita |
| Dónde se pide | Pantalla de sesión al terminar, y tarjeta del chat como repesca |
| Realtime | No. Es privada y la escribe tu propio dispositivo |

### Por qué tres opciones y no dos ni cinco

Dos (pulgar arriba/abajo) fuerza a llamar "mala" a una sesión que fue normal, y
casi todo el mundo acaba dando el pulgar bueno; la señal se satura. Cinco
estrellas no es un toque: es leer una escala y decidir dónde cae. Tres opciones
con nombre —no con número— se responden sin pensar y reparten: `floja` es la que
de verdad informa, y existe precisamente para que `bien` signifique algo.

### Por qué la otra persona no la ve

Porque si la ve, se deja de decir `floja`. Una valoración que la persona
valorada puede leer mide lo que uno se atreve a decirle a la cara a alguien con
quien acaba de pasar dos horas, no cómo fue la sesión. Y la alternativa habitual
—doble ciego con revelación al cerrar las dos, estilo Airbnb— es maquinaria cara
para un producto que todavía no lee el dato. Privada y punto.

### Por qué hace falta que los dos hayan asistido

Si la otra persona no entró, preguntarte "¿qué tal fue la sesión?" es sordo: no
hubo sesión. Y convertir esa pregunta en el sitio donde se denuncia un plantón
haría de la valoración un castigo, que es justo lo que no queremos que sea.

El plantón **ya está registrado** sin necesidad de que nadie lo valore: la
ausencia de fila en `session_attendance` es el dato, y está ahí para que Rachas
—o quien venga— lo lea. Así que cuando la otra persona no entró, la pantalla de
sesión lo dice ("{nombre} no entró") y no pregunta nada.

Es una restricción reversible: si con datos reales se ve que se pierden
demasiadas valoraciones por esta puerta, se abre. Abrirla es cambiar una
condición del RPC; cerrarla después de haber mostrado notas de plantón, no.

### Por qué 24 h y por qué inmutable

Una sesión de anteayer no la recuerda nadie con detalle; lo que se recoja pasado
ese punto es ruido, y una tarjeta del chat que sigue preguntando por algo viejo
es una tarjeta que se aprende a ignorar. Pasadas las 24 h la sesión se queda sin
valorar, que es un resultado legítimo y no un error.

Inmutable porque cambiar un dato privado que no lee nadie no le sirve a nadie, y
en cambio obliga a un estado más en la tarjeta y a un camino de conflicto más en
el RPC. El toque accidental se mitiga donde toca: tres objetivos táctiles
grandes y separados (§ Pantallas).

**Reintento sí, cambio no.** Con red inestable, el mismo toque puede llegar dos
veces; volver a mandar **el mismo valor** se acepta en silencio (idempotente,
igual que `join_session`). Mandar **otro distinto** es `SessionConflictError`.

## 1. Modelo, reglas y contrato

### Dominio — `src/data/types.ts`

```ts
/** Valoración de un toque de una sesión terminada. Privada de quien la escribe. */
export type SessionRating = 'floja' | 'bien' | 'genial';

/** Valoración que una persona dio a una sesión. Nadie más que ella la lee. */
export interface SessionRatingEntry {
  sessionId: string;
  /** Quien valora. Siempre el usuario actual: no se leen las de nadie más. */
  profileId: string;
  rating: SessionRating;
  ratedAt: string;
}
```

Constante compartida: `RATING_WINDOW_HOURS = 24`.

### Reglas

Las nueve, con el mismo criterio de la spec de sesiones — se cumplen igual en el
mock y en Supabase, y la suite de contrato las prueba en los dos:

1. Solo se valora una sesión con `status = 'aceptada'` y ya **terminada**
   (`now ≥ endsAt`). Una cancelada, rechazada, en curso o que nunca empezó no se
   valora.
2. La ventana se cierra en `endsAt + 24 h`.
3. Valora quien asistió: fila propia en `session_attendance` con
   `joinedAt < endsAt`.
4. Y solo si **la otra persona también asistió**, con el mismo criterio.
5. Una valoración por persona y sesión. Repetir el mismo valor no cambia nada y
   no es error; mandar otro distinto sí lo es.
6. No se puede cambiar ni borrar.
7. Nadie lee la valoración de otra persona. Ni la otra parte del match, ni nadie
   fuera de él.
8. Quien no es del match no lee ni escribe nada de sus sesiones — ya vale para
   las sesiones, y vale igual aquí.
9. Que una sesión esté sin valorar nunca bloquea nada: ni proponer otra, ni
   entrar, ni el chat.

### Contrato — `src/data/repositories.ts`

Se añaden tres métodos a `LockInSessionRepository`. **No hay repositorio nuevo**:
esto es estado de una sesión, y un quinto repositorio en `Repositories` solo por
tres métodos obligaría a tocar `active.ts`, `provider.tsx` y las dos fábricas
para nada.

```ts
export interface LockInSessionRepository {
  // … los diez métodos que ya existen …

  /**
   * La sesión terminada de ese match que toca valorar, o `null`. Es la más
   * reciente que cumple las reglas 1-4 y que todavía no has valorado.
   */
  getRatable(matchId: string): Promise<LockInSession | null>;
  /** Tu valoración de esa sesión, o `null` si no la has valorado. */
  getMyRating(sessionId: string): Promise<SessionRating | null>;
  /** Escribe tu valoración. Repetir el mismo valor es idempotente. */
  rate(sessionId: string, rating: SessionRating): Promise<SessionRatingEntry>;
}
```

`getRatable` devuelve **una** sesión, no una lista, porque la tarjeta del chat
pinta un estado y no una bandeja. Dos sesiones terminadas y sin valorar en el
mismo match dentro de la misma ventana es posible (dos sesiones el mismo día);
se ofrece la más reciente y la anterior caduca sin valorar. Es aceptable: la vía
principal es la pantalla de sesión al terminar, no la repesca.

**Errores: los cuatro de siempre, ninguno nuevo.** La tabla de
`src/data/session-errors.ts` no cambia:

| Error | Cuándo, aquí |
|---|---|
| `SessionConflictError` (LI001) | Ya valoraste esa sesión con otro valor |
| `SessionWindowError` (LI003) | La sesión no ha terminado, o pasaron 24 h |
| `SessionForbiddenError` (LI004) | No asististe, no asistió la otra persona, la sesión no es de un match tuyo, o no está aceptada |

`SessionExpiredError` (LI002) **no se usa en esta pieza**: fuera de ventana es
`SessionWindowError`, igual que ya lo es entrar fuera de la ventana de entrada.

### Supabase — migración nueva en `supabase/migrations/`

Archivo `20260915000100_session_ratings.sql`, con el mismo patrón que la de
sesiones (nadie escribe la tabla directamente; todo pasa por RPCs
`SECURITY DEFINER` con `search_path = ''`):

- Enum `public.session_rating` con `('floja', 'bien', 'genial')`.
- Tabla `public.session_ratings`: `session_id` → `lockin_sessions` on delete
  cascade, `profile_id` → `profiles` on delete cascade, `rating`, `rated_at
  timestamptz not null default now()`, PK compuesta `(session_id, profile_id)`.
- RLS: **una sola política de select, y es `profile_id = (select auth.uid())`**
  — no `is_session_member`, que es lo que usan las otras dos tablas y lo que
  saldría por inercia de copiar la migración anterior. Aquí haría la valoración
  legible por la otra parte del match, que es exactamente lo que esta spec
  prohíbe. Sin políticas de insert/update/delete. `anon` revocado.
- Helper inmutable `public.session_rating_window_is_open(p_starts_at, p_blocks,
  p_now)`, espejo de `isInRatingWindow` en `src/data/sessions.ts`:
  `p_now >= session_ends_at(...) and p_now < session_ends_at(...) + interval '24 hours'`.
- Helper `public.session_both_attended(p_session_id uuid)`: las dos personas del
  match tienen fila de asistencia con `joined_at < session_ends_at(...)`.
- RPC `public.rate_session(p_session_id uuid, p_rating public.session_rating)`
  → `public.session_ratings`. Bloquea la sesión con `lock_member_session()`
  (que ya existe y ya lanza LI004 si el match no es tuyo), valida las reglas 1-4
  y hace `insert … on conflict (session_id, profile_id) do nothing`; si no
  insertó, compara con la fila existente: mismo valor → la devuelve; distinto →
  LI001.
- RPC `public.ratable_session(p_match_id uuid)` → `public.lockin_sessions`,
  `stable`. La más reciente por `starts_at desc` que cumple 1-4 y no tiene fila
  de valoración del actor. Devuelve cero filas si no hay.
- `revoke execute … from public, anon` y `grant execute … to authenticated` para
  todo lo nuevo, igual que en la migración de sesiones.
- **Realtime: `session_ratings` NO entra en `supabase_realtime`.** La escribe tu
  propio dispositivo, que ya sabe lo que acaba de escribir, y no hay nadie más a
  quien avisar. Meterla publicaría cambios de una tabla privada.
- `supabase/seed.sql` no siembra valoraciones.

**Cotejo de esquema.** La migración entra en `schema-fingerprint.sql` sin tocar
el script, y `supabase/drift-check.mjs` **tampoco se toca**: parsea
`supabase/migrations/` y descubre solo la tabla, el enum y los dos RPCs
(`parseMigrations`, y la comprobación de que `anon` no lee la tabla recorre
`expected.tables`). Si al correrlo algo de esto no aparece en su salida, es que
la migración no está escrita como el parser espera —`create table public.…`,
`create type public.… as enum`, `create … function public.…(`— y el arreglo es
la migración, no el script.

## 2. Pantallas

### Alcance de archivos

Esta pieza **no crea un bloque de archivos nuevo**: vive entera dentro del
alcance del bloque `sesiones` (`src/features/session/`, `src/app/session/`, las
piezas de sesiones de `src/data/**` y `supabase/migrations/`). Tiene plan y
checklist propios (`docs/plan/todo/valoracion.md`), pero el dueño de los
archivos sigue siendo el mismo, así que **`valoracion` y `sesiones` no se lanzan
a la vez**. No hay ningún cruce nuevo con otros bloques: ni `chat`, ni
`arquitecto`, ni `jest.setup.js`.

Archivos nuevos dentro de `src/features/session/`: `rating.ts` (reglas puras de
qué pedir), `rating-chips.tsx` (la fila de tres), `use-rating.ts` (carga y
escritura). Y se modifican `card-state.ts`, `session-card.tsx`,
`use-active-session.ts`, `index.ts` y `src/app/session/[sessionId].tsx`.

### Pantalla de sesión — el final

Hoy, con `phase.kind === 'terminada'`, se pinta "Sesión completada" y "Volver al
chat". Pasa a depender de tres casos:

| Caso | Qué se pinta |
|---|---|
| Los dos asistieron y no has valorado | "Sesión completada" · "¿Qué tal ha ido?" · los tres chips · "Volver al chat" |
| Ya has valorado (o acabas de hacerlo) | "Sesión completada" · "Gracias — solo lo ves tú" · "Volver al chat" |
| La otra persona no entró | "Sesión completada" · "{nombre} no entró" · "Volver al chat" |

Un toque en un chip llama a `rate` y pasa al segundo caso **sin navegar**: la
pantalla no se cierra sola, porque cerrarse al tocar deja la duda de si se
registró. La línea "solo lo ves tú" es parte del producto, no adorno: es lo que
hace que alguien se atreva a tocar `floja`.

Si `rate` falla, se queda en el primer caso con "No se ha podido guardar" y los
chips siguen activos. Ante `SessionWindowError` (se cruzaron las 24 h con la
pantalla abierta) o `SessionForbiddenError`, pasa al tercer caso con "Ya no se
puede valorar": no se reintenta algo que el servidor no va a aceptar.

Los chips son tres `Pressable` con `accessibilityRole="radio"` en una fila,
altura mínima táctil de 44 y separación de `Spacing.two` — la misma talla que
usan el resto de botones del bloque, que es lo que hace que un toque
accidental sea improbable sin necesidad de deshacer.

### Tarjeta del chat — la repesca

`cardView` gana un estado, y con él un segundo argumento: hoy recibe la sesión
viva, y ahora también la valorable.

```ts
export type CardView =
  | { kind: 'agendar' }
  | { kind: 'esperando'; session: LockInSession }
  | { kind: 'recibida'; session: LockInSession }
  | { kind: 'aceptada'; session: LockInSession }
  | { kind: 'entrar'; session: LockInSession }
  | { kind: 'valorar'; session: LockInSession };

export function cardView(
  live: LockInSession | null,
  ratable: LockInSession | null,
  myProfileId: string | null,
  nowMs: number
): CardView;
```

**La sesión viva gana siempre.** Si hay una propuesta o una sesión por empezar,
eso es lo accionable ahora y la valoración espera a su repesca, o caduca. Un
chat no puede pedir dos cosas a la vez sin que una de las dos se ignore.

En `valorar`, la tarjeta dice "¿Qué tal fue la sesión con {nombre}?" y pinta los
mismos tres chips. Al tocar, se sustituye por "Gracias — solo lo ves tú" y, en
el siguiente refresco, vuelve a `agendar`. Existe para el caso real de cerrar la
app antes de que la sesión termine, que es exactamente lo que hace quien sale
antes o se queda sin batería.

`useActiveSession` pasa a pedir también `getRatable` en la misma carga y con el
mismo tic de 30 s; no hace falta suscripción nueva porque la valoración solo la
cambias tú.

## 3. Casos límite

| Caso | Comportamiento |
|---|---|
| Nadie entró a la sesión | No hay nada que valorar: `getRatable` no la devuelve |
| Entraste tú solo | Igual: regla 4. La pantalla dice "{nombre} no entró" |
| Entraste después de que terminara | Imposible: `join` ya no deja entrar pasada `endsAt` |
| Entraste y te fuiste al minuto | Cuenta como asistencia (regla 3 mira `joinedAt`); el abandono queda en `leftAt` para quien lo lea |
| Doble toque en el mismo chip | Idempotente: la segunda llamada devuelve la misma fila |
| Toque en dos chips seguidos | El segundo da `SessionConflictError`; la UI ya está en "Gracias" y no lo muestra |
| Las 24 h se cruzan con la pantalla abierta | `SessionWindowError` → "Ya no se puede valorar" |
| Dos sesiones terminadas sin valorar | Se ofrece la más reciente; la otra caduca |
| Sin conexión al valorar | "No se ha podido guardar", chips activos, se reintenta con otro toque |
| La sesión se cancela antes de empezar | Nunca es valorable: regla 1 |
| Sesión de un match del que ya no eres parte | LI004 por `lock_member_session`, como el resto |

## 4. Tests

| Nivel | Qué |
|---|---|
| Unitarios | `isInRatingWindow`: el milisegundo de `endsAt`, dentro, y el milisegundo de `endsAt + 24 h`. `canRate` con las cuatro combinaciones de asistencia. `cardView` con el argumento nuevo: `valorar` cuando toca, y que la viva gana cuando hay las dos. Traducción de LI001/LI003/LI004 en la ruta de `rate` |
| Contrato (`src/data/repositories.contract.ts`) | Las nueve reglas, en mock y contra Supabase con `LOCKIN_SUPABASE_CONTRACT=1`: no se valora una sesión viva, ni cancelada, ni rechazada; sí una terminada con los dos dentro; no si falta la asistencia de cualquiera de los dos; mismo valor dos veces es idempotente; valor distinto da conflicto; pasadas 24 h da ventana; un tercero no puede valorar ni leer; `getMyRating` de la otra persona nunca se ve (el contrato lo comprueba con los dos clientes); `getRatable` deja de devolverla en cuanto se valora. Con el reloj simulado del mock para las ventanas |
| Componentes (RNTL) | Los tres casos del final de la pantalla de sesión, incluido que tocar un chip no navega; el fallo de `rate` y sus dos mensajes; `SessionCard` en `valorar` y que la viva gana |
| Esquema | La migración entra en `schema-fingerprint.sql` sin cambios en el script; `drift-check.mjs` sondea los dos RPCs nuevos; `schema-drift.yml` seguirá exigiendo que el proyecto real coincida **una vez el usuario la aplique** |
| E2E Android | Se extiende `e2e/session.yaml`: tras salir de la sesión, el caso vuelve con una sesión ya terminada (fixture nuevo `e2e/session-ended.sql`, patrón de `session-now.sql`, con las dos filas de asistencia), toca `Genial` y `e2e/verify.mjs` comprueba la fila en `session_ratings` con ese valor |

El suelo de cobertura de `jest.config.js` no baja.

## Fuera de alcance de esta spec

Agregados y medias, nota visible de nadie, efecto de la valoración en el deck o
en el orden de nada, comentarios de texto libre, valorar a la persona en vez de
a la sesión, denunciar un plantón, rachas, y cualquier notificación que recuerde
valorar.

## Dependencias

Ninguna pendiente. Las sesiones están entregadas; la única casilla abierta de
`docs/plan/todo/sesiones.md` es la verificación con dos móviles, que no toca
nada de esto. Como en la pieza anterior, **aplicar la migración en el proyecto
real `grrzmzktrhksbttpbblg` es del usuario** (SQL Editor del dashboard): sin
ese paso, todo lo demás avanza igual contra el mock y contra la Supabase local
desechable de `contract.yml`, y lo único que se queda en rojo es el job remoto
de `schema-drift.yml`.
