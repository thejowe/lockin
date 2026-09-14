# Sesiones Lock-In con Pomodoro compartido — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que dos personas con match propongan, acepten y compartan una sesión Lock-In con Pomodoro fijo de bloques 25+5, presencia "está aquí" y aviso local 5 minutos antes.

**Architecture:** Tablas `lockin_sessions` y `session_attendance` en Supabase, escritas solo por RPCs `SECURITY DEFINER` con RLS, detrás de un `LockInSessionRepository` nuevo que cumplen el mock y Supabase bajo la misma suite de contrato. El reloj se deriva de `startsAt` en el cliente; la presencia va por un `PresenceAdapter` (Realtime Presence o memoria); los avisos por un puerto sobre `expo-notifications`.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, TypeScript estricto, Jest (`jest-expo`) + React Native Testing Library 14 (render, fireEvent y renderHook asíncronos), Supabase (Postgres 17, PostgREST, Realtime), Maestro para E2E Android.

**Spec:** `docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md`

## Global Constraints

- Bloques de 25 min de trabajo + 5 de descanso; `SessionBlocks = 1 | 2 | 4`; sin pausa.
- Una sola sesión viva por match. Viva: `propuesta` con `now < startsAt`, o `aceptada` con `now < endsAt`.
- `now + 5 min ≤ startsAt ≤ now + 30 días`. Ventana de entrada: `aceptada` y `startsAt − 5 min ≤ now < endsAt`.
- Solo la otra persona acepta o rechaza. Cualquiera cancela antes de `startsAt`. `join` idempotente (pone `leftAt = null`).
- Errores de dominio: `SessionConflictError` (LI001), `SessionExpiredError` (LI002), `SessionWindowError` (LI003), `SessionForbiddenError` (LI004).
- Las pantallas importan datos solo desde `@/data`, nunca desde `@/data/mock` ni `@/data/supabase`.
- Cruces de alcance declarados: `src/app/chat/[matchId].tsx` (chat), `src/app/(tabs)/_layout.tsx` y `src/app/_layout.tsx` (arquitecto), `jest.setup.js` y `test/app/layouts.test.tsx` (calidad). Nada más fuera del bloque `sesiones`.
- Worktree compartido con otras sesiones: **nunca `git add .`**; cada commit añade rutas explícitas.
- En RNTL 14 `render`, `fireEvent` y `renderHook` devuelven promesas: siempre `await`.
- Textos de UI en español; comentarios de código en español, como el resto del repo.
- `.sql` en LF (`.gitattributes` ya lo fija). Al pegar una migración en el SQL Editor, copiarla del archivo del repo.
- Suelo de cobertura de `jest.config.js` (89.82/82.56/91.49/91.38) no baja.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/data/types.ts` (mod) | Tipos `LockInSession`, `SessionAttendance`, `SessionProposalInput`, `SessionBlocks`, `SessionStatus` |
| `src/data/sessions.ts` (nuevo) | Constantes y reglas puras de tiempo compartidas por mock, Supabase y UI |
| `src/data/session-errors.ts` (nuevo) | Las cuatro clases de error de dominio |
| `src/data/repositories.ts` (mod) | `LockInSessionRepository` y `Repositories.sessions` |
| `src/data/mock/store.ts` (mod) | Estado de sesiones/asistencia y reloj simulado |
| `src/data/mock/sessions.ts` (nuevo) | Implementación mock parametrizada por actor |
| `src/data/repositories.contract.ts` (mod) | Casos de contrato de sesiones |
| `supabase/migrations/20260913000100_lockin_sessions.sql` (nuevo) | Enum, tablas, RLS, helpers, RPCs, realtime |
| `src/data/supabase/database.types.ts` (mod) | Filas y funciones nuevas |
| `src/data/supabase/sessions.ts` (nuevo) | Mapeo, traducción de errores y repositorio Supabase |
| `src/data/presence.ts` (nuevo) | `PresenceAdapter` y adaptador en memoria |
| `src/data/supabase/presence.ts` (nuevo) | Adaptador sobre Realtime Presence |
| `src/data/active.ts`, `src/data/index.ts` (mod) | Elegir y exportar `presence` |
| `src/features/session/phase.ts` | `phaseAt`, `formatCountdown` |
| `src/features/session/slots.ts` | Días, tramos de 15 min, franja común, preselección |
| `src/features/session/format.ts` | Textos de fecha, "empieza en", bloques |
| `src/features/session/use-counterpart-presence.ts` | Hook de presencia |
| `src/features/session/use-session-room.ts` | Carga de la sala, desfase de reloj, asistencia |
| `src/app/session/[sessionId].tsx` | Pantalla de sesión |
| `src/features/session/card-state.ts` | Qué estado pinta la tarjeta |
| `src/features/session/use-active-session.ts` | Sesión viva de un match con suscripción y tic |
| `src/features/session/session-card.tsx` | Tarjeta del chat |
| `src/features/session/propose-session-sheet.tsx` | Hoja de propuesta |
| `src/features/session/reminders.ts` | Reconciliación pura de avisos |
| `src/features/session/notifications-port.ts` | Puerto sobre `expo-notifications` |
| `src/features/session/reminder-permission.ts` | Estado "avisos denegados" compartido |
| `src/features/session/session-reminder-sync.tsx` | Componente sin UI que reconcilia al abrir la app |
| `src/features/session/index.ts` | Superficie pública del bloque |
| `e2e/session-now.sql`, `e2e/session.yaml`, `e2e/session.test.mjs` | E2E de entrar y salir |
| `docs/plan/PLAN.md`, `docs/plan/todo/sesiones.md` | Bloque nuevo en el tablero |

---

### Task 1: Dominio de sesiones y bloque en el tablero

**Files:**
- Modify: `src/data/types.ts` (añadir al final)
- Create: `src/data/sessions.ts`
- Create: `src/data/session-errors.ts`
- Modify: `src/data/index.ts`
- Test: `src/data/sessions.test.ts`
- Modify: `docs/plan/PLAN.md`
- Create: `docs/plan/todo/sesiones.md`

**Interfaces:**
- Produces: tipos `SessionBlocks`, `SessionStatus`, `LockInSession`, `SessionAttendance`, `SessionProposalInput`; constantes `WORK_MINUTES = 25`, `BREAK_MINUTES = 5`, `BLOCK_MINUTES = 30`, `MIN_LEAD_MINUTES = 5`, `MAX_LEAD_DAYS = 30`, `JOIN_WINDOW_MINUTES = 5`, `SESSION_BLOCK_OPTIONS`; funciones `sessionEndsAtMs(startsAt: string, blocks: SessionBlocks): number`, `isSessionLive(session: SessionTiming, nowMs: number): boolean`, `isInJoinWindow(session: SessionTiming, nowMs: number): boolean`, `isValidStartsAt(startsAtMs: number, nowMs: number): boolean`, `isSessionBlocks(value: number): value is SessionBlocks`; tipo `SessionTiming = Pick<LockInSession, 'status' | 'startsAt' | 'blocks'>`; clases `SessionConflictError`, `SessionExpiredError`, `SessionWindowError`, `SessionForbiddenError`. Todo exportado desde `@/data`.

- [ ] **Step 1: Añadir los tipos de dominio**

Al final de `src/data/types.ts`:

```ts
/** Bloques de una sesión Lock-In: cada uno son 25 min de trabajo + 5 de descanso. */
export type SessionBlocks = 1 | 2 | 4;

/**
 * Estado guardado de una sesión. "Caducada", "en curso" y "terminada" no están
 * aquí a propósito: se derivan de la hora (ver `src/data/sessions.ts`).
 */
export type SessionStatus = 'propuesta' | 'aceptada' | 'rechazada' | 'cancelada';

/** Sesión Lock-In entre las dos personas de un match. */
export interface LockInSession {
  id: string;
  matchId: string;
  /** Id del perfil que propone. */
  proposedBy: string;
  /** ISO. Inicio del primer bloque. */
  startsAt: string;
  blocks: SessionBlocks;
  status: SessionStatus;
  createdAt: string;
  /** ISO del paso a aceptada/rechazada/cancelada; `null` mientras es propuesta. */
  respondedAt: string | null;
}

/** Asistencia de una persona a una sesión. */
export interface SessionAttendance {
  sessionId: string;
  profileId: string;
  joinedAt: string;
  /**
   * `null` = no salió de forma explícita: se quedó hasta el final o cerró la
   * app. Solo cuenta como abandono un `leftAt` anterior al final de la sesión.
   */
  leftAt: string | null;
}

/** Datos para proponer una sesión. El repositorio pone id, autor y estado. */
export interface SessionProposalInput {
  matchId: string;
  startsAt: string;
  blocks: SessionBlocks;
}
```

- [ ] **Step 2: Escribir el test de las reglas puras**

`src/data/sessions.test.ts`:

```ts
/**
 * Reglas de tiempo de las sesiones Lock-In. Las usan el mock, el repositorio de
 * Supabase (para `getActive`) y la UI, así que un borde mal puesto aquí se ve en
 * los tres sitios a la vez.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from './session-errors';
import {
  BLOCK_MINUTES,
  isInJoinWindow,
  isSessionBlocks,
  isSessionLive,
  isValidStartsAt,
  sessionEndsAtMs,
} from './sessions';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');
const startsAt = new Date(START).toISOString();

describe('sessionEndsAtMs', () => {
  it('suma 30 minutos por bloque, descanso del último incluido', () => {
    expect(BLOCK_MINUTES).toBe(30);
    expect(sessionEndsAtMs(startsAt, 1)).toBe(START + 30 * MINUTE);
    expect(sessionEndsAtMs(startsAt, 4)).toBe(START + 120 * MINUTE);
  });
});

describe('isSessionLive', () => {
  it('una propuesta vive hasta la hora de inicio, exclusiva', () => {
    const session = { status: 'propuesta' as const, startsAt, blocks: 2 as const };
    expect(isSessionLive(session, START - 1)).toBe(true);
    expect(isSessionLive(session, START)).toBe(false);
  });

  it('una aceptada vive hasta el final, exclusivo', () => {
    const session = { status: 'aceptada' as const, startsAt, blocks: 2 as const };
    expect(isSessionLive(session, START + 60 * MINUTE - 1)).toBe(true);
    expect(isSessionLive(session, START + 60 * MINUTE)).toBe(false);
  });

  it.each(['rechazada', 'cancelada'] as const)('una %s nunca está viva', (status) => {
    expect(isSessionLive({ status, startsAt, blocks: 1 }, START - 10 * MINUTE)).toBe(false);
  });
});

describe('isInJoinWindow', () => {
  const accepted = { status: 'aceptada' as const, startsAt, blocks: 1 as const };

  it('abre 5 minutos antes y cierra al final', () => {
    expect(isInJoinWindow(accepted, START - 5 * MINUTE - 1)).toBe(false);
    expect(isInJoinWindow(accepted, START - 5 * MINUTE)).toBe(true);
    expect(isInJoinWindow(accepted, START + 30 * MINUTE - 1)).toBe(true);
    expect(isInJoinWindow(accepted, START + 30 * MINUTE)).toBe(false);
  });

  it('sin aceptar no hay ventana', () => {
    expect(isInJoinWindow({ ...accepted, status: 'propuesta' }, START)).toBe(false);
  });
});

describe('isValidStartsAt', () => {
  const now = START - 60 * MINUTE;

  it('exige al menos 5 minutos de margen', () => {
    expect(isValidStartsAt(now + 5 * MINUTE - 1, now)).toBe(false);
    expect(isValidStartsAt(now + 5 * MINUTE, now)).toBe(true);
  });

  it('no admite más de 30 días', () => {
    expect(isValidStartsAt(now + 30 * 24 * 60 * MINUTE, now)).toBe(true);
    expect(isValidStartsAt(now + 30 * 24 * 60 * MINUTE + 1, now)).toBe(false);
  });
});

describe('isSessionBlocks', () => {
  it('solo acepta 1, 2 y 4', () => {
    expect([0, 1, 2, 3, 4, 5].filter(isSessionBlocks)).toEqual([1, 2, 4]);
  });
});

describe('errores de dominio', () => {
  it.each([
    [SessionConflictError, 'SessionConflictError'],
    [SessionExpiredError, 'SessionExpiredError'],
    [SessionWindowError, 'SessionWindowError'],
    [SessionForbiddenError, 'SessionForbiddenError'],
  ])('%p se distingue con instanceof y lleva su nombre', (ErrorClass, name) => {
    const error = new ErrorClass('detalle');
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe('detalle');
  });
});
```

- [ ] **Step 3: Ejecutar el test y ver que falla**

Run: `npx jest src/data/sessions.test.ts`
Expected: FAIL con `Cannot find module './session-errors'`.

- [ ] **Step 4: Implementar reglas y errores**

`src/data/sessions.ts`:

```ts
/**
 * Reglas de tiempo de las sesiones Lock-In.
 *
 * Una sola fuente para el mock, el repositorio de Supabase y la UI. El SQL de
 * `supabase/migrations/20260913000100_lockin_sessions.sql` repite estas mismas
 * reglas en `session_is_live()` y en los RPCs: si cambia una, cambian las dos.
 */

import type { LockInSession, SessionBlocks } from './types';

export const WORK_MINUTES = 25;
export const BREAK_MINUTES = 5;
export const BLOCK_MINUTES = WORK_MINUTES + BREAK_MINUTES;
export const MIN_LEAD_MINUTES = 5;
export const MAX_LEAD_DAYS = 30;
export const JOIN_WINDOW_MINUTES = 5;
export const SESSION_BLOCK_OPTIONS: readonly SessionBlocks[] = [1, 2, 4];

const MINUTE = 60_000;

/** Lo único que miran las reglas de tiempo. */
export type SessionTiming = Pick<LockInSession, 'status' | 'startsAt' | 'blocks'>;

export function sessionEndsAtMs(startsAt: string, blocks: SessionBlocks): number {
  return Date.parse(startsAt) + blocks * BLOCK_MINUTES * MINUTE;
}

/** Viva: propuesta que aún no ha llegado a su hora, o aceptada que no ha acabado. */
export function isSessionLive(session: SessionTiming, nowMs: number): boolean {
  if (session.status === 'propuesta') return nowMs < Date.parse(session.startsAt);
  if (session.status === 'aceptada') {
    return nowMs < sessionEndsAtMs(session.startsAt, session.blocks);
  }
  return false;
}

/** Se puede entrar desde 5 minutos antes hasta el final, y solo si está aceptada. */
export function isInJoinWindow(session: SessionTiming, nowMs: number): boolean {
  return (
    session.status === 'aceptada' &&
    nowMs >= Date.parse(session.startsAt) - JOIN_WINDOW_MINUTES * MINUTE &&
    nowMs < sessionEndsAtMs(session.startsAt, session.blocks)
  );
}

export function isValidStartsAt(startsAtMs: number, nowMs: number): boolean {
  return (
    startsAtMs >= nowMs + MIN_LEAD_MINUTES * MINUTE &&
    startsAtMs <= nowMs + MAX_LEAD_DAYS * 24 * 60 * MINUTE
  );
}

export function isSessionBlocks(value: number): value is SessionBlocks {
  return value === 1 || value === 2 || value === 4;
}
```

`src/data/session-errors.ts`:

```ts
/**
 * Errores de dominio de las sesiones Lock-In.
 *
 * Los lanzan los dos backends con el mismo significado; en Supabase salen de los
 * `errcode` LI001–LI004 de los RPCs (ver `src/data/supabase/sessions.ts`). La UI
 * decide qué decir mirando la clase, nunca el mensaje.
 */

/** La sesión cambió antes de la operación, o ya hay otra viva en el match. LI001. */
export class SessionConflictError extends Error {
  override name = 'SessionConflictError';
}

/** La hora de la sesión ya pasó para lo que se intenta. LI002. */
export class SessionExpiredError extends Error {
  override name = 'SessionExpiredError';
}

/** Hora propuesta fuera de rango, o entrada/salida fuera de la ventana. LI003. */
export class SessionWindowError extends Error {
  override name = 'SessionWindowError';
}

/** Operación que no te corresponde: match ajeno o responder a tu propia propuesta. LI004. */
export class SessionForbiddenError extends Error {
  override name = 'SessionForbiddenError';
}
```

En `src/data/index.ts`, después de `export * from './repositories';`:

```ts
export * from './sessions';
export * from './session-errors';
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `npx jest src/data/sessions.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Registrar el bloque en el tablero**

En `docs/plan/PLAN.md`, después de la sección `### 6. \`calidad\` — Tests, lint, CI` (antes de `## Orden recomendado de trabajo`), añadir:

```markdown
### 7. `sesiones` — Sesiones Lock-In (Fase 2)

Entrega: propuesta de sesión desde el chat, Pomodoro compartido de bloques 25+5, presencia "está aquí" y aviso local 5 minutos antes. Diseño en `docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md`; plan en `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`.

- Archivos: `src/features/session/`, `src/app/session/`, y en coordinación con `arquitecto` y `datos` las piezas de sesiones de `src/data/**` y `supabase/migrations/`.
- Cruces de una línea declarados en la spec: `src/app/chat/[matchId].tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/_layout.tsx`; más el mock de `expo-notifications` en `jest.setup.js`.
- Depende de: MVP cerrado (todos los bloques anteriores).
```

Crear `docs/plan/todo/sesiones.md`:

```markdown
# TODO — sesiones

Plan: `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`. Una casilla por tarea del plan; se marca al hacer su commit.

- [x] Tarea 1 — Dominio: tipos, reglas de tiempo, errores
- [ ] Tarea 2 — Contrato de `LockInSessionRepository` y mock
- [ ] Tarea 3 — Migración SQL (tablas, RLS, RPCs) y comprobación en PGlite
- [ ] Tarea 3b — Migración aplicada en `grrzmzktrhksbttpbblg` por el usuario; `schema-drift.yml` en verde
- [ ] Tarea 4 — Repositorio de Supabase
- [ ] Tarea 5 — Presencia (memoria y Realtime)
- [ ] Tarea 6 — Lógica pura de reloj, tramos y textos
- [ ] Tarea 7 — Pantalla de sesión
- [ ] Tarea 8 — Tarjeta del chat y hoja de propuesta
- [ ] Tarea 9 — Recordatorios locales
- [ ] Tarea 10 — E2E Android de entrar y salir
- [ ] Tarea 11 — Verificación final

## Verificación manual (no automatizable)

- [ ] Dos móviles reales: el punto "está aquí" aparece y desaparece al entrar y salir la otra persona
- [ ] Aviso real 5 minutos antes en Android con la app cerrada
- [ ] Contrato opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1`) con los casos de sesiones en verde
```

- [ ] **Step 7: Typecheck y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add -- src/data/types.ts src/data/sessions.ts src/data/session-errors.ts src/data/index.ts src/data/sessions.test.ts docs/plan/PLAN.md docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): tipos, reglas de tiempo y errores de dominio"
```

---

### Task 2: Contrato de `LockInSessionRepository` y mock

**Files:**
- Modify: `src/data/repositories.ts`
- Modify: `src/data/mock/store.ts`
- Create: `src/data/mock/sessions.ts`
- Modify: `src/data/mock/index.ts`
- Modify: `src/data/repositories.contract.ts`
- Modify: `src/data/mock/index.test.ts`
- Modify: `src/data/supabase/index.ts` (repositorio provisional, lo sustituye la Tarea 4)
- Modify: `src/data/supabase/contract.test.ts` (campos provisionales del fixture, los sustituye la Tarea 4)

**Interfaces:**
- Consumes (Tarea 1): tipos de sesión, `isSessionLive`, `isInJoinWindow`, `isValidStartsAt`, `isSessionBlocks`, las cuatro clases de error.
- Produces:
  ```ts
  export interface LockInSessionRepository {
    getActive(matchId: string): Promise<LockInSession | null>;
    getById(sessionId: string): Promise<LockInSession | null>;
    propose(input: SessionProposalInput): Promise<LockInSession>;
    respond(sessionId: string, answer: 'aceptada' | 'rechazada'): Promise<LockInSession>;
    cancel(sessionId: string): Promise<LockInSession>;
    join(sessionId: string): Promise<SessionAttendance>;
    leave(sessionId: string): Promise<SessionAttendance>;
    listAttendance(sessionId: string): Promise<SessionAttendance[]>;
    serverNow(): Promise<string>;
    subscribe(matchId: string, listener: () => void): Unsubscribe;
  }
  ```
  `Repositories.sessions: LockInSessionRepository`. En el mock, exportados desde `src/data/mock/index.ts`: `createMockSessionRepository(actorId: string)`, `advanceMockClock(ms: number): void`, `mockNowMs(): number`, `sessionsTopic(matchId: string): string`. En el contrato: `ContractFixture.counterpartSessions()`, `ContractFixture.outsiderSessions()`, `ContractFixture.elapse(ms: number): Promise<void>`, `ContractBackend.canTimeTravel: boolean`.

**Por qué hay piezas provisionales en Supabase.** `Repositories` gana `sessions` y `ContractFixture` gana tres métodos: sin algo en `src/data/supabase/` el proyecto no compila hasta la Tarea 4. Lo provisional lanza un error que nombra la tarea, la suite de Supabase es opt-in y está saltada en `npm test`, y la Tarea 4 lo borra.

- [ ] **Step 1: Declarar la interfaz**

En `src/data/repositories.ts`, sustituir el import de tipos por:

```ts
import type {
  Decision,
  DecisionResult,
  LockInSession,
  MatchWithProfile,
  Message,
  MessageInput,
  ModePreference,
  Profile,
  ProfileFilter,
  ProfileInput,
  Session,
  SessionAttendance,
  SessionProposalInput,
} from './types';
```

Antes de `export interface Repositories`:

```ts
/**
 * Sesiones Lock-In de los matches del usuario.
 *
 * Reglas, iguales en los dos backends (ver `src/data/sessions.ts`): una sola
 * sesión viva por match; `startsAt` entre ahora + 5 min y ahora + 30 días; solo
 * la otra persona responde a una propuesta; cualquiera cancela antes de empezar;
 * `join` solo en la ventana de entrada, e idempotente.
 *
 * Errores: `SessionConflictError`, `SessionExpiredError`, `SessionWindowError`,
 * `SessionForbiddenError` (ver `src/data/session-errors.ts`).
 */
export interface LockInSessionRepository {
  /** La sesión viva del match, o `null`. También `null` si el match no es tuyo. */
  getActive(matchId: string): Promise<LockInSession | null>;
  /** `null` si no existe o no es de un match tuyo. */
  getById(sessionId: string): Promise<LockInSession | null>;
  propose(input: SessionProposalInput): Promise<LockInSession>;
  respond(sessionId: string, answer: 'aceptada' | 'rechazada'): Promise<LockInSession>;
  cancel(sessionId: string): Promise<LockInSession>;
  /** Idempotente: si ya había asistencia conserva `joinedAt` y pone `leftAt = null`. */
  join(sessionId: string): Promise<SessionAttendance>;
  leave(sessionId: string): Promise<SessionAttendance>;
  listAttendance(sessionId: string): Promise<SessionAttendance[]>;
  /** Hora del servidor en ISO, para corregir el reloj del dispositivo. */
  serverNow(): Promise<string>;
  /** Se notifica en cualquier cambio de sesiones o asistencia de ese match. */
  subscribe(matchId: string, listener: () => void): Unsubscribe;
}
```

En `Repositories`, después de `messages: MessageRepository;`, añadir `sessions: LockInSessionRepository;`.

- [ ] **Step 2: Escribir los casos de contrato**

En `src/data/repositories.contract.ts`, sustituir los imports por:

```ts
import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from './session-errors';
import { buildProfileInput } from './test-fixtures';

