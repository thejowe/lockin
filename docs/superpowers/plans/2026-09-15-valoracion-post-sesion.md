# Valoración de 1 toque post-sesión — plan de implementación

**Goal:** Que al terminar una sesión Lock-In a la que entraron las dos personas,
cada una pueda valorarla de un toque —`floja`, `bien` o `genial`— en las 24 h
siguientes, y que esa valoración sea privada de quien la escribe.

**Architecture:** Tabla `session_ratings` en Supabase, escrita solo por un RPC
`SECURITY DEFINER`, con RLS de select restringida a `profile_id = auth.uid()`
(no a los miembros del match). Tres métodos nuevos en el
`LockInSessionRepository` que ya existe, cumplidos por el mock y por Supabase
bajo la misma suite de contrato. La UI la piden la pantalla de sesión al acabar
y la tarjeta del chat como repesca.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, TypeScript
estricto, Jest (`jest-expo`) + React Native Testing Library 14 (`render`,
`fireEvent` y `renderHook` asíncronos), Supabase (Postgres 17, PostgREST),
PGlite para el esquema embebido, Maestro para E2E Android.

**Spec:** `docs/superpowers/specs/2026-09-15-valoracion-post-sesion-design.md`

## Global Constraints

- `SessionRating = 'floja' | 'bien' | 'genial'`. Ventana:
  `endsAt ≤ now < endsAt + 24 h`. `RATING_WINDOW_HOURS = 24`.
- Valora quien asistió, y solo si **las dos** personas asistieron
  (`joinedAt < endsAt` en las dos filas).
- Una valoración por persona y sesión, **inmutable**. Repetir el mismo valor es
  idempotente; mandar otro distinto es `SessionConflictError`.
- **Privada.** La política de select es `profile_id = (select auth.uid())`. No
  se copia `is_session_member` de la migración de sesiones: haría legible la
  valoración por la otra parte del match, que es lo que la spec prohíbe.
- `session_ratings` **no** entra en la publicación `supabase_realtime`.
- Errores: los cuatro que ya existen. LI001 conflicto, LI003 ventana, LI004
  prohibido. **LI002 no se usa en esta pieza.**
- Las pantallas importan datos solo desde `@/data`, nunca desde `@/data/mock`
  ni `@/data/supabase`.
- **Sin cruces de alcance.** Todo cae dentro del bloque `sesiones`
  (`src/features/session/`, `src/app/session/`, piezas de sesiones de
  `src/data/**`, `supabase/migrations/`) más los archivos de esquema y E2E que
  ya tocó la pieza anterior. Nada de `src/app/chat/`, `src/app/(tabs)/`,
  `jest.setup.js` ni `src/features/chat/`. Si hace falta, **para y dilo**.
- Worktree compartido: **nunca `git add .`**; cada commit añade rutas explícitas.
- En RNTL 14 `render`, `fireEvent` y `renderHook` devuelven promesas: `await`
  siempre.
- Textos de UI en español; comentarios de código en español.
- `.sql` en LF (`.gitattributes` ya lo fija).
- El suelo de cobertura de `jest.config.js` (89.82/82.56/91.49/91.38) **no baja**.

## Lo que no se puede probar contra Supabase real, y dónde se cubre

Esto condiciona tres tareas, así que va arriba y no enterrado en una:

`propose_session` exige `starts_at ≥ now() + 5 min`, así que **contra Supabase
real no se puede fabricar una sesión terminada**: haría falta esperar 30 minutos
de reloj. La suite de contrato ya tiene el mecanismo — `itWithTimeTravel`, que
es `it.skip` cuando `backend.canTimeTravel` es `false` (ver
`src/data/repositories.contract.ts:540`)—, y hoy salta tres casos por esta misma
razón. Los casos de valoración se suman a esa lista.

