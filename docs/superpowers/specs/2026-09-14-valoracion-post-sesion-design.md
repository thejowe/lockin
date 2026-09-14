# Valoración de 1 toque post-sesión — diseño

Fecha: 2026-09-14. Estado: secciones 1 y 2 aprobadas en conversación; la
sección 3 y el resto los cerró el agente por encargo explícito del usuario
(«termina la spec y el plan sin hacer preguntas»). Pendiente de revisión del
documento escrito.

## Contexto

Segunda pieza de la Fase 2 según
`docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md` → "Descomposición
de la Fase 2". Las sesiones Lock-In ya existen: `lockin_sessions`,
`session_attendance`, `LockInSessionRepository` (mock y Supabase bajo la misma
suite de contrato), pantalla `src/app/session/[sessionId].tsx` y `SessionCard`
en el chat.

`docs/plan/CONCEPTO.md` la describe en una línea: «Rating de 1 toque
post-sesión». Esta spec decide qué significa.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| Qué se valora y quién lo ve | La otra persona como compañera: «¿Repetirías con {nombre}?» Sí/No. **Privado**: solo lo lee quien responde |
| Efecto en esta versión | **Solo se guarda.** Ranking, rachas o cualquier uso, en su propia spec |
| Dónde se pregunta | Pantalla «Sesión completada» **y**, si no se respondió allí, pendiente en la tarjeta del chat |
| Quién puede responder | Solo si **asistieron las dos personas** (`joinedAt < endsAt` las dos) |
| Arquitectura | Tabla propia `session_ratings` con RLS de lectura propia + RPCs; dos métodos nuevos en `LockInSessionRepository` |
| Cambiar la respuesta | No. Inmutable, como un swipe |
| Qué sesión se pregunta | Solo la última sesión terminada del match |
| Caducidad | 7 días tras `endsAt`, derivada de la hora, sin guardar nada |
| «Ahora no» | Descarte local en AsyncStorage por sesión; no escribe en la base |
| Prioridad en la tarjeta | Manda la sesión viva; la pregunta solo aparece en el estado «Agendar» |

Descartados:

- **Columnas en `session_attendance`.** Su RLS deja leer la fila a la otra
  persona del match: la respuesta se filtraría. Arreglarlo con permisos por
  columna complica la huella de esquema.
- **Solo en el dispositivo.** No persiste ni sirve a la spec futura que la use.
- **Respuesta visible o con efecto observable** (reputación en el perfil, «No»
  que impide proponer). Presión social, represalias y, en el segundo caso, la
  otra persona deduce la respuesta. Choca con «nadie contrata a nadie».

## 1. Modelo, reglas y contrato

### Dominio — `src/data/types.ts`

```ts
export interface SessionRating {
  sessionId: string;
  raterId: string;
  /** «¿Repetirías con {nombre}?» */
  wouldRepeat: boolean;
  createdAt: string;
}
```

### Reglas de tiempo — `src/data/sessions.ts`

Espejo en SQL, igual que `isSessionLive` ↔ `session_is_live`.

```ts
export const RATING_WINDOW_DAYS = 7;

/** Aceptada, ya terminada y hace menos de 7 días. */
export function isRatingOpen(session: SessionTiming, nowMs: number): boolean;

/** Las dos personas del match entraron antes del final. */
export function bothAttended(
  session: Pick<LockInSession, 'id' | 'startsAt' | 'blocks'>,
  attendance: readonly SessionAttendance[],
  memberIds: readonly string[]
): boolean;
```

`isRatingOpen`: `status = 'aceptada'` y `endsAt ≤ now < endsAt + 7 días`.

`bothAttended`: cada id de `memberIds` (los dos del match) tiene una fila de
`attendance` de esa sesión con `joinedAt < endsAt`. Con `memberIds` vacío
devuelve `false`.

### Reglas

1. Responde un miembro del match, sobre una sesión con `isRatingOpen` y
   `bothAttended`.
2. Una respuesta por persona y sesión. No se cambia.
3. Solo quien respondió lee su respuesta. No hay ningún método del contrato que
   lea respuestas ajenas, ni evento de Realtime.
4. **Pendiente** (`getPendingRating(matchId)`): se toma la sesión `aceptada` del
   match con el `startsAt` más reciente entre las ya terminadas (`endsAt ≤
   now`). Es la pendiente si cumple la regla 1 y el actor no la ha valorado. Si
   no, `null`: nunca se retrocede a una sesión anterior. Fuera del match,
   `null`.
5. `rate` acepta cualquier sesión que cumpla la regla 1, no solo la más
   reciente. Inofensivo y simplifica la validación.

### Contrato — `src/data/repositories.ts`

Se añade a `LockInSessionRepository`:

```ts
/** Última sesión terminada del match pendiente de valorar por mí, o `null`. */
getPendingRating(matchId: string): Promise<LockInSession | null>;
/** Guarda «¿Repetirías?». Solo lo podrá leer quien responde. */
rate(sessionId: string, wouldRepeat: boolean): Promise<SessionRating>;
```