import type { LockInSessionRepository, Repositories } from './repositories';
import type { ProfileInput } from './types';
```

En `ContractFixture`, después de `unknownProfileId: string;`:

```ts
  /**
   * Sesiones actuando como `reciprocalAId`: la otra persona del match que crean
   * los casos de sesiones. Aceptar una propuesta solo lo puede hacer quien no la hizo.
   */
  counterpartSessions(): LockInSessionRepository;
  /** Sesiones actuando como `reciprocalBId`, que no está en ese match. */
  outsiderSessions(): LockInSessionRepository;
  /**
   * Deja pasar `ms` milisegundos. En el mock mueve el reloj simulado; en un backend
   * real espera de verdad, así que fuera de `canTimeTravel` solo se usa con segundos.
   */
  elapse(ms: number): Promise<void>;
```

En `ContractBackend`, después de `name: string;`:

```ts
  /**
   * `true` si `elapse` puede saltar minutos sin esperarlos. Los casos que hacen
   * caducar una propuesta o terminar una sesión solo corren así; contra Supabase
   * esa lógica la cubre `session_is_live()` en `supabase/schema-embedded.test.mjs`.
   */
  canTimeTravel: boolean;
```

Dentro de `describeRepositoryContract`, después del `describe('session', …)` y antes del cierre del `describe` exterior:

```ts
    describe('sessions', () => {
      const MINUTE = 60_000;
      /** Casos que saltan minutos: solo en backends con reloj simulado. */
      const itWithTimeTravel = backend.canTimeTravel ? it : it.skip;

      let matchId: string;
      let mine: LockInSessionRepository;
      let theirs: LockInSessionRepository;

      beforeEach(async () => {
        await fixture.prepareSwiper();
        const { match } = await repositories.discovery.recordDecision(
          fixture.reciprocalAId,
          'like'
        );
        matchId = match!.id;
        mine = repositories.sessions;
        theirs = fixture.counterpartSessions();
      });

      /** Hora relativa al reloj del servidor, no al del proceso de tests. */
      async function startsIn(ms: number): Promise<string> {
        return new Date(Date.parse(await mine.serverNow()) + ms).toISOString();
      }
      /** Justo por encima del margen mínimo: la ventana de entrada abre a los 2 s. */
      const soon = () => startsIn(5 * MINUTE + 2_000);
      const later = () => startsIn(60 * MINUTE);

      /** Reintenta hasta que pase o se acabe el plazo: realtime llega con retraso. */
      async function eventually(check: () => void, timeoutMs = 10_000): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          try {
            check();
            return;
          } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      it('sin sesión, getActive devuelve null', async () => {
        expect(await mine.getActive(matchId)).toBeNull();
      });

      it('proponer crea una propuesta que ven las dos personas', async () => {
        const startsAt = await later();

        const session = await mine.propose({ matchId, startsAt, blocks: 2 });

        expect(session).toMatchObject({
          matchId,
          proposedBy: fixture.currentUserId,
          blocks: 2,
          status: 'propuesta',
          respondedAt: null,
        });
        expect(Date.parse(session.startsAt)).toBe(Date.parse(startsAt));
        expect((await theirs.getActive(matchId))?.id).toBe(session.id);
      });

      it('rechaza una hora con menos de 5 minutos de margen o a más de 30 días', async () => {
        await expect(
          mine.propose({ matchId, startsAt: await startsIn(4 * MINUTE), blocks: 1 })
        ).rejects.toBeInstanceOf(SessionWindowError);
        await expect(
          mine.propose({ matchId, startsAt: await startsIn(31 * 24 * 60 * MINUTE), blocks: 1 })
        ).rejects.toBeInstanceOf(SessionWindowError);
      });

      it('solo puede haber una sesión viva por match, la proponga quien la proponga', async () => {
        await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        await expect(
          mine.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).rejects.toBeInstanceOf(SessionConflictError);
        await expect(
          theirs.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).rejects.toBeInstanceOf(SessionConflictError);
      });

      it('quien propone no puede responder a su propia propuesta', async () => {
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        await expect(mine.respond(session.id, 'aceptada')).rejects.toBeInstanceOf(
          SessionForbiddenError
        );
      });

      it('la otra persona acepta, y responder dos veces choca', async () => {
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        const accepted = await theirs.respond(session.id, 'aceptada');

        expect(accepted.status).toBe('aceptada');
        expect(accepted.respondedAt).not.toBeNull();
        expect((await mine.getActive(matchId))?.status).toBe('aceptada');
        await expect(theirs.respond(session.id, 'rechazada')).rejects.toBeInstanceOf(
          SessionConflictError
        );
      });

      it('rechazar libera el match para otra propuesta', async () => {
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        await theirs.respond(session.id, 'rechazada');

        expect(await mine.getActive(matchId)).toBeNull();
        await expect(
          mine.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).resolves.toMatchObject({ status: 'propuesta' });
      });

      it('cualquiera de los dos cancela antes de empezar', async () => {
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        const cancelled = await theirs.cancel(session.id);

        expect(cancelled.status).toBe('cancelada');
        expect(await mine.getActive(matchId)).toBeNull();
        await expect(mine.cancel(session.id)).rejects.toBeInstanceOf(SessionConflictError);
      });

      it('alguien de fuera del match no ve ni toca sus sesiones', async () => {
        const outsider = fixture.outsiderSessions();
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        expect(await outsider.getById(session.id)).toBeNull();
        expect(await outsider.getActive(matchId)).toBeNull();
        expect(await outsider.listAttendance(session.id)).toEqual([]);
        await expect(outsider.respond(session.id, 'aceptada')).rejects.toBeInstanceOf(
          SessionForbiddenError
        );
        await expect(
          outsider.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).rejects.toBeInstanceOf(SessionForbiddenError);
      });

      it('no se entra a una propuesta sin aceptar', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await fixture.elapse(3_000);

        await expect(mine.join(session.id)).rejects.toBeInstanceOf(SessionWindowError);
      });

      it('no se entra antes de que abra la ventana', async () => {
        const session = await mine.propose({ matchId, startsAt: await later(), blocks: 1 });
        await theirs.respond(session.id, 'aceptada');

        await expect(mine.join(session.id)).rejects.toBeInstanceOf(SessionWindowError);
      });

      it('entrar es idempotente y volver tras salir borra la salida', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await theirs.respond(session.id, 'aceptada');
        await fixture.elapse(3_000);

        const first = await mine.join(session.id);
        const again = await mine.join(session.id);
        const left = await mine.leave(session.id);
        const back = await mine.join(session.id);

        expect(first).toMatchObject({ profileId: fixture.currentUserId, leftAt: null });
        expect(Date.parse(again.joinedAt)).toBe(Date.parse(first.joinedAt));
        expect(left.leftAt).not.toBeNull();
        expect(back.leftAt).toBeNull();
        expect(await mine.listAttendance(session.id)).toHaveLength(1);
        expect(await theirs.listAttendance(session.id)).toHaveLength(1);
      });

      it('salir sin haber entrado es un error de ventana', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await theirs.respond(session.id, 'aceptada');
        await fixture.elapse(3_000);

        await expect(mine.leave(session.id)).rejects.toBeInstanceOf(SessionWindowError);
      });

      it('avisa a las dos personas de un cambio en la sesión', async () => {
        const mineListener = jest.fn();
        const theirsListener = jest.fn();
        const unsubscribeMine = mine.subscribe(matchId, mineListener);
        const unsubscribeTheirs = theirs.subscribe(matchId, theirsListener);

        await mine.propose({ matchId, startsAt: await later(), blocks: 1 });

        await eventually(() => {
          expect(mineListener).toHaveBeenCalled();
          expect(theirsListener).toHaveBeenCalled();
        });
        unsubscribeMine();
        unsubscribeTheirs();
      });

      itWithTimeTravel('una propuesta caducada ya no está viva ni se puede aceptar', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await fixture.elapse(6 * MINUTE);

        expect(await mine.getActive(matchId)).toBeNull();
        await expect(theirs.respond(session.id, 'aceptada')).rejects.toBeInstanceOf(
          SessionExpiredError
        );
        await expect(
          mine.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).resolves.toMatchObject({ status: 'propuesta' });
      });

      itWithTimeTravel('una sesión aceptada termina sola y deja proponer otra', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await theirs.respond(session.id, 'aceptada');
        await fixture.elapse(36 * MINUTE);

        expect(await mine.getActive(matchId)).toBeNull();
        await expect(mine.join(session.id)).rejects.toBeInstanceOf(SessionWindowError);
        await expect(
          mine.propose({ matchId, startsAt: await later(), blocks: 1 })
        ).resolves.toMatchObject({ status: 'propuesta' });
      });

      itWithTimeTravel('una sesión empezada no se cancela: se sale', async () => {
        const session = await mine.propose({ matchId, startsAt: await soon(), blocks: 1 });
        await theirs.respond(session.id, 'aceptada');
        await fixture.elapse(6 * MINUTE);

        await expect(mine.cancel(session.id)).rejects.toBeInstanceOf(SessionExpiredError);
      });
    });
```

- [ ] **Step 3: Ver que no compila**

Run: `npx tsc --noEmit`
Expected: errores `Property 'sessions' is missing` en los dos backends, y `canTimeTravel`, `counterpartSessions`, `outsiderSessions`, `elapse` ausentes en los dos arneses.

- [ ] **Step 4: Estado y reloj del mock**

En `src/data/mock/store.ts`, sustituir el import de tipos por:

```ts
import type {
  Decision,
  LockInSession,
  Match,
  Message,
  ModePreference,
  Profile,
  Session,
  SessionAttendance,
} from '../types';
```

En `MockState`, después de `messages: Message[];` añadir `lockInSessions: LockInSession[];` y `attendance: SessionAttendance[];`. En `initialState()`, después de `messages: [],` añadir `lockInSessions: [],` y `attendance: [],`.

Sustituir el bloque de `resetState` por:

```ts
/**
 * Reloj de las sesiones del mock. Solo lo usan las sesiones; el resto del mock
 * sigue con `nowIso()`. Existe para que la suite de contrato pueda hacer caducar
 * una propuesta o terminar una sesión sin esperar media hora.
 */
let clockOffsetMs = 0;

export function mockNowMs(): number {
  return Date.now() + clockOffsetMs;
}

/** Adelanta el reloj de las sesiones. Solo para tests. */
export function advanceMockClock(ms: number): void {
  clockOffsetMs += ms;
}

/** Vuelve al estado semilla. Pensado para tests — no lo llames desde una pantalla. */
export function resetState(): void {
  state = initialState();
  clockOffsetMs = 0;
  notifyAll();
}
```

- [ ] **Step 5: Repositorio mock**

`src/data/mock/sessions.ts`:

```ts
/**
 * Sesiones Lock-In del backend mock.
 *
 * A diferencia del resto del mock, se construye para un actor: la suite de
 * contrato necesita a la otra persona del match aceptando una propuesta, y en
 * memoria no hay sesiones de verdad que abrir. La app usa siempre
 * `CURRENT_USER_ID`; los tests crean también el repositorio del otro lado.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import { isInJoinWindow, isSessionBlocks, isSessionLive, isValidStartsAt } from '../sessions';
import { createId, getState, mockNowMs, notify, subscribeTo } from './store';

import type { LockInSessionRepository } from '../repositories';
import type { LockInSession, SessionAttendance } from '../types';

export const sessionsTopic = (matchId: string) => `sessions:${matchId}`;

const iso = (ms: number) => new Date(ms).toISOString();

function membersOf(matchId: string): readonly string[] {
  return getState().matches.find((match) => match.id === matchId)?.profileIds ?? [];
}

export function createMockSessionRepository(actorId: string): LockInSessionRepository {
  const isMember = (matchId: string) => membersOf(matchId).includes(actorId);

  /** La sesión si existe y es de un match del actor; si no, como si no existiera. */
  const visible = (sessionId: string): LockInSession | null =>
    getState().lockInSessions.find(
      (session) => session.id === sessionId && isMember(session.matchId)
    ) ?? null;

  const mustSee = (sessionId: string): LockInSession => {
    const session = visible(sessionId);
    if (!session) throw new SessionForbiddenError('La sesión no existe o no es de tus matches');
    return session;
  };

  /** Avisa a los suscriptores del match y devuelve una copia, nunca el objeto del estado. */
  const changed = <T extends object>(matchId: string, value: T): T => {
    notify(sessionsTopic(matchId));
    return { ...value };
  };

  return {
    async getActive(matchId) {
      if (!isMember(matchId)) return null;
      const now = mockNowMs();
      const live = getState().lockInSessions.find(
        (session) => session.matchId === matchId && isSessionLive(session, now)
      );
      return live ? { ...live } : null;
    },

    async getById(sessionId) {
      const session = visible(sessionId);
      return session ? { ...session } : null;
    },

    async propose({ matchId, startsAt, blocks }) {
      if (!isMember(matchId)) throw new SessionForbiddenError('El match no es tuyo');
      const now = mockNowMs();
      const startsAtMs = Date.parse(startsAt);
      if (!isSessionBlocks(blocks) || !isValidStartsAt(startsAtMs, now)) {
        throw new SessionWindowError('Hora o duración fuera de rango');
      }
      const state = getState();
      if (state.lockInSessions.some((s) => s.matchId === matchId && isSessionLive(s, now))) {
        throw new SessionConflictError('Ya hay una sesión viva en este match');
      }
      const session: LockInSession = {
        id: createId('session'),
        matchId,
        proposedBy: actorId,
        startsAt: iso(startsAtMs),
        blocks,
        status: 'propuesta',
        createdAt: iso(now),
        respondedAt: null,
      };
      state.lockInSessions.push(session);
      return changed(matchId, session);
    },

    async respond(sessionId, answer) {
      const session = mustSee(sessionId);
      if (session.proposedBy === actorId) {
        throw new SessionForbiddenError('No puedes responder a tu propia propuesta');
      }
      if (session.status !== 'propuesta') throw new SessionConflictError('Ya se respondió');
      const now = mockNowMs();
      if (now >= Date.parse(session.startsAt)) throw new SessionExpiredError('La propuesta caducó');
      Object.assign(session, { status: answer, respondedAt: iso(now) });
      return changed(session.matchId, session);
    },

    async cancel(sessionId) {
      const session = mustSee(sessionId);
      if (session.status !== 'propuesta' && session.status !== 'aceptada') {
        throw new SessionConflictError('La sesión ya no se puede cancelar');
      }
      const now = mockNowMs();
      if (now >= Date.parse(session.startsAt)) throw new SessionExpiredError('Ya ha empezado');
      Object.assign(session, { status: 'cancelada', respondedAt: iso(now) });
      return changed(session.matchId, session);
    },

    async join(sessionId) {
      const session = mustSee(sessionId);
      const now = mockNowMs();
      if (!isInJoinWindow(session, now)) {
        throw new SessionWindowError('Fuera de la ventana de entrada');
      }
      const attendance = getState().attendance;
      const existing = attendance.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      if (existing) {
        existing.leftAt = null;
        return changed(session.matchId, existing);
      }
      const row: SessionAttendance = {
        sessionId,
        profileId: actorId,
        joinedAt: iso(now),
        leftAt: null,
      };
      attendance.push(row);
      return changed(session.matchId, row);
    },

    async leave(sessionId) {
      const session = mustSee(sessionId);
      const existing = getState().attendance.find(
        (row) => row.sessionId === sessionId && row.profileId === actorId
      );
      if (!existing) throw new SessionWindowError('No habías entrado en la sesión');
      existing.leftAt = iso(mockNowMs());
      return changed(session.matchId, existing);
    },

    async listAttendance(sessionId) {
      if (!visible(sessionId)) return [];
      return getState()
        .attendance.filter((row) => row.sessionId === sessionId)
        .map((row) => ({ ...row }));
    },

    async serverNow() {
      return iso(mockNowMs());
    },

    subscribe(matchId, listener) {
      return subscribeTo(sessionsTopic(matchId), listener);
    },
  };
}
```

En `src/data/mock/index.ts`:
- Después del import de `./store`, añadir `import { createMockSessionRepository } from './sessions';`.
- Sustituir `export { CURRENT_USER_ID, resetState } from './store';` por:

```ts
export { advanceMockClock, CURRENT_USER_ID, mockNowMs, resetState } from './store';
export { createMockSessionRepository, sessionsTopic } from './sessions';
```

- Sustituir `createMockRepositories` por:

```ts
export function createMockRepositories(): Repositories {
  return {
    session,
    profiles,
    discovery,
    matches,
    messages,
    sessions: createMockSessionRepository(CURRENT_USER_ID),
  };
}
```

- [ ] **Step 6: Arnés del mock**

En `src/data/mock/index.test.ts`, sustituir el import de `./index` por:

```ts
import {
  advanceMockClock,
  createMockRepositories,
  createMockSessionRepository,
  CURRENT_USER_ID,
  resetState,
} from './index';
```

En `mockBackend`, después de `name: 'mock',` añadir `canTimeTravel: true,`. Dentro del objeto que devuelve `reset()`, después de `unknownProfileId: 'no-existe',`:

```ts
      counterpartSessions: () => createMockSessionRepository(RECIPROCAL_NURIA),
      // Alba es recíproca, pero los casos de sesiones solo dan like a Núria:
      // no comparte match con el usuario del test.
      outsiderSessions: () => createMockSessionRepository(RECIPROCAL_ALBA),
      async elapse(ms) {
        advanceMockClock(ms);
      },
```

- [ ] **Step 7: Piezas provisionales en Supabase**

En `src/data/supabase/index.ts`, añadir `LockInSessionRepository` al import de tipos de `../repositories` y, antes de `createSupabaseRepositories`:

```ts
/**
 * PROVISIONAL — lo sustituye la Tarea 4 de
 * `docs/superpowers/plans/2026-09-13-sesiones-lockin.md` por
 * `createSupabaseSessionRepository()`. Existe solo para que `Repositories`
 * compile mientras tanto; ninguna pantalla usa sesiones todavía.
 */
const pendingSessions = new Proxy({} as LockInSessionRepository, {
  get() {
    throw new Error('Sesiones en Supabase: pendiente de la Tarea 4 del plan de sesiones');
  },
});
```

y en el objeto de `createSupabaseRepositories`, añadir `sessions: pendingSessions`.

En `src/data/supabase/contract.test.ts`, en `supabaseBackend` después de `name: 'supabase',` añadir `canTimeTravel: false,`. Dentro del objeto de `reset()`, después de `unknownProfileId: UNKNOWN_ID,`:

```ts
      // PROVISIONAL: los implementa la Tarea 4 del plan de sesiones.
      counterpartSessions() {
        throw new Error('Pendiente de la Tarea 4 del plan de sesiones');
      },
      outsiderSessions() {
        throw new Error('Pendiente de la Tarea 4 del plan de sesiones');
      },
      elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
```

- [ ] **Step 8: Ejecutar el contrato contra el mock**

Run: `npx jest src/data/mock/index.test.ts`
Expected: PASS, con los 17 casos nuevos de `sessions` en verde y ninguno saltado.

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Suite completa, lint y commit**

Run: `npm test -- --coverage` y `npm run lint`
Expected: todo en verde; cobertura por encima del suelo.

Marcar la Tarea 2 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/data/repositories.ts src/data/mock/store.ts src/data/mock/sessions.ts src/data/mock/index.ts src/data/repositories.contract.ts src/data/mock/index.test.ts src/data/supabase/index.ts src/data/supabase/contract.test.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): contrato de LockInSessionRepository y mock"
```

---

### Task 3: Migración SQL de sesiones y comprobación en PGlite

**Files:**
- Create: `supabase/migrations/20260913000100_lockin_sessions.sql`
- Modify: `supabase/schema-embedded.test.mjs`
- Modify: `supabase/README.md` (fila de la tabla de migraciones)

**Interfaces:**
- Consumes: `public.matches`, `public.profiles`, `public.is_match_member(uuid)` de las migraciones existentes.
- Produces (lo consume la Tarea 4 por PostgREST):
  - Enum `public.session_status`: `propuesta`, `aceptada`, `rechazada`, `cancelada`.
  - Tablas `public.lockin_sessions(id, match_id, proposed_by, starts_at, blocks, status, created_at, responded_at)` y `public.session_attendance(session_id, profile_id, joined_at, left_at)`.
  - `session_ends_at(timestamptz, smallint) → timestamptz` y `session_is_live(session_status, timestamptz, smallint, timestamptz) → boolean`, inmutables.
  - RPCs: `propose_session(p_match_id uuid, p_starts_at timestamptz, p_blocks smallint) → lockin_sessions`; `respond_session(p_session_id uuid, p_answer session_status) → lockin_sessions`; `cancel_session(p_session_id uuid) → lockin_sessions`; `join_session(p_session_id uuid) → session_attendance`; `leave_session(p_session_id uuid) → session_attendance`; `server_now() → timestamptz`.
  - Errores: `LI001` conflicto, `LI002` caducada, `LI003` ventana, `LI004` prohibido; `28000` sin sesión; `22023` respuesta inválida.

- [ ] **Step 1: Escribir la comprobación embebida que falla**

En `supabase/schema-embedded.test.mjs`:

Sustituir el bucle de migraciones y el `console.log` de "SQL ejecutado" por:

```js
      const migrations = readdirSync(join(here, 'migrations'))
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const file of migrations) {
        await db.exec(readFileSync(join(here, 'migrations', file), 'utf8'));
      }
```

y, justo después de `const expected = await fingerprint();`:

```js
      console.log(
        `SQL ejecutado: ${migrations.length} migraciones; ${expected.split('\n')[0]}; ${expected.trimEnd().split('\n').length - 1} objetos`
      );
      assert.match(expected, /table\s+lockin_sessions rls=true/);
      assert.match(expected, /table\s+session_attendance rls=true/);
      // Las reglas de "sesión viva" en SQL, contra la misma tabla de verdad que
      // `src/data/sessions.test.ts`. Es la única cobertura de estos bordes contra
      // Postgres: la suite de contrato de Supabase no puede esperar 30 minutos.
      const live = await db.query(`select
        public.session_is_live('propuesta', now() + interval '1 minute', 1::smallint, now()) as propuesta_futura,
        public.session_is_live('propuesta', now(), 1::smallint, now()) as propuesta_en_su_hora,
        public.session_is_live('aceptada', now() - interval '29 minutes', 1::smallint, now()) as aceptada_en_curso,
        public.session_is_live('aceptada', now() - interval '30 minutes', 1::smallint, now()) as aceptada_terminada,
        public.session_is_live('aceptada', now() - interval '100 minutes', 4::smallint, now()) as cuatro_bloques_en_curso,
        public.session_is_live('cancelada', now() + interval '1 hour', 1::smallint, now()) as cancelada,
        public.session_is_live('rechazada', now() + interval '1 hour', 1::smallint, now()) as rechazada`);
      assert.deepEqual(live.rows[0], {
        propuesta_futura: true,
        propuesta_en_su_hora: false,
        aceptada_en_curso: true,
        aceptada_terminada: false,
        cuatro_bloques_en_curso: true,
        cancelada: false,
        rechazada: false,
      });
```