Consecuencia: **el SQL de esta pieza se cubre en PGlite**, en
`supabase/schema-embedded.test.mjs`, que sí puede insertar filas con
`starts_at` en el pasado porque escribe las tablas directamente. Es la misma
división que ya usa `session_is_live()`. No te saltes la Tarea 3 pensando que
el contrato cubrirá el SQL: no lo va a hacer.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/data/types.ts` (mod) | `SessionRating`, `SessionRatingEntry` |
| `src/data/sessions.ts` (mod) | `RATING_WINDOW_HOURS`, `isInRatingWindow`, `attendedSession` |
| `src/data/repositories.ts` (mod) | `getRatable`, `getMyRating`, `rate` |
| `src/data/index.ts` (mod) | Exportar lo nuevo |
| `src/data/sessions.test.ts` (mod) | Bordes de la ventana y de la asistencia |
| `src/data/mock/store.ts` (mod) | `ratings` en el estado |
| `src/data/mock/sessions.ts` (mod) | Los tres métodos en memoria |
| `src/data/repositories.contract.ts` (mod) | Las nueve reglas |
| `supabase/migrations/20260915000100_session_ratings.sql` (nuevo) | Enum, tabla, RLS, helpers, RPCs |
| `supabase/schema-embedded.test.mjs` (mod) | Reglas del SQL en PGlite |
| `src/data/supabase/database.types.ts` (mod) | Fila y funciones nuevas |
| `src/data/supabase/sessions.ts` (mod) | Los tres métodos contra los RPCs |
| `src/data/supabase/sessions.test.ts` (mod) | Mapeo y traducción de errores |
| `src/features/session/rating.ts` (nuevo) | Reglas puras de qué pedir |
| `src/features/session/rating-chips.tsx` (nuevo) | La fila de tres |
| `src/features/session/use-rating.ts` (nuevo) | Carga y escritura |
| `src/app/session/[sessionId].tsx` (mod) | Los tres finales |
| `src/features/session/card-state.ts` (mod) | Estado `valorar` |
| `src/features/session/use-active-session.ts` (mod) | También pide `getRatable` |
| `src/features/session/session-card.tsx` (mod) | Pinta `valorar` |
| `src/features/session/index.ts` (mod) | Superficie pública |
| `e2e/session-rate.yaml` (nuevo), `e2e/verify.mjs`, `e2e/run.mjs` (mod) | E2E del toque |
| `docs/plan/PLAN.md`, `docs/plan/TODO.md`, `docs/plan/todo/valoracion.md` | Tablero |

---

### Task 1: Dominio, reglas puras y contrato

**Files:**
- Modify: `src/data/types.ts` (al final)
- Modify: `src/data/sessions.ts`
- Modify: `src/data/repositories.ts`
- Modify: `src/data/index.ts`
- Test: `src/data/sessions.test.ts`

**Interfaces:**
- Produces: `SessionRating`, `SessionRatingEntry`, `RATING_WINDOW_HOURS`,
  `isInRatingWindow(session: SessionTiming, nowMs: number): boolean`,
  `attendedSession(rows: readonly SessionAttendance[], profileId: string, session: SessionTiming): boolean`,
  y los tres métodos de `LockInSessionRepository`. Todo exportado desde `@/data`.
- Consumes: `SessionTiming`, `sessionEndsAtMs` (ya existen en
  `src/data/sessions.ts`).

- [ ] **Step 1: Tipos de dominio**

Al final de `src/data/types.ts`, con el mismo estilo de JSDoc del archivo:

```ts
/** Valoración de un toque de una sesión terminada. Privada de quien la escribe. */
export type SessionRating = 'floja' | 'bien' | 'genial';

/**
 * Valoración que una persona dio a una sesión.
 *
 * La lee solo quien la escribió: la otra parte del match no la ve ni por
 * repositorio ni por RLS. No la conviertas en nota pública ni en media sin
 * releer la spec — el principio innegociable de `CONCEPTO.md` es que los dos
 * lados de un match son pares, y una nota visible los vuelve evaluador y
 * evaluado.
 */
export interface SessionRatingEntry {
  sessionId: string;
  /** Quien valora. Siempre el usuario actual: no se leen las de nadie más. */
  profileId: string;
  rating: SessionRating;
  ratedAt: string;
}
```

- [ ] **Step 2: Reglas puras**

En `src/data/sessions.ts`, junto a las demás constantes y funciones:

```ts
export const RATING_WINDOW_HOURS = 24;

/** Se valora desde que la sesión termina hasta 24 h después, y solo si se aceptó. */
export function isInRatingWindow(session: SessionTiming, nowMs: number): boolean {
  if (session.status !== 'aceptada') return false;
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return nowMs >= endsAt && nowMs < endsAt + RATING_WINDOW_HOURS * 60 * MINUTE;
}