Errores, reutilizando las clases y códigos existentes, comprobados en este
orden:

| Orden | Caso | Error | Código |
|---|---|---|---|
| 1 | La sesión no existe o el match no es tuyo | `SessionForbiddenError` | `LI004` |
| 2 | No está `aceptada`, no ha terminado o pasaron 7 días | `SessionWindowError` | `LI003` |
| 3 | No asistieron las dos personas | `SessionForbiddenError` | `LI004` |
| 4 | Ya habías respondido | `SessionConflictError` | `LI001` |

### Supabase — migración `supabase/migrations/20260914000100_session_ratings.sql`

- Tabla `session_ratings`: `session_id` → `lockin_sessions` `on delete
  cascade`, `rater_id` → `profiles` `on delete cascade`, `would_repeat boolean
  not null`, `created_at timestamptz not null default now()`. PK `(session_id,
  rater_id)`.
- RLS activada. Única política: `select` a `authenticated` `using (rater_id =
  (select auth.uid()))`. Ninguna de insert/update/delete. `anon` revocado.
- `session_rating_open(status, starts_at, blocks, p_now)` — `immutable`, espejo
  de `isRatingOpen`.
- `session_both_attended(p_session_id)` — `stable`, **sin** `security definer`:
  llamada por un usuario, la RLS de `session_attendance` ya limita a sesiones
  de sus matches; dentro de `rate_session` (definer) ve todo.
- `rate_session(p_session_id uuid, p_would_repeat boolean) → session_ratings`
  — `security definer`, `search_path = ''`. Usa `lock_member_session` (que ya
  da `LI004`) y valida el resto en el orden de la tabla. Inserta con `on
  conflict do nothing`; si no insertó, `LI001`.
- `pending_session_rating(p_match_id uuid) → setof lockin_sessions` — `stable`,
  sin definer (RLS hace el filtrado por match). Devuelve 0 o 1 filas; `setof`
  evita que PostgREST devuelva un objeto con todos los campos a `null`.
- EXECUTE revocado de `public`/`anon`, concedido a `authenticated`.
- **No** entra en `supabase_realtime`.
- `supabase/seed.sql` no siembra valoraciones.

La migración se aplica en `grrzmzktrhksbttpbblg` a mano por el SQL Editor, como
la de sesiones; hasta entonces `schema-drift.yml` en su job remoto sale rojo, y
es deriva real (ver la memoria del proyecto: desde el 2026-09-13 un rojo ahí es
deriva real).

### Mock — `src/data/mock/`

- `MockState.sessionRatings: SessionRating[]`, vaciado por `resetState()`.
- `getPendingRating` y `rate` en `createMockSessionRepository(actorId)`, con
  `mockNowMs()`, `isRatingOpen` y `bothAttended`, en el mismo orden de errores.
- `rate` avisa por `sessionsTopic(matchId)`.

## 2. Pantallas y flujo

### `RatingPrompt` — `src/features/session/rating-prompt.tsx`

Presentacional.

- Título «¿Repetirías con {nombre}?»; debajo, pequeño, «Solo lo verás tú.».
- Botones «Sí» y «No» con el mismo tono (`quiet`), para no empujar ninguna
  respuesta. `accessibilityLabel`: «Sí, repetiría» y «No repetiría».
- «Ahora no» solo si recibe `onDismiss`.
- Botones deshabilitados con `busy`. `notice` se pinta en color `danger`.
- Props: `counterpartName`, `onAnswer(wouldRepeat)`, `onDismiss?`, `busy`,
  `notice`.

### `usePendingRating(matchId: string | null)` — `src/features/session/use-pending-rating.ts`

- `useQuery('session:rating:{matchId}', …)`; con `matchId = null` no consulta
  y devuelve `session: null`.
- Refresca con `sessions.subscribe(matchId)` y con un tic de `SESSION_TICK_MS`.
- Descarte local: clave `lockin:rating-dismissed:{sessionId}` = `'1'`. Una
  sesión descartada se devuelve como `null`.
- Devuelve `{ session, busy, notice, answered, answer(wouldRepeat), dismiss(), refresh }`.
- `answer`: llama a `rate`. Éxito → `answered = true` y `refresh`. Error de
  dominio (`SessionConflictError`, `SessionWindowError`,
  `SessionForbiddenError`) → `refresh` en silencio. Cualquier otro → `notice =
  'No se ha podido guardar. Inténtalo otra vez.'`.

### Pantalla de sesión — estado «Sesión completada»

- `usePendingRating(ended ? match.id : null)`.
- Si `pending.session?.id === session.id`, pinta `RatingPrompt` **sin**
  `onDismiss`: «Volver al chat» ya sirve para saltar y deja la pregunta
  pendiente en el chat.
- Si al pasar a terminada la consulta devuelve `null`, reintenta **una vez a
  los 5 s**: el reloj corregido con `serverNow()` puede cruzar `endsAt` un
  instante antes que el servidor.
