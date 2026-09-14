# Valoración de 1 toque post-sesión — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que, tras una sesión Lock-In a la que asistieron las dos personas, cada una pueda responder en privado «¿Repetirías con {nombre}?» (Sí/No), desde la pantalla de sesión completada o, si no lo hizo allí, desde la tarjeta del chat.

**Architecture:** Tabla `session_ratings` con RLS de lectura propia y dos RPCs (`rate_session`, `pending_session_rating`), detrás de dos métodos nuevos de `LockInSessionRepository` que cumplen mock y Supabase bajo la suite de contrato. Reglas de tiempo puras en `src/data/sessions.ts` con espejo SQL. En la UI, un hook `usePendingRating` y un componente `RatingPrompt` compartidos por la pantalla de sesión y `SessionCard`.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, TypeScript estricto, Jest (`jest-expo`) + React Native Testing Library 14 (render, fireEvent y renderHook asíncronos), Supabase (Postgres 17, PostgREST), AsyncStorage, PGlite fuera del repo para el esquema.

**Spec:** `docs/superpowers/specs/2026-09-14-valoracion-post-sesion-design.md`

## Global Constraints

- Pregunta: «¿Repetirías con {nombre}?» Sí/No, con `{nombre}` = primer nombre de la otra persona. Subtexto: «Solo lo verás tú.».
- Botones `accessibilityLabel`: «Sí, repetiría», «No repetiría», «Ahora no». Tras responder: «Gracias.». Error de red: «No se ha podido guardar. Inténtalo otra vez.».
- Privado: solo quien responde lee su respuesta. Ningún método del contrato lee respuestas ajenas; `session_ratings` no entra en `supabase_realtime`.
- Solo se guarda: la respuesta no cambia nada que vea nadie.
- Elegible: sesión `aceptada`, `endsAt ≤ now < endsAt + 7 días` (`RATING_WINDOW_DAYS = 7`), y **las dos personas** del match con `joinedAt < endsAt`.
- Una respuesta por persona y sesión; inmutable.
- Pendiente = la sesión `aceptada` terminada con `startsAt` más reciente del match, si es elegible y no la he valorado; si no, `null` (nunca retrocede).
- Orden de errores de `rate`: `SessionForbiddenError` (no existe / match ajeno, LI004) → `SessionWindowError` (no abierta, LI003) → `SessionForbiddenError` (no asistieron las dos, LI004) → `SessionConflictError` (ya respondida, LI001).
- «Ahora no» solo en la tarjeta del chat; guarda `lockin:rating-dismissed:{sessionId}` = `'1'` en AsyncStorage, nada en la base.
- En la tarjeta manda la sesión viva: la pregunta solo aparece con `cardView(...).kind === 'agendar'`. `cardView` no cambia.
- La pantalla de sesión completada reintenta `getPendingRating` una vez a los 5 s (`RATING_RETRY_MS = 5_000`) si la primera consulta dio `null`.
- Las pantallas importan datos solo desde `@/data`; las rutas importan del bloque solo desde `@/features/session`.
- Worktree compartido con otras sesiones: **nunca `git add .`**; cada commit añade rutas explícitas.
- En RNTL 14 `render`, `fireEvent` y `renderHook` devuelven promesas: siempre `await`.
- Textos de UI y comentarios en español. `.sql` en LF.
- Suelo de cobertura de `jest.config.js` (89.82/82.56/91.49/91.38) no baja.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/data/types.ts` (mod) | Tipo `SessionRating` |
| `src/data/sessions.ts` (mod) | `RATING_WINDOW_DAYS`, `isRatingOpen`, `bothAttended` |
| `src/data/repositories.ts` (mod) | `getPendingRating`, `rate` en `LockInSessionRepository` |
| `src/data/mock/store.ts` (mod) | `sessionRatings` en el estado |
| `src/data/mock/sessions.ts` (mod) | Implementación mock |
| `src/data/repositories.contract.ts` (mod) | Casos de contrato de valoración |
| `supabase/migrations/20260914000100_session_ratings.sql` (nuevo) | Tabla, RLS, funciones y RPCs |
| `supabase/schema-embedded.test.mjs` (mod) | Tabla de verdad de `session_rating_open` y política en la huella |
| `supabase/README.md` (mod) | Fila de la migración nueva |
| `src/data/supabase/database.types.ts` (mod) | `SessionRatingRow`, tabla y funciones |
| `src/data/supabase/sessions.ts` (mod) | `toSessionRating`, `getPendingRating`, `rate` |
| `.github/workflows/contract.yml` (mod) | Saltos admitidos nuevos |
| `src/features/session/rating-prompt.tsx` (nuevo) | Pregunta presentacional |
| `src/features/session/use-pending-rating.ts` (nuevo) | Pendiente, respuesta, descarte local |
| `src/features/session/session-card.tsx` (mod) | Pregunta en el estado «Agendar» |
| `src/features/session/index.ts` (mod) | Exports |
| `src/app/session/[sessionId].tsx` (mod) | Pregunta en «Sesión completada» |
| `test/app/sessionId.test.tsx` (mod) | Tests de pantalla |
| `docs/plan/todo/sesiones.md`, `docs/plan/TODO.md` (mod) | Tablero |

---

### Task 1: Dominio de la valoración y tablero

**Files:**
- Modify: `src/data/types.ts` (añadir tras `SessionProposalInput`)
- Modify: `src/data/sessions.ts`
- Test: `src/data/sessions.test.ts`
- Modify: `docs/plan/todo/sesiones.md` (añadir sección al final)

**Interfaces:**
- Produces: `interface SessionRating { sessionId: string; raterId: string; wouldRepeat: boolean; createdAt: string }`; `RATING_WINDOW_DAYS = 7`; `isRatingOpen(session: SessionTiming, nowMs: number): boolean`; `bothAttended(session: Pick<LockInSession, 'id' | 'startsAt' | 'blocks'>, attendance: readonly SessionAttendance[], memberIds: readonly string[]): boolean`. Todo exportado desde `@/data` (ya hace `export * from './types'` y `'./sessions'`).

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al import de `./sessions` en `src/data/sessions.test.ts`: `bothAttended`, `isRatingOpen`, `RATING_WINDOW_DAYS`. Añadir al final del archivo:

```ts
describe('isRatingOpen', () => {
  const ended = START + 30 * MINUTE;
  const DAY = 24 * 60 * MINUTE;
  const accepted = { status: 'aceptada' as const, startsAt, blocks: 1 as const };

  it('abre en el milisegundo exacto del final y cierra a los 7 días', () => {
    expect(RATING_WINDOW_DAYS).toBe(7);
    expect(isRatingOpen(accepted, ended - 1)).toBe(false);
    expect(isRatingOpen(accepted, ended)).toBe(true);
    expect(isRatingOpen(accepted, ended + 7 * DAY - 1)).toBe(true);
    expect(isRatingOpen(accepted, ended + 7 * DAY)).toBe(false);
  });

  it('solo una sesión aceptada se valora', () => {
    for (const status of ['propuesta', 'rechazada', 'cancelada'] as const) {
      expect(isRatingOpen({ ...accepted, status }, ended)).toBe(false);
    }
  });
});