/** Asistió = entró antes de que la sesión acabara. Salirse antes no lo deshace. */
export function attendedSession(
  rows: readonly SessionAttendance[],
  profileId: string,
  session: SessionTiming
): boolean {
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return rows.some(
    (row) => row.profileId === profileId && Date.parse(row.joinedAt) < endsAt
  );
}
```

`attendedSession` necesita importar el tipo `SessionAttendance` en el
`import type` que ya hay arriba del archivo.

- [ ] **Step 3: Contrato**

En `src/data/repositories.ts`, dentro de `LockInSessionRepository` y después de
`listAttendance`, los tres métodos con el JSDoc de la spec (§ 1, "Contrato").
Añade `SessionRating` y `SessionRatingEntry` al `import type` de `./types`. En
el bloque de JSDoc de la interfaz, añade una línea a las reglas: "solo se valora
una sesión terminada a la que entraron los dos, dentro de las 24 h siguientes, y
la valoración es privada de quien la escribe".

- [ ] **Step 4: Exportar desde `@/data`** — *comprobado al ejecutar: no hay nada
      que hacer.*

`src/data/index.ts` reexporta `./types` y `./sessions` con `export *`, así que lo
nuevo ya sale de `@/data` sin tocar nada. El que **sí** enumera nombres uno a uno
es `src/features/session/index.ts`, y eso es cosa de la Tarea 5.

- [ ] **Step 5: Tests de las reglas puras**

En `src/data/sessions.test.ts`, junto a los de `isInJoinWindow`:

- `isInRatingWindow`: el milisegundo exacto de `endsAt` (`true`), uno antes
  (`false`), dentro, el milisegundo de `endsAt + 24 h` (`false`), y con
  `status` `propuesta`, `cancelada` y `rechazada` (`false` siempre).
- `attendedSession`: fila con `joinedAt` un ms antes de `endsAt` (`true`), en
  `endsAt` (`false`), sin fila (`false`), fila de otra persona (`false`), y
  fila con `leftAt` puesto —sigue siendo `true`, porque irse antes no borra
  haber asistido.

**Verify:** `npx tsc --noEmit`, `npx jest src/data/sessions.test.ts`,
`npm run lint`.

---

### Task 2: Mock y casos de contrato

**Files:**
- Modify: `src/data/mock/store.ts`
- Modify: `src/data/mock/sessions.ts`
- Modify: `src/data/repositories.contract.ts`

**Interfaces:**
- Consumes: todo lo de la Tarea 1.
- Produces: `createMockSessionRepository` cumpliendo los tres métodos; los casos
  de contrato que después tendrá que pasar también Supabase.

> **Andamio que tienes que retirar.** La Tarea 1 dejó los tres métodos del mock
> lanzando "todavía no está implementado", y un caso en
> `src/data/mock/index.test.ts` que lo fija —está ahí porque sin él la cobertura
> de funciones cae por debajo del suelo de `jest.config.js`, no porque pruebe
> nada de producto. Al escribir la implementación real, **borra ese caso junto
> con los stubs**: si lo dejas, quedará en rojo. Los casos de contrato que
> añades en el Step 3 devuelven de sobra la cobertura que daba.

- [ ] **Step 1: Estado del mock**

En `src/data/mock/store.ts`, añade `ratings: SessionRatingEntry[]` al estado y
a lo que `resetState()` reconstruye, al lado de `attendance`. Sigue el patrón
exacto de ese campo.

- [ ] **Step 2: Los tres métodos en memoria**

En `src/data/mock/sessions.ts`, dentro del objeto que devuelve
`createMockSessionRepository`, después de `listAttendance`. Usa los helpers que
ya hay en el archivo (`visible`, `mustSee`, `membersOf`, `mockNowMs`, `iso`) —
no escribas otros nuevos:

```ts
async getRatable(matchId) {
  if (!isMember(matchId)) return null;
  const now = mockNowMs();
  const state = getState();
  const candidates = state.lockInSessions
    .filter((session) => session.matchId === matchId && isInRatingWindow(session, now))
    .filter((session) => bothAttended(session))
    .filter(
      (session) =>
        !state.ratings.some((r) => r.sessionId === session.id && r.profileId === actorId)
    )
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return candidates[0] ? { ...candidates[0] } : null;
},
```

`bothAttended(session)` es un helper local del módulo: coge
`getState().attendance` y comprueba `attendedSession` para los dos ids de
`membersOf(session.matchId)`. Un match siempre tiene exactamente dos.

`getMyRating(sessionId)` devuelve `null` si `visible(sessionId)` es `null`, y si
no, el `rating` de la fila propia o `null`.

`rate(sessionId, rating)`:
1. `const session = mustSee(sessionId)` — LI004 si no es tuya.
2. Si `!isInRatingWindow(session, now)` → `SessionWindowError`.
3. Si no asististe tú o no asistió la otra persona → `SessionForbiddenError`.
4. Fila existente: mismo `rating` → devuélvela tal cual (idempotente); distinto
   → `SessionConflictError`.
5. Si no había, empuja `{ sessionId, profileId: actorId, rating, ratedAt: iso(now) }`
   y devuelve una copia.

**No llames a `changed()`** al valorar: `changed()` avisa a los suscriptores del
match, y la valoración es privada — avisar publicaría por el canal del match que
alguien acaba de valorar. Devuelve `{ ...row }` directamente.

- [ ] **Step 3: Casos de contrato**

En `src/data/repositories.contract.ts`, dentro del `describe` de sesiones y
después de los casos de asistencia, un `describe('valoración', …)`. Casi todos
necesitan una sesión terminada, así que van con `itWithTimeTravel`, que ya está
declarado en el archivo; los dos que no (tercero sin acceso, sesión viva) van
con `it` normal.

Un helper local del `describe` deja una sesión terminada con las dos personas
dentro: propone, `counterpartSessions().respond(id, 'aceptada')`, `elapse` hasta
la ventana de entrada, `join` por los dos lados, y `elapse` hasta pasado
`endsAt`. Devuelve el id.

Los casos, uno por regla:

1. Una sesión viva no es valorable: `getRatable` da `null` y `rate` lanza
   `SessionWindowError` (`it` normal, no hace falta viajar).
2. Terminada con los dos dentro: `getRatable` la devuelve; `rate(id, 'genial')`
   resuelve; `getMyRating` da `'genial'`; `getRatable` pasa a `null`.
3. Cancelada y rechazada nunca son valorables.
4. Falta tu asistencia → `SessionForbiddenError` y `getRatable` da `null`.
5. Falta la de la otra persona → igual.
6. Mismo valor dos veces: la segunda resuelve y no cambia `getMyRating`.
7. Valor distinto después → `SessionConflictError`, y `getMyRating` sigue en el
   primero.
8. Pasadas 24 h (`elapse`) → `SessionWindowError` y `getRatable` da `null`.
9. Privacidad: tras valorar tú, `counterpartSessions().getMyRating(id)` da
   `null`. Y `outsiderSessions().rate(id, 'bien')` lanza
   `SessionForbiddenError`, con `getRatable` del match dando `null` para ese
   tercero (`it` normal).

**Verify:** `npx jest src/data/mock src/data/sessions.test.ts`, `npx tsc --noEmit`,
`npm run lint`. Los casos nuevos deben pasar contra el mock; contra Supabase
todavía no existen los métodos y esa suite es opt-in, así que no la ejecutes aún.

---

### Task 3: Migración SQL y cobertura en PGlite

**Files:**
- Create: `supabase/migrations/20260915000100_session_ratings.sql`
- Modify: `supabase/schema-embedded.test.mjs`

**Interfaces:**
- Produces: enum `public.session_rating`; tabla `public.session_ratings`;
  `public.session_rating_window_is_open(timestamptz, smallint, timestamptz)`;
  `public.session_both_attended(uuid)`; `public.rate_session(uuid,
  public.session_rating)`; `public.ratable_session(uuid)`.
- Consumes: `public.session_ends_at`, `public.lock_member_session`,
  `public.is_match_member` (todas de `20260913000100_lockin_sessions.sql`).

- [ ] **Step 1: La migración**

Lee entera `supabase/migrations/20260913000100_lockin_sessions.sql` antes de
escribir: esta migración es su continuación y debe salir igual de reconocible
(cabecera que dice de qué spec sale, `set search_path = ''` en todas las
funciones, `revoke`/`grant` al final, un objeto por línea para que la huella de
esquema lo lea).

Puntos donde es fácil equivocarse, todos ya decididos en la spec:

- La política de select es `profile_id = (select auth.uid())`. **No**
  `is_session_member`.
- Sin políticas de insert, update ni delete. `revoke all … from anon`.
- `rate_session` empieza por `public.lock_member_session(p_session_id)`, que ya
  lanza LI004 si la sesión no existe o el match no es tuyo.
- **Orden de validación dentro de `rate_session`, y el contrato ya lo fija**
  (Tarea 2, caso "una cancelada o una rechazada nunca son valorables"): estado
  `aceptada` **primero y por separado** (LI004) → ventana abierta (LI003) →
  asistencia de los dos (LI004) → insert. `session_rating_window_is_open` ya
  devuelve falso para una cancelada o rechazada, así que si te apoyas solo en
  ella saldrá LI003 donde la spec pide LI004 y el caso de contrato te lo
  tumbará. Una sesión que no llegó a celebrarse no es "fuera de plazo".
- `order by starts_at desc limit 1` en `ratable_session` no es cosmético: lo fija
  el caso "con dos sin valorar se ofrece la más reciente".
- Idempotencia: `insert … on conflict (session_id, profile_id) do nothing
  returning *`; si `not found`, lee la fila existente y compara — igual →
  devuélvela; distinta → `raise … errcode = 'LI001'`.
- `ratable_session(p_match_id uuid) returns setof public.lockin_sessions`,
  `stable`, `security definer`. Filtra por match del actor, `status =
  'aceptada'`, `session_rating_window_is_open(...)`, `session_both_attended(id)`
  y `not exists` de fila propia en `session_ratings`. `order by starts_at desc
  limit 1`.
- `session_both_attended` es `stable security definer`: comprueba que los dos
  perfiles de `matches` (`profile_a`, `profile_b`) tienen fila en
  `session_attendance` con `joined_at < session_ends_at(starts_at, blocks)`.
- **Nada de `alter publication supabase_realtime add table`** para esta tabla.
- `revoke execute … from public, anon` y `grant execute … to authenticated` para
  las cuatro funciones nuevas. `session_rating_window_is_open` y
  `session_both_attended` son internas, pero se conceden igual que sus
  equivalentes de la migración anterior (`session_is_live`, `is_session_member`)
  para no romper el patrón; `lock_member_session` es la excepción que también
  revoca a `authenticated`, no la copies aquí.

- [ ] **Step 2: Reglas del SQL en PGlite**

En `supabase/schema-embedded.test.mjs`, junto al bloque que hoy interroga
`session_is_live`. Aquí sí se pueden insertar filas con `starts_at` en el
pasado, que es lo único que permite probar una sesión terminada; sigue el estilo
del test que ya está (un `select` con varias columnas nombradas y
`assert.match`/`assert.deepEqual` sobre el resultado).

Cubre:
- `session_rating_window_is_open` en las cuatro fronteras: un segundo antes de
  `endsAt`, en `endsAt`, dentro, y en `endsAt + 24 h`.
- `session_both_attended` con: las dos filas, solo una, ninguna, y una con
  `joined_at` posterior a `endsAt` (que no cuenta).
- Que `rls=t` aparece para `session_ratings` en la huella, igual que se
  comprueba para las dos tablas de sesiones.

**Verify:** `node --test supabase/schema-embedded.test.mjs` (o el comando que
use `package.json` para esos tests: míralo antes). Luego
`node supabase/schema-compare.mjs` si el repo lo usa en local sin credenciales;
si pide red, sáltalo y déjalo para CI.

---

### Task 4: Repositorio de Supabase

**Files:**
- Modify: `src/data/supabase/database.types.ts`
- Modify: `src/data/supabase/sessions.ts`
- Modify: `src/data/supabase/sessions.test.ts`

**Interfaces:**
- Consumes: los RPCs de la Tarea 3 y el contrato de la Tarea 1.
- Produces: `SessionRatingRow`, `toSessionRatingEntry`, y los tres métodos.

> **Andamio que tienes que retirar.** Igual que en la Tarea 2: la Tarea 1 dejó
> los tres métodos de `src/data/supabase/sessions.ts` lanzando "todavía no está
> implementado", con un caso en `src/data/supabase/sessions.test.ts` que lo fija
> solo para sostener el suelo de cobertura. **Bórralo con los stubs.**

- [ ] **Step 1: Tipos de la base**

En `src/data/supabase/database.types.ts`, añade `SessionRatingRow` y las dos
funciones nuevas a lo que ya declara para `lockin_sessions` y los RPCs de
sesiones, con la misma forma. `ratable_session` devuelve filas de
`lockin_sessions`, así que reutiliza `SessionRow`.

- [ ] **Step 2: Los tres métodos**

En `src/data/supabase/sessions.ts`, siguiendo el patrón del archivo (RPC →
`if (error) throw toSessionError(error)` → mapeo):

- `getRatable(matchId)`: `rpc('ratable_session', { p_match_id: matchId })`.
  Devuelve un array; `data[0]` a `toLockInSession`, o `null`. Pasa el resultado
  por `remember()` como hacen `getActive`/`getById`, para que `matchOfSession`
  quede al día.
- `getMyRating(sessionId)`: **select directo**, no RPC —
  `from('session_ratings').select('rating').eq('session_id', sessionId)
  .maybeSingle()`. La RLS ya lo limita a lo tuyo, y ese es justo el punto: si
  algún día la política se relajara, este select lo delataría en el contrato.
- `rate(sessionId, rating)`: `rpc('rate_session', { p_session_id: sessionId,
  p_rating: rating })` → `toSessionRatingEntry`. **Sin `notifyForSession`**: la
  valoración es privada y no hay a quién avisar.

`toSessionRatingEntry(row)` va junto a `toSessionAttendance`, con `toIso` para
`rated_at`.

- [ ] **Step 3: Tests sin red**

En `src/data/supabase/sessions.test.ts`, con el cliente falso que ya usa el
archivo: mapeo de `SessionRatingRow`, que `rate` traduce LI001/LI003/LI004 a las
clases de dominio, que `getRatable` con cero filas da `null`, y que `rate` **no**
dispara el aviso a los suscriptores del match (el contraste con `join`, que sí
lo hace, es lo que prueba que la privacidad no se filtra por el canal).

**Verify:** `npx jest src/data/supabase`, `npx tsc --noEmit`, `npm run lint`.

---

### Task 5: La pantalla de sesión

**Files:**
- Create: `src/features/session/rating.ts`, `src/features/session/rating.test.ts`
- Create: `src/features/session/rating-chips.tsx`, `src/features/session/rating-chips.test.tsx`
- Create: `src/features/session/use-rating.ts`
- Modify: `src/features/session/index.ts`
- Modify: `src/app/session/[sessionId].tsx`
- Modify: el test de la pantalla de sesión que ya exista (búscalo antes de crear uno)

**Interfaces:**
- Produces: `RATING_OPTIONS`, `ratingLabel`, `RatingChips`, `useRating`.
- Consumes: `SessionRating`, `attendedSession`, `useAttendance`,
  `useSessionRoom`.

- [ ] **Step 1: Reglas y textos**

`rating.ts`, puro y sin React:

```ts
export const RATING_OPTIONS: readonly SessionRating[] = ['floja', 'bien', 'genial'];