(Borrar el `console.log` antiguo con "7 migraciones": queda solo el nuevo.)

- [ ] **Step 2: Ejecutarla y ver que falla**

Run (PowerShell): `$env:PGLITE_MODULE="$env:TEMP\lockin-schema-validation\node_modules\@electric-sql\pglite\dist\index.js"; node --test supabase/schema-embedded.test.mjs`
Expected: FAIL en `assert.match(expected, /table\s+lockin_sessions rls=true/)`.

Si `%TEMP%\lockin-schema-validation` no existe, instalar PGlite fuera del repo: `npm install --prefix "$env:TEMP\lockin-schema-validation" @electric-sql/pglite@0.3.14`.

- [ ] **Step 3: Escribir la migración**

`supabase/migrations/20260913000100_lockin_sessions.sql`:

```sql
-- LockIn — sesiones Lock-In (Fase 2).
--
-- Diseño: docs/superpowers/specs/2026-09-13-sesiones-lockin-design.md.
-- Espejo de `src/data/sessions.ts`: si cambia una regla de tiempo aquí, cambia
-- allí, y al revés.
--
-- Nadie escribe estas tablas directamente: no hay políticas de insert, update
-- ni delete. Todo pasa por los RPCs SECURITY DEFINER de abajo, que validan las
-- reglas con la fila bloqueada. Es el mismo patrón que `record_decision()`.

create type public.session_status as enum ('propuesta', 'aceptada', 'rechazada', 'cancelada');

create table public.lockin_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  blocks smallint not null,
  status public.session_status not null default 'propuesta',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint lockin_sessions_blocks_valid check (blocks in (1, 2, 4)),
  -- Una propuesta no tiene respuesta; cualquier otro estado sí.
  constraint lockin_sessions_responded_iff_not_proposal
    check ((status = 'propuesta') = (responded_at is null))
);

comment on table public.lockin_sessions is
  'Sesiones Lock-In entre las dos personas de un match. Estados derivados (caducada, en curso, terminada) salen de starts_at y blocks, no se guardan.';

create index lockin_sessions_match_idx on public.lockin_sessions (match_id, created_at desc);

create table public.session_attendance (
  session_id uuid not null references public.lockin_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- NULL = no salió de forma explícita. Solo un left_at anterior al final es abandono.
  left_at timestamptz,
  primary key (session_id, profile_id)
);


-- ---------------------------------------------------------------------------
-- Reglas de tiempo
-- ---------------------------------------------------------------------------

create or replace function public.session_ends_at(p_starts_at timestamptz, p_blocks smallint)
returns timestamptz
language sql
immutable
set search_path = ''
as $fn$
  select p_starts_at + make_interval(mins => 30 * p_blocks);
$fn$;

-- Viva: propuesta antes de su hora, o aceptada antes de terminar. `p_now` es
-- parámetro y no `now()` para que la función sea inmutable y comprobable.
create or replace function public.session_is_live(
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
  select case p_status
    when 'propuesta' then p_now < p_starts_at
    when 'aceptada' then p_now < public.session_ends_at(p_starts_at, p_blocks)
    else false
  end;
$fn$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.lockin_sessions    enable row level security;
alter table public.session_attendance enable row level security;

revoke all on table public.lockin_sessions    from anon;
revoke all on table public.session_attendance from anon;

create policy "lockin_sessions: lees las de tus matches"
  on public.lockin_sessions for select
  to authenticated
  using (public.is_match_member(match_id));

create policy "session_attendance: lees la de sesiones de tus matches"
  on public.session_attendance for select
  to authenticated
  using (
    exists (
      select 1
      from public.lockin_sessions s
      where s.id = session_id
        and public.is_match_member(s.match_id)
    )
  );


-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
--
-- Todas sacan al actor de `auth.uid()`. La pertenencia al match se comprueba
-- contra `matches` directamente: son SECURITY DEFINER y RLS no aplica aquí.

create or replace function public.propose_session(
  p_match_id uuid,
  p_starts_at timestamptz,
  p_blocks smallint
)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_match public.matches;
  v_session public.lockin_sessions;
begin
  if v_actor is null then
    raise exception 'propose_session: no hay sesión autenticada' using errcode = '28000';
  end if;

  -- Bloquear el match serializa las propuestas simultáneas de las dos personas:
  -- la segunda espera aquí y luego ve la sesión viva de la primera. Un índice
  -- único no sirve porque "viva" depende de now().
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_actor not in (v_match.profile_a, v_match.profile_b) then
    raise exception 'propose_session: el match no es tuyo' using errcode = 'LI004';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < now() + interval '5 minutes'
     or p_starts_at > now() + interval '30 days' then
    raise exception 'propose_session: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  if exists (
    select 1 from public.lockin_sessions s
    where s.match_id = p_match_id
      and public.session_is_live(s.status, s.starts_at, s.blocks, now())
  ) then
    raise exception 'propose_session: ya hay una sesión viva en este match' using errcode = 'LI001';
  end if;

  insert into public.lockin_sessions (match_id, proposed_by, starts_at, blocks)
  values (p_match_id, v_actor, p_starts_at, p_blocks)
  returning * into v_session;

  return v_session;
end;
$fn$;

-- Carga la sesión bloqueada y exige que el actor sea del match. Uso interno.
create or replace function public.lock_member_session(p_session_id uuid)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_session public.lockin_sessions;
begin
  if v_actor is null then
    raise exception 'sesión Lock-In: no hay sesión autenticada' using errcode = '28000';
  end if;

  select * into v_session from public.lockin_sessions where id = p_session_id for update;
  if not found or not exists (
    select 1 from public.matches m
    where m.id = v_session.match_id and v_actor in (m.profile_a, m.profile_b)
  ) then
    raise exception 'sesión Lock-In: no existe o no es de tus matches' using errcode = 'LI004';
  end if;

  return v_session;
end;
$fn$;

create or replace function public.respond_session(
  p_session_id uuid,
  p_answer public.session_status
)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
begin
  if p_answer is null or p_answer not in ('aceptada', 'rechazada') then
    raise exception 'respond_session: la respuesta es aceptada o rechazada' using errcode = '22023';
  end if;
  if v_session.proposed_by = (select auth.uid()) then
    raise exception 'respond_session: no puedes responder a tu propia propuesta' using errcode = 'LI004';
  end if;
  if v_session.status <> 'propuesta' then
    raise exception 'respond_session: ya se respondió' using errcode = 'LI001';
  end if;
  if now() >= v_session.starts_at then
    raise exception 'respond_session: la propuesta caducó' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = p_answer, responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

create or replace function public.cancel_session(p_session_id uuid)
returns public.lockin_sessions
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
begin
  if v_session.status not in ('propuesta', 'aceptada') then
    raise exception 'cancel_session: ya no se puede cancelar' using errcode = 'LI001';
  end if;
  if now() >= v_session.starts_at then
    raise exception 'cancel_session: ya ha empezado' using errcode = 'LI002';
  end if;

  update public.lockin_sessions
     set status = 'cancelada', responded_at = now()
   where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$fn$;

create or replace function public.join_session(p_session_id uuid)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_row public.session_attendance;
begin
  if v_session.status <> 'aceptada'
     or now() < v_session.starts_at - interval '5 minutes'
     or now() >= public.session_ends_at(v_session.starts_at, v_session.blocks) then
    raise exception 'join_session: fuera de la ventana de entrada' using errcode = 'LI003';
  end if;

  insert into public.session_attendance (session_id, profile_id)
  values (p_session_id, (select auth.uid()))
  on conflict (session_id, profile_id) do update set left_at = null
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.leave_session(p_session_id uuid)
returns public.session_attendance
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_session public.lockin_sessions := public.lock_member_session(p_session_id);
  v_row public.session_attendance;
begin
  update public.session_attendance
     set left_at = now()
   where session_id = v_session.id
     and profile_id = (select auth.uid())
  returning * into v_row;

  if not found then
    raise exception 'leave_session: no habías entrado en la sesión' using errcode = 'LI003';
  end if;

  return v_row;
end;
$fn$;

create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $fn$
  select now();
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.session_ends_at(timestamptz, smallint) from public, anon;
revoke execute on function public.session_is_live(public.session_status, timestamptz, smallint, timestamptz) from public, anon;
revoke execute on function public.propose_session(uuid, timestamptz, smallint) from public, anon;
revoke execute on function public.lock_member_session(uuid) from public, anon, authenticated;
revoke execute on function public.respond_session(uuid, public.session_status) from public, anon;
revoke execute on function public.cancel_session(uuid) from public, anon;
revoke execute on function public.join_session(uuid) from public, anon;
revoke execute on function public.leave_session(uuid) from public, anon;
revoke execute on function public.server_now() from public, anon;

grant execute on function public.session_ends_at(timestamptz, smallint) to authenticated;
grant execute on function public.session_is_live(public.session_status, timestamptz, smallint, timestamptz) to authenticated;
grant execute on function public.propose_session(uuid, timestamptz, smallint) to authenticated;
grant execute on function public.respond_session(uuid, public.session_status) to authenticated;
grant execute on function public.cancel_session(uuid) to authenticated;
grant execute on function public.join_session(uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.server_now() to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime — sostiene `LockInSessionRepository.subscribe`
-- ---------------------------------------------------------------------------

alter table public.lockin_sessions    replica identity full;
alter table public.session_attendance replica identity full;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lockin_sessions;
    alter publication supabase_realtime add table public.session_attendance;
  end if;
end;
$do$;
```

Nota para quien revise: `lock_member_session` se llama desde las funciones DEFINER, que corren como su propietario, así que revocarla a `authenticated` no rompe nada y evita que se exponga por PostgREST. `drift-check.mjs` la sondeará con argumentos nulos y verá `42501`: eso lo marca como "authenticated no puede ejecutarla". Si ese aviso molesta, es informativo y no bloquea CI (`drift-check.mjs` no corre en Actions).

- [ ] **Step 4: Ejecutar la comprobación embebida**

Run (PowerShell): `$env:PGLITE_MODULE="$env:TEMP\lockin-schema-validation\node_modules\@electric-sql\pglite\dist\index.js"; node --test supabase/schema-compare.test.mjs supabase/schema-embedded.test.mjs`
Expected: `ℹ pass 9`, `ℹ fail 0`, y la línea `SQL ejecutado: 8 migraciones; …`.

- [ ] **Step 5: Documentar la migración**

En la tabla "Migraciones" de `supabase/README.md`, añadir la fila:

```markdown
| `20260913000100_lockin_sessions.sql` | Sesiones Lock-In: `lockin_sessions`, `session_attendance`, RLS de lectura, reglas de tiempo y RPCs `propose/respond/cancel/join/leave_session`, `server_now` |
```

- [ ] **Step 6: Commit y aviso de aplicación**

Marcar la Tarea 3 en `docs/plan/todo/sesiones.md`.

```bash
git add -- supabase/migrations/20260913000100_lockin_sessions.sql supabase/schema-embedded.test.mjs supabase/README.md docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): migración de sesiones Lock-In con RLS y RPCs"
```

**Después del push, el job remoto de `schema-drift.yml` saldrá en rojo** con las líneas `-` de todo lo nuevo: es deriva real hasta que la migración esté en `grrzmzktrhksbttpbblg`. Parar y pedir al usuario (casilla "Tarea 3b") que pegue en el SQL Editor el contenido de `supabase/migrations/20260913000100_lockin_sessions.sql` **copiado del archivo del repo** (LF). La Tarea 3b se cierra cuando un run de `schema-drift.yml` sale con los dos jobs en verde; enlazar ese run en `docs/plan/todo/sesiones.md`. Las tareas 4 a 9 pueden avanzar mientras tanto contra el mock.

---

### Task 4: Repositorio de sesiones en Supabase

**Files:**
- Modify: `src/data/supabase/database.types.ts`
- Create: `src/data/supabase/sessions.ts`
- Test: `src/data/supabase/sessions.test.ts`
- Modify: `src/data/supabase/index.ts` (borrar lo provisional de la Tarea 2)
- Modify: `src/data/supabase/contract.test.ts` (borrar lo provisional de la Tarea 2)

**Interfaces:**
- Consumes: RPCs y tablas de la Tarea 3; `LockInSessionRepository` y errores de las tareas 1-2; `getSupabaseClient`, `LockInSupabaseClient` de `./client`; `ensureUserId` de `./auth`.
- Produces: `SessionRow`, `SessionAttendanceRow` en `database.types.ts`; en `sessions.ts`: `toLockInSession(row: SessionRow): LockInSession`, `toSessionAttendance(row: SessionAttendanceRow): SessionAttendance`, `toSessionError(error: { code?: string; message: string }): unknown`, `interface SessionRepositoryDeps { getClient(): LockInSupabaseClient; getUserId(): Promise<string> }`, `createSupabaseSessionRepository(deps?: SessionRepositoryDeps): LockInSessionRepository`.

- [ ] **Step 1: Tipos de filas y funciones**

En `src/data/supabase/database.types.ts`, añadir `SessionBlocks` y `SessionStatus` al import de `../types`, y después de `MessageInsert`:

```ts
/** Fila de `public.lockin_sessions`. */
export type SessionRow = {
  id: string;
  match_id: string;
  proposed_by: string;
  starts_at: string;
  blocks: SessionBlocks;
  status: SessionStatus;
  created_at: string;
  responded_at: string | null;
};

/** Fila de `public.session_attendance`. */
export type SessionAttendanceRow = {
  session_id: string;
  profile_id: string;
  joined_at: string;
  left_at: string | null;
};
```

En `Database.public.Tables`, después de `messages`:

```ts
      // Sin escritura directa: todo pasa por los RPCs de la migración 20260913000100.
      lockin_sessions: {
        Row: SessionRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      session_attendance: {
        Row: SessionAttendanceRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
```

En `Functions`, después de `record_decision`:

```ts
      propose_session: {
        Args: { p_match_id: string; p_starts_at: string; p_blocks: SessionBlocks };
        Returns: SessionRow;
      };
      respond_session: {
        Args: { p_session_id: string; p_answer: 'aceptada' | 'rechazada' };
        Returns: SessionRow;
      };
      cancel_session: { Args: { p_session_id: string }; Returns: SessionRow };
      join_session: { Args: { p_session_id: string }; Returns: SessionAttendanceRow };
      leave_session: { Args: { p_session_id: string }; Returns: SessionAttendanceRow };
      /** `server_now()` → `timestamptz` serializado. */
      server_now: { Args: Record<string, never>; Returns: string };
```

Y en `Enums`, después de `decision: Decision;`, añadir `session_status: SessionStatus;`.

- [ ] **Step 2: Escribir los tests con un cliente falso**

`src/data/supabase/sessions.test.ts`:

```ts
/**
 * Mapeo, traducción de errores y orquestación del repositorio de sesiones de
 * Supabase, sin red: el cliente es un doble que registra las llamadas.
 *
 * El comportamiento contra Postgres real lo prueba la suite de contrato opt-in
 * (`contract.test.ts`); esto fija lo que esa suite no ve en `npm test`.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import {
  createSupabaseSessionRepository,
  toLockInSession,
  toSessionAttendance,
  toSessionError,
} from './sessions';

import type { LockInSupabaseClient } from './client';
import type { SessionRow } from './database.types';

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** Doble mínimo del cliente: `from()` encadenable y awaitable, `rpc()` y canales. */
function fakeClient(responses: { select?: Result; rpc?: Record<string, Result> } = {}) {
  const chain: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      chain.push(`${method}(${JSON.stringify(args)})`);
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(responses.select ?? { data: null, error: null });
  builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(responses.select ?? { data: [], error: null }).then(resolve, reject);

  const channel = { on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  const client = {
    from: jest.fn(() => builder),
    rpc: jest.fn(async (fn: string) => responses.rpc?.[fn] ?? { data: null, error: null }),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };

  const repository = createSupabaseSessionRepository({
    getClient: () => client as unknown as LockInSupabaseClient,
    getUserId: async () => 'user-a',
  });
  return { client, channel, chain, repository };
}

const MINUTE = 60_000;

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-1',
    match_id: 'match-1',
    proposed_by: 'user-a',
    starts_at: new Date(Date.now() + 60 * MINUTE).toISOString().replace('Z', '+00:00'),
    blocks: 2,
    status: 'propuesta',
    created_at: '2026-09-13T10:00:00+00:00',
    responded_at: null,
    ...overrides,
  };
}

describe('toLockInSession / toSessionAttendance', () => {
  it('traduce columnas y normaliza las fechas a ISO con Z', () => {
    const session = toLockInSession(row({ starts_at: '2026-09-14T18:00:00+00:00' }));

    expect(session).toEqual({
      id: 'session-1',
      matchId: 'match-1',
      proposedBy: 'user-a',
      startsAt: '2026-09-14T18:00:00.000Z',
      blocks: 2,
      status: 'propuesta',
      createdAt: '2026-09-13T10:00:00.000Z',
      respondedAt: null,
    });
  });

  it('conserva un left_at nulo como null', () => {
    expect(
      toSessionAttendance({
        session_id: 's',
        profile_id: 'p',
        joined_at: '2026-09-14T18:00:00+00:00',
        left_at: null,
      })
    ).toEqual({ sessionId: 's', profileId: 'p', joinedAt: '2026-09-14T18:00:00.000Z', leftAt: null });
  });
});

describe('toSessionError', () => {
  it.each([
    ['LI001', SessionConflictError],
    ['LI002', SessionExpiredError],
    ['LI003', SessionWindowError],
    ['LI004', SessionForbiddenError],
  ])('%s se traduce a su error de dominio', (code, ErrorClass) => {
    const translated = toSessionError({ code, message: 'detalle' });
    expect(translated).toBeInstanceOf(ErrorClass);
    expect((translated as Error).message).toBe('detalle');
  });

  it('cualquier otro código sale tal cual, sin disfrazarlo', () => {
    const original = { code: '28000', message: 'sin sesión' };
    expect(toSessionError(original)).toBe(original);
  });
});

describe('createSupabaseSessionRepository', () => {
  it('propose llama al RPC con sus argumentos y avisa a los suscriptores del match', async () => {
    const { client, repository } = fakeClient({
      rpc: { propose_session: { data: row(), error: null } },
    });
    const listener = jest.fn();
    repository.subscribe('match-1', listener);

    const session = await repository.propose({
      matchId: 'match-1',
      startsAt: '2026-09-14T18:00:00.000Z',
      blocks: 2,
    });

    expect(client.rpc).toHaveBeenCalledWith('propose_session', {
      p_match_id: 'match-1',
      p_starts_at: '2026-09-14T18:00:00.000Z',
      p_blocks: 2,
    });
    expect(session.status).toBe('propuesta');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('un error LI00x del RPC llega como error de dominio', async () => {
    const { repository } = fakeClient({
      rpc: { respond_session: { data: null, error: { code: 'LI001', message: 'ya' } } },
    });

    await expect(repository.respond('session-1', 'aceptada')).rejects.toBeInstanceOf(
      SessionConflictError
    );
  });

  it('getActive descarta lo que ya no está vivo y pide solo estados vivos', async () => {
    const expired = row({ id: 'old', starts_at: new Date(Date.now() - MINUTE).toISOString() });
    const live = row({ id: 'live' });
    const { chain, repository } = fakeClient({ select: { data: [expired, live], error: null } });

    const session = await repository.getActive('match-1');

    expect(session?.id).toBe('live');
    expect(chain).toContain('in(["status",["propuesta","aceptada"]])');
  });

  it('join avisa al match de la sesión aunque no se haya leído antes', async () => {
    const { repository } = fakeClient({
      select: { data: row(), error: null },
      rpc: {
        join_session: {
          data: { session_id: 'session-1', profile_id: 'user-a', joined_at: row().created_at, left_at: null },
          error: null,
        },
      },
    });
    const listener = jest.fn();
    repository.subscribe('match-1', listener);

    await repository.join('session-1');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('serverNow devuelve la hora del servidor en ISO', async () => {
    const { repository } = fakeClient({
      rpc: { server_now: { data: '2026-09-13T12:00:00.123+00:00', error: null } },
    });

    await expect(repository.serverNow()).resolves.toBe('2026-09-13T12:00:00.123Z');
  });

  it('abre un canal por match y lo cierra con el último suscriptor', async () => {
    const { client, repository } = fakeClient();

    const first = repository.subscribe('match-1', jest.fn());
    const second = repository.subscribe('match-1', jest.fn());
    expect(client.channel).toHaveBeenCalledTimes(1);

    first();
    expect(client.removeChannel).not.toHaveBeenCalled();
    second();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Ejecutarlo y ver que falla**

Run: `npx jest src/data/supabase/sessions.test.ts`
Expected: FAIL con `Cannot find module './sessions'`.

- [ ] **Step 4: Implementar el repositorio**

`src/data/supabase/sessions.ts`:

```ts
/**
 * Sesiones Lock-In contra Supabase.
 *
 * Toda escritura va por RPC (ver `supabase/migrations/20260913000100_lockin_sessions.sql`),
 * que valida las reglas con la fila bloqueada; aquí solo se traduce y se avisa.
 * Las dependencias se inyectan porque la suite de contrato necesita el mismo
 * repositorio actuando como otra persona, con su propio cliente.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import { isSessionLive } from '../sessions';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { SessionAttendanceRow, SessionRow } from './database.types';
import type { LockInSessionRepository, Unsubscribe } from '../repositories';
import type { LockInSession, SessionAttendance } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** PostgREST serializa `timestamptz` como `…+00:00`; el dominio usa ISO con `Z`. */
const toIso = (value: string) => new Date(value).toISOString();

export function toLockInSession(row: SessionRow): LockInSession {
  return {
    id: row.id,
    matchId: row.match_id,
    proposedBy: row.proposed_by,
    startsAt: toIso(row.starts_at),
    blocks: row.blocks,
    status: row.status,
    createdAt: toIso(row.created_at),
    respondedAt: row.responded_at === null ? null : toIso(row.responded_at),
  };
}

export function toSessionAttendance(row: SessionAttendanceRow): SessionAttendance {
  return {
    sessionId: row.session_id,
    profileId: row.profile_id,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at === null ? null : toIso(row.left_at),
  };
}

const DOMAIN_ERRORS: Record<string, new (message: string) => Error> = {
  LI001: SessionConflictError,
  LI002: SessionExpiredError,
  LI003: SessionWindowError,
  LI004: SessionForbiddenError,
};