describe('bothAttended', () => {
  const session = { id: 'session-1', startsAt, blocks: 1 as const };
  const ended = START + 30 * MINUTE;
  const row = (profileId: string, joinedAtMs: number, sessionId = 'session-1') => ({
    sessionId,
    profileId,
    joinedAt: new Date(joinedAtMs).toISOString(),
    leftAt: null,
  });

  it('exige que las dos personas entraran antes del final', () => {
    expect(bothAttended(session, [row('a', START), row('b', START + MINUTE)], ['a', 'b'])).toBe(
      true
    );
    expect(bothAttended(session, [row('a', START)], ['a', 'b'])).toBe(false);
  });

  it('entrar justo en el final no cuenta', () => {
    expect(bothAttended(session, [row('a', START), row('b', ended)], ['a', 'b'])).toBe(false);
  });

  it('ignora filas de otra sesión y sin miembros es falso', () => {
    expect(
      bothAttended(session, [row('a', START), row('b', START, 'session-2')], ['a', 'b'])
    ).toBe(false);
    expect(bothAttended(session, [], [])).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx jest src/data/sessions.test.ts`
Expected: FAIL — `isRatingOpen is not a function` (o error de TypeScript en el import).

- [ ] **Step 3: Añadir el tipo y las reglas**

En `src/data/types.ts`, justo después de `SessionProposalInput`:

```ts
/** «¿Repetirías con {nombre}?» tras una sesión. Solo lo lee quien responde. */
export interface SessionRating {
  sessionId: string;
  /** Id del perfil que responde. */
  raterId: string;
  wouldRepeat: boolean;
  createdAt: string;
}
```

En `src/data/sessions.ts`: cambiar el import a `import type { LockInSession, SessionAttendance, SessionBlocks } from './types';`, añadir `export const RATING_WINDOW_DAYS = 7;` tras `SESSION_BLOCK_OPTIONS`, cambiar el comentario de cabecera para citar también `supabase/migrations/20260914000100_session_ratings.sql` (`session_rating_open()`), y añadir al final:

```ts
/** Se valora una sesión aceptada desde que termina hasta 7 días después. */
export function isRatingOpen(session: SessionTiming, nowMs: number): boolean {
  if (session.status !== 'aceptada') return false;
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return nowMs >= endsAt && nowMs < endsAt + RATING_WINDOW_DAYS * 24 * 60 * MINUTE;
}

/** Las dos personas del match entraron antes del final. `memberIds` son los dos ids del match. */
export function bothAttended(
  session: Pick<LockInSession, 'id' | 'startsAt' | 'blocks'>,
  attendance: readonly SessionAttendance[],
  memberIds: readonly string[]
): boolean {
  if (memberIds.length === 0) return false;
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return memberIds.every((profileId) =>
    attendance.some(
      (row) =>
        row.sessionId === session.id &&
        row.profileId === profileId &&
        Date.parse(row.joinedAt) < endsAt
    )
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `npx jest src/data/sessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Abrir la sección en el tablero**

Añadir al final de `docs/plan/todo/sesiones.md`:

```markdown

## Valoración de 1 toque post-sesión

Spec: `docs/superpowers/specs/2026-09-14-valoracion-post-sesion-design.md`.
Plan: `docs/superpowers/plans/2026-09-14-valoracion-post-sesion.md`. Una casilla
por tarea; se marca al hacer su commit.

- [ ] Tarea 1 — Dominio: `SessionRating`, `isRatingOpen`, `bothAttended`
- [ ] Tarea 2 — Contrato (`getPendingRating`, `rate`) y mock
- [ ] Tarea 3 — Migración `session_ratings` y comprobación en PGlite
- [ ] Tarea 3b — Migración aplicada en `grrzmzktrhksbttpbblg` por el usuario; `schema-drift.yml` en verde
- [ ] Tarea 4 — Repositorio de Supabase y saltos de `contract.yml`
- [ ] Tarea 5 — `RatingPrompt`, `usePendingRating` y tarjeta del chat
- [ ] Tarea 6 — Pregunta en «Sesión completada»
- [ ] Tarea 7 — Verificación final (lint, tipos, tests con cobertura, CI y contrato en Actions)
```

Marcar ya `Tarea 1` como `[x]`.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/sessions.ts src/data/sessions.test.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): reglas de la valoración post-sesión"
```

---

### Task 2: Contrato y mock

**Files:**
- Modify: `src/data/repositories.ts:115-131`
- Modify: `src/data/mock/store.ts`
- Modify: `src/data/mock/sessions.ts`
- Modify: `src/data/repositories.contract.ts` (dentro de `describe('sessions')`, antes de su cierre en la línea 764)
- Modify: `src/data/supabase/sessions.ts` (stubs temporales, ver Step 4)
- Test: `src/data/mock/index.test.ts` (ya ejecuta `describeRepositoryContract` contra el mock)

**Interfaces:**
- Consumes: `SessionRating`, `isRatingOpen`, `bothAttended`, `sessionEndsAtMs` (Task 1).
- Produces: en `LockInSessionRepository`: `getPendingRating(matchId: string): Promise<LockInSession | null>` y `rate(sessionId: string, wouldRepeat: boolean): Promise<SessionRating>`. `MockState.sessionRatings: SessionRating[]`.

- [ ] **Step 1: Escribir los casos de contrato**

En `src/data/repositories.contract.ts`, dentro de `describe('sessions', …)`, tras el último `itWithTimeTravel` (`'una sesión empezada no se cancela: se sale'`) y antes del `});` que cierra `describe('sessions')`:

```ts
      describe('valoración', () => {
        /**
         * Sesión de 1 bloque aceptada en la que entran `attendees`, ya terminada.
         * Salta 36 minutos: solo con reloj simulado.
         */
        async function endedSession(attendees: ('mine' | 'theirs')[]) {
          const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
          await theirs.respond(session.id, 'aceptada');
          await fixture.elapse(3_000);
          if (attendees.includes('mine')) await mine.join(session.id);
          if (attendees.includes('theirs')) await theirs.join(session.id);
          await fixture.elapse(36 * MINUTE);
          return session;
        }

        it('sin sesiones terminadas no hay valoración pendiente', async () => {
          expect(await mine.getPendingRating(matchId)).toBeNull();
          await mine.propose({ matchId, startsAt: await later(), blocks: 1 });
          expect(await mine.getPendingRating(matchId)).toBeNull();
        });

        it('no se valora una sesión que no ha terminado', async () => {
          const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
          await theirs.respond(session.id, 'aceptada');
          await fixture.elapse(3_000);
          await mine.join(session.id);
          await theirs.join(session.id);

          await expect(mine.rate(session.id, true)).rejects.toBeInstanceOf(SessionWindowError);
        });

        it('alguien de fuera del match no valora ni ve la pendiente', async () => {
          const outsider = fixture.outsiderSessions();
          const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

          expect(await outsider.getPendingRating(matchId)).toBeNull();
          await expect(outsider.rate(session.id, true)).rejects.toBeInstanceOf(
            SessionForbiddenError
          );
        });

        itWithTimeTravel(
          'tras una sesión con las dos personas queda pendiente para las dos y responder la cierra solo para quien responde',
          async () => {
            const session = await endedSession(['mine', 'theirs']);

            expect((await mine.getPendingRating(matchId))?.id).toBe(session.id);
            expect((await theirs.getPendingRating(matchId))?.id).toBe(session.id);

            const rating = await mine.rate(session.id, false);

            expect(rating).toMatchObject({
              sessionId: session.id,
              raterId: fixture.currentUserId,
              wouldRepeat: false,
            });
            expect(await mine.getPendingRating(matchId)).toBeNull();
            expect((await theirs.getPendingRating(matchId))?.id).toBe(session.id);
          }
        );

        itWithTimeTravel(
          'si una de las dos personas no entró no hay valoración para nadie',
          async () => {
            const session = await endedSession(['mine']);

            expect(await mine.getPendingRating(matchId)).toBeNull();
            expect(await theirs.getPendingRating(matchId)).toBeNull();
            await expect(mine.rate(session.id, true)).rejects.toBeInstanceOf(
              SessionForbiddenError
            );
          }
        );

        itWithTimeTravel('responder dos veces a la misma sesión choca', async () => {
          const session = await endedSession(['mine', 'theirs']);
          await mine.rate(session.id, true);

          await expect(mine.rate(session.id, false)).rejects.toBeInstanceOf(SessionConflictError);
        });

        itWithTimeTravel('la valoración caduca a los 7 días del final', async () => {
          const session = await endedSession(['mine', 'theirs']);
          await fixture.elapse(7 * 24 * 60 * MINUTE);

          expect(await mine.getPendingRating(matchId)).toBeNull();
          await expect(mine.rate(session.id, true)).rejects.toBeInstanceOf(SessionWindowError);
        });

        itWithTimeTravel(
          'la pendiente es la última sesión terminada y no retrocede a una anterior',
          async () => {
            const first = await endedSession(['mine', 'theirs']);
            await endedSession(['mine']);

            expect(await mine.getPendingRating(matchId)).toBeNull();
            await expect(mine.rate(first.id, true)).resolves.toMatchObject({
              sessionId: first.id,
            });
          }
        );
      });
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npx jest src/data/mock/index.test.ts -t valoración`
Expected: FAIL — `mine.getPendingRating is not a function` (y errores de tipos en `tsc`).

- [ ] **Step 3: Ampliar el contrato**

En `src/data/repositories.ts`, dentro de `LockInSessionRepository`, tras `listAttendance` y antes de `serverNow`:

```ts
  /**
   * Última sesión terminada del match pendiente de valorar por mí, o `null`.
   * Solo si asistieron las dos personas y no han pasado 7 días; nunca retrocede
   * a una sesión anterior.
   */
  getPendingRating(matchId: string): Promise<LockInSession | null>;
  /** Guarda «¿Repetirías?». Inmutable, y solo lo podrá leer quien responde. */
  rate(sessionId: string, wouldRepeat: boolean): Promise<SessionRating>;
```

Añadir `SessionRating` al `import type` de `./types` en ese archivo.

- [ ] **Step 4: Stubs temporales en Supabase para que compile**

En `src/data/supabase/sessions.ts`, dentro del objeto `repository`, tras `listAttendance`:

```ts
    // Implementación real en la Tarea 4 del plan de valoración.
    async getPendingRating() {
      throw new Error('getPendingRating: pendiente de la Tarea 4');
    },
    async rate() {
      throw new Error('rate: pendiente de la Tarea 4');
    },
```

- [ ] **Step 5: Estado del mock**

En `src/data/mock/store.ts`: añadir `SessionRating` al `import type` de `../types`; en `MockState`, tras `attendance`, `sessionRatings: SessionRating[];`; en `initialState()`, tras `attendance: []`, `sessionRatings: [],`.

- [ ] **Step 6: Implementación mock**

En `src/data/mock/sessions.ts`:

Cambiar el import de reglas a:

```ts
import {
  bothAttended,
  isInJoinWindow,
  isRatingOpen,
  isSessionBlocks,
  isSessionLive,
  isValidStartsAt,
  sessionEndsAtMs,
} from '../sessions';
```

y el de tipos a `import type { LockInSession, SessionAttendance, SessionRating } from '../types';`.

Dentro de `createMockSessionRepository`, tras `changed`:

```ts
  /** Aceptada, terminada hace menos de 7 días y con las dos personas dentro. */
  const canBeRated = (session: LockInSession, now: number) =>
    isRatingOpen(session, now) &&
    bothAttended(session, getState().attendance, membersOf(session.matchId));

  const ratedByActor = (sessionId: string) =>
    getState().sessionRatings.some(
      (rating) => rating.sessionId === sessionId && rating.raterId === actorId
    );
```

En el objeto devuelto, tras `listAttendance`:

```ts
    async getPendingRating(matchId) {
      if (!isMember(matchId)) return null;
      const now = mockNowMs();
      const latest = getState()
        .lockInSessions.filter(
          (session) =>
            session.matchId === matchId &&
            session.status === 'aceptada' &&
            sessionEndsAtMs(session.startsAt, session.blocks) <= now
        )
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0];
      if (!latest || !canBeRated(latest, now) || ratedByActor(latest.id)) return null;
      return { ...latest };
    },

    async rate(sessionId, wouldRepeat) {
      const session = mustSee(sessionId);
      const now = mockNowMs();
      if (!isRatingOpen(session, now)) {
        throw new SessionWindowError('La sesión no está abierta a valoración');
      }
      if (!bothAttended(session, getState().attendance, membersOf(session.matchId))) {
        throw new SessionForbiddenError('Solo se valora si asistieron las dos personas');
      }
      if (ratedByActor(sessionId)) throw new SessionConflictError('Ya respondiste');
      const rating: SessionRating = {
        sessionId,
        raterId: actorId,
        wouldRepeat,
        createdAt: iso(now),
      };
      getState().sessionRatings.push(rating);
      return changed(session.matchId, rating);
    },
```

(`canBeRated` usa `isRatingOpen` y `bothAttended` juntos; en `rate` se separan para lanzar el error correcto en su orden.)

- [ ] **Step 7: Ejecutar y ver que pasan**

Run: `npx jest src/data/mock/index.test.ts src/data/sessions.test.ts`
Expected: PASS, incluidos los 8 casos de `valoración`.

Run: `npx tsc --noEmit`
Expected: sin errores. Si algún doble de `LockInSessionRepository` en tests (buscar con `Grep` `LockInSessionRepository` en `**/*.test.ts*`) no compila por los métodos nuevos, añadirle `getPendingRating: jest.fn(async () => null)` y `rate: jest.fn()`.

- [ ] **Step 8: Commit**

```bash
git add src/data/repositories.ts src/data/mock/store.ts src/data/mock/sessions.ts src/data/repositories.contract.ts src/data/supabase/sessions.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): contrato y mock de la valoración post-sesión"
```

(Marcar `Tarea 2` en `docs/plan/todo/sesiones.md` antes del commit. Añadir también cualquier test doble tocado en el Step 7.)

---

### Task 3: Migración `session_ratings`

**Files:**
- Create: `supabase/migrations/20260914000100_session_ratings.sql`
- Modify: `supabase/schema-embedded.test.mjs`
- Modify: `supabase/README.md` (tabla de migraciones, fila tras `20260913000100_lockin_sessions.sql`)

**Interfaces:**
- Consumes: `public.lockin_sessions`, `public.session_attendance`, `public.matches`, `public.session_ends_at(timestamptz, smallint)`, `public.lock_member_session(uuid)` de `20260913000100_lockin_sessions.sql`.
- Produces: tabla `public.session_ratings(session_id, rater_id, would_repeat, created_at)`; funciones `session_rating_open(session_status, timestamptz, smallint, timestamptz) → boolean`, `session_both_attended(uuid) → boolean`, `rate_session(p_session_id uuid, p_would_repeat boolean) → session_ratings`, `pending_session_rating(p_match_id uuid) → setof lockin_sessions`.

- [ ] **Step 1: Escribir las aserciones que fallan**

En `supabase/schema-embedded.test.mjs`, tras el `assert.deepEqual(live.rows[0], { … });` de `session_is_live`:

```js
      assert.match(expected, /table\s+session_ratings rls=t/);
      // Solo quien responde lee su valoración (spec de valoración, regla 3).
      assert.match(
        expected,
        /policy\s+session_ratings\.[^\n]*cmd=SELECT[^\n]*roles=authenticated[^\n]*using=[^\n]*rater_id = [^\n]*auth\.uid\(\)/
      );
      // Espejo de `isRatingOpen` en `src/data/sessions.test.ts`, mismos bordes.
      const ratingOpen = await db.query(`select
        public.session_rating_open('aceptada', now() - interval '30 minutes' + interval '1 millisecond', 1::smallint, now()) as antes_del_final,
        public.session_rating_open('aceptada', now() - interval '30 minutes', 1::smallint, now()) as en_el_final,
        public.session_rating_open('aceptada', now() - interval '30 minutes' - interval '7 days' + interval '1 millisecond', 1::smallint, now()) as casi_caducada,
        public.session_rating_open('aceptada', now() - interval '30 minutes' - interval '7 days', 1::smallint, now()) as caducada,
        public.session_rating_open('cancelada', now() - interval '1 hour', 1::smallint, now()) as cancelada`);
      assert.deepEqual(ratingOpen.rows[0], {
        antes_del_final: false,
        en_el_final: true,
        casi_caducada: true,
        caducada: false,
        cancelada: false,
      });
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run (PowerShell): `$env:PGLITE_MODULE="$env:TEMP\lockin-schema-validation\node_modules\@electric-sql\pglite\dist\index.js"; node --test supabase/schema-embedded.test.mjs`
Expected: FAIL en `table\s+session_ratings rls=t`. Si el test sale `skipped` es que no existe esa instalación de PGlite: instalar `@electric-sql/pglite@0.3.14` en `$env:TEMP\lockin-schema-validation` con `npm install` dentro de ese directorio (fuera del repo, sin tocar `package.json`), como explica `supabase/README.md`.

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260914000100_session_ratings.sql` (LF):

```sql
-- LockIn — valoración de 1 toque post-sesión (Fase 2).
--
-- Diseño: docs/superpowers/specs/2026-09-14-valoracion-post-sesion-design.md.
-- Espejo de `isRatingOpen` y `bothAttended` en `src/data/sessions.ts`.
--
-- «¿Repetirías con {nombre}?» es privado: la única política deja leer a quien
-- respondió y a nadie más. No hay políticas de escritura (todo por
-- `rate_session`) y la tabla no entra en `supabase_realtime`, que es otro canal
-- por el que la respuesta podría llegar a la otra persona.

create table public.session_ratings (
  session_id uuid not null references public.lockin_sessions (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  would_repeat boolean not null,
  created_at timestamptz not null default now(),
  primary key (session_id, rater_id)
);

comment on table public.session_ratings is
  'Valoración privada tras una sesión Lock-In. Solo la lee quien responde; no se modifica.';


-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

-- Aceptada, terminada y hace menos de 7 días. `p_now` es parámetro para que la
-- función sea inmutable y comprobable, como `session_is_live`.
create or replace function public.session_rating_open(
  p_status public.session_status,
  p_starts_at timestamptz,
  p_blocks smallint,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select p_status = 'aceptada'
     and p_now >= public.session_ends_at(p_starts_at, p_blocks)
     and p_now < public.session_ends_at(p_starts_at, p_blocks) + interval '7 days';
$fn$;

-- Las dos personas del match entraron antes del final. Sin SECURITY DEFINER a
-- propósito: llamada por un usuario, la RLS de `session_attendance` ya la limita
-- a sesiones de sus matches; dentro de `rate_session` (definer) ve todo.
create or replace function public.session_both_attended(p_session_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select count(distinct a.profile_id) = 2
  from public.session_attendance a
  join public.lockin_sessions s on s.id = a.session_id
  join public.matches m on m.id = s.match_id
  where a.session_id = p_session_id
    and a.profile_id in (m.profile_a, m.profile_b)
    and a.joined_at < public.session_ends_at(s.starts_at, s.blocks);
$fn$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.session_ratings enable row level security;

revoke all on table public.session_ratings from anon;

create policy "session_ratings: lees solo las tuyas"
  on public.session_ratings for select
  to authenticated
  using (rater_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.rate_session(p_session_id uuid, p_would_repeat boolean)
returns public.session_ratings
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  -- LI004 si no existe o no es de tus matches.
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_row public.session_ratings;
begin
  if p_would_repeat is null then
    raise exception 'rate_session: la respuesta es sí o no' using errcode = '22023';
  end if;
  if not public.session_rating_open(v_session.status, v_session.starts_at, v_session.blocks, now()) then
    raise exception 'rate_session: la sesión no está abierta a valoración' using errcode = 'LI003';
  end if;
  if not public.session_both_attended(p_session_id) then
    raise exception 'rate_session: solo se valora si asistieron las dos personas' using errcode = 'LI004';
  end if;

  insert into public.session_ratings (session_id, rater_id, would_repeat)
  values (p_session_id, (select auth.uid()), p_would_repeat)
  on conflict (session_id, rater_id) do nothing
  returning * into v_row;

  if not found then
    raise exception 'rate_session: ya respondiste' using errcode = 'LI001';
  end if;

  return v_row;
end;
$fn$;

-- La sesión aceptada terminada más reciente del match, si es valorable y el
-- actor no la ha valorado. Nunca retrocede a una anterior. `setof` para que
-- "ninguna" llegue como array vacío y no como un objeto con todo a null. Sin
-- SECURITY DEFINER: la RLS de `lockin_sessions` deja fuera los matches ajenos.
create or replace function public.pending_session_rating(p_match_id uuid)
returns setof public.lockin_sessions
language sql
stable
set search_path = ''
as $fn$
  select s.*
  from public.lockin_sessions s
  where s.id = (
      select l.id
      from public.lockin_sessions l
      where l.match_id = p_match_id
        and l.status = 'aceptada'
        and public.session_ends_at(l.starts_at, l.blocks) <= now()
      order by l.starts_at desc
      limit 1
    )
    and public.session_rating_open(s.status, s.starts_at, s.blocks, now())
    and public.session_both_attended(s.id)
    and not exists (
      select 1 from public.session_ratings r
      where r.session_id = s.id and r.rater_id = (select auth.uid())
    );
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.session_rating_open(public.session_status, timestamptz, smallint, timestamptz) from public, anon;
revoke execute on function public.session_both_attended(uuid) from public, anon;
revoke execute on function public.rate_session(uuid, boolean) from public, anon;
revoke execute on function public.pending_session_rating(uuid) from public, anon;

grant execute on function public.session_rating_open(public.session_status, timestamptz, smallint, timestamptz) to authenticated;
grant execute on function public.session_both_attended(uuid) to authenticated;
grant execute on function public.rate_session(uuid, boolean) to authenticated;
grant execute on function public.pending_session_rating(uuid) to authenticated;
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run (PowerShell): `$env:PGLITE_MODULE="$env:TEMP\lockin-schema-validation\node_modules\@electric-sql\pglite\dist\index.js"; node --test supabase/schema-compare.test.mjs supabase/schema-embedded.test.mjs`
Expected: PASS, con la línea `SQL ejecutado: 9 migraciones; …`. Si la regex de la política no casa, imprimir la línea con `console.log(expected.split('\n').filter((l) => l.includes('session_ratings')).join('\n'))`, ajustar **solo** la regex a lo que deparsea Postgres (el `using` debe seguir mencionando `rater_id` y `auth.uid()`), y quitar el `console.log`.

- [ ] **Step 5: Documentar la migración**

En `supabase/README.md`, en la tabla de migraciones, tras la fila de `20260913000100_lockin_sessions.sql`:

```markdown
| `20260914000100_session_ratings.sql` | Valoración post-sesión: `session_ratings` con RLS de lectura propia, `session_rating_open`, `session_both_attended` y RPCs `rate_session`/`pending_session_rating`. Fuera de realtime a propósito |
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260914000100_session_ratings.sql supabase/schema-embedded.test.mjs supabase/README.md docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): migración de session_ratings con RLS de lectura propia"
```

(Marcar `Tarea 3` antes del commit.)

- [ ] **Step 7: Tarea 3b — aplicar en el proyecto real (lo hace el usuario)**

No la ejecuta el agente: no hay credencial con permisos de DDL a su alcance. Pedir al usuario que pegue **el archivo del repo** `supabase/migrations/20260914000100_session_ratings.sql` en el SQL Editor de `grrzmzktrhksbttpbblg`. Tras el siguiente push, comprobar con `gh run list --workflow schema-drift.yml --limit 1` y `gh run view <id>` que el job remoto `Comparar grrzmzktrhksbttpbblg (solo lectura)` se ejecutó (no `skipped`) y que `remote.diff` dice `Sin diferencias.`. Hasta entonces ese job sale rojo y es deriva real, no ruido. Marcar `Tarea 3b` con el enlace del run.

---

### Task 4: Repositorio de Supabase

**Files:**
- Modify: `src/data/supabase/database.types.ts`
- Modify: `src/data/supabase/sessions.ts` (sustituir los stubs de la Tarea 2)
- Test: `src/data/supabase/sessions.test.ts`
- Modify: `.github/workflows/contract.yml:86-90`

**Interfaces:**
- Consumes: RPCs de la Tarea 3; `LockInSessionRepository.getPendingRating`/`rate` (Tarea 2).
- Produces: `SessionRatingRow`; `toSessionRating(row: SessionRatingRow): SessionRating` exportado desde `src/data/supabase/sessions.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/data/supabase/sessions.test.ts`, añadir `toSessionRating` al import de `./sessions` y, al final del archivo:

```ts
describe('valoración', () => {
  it('toSessionRating traduce columnas y normaliza la fecha', () => {
    expect(
      toSessionRating({
        session_id: 'session-1',
        rater_id: 'user-a',
        would_repeat: true,
        created_at: '2026-09-14T11:00:00+00:00',
      })
    ).toEqual({
      sessionId: 'session-1',
      raterId: 'user-a',
      wouldRepeat: true,
      createdAt: '2026-09-14T11:00:00.000Z',
    });
  });

  it('getPendingRating devuelve la única fila del RPC o null si viene vacío', async () => {
    const empty = fakeClient({ rpc: { pending_session_rating: { data: [], error: null } } });
    await expect(empty.repository.getPendingRating('match-1')).resolves.toBeNull();
    expect(empty.client.rpc).toHaveBeenCalledWith('pending_session_rating', {
      p_match_id: 'match-1',
    });

    const one = fakeClient({
      rpc: { pending_session_rating: { data: [row({ status: 'aceptada' })], error: null } },
    });
    await expect(one.repository.getPendingRating('match-1')).resolves.toMatchObject({
      id: 'session-1',
      status: 'aceptada',
    });
  });

  it('rate llama a rate_session y devuelve la valoración', async () => {
    const { client, repository } = fakeClient({
      rpc: {
        rate_session: {
          data: {
            session_id: 'session-1',
            rater_id: 'user-a',
            would_repeat: false,
            created_at: '2026-09-14T11:00:00+00:00',
          },
          error: null,
        },
      },
      select: { data: row(), error: null },
    });

    await expect(repository.rate('session-1', false)).resolves.toMatchObject({
      sessionId: 'session-1',
      wouldRepeat: false,
    });
    expect(client.rpc).toHaveBeenCalledWith('rate_session', {
      p_session_id: 'session-1',
      p_would_repeat: false,
    });
  });

  it('rate traduce los códigos LI00x a errores de dominio', async () => {
    const cases = [
      ['LI001', SessionConflictError],
      ['LI003', SessionWindowError],
      ['LI004', SessionForbiddenError],
    ] as const;
    for (const [code, ErrorClass] of cases) {
      const { repository } = fakeClient({
        rpc: { rate_session: { data: null, error: { code, message: code } } },
      });
      await expect(repository.rate('session-1', true)).rejects.toBeInstanceOf(ErrorClass);
    }
  });
});
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npx jest src/data/supabase/sessions.test.ts`
Expected: FAIL — `toSessionRating` no existe.

- [ ] **Step 3: Tipos de la base**

En `src/data/supabase/database.types.ts`, tras `SessionAttendanceRow`:

```ts
/** Fila de `public.session_ratings`. Solo la lee quien respondió. */
export type SessionRatingRow = {
  session_id: string;
  rater_id: string;
  would_repeat: boolean;
  created_at: string;
};
```

En `Tables`, tras `session_attendance`:

```ts
      session_ratings: {
        Row: SessionRatingRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
```

En `Functions`, tras `leave_session`:

```ts
      rate_session: {
        Args: { p_session_id: string; p_would_repeat: boolean };
        Returns: SessionRatingRow;
      };
      /** `setof lockin_sessions`: 0 o 1 filas. */
      pending_session_rating: { Args: { p_match_id: string }; Returns: SessionRow[] };
```

- [ ] **Step 4: Implementación real**

En `src/data/supabase/sessions.ts`: importar `SessionRatingRow` junto a los otros tipos de `./database.types` y `SessionRating` junto a los de `../types`. Tras `toSessionAttendance`:

```ts
export function toSessionRating(row: SessionRatingRow): SessionRating {
  return {
    sessionId: row.session_id,
    raterId: row.rater_id,
    wouldRepeat: row.would_repeat,
    createdAt: toIso(row.created_at),
  };
}
```

Sustituir los dos stubs de la Tarea 2 por:

```ts
    async getPendingRating(matchId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('pending_session_rating', { p_match_id: matchId });
      if (error) throw toSessionError(error);
      const [row] = (data ?? []) as SessionRow[];
      return row ? remember(toLockInSession(row)) : null;
    },

    async rate(sessionId, wouldRepeat) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('rate_session', { p_session_id: sessionId, p_would_repeat: wouldRepeat });
      if (error) throw toSessionError(error);
      // Aviso local, sin realtime: la tabla no está publicada a propósito.
      await notifyForSession(sessionId);
      return toSessionRating(data as SessionRatingRow);
    },
```

Actualizar el comentario de cabecera para citar también `20260914000100_session_ratings.sql`.

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `npx jest src/data/supabase/sessions.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Saltos admitidos en `contract.yml`**

En `.github/workflows/contract.yml`, sustituir la lista del `jq` por:

```yaml
              - ["una propuesta caducada ya no está viva ni se puede aceptar",
                 "una sesión aceptada termina sola y deja proponer otra",
                 "una sesión empezada no se cancela: se sale",
                 "tras una sesión con las dos personas queda pendiente para las dos y responder la cierra solo para quien responde",
                 "si una de las dos personas no entró no hay valoración para nadie",
                 "responder dos veces a la misma sesión choca",
                 "la valoración caduca a los 7 días del final",
                 "la pendiente es la última sesión terminada y no retrocede a una anterior"]) as $unexpected
```

Los títulos deben coincidir carácter a carácter con los `itWithTimeTravel` de la Tarea 2.

- [ ] **Step 7: Commit**

```bash
git add src/data/supabase/database.types.ts src/data/supabase/sessions.ts src/data/supabase/sessions.test.ts .github/workflows/contract.yml docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): valoración post-sesión contra Supabase"
```

(Marcar `Tarea 4` antes del commit.)

---

### Task 5: `RatingPrompt`, `usePendingRating` y tarjeta del chat

**Files:**
- Create: `src/features/session/rating-prompt.tsx`
- Create: `src/features/session/use-pending-rating.ts`
- Modify: `src/features/session/session-card.tsx`
- Modify: `src/features/session/index.ts`
- Test: `src/features/session/rating-prompt.test.tsx`
- Test: `src/features/session/session-card.test.tsx`

**Interfaces:**
- Consumes: `repositories.sessions.getPendingRating`/`rate` (Tarea 2); `SESSION_TICK_MS` de `./use-active-session`; `useQuery`, `useRepositories` y los errores de `@/data`.
- Produces:
  - `RatingPrompt(props: { counterpartName: string; onAnswer: (wouldRepeat: boolean) => void; onDismiss?: () => void; busy?: boolean; notice?: string | null })`.
  - `usePendingRating(matchId: string | null): PendingRating` con `interface PendingRating { session: LockInSession | null; loading: boolean; busy: boolean; notice: string | null; answered: boolean; answer: (wouldRepeat: boolean) => Promise<void>; dismiss: () => void; refresh: () => void }`.
  - `ratingDismissedKey(sessionId: string): string` → `lockin:rating-dismissed:{sessionId}`.
  - Los tres exportados desde `@/features/session` (más el tipo `PendingRating`).

- [ ] **Step 1: Test de `RatingPrompt` que falla**

Crear `src/features/session/rating-prompt.test.tsx`:

```tsx
/** La pregunta de valoración, sin datos. En RNTL 14 `render` y `fireEvent` son asíncronos. */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { RatingPrompt } from './rating-prompt';

describe('RatingPrompt', () => {
  it('pregunta por la otra persona y responde sí o no', async () => {
    const onAnswer = jest.fn();
    await render(<RatingPrompt counterpartName="Núria" onAnswer={onAnswer} />);

    expect(screen.getByText('¿Repetirías con Núria?')).toBeTruthy();
    expect(screen.getByText('Solo lo verás tú.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sí, repetiría'));
    await fireEvent.press(screen.getByLabelText('No repetiría'));

    expect(onAnswer.mock.calls).toEqual([[true], [false]]);
    expect(screen.queryByLabelText('Ahora no')).toBeNull();
  });

  it('ofrece «Ahora no» solo con onDismiss y enseña el aviso', async () => {
    const onDismiss = jest.fn();
    await render(
      <RatingPrompt
        counterpartName="Núria"
        onAnswer={jest.fn()}
        onDismiss={onDismiss}
        notice="No se ha podido guardar. Inténtalo otra vez."
      />
    );

    await fireEvent.press(screen.getByLabelText('Ahora no'));

    expect(onDismiss).toHaveBeenCalled();
    expect(screen.getByText('No se ha podido guardar. Inténtalo otra vez.')).toBeTruthy();
  });

  it('con busy no deja responder', async () => {
    const onAnswer = jest.fn();
    await render(<RatingPrompt counterpartName="Núria" onAnswer={onAnswer} busy />);

    await fireEvent.press(screen.getByLabelText('Sí, repetiría'));

    expect(onAnswer).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx jest src/features/session/rating-prompt.test.tsx`
Expected: FAIL — no encuentra `./rating-prompt`.

- [ ] **Step 3: Implementar `RatingPrompt`**

Crear `src/features/session/rating-prompt.tsx`:

```tsx
/**
 * «¿Repetirías con {nombre}?» tras una sesión. Presentacional: quién responde y
 * dónde se guarda lo decide `usePendingRating`.
 *
 * Los dos botones llevan el mismo tono a propósito, para no empujar ninguna
 * respuesta. La respuesta es privada: el texto lo dice.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function RatingPrompt({
  counterpartName,
  onAnswer,
  onDismiss,
  busy = false,
  notice = null,
}: {
  counterpartName: string;
  onAnswer: (wouldRepeat: boolean) => void;
  onDismiss?: () => void;
  busy?: boolean;
  notice?: string | null;
}) {
  return (
    <View style={styles.root}>
      <ThemedText type="bodyStrong">{`¿Repetirías con ${counterpartName}?`}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Solo lo verás tú.
      </ThemedText>
      <View style={styles.row}>
        <Choice label="Sí" accessibilityLabel="Sí, repetiría" disabled={busy} onPress={() => onAnswer(true)} />
        <Choice label="No" accessibilityLabel="No repetiría" disabled={busy} onPress={() => onAnswer(false)} />
      </View>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ahora no"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDismiss}>
          <ThemedText type="smallBold" themeColor="teal">
            Ahora no
          </ThemedText>
        </Pressable>
      )}
      {notice && (
        <ThemedText type="small" themeColor="danger">
          {notice}
        </ThemedText>
      )}
    </View>
  );
}

function Choice({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { borderColor: theme.teal, opacity: disabled ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="bodyStrong">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
```

Run: `npx jest src/features/session/rating-prompt.test.tsx`
Expected: PASS. (Si Prettier reformatea las líneas largas de `Choice`, es correcto: `npm run format` al final de la tarea.)

- [ ] **Step 4: Tests de la tarjeta que fallan**

En `src/features/session/session-card.test.tsx`, añadir al final del `describe('SessionCard')` (antes de su `});`):

```tsx
  describe('valoración', () => {
    /** Sesión de 1 bloque ya terminada en la que entraron `attendees`. Reloj falso. */
    async function endedSession(attendees: string[]) {
      jest.useFakeTimers();
      const base = Date.now();
      jest.setSystemTime(base);
      const startsAt = new Date(base + 5 * MINUTE + 1_000).toISOString();
      const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
      const nuria = createMockSessionRepository(NURIA);
      await nuria.respond(session.id, 'aceptada');
      jest.setSystemTime(base + 2_000);
      if (attendees.includes('me')) await repositories.sessions.join(session.id);
      if (attendees.includes(NURIA)) await nuria.join(session.id);
      jest.setSystemTime(base + 36 * MINUTE);
      return session;
    }

    it('tras una sesión con las dos personas pregunta y responder da las gracias', async () => {
      const session = await endedSession(['me', NURIA]);
      const rate = jest.spyOn(repositories.sessions, 'rate');

      await renderCard();
      await fireEvent.press(await screen.findByLabelText('No repetiría'));

      await waitFor(() => expect(screen.getByText('Gracias.')).toBeTruthy());
      expect(rate).toHaveBeenCalledWith(session.id, false);
      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();
      expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy();
    });

    it('«Ahora no» la oculta y lo recuerda en el dispositivo', async () => {
      const session = await endedSession(['me', NURIA]);

      await renderCard();
      await fireEvent.press(await screen.findByLabelText('Ahora no'));

      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();
      await expect(AsyncStorage.getItem(`lockin:rating-dismissed:${session.id}`)).resolves.toBe(
        '1'
      );
    });

    it('si la otra persona no entró no pregunta', async () => {
      await endedSession(['me']);

      await renderCard();

      await screen.findByLabelText('Agendar sesión Lock-In');
      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();
    });

    it('con una sesión viva manda la sesión y no pregunta', async () => {
      await endedSession(['me', NURIA]);
      await repositories.sessions.propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });

      await renderCard();

      await waitFor(() => expect(screen.getByText('Esperando a Núria')).toBeTruthy());
      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();
    });

    it('si no se puede guardar lo dice y deja reintentar', async () => {
      await endedSession(['me', NURIA]);
      jest.spyOn(repositories.sessions, 'rate').mockRejectedValue(new Error('sin red'));

      await renderCard();
      await fireEvent.press(await screen.findByLabelText('Sí, repetiría'));

      await waitFor(() =>
        expect(screen.getByText('No se ha podido guardar. Inténtalo otra vez.')).toBeTruthy()
      );
      expect(screen.getByLabelText('Sí, repetiría')).toBeTruthy();
    });
  });
```

(`inAnHour()` usa `Date.now()`, que con el reloj falso ya es `base + 36 min`: la sesión nueva es válida.)

- [ ] **Step 5: Ejecutar y ver que fallan**

Run: `npx jest src/features/session/session-card.test.tsx -t valoración`
Expected: FAIL — no encuentra «No repetiría».

- [ ] **Step 6: Implementar `usePendingRating`**

Crear `src/features/session/use-pending-rating.ts`:

```ts
/**
 * La valoración pendiente de un match, con respuesta y descarte local.
 *
 * `matchId = null` no consulta nada: la pantalla de sesión solo pregunta al
 * terminar. «Ahora no» se guarda en el dispositivo y no en la base, así que la
 * tabla solo tiene respuestas de verdad. Se refresca con los avisos del
 * repositorio (la asistencia sí va por realtime) y con el tic de la tarjeta.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  SessionConflictError,
  SessionForbiddenError,
  SessionWindowError,
  useQuery,
  useRepositories,
} from '@/data';

import { SESSION_TICK_MS } from './use-active-session';

import type { LockInSession } from '@/data';

export const ratingDismissedKey = (sessionId: string) => `lockin:rating-dismissed:${sessionId}`;

export interface PendingRating {
  session: LockInSession | null;
  loading: boolean;
  busy: boolean;
  notice: string | null;
  /** Se respondió desde este componente. */
  answered: boolean;
  answer: (wouldRepeat: boolean) => Promise<void>;
  dismiss: () => void;
  refresh: () => void;
}

export function usePendingRating(matchId: string | null): PendingRating {
  const repositories = useRepositories();
  const query = useQuery(`session:rating:${matchId ?? 'ninguno'}`, async () => {
    if (!matchId) return null;
    const pending = await repositories.sessions.getPendingRating(matchId);
    if (!pending) return null;
    const dismissed = await AsyncStorage.getItem(ratingDismissedKey(pending.id)).catch(
      () => null
    );
    return dismissed === '1' ? null : pending;
  });
  const { refresh } = query;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    return repositories.sessions.subscribe(matchId, refresh);
  }, [repositories, matchId, refresh]);

  useEffect(() => {
    if (!matchId) return;
    const id = setInterval(refresh, SESSION_TICK_MS);
    return () => clearInterval(id);
  }, [matchId, refresh]);

  const session = query.data && query.data.id !== dismissedId ? query.data : null;

  const answer = useCallback(
    async (wouldRepeat: boolean) => {
      if (!session) return;
      setBusy(true);
      setNotice(null);
      try {
        await repositories.sessions.rate(session.id, wouldRepeat);
        setAnswered(true);
      } catch (cause: unknown) {
        // Ya respondida, caducada o no valorable: el refresco la quita sin más.
        const settled =
          cause instanceof SessionConflictError ||
          cause instanceof SessionWindowError ||
          cause instanceof SessionForbiddenError;
        if (!settled) setNotice('No se ha podido guardar. Inténtalo otra vez.');
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [repositories, session, refresh]
  );

  const dismiss = useCallback(() => {
    if (!session) return;
    setDismissedId(session.id);
    void AsyncStorage.setItem(ratingDismissedKey(session.id), '1').catch(() => {});
  }, [session]);

  return { session, loading: query.loading, busy, notice, answered, answer, dismiss, refresh };
}
```

- [ ] **Step 7: Montarlo en la tarjeta**

En `src/features/session/session-card.tsx`: añadir imports `import { RatingPrompt } from './rating-prompt';` y `import { usePendingRating } from './use-pending-rating';`. Tras `const reminderHint = useReminderHint();`:

```tsx
  const rating = usePendingRating(match.id);
```

Sustituir el bloque `{view.kind === 'agendar' && ( <CardButton … /> )}` por:

```tsx
      {view.kind === 'agendar' && (
        <>
          {rating.session ? (
            <RatingPrompt
              counterpartName={firstName}
              busy={rating.busy}
              notice={rating.notice}
              onAnswer={(wouldRepeat) => void rating.answer(wouldRepeat)}
              onDismiss={rating.dismiss}
            />
          ) : (
            rating.answered && (
              <ThemedText type="small" themeColor="textSecondary">
                Gracias.
              </ThemedText>
            )
          )}
          <CardButton
            label="Agendar sesión Lock-In"
            disabled={busy}
            onPress={() => setSheetOpen(true)}
          />
        </>
      )}
```

Actualizar el comentario de cabecera: «… y, en el estado agendar, la valoración pendiente de la última sesión (`usePendingRating`)».

En `src/features/session/index.ts`, en orden alfabético:

```ts
export { RatingPrompt } from './rating-prompt';
```

tras `ProposeSessionSheet`, y

```ts
export { ratingDismissedKey, usePendingRating, type PendingRating } from './use-pending-rating';
```

tras `useNow`.

- [ ] **Step 8: Ejecutar y ver que pasan**

Run: `npx jest src/features/session`
Expected: PASS, incluidos los tests previos de `SessionCard`.

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/features/session/rating-prompt.tsx src/features/session/rating-prompt.test.tsx src/features/session/use-pending-rating.ts src/features/session/session-card.tsx src/features/session/session-card.test.tsx src/features/session/index.ts
git add src/features/session/rating-prompt.tsx src/features/session/rating-prompt.test.tsx src/features/session/use-pending-rating.ts src/features/session/session-card.tsx src/features/session/session-card.test.tsx src/features/session/index.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): pregunta de valoración en la tarjeta del chat"
```

(Marcar `Tarea 5` antes del commit.)

---

### Task 6: Pregunta en «Sesión completada»

**Files:**
- Modify: `src/app/session/[sessionId].tsx`
- Test: `test/app/sessionId.test.tsx`

**Interfaces:**
- Consumes: `RatingPrompt`, `usePendingRating` de `@/features/session` (Tarea 5).
- Produces: constante local `RATING_RETRY_MS = 5_000` en la pantalla.

- [ ] **Step 1: Tests que fallan**

En `test/app/sessionId.test.tsx`, añadir al final del `describe('SessionScreen')`:

```tsx
  describe('valoración al completar', () => {
    /** Sesión de 1 bloque en la que entran `attendees` y que ya ha terminado. */
    async function completedSession(attendees: string[]) {
      const { session, startsAtMs } = await seedSession({ blocks: 1 });
      jest.setSystemTime(startsAtMs + MINUTE);
      if (attendees.includes('me')) await repositories.sessions.join(session.id);
      if (attendees.includes(COUNTERPART_ID)) {
        await createMockSessionRepository(COUNTERPART_ID).join(session.id);
      }
      jest.setSystemTime(startsAtMs + 31 * MINUTE);
      return session;
    }

    it('con las dos personas dentro pregunta, sin «Ahora no», y da las gracias', async () => {
      const session = await completedSession(['me', COUNTERPART_ID]);
      const rate = jest.spyOn(repositories.sessions, 'rate');

      await renderRoute(<SessionScreen />);

      await waitFor(() => expect(screen.getByText('¿Repetirías con Núria?')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Ahora no' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Volver al chat' })).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: 'Sí, repetiría' }));

      await waitFor(() => expect(screen.getByText('Gracias.')).toBeTruthy());
      expect(rate).toHaveBeenCalledWith(session.id, true);
    });

    it('si la otra persona no entró no pregunta', async () => {
      await completedSession(['me']);

      await renderRoute(<SessionScreen />);

      await waitFor(() => expect(screen.getByText('Sesión completada')).toBeTruthy());
      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();
    });

    it('si el servidor aún no la da por terminada reintenta a los 5 s', async () => {
      await completedSession(['me', COUNTERPART_ID]);
      const pending = jest
        .spyOn(repositories.sessions, 'getPendingRating')
        .mockResolvedValueOnce(null);

      await renderRoute(<SessionScreen />);
      await waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('¿Repetirías con Núria?')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });

      await waitFor(() => expect(screen.getByText('¿Repetirías con Núria?')).toBeTruthy());
    });
  });
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npx jest test/app/sessionId.test.tsx -t valoración`
Expected: FAIL — no aparece «¿Repetirías con Núria?».

- [ ] **Step 3: Implementar en la pantalla**

En `src/app/session/[sessionId].tsx`:

Cambiar `import { useState } from 'react';` por `import { useEffect, useState } from 'react';`. Añadir `RatingPrompt` y `usePendingRating` al import de `@/features/session`. Tras `const PRESENCE_TEXT … };`:

```tsx
/** El reloj corregido puede cruzar el final un instante antes que el servidor. */
const RATING_RETRY_MS = 5_000;
```

Tras `const [confirmingLeave, setConfirmingLeave] = useState(false);`:

```tsx
  const rating = usePendingRating(ended && match ? match.id : null);
  const { session: pendingRating, loading: ratingLoading, refresh: refreshRating } = rating;
  const [ratingRetried, setRatingRetried] = useState(false);

  useEffect(() => {
    if (!ended || ratingLoading || pendingRating || ratingRetried) return;
    const id = setTimeout(() => {
      setRatingRetried(true);
      refreshRating();
    }, RATING_RETRY_MS);
    return () => clearTimeout(id);
  }, [ended, ratingLoading, pendingRating, ratingRetried, refreshRating]);