const LABELS: Record<SessionRating, string> = {
  floja: 'Floja',
  bien: 'Bien',
  genial: 'Genial',
};

export const ratingLabel = (rating: SessionRating) => LABELS[rating];
```

Más `endingView(...)`, que decide cuál de los tres finales de la spec (§ 2,
"Pantalla de sesión — el final") toca, a partir de las filas de asistencia, mi
id, el de la otra persona, la sesión y mi valoración actual. Devuelve
`{ kind: 'preguntar' } | { kind: 'gracias' } | { kind: 'no-vino' }`. Puro: la
hora entra como parámetro, igual que en `card-state.ts`.

- [ ] **Step 2: Los chips**

`rating-chips.tsx`: fila de tres `Pressable` con `accessibilityRole="radio"`,
`accessibilityState={{ checked }}`, `accessibilityLabel` con la etiqueta,
`minHeight: 44` y `gap: Spacing.two`. Colores del tema por `useTheme()`, como
`ActionButton` en `[sessionId].tsx`. Props: `onSelect(rating)`, `selected` y
`disabled`. No sabe nada de repositorios.

- [ ] **Step 3: El hook**

`use-rating.ts`: `useRating(sessionId)` devuelve
`{ rating, attendance, submit, error, pending }`. Lee con `useQuery` igual que
`use-active-session.ts` — dos consultas, `getMyRating(sessionId)` y
`listAttendance(sessionId)` —, escribe con `repositories.sessions.rate`, y
traduce el error a uno de dos mensajes:
`SessionWindowError`/`SessionForbiddenError` → `'Ya no se puede valorar'`
(definitivo, deshabilita los chips); cualquier otro → `'No se ha podido
guardar'` (reintentar con otro toque). `SessionConflictError` se traga en
silencio y se recarga, porque significa que ya hay una valoración escrita.