- `answered` → «Gracias.» en lugar de la pregunta.
- «Volver al chat» sigue siempre visible debajo.

Quien sale antes no llega aquí (`router.back()`); le llega por la tarjeta.

### Tarjeta del chat — `SessionCard`

- `cardView` **no cambia**. `SessionCard` llama a `usePendingRating(match.id)`
  y, cuando `view.kind === 'agendar'` y hay pendiente, pinta `RatingPrompt`
  **con** «Ahora no» encima del botón «Agendar sesión Lock-In».
- `answered` en `agendar` → «Gracias.» en ese hueco.
- Con sesión viva no aparece. Si esa nueva sesión termina y cumple las reglas,
  pasa a ser la pendiente.

### Alcance de archivos

Bloque `sesiones`, sin bloque nuevo. Todo cae en su alcance declarado en
`docs/plan/PLAN.md`: `src/features/session/`, `src/app/session/`, y
`src/data/**` + `supabase/**` en coordinación con `datos`, como la spec
anterior. Además `test/app/sessionId.test.tsx` y `.github/workflows/contract.yml`
(lista de saltos admitidos). Ningún archivo de otro bloque de producto.

## 3. Casos límite y tests

### Casos límite

| Caso | Comportamiento |
|---|---|
| Responder a la vez desde dos dispositivos propios | PK + `on conflict do nothing`; el segundo recibe `SessionConflictError` y la pregunta desaparece |
| Reloj del móvil adelantado al terminar | Pantalla reintenta a los 5 s; si sigue sin estar, la tarjeta del chat la recoge con su tic |
| La otra persona entró y salió antes (abandono) | Asistió (`joinedAt < endsAt`): hay pregunta para las dos |
| La otra persona no entró | Nadie tiene pregunta; `rate` → `SessionForbiddenError` |
| Nueva sesión propuesta sin responder la anterior | La tarjeta pinta la sesión viva; al terminar esa, la pendiente es la nueva (o nada) |
| «Ahora no» y reinstalar la app | El descarte se pierde con AsyncStorage; vuelve a preguntarse mientras no caduque |
| Pasan 7 días | `getPendingRating` → `null`; `rate` → `SessionWindowError` |
| Sin conexión al responder | «No se ha podido guardar. Inténtalo otra vez.»; botones activos |
| Borrar perfil o match | `on delete cascade` arrastra las valoraciones |
| Web | Igual que en móvil; AsyncStorage funciona en web |

### Tests

| Nivel | Qué |
|---|---|
| Unitarios (`src/data/sessions.test.ts`) | `isRatingOpen`: antes del final, en el milisegundo de `endsAt`, a 7 días menos 1 ms, a 7 días justos, estados distintos de `aceptada`. `bothAttended`: los dos, uno, entrada en `endsAt` justo, fila de otra sesión, `memberIds` vacío |
| Contrato (`src/data/repositories.contract.ts`) | Sin reloj: sin sesiones no hay pendiente; no se valora una sesión en curso (`SessionWindowError`); alguien de fuera no valora (`SessionForbiddenError`). Con `itWithTimeTravel`: las dos personas tienen pendiente y responder la cierra solo para quien responde; con una sola asistencia no hay pendiente y `rate` da `SessionForbiddenError`; responder dos veces choca; caduca a los 7 días; la pendiente es la última terminada y no retrocede |
| Supabase sin red (`src/data/supabase/sessions.test.ts`) | `toSessionRating`; `rate` llama a `rate_session` y traduce `LI00x`; `getPendingRating` con array vacío y con una fila |
| Esquema (`supabase/schema-embedded.test.mjs`) | `session_ratings` con `rls=t`; tabla de verdad de `session_rating_open` con los mismos bordes que el unitario; la política de lectura propia en la huella |
| Componentes (RNTL) | `RatingPrompt`; `SessionCard` con pendiente (responder, «Ahora no» persistido, oculta con sesión viva, error de red); pantalla de sesión completada con y sin pregunta y respuesta |
| CI | Los títulos nuevos `itWithTimeTravel` se añaden a la lista de `contract.yml` |

**Fuera de la verificación automática, a propósito.** La privacidad de la RLS
contra Postgres real con dos usuarios necesita que la sesión termine, lo que la
suite de contrato de Supabase no puede esperar; queda cubierta por la política
en la huella de PGlite, por la ausencia de cualquier método que lea respuestas
ajenas y por `schema-drift.yml` una vez aplicada la migración. Sin E2E Android
nuevo: el flujo no añade pegamento pantalla ↔ repositorio distinto del que ya
cubre `e2e/session.yaml`. El suelo de cobertura de `jest.config.js` no baja.

## Fuera de alcance

Mostrar la valoración a nadie, usarla en el deck, rachas, texto libre o motivo
del «No», valorar sesiones antiguas, notificaciones para recordar la pregunta,
cambiar la respuesta.