```

Sustituir el bloque de sesión completada:

```tsx
        {phase && ended ? (
          <View style={styles.clock}>
            <ThemedText type="title">Sesión completada</ThemedText>
            {pendingRating?.id === session.id ? (
              <RatingPrompt
                counterpartName={match.counterpart.name.split(' ')[0]}
                busy={rating.busy}
                notice={rating.notice}
                onAnswer={(wouldRepeat) => void rating.answer(wouldRepeat)}
              />
            ) : (
              rating.answered && (
                <ThemedText type="body" themeColor="textSecondary">
                  Gracias.
                </ThemedText>
              )
            )}
            <ActionButton label="Volver al chat" onPress={() => router.back()} />
          </View>
        ) : phase ? (
```

Actualizar el comentario de cabecera: «Al terminar pregunta «¿Repetirías?» si asistieron las dos personas; sin «Ahora no», porque volver al chat la deja pendiente allí.»

- [ ] **Step 4: Ejecutar y ver que pasan**

Run: `npx jest test/app/sessionId.test.tsx`
Expected: PASS, incluidos los 7 tests previos.

Si el test de reintento no ve la segunda llamada: comprobar que el primer `getPendingRating` ya resolvió (`ratingLoading` a `false`) antes de avanzar los temporizadores; el `waitFor(() => expect(pending).toHaveBeenCalledTimes(1))` lo garantiza para la llamada, pero el render de `loading=false` llega un tick después. Si hace falta, cambiar ese `waitFor` por `await act(async () => {})` tras él.

- [ ] **Step 5: Commit**

```bash
npx prettier --write "src/app/session/[sessionId].tsx" test/app/sessionId.test.tsx
git add "src/app/session/[sessionId].tsx" test/app/sessionId.test.tsx docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): pregunta de valoración al completar la sesión"
```

(Marcar `Tarea 6` antes del commit.)

---

### Task 7: Verificación final

**Files:**
- Modify: `docs/plan/todo/sesiones.md`
- Modify: `docs/plan/TODO.md` (línea «Valoración de 1 toque post-sesión»)

- [ ] **Step 1: Todo en verde en local**

Run: `npm run lint`
Expected: limpio.

Run: `npx tsc --noEmit`
Expected: limpio.

Run: `npm test -- --coverage`
Expected: Jest sale con 0 (el suelo de `jest.config.js` se cumple). Anotar el recuento `Tests: N passed` y `Test Suites: M passed`.

Run: `npx prettier --check --end-of-line auto .`
Expected: sin archivos marcados (en Windows, sin `--end-of-line auto` salen falsos positivos por CRLF).

Si la cobertura baja del suelo, añadir tests del hueco concreto que marque el informe (ramas de `use-pending-rating.ts`, p. ej. `dismiss` sin sesión) en vez de bajar el suelo.

- [ ] **Step 2: CI en Actions**

```bash
git push
gh run list --limit 6
```

Esperar a que terminen `CI`, `Schema drift` y `E2E Android` sobre el commit empujado (`gh run watch <id>`). Expected: `CI` y `E2E Android` en `success`. `Schema drift` en `success` solo si la Tarea 3b ya está hecha; si no, el job remoto en rojo con `session_ratings` en el diff es lo esperado y se anota así, sin darlo por bueno.

- [ ] **Step 3: Contrato contra Supabase local en Actions**

```bash
gh workflow run contract.yml --ref claude/startup-cofounder-matching-app-tfeai1
gh run list --workflow contract.yml --limit 1
gh run watch <id>
```

Expected: `success`, con `numFailedTests: 0` y los 8 saltos admitidos (3 previos + 5 de valoración). Si falla, descargar `contract-result` con `gh run download <id> -n contract-result` y leer los `failureMessages`.

- [ ] **Step 4: Cerrar el tablero**

En `docs/plan/todo/sesiones.md`, marcar `Tarea 7` con: recuento de tests, enlaces de los runs de CI, E2E, Schema drift y contrato. En `docs/plan/TODO.md`, sustituir la línea `- [ ] Valoración de 1 toque post-sesión (spec propia, lee \`session_attendance\`)` por:

```markdown
- [x] Valoración de 1 toque post-sesión — «¿Repetirías con {nombre}?» privado, solo si asistieron las dos personas; spec `docs/superpowers/specs/2026-09-14-valoracion-post-sesion-design.md`, detalle y runs en `todo/sesiones.md` → "Valoración de 1 toque post-sesión"
```

Si la Tarea 3b sigue pendiente del usuario, dejar la casilla del maestro en `[ ]` y añadir «— falta aplicar la migración en `grrzmzktrhksbttpbblg`».

- [ ] **Step 5: Commit**

```bash
git add docs/plan/todo/sesiones.md docs/plan/TODO.md
git commit -m "docs(sesiones): cerrar la valoración post-sesión con CI y contrato en verde"
git push
```