**No toques `useAttendance`.** Ese hook existe para el efecto de entrar y salir
(`{ joined, leave }`), y las filas de asistencia que necesita `endingView` son
otra cosa: un dato que se lee. Colgarlas de ahí mezclaría las dos
responsabilidades y le metería una consulta a una pantalla que hoy no la hace.

- [ ] **Step 4: La pantalla**

En `src/app/session/[sessionId].tsx`, la rama `ended` deja de ser un `ThemedText`
+ botón y pasa a los tres casos. Lo demás de la pantalla no se toca. Tocar un
chip **no navega**: se queda en "Gracias — solo lo ves tú" con el botón de
volver.

La pantalla ya tiene de `useSessionRoom` la sesión, `me` y `match.counterpart`;
de `useRating` saca `rating` y `attendance`, y con eso llama a `endingView` para
saber cuál de los tres finales pintar. `useAttendance` se queda como está.

- [ ] **Step 5: Superficie pública**

Exporta `RatingChips`, `useRating`, `RATING_OPTIONS`, `ratingLabel` y
`endingView` desde `src/features/session/index.ts`, en el orden alfabético que
ya sigue el archivo.

- [ ] **Step 6: Tests**

`rating.test.ts` para `endingView` (las cuatro combinaciones de asistencia × con
y sin valoración previa). `rating-chips.test.tsx` para el marcado accesible y
que `onSelect` llega con el valor correcto. Y en el test de la pantalla: los
tres finales, que tocar un chip no navega, y los dos mensajes de error.