/** `errcode` LI00x de los RPCs → error de dominio. Cualquier otro sale intacto. */
export function toSessionError(error: { code?: string; message: string }): unknown {
  const DomainError = error.code ? DOMAIN_ERRORS[error.code] : undefined;
  return DomainError ? new DomainError(error.message) : error;
}

export interface SessionRepositoryDeps {
  getClient(): LockInSupabaseClient;
  /** Abre sesión si hace falta y devuelve el id del usuario. */
  getUserId(): Promise<string>;
}

const defaultDeps: SessionRepositoryDeps = {
  getClient: getSupabaseClient,
  getUserId: ensureUserId,
};

export function createSupabaseSessionRepository(
  deps: SessionRepositoryDeps = defaultDeps
): LockInSessionRepository {
  const listeners = new Map<string, Set<() => void>>();
  const channels = new Map<string, RealtimeChannel>();
  /** `join`/`leave` devuelven asistencia, sin `matchId`: esto dice a quién avisar. */
  const matchOfSession = new Map<string, string>();

  const notify = (matchId: string) => listeners.get(matchId)?.forEach((listener) => listener());

  const remember = (session: LockInSession) => {
    matchOfSession.set(session.id, session.matchId);
    return session;
  };

  /** Escritura propia: se avisa al momento, sin esperar al eco de realtime. */
  const changed = (row: unknown) => {
    const session = remember(toLockInSession(row as SessionRow));
    notify(session.matchId);
    return session;
  };

  async function notifyForSession(sessionId: string) {
    const matchId = matchOfSession.get(sessionId) ?? (await repository.getById(sessionId))?.matchId;
    if (matchId) notify(matchId);
  }

  const repository: LockInSessionRepository = {
    async getActive(matchId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('lockin_sessions')
        .select('*')
        .eq('match_id', matchId)
        .in('status', ['propuesta', 'aceptada'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;

      // "Viva" depende de la hora, que no se puede filtrar en la consulta sin un
      // RPC más. Se usa el reloj del dispositivo: la pantalla de sesión corrige
      // el desfase con `serverNow()` donde de verdad importa.
      const now = Date.now();
      const live = (data as SessionRow[])
        .map(toLockInSession)
        .find((session) => isSessionLive(session, now));
      return live ? remember(live) : null;
    },

    async getById(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('lockin_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data ? remember(toLockInSession(data as SessionRow)) : null;
    },

    async propose({ matchId, startsAt, blocks }) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('propose_session', {
        p_match_id: matchId,
        p_starts_at: startsAt,
        p_blocks: blocks,
      });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async respond(sessionId, answer) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('respond_session', { p_session_id: sessionId, p_answer: answer });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async cancel(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('cancel_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      return changed(data);
    },

    async join(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('join_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      await notifyForSession(sessionId);
      return toSessionAttendance(data as SessionAttendanceRow);
    },

    async leave(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .rpc('leave_session', { p_session_id: sessionId });
      if (error) throw toSessionError(error);
      await notifyForSession(sessionId);
      return toSessionAttendance(data as SessionAttendanceRow);
    },

    async listAttendance(sessionId) {
      await deps.getUserId();
      const { data, error } = await deps
        .getClient()
        .from('session_attendance')
        .select('*')
        .eq('session_id', sessionId);
      if (error) throw error;
      return (data as SessionAttendanceRow[]).map(toSessionAttendance);
    },

    async serverNow() {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('server_now');
      if (error) throw error;
      return toIso(data as string);
    },

    subscribe(matchId, listener): Unsubscribe {
      const set = listeners.get(matchId) ?? new Set();
      set.add(listener);
      listeners.set(matchId, set);

      if (!channels.has(matchId)) {
        const channel = deps
          .getClient()
          .channel(`lockin:sessions:${matchId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'lockin_sessions', filter: `match_id=eq.${matchId}` },
            () => notify(matchId)
          )
          // La asistencia no lleva `match_id`: RLS ya limita el stream a sesiones
          // de tus matches, así que como mucho avisa de más, nunca de menos.
          .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendance' }, () =>
            notify(matchId)
          )
          .subscribe();
        channels.set(matchId, channel);
      }

      return () => {
        set.delete(listener);
        if (set.size > 0) return;
        listeners.delete(matchId);
        const channel = channels.get(matchId);
        channels.delete(matchId);
        if (channel) void deps.getClient().removeChannel(channel);
      };
    },
  };

  return repository;
}
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npx jest src/data/supabase/sessions.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Sustituir lo provisional**

En `src/data/supabase/index.ts`: borrar el bloque `pendingSessions` entero y `LockInSessionRepository` del import de tipos; añadir `import { createSupabaseSessionRepository } from './sessions';` después del import de `./mappers`; y en `createSupabaseRepositories` cambiar `sessions: pendingSessions` por `sessions: createSupabaseSessionRepository()`.

En `src/data/supabase/contract.test.ts`:

Añadir `LockInSessionRepository` al import de tipos de `../repositories`:

```ts
import type { LockInSessionRepository, Repositories } from '../repositories';
```

Antes de `const supabaseBackend`, añadir:

```ts
/**
 * Sesiones actuando como un usuario de apoyo, con su cliente y su sesión.
 *
 * Con `require` y no con `import` por lo mismo que `./index`: `sessions.ts`
 * importa `client.ts`, que lee las credenciales al cargarse, y a esta altura del
 * archivo todavía no están en `process.env`.
 */
function sessionRepositoryFor(actor: Reciprocal): LockInSessionRepository {
  const { createSupabaseSessionRepository } = require('./sessions') as typeof import('./sessions');
  return createSupabaseSessionRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}
```

En `reset()`, sustituir los dos métodos provisionales por:

```ts
      counterpartSessions: () => sessionRepositoryFor(parReciprocal),
      outsiderSessions: () => sessionRepositoryFor(lockinReciprocal),
```

(y quitar el comentario `// PROVISIONAL…`). En `teardown()`, dentro del último bucle, antes de `await reciprocal.client.auth.signOut();`, añadir:

```ts
      // Los repositorios de sesiones de la otra persona abren canales de realtime.
      await reciprocal.client.removeAllChannels();
```

- [ ] **Step 7: Verificación y commit**

Run: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run lint`
Expected: todo en verde; `grep -rn "pendingSessions\|Pendiente de la Tarea 4" src` sin resultados.

La pasada opt-in contra Supabase (`LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts`) solo tiene sentido con la Tarea 3b cerrada; queda para la Tarea 11.

Marcar la Tarea 4 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/data/supabase/database.types.ts src/data/supabase/sessions.ts src/data/supabase/sessions.test.ts src/data/supabase/index.ts src/data/supabase/contract.test.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): repositorio de sesiones contra Supabase"
```

---

### Task 5: Presencia "está aquí"

**Files:**
- Create: `src/data/presence.ts`
- Create: `src/data/supabase/presence.ts`
- Modify: `src/data/active.ts`
- Modify: `src/data/index.ts`
- Create: `src/features/session/use-counterpart-presence.ts`
- Test: `src/data/presence.test.ts`
- Test: `src/data/supabase/presence.test.ts`
- Test: `src/features/session/use-counterpart-presence.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/data/presence.ts
  export interface PresenceHandlers {
    onPeers(profileIds: string[]): void;
    onConnection(online: boolean): void;
  }
  export interface PresenceAdapter {
    join(sessionId: string, profileId: string, handlers: PresenceHandlers): () => void;
  }
  export function createMemoryPresenceAdapter(): PresenceAdapter;
  // src/data/supabase/presence.ts
  export function createSupabasePresenceAdapter(getClient?: () => LockInSupabaseClient): PresenceAdapter;
  // src/data/active.ts, reexportado desde @/data
  export const presence: PresenceAdapter;
  // src/features/session/use-counterpart-presence.ts
  export type CounterpartPresence = 'aqui' | 'ausente' | 'sin-conexion';
  export function useCounterpartPresence(
    sessionId: string | null,
    myProfileId: string | null,
    counterpartId: string | null,
    adapter?: PresenceAdapter
  ): CounterpartPresence;
  ```

La presencia queda fuera de `Repositories` a propósito (spec, sección 2): es efímera y no se guarda. `active.ts` la elige con la misma regla que los repositorios.

- [ ] **Step 1: Tests del adaptador en memoria**

`src/data/presence.test.ts`:

```ts
/** Adaptador de presencia en memoria: el del backend mock y el de los tests de pantalla. */

import { createMemoryPresenceAdapter } from './presence';

describe('createMemoryPresenceAdapter', () => {
  it('cada persona que entra ve a todas las que están en esa sesión', () => {
    const adapter = createMemoryPresenceAdapter();
    const a = { onPeers: jest.fn(), onConnection: jest.fn() };
    const b = { onPeers: jest.fn(), onConnection: jest.fn() };

    adapter.join('s1', 'ana', a);
    adapter.join('s1', 'bea', b);

    expect(a.onConnection).toHaveBeenCalledWith(true);
    expect(a.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
    expect(b.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });

  it('salir avisa al resto y no mezcla sesiones distintas', () => {
    const adapter = createMemoryPresenceAdapter();
    const a = { onPeers: jest.fn(), onConnection: jest.fn() };
    const other = { onPeers: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', a);
    const leave = adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });
    adapter.join('s2', 'carla', other);

    leave();

    expect(a.onPeers).toHaveBeenLastCalledWith(['ana']);
    expect(other.onPeers).toHaveBeenLastCalledWith(['carla']);
  });

  it('la misma persona con dos pantallas abiertas cuenta una vez y sigue tras cerrar una', () => {
    const adapter = createMemoryPresenceAdapter();
    const watcher = { onPeers: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', watcher);
    const first = adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });
    adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });

    first();

    expect(watcher.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });
});
```

- [ ] **Step 2: Tests del adaptador de Supabase**

`src/data/supabase/presence.test.ts`:

```ts
/** Adaptador de presencia sobre Realtime, con un canal falso: sin red. */

import { createSupabasePresenceAdapter } from './presence';

import type { LockInSupabaseClient } from './client';

function fakeRealtime() {
  let onSync: () => void = () => {};
  let onStatus: (status: string) => void = () => {};
  const state: Record<string, unknown[]> = {};
  const channel = {
    on: jest.fn((_type: string, _filter: unknown, callback: () => void) => {
      onSync = callback;
      return channel;
    }),
    subscribe: jest.fn((callback: (status: string) => void) => {
      onStatus = callback;
      return channel;
    }),
    presenceState: () => state,
    track: jest.fn(async () => 'ok'),
    untrack: jest.fn(async () => 'ok'),
  };
  const client = {
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };
  return {
    client: client as unknown as LockInSupabaseClient,
    rawClient: client,
    channel,
    state,
    sync: () => onSync(),
    status: (value: string) => onStatus(value),
  };
}

describe('createSupabasePresenceAdapter', () => {
  it('se anuncia con su perfil como clave al conectar y publica quién está', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabasePresenceAdapter(() => realtime.client);
    const handlers = { onPeers: jest.fn(), onConnection: jest.fn() };

    adapter.join('s1', 'ana', handlers);
    realtime.status('SUBSCRIBED');
    realtime.state.ana = [{}];
    realtime.state.bea = [{}];
    realtime.sync();

    expect(realtime.rawClient.channel).toHaveBeenCalledWith('lockin:presence:s1', {
      config: { presence: { key: 'ana' } },
    });
    expect(handlers.onConnection).toHaveBeenCalledWith(true);
    expect(realtime.channel.track).toHaveBeenCalledWith({ profileId: 'ana' });
    expect(handlers.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('%s se publica como sin conexión', (value) => {
    const realtime = fakeRealtime();
    const handlers = { onPeers: jest.fn(), onConnection: jest.fn() };
    createSupabasePresenceAdapter(() => realtime.client).join('s1', 'ana', handlers);

    realtime.status(value);

    expect(handlers.onConnection).toHaveBeenLastCalledWith(false);
  });

  it('salir deja de anunciarse y cierra el canal', () => {
    const realtime = fakeRealtime();
    const leave = createSupabasePresenceAdapter(() => realtime.client).join('s1', 'ana', {
      onPeers: jest.fn(),
      onConnection: jest.fn(),
    });

    leave();

    expect(realtime.channel.untrack).toHaveBeenCalled();
    expect(realtime.rawClient.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });
});
```

- [ ] **Step 3: Test del hook**

`src/features/session/use-counterpart-presence.test.ts`:

```ts
/** Qué estado de presencia ve una persona de la otra. Ojo: en RNTL 14 `renderHook` es asíncrono. */

import { act, renderHook } from '@testing-library/react-native';

import { createMemoryPresenceAdapter } from '@/data';

import { useCounterpartPresence } from './use-counterpart-presence';

import type { PresenceAdapter, PresenceHandlers } from '@/data';

describe('useCounterpartPresence', () => {
  it('pasa de ausente a aquí cuando la otra persona entra, y vuelve al salir', async () => {
    const adapter = createMemoryPresenceAdapter();
    const { result } = await renderHook(() => useCounterpartPresence('s1', 'me', 'nuria', adapter));
    expect(result.current).toBe('ausente');

    let leave: () => void = () => {};
    await act(async () => {
      leave = adapter.join('s1', 'nuria', { onPeers: () => {}, onConnection: () => {} });
    });
    expect(result.current).toBe('aqui');

    await act(async () => leave());
    expect(result.current).toBe('ausente');
  });

  it('sin conexión propia no afirma nada de la otra persona', async () => {
    let handlers: PresenceHandlers | null = null;
    const adapter: PresenceAdapter = {
      join: (_session, _profile, received) => {
        handlers = received;
        return () => {};
      },
    };
    const { result } = await renderHook(() => useCounterpartPresence('s1', 'me', 'nuria', adapter));

    await act(async () => {
      handlers!.onPeers(['me', 'nuria']);
      handlers!.onConnection(false);
    });

    expect(result.current).toBe('sin-conexion');
  });

  it('sin sesión o sin perfil propio no se une a ninguna sala', async () => {
    const adapter: PresenceAdapter = { join: jest.fn(() => () => {}) };

    await renderHook(() => useCounterpartPresence(null, 'me', 'nuria', adapter));
    await renderHook(() => useCounterpartPresence('s1', null, 'nuria', adapter));

    expect(adapter.join).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Ejecutarlos y ver que fallan**

Run: `npx jest src/data/presence.test.ts src/data/supabase/presence.test.ts src/features/session/use-counterpart-presence.test.ts`
Expected: FAIL por módulos inexistentes.

- [ ] **Step 5: Implementar**

`src/data/presence.ts`:

```ts
/**
 * Presencia en una sesión Lock-In: quién tiene la pantalla de sesión abierta.
 *
 * No es un repositorio: no se guarda nada y no tiene contrato de persistencia.
 * `src/data/active.ts` elige el adaptador con la misma regla que los repositorios.
 */

export interface PresenceHandlers {
  /** Ids de perfil presentes en la sala, sin repetir, incluido el propio. */
  onPeers(profileIds: string[]): void;
  /** Estado de la conexión propia con la sala. */
  onConnection(online: boolean): void;
}

export interface PresenceAdapter {
  /** Entra en la sala de la sesión como `profileId`. Devuelve la función para salir. */
  join(sessionId: string, profileId: string, handlers: PresenceHandlers): () => void;
}

/** Salas en memoria del proceso. Es la del backend mock y la de los tests. */
export function createMemoryPresenceAdapter(): PresenceAdapter {
  const rooms = new Map<string, Map<symbol, { profileId: string; handlers: PresenceHandlers }>>();

  const publish = (sessionId: string) => {
    const room = rooms.get(sessionId);
    if (!room) return;
    const ids = [...new Set([...room.values()].map((member) => member.profileId))];
    room.forEach((member) => member.handlers.onPeers(ids));
  };

  return {
    join(sessionId, profileId, handlers) {
      const room = rooms.get(sessionId) ?? new Map();
      const key = Symbol(profileId);
      room.set(key, { profileId, handlers });
      rooms.set(sessionId, room);
      handlers.onConnection(true);
      publish(sessionId);

      return () => {
        room.delete(key);
        if (room.size === 0) rooms.delete(sessionId);
        publish(sessionId);
      };
    },
  };
}
```

`src/data/supabase/presence.ts`:

```ts
/**
 * Presencia sobre Supabase Realtime Presence.
 *
 * Un canal por sesión; la clave de presencia es el id de perfil, así que dos
 * pantallas abiertas de la misma persona cuentan una vez.
 */

import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { PresenceAdapter } from '../presence';

export function createSupabasePresenceAdapter(
  getClient: () => LockInSupabaseClient = getSupabaseClient
): PresenceAdapter {
  return {
    join(sessionId, profileId, { onPeers, onConnection }) {
      const client = getClient();
      const channel = client.channel(`lockin:presence:${sessionId}`, {
        config: { presence: { key: profileId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => onPeers(Object.keys(channel.presenceState())))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            onConnection(true);
            void channel.track({ profileId });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection(false);
          }
        });

      return () => {
        void channel.untrack();
        void client.removeChannel(channel);
      };
    },
  };
}
```

En `src/data/active.ts`, sustituir los imports y el export por:

```ts
import { createMockRepositories } from './mock';
import { createMemoryPresenceAdapter } from './presence';
import { createSupabaseRepositories } from './supabase';
import { hasSupabaseCredentials } from './supabase/client';
import { createSupabasePresenceAdapter } from './supabase/presence';

import type { PresenceAdapter } from './presence';
import type { Repositories } from './repositories';

/** La implementación activa: Supabase si hay credenciales, mock si no. */
export const repositories: Repositories = hasSupabaseCredentials
  ? createSupabaseRepositories()
  : createMockRepositories();

/** Presencia en sesiones, con la misma regla. Sin credenciales, en memoria. */
export const presence: PresenceAdapter = hasSupabaseCredentials
  ? createSupabasePresenceAdapter()
  : createMemoryPresenceAdapter();
```

En `src/data/index.ts`, sustituir `export { repositories } from './active';` por:

```ts
export { presence, repositories } from './active';
export { createMemoryPresenceAdapter } from './presence';
export type { PresenceAdapter, PresenceHandlers } from './presence';
```

`src/features/session/use-counterpart-presence.ts`:

```ts
/**
 * Si la otra persona tiene abierta la pantalla de la sesión.
 *
 * Tres estados y no dos: sin conexión propia no se sabe nada de la otra
 * persona, y decir "aún no ha entrado" sería afirmar algo que no se ha visto.
 */

import { useEffect, useState } from 'react';

import { presence } from '@/data';

import type { PresenceAdapter } from '@/data';

export type CounterpartPresence = 'aqui' | 'ausente' | 'sin-conexion';

export function useCounterpartPresence(
  sessionId: string | null,
  myProfileId: string | null,
  counterpartId: string | null,
  adapter: PresenceAdapter = presence
): CounterpartPresence {
  const [peers, setPeers] = useState<string[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!sessionId || !myProfileId) return;
    return adapter.join(sessionId, myProfileId, { onPeers: setPeers, onConnection: setOnline });
  }, [adapter, sessionId, myProfileId]);

  if (!online) return 'sin-conexion';
  return counterpartId !== null && peers.includes(counterpartId) ? 'aqui' : 'ausente';
}
```

- [ ] **Step 6: Ejecutar los tests**

Run: `npx jest src/data/presence.test.ts src/data/supabase/presence.test.ts src/features/session/use-counterpart-presence.test.ts`
Expected: PASS, 11 tests.

Si `tsc` rechaza la firma de `channel.on('presence', …)` o de `subscribe((status) => …)` del `supabase-js` instalado, comprobarla en `node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.d.ts` (líneas ~348-376: `track`, `untrack` y los eventos `sync`/`join`/`leave`) y ajustar solo los tipos, no el comportamiento.

- [ ] **Step 7: Verificación y commit**

Run: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run lint`
Expected: todo en verde.

Marcar la Tarea 5 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/data/presence.ts src/data/supabase/presence.ts src/data/active.ts src/data/index.ts src/features/session/use-counterpart-presence.ts src/data/presence.test.ts src/data/supabase/presence.test.ts src/features/session/use-counterpart-presence.test.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): presencia en memoria y sobre Realtime"
```

---

### Task 6: Lógica pura de reloj, tramos y textos

**Files:**
- Create: `src/features/session/phase.ts`
- Create: `src/features/session/slots.ts`
- Create: `src/features/session/format.ts`
- Test: `src/features/session/phase.test.ts`
- Test: `src/features/session/slots.test.ts`
- Test: `src/features/session/format.test.ts`

**Interfaces:**
- Consumes: `BLOCK_MINUTES`, `WORK_MINUTES`, `MIN_LEAD_MINUTES`, tipos `SessionBlocks`, `Profile`, `TimeBand` de `@/data`.
- Produces:
  ```ts
  // phase.ts
  export type PhaseKind = 'antes' | 'trabajo' | 'descanso' | 'terminada';
  export interface Phase { kind: PhaseKind; block: number; remainingMs: number }
  export function phaseAt(startsAt: string, blocks: SessionBlocks, nowMs: number): Phase;
  export function formatCountdown(ms: number): string;
  // slots.ts
  export const SLOT_MINUTES = 15;
  export const PROPOSAL_DAYS = 7;
  export const BAND_START_HOUR: Record<TimeBand, number>;
  export const BAND_END_HOUR: Record<TimeBand, number>;
  export function startOfDayMs(ms: number): number;
  export function dayOptions(nowMs: number, days?: number): number[];
  export function slotsForDay(dayStartMs: number, nowMs: number): number[];
  export function sharedBands(me: Profile | null, other: Profile): TimeBand[];
  export function preselectSlot(me: Profile | null, other: Profile, nowMs: number): number;
  // format.ts
  export function formatTimeOfDay(ms: number): string;
  export function formatDayLabel(dayStartMs: number, nowMs: number): string;
  export function formatSessionWhen(startsAt: string, nowMs: number): string;
  export function formatStartsIn(ms: number): string;
  export function blocksLabel(blocks: number): string;
  ```

Todo en hora local del dispositivo: los tests construyen fechas con `new Date(año, mes, día, hora, minuto)` para no depender de la zona horaria de la máquina.

- [ ] **Step 1: Tests de `phaseAt` y `formatCountdown`**

`src/features/session/phase.test.ts`:

```ts
/** Fase del Pomodoro compartido en cada instante, con sus bordes al milisegundo. */

import { formatCountdown, phaseAt } from './phase';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');
const startsAt = new Date(START).toISOString();

describe('phaseAt', () => {
  it('antes de empezar cuenta lo que falta', () => {
    expect(phaseAt(startsAt, 2, START - 90_000)).toEqual({
      kind: 'antes',
      block: 0,
      remainingMs: 90_000,
    });
  });

  it('en la hora exacta empieza el trabajo del bloque 1', () => {
    expect(phaseAt(startsAt, 2, START)).toEqual({
      kind: 'trabajo',
      block: 1,
      remainingMs: 25 * MINUTE,
    });
  });

  it('pasa a descanso a los 25 minutos exactos, no antes', () => {
    expect(phaseAt(startsAt, 2, START + 25 * MINUTE - 1)).toEqual({
      kind: 'trabajo',
      block: 1,
      remainingMs: 1,
    });
    expect(phaseAt(startsAt, 2, START + 25 * MINUTE)).toEqual({
      kind: 'descanso',
      block: 1,
      remainingMs: 5 * MINUTE,
    });
  });

  it('a los 30 minutos empieza el trabajo del bloque siguiente', () => {
    expect(phaseAt(startsAt, 2, START + 30 * MINUTE)).toEqual({
      kind: 'trabajo',
      block: 2,
      remainingMs: 25 * MINUTE,
    });
  });

  it('al cumplir todos los bloques está terminada, incluido el último descanso', () => {
    expect(phaseAt(startsAt, 2, START + 60 * MINUTE - 1).kind).toBe('descanso');
    expect(phaseAt(startsAt, 2, START + 60 * MINUTE)).toEqual({
      kind: 'terminada',
      block: 2,
      remainingMs: 0,
    });
  });
});

describe('formatCountdown', () => {
  it.each([
    [25 * MINUTE, '25:00'],
    [59_001, '1:00'],
    [1, '0:01'],
    [0, '0:00'],
  ])('%i ms se muestra como %s, redondeando hacia arriba al segundo', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
```

- [ ] **Step 2: Tests de tramos y preselección**

`src/features/session/slots.test.ts`:

```ts
/** Días y horas que ofrece la hoja de propuesta, y qué hora llega preseleccionada. */

import { TIME_BAND_OPTIONS } from '@/features/profile/catalog';
import { buildProfile } from '@/data/test-fixtures';

import {
  BAND_END_HOUR,
  BAND_START_HOUR,
  dayOptions,
  preselectSlot,
  sharedBands,
  slotsForDay,
  startOfDayMs,
} from './slots';

/** Lunes 14 de septiembre de 2026, en hora local. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).getTime();

describe('dayOptions', () => {
  it('ofrece hoy y los 6 días siguientes, cada uno a medianoche local', () => {
    const days = dayOptions(at(14, 10, 7));

    expect(days).toHaveLength(7);
    expect(days[0]).toBe(at(14, 0));
    expect(days[6]).toBe(at(20, 0));
    expect(startOfDayMs(at(14, 23, 59))).toBe(at(14, 0));
  });
});

describe('slotsForDay', () => {
  it('hoy empieza en el primer tramo de 15 min que respeta el margen de 5', () => {
    const slots = slotsForDay(at(14, 0), at(14, 10, 7));

    expect(slots[0]).toBe(at(14, 10, 15));
    expect(slots[slots.length - 1]).toBe(at(14, 23, 45));
  });

  it('un día futuro tiene los 96 tramos desde las 00:00', () => {
    const slots = slotsForDay(at(15, 0), at(14, 10, 7));

    expect(slots).toHaveLength(96);
    expect(slots[0]).toBe(at(15, 0));
  });
});

describe('sharedBands', () => {
  const me = buildProfile({ timezone: 'Europe/Madrid', availability: { hoursPerWeek: 10, bands: ['noche', 'tarde'] } });

  it('en la misma zona horaria devuelve las franjas comunes en orden del día', () => {
    const other = buildProfile({ timezone: 'Europe/Madrid', availability: { hoursPerWeek: 5, bands: ['noche', 'tarde', 'manana'] } });

    expect(sharedBands(me, other)).toEqual(['tarde', 'noche']);
  });

  it('con zonas distintas no preselecciona nada: las franjas son locales de cada uno', () => {
    const other = buildProfile({ timezone: 'America/Bogota', availability: { hoursPerWeek: 5, bands: ['noche'] } });

    expect(sharedBands(me, other)).toEqual([]);
    expect(sharedBands(null, other)).toEqual([]);
  });
});

describe('preselectSlot', () => {
  const me = buildProfile({ timezone: 'Europe/Madrid', availability: { hoursPerWeek: 10, bands: ['noche'] } });
  const other = buildProfile({ timezone: 'Europe/Madrid', availability: { hoursPerWeek: 5, bands: ['noche'] } });

  it('elige el inicio de la primera franja común de hoy', () => {
    expect(preselectSlot(me, other, at(14, 10, 7))).toBe(at(14, 20, 0));
  });

  it('si la franja ya ha empezado, el siguiente tramo válido dentro de ella', () => {
    expect(preselectSlot(me, other, at(14, 21, 10))).toBe(at(14, 21, 15));
  });

  it('si hoy ya no cabe, la franja común de mañana', () => {
    expect(preselectSlot(me, other, at(14, 23, 50))).toBe(at(15, 20, 0));
  });

  it('sin franja común, el próximo tramo válido', () => {
    const elsewhere = { ...other, timezone: 'America/Bogota' };
    expect(preselectSlot(me, elsewhere, at(14, 10, 7))).toBe(at(14, 10, 15));
  });
});

describe('horas de las franjas', () => {
  it('coinciden con las descripciones del catálogo de perfil', () => {
    for (const option of TIME_BAND_OPTIONS) {
      const [start, end] = (option.description ?? '').split('–').map(Number);
      expect(BAND_START_HOUR[option.value]).toBe(start);
      expect(BAND_END_HOUR[option.value]).toBe(end === 0 ? 24 : end);
    }
  });
});
```

- [ ] **Step 3: Tests de textos**

`src/features/session/format.test.ts`:

```ts
/** Textos de fecha y duración de las sesiones, en hora local. */

import {
  blocksLabel,
  formatDayLabel,
  formatSessionWhen,
  formatStartsIn,
  formatTimeOfDay,
} from './format';

const MINUTE = 60_000;
/** Lunes 14 de septiembre de 2026 a las 10:00, hora local. */
const NOW = new Date(2026, 8, 14, 10, 0).getTime();
const iso = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

describe('formatSessionWhen', () => {
  it.each([
    [iso(14, 18), 'hoy 18:00'],
    [iso(15, 9, 30), 'mañana 09:30'],
    [iso(17, 18), 'jue 18:00'],
  ])('%s se lee como «%s»', (startsAt, expected) => {
    expect(formatSessionWhen(startsAt, NOW)).toBe(expected);
  });
});

describe('formatDayLabel', () => {
  it('nombra hoy, mañana y el resto por día de la semana y número', () => {
    expect(formatDayLabel(new Date(2026, 8, 14).getTime(), NOW)).toBe('Hoy');
    expect(formatDayLabel(new Date(2026, 8, 15).getTime(), NOW)).toBe('Mañana');
    expect(formatDayLabel(new Date(2026, 8, 17).getTime(), NOW)).toBe('jue 17');
  });
});

describe('formatStartsIn', () => {
  it.each([
    [30_000, 'en menos de 1 min'],
    [45 * MINUTE, 'en 45 min'],
    [130 * MINUTE, 'en 2 h'],
    [24 * 60 * MINUTE, 'en 1 día'],
    [3 * 24 * 60 * MINUTE + MINUTE, 'en 3 días'],
  ])('%i ms → «%s»', (ms, expected) => {
    expect(formatStartsIn(ms)).toBe(expected);
  });
});

describe('formatTimeOfDay y blocksLabel', () => {
  it('horas con dos dígitos y bloques en singular y plural', () => {
    expect(formatTimeOfDay(new Date(2026, 8, 14, 9, 5).getTime())).toBe('09:05');
    expect(blocksLabel(1)).toBe('1 bloque');
    expect(blocksLabel(4)).toBe('4 bloques');
  });
});
```

- [ ] **Step 4: Ejecutarlos y ver que fallan**

Run: `npx jest src/features/session/phase.test.ts src/features/session/slots.test.ts src/features/session/format.test.ts`
Expected: FAIL por módulos inexistentes.

- [ ] **Step 5: Implementar**

`src/features/session/phase.ts`:

```ts
/**
 * Fase del Pomodoro compartido.
 *
 * Función pura de la hora: cada dispositivo la evalúa con su reloj corregido y
 * los dos ven lo mismo sin mandarse nada por la red. No hay pausa (spec,
 * decisión "plan fijo, sin pausa").
 */

import { BLOCK_MINUTES, WORK_MINUTES } from '@/data';

import type { SessionBlocks } from '@/data';

export type PhaseKind = 'antes' | 'trabajo' | 'descanso' | 'terminada';

export interface Phase {
  kind: PhaseKind;
  /** Bloque en curso, desde 1. `0` antes de empezar; `blocks` al terminar. */
  block: number;
  /** Lo que falta para el siguiente cambio de fase. `0` al terminar. */
  remainingMs: number;
}

const MINUTE = 60_000;

export function phaseAt(startsAt: string, blocks: SessionBlocks, nowMs: number): Phase {
  const start = Date.parse(startsAt);
  if (nowMs < start) return { kind: 'antes', block: 0, remainingMs: start - nowMs };

  const blockMs = BLOCK_MINUTES * MINUTE;
  const elapsed = nowMs - start;
  const index = Math.floor(elapsed / blockMs);
  if (index >= blocks) return { kind: 'terminada', block: blocks, remainingMs: 0 };

  const withinBlock = elapsed - index * blockMs;
  const workMs = WORK_MINUTES * MINUTE;
  if (withinBlock < workMs) {
    return { kind: 'trabajo', block: index + 1, remainingMs: workMs - withinBlock };
  }
  return { kind: 'descanso', block: index + 1, remainingMs: blockMs - withinBlock };
}

/** `m:ss`, redondeando hacia arriba: no se enseña "0:00" mientras quede tiempo. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(ms, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

`src/features/session/slots.ts`:

```ts
/**
 * Días y horas que se pueden proponer, y la hora que llega preseleccionada.
 *
 * Todo en hora local del dispositivo. La franja común solo se usa si las dos
 * personas declaran la misma zona horaria: `Availability.bands` es local de cada
 * perfil, y cruzarlas entre zonas daría horas que no son de nadie.
 */

import { MIN_LEAD_MINUTES } from '@/data';

import type { Profile, TimeBand } from '@/data';

export const SLOT_MINUTES = 15;
/** La interfaz ofrece una semana; el límite de 30 días lo pone el servidor. */
export const PROPOSAL_DAYS = 7;

/** Espejo de las descripciones de `TIME_BAND_OPTIONS` (un test lo fija). */
export const BAND_START_HOUR: Record<TimeBand, number> = {
  madrugada: 0,
  manana: 6,
  tarde: 12,
  noche: 20,
};
export const BAND_END_HOUR: Record<TimeBand, number> = {
  madrugada: 6,
  manana: 12,
  tarde: 20,
  noche: 24,
};

const BAND_ORDER: TimeBand[] = ['madrugada', 'manana', 'tarde', 'noche'];
const MINUTE = 60_000;

export function startOfDayMs(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function dayOptions(nowMs: number, days = PROPOSAL_DAYS): number[] {
  const today = new Date(startOfDayMs(nowMs));
  return Array.from({ length: days }, (_, offset) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).getTime()
  );
}

/** Tramos de 15 min del día que caen a partir de ahora + 5 min. */
export function slotsForDay(dayStartMs: number, nowMs: number): number[] {
  const earliest = nowMs + MIN_LEAD_MINUTES * MINUTE;
  const day = new Date(dayStartMs);
  const slots: number[] = [];
  for (let minute = 0; minute < 24 * 60; minute += SLOT_MINUTES) {
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute).getTime();
    if (slot >= earliest) slots.push(slot);
  }
  return slots;
}

export function sharedBands(me: Profile | null, other: Profile): TimeBand[] {
  if (!me || me.timezone !== other.timezone) return [];
  return BAND_ORDER.filter(
    (band) => me.availability.bands.includes(band) && other.availability.bands.includes(band)
  );
}

function inBand(slotMs: number, band: TimeBand): boolean {
  const date = new Date(slotMs);
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= BAND_START_HOUR[band] && hour < BAND_END_HOUR[band];
}

/** El primer tramo válido dentro de una franja común; si no hay, el primer tramo válido. */
export function preselectSlot(me: Profile | null, other: Profile, nowMs: number): number {
  const bands = sharedBands(me, other);
  const days = dayOptions(nowMs);

  for (const day of days) {
    const slots = slotsForDay(day, nowMs);
    const found = slots.find((slot) => bands.some((band) => inBand(slot, band)));
    if (found !== undefined) return found;
  }
  for (const day of days) {
    const [first] = slotsForDay(day, nowMs);
    if (first !== undefined) return first;
  }
  return nowMs + MIN_LEAD_MINUTES * MINUTE;
}
```

`src/features/session/format.ts`:

```ts
/**
 * Textos de fecha y duración de las sesiones, en hora local.
 *
 * A mano y no con `Intl`: las abreviaturas de día de la semana varían entre
 * motores (Hermes, Node, navegador) y la tarjeta necesita leerse igual en todos.
 */

import { startOfDayMs } from './slots';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MINUTE = 60_000;

const pad = (value: number) => String(value).padStart(2, '0');

export function formatTimeOfDay(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Días completos entre el día de `ms` y el de `nowMs`, por fecha local y no por horas. */
function dayDistance(ms: number, nowMs: number): number {
  const a = new Date(startOfDayMs(ms));
  const b = new Date(startOfDayMs(nowMs));
  return Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      (24 * 60 * MINUTE)
  );
}

/** Etiqueta de un día en la hoja de propuesta: "Hoy", "Mañana", "jue 17". */
export function formatDayLabel(dayStartMs: number, nowMs: number): string {
  const distance = dayDistance(dayStartMs, nowMs);
  if (distance === 0) return 'Hoy';
  if (distance === 1) return 'Mañana';
  const date = new Date(dayStartMs);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

/** "hoy 18:00", "mañana 09:30", "jue 18:00". */
export function formatSessionWhen(startsAt: string, nowMs: number): string {
  const ms = Date.parse(startsAt);
  const distance = dayDistance(ms, nowMs);
  const day = distance === 0 ? 'hoy' : distance === 1 ? 'mañana' : WEEKDAYS[new Date(ms).getDay()];
  return `${day} ${formatTimeOfDay(ms)}`;
}

/** "en 45 min", "en 2 h", "en 3 días". Trunca: nunca promete menos espera de la real. */
export function formatStartsIn(ms: number): string {
  if (ms < MINUTE) return 'en menos de 1 min';
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.floor(hours / 24);
  return `en ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function blocksLabel(blocks: number): string {
  return `${blocks} ${blocks === 1 ? 'bloque' : 'bloques'}`;
}
```

- [ ] **Step 6: Ejecutar los tests**

Run: `npx jest src/features/session/phase.test.ts src/features/session/slots.test.ts src/features/session/format.test.ts`
Expected: PASS.

- [ ] **Step 7: Formato, lint y commit**

Run: `npx prettier --write src/features/session` y `npm run lint`
Expected: sin errores (Prettier puede reflotar las líneas largas de los `buildProfile` de los tests; es solo formato).

Marcar la Tarea 6 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/features/session/phase.ts src/features/session/slots.ts src/features/session/format.ts src/features/session/phase.test.ts src/features/session/slots.test.ts src/features/session/format.test.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): reloj del Pomodoro, tramos de propuesta y textos"
```

---

### Task 7: Pantalla de sesión

**Files:**
- Create: `src/features/session/use-resolved-or-previous.ts`
- Create: `src/features/session/use-now.ts`
- Create: `src/features/session/use-session-room.ts`
- Create: `src/features/session/use-attendance.ts`
- Create: `src/features/session/index.ts`
- Create: `src/app/session/[sessionId].tsx`
- Modify: `src/app/_layout.tsx` (registrar la ruta)
- Test: `test/app/sessionId.test.tsx`
- Modify: `test/app/layouts.test.tsx` (afirmar la ruta nueva)

**Interfaces:**
- Consumes: `phaseAt`, `formatCountdown` (Tarea 6); `useCounterpartPresence` (Tarea 5); `isInJoinWindow` y repositorios de `@/data`; `ProfileAvatar` de `@/features/chat`.
- Produces:
  ```ts
  export function useResolvedOrPrevious<T>(data: T | null, loading: boolean): T | null;
  export function useNow(intervalMs: number): number;
  export interface SessionRoom {
    session: LockInSession | null;
    match: MatchWithProfile | null;
    me: Profile | null;
    loading: boolean;
    error: Error | null;
    /** Milisegundos a sumar a `Date.now()` para tener la hora del servidor. */
    offsetMs: number;
  }
  export function useSessionRoom(sessionId: string): SessionRoom;
  export interface Attendance { joined: boolean; leave(): Promise<void> }
  export function useAttendance(sessionId: string, canJoin: boolean, ended: boolean): Attendance;
  ```
  Ruta `/session/[sessionId]`, que la Tarea 8 abre con `router.push({ pathname: '/session/[sessionId]', params: { sessionId } })`.

- [ ] **Step 1: Escribir el test de la ruta**

`test/app/sessionId.test.tsx`:

```tsx
/**
 * Pantalla de sesión Lock-In.
 *
 * Reloj falso de Jest: el mock de sesiones y la pantalla leen `Date.now()`, así
 * que mover la hora del sistema mueve a los dos a la vez. La presencia es el
 * adaptador en memoria que exporta `@/data` sin credenciales.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { presence } from '@/data';
import { createMockSessionRepository } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  router,
  setSearchParams,
} from '../routes';

import SessionScreen from '../../src/app/session/[sessionId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const COUNTERPART_ID = SEED_RECIPROCAL_IDS[0];
const MINUTE = 60_000;
const BASE = Date.parse('2026-09-14T10:00:00.000Z');

/** Match con Núria y una sesión que empieza a BASE + 5 min + 1 s. */
async function seedSession({ blocks = 2, accept = true }: { blocks?: 1 | 2 | 4; accept?: boolean } = {}) {
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { match } = await repositories.discovery.recordDecision(COUNTERPART_ID, 'like');
  const startsAtMs = BASE + 5 * MINUTE + 1_000;
  const session = await repositories.sessions.propose({
    matchId: match!.id,
    startsAt: new Date(startsAtMs).toISOString(),
    blocks,
  });
  if (accept) await createMockSessionRepository(COUNTERPART_ID).respond(session.id, 'aceptada');
  setSearchParams({ sessionId: session.id });
  return { session, startsAtMs };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BASE);
  resetRepositories();
  resetRouter();
  setSearchParams({});
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionScreen', () => {
  it('con un id que no resuelve lo dice', async () => {
    setSearchParams({ sessionId: 'no-existe' });

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Esta sesión no está disponible')).toBeTruthy());
  });

  it('una sesión sin aceptar no deja entrar', async () => {
    await seedSession({ accept: false });
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() =>
      expect(screen.getByText('Esta sesión todavía no está aceptada')).toBeTruthy()
    );
    expect(join).not.toHaveBeenCalled();
  });

  it('antes de que abra la ventana explica cuándo se puede entrar', async () => {
    await seedSession();
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Todavía no puedes entrar')).toBeTruthy());
    expect(join).not.toHaveBeenCalled();
  });

  it('dentro de la ventana entra, cuenta atrás y ve si la otra persona está', async () => {
    const { session, startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs - 4 * MINUTE);
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Empieza en')).toBeTruthy());
    expect(screen.getByText('4:00')).toBeTruthy();
    await waitFor(() => expect(join).toHaveBeenCalledWith(session.id));
    expect(screen.getByText('Aún no ha entrado')).toBeTruthy();

    let leave: () => void = () => {};
    await act(async () => {
      leave = presence.join(session.id, COUNTERPART_ID, { onPeers: () => {}, onConnection: () => {} });
    });
    expect(screen.getByText('Está aquí')).toBeTruthy();
    leave();
  });

  it('en trabajo y en descanso nombra la fase y el bloque', async () => {
    const { startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs + MINUTE);

    await renderRoute(<SessionScreen />);
    await waitFor(() => expect(screen.getByText('Trabajo · bloque 1 de 2')).toBeTruthy());
    expect(screen.getByText('24:00')).toBeTruthy();

    await act(async () => {
      jest.setSystemTime(startsAtMs + 26 * MINUTE);
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('Descanso · bloque 1 de 2')).toBeTruthy();
  });

  it('al acabar la da por completada y vuelve al chat', async () => {
    const { startsAtMs } = await seedSession({ blocks: 1 });
    jest.setSystemTime(startsAtMs + 31 * MINUTE);

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Sesión completada')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al chat' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('salir pide confirmación, registra la salida y vuelve', async () => {
    const { session, startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs + MINUTE);
    const join = jest.spyOn(repositories.sessions, 'join');
    const leave = jest.spyOn(repositories.sessions, 'leave');

    await renderRoute(<SessionScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());

    await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByText('Saldrás antes de acabar; contará como abandono.')).toBeTruthy();
    expect(leave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Salir de la sesión' }));

    await waitFor(() => expect(leave).toHaveBeenCalledWith(session.id));
    expect(router.back).toHaveBeenCalled();
  });
});
```

En `test/app/layouts.test.tsx`, en el primer caso de `RootLayout`, después de `expect(screen.getByText('ruta:chat/[matchId]')).toBeTruthy();`:

```tsx
    expect(screen.getByText('ruta:session/[sessionId]')).toBeTruthy();
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx jest test/app/sessionId.test.tsx test/app/layouts.test.tsx`
Expected: FAIL: no existe `src/app/session/[sessionId]` y falta `ruta:session/[sessionId]`.

- [ ] **Step 3: Hooks de la sala**

`src/features/session/use-resolved-or-previous.ts`:

```ts
/**
 * El último valor resuelto mientras una consulta se relee.
 *
 * Copia deliberada de la función privada de `src/features/chat/use-conversation.ts`:
 * `useQuery` publica `data: null` en cada relectura, y sin esto la tarjeta y la
 * pantalla de sesión parpadearían a su estado vacío con cada aviso de realtime.
 * Si `arquitecto` arregla `useQuery`, se borran las dos copias.
 */

import { useState } from 'react';

export function useResolvedOrPrevious<T>(data: T | null, loading: boolean): T | null {
  const [lastResolved, setLastResolved] = useState<T | null>(null);

  if (!loading) {
    if (lastResolved !== data) setLastResolved(data);
    return data;
  }

  return lastResolved;
}
```

`src/features/session/use-now.ts`:

```ts
/** La hora del dispositivo, refrescada cada `intervalMs`. */

import { useEffect, useState } from 'react';

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
```

`src/features/session/use-session-room.ts`:

```ts
/**
 * Todo lo que necesita la pantalla de sesión: la sesión, su match, el perfil
 * propio y el desfase entre el reloj del dispositivo y el del servidor.
 */

import { useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import { useResolvedOrPrevious } from './use-resolved-or-previous';

import type { LockInSession, MatchWithProfile, Profile } from '@/data';

export interface SessionRoom {
  session: LockInSession | null;
  match: MatchWithProfile | null;
  me: Profile | null;
  loading: boolean;
  error: Error | null;
  /** Milisegundos a sumar a `Date.now()` para tener la hora del servidor. */
  offsetMs: number;
}

export function useSessionRoom(sessionId: string): SessionRoom {
  const repositories = useRepositories();

  const sessionQuery = useQuery(`session:${sessionId}`, () =>
    repositories.sessions.getById(sessionId)
  );
  const session = useResolvedOrPrevious(sessionQuery.data, sessionQuery.loading);
  const matchId = session?.matchId ?? null;

  const matchQuery = useQuery(`match:${matchId ?? 'ninguno'}`, () =>
    matchId ? repositories.matches.getById(matchId) : Promise.resolve(null)
  );
  const match = useResolvedOrPrevious(matchQuery.data, matchQuery.loading);
  const meQuery = useQuery('profile:current', () => repositories.profiles.getCurrent());

  const refreshSession = sessionQuery.refresh;
  useEffect(() => {
    if (!matchId) return;
    return repositories.sessions.subscribe(matchId, refreshSession);
  }, [repositories, matchId, refreshSession]);

  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sentAt = Date.now();
    repositories.sessions
      .serverNow()
      .then((serverIso) => {
        if (cancelled) return;
        // La hora del servidor corresponde, como mejor estimación, al punto medio del viaje.
        const receivedAt = Date.now();
        setOffsetMs(Date.parse(serverIso) - (sentAt + receivedAt) / 2);
      })
      .catch(() => {
        // Sin hora del servidor se sigue con la del dispositivo (spec, sección 3).
      });
    return () => {
      cancelled = true;
    };
  }, [repositories]);

  return {
    session,
    match,
    me: meQuery.data,
    loading: (sessionQuery.loading && !session) || (matchQuery.loading && !match),
    error: sessionQuery.error ?? matchQuery.error,
    offsetMs,
  };
}
```

`src/features/session/use-attendance.ts`:

```ts
/**
 * Entrar y salir de la sesión en el servidor.
 *
 * Entra solo mientras `canJoin`, y reintenta cada 5 s si falla (sin red). Al
 * desmontar la pantalla antes del final registra la salida: cubre el gesto de
 * atrás del sistema sin depender de la API de navegación. Un `leave` que falla
 * se descarta: `leftAt` queda `null`, que la spec define como "no salió de forma
 * explícita".
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRepositories } from '@/data';

const RETRY_MS = 5_000;

export interface Attendance {
  joined: boolean;
  leave(): Promise<void>;
}

export function useAttendance(sessionId: string, canJoin: boolean, ended: boolean): Attendance {
  const repositories = useRepositories();
  const [joined, setJoined] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const leftRef = useRef(false);
  const endedRef = useRef(ended);

  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  useEffect(() => {
    if (!canJoin || joined || leftRef.current) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    repositories.sessions
      .join(sessionId)
      .then(() => {
        if (!cancelled) setJoined(true);
      })
      .catch(() => {
        if (!cancelled) retry = setTimeout(() => setAttempt((value) => value + 1), RETRY_MS);
      });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [repositories, sessionId, canJoin, joined, attempt]);

  useEffect(() => {
    if (!joined) return;
    return () => {
      if (!leftRef.current && !endedRef.current) {
        void repositories.sessions.leave(sessionId).catch(() => {});
      }
    };
  }, [repositories, sessionId, joined]);

  const leave = useCallback(async () => {
    leftRef.current = true;
    try {
      await repositories.sessions.leave(sessionId);
    } catch {
      // Descartado a propósito; ver la cabecera.
    }
  }, [repositories, sessionId]);

  return { joined, leave };
}
```

`src/features/session/index.ts`:

```ts
/**
 * Superficie pública del bloque `sesiones`.
 *
 * Las rutas de `src/app/` importan siempre desde aquí.
 */

export { blocksLabel, formatDayLabel, formatSessionWhen, formatStartsIn, formatTimeOfDay } from './format';
export { formatCountdown, phaseAt, type Phase, type PhaseKind } from './phase';
export { dayOptions, preselectSlot, slotsForDay } from './slots';
export { useAttendance } from './use-attendance';
export { useCounterpartPresence, type CounterpartPresence } from './use-counterpart-presence';
export { useNow } from './use-now';
export { useSessionRoom } from './use-session-room';
```

- [ ] **Step 4: La pantalla**

`src/app/session/[sessionId].tsx`:

```tsx
/**
 * Sesión Lock-In en curso.
 *
 * La cuenta atrás sale de `phaseAt` con la hora del dispositivo corregida por
 * `serverNow()`: los dos móviles calculan lo mismo sin mandarse nada. Entrar se
 * registra solo al abrir la pantalla dentro de la ventana; salir antes de acabar
 * pide confirmación porque cuenta como abandono.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { isInJoinWindow } from '@/data';
import { ProfileAvatar } from '@/features/chat';
import {
  formatCountdown,
  phaseAt,
  useAttendance,
  useCounterpartPresence,
  useNow,
  useSessionRoom,
  type CounterpartPresence,
  type Phase,
} from '@/features/session';
import { useTheme } from '@/hooks/use-theme';

const PRESENCE_TEXT: Record<CounterpartPresence, string> = {
  aqui: 'Está aquí',
  ausente: 'Aún no ha entrado',
  'sin-conexion': 'Sin conexión',
};

function phaseTitle(phase: Phase, blocks: number): string {
  if (phase.kind === 'antes') return 'Empieza en';
  const name = phase.kind === 'trabajo' ? 'Trabajo' : 'Descanso';
  return `${name} · bloque ${phase.block} de ${blocks}`;
}

export default function SessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : (params.sessionId ?? '');

  const { session, match, me, loading, offsetMs } = useSessionRoom(sessionId);
  const nowMs = useNow(1_000) + offsetMs;

  const canJoin = session !== null && isInJoinWindow(session, nowMs);
  const phase = session ? phaseAt(session.startsAt, session.blocks, nowMs) : null;
  const ended = phase?.kind === 'terminada';

  const attendance = useAttendance(sessionId, canJoin, ended);
  const counterpartPresence = useCounterpartPresence(
    canJoin ? sessionId : null,
    me?.id ?? null,
    match?.counterpart.id ?? null
  );
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const leave = async () => {
    await attendance.leave();
    router.back();
  };

  const screenOptions = <Stack.Screen options={{ title: 'Sesión Lock-In' }} />;

  if (loading && !session) {
    return (
      <Centered>
        {screenOptions}
        <ThemedText type="body" themeColor="textSecondary">
          Cargando la sesión…
        </ThemedText>
      </Centered>
    );
  }

  if (!session || !match) {
    return (
      <Notice title="Esta sesión no está disponible" onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  if (session.status !== 'aceptada') {
    return (
      <Notice title="Esta sesión todavía no está aceptada" onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  if (!ended && !canJoin) {
    return (
      <Notice
        title="Todavía no puedes entrar"
        detail="La sesión se abre 5 minutos antes de empezar."
        onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {screenOptions}
      <View style={styles.content}>
        <View style={styles.counterpart}>
          <ProfileAvatar avatar={match.counterpart.avatar} size={56} />
          <View style={styles.counterpartText}>
            <ThemedText type="heading">{match.counterpart.name}</ThemedText>
            <ThemedText
              type="small"
              themeColor={counterpartPresence === 'aqui' ? 'teal' : 'textSecondary'}>
              {PRESENCE_TEXT[counterpartPresence]}
            </ThemedText>
          </View>
        </View>

        {phase && ended ? (
          <View style={styles.clock}>
            <ThemedText type="title">Sesión completada</ThemedText>
            <ActionButton label="Volver al chat" onPress={() => router.back()} />
          </View>
        ) : phase ? (
          <>
            <View style={styles.clock}>
              <ThemedText type="label" themeColor="textSecondary">
                {phaseTitle(phase, session.blocks)}
              </ThemedText>
              <ThemedText type="display">{formatCountdown(phase.remainingMs)}</ThemedText>
              <View style={styles.blocks}>
                {Array.from({ length: session.blocks }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.block,
                      {
                        borderColor: theme.brass,
                        backgroundColor:
                          index + 1 < phase.block ? theme.brass : index + 1 === phase.block ? theme.brassSoft : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {confirmingLeave ? (
              <View style={styles.confirm}>
                <ThemedText type="body" themeColor="danger">
                  Saldrás antes de acabar; contará como abandono.
                </ThemedText>
                <ActionButton label="Salir de la sesión" tone="danger" onPress={leave} />
                <ActionButton label="Seguir" tone="quiet" onPress={() => setConfirmingLeave(false)} />
              </View>
            ) : (
              <ActionButton label="Salir" tone="quiet" onPress={() => setConfirmingLeave(true)} />
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function Notice({
  title,
  detail,
  onBack,
  children,
}: {
  title: string;
  detail?: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Centered>
      {children}
      <ThemedText type="subtitle" style={styles.centeredText}>
        {title}
      </ThemedText>
      {detail && (
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          {detail}
        </ThemedText>
      )}
      <ActionButton label="Volver al chat" onPress={onBack} />
    </Centered>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'quiet';
}) {
  const theme = useTheme();
  const background = tone === 'accent' ? theme.brass : tone === 'danger' ? theme.danger : 'transparent';
  const color = tone === 'quiet' ? theme.text : theme.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: background, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="bodyStrong" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
  },
  counterpart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  counterpartText: { gap: Spacing.half },
  clock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  blocks: { flexDirection: 'row', gap: Spacing.two },
  block: { width: 32, height: 8, borderRadius: Radii.pill, borderWidth: StyleSheet.hairlineWidth },
  confirm: { gap: Spacing.two },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: { textAlign: 'center' },
  action: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
```

En `src/app/_layout.tsx`, después del `<Stack.Screen name="chat/[matchId]" … />`:

```tsx
              <Stack.Screen
                name="session/[sessionId]"
                options={{
                  headerShown: true,
                  headerBackButtonDisplayMode: 'minimal',
                  headerStyle: { backgroundColor: palette.background },
                  headerTintColor: palette.brass,
                  headerTitleStyle: { color: palette.text, fontFamily: FontFamily.display },
                }}
              />
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npx jest test/app/sessionId.test.tsx test/app/layouts.test.tsx`
Expected: PASS.

Si el caso "en trabajo y en descanso" no ve el cambio a descanso, es que el intervalo de `useNow` no ha corrido: comprobar que el `act` avanza al menos 1 s de temporizadores después del `setSystemTime`.

- [ ] **Step 6: Verificación y commit**

Run: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run lint`, `npx prettier --write src/features/session src/app/session test/app/sessionId.test.tsx`
Expected: todo en verde.

Marcar la Tarea 7 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/features/session/use-resolved-or-previous.ts src/features/session/use-now.ts src/features/session/use-session-room.ts src/features/session/use-attendance.ts src/features/session/index.ts "src/app/session/[sessionId].tsx" src/app/_layout.tsx test/app/sessionId.test.tsx test/app/layouts.test.tsx docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): pantalla de sesión con Pomodoro y presencia"
```

---

### Task 8: Tarjeta del chat y hoja de propuesta

**Files:**
- Create: `src/features/session/card-state.ts`
- Create: `src/features/session/use-active-session.ts`
- Create: `src/features/session/propose-session-sheet.tsx`
- Create: `src/features/session/session-card.tsx`
- Modify: `src/features/session/index.ts`
- Modify: `src/app/chat/[matchId].tsx` (cruce con `chat`: una línea de JSX y su import)
- Modify: `src/features/chat/index.ts` (quitar el export de `LockInCta`)
- Delete: `src/features/chat/lock-in-cta.tsx`, `src/features/chat/lock-in-cta.test.tsx`
- Test: `src/features/session/card-state.test.ts`
- Test: `src/features/session/propose-session-sheet.test.tsx`
- Test: `src/features/session/session-card.test.tsx`

**Interfaces:**
- Consumes: repositorio de sesiones y errores de `@/data`; `isSessionLive`, `isInJoinWindow`, `BLOCK_MINUTES`, `SESSION_BLOCK_OPTIONS`; `preselectSlot`, `dayOptions`, `slotsForDay`, `startOfDayMs` (Tarea 6); textos de `format.ts`; `useResolvedOrPrevious` (Tarea 7); ruta `/session/[sessionId]` (Tarea 7).
- Produces:
  ```ts
  export type CardView =
    | { kind: 'agendar' }
    | { kind: 'esperando'; session: LockInSession }
    | { kind: 'recibida'; session: LockInSession }
    | { kind: 'aceptada'; session: LockInSession }
    | { kind: 'entrar'; session: LockInSession };
  export function cardView(session: LockInSession | null, myProfileId: string | null, nowMs: number): CardView;
  export const SESSION_TICK_MS = 30_000;
  export function useActiveSession(matchId: string): { session: LockInSession | null; nowMs: number; refresh(): void };
  export function ProposeSessionSheet(props: ProposeSessionSheetProps): JSX.Element;
  export function SessionCard(props: { match: MatchWithProfile; me: Profile | null }): JSX.Element;
  ```
  Etiquetas accesibles que usan la Tarea 10 y los tests: `Agendar sesión Lock-In`, `Cancelar sesión`, `Aceptar sesión`, `Rechazar sesión`, `Entrar a la sesión`, `Proponer sesión`, `Cerrar sin proponer`.

- [ ] **Step 1: Test de `cardView`**

`src/features/session/card-state.test.ts`:

```ts
/** Qué pinta la tarjeta del chat según la sesión viva y quién mira. */

import { cardView } from './card-state';

import type { LockInSession } from '@/data';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');

const session = (overrides: Partial<LockInSession> = {}): LockInSession => ({
  id: 's1',
  matchId: 'm1',
  proposedBy: 'me',
  startsAt: new Date(START).toISOString(),
  blocks: 1,
  status: 'propuesta',
  createdAt: new Date(START - 60 * MINUTE).toISOString(),
  respondedAt: null,
  ...overrides,
});

describe('cardView', () => {
  it('sin sesión, o con una que ya no está viva, ofrece agendar', () => {
    expect(cardView(null, 'me', START - MINUTE)).toEqual({ kind: 'agendar' });
    expect(cardView(session(), 'me', START)).toEqual({ kind: 'agendar' });
    expect(cardView(session({ status: 'cancelada' }), 'me', START - MINUTE).kind).toBe('agendar');
  });

  it('una propuesta propia espera; una ajena se responde', () => {
    expect(cardView(session(), 'me', START - MINUTE).kind).toBe('esperando');
    expect(cardView(session({ proposedBy: 'nuria' }), 'me', START - MINUTE).kind).toBe('recibida');
  });

  it('una aceptada se enseña como acordada hasta que abre la ventana, y entonces deja entrar', () => {
    const accepted = session({ status: 'aceptada', respondedAt: new Date(START - 30 * MINUTE).toISOString() });
    expect(cardView(accepted, 'me', START - 5 * MINUTE - 1).kind).toBe('aceptada');
    expect(cardView(accepted, 'me', START - 5 * MINUTE).kind).toBe('entrar');
    expect(cardView(accepted, 'me', START + 29 * MINUTE).kind).toBe('entrar');
  });
});
```

- [ ] **Step 2: Test de la hoja**

`src/features/session/propose-session-sheet.test.tsx`:

```tsx
/**
 * Hoja para proponer una sesión: día, hora y bloques, con la franja común ya elegida.
 *
 * Reloj falso con hora local fija para que la preselección no dependa del momento.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ProposeSessionSheet } from './propose-session-sheet';

const NOW = new Date(2026, 8, 14, 10, 7).getTime();
const me = buildProfile({ id: 'me', timezone: 'Europe/Madrid', availability: { hoursPerWeek: 8, bands: ['noche'] } });
const nuria = buildProfile({ id: 'nuria', name: 'Núria Bosch', timezone: 'Europe/Madrid', availability: { hoursPerWeek: 8, bands: ['noche'] } });

async function renderSheet(overrides: Partial<Parameters<typeof ProposeSessionSheet>[0]> = {}) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  await render(
    <ProposeSessionSheet
      visible
      me={me}
      counterpart={nuria}
      nowMs={NOW}
      submitting={false}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSubmit, onClose };
}

describe('ProposeSessionSheet', () => {
  it('llega con la franja común de hoy y dos bloques elegidos', async () => {
    await renderSheet();

    expect(screen.getByLabelText('Día Hoy').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Hora 20:00').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('2 bloques, hasta 21:00').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('propone la hora y los bloques elegidos', async () => {
    const { onSubmit } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('4 bloques, hasta 22:00'));
    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    expect(onSubmit).toHaveBeenCalledWith(new Date(2026, 8, 14, 20, 0).toISOString(), 4);
  });

  it('cambiar de día conserva la hora si ese día la tiene', async () => {
    const { onSubmit } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('Día Mañana'));
    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    expect(onSubmit).toHaveBeenCalledWith(new Date(2026, 8, 15, 20, 0).toISOString(), 2);
  });

  it('cerrar no propone nada', async () => {
    const { onSubmit, onClose } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('Cerrar sin proponer'));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mientras envía, el botón de proponer está deshabilitado', async () => {
    await renderSheet({ submitting: true });

    expect(screen.getByLabelText('Proponer sesión')).toBeDisabled();
  });
});
```

- [ ] **Step 3: Test de la tarjeta**

`src/features/session/session-card.test.tsx`:

```tsx
/**
 * La tarjeta de sesión del chat en sus cinco estados, contra el mock real.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider, SessionConflictError } from '@/data';
import { createMockRepositories, createMockSessionRepository, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { SessionCard } from './session-card';

import type { MatchWithProfile, Profile, Repositories } from '@/data';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const NURIA = SEED_RECIPROCAL_IDS[0];
const MINUTE = 60_000;

let repositories: Repositories;
let match: MatchWithProfile;
let me: Profile;

beforeEach(async () => {
  jest.restoreAllMocks();
  mockRouter.push.mockClear();
  resetState();
  repositories = createMockRepositories();
  me = await repositories.profiles.saveCurrent(buildProfileInput());
  const { match: created } = await repositories.discovery.recordDecision(NURIA, 'like');
  match = (await repositories.matches.getById(created!.id))!;
});

afterEach(() => {
  jest.useRealTimers();
});

const renderCard = () =>
  render(
    <DataProvider value={repositories}>
      <SessionCard match={match} me={me} />
    </DataProvider>
  );

const inAnHour = () => new Date(Date.now() + 60 * MINUTE).toISOString();

describe('SessionCard', () => {
  it('sin sesión ofrece agendar y abre la hoja', async () => {
    await renderCard();

    await fireEvent.press(await screen.findByLabelText('Agendar sesión Lock-In'));

    expect(screen.getByLabelText('Proponer sesión')).toBeTruthy();
  });

  it('proponer desde la hoja deja la tarjeta esperando a la otra persona', async () => {
    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Agendar sesión Lock-In'));

    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    await waitFor(() => expect(screen.getByText('Esperando a Núria')).toBeTruthy());
    expect((await repositories.sessions.getActive(match.id))?.status).toBe('propuesta');
  });

  it('una propuesta recibida se acepta desde la tarjeta', async () => {
    await createMockSessionRepository(NURIA).propose({ matchId: match.id, startsAt: inAnHour(), blocks: 2 });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Aceptar sesión'));

    await waitFor(() => expect(screen.getByText('Sesión acordada')).toBeTruthy());
  });

  it('rechazar vuelve a ofrecer agendar', async () => {
    await createMockSessionRepository(NURIA).propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Rechazar sesión'));

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
  });

  it('cancelar la propia vuelve a ofrecer agendar', async () => {
    await repositories.sessions.propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Cancelar sesión'));

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
  });

  it('si la sesión cambió por el camino, lo dice', async () => {
    await createMockSessionRepository(NURIA).propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });
    jest.spyOn(repositories.sessions, 'respond').mockRejectedValue(new SessionConflictError('ya'));

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Aceptar sesión'));

    await waitFor(() => expect(screen.getByText('La sesión ha cambiado.')).toBeTruthy());
  });

  it('dentro de la ventana lleva a la pantalla de sesión', async () => {
    jest.useFakeTimers();
    const base = Date.now();
    jest.setSystemTime(base);
    const startsAt = new Date(base + 5 * MINUTE + 1_000).toISOString();
    const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
    await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');
    jest.setSystemTime(base + 2_000);

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Entrar a la sesión'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/session/[sessionId]',
      params: { sessionId: session.id },
    });
  });
});
```

- [ ] **Step 4: Ejecutarlos y ver que fallan**

Run: `npx jest src/features/session/card-state.test.ts src/features/session/propose-session-sheet.test.tsx src/features/session/session-card.test.tsx`
Expected: FAIL por módulos inexistentes.

- [ ] **Step 5: Estado, hook y hoja**

`src/features/session/card-state.ts`:

```ts
/** Qué pinta la tarjeta de sesión del chat. Pura: la hora entra como parámetro. */

import { isInJoinWindow, isSessionLive } from '@/data';

import type { LockInSession } from '@/data';

export type CardView =
  | { kind: 'agendar' }
  | { kind: 'esperando'; session: LockInSession }
  | { kind: 'recibida'; session: LockInSession }
  | { kind: 'aceptada'; session: LockInSession }
  | { kind: 'entrar'; session: LockInSession };

export function cardView(
  session: LockInSession | null,
  myProfileId: string | null,
  nowMs: number
): CardView {
  if (!session || !isSessionLive(session, nowMs)) return { kind: 'agendar' };
  if (session.status === 'propuesta') {
    return session.proposedBy === myProfileId
      ? { kind: 'esperando', session }
      : { kind: 'recibida', session };
  }
  return isInJoinWindow(session, nowMs) ? { kind: 'entrar', session } : { kind: 'aceptada', session };
}
```

`src/features/session/use-active-session.ts`:

```ts
/**
 * La sesión viva de un match, al día.
 *
 * Se relee con cada aviso del repositorio y con un tic de 30 s: los umbrales de
 * ventana y caducidad se cruzan sin que llegue ningún evento por la red.
 */

import { useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import { useResolvedOrPrevious } from './use-resolved-or-previous';

import type { LockInSession } from '@/data';

export const SESSION_TICK_MS = 30_000;

export function useActiveSession(matchId: string): {
  session: LockInSession | null;
  nowMs: number;
  refresh: () => void;
} {
  const repositories = useRepositories();
  const query = useQuery(`session:active:${matchId}`, () => repositories.sessions.getActive(matchId));
  const session = useResolvedOrPrevious(query.data, query.loading);
  const { refresh } = query;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => repositories.sessions.subscribe(matchId, refresh), [repositories, matchId, refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
      refresh();
    }, SESSION_TICK_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { session, nowMs, refresh };
}
```

`src/features/session/propose-session-sheet.tsx`:

```tsx
/**
 * Hoja para proponer una sesión Lock-In: día (hoy y 6 más), hora en tramos de
 * 15 min y 1, 2 o 4 bloques. Llega con la franja común preseleccionada.
 *
 * Se monta al abrirla (ver `SessionCard`), así que la preselección se calcula
 * con la hora de ese momento y no se mueve mientras se elige.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { BLOCK_MINUTES, SESSION_BLOCK_OPTIONS } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { blocksLabel, formatDayLabel, formatTimeOfDay } from './format';
import { dayOptions, preselectSlot, slotsForDay, startOfDayMs } from './slots';

import type { Profile, SessionBlocks } from '@/data';

export interface ProposeSessionSheetProps {
  visible: boolean;
  me: Profile | null;
  counterpart: Profile;
  nowMs: number;
  submitting: boolean;
  onSubmit(startsAt: string, blocks: SessionBlocks): void;
  onClose(): void;
}

const MINUTE = 60_000;

export function ProposeSessionSheet({
  visible,
  me,
  counterpart,
  nowMs,
  submitting,
  onSubmit,
  onClose,
}: ProposeSessionSheetProps) {
  const theme = useTheme();
  const [initialSlot] = useState(() => preselectSlot(me, counterpart, nowMs));
  const [slotMs, setSlotMs] = useState(initialSlot);
  const [dayMs, setDayMs] = useState(() => startOfDayMs(initialSlot));
  const [blocks, setBlocks] = useState<SessionBlocks>(2);

  const days = dayOptions(nowMs).filter((day) => slotsForDay(day, nowMs).length > 0);
  const slots = slotsForDay(dayMs, nowMs);

  const selectDay = (day: number) => {
    const current = new Date(slotMs);
    const sameTime = new Date(day);
    sameTime.setHours(current.getHours(), current.getMinutes(), 0, 0);
    const daySlots = slotsForDay(day, nowMs);
    setDayMs(day);
    setSlotMs(daySlots.includes(sameTime.getTime()) ? sameTime.getTime() : daySlots[0]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle">Proponer sesión Lock-In</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`A ${counterpart.name.split(' ')[0]} le llegará para aceptarla o rechazarla.`}
        </ThemedText>

        <Section title="Día">
          <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
            {days.map((day) => (
              <Chip
                key={day}
                label={formatDayLabel(day, nowMs)}
                accessibilityLabel={`Día ${formatDayLabel(day, nowMs)}`}
                selected={day === dayMs}
                onPress={() => selectDay(day)}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title="Hora">
          <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
            {slots.map((slot) => (
              <Chip
                key={slot}
                label={formatTimeOfDay(slot)}
                accessibilityLabel={`Hora ${formatTimeOfDay(slot)}`}
                selected={slot === slotMs}
                onPress={() => setSlotMs(slot)}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title="Duración">
          <View style={styles.row}>
            {SESSION_BLOCK_OPTIONS.map((option) => {
              const end = formatTimeOfDay(slotMs + option * BLOCK_MINUTES * MINUTE);
              return (
                <Chip
                  key={option}
                  label={`${blocksLabel(option)} · hasta ${end}`}
                  accessibilityLabel={`${blocksLabel(option)}, hasta ${end}`}
                  selected={option === blocks}
                  onPress={() => setBlocks(option)}
                />
              );
            })}
          </View>
        </Section>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Proponer sesión"
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            onPress={() => onSubmit(new Date(slotMs).toISOString(), blocks)}
            style={[styles.primary, { backgroundColor: theme.brass, opacity: submitting ? 0.6 : 1 }]}>
            <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
              Proponer
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sin proponer"
            onPress={onClose}
            style={styles.secondary}>
            <ThemedText type="bodyStrong">Cancelar</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.teal : theme.border,
          backgroundColor: selected ? theme.tealSoft : 'transparent',
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'teal' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: { marginTop: 'auto', gap: Spacing.two },
  primary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Radii.pill },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three },
});
```

- [ ] **Step 6: La tarjeta**

`src/features/session/session-card.tsx`:

```tsx
/**
 * "Sesión Lock-In" en el chat — el diferenciador del producto (ver `CONCEPTO.md`).
 *
 * Sustituye al hueco `LockInCta` del MVP en el mismo sitio. Un solo componente
 * con cinco estados (`cardView`): agendar, esperando respuesta, propuesta
 * recibida, acordada y entrar.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { SessionConflictError, SessionExpiredError, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { cardView } from './card-state';
import { blocksLabel, formatSessionWhen, formatStartsIn } from './format';
import { ProposeSessionSheet } from './propose-session-sheet';
import { useActiveSession } from './use-active-session';

import type { LockInSession, MatchWithProfile, Profile, SessionBlocks } from '@/data';

export function SessionCard({ match, me }: { match: MatchWithProfile; me: Profile | null }) {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const { session, nowMs, refresh } = useActiveSession(match.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const firstName = match.counterpart.name.split(' ')[0];
  const view = cardView(session, me?.id ?? null, nowMs);

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      return true;
    } catch (cause: unknown) {
      setNotice(
        cause instanceof SessionConflictError || cause instanceof SessionExpiredError
          ? 'La sesión ha cambiado.'
          : 'No se ha podido completar. Inténtalo otra vez.'
      );
      return false;
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const propose = async (startsAt: string, blocks: SessionBlocks) => {
    const done = await run(() => repositories.sessions.propose({ matchId: match.id, startsAt, blocks }));
    if (done) setSheetOpen(false);
  };

  const detail = (value: LockInSession) =>
    `${formatSessionWhen(value.startsAt, nowMs)} · ${blocksLabel(value.blocks)}`;

  return (
    <View style={[styles.root, { backgroundColor: theme.tealSoft, borderColor: theme.teal }]}>
      <ThemedText type="label" themeColor="teal">
        Sesión Lock-In
      </ThemedText>

      {view.kind === 'agendar' && (
        <CardButton label="Agendar sesión Lock-In" disabled={busy} onPress={() => setSheetOpen(true)} />
      )}

      {view.kind === 'esperando' && (
        <>
          <ThemedText type="bodyStrong">{`Esperando a ${firstName}`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail(view.session)}
          </ThemedText>
          <CardButton
            label="Cancelar sesión"
            tone="quiet"
            disabled={busy}
            onPress={() => run(() => repositories.sessions.cancel(view.session.id))}
          />
        </>
      )}

      {view.kind === 'recibida' && (
        <>
          <ThemedText type="bodyStrong">{`${firstName} propone una sesión`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail(view.session)}
          </ThemedText>
          <View style={styles.row}>
            <CardButton
              label="Aceptar sesión"
              disabled={busy}
              onPress={() => run(() => repositories.sessions.respond(view.session.id, 'aceptada'))}
            />
            <CardButton
              label="Rechazar sesión"
              tone="quiet"
              disabled={busy}
              onPress={() => run(() => repositories.sessions.respond(view.session.id, 'rechazada'))}
            />
          </View>
        </>
      )}

      {view.kind === 'aceptada' && (
        <>
          <ThemedText type="bodyStrong">Sesión acordada</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${detail(view.session)} · empieza ${formatStartsIn(Date.parse(view.session.startsAt) - nowMs)}`}
          </ThemedText>
          <CardButton
            label="Cancelar sesión"
            tone="quiet"
            disabled={busy}
            onPress={() => run(() => repositories.sessions.cancel(view.session.id))}
          />
        </>
      )}

      {view.kind === 'entrar' && (
        <>
          <ThemedText type="bodyStrong">Es la hora</ThemedText>
          <CardButton
            label="Entrar a la sesión"
            onPress={() =>
              router.push({ pathname: '/session/[sessionId]', params: { sessionId: view.session.id } })
            }
          />
        </>
      )}

      {notice && (
        <ThemedText type="small" themeColor="danger">
          {notice}
        </ThemedText>
      )}

      {sheetOpen && (
        <ProposeSessionSheet
          visible
          me={me}
          counterpart={match.counterpart}
          nowMs={nowMs}
          submitting={busy}
          onSubmit={propose}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </View>
  );
}

function CardButton({
  label,
  onPress,
  disabled = false,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'quiet';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone === 'accent' ? theme.brass : 'transparent',
          borderColor: theme.teal,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="bodyStrong" style={{ color: tone === 'accent' ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
```

En `src/features/session/index.ts`, añadir:

```ts
export { cardView, type CardView } from './card-state';
export { ProposeSessionSheet } from './propose-session-sheet';
export { SessionCard } from './session-card';
export { useActiveSession } from './use-active-session';
```

- [ ] **Step 7: Sustituir el hueco del chat**

En `src/app/chat/[matchId].tsx`:
- Quitar `LockInCta,` del import de `@/features/chat`.
- Añadir `import { SessionCard } from '@/features/session';` después de ese import.
- Sustituir `<LockInCta counterpartName={match.counterpart.name} />` por `<SessionCard match={match} me={me} />`.

En `src/features/chat/index.ts`, borrar la línea `export { LockInCta } from './lock-in-cta';`.

Borrar el hueco del MVP:

```bash
git rm -- src/features/chat/lock-in-cta.tsx src/features/chat/lock-in-cta.test.tsx
```

- [ ] **Step 8: Ejecutar los tests**

Run: `npx jest src/features/session test/app/matchId.test.tsx`
Expected: PASS. En `matchId.test.tsx`, «pone arriba el hueco de Lock-In» sigue en verde porque `SessionCard` conserva la etiqueta `Agendar sesión Lock-In`.

- [ ] **Step 9: Verificación y commit**

Run: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run lint`, `npx prettier --write src/features/session "src/app/chat/[matchId].tsx" src/features/chat/index.ts`
Expected: todo en verde; `grep -rn "LockInCta" src test` sin resultados.

Marcar la Tarea 8 en `docs/plan/todo/sesiones.md`.

```bash
git add -- src/features/session/card-state.ts src/features/session/use-active-session.ts src/features/session/propose-session-sheet.tsx src/features/session/session-card.tsx src/features/session/index.ts src/features/session/card-state.test.ts src/features/session/propose-session-sheet.test.tsx src/features/session/session-card.test.tsx "src/app/chat/[matchId].tsx" src/features/chat/index.ts docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): tarjeta de sesión en el chat y hoja de propuesta"
```

---

### Task 9: Recordatorios locales

**Files:**
- Modify: `package.json`, `package-lock.json` (vía `npx expo install`)
- Modify: `app.json`
- Modify: `jest.setup.js` (cruce con `calidad`: mock de `expo-notifications`)
- Create: `src/features/session/reminders.ts`
- Create: `src/features/session/notifications-port.ts`
- Create: `src/features/session/reminder-permission.ts`
- Create: `src/features/session/session-reminder-sync.tsx`
- Modify: `src/features/session/session-card.tsx` (aviso de permiso)
- Modify: `src/features/session/index.ts`
- Modify: `src/app/(tabs)/_layout.tsx` (cruce con `arquitecto`)
- Test: `src/features/session/reminders.test.ts`
- Test: `src/features/session/notifications-port.test.ts`
- Test: `src/features/session/session-reminder-sync.test.tsx`
- Modify: `src/features/session/session-card.test.tsx`

**Interfaces:**
- Consumes: `LockInSession`, `isSessionLive`, `useRepositories`, `Unsubscribe` de `@/data`.
- Produces:
  ```ts
  // reminders.ts
  export const REMINDER_KEY_PREFIX = 'lockin:reminder:';
  export const REMINDER_LEAD_MS = 5 * 60_000;
  export const SESSIONS_CHANNEL_ID = 'lockin-sessions';
  export interface NotificationsPort {
    ensurePermission(): Promise<boolean>;
    schedule(at: Date, title: string, body: string): Promise<string>;
    cancel(notificationId: string): Promise<void>;
  }
  export interface ReminderStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys(): Promise<readonly string[]>;
  }
  export interface ReminderTarget { session: LockInSession; counterpartName: string }
  export interface ReminderSyncResult { scheduled: string[]; cancelled: string[]; permissionDenied: boolean }
  export function syncReminders(
    targets: ReminderTarget[],
    deps: { notifications: NotificationsPort | null; storage: ReminderStorage; nowMs: number }
  ): Promise<ReminderSyncResult>;
  // notifications-port.ts
  export function createNotificationsPort(): NotificationsPort | null;
  // reminder-permission.ts
  export const HINT_DISMISSED_KEY = 'lockin:reminder-hint-dismissed';
  export function setReminderPermissionDenied(value: boolean): void;
  export function useReminderHint(): { visible: boolean; dismiss(): void };
  // session-reminder-sync.tsx
  export function SessionReminderSync(props: { notifications?: NotificationsPort | null; storage?: ReminderStorage }): null;
  ```

- [ ] **Step 1: Confirmar la API de `expo-notifications` de SDK 57**

La spec lo exige: la página se leyó truncada. Abrir https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ y confirmar, antes de escribir código:
1. `scheduleNotificationAsync({ content, trigger })` devuelve `Promise<string>`.
2. El trigger de fecha es `{ type: SchedulableTriggerInputTypes.DATE, date: Date | number, channelId?: string }`.
3. `cancelScheduledNotificationAsync(id)`, `getPermissionsAsync()`, `requestPermissionsAsync()` (con `granted` y `canAskAgain`), `setNotificationChannelAsync(id, { name, importance })` y `AndroidImportance.HIGH`.
4. Si hace falta plugin en `app.json` para avisos locales, y si en Android 14+ el permiso de alarma exacta hay que pedirlo en tiempo de ejecución.

Si alguna firma difiere, ajustar solo `notifications-port.ts` y el mock del Step 3, y dejar anotada la diferencia en `docs/plan/todo/sesiones.md`. Si en Android 14+ la alarma exacta necesita un permiso en tiempo de ejecución, apuntarlo como casilla nueva en ese TODO: el aviso seguirá llegando, pero puede retrasarse.

- [ ] **Step 2: Instalar y configurar**

Run: `npx expo install expo-notifications`
Expected: `package.json` gana `"expo-notifications": "~57.x.x"`.

En `app.json`, dentro de `expo.android`, después de `"predictiveBackGestureEnabled": false`:

```json
      "predictiveBackGestureEnabled": false,
      "permissions": ["android.permission.SCHEDULE_EXACT_ALARM"]
```

y en `expo.plugins`, después de `"expo-router",`, añadir `"expo-notifications",`.

- [ ] **Step 3: Mock global en Jest**

Al final de `jest.setup.js`:

```js
// `expo-notifications` es nativo. `SessionReminderSync` se monta en el layout de
// tabs, así que cualquier test que lo renderice lo importa. Este doble cubre
// solo lo que usa `src/features/session/notifications-port.ts`; los tests que
// necesiten otro comportamiento sustituyen las funciones con `mockResolvedValue`.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));
```

- [ ] **Step 4: Tests de la reconciliación**

`src/features/session/reminders.test.ts`:

```ts
/**
 * Reconciliación de avisos locales: qué se programa, qué se cancela y qué se
 * deja como está, con un puerto de notificaciones y un almacenamiento falsos.
 */

import { REMINDER_KEY_PREFIX, REMINDER_LEAD_MS, syncReminders } from './reminders';

import type { NotificationsPort, ReminderStorage } from './reminders';
import type { LockInSession } from '@/data';

const MINUTE = 60_000;
const NOW = Date.parse('2026-09-14T10:00:00.000Z');

function memoryStorage(initial: Record<string, string> = {}): ReminderStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
}

function fakePort(granted = true): NotificationsPort & { [K in keyof NotificationsPort]: jest.Mock } {
  return {
    ensurePermission: jest.fn(async () => granted),
    schedule: jest.fn(async () => 'nuevo-id'),
    cancel: jest.fn(async () => undefined),
  };
}

const session = (overrides: Partial<LockInSession> = {}): LockInSession => ({
  id: 's1',
  matchId: 'm1',
  proposedBy: 'nuria',
  startsAt: new Date(NOW + 60 * MINUTE).toISOString(),
  blocks: 2,
  status: 'aceptada',
  createdAt: new Date(NOW - MINUTE).toISOString(),
  respondedAt: new Date(NOW - MINUTE).toISOString(),
  ...overrides,
});

describe('syncReminders', () => {
  it('programa el aviso 5 minutos antes de una sesión aceptada y guarda su id', async () => {
    const notifications = fakePort();
    const storage = memoryStorage();

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });

    expect(notifications.schedule).toHaveBeenCalledWith(
      new Date(NOW + 60 * MINUTE - REMINDER_LEAD_MS),
      'Sesión Lock-In en 5 minutos',
      'Con Núria. Entra desde el chat.'
    );
    expect(storage.data.get(`${REMINDER_KEY_PREFIX}s1`)).toBe('nuevo-id');
    expect(result.scheduled).toEqual(['s1']);
  });

  it('no vuelve a programar lo que ya está programado', async () => {
    const notifications = fakePort();
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}s1`]: 'viejo-id' });

    await syncReminders([{ session: session(), counterpartName: 'Núria' }], { notifications, storage, nowMs: NOW });

    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });

  it('con menos de 5 minutos de margen no programa, pero conserva un aviso previo', async () => {
    const notifications = fakePort();
    const soon = session({ id: 's2', startsAt: new Date(NOW + 4 * MINUTE).toISOString() });
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}s2`]: 'previo' });

    await syncReminders([{ session: soon, counterpartName: 'Núria' }], { notifications, storage, nowMs: NOW });
    await syncReminders([{ session: { ...soon, id: 's3' }, counterpartName: 'Núria' }], {
      notifications,
      storage: memoryStorage(),
      nowMs: NOW,
    });

    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });

  it('cancela y olvida los avisos de sesiones que ya no están aceptadas y vivas', async () => {
    const notifications = fakePort();
    const storage = memoryStorage({
      [`${REMINDER_KEY_PREFIX}cancelada`]: 'id-cancelada',
      [`${REMINDER_KEY_PREFIX}s1`]: 'id-propuesta',
      'otra-clave': 'no es nuestra',
    });

    const result = await syncReminders(
      [{ session: session({ status: 'propuesta', respondedAt: null }), counterpartName: 'Núria' }],
      { notifications, storage, nowMs: NOW }
    );

    expect(notifications.cancel).toHaveBeenCalledWith('id-cancelada');
    expect(notifications.cancel).toHaveBeenCalledWith('id-propuesta');
    expect([...storage.data.keys()]).toEqual(['otra-clave']);
    expect(result.cancelled.sort()).toEqual(['cancelada', 's1']);
  });

  it('con el permiso denegado no programa y lo dice', async () => {
    const notifications = fakePort(false);
    const storage = memoryStorage();

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });

    expect(result.permissionDenied).toBe(true);
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('sin puerto de notificaciones (web) no hace nada', async () => {
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}x`]: 'id' });

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications: null,
      storage,
      nowMs: NOW,
    });

    expect(result).toEqual({ scheduled: [], cancelled: [], permissionDenied: false });
    expect(storage.data.size).toBe(1);
  });
});
```

`src/features/session/notifications-port.test.ts`:

```ts
/** El puerto sobre `expo-notifications`, contra el doble de `jest.setup.js`. */

import * as Notifications from 'expo-notifications';

import { createNotificationsPort } from './notifications-port';
import { SESSIONS_CHANNEL_ID } from './reminders';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createNotificationsPort', () => {
  it('con permiso ya concedido no vuelve a pedirlo', async () => {
    const port = createNotificationsPort()!;

    await expect(port.ensurePermission()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('si no se puede volver a preguntar, lo da por denegado sin pedir', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    const port = createNotificationsPort()!;

    await expect(port.ensurePermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('programa con trigger de fecha en el canal de sesiones y cancela por id', async () => {
    const port = createNotificationsPort()!;
    const at = new Date('2026-09-14T17:55:00.000Z');

    await expect(port.schedule(at, 'Título', 'Cuerpo')).resolves.toBe('notification-id');
    await port.cancel('notification-id');

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Título', body: 'Cuerpo' },
      trigger: { type: 'date', date: at, channelId: SESSIONS_CHANNEL_ID },
    });
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id');
  });
});
```

`src/features/session/session-reminder-sync.test.tsx`:

```tsx
/** `SessionReminderSync` contra el mock real: lee los matches y reconcilia al montar. */

import { render, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, createMockSessionRepository, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { REMINDER_KEY_PREFIX } from './reminders';
import { SessionReminderSync } from './session-reminder-sync';

import type { NotificationsPort, ReminderStorage } from './reminders';

const [NURIA, , ALBA] = SEED_RECIPROCAL_IDS;
const MINUTE = 60_000;

it('programa la sesión aceptada y cancela el aviso de una que ya no está', async () => {
  resetState();
  const repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { match: withNuria } = await repositories.discovery.recordDecision(NURIA, 'like');
  await repositories.discovery.recordDecision(ALBA, 'like');
  const startsAt = new Date(Date.now() + 60 * MINUTE).toISOString();
  const session = await repositories.sessions.propose({ matchId: withNuria!.id, startsAt, blocks: 1 });
  await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');

  const data = new Map([[`${REMINDER_KEY_PREFIX}sesion-antigua`, 'id-antiguo']]);
  const storage: ReminderStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
  const notifications: NotificationsPort = {
    ensurePermission: jest.fn(async () => true),
    schedule: jest.fn(async () => 'id-nuevo'),
    cancel: jest.fn(async () => undefined),
  };

  await render(
    <DataProvider value={repositories}>
      <SessionReminderSync notifications={notifications} storage={storage} />
    </DataProvider>
  );

  await waitFor(() => expect(data.get(`${REMINDER_KEY_PREFIX}${session.id}`)).toBe('id-nuevo'));
  expect(notifications.cancel).toHaveBeenCalledWith('id-antiguo');
  expect(notifications.schedule).toHaveBeenCalledWith(
    new Date(Date.parse(startsAt) - 5 * MINUTE),
    'Sesión Lock-In en 5 minutos',
    'Con Núria. Entra desde el chat.'
  );
});
```

En `src/features/session/session-card.test.tsx`:
- Añadir `import AsyncStorage from '@react-native-async-storage/async-storage';` e `import { setReminderPermissionDenied } from './reminder-permission';`.
- En el `beforeEach`, añadir `await AsyncStorage.clear();` y `setReminderPermissionDenied(false);`.
- Añadir este caso dentro del `describe`:

```tsx
  it('con los avisos denegados lo avisa una vez y se puede descartar', async () => {
    setReminderPermissionDenied(true);

    await renderCard();

    await waitFor(() =>
      expect(screen.getByText('Activa los avisos para no perderte la sesión.')).toBeTruthy()
    );
    await fireEvent.press(screen.getByLabelText('Entendido'));
    expect(screen.queryByText('Activa los avisos para no perderte la sesión.')).toBeNull();
    await expect(AsyncStorage.getItem('lockin:reminder-hint-dismissed')).resolves.toBe('1');
  });
```

- [ ] **Step 5: Ejecutarlos y ver que fallan**

Run: `npx jest src/features/session/reminders.test.ts src/features/session/notifications-port.test.ts src/features/session/session-reminder-sync.test.tsx src/features/session/session-card.test.tsx`
Expected: FAIL por módulos inexistentes.

- [ ] **Step 6: Implementar**

`src/features/session/reminders.ts`:

```ts
/**
 * Avisos locales 5 minutos antes de una sesión aceptada.
 *
 * Reconciliación pura sobre dos puertos: el de notificaciones (nulo en web) y un
 * almacenamiento clave-valor donde se apunta qué aviso corresponde a qué sesión.
 * Idempotente: se puede llamar en cada cambio sin duplicar avisos.
 */

import { isSessionLive } from '@/data';

import type { LockInSession } from '@/data';

export const REMINDER_KEY_PREFIX = 'lockin:reminder:';
export const REMINDER_LEAD_MS = 5 * 60_000;
export const SESSIONS_CHANNEL_ID = 'lockin-sessions';

export interface NotificationsPort {
  /** Crea el canal si hace falta y pide permiso. `true` si se puede avisar. */
  ensurePermission(): Promise<boolean>;
  schedule(at: Date, title: string, body: string): Promise<string>;
  cancel(notificationId: string): Promise<void>;
}

export interface ReminderStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface ReminderTarget {
  session: LockInSession;
  /** Nombre de pila de la otra persona, para el texto del aviso. */
  counterpartName: string;
}

export interface ReminderSyncResult {
  scheduled: string[];
  cancelled: string[];
  permissionDenied: boolean;
}

export async function syncReminders(
  targets: ReminderTarget[],
  deps: { notifications: NotificationsPort | null; storage: ReminderStorage; nowMs: number }
): Promise<ReminderSyncResult> {
  const { notifications, storage, nowMs } = deps;
  const result: ReminderSyncResult = { scheduled: [], cancelled: [], permissionDenied: false };
  if (!notifications) return result;

  const wanted = new Map(
    targets
      .filter(({ session }) => session.status === 'aceptada' && isSessionLive(session, nowMs))
      .map((target) => [target.session.id, target])
  );

  const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(REMINDER_KEY_PREFIX));
  for (const key of keys) {
    const sessionId = key.slice(REMINDER_KEY_PREFIX.length);
    if (wanted.has(sessionId)) continue;
    const notificationId = await storage.getItem(key);
    if (notificationId) await notifications.cancel(notificationId);
    await storage.removeItem(key);
    result.cancelled.push(sessionId);
  }

  for (const [sessionId, { session, counterpartName }] of wanted) {
    const at = Date.parse(session.startsAt) - REMINDER_LEAD_MS;
    if (at <= nowMs) continue;
    const key = `${REMINDER_KEY_PREFIX}${sessionId}`;
    if (await storage.getItem(key)) continue;
    if (!(await notifications.ensurePermission())) {
      result.permissionDenied = true;
      return result;
    }
    const notificationId = await notifications.schedule(
      new Date(at),
      'Sesión Lock-In en 5 minutos',
      `Con ${counterpartName}. Entra desde el chat.`
    );
    await storage.setItem(key, notificationId);
    result.scheduled.push(sessionId);
  }

  return result;
}
```

`src/features/session/notifications-port.ts`:

```ts
/**
 * Puerto de notificaciones sobre `expo-notifications`.
 *
 * `null` en web: la documentación de SDK 57 solo lista Android e iOS, así que
 * el módulo ni se carga. En Android el canal se crea antes de pedir permiso: en
 * Android 13+ el diálogo no aparece sin un canal.
 */

import { Platform } from 'react-native';

import { SESSIONS_CHANNEL_ID } from './reminders';

import type { NotificationsPort } from './reminders';

export function createNotificationsPort(): NotificationsPort | null {
  if (Platform.OS === 'web') return null;

  // `require` y no `import`: en web el módulo no debe entrar en el bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');

  return {
    async ensurePermission() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(SESSIONS_CHANNEL_ID, {
          name: 'Sesiones Lock-In',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    },

    schedule(at, title, body) {
      return Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: SESSIONS_CHANNEL_ID,
        },
      });
    },

    cancel(notificationId) {
      return Notifications.cancelScheduledNotificationAsync(notificationId);
    },
  };
}
```

`src/features/session/reminder-permission.ts`:

```ts
/**
 * "Los avisos están denegados", compartido entre quien lo descubre
 * (`SessionReminderSync`, montado en el layout de tabs) y quien lo enseña
 * (`SessionCard`). El descarte se guarda: la spec pide avisarlo una vez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export const HINT_DISMISSED_KEY = 'lockin:reminder-hint-dismissed';

let denied = false;
const listeners = new Set<() => void>();

export function setReminderPermissionDenied(value: boolean): void {
  if (denied === value) return;
  denied = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getDenied = () => denied;

export function useReminderHint(): { visible: boolean; dismiss: () => void } {
  const isDenied = useSyncExternalStore(subscribe, getDenied, getDenied);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === '1');
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void AsyncStorage.setItem(HINT_DISMISSED_KEY, '1').catch(() => {});
  }, []);

  return { visible: isDenied && dismissed === false, dismiss };
}
```

`src/features/session/session-reminder-sync.tsx`:

```tsx
/**
 * Reconcilia los avisos locales con las sesiones reales. Sin interfaz.
 *
 * Va montado en el layout de tabs para correr al abrir la app: así quien propuso
 * programa su aviso aunque la aceptación llegara con la app cerrada. Repite en
 * cada cambio de matches o de sesiones de cualquier match.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useRepositories } from '@/data';

import { createNotificationsPort } from './notifications-port';
import { setReminderPermissionDenied } from './reminder-permission';
import { syncReminders } from './reminders';

import type { NotificationsPort, ReminderStorage, ReminderTarget } from './reminders';
import type { Unsubscribe } from '@/data';

/** Una sola instancia por proceso: un objeto nuevo por render relanzaría el efecto. */
const defaultNotifications = createNotificationsPort();

export function SessionReminderSync({
  notifications = defaultNotifications,
  storage = AsyncStorage,
}: {
  notifications?: NotificationsPort | null;
  storage?: ReminderStorage;
}) {
  const repositories = useRepositories();

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let pending = false;
    const watched = new Map<string, Unsubscribe>();

    const sync = async () => {
      if (running) {
        pending = true;
        return;
      }
      running = true;
      try {
        const matches = await repositories.matches.list();
        for (const match of matches) {
          if (!watched.has(match.id)) {
            watched.set(match.id, repositories.sessions.subscribe(match.id, () => void sync()));
          }
        }
        const targets: ReminderTarget[] = [];
        for (const match of matches) {
          const session = await repositories.sessions.getActive(match.id);
          if (session) targets.push({ session, counterpartName: match.counterpart.name.split(' ')[0] });
        }
        if (cancelled) return;
        const result = await syncReminders(targets, { notifications, storage, nowMs: Date.now() });
        if (result.permissionDenied) setReminderPermissionDenied(true);
      } catch {
        // Sin red o sin sesión: se reintenta con el siguiente cambio.
      } finally {
        running = false;
        if (pending && !cancelled) {
          pending = false;
          void sync();
        }
      }
    };

    void sync();
    const unsubscribeMatches = repositories.matches.subscribe(() => void sync());

    return () => {
      cancelled = true;
      unsubscribeMatches();
      watched.forEach((unsubscribe) => unsubscribe());
    };
  }, [repositories, notifications, storage]);

  return null;
}
```

En `src/features/session/session-card.tsx`:
- Añadir `import { useReminderHint } from './reminder-permission';` junto a los imports locales.
- Después de `const [notice, setNotice] = useState<string | null>(null);`, añadir `const reminderHint = useReminderHint();`.
- Justo antes de `{notice && (`, añadir:

```tsx
      {reminderHint.visible && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
            Activa los avisos para no perderte la sesión.
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Entendido" onPress={reminderHint.dismiss}>
            <ThemedText type="smallBold" themeColor="teal">
              Entendido
            </ThemedText>
          </Pressable>
        </View>
      )}
```

- En `styles`, añadir `hintText: { flexShrink: 1 },`.

En `src/features/session/index.ts`, añadir `export { SessionReminderSync } from './session-reminder-sync';`.

`src/app/(tabs)/_layout.tsx`:

```tsx
import AppTabs from '@/components/app-tabs';
import { SessionReminderSync } from '@/features/session';

export default function TabsLayout() {
  return (
    <>
      {/* Avisos de sesiones Lock-In: reconcilia al abrir la app. Ver `src/features/session/`. */}
      <SessionReminderSync />
      <AppTabs />
    </>
  );
}
```

- [ ] **Step 7: Ejecutar los tests**

Run: `npx jest src/features/session test/app/layouts.test.tsx`
Expected: PASS. En `layouts.test.tsx`, `TabsLayout` sigue viendo `tabs`: `SessionReminderSync` no pinta nada y el mock de `expo-notifications` evita cargar el módulo nativo.

- [ ] **Step 8: Verificación y commit**

Run: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run lint`, `npm run format:check`
Expected: todo en verde. Si `format:check` marca archivos de esta tarea, `npx prettier --write` sobre esas rutas y repetir.

Marcar la Tarea 9 en `docs/plan/todo/sesiones.md`.

```bash
git add -- package.json package-lock.json app.json jest.setup.js src/features/session/reminders.ts src/features/session/notifications-port.ts src/features/session/reminder-permission.ts src/features/session/session-reminder-sync.tsx src/features/session/session-card.tsx src/features/session/index.ts "src/app/(tabs)/_layout.tsx" src/features/session/reminders.test.ts src/features/session/notifications-port.test.ts src/features/session/session-reminder-sync.test.tsx src/features/session/session-card.test.tsx docs/plan/todo/sesiones.md
git commit -m "feat(sesiones): avisos locales 5 minutos antes de la sesión"
```

---

### Task 10: E2E Android de entrar y salir de una sesión

**Files:**
- Create: `e2e/session-now.sql`
- Create: `e2e/session.yaml`
- Create: `e2e/session.test.mjs`
- Modify: `e2e/run.mjs`
- Modify: `e2e/verify.mjs`

**Interfaces:**
- Consumes: etiquetas `Entrar a la sesión` (Tarea 8), `Salir` y `Salir de la sesión` (Tarea 7); tablas de la Tarea 3; el mensaje `'Mensaje E2E ' + runId` y la ejecución de Maestro de `e2e/run.mjs`.
- Produces: `verifySessionAttendance(status, profileName): Promise<void>` en `e2e/verify.mjs`.

El caso nuevo va aparte de `full-journey.yaml`, que ya tarda unos 3 minutos, y solo en la variante `supabase`: el control negativo no tiene tablas de sesiones que mirar.

- [ ] **Step 1: Guardia del recorrido**

`e2e/session.test.mjs`:

```js
/**
 * Guardia de `session.yaml`: lo que el emulador toca tiene que existir en el
 * código, y el fixture tiene que reconocer el mensaje que teclea el recorrido.
 * Falla en segundos en vez de media hora después en Actions.
 *
 * Corre con `node --test` (`npm run test:e2e`). En Windows este script arrastra
 * los mismos problemas de CRLF que el resto de `e2e/`; la referencia es CI.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(here, path), 'utf8');

const flow = read('session.yaml');
const fixture = read('session-now.sql');
const runner = read('run.mjs');
const card = read('../src/features/session/session-card.tsx');
const screen = read('../src/app/session/[sessionId].tsx');

describe('session.yaml', () => {
  it('toca etiquetas que existen en la tarjeta y en la pantalla', () => {
    assert.match(flow, /tapOn: 'Entrar a la sesión'/);
    assert.match(card, /label="Entrar a la sesión"/);
    assert.match(flow, /tapOn: 'Salir'\r?\n/);
    assert.match(screen, /label="Salir"/);
    assert.match(flow, /tapOn: 'Salir de la sesión'/);
    assert.match(screen, /label="Salir de la sesión"/);
  });

  it('no borra el estado: la sesión cuelga del match que deja full-journey.yaml', () => {
    assert.match(flow, /clearState: false/);
    assert.doesNotMatch(flow, /clearState: true/);
  });

  it('el fixture reconoce el mensaje que teclea el recorrido', () => {
    assert.match(runner, /const message = 'Mensaje E2E ' \+ runId;/);
    assert.match(fixture, /like 'Mensaje E2E %'/);
  });

  it('el runner lo ejecuta tras el oráculo del recorrido y comprueba la asistencia', () => {
    assert.match(runner, /e2e\/session\.yaml/);
    assert.match(runner, /e2e\/session-now\.sql/);
    assert.match(runner, /await verifySessionAttendance\(status, profileName\);/);
  });
});
```

Run: `npm run test:e2e`
Expected: FAIL por `e2e/session.yaml` inexistente. (En Windows fallan además los 2 casos conocidos por CRLF; ver la memoria del proyecto. La referencia es el job "Runner E2E" de CI.)

- [ ] **Step 2: Fixture, recorrido y oráculo**

`e2e/session-now.sql`:

```sql
-- Solo se instala en el Postgres desechable de e2e/.runtime.
-- Simula a la otra persona: cuando el recorrido envía su mensaje, deja en ese
-- match una sesión ya ACEPTADA que empieza 3 minutos después. La ventana de
-- entrada abre 5 minutos antes, así que al llegar `session.yaml` ya se puede
-- entrar: con el reinicio y el oráculo de por medio, la pantalla puede verla
-- todavía en cuenta atrás o ya en el primer bloque, y el recorrido acepta las dos.
--
-- Inserta directamente y no por `propose_session`: la regla de 5 minutos de
-- margen no deja proponer algo que empieza en 3, y lo que se prueba aquí es
-- entrar y salir desde la app, no proponer.

create function public.e2e_session_now() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_other uuid;
begin
  if new.body like 'Mensaje E2E %' then
    select case when m.profile_a = new.sender_id then m.profile_b else m.profile_a end
      into v_other
    from public.matches m
    where m.id = new.match_id;

    insert into public.lockin_sessions (match_id, proposed_by, starts_at, blocks, status, responded_at)
    values (new.match_id, v_other, now() + interval '3 minutes', 1, 'aceptada', now());
  end if;
  return new;
end;
$$;
revoke all on function public.e2e_session_now() from public;
create trigger e2e_session_now after insert on public.messages
for each row execute function public.e2e_session_now();
```

`e2e/session.yaml`:

```yaml
# Entrar y salir de una sesión Lock-In. Lo lanza run.mjs DESPUÉS de
# full-journey.yaml y de su oráculo, sin borrar el estado: usa el match y el
# mensaje de ese recorrido, y la sesión aceptada que deja `session-now.sql`.
# Solo en la variante con credenciales. `e2e/session.test.mjs` fija las
# etiquetas contra el código.
appId: app.lockin.mobile
name: Entrar y salir de una sesión Lock-In
---
- assertTrue: ${MESSAGE}
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: 'Descubrir'
    timeout: 60000
- tapOn: 'Matches'
- extendedWaitUntil:
    visible: 'Conversación con .*${MESSAGE}'
    timeout: 30000
- tapOn: 'Conversación con .*${MESSAGE}'
- extendedWaitUntil:
    visible: 'Entrar a la sesión'
    timeout: 60000
- tapOn: 'Entrar a la sesión'
- extendedWaitUntil:
    visible: 'Empieza en|Trabajo · bloque 1 de 1'
    timeout: 30000
- tapOn: 'Salir'
- tapOn: 'Salir de la sesión'
- extendedWaitUntil:
    visible: 'Mensaje'
    timeout: 30000
```

Al final de `e2e/verify.mjs`:

```js
/**
 * Oráculo de `session.yaml`: la app registró la entrada y la salida confirmada
 * en Postgres. `left_at` no nulo es lo único que distingue "salió pulsando
 * Salir" de "cerró la pantalla", que la spec define como NULL.
 */
export async function verifySessionAttendance(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);
  const { data: rows, error } = await client
    .from('session_attendance')
    .select('*')
    .eq('profile_id', profile.id);
  assert.ifError(error);
  assert.equal(rows.length, 1, 'La app debe registrar una sola asistencia a la sesión');
  assert(rows[0].joined_at, 'Entrar debe guardar joined_at');
  assert(rows[0].left_at, 'Salir confirmando debe guardar left_at');
  console.log('Postgres: entrada y salida de la sesión Lock-In verificadas.');
}
```

- [ ] **Step 3: Enganchar el caso en el runner**

En `e2e/run.mjs`:

Cambiar el import de `./verify.mjs` por:

```js
import { verifyAbsence, verifyPersistence, verifySessionAttendance } from './verify.mjs';
```

Después de `const journeyFile = join(root, 'e2e/full-journey.yaml');`:

```js
// Segundo caso, solo con credenciales: entra y sale de la sesión que deja
// `e2e/session-now.sql` en el match del recorrido. Ver la cabecera de ese `.yaml`.
const sessionFile = join(root, 'e2e/session.yaml');
```

En `prepare`, sustituir el `writeFileSync(join(runtime, 'supabase/seed.sql'), …)` por:

```js
  writeFileSync(
    join(runtime, 'supabase/seed.sql'),
    readFileSync(join(root, 'supabase/seed.sql'), 'utf8') +
      '\n' +
      readFileSync(join(root, 'e2e/incoming-likes.sql'), 'utf8') +
      '\n' +
      readFileSync(join(root, 'e2e/session-now.sql'), 'utf8')
  );
```

En `attempt(dir)`, sustituir:

```js
      await verifyPersistence(status, profileName, message);
      writeFileSync(
        join(dir, 'postgres.json'),
        JSON.stringify({ runId, variant, persistence: 'verified' }, null, 2)
      );
      return { outcome: 'pass', why: 'recorrido completo y persistencia verificados' };
```

por:

```js
      await verifyPersistence(status, profileName, message);

      // Su propia carpeta de evidencia dentro del intento: `diagnose` lee los
      // volcados de Maestro de la carpeta que se le pasa.
      const sessionDir = join(dir, 'session');
      mkdirSync(sessionDir, { recursive: true });
      const sessionRun = spawnSync(
        'maestro',
        [
          'test',
          '--format',
          'junit',
          '--output',
          join(sessionDir, 'maestro.xml'),
          '--debug-output',
          sessionDir,
          '--test-output-dir',
          sessionDir,
          '--flatten-debug-output',
          '-e',
          'MESSAGE=' + message,
          sessionFile,
        ],
        { cwd: root, stdio: 'inherit' }
      );
      if (sessionRun.error) throw sessionRun.error;
      if (sessionRun.status !== 0) {
        const diagnosis = diagnose(sessionDir);
        return { outcome: diagnosis.kind, why: 'session.yaml: ' + diagnosis.why };
      }
      await verifySessionAttendance(status, profileName);

      writeFileSync(
        join(dir, 'postgres.json'),
        JSON.stringify({ runId, variant, persistence: 'verified', session: 'verified' }, null, 2)
      );
      return { outcome: 'pass', why: 'recorrido, persistencia y sesión Lock-In verificados' };
```

Un `runner` de `session.yaml` se reintenta igual que uno de `full-journey.yaml`: el siguiente intento repite los dos casos con un `runId` nuevo, así que no hay estado a medias que confunda al oráculo.

- [ ] **Step 4: Guardias en verde**

Run: `npm run test:e2e`
Expected: los 4 casos de `session.test.mjs` en verde (en Windows, solo los 2 fallos conocidos por CRLF de otras suites).

- [ ] **Step 5: Commit y run en Actions**

Marcar la Tarea 10 en `docs/plan/todo/sesiones.md`.

```bash
git add -- e2e/session-now.sql e2e/session.yaml e2e/session.test.mjs e2e/run.mjs e2e/verify.mjs docs/plan/todo/sesiones.md
git commit -m "test(sesiones): E2E Android de entrar y salir de una sesión"
git push origin claude/startup-cofounder-matching-app-tfeai1
```

El emulador solo existe en Actions (memoria del proyecto). Localizar el run de `E2E Android` del commit y esperarlo:

```bash
gh run list --workflow e2e.yml --limit 5 --json databaseId,headSha,status,conclusion
gh run watch <id> --exit-status
```

Expected: `E2E Android (supabase)` y `E2E Android (mock)` en `success`, y en el log del job `supabase` las dos líneas `Postgres: alta, perfil, …` y `Postgres: entrada y salida de la sesión Lock-In verificadas.`. Si falla, descargar la evidencia con `gh run download <id>` y leer `attempt-*/session/` antes de tocar nada. Anotar el enlace del run verde en `docs/plan/todo/sesiones.md`.

---

### Task 11: Verificación final y tablero

**Files:**
- Modify: `docs/plan/todo/sesiones.md`
- Modify: `docs/plan/TODO.md`

- [ ] **Step 1: Todo el repo en verde en local**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test -- --coverage`
Expected: sin errores; cobertura por encima de 89.82/82.56/91.49/91.38.

Run: `grep -rn "LockInCta\|pendingSessions\|Pendiente de la Tarea 4" src test`
Expected: sin resultados.

- [ ] **Step 2: CI completo del último commit**

```bash
gh run list --limit 6 --json workflowName,headSha,status,conclusion
```

Expected, para el último commit de la rama: `CI` en `success`; `E2E Android` en `success`; `Schema drift` en `success` con el job remoto ejecutado (no `skipped`) y `remote.diff` → `Sin diferencias.`. Un rojo del job remoto aquí es deriva real: la Tarea 3b no está cerrada o la migración aplicada no coincide. Leer `remote.diff` antes de concluir.

- [ ] **Step 3: Contrato opt-in contra Supabase — decidir, no forzar**

La suite de contrato opt-in usaba `dev_reset_current_user()` para limpiar entre casos, y esa función se retiró del proyecto real el 2026-09-13. Sin ella cae al respaldo de un alta anónima por caso, y con los casos de sesiones pasa del límite de 30 altas por hora. No ejecutarla contra `grrzmzktrhksbttpbblg` para sacar un verde. Dejar la casilla "Contrato opt-in contra Supabase" abierta en `docs/plan/todo/sesiones.md` con esta razón escrita, y señalar las dos salidas para que decida el usuario: una base local con Docker, o una función de limpieza solo para una base de pruebas separada. Las reglas sí quedan cubiertas contra Postgres real por el E2E (entrar y salir) y por `session_is_live()` en PGlite.

- [ ] **Step 4: Verificación manual con dos móviles**

Pedir al usuario, con dos dispositivos y dos cuentas que tengan match:
1. Proponer desde uno y aceptar desde el otro; las dos tarjetas pasan a "Sesión acordada" sin recargar.
2. Con la sesión a más de 5 minutos, cerrar la app en el móvil que propuso y comprobar que el aviso llega 5 minutos antes.
3. Entrar desde los dos: el punto pasa a "Está aquí" en ambos; salir desde uno y ver "Aún no ha entrado" en el otro.

Marcar cada casilla de "Verificación manual" solo con lo que el usuario confirme, anotando dispositivo y versión de Android.

- [ ] **Step 5: Tablero maestro y commit**

En `docs/plan/TODO.md`, antes de `## Calidad`, añadir:

```markdown
## Fase 2 — Sesiones Lock-In
- [x] Sesión agendada + Pomodoro compartido + presencia + aviso local — plan `docs/superpowers/plans/2026-09-13-sesiones-lockin.md`, detalle y evidencia en `todo/sesiones.md`
- [ ] Valoración de 1 toque post-sesión (spec propia, lee `session_attendance`)
- [ ] Rachas (spec propia)
- [ ] Vídeo real en la sesión (spec propia)
```

Marcar en el `[x]` solo si los pasos 1, 2 y 4 están cerrados; si no, dejarlo `[ ]` con lo que falta.

Marcar la Tarea 11 en `docs/plan/todo/sesiones.md`.

```bash
git add -- docs/plan/TODO.md docs/plan/todo/sesiones.md
git commit -m "docs(sesiones): cerrar la primera pieza de la Fase 2 con su evidencia"
git push origin claude/startup-cofounder-matching-app-tfeai1
```