**Verify:** `npx jest src/features/session src/app`, `npx tsc --noEmit`,
`npm run lint`, `npm run format:check`.

---

### Task 6: La tarjeta del chat

**Files:**
- Modify: `src/features/session/card-state.ts` y su test
- Modify: `src/features/session/use-active-session.ts`
- Modify: `src/features/session/session-card.tsx` y su test

**Interfaces:**
- Produces: `CardView` con `{ kind: 'valorar'; session }`; `cardView` con el
  argumento nuevo; `useActiveSession` devolviendo también `ratable`.
- Consumes: `getRatable`, `RatingChips`, `useRating`.

- [ ] **Step 1: `cardView`**

Firma nueva: `cardView(live, ratable, myProfileId, nowMs)`. **La viva gana
siempre**: si `live` da cualquier estado distinto de `agendar`, se devuelve ese;
solo si no hay viva se mira `ratable`. Actualiza el test con el caso nuevo y con
uno que fije la precedencia.

- [ ] **Step 2: `useActiveSession`**

Pide también `getRatable(matchId)` en la misma carga, con su propio `useQuery` y
clave `session:ratable:${matchId}`. Devuelve `ratable` junto a `session`.

`useQuery` da un `refresh` **por consulta** (`src/data/provider.tsx:65`), así que
el `subscribe` y el tic de 30 s tienen que llamar a los dos. Olvidar el segundo
es el fallo silencioso de esta tarea: la tarjeta se quedaría en `valorar` para
siempre después de valorar, porque nadie volvería a preguntar por `getRatable`.
Que el test del tic compruebe las dos.

- [ ] **Step 3: `SessionCard`**

Caso `valorar`: "¿Qué tal fue la sesión con {nombre}?" y los mismos
`RatingChips`. Al tocar, pasa a "Gracias — solo lo ves tú"; en el refresco
siguiente `getRatable` ya da `null` y la tarjeta vuelve a `agendar` sola. Reusa
`useRating`, no escribas otra llamada a `rate`.

**Verify:** `npx jest src/features/session`, `npx tsc --noEmit`, `npm run lint`,
y `npm test -- --coverage` para confirmar que el suelo no baja.

---

### Task 7: E2E Android y cierre

**Files:**
- Create: `e2e/session-rate.yaml`
- Modify: `e2e/verify.mjs`, `e2e/run.mjs`, `e2e/session.test.mjs`
- Modify: `docs/plan/todo/valoracion.md`, `docs/plan/TODO.md`

**Interfaces:**
- Consumes: todo lo anterior.

> **Por qué no hay fixture nuevo de seed, aunque lo pida el instinto.** El
> patrón de `e2e/session-now.sql` es un trigger que se instala con el seed y
> dispara al insertarse el mensaje del recorrido. Si se añadiera otro que
> crease una sesión ya terminada, quedarían **dos sesiones en el mismo match**:
> la de `session-now.sql` sigue viva 30 minutos —el recorrido entra y sale de
> ella, pero salir no la termina— y, por la precedencia de la Tarea 6, la viva
> gana. La tarjeta nunca llegaría a `valorar` y el caso fallaría sin que nada
> estuviera roto. Se reaprovecha la sesión que el recorrido acaba de vivir.

- [ ] **Step 1: Envejecer la sesión entre flujos**

En `e2e/run.mjs`, entre el flujo `session.yaml` y el nuevo, un paso que con el
cliente de `service_role` (el mismo patrón de `e2e/verify.mjs`, que ya lo crea
con `status.SERVICE_ROLE_KEY` y por tanto se salta RLS):

1. Mueve `starts_at` de esa sesión al pasado, lo bastante para que haya
   terminado con sus `blocks` (con 1 bloque, `now() - 40 min` deja `endsAt` diez
   minutos atrás y la ventana de 24 h abierta de sobra).
2. Inserta la fila de `session_attendance` de **la otra persona**, con
   `joined_at` anterior a ese final. La del usuario del recorrido ya existe: la
   escribió la app al entrar, y es justo lo que verificó `verifySessionAttendance`.

Sin el punto 2 la sesión no es valorable —regla 4— y el flujo fallaría por
diseño, así que si el caso sale en rojo, mira esa fila antes que nada.

- [ ] **Step 2: El flujo**

`e2e/session-rate.yaml`, con el estilo de `e2e/session.yaml`: abre el chat del
match, comprueba que la tarjeta pregunta por la valoración, toca `Genial` y
espera a "Gracias". Engánchalo en `e2e/run.mjs` donde ya se engancha
`session.yaml`, después del paso del Step 1.

- [ ] **Step 3: El oráculo**

`verifySessionRating` en `e2e/verify.mjs`, con el estilo de
`verifySessionAttendance`: lee `session_ratings` en Postgres y comprueba la fila
con `rating = 'genial'` de la cuenta del recorrido. Imprime una línea de oráculo
reconocible, como las que ya hay ("Postgres: valoración de la sesión
verificada."), porque es lo que se busca en el log del job. Añade su caso a
`e2e/session.test.mjs`, que es la guardia del runner.

- [ ] **Step 4: Cierre**

Marca las casillas de `docs/plan/todo/valoracion.md` con la evidencia real (runs
de Actions con su URL, como hace `todo/sesiones.md`), y actualiza la línea de la
pieza en `docs/plan/TODO.md`. Deja escrito que **aplicar la migración en
`grrzmzktrhksbttpbblg` es del usuario** y que hasta que lo haga el job remoto de
`schema-drift.yml` saldrá en rojo — y que ese rojo, en esta ventana, es esperado
y no deriva.

**Verify:** `npm run lint`, `npx tsc --noEmit`, `npm test -- --coverage`, y los
tres workflows en verde sobre el commit final (`CI`, `E2E Android`; `Schema
drift` con la salvedad de arriba).
