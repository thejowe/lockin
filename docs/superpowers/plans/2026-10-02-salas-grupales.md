# Salas Lock-In grupales — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una persona convoque a 2–4 de sus matches a una sesión Lock-In grupal agendada (Pomodoro 25+5 compartido, presencia «está aquí» por persona, aviso local 5 min antes), que cada invitado acepte o rechace, y que nadie vea a quien no ha aceptado salvo quien convoca.

**Architecture:** dos tablas nuevas (`lockin_rooms`, `room_members`) que el cliente solo lee, con RLS que impone el ciego de invitados; toda escritura por RPC `SECURITY DEFINER` con la sala bloqueada, como `lockin_sessions`. Un `RoomRepository` nuevo en el contrato (mock y Supabase). Presencia por un topic privado nuevo `lockin:room:<uuid>`. La UI vive en `src/features/room/`, con una sección en Matches y dos rutas nuevas (`/room/new`, `/room/[roomId]`). Reutiliza sin modificar las reglas de tiempo de `src/data/sessions.ts`, los errores de `session-errors.ts` y el reloj de `@/features/session`.

**Tech Stack:** Expo SDK 57 + Expo Router (rutas tipadas), `@supabase/supabase-js` v2, Postgres/Supabase, Jest + RNTL 14, PGlite para el SQL, Maestro para el E2E.

**Spec:** `docs/superpowers/specs/2026-10-02-salas-grupales-design.md`. Léela entera antes de la Tarea 1, **empezando por «Decisiones tomadas sin el usuario (revisar)»**: si el usuario ha cambiado alguna, el plan se corrige antes de escribir código.

## Global Constraints

- **Expo ha cambiado**: consulta `https://docs.expo.dev/versions/v57.0.0/` antes de escribir código de Expo, no de memoria (`AGENTS.md`).
- **Cero dependencias nuevas y ninguna build nativa.** Sin vídeo. Si crees que necesitas instalar algo, para y dilo.
- **No se toca Fase 2 por dentro.** `src/data/sessions.ts`, `src/data/session-errors.ts`, `src/app/session/[sessionId].tsx`, `src/features/session/*.ts(x)` (salvo `index.ts`, solo para exportar) y las migraciones de sesiones, rachas y valoración: se importan, no se editan.
- **El ciego de invitados lo impone el servidor** (política de `room_members`). El mock lo replica; la UI no oculta nada por su cuenta como única defensa.
- **Ningún texto libre en la sala**: ni título, ni objetivo, ni chat. Si una tarea te lleva a añadir un campo de texto, para.
- **Quien convoca no es jefe**: el copy dice «Convoca {nombre}» / «Convocas tú». Nunca «anfitrión», «organizador», «admin» ni «tu equipo».
- **No stagees nunca y no uses `git stash`** (memoria del repo: el índice se comparte entre bloques). Commitea con `git commit -m "…" -- <rutas>`. Para un archivo nuevo, antes `git add -N -- <ruta>` (intent-to-add). Comprueba `git branch --show-current` antes de cada commit.
- **No se lanza a la vez que `chat`, `datos`, `sesiones`, `visual` ni que ninguna sesión que toque `src/data/types.ts`, `repositories.ts` o `e2e/run.mjs`.**
- Suelo de cobertura de `jest.config.js`: no bajarlo.
- Paleta: invitación y «Entrar a la sala» en `brass`; «Está aquí» en `teal`; nada en `danger` salvo la confirmación de salir/cancelar. Sin colores nuevos.
- Errores: `LI001`–`LI004` con las clases de `session-errors.ts`; **`LI006` (nuevo)** = invitados inválidos → `RoomInviteError`.

### Cómo se verifica en esta máquina (Windows)

| Comando | ¿Vale como veredicto? |
|---|---|
| `npm test`, `npx jest <ruta>` | Sí |
| `npx tsc --noEmit`, `npm run lint` | Sí |
| `npm run test:schema` | Sí (PGlite, sin Docker) |
| `npx expo export --platform web` | Sí |
| `npm run format:check` | **No**: ~100 falsos por CRLF. `npx prettier --write` sobre lo tocado y veredicto del job «Formato» en CI |
| `npm run test:e2e` | **No**: sus 2 fallos aquí son CRLF |
| E2E Android | Solo en Actions (`e2e.yml`); se diagnostica con `gh run download` |
| Contrato contra Supabase | `.github/workflows/contract.yml` (manual) |

### Nombres reales, ya verificados contra el repo (2026-10-02, `558a75f`)

No los adivines ni inventes helpers: existen con exactamente estos nombres.

| Qué | Dónde |
|---|---|
| `sessionEndsAtMs`, `isValidStartsAt`, `JOIN_WINDOW_MINUTES`, `SESSION_BLOCK_OPTIONS`, `MIN_LEAD_MINUTES`, `MAX_LEAD_DAYS` | `src/data/sessions.ts` |
| `SessionConflictError`, `SessionExpiredError`, `SessionWindowError`, `SessionForbiddenError` | `src/data/session-errors.ts` |
| `useQuery(key, run)` → `{ data, loading, refreshing, error, refresh }`; `useRepositories()` | `src/data/provider.tsx:246`, `:38` |
| `PresenceAdapter`, `PresenceHandlers`, `createMemoryPresenceAdapter()` | `src/data/presence.ts` |
| `createSupabasePresenceAdapter(getClient)` — topic `lockin:presence:${id}` fijo hoy | `src/data/supabase/presence.ts` |
| Fachada perezosa `repositories`, `presence`, `resolveActive()` | `src/data/active.ts` |
| `MockState`, `initialState()`, `MockStore` (`state`, `createId`, `nowMs`, `notify`, `subscribeTo`) | `src/data/mock/store.ts:32`, `:77` |
| `createMockSessionRepository(actorId, store, { autoAcceptFrom })` — patrón a copiar | `src/data/mock/sessions.ts:50` |
| Registro de repositorios en el mock y `SEED_RECIPROCAL_IDS` | `src/data/mock/index.ts` (objeto final), `src/data/mock/seed.ts:298` |
| `createSupabaseSessionRepository(deps)`, `SessionRepositoryDeps`, `toSessionError`, `toIso` | `src/data/supabase/sessions.ts:93`, `:82`, `:77`, `:31` |
| `subscribeResyncingOnRejoin(channel, onRejoin)` | `src/data/supabase/realtime.ts` |
| `toProfile(row)` | `src/data/supabase/mappers.ts:55` |
| Registro en Supabase | `src/data/supabase/index.ts:663` |
| Tipos de filas y `Functions` | `src/data/supabase/database.types.ts` (`SessionRow` `:112`, tablas `:253`, `server_now` `:348`) |
| `ContractFixture`, `ContractBackend`, `describeRepositoryContract`, `itWithTimeTravel` | `src/data/repositories.contract.ts:58`, `:108`, `:152`, `:1061` |
| Fixture del mock: Núria = `reciprocalAId`, Alba = `reciprocalBId`, Marc = `openToBothReciprocalId` | `src/data/mock/index.test.ts:72-85` |
| Fixture de Supabase: `Reciprocal`, `reciprocals`, `sessionRepositoryFor(actor)`, `[parReciprocal, lockinReciprocal, bothReciprocal]` | `src/data/supabase/contract.test.ts:165`, `:296`, `:370` |
| Test SQL único con `auth.uid()` sustituida (`asActor`) y `realtime.topic` por `set local` | `supabase/schema-embedded.test.mjs:339`, `:840-900` |
| Reconciliación de avisos a copiar; `NotificationsPort`, `ReminderStorage`, `REMINDER_LEAD_MS`, `SESSIONS_CHANNEL_ID` | `src/features/session/reminders.ts` |
| `createNotificationsPort()` | `src/features/session/notifications-port.ts:25` |
| `SessionReminderSync` — patrón a copiar | `src/features/session/session-reminder-sync.tsx` |
| `phaseAt`, `formatCountdown`, `useNow`, `formatSessionWhen`, `blocksLabel`, `dayOptions`, `slotsForDay` | `@/features/session` (`index.ts`) |
| Pantalla de sesión (estructura, `Notice`, confirmación de salir, bloques) | `src/app/session/[sessionId].tsx` |
| Corrección de reloj con `serverNow()` | `src/features/session/use-session-room.ts` |
| Relectura al enfocar saltando el primer foco | `src/features/session/use-match-streaks.ts` |
| `ProfileAvatar`, `useMatches` | `@/features/chat` |
| `Button` (`primary`/`secondary`/`danger`), `LoadingState`, `MessageState` | `src/components/button.tsx`, `state-view.tsx` |
| `renderRoute`, `resetRepositories`, `setSearchParams`, `router`, `repositories` | `test/routes.tsx` |
| `Stack.Screen` de rutas con cabecera | `src/app/_layout.tsx:91-110` |
| Siembra E2E con `service_role` y su oráculo | `e2e/verify.mjs:283` (`prepareAgreement`), `:322` |
| Encadenado de flujos E2E | `e2e/run.mjs:862-890` |

### Paralelismo dentro del bloque

Las tareas van en orden. Las únicas parejas que pueden correr a la vez (cada una en su worktree) son:

- **Tarea 1 ∥ Tarea 2**: archivos disjuntos (`src/data/` frente a `supabase/`).
- **Tarea 4 ∥ Tarea 5**: archivos disjuntos (`src/data/supabase/rooms.ts`, `index.ts`, `database.types.ts`, `contract.test.ts` frente a `src/data/supabase/presence.ts`, `active.ts`, `src/data/index.ts`, `src/features/room/use-room-presence.ts`). La Tarea 5 crea `src/features/room/index.ts`; la Tarea 4 no lo toca.

Todo lo demás, una detrás de otra.

## Review Focus

Seis entradas que la spec implica y que ningún caso de su lista nombra. Cada una tiene su test en la tarea dueña:

1. **Una invitada no puede deducir a los demás invitados por ningún camino**: ni por `getById`, ni por `listLive`, ni por `postgres_changes`, ni por el canal de presencia. RLS (Tarea 2), mock (Tarea 3) y la política de `realtime.messages` (Tarea 2) lo fijan cada uno con su test.
2. **Doble toque en «Convocar» o «Me apunto»**: una sola escritura y el botón deshabilitado mientras vuela. Tests en la Tarea 7 y la Tarea 8.
3. **La sala se cancela con la pantalla abierta de una invitada**: al llegar el aviso de `subscribe`, la pantalla pasa a «{Nombre} canceló la sala» sin pantalla rota. Test en la Tarea 8.
4. **Rechazar desde la pantalla de la sala**: tras «No podré ir» la sala deja de ser visible; la pantalla vuelve a Matches en vez de pintar «no disponible». Test en la Tarea 8.
5. **Las dos reconciliaciones de avisos no se pisan**: `syncRoomReminders` nunca cancela una clave `lockin:reminder:` y `syncReminders` nunca una `lockin:room-reminder:`. Test en la Tarea 9.
6. **`create_room` con un array con `null`** o vacío: `LI006`, no un `500` ni un `23502`. Test en la Tarea 2.

---

### Task 0: Alta del bloque `salas` [Claude] — hecha

Hecha en el mismo commit que esta spec y este plan: sección «### 14. `salas`» en `docs/plan/PLAN.md`, hito en `docs/plan/TODO.md`, `docs/plan/todo/salas.md` y `.claude/agents/salas.md`. Si el usuario cambia alguna decisión de la spec, la Tarea 0 se reabre para reflejarlo en esos cuatro archivos antes de seguir.

---

### Task 1: Tipos de dominio y reglas puras [Codex]

Mecánica: el código está aquí entero; criterio de terminado objetivo (tests en verde, `tsc` limpio).

**Files:**
- Modify: `src/data/types.ts` (al final, tras `AgreementAnswerInput`)
- Create: `src/data/rooms.ts`, `src/data/rooms.test.ts`
- Modify: `src/data/index.ts` (una línea: `export * from './rooms';`)

**Interfaces:**
- Consumes: `SessionBlocks`, `Profile` (`types.ts`); `sessionEndsAtMs`, `isValidStartsAt`, `JOIN_WINDOW_MINUTES` (`sessions.ts`).
- Produces: los tipos `RoomMemberStatus`, `LockInRoom`, `RoomMember`, `RoomView`, `RoomInput`; las funciones `roomEndsAtMs`, `isRoomLive`, `isInRoomJoinWindow`, `canRespondToRoom`, `canCancelRoom`, `validateRoomInvitees`; `RoomInviteError`, `ROOM_MIN_INVITEES`, `ROOM_MAX_INVITEES`.

- [ ] **Step 1: Añadir los tipos a `src/data/types.ts`**

Copia literal el bloque «Dominio» de la spec (§1), con sus JSDoc.

- [ ] **Step 2: Escribir los tests que fallan — `src/data/rooms.test.ts`**

Construye las salas con un helper local `room(overrides)` (`startsAt` fijo `2026-10-05T10:00:00.000Z`, `blocks: 2`, `cancelledAt: null`) y `member(status)`. Casos, cada uno un `it`:

- `roomEndsAtMs`: 2 bloques terminan 60 min después de `startsAt`.
- `isRoomLive`: viva 1 ms antes del final; no viva en el ms exacto del final; no viva si `cancelledAt` no es `null` aunque falte una hora.
- `isInRoomJoinWindow`: `aceptada` dentro desde `startsAt − 5 min` exacto (incluido) hasta `endsAt` (excluido); `invitada` nunca; `rechazada` nunca; cancelada nunca.
- `canRespondToRoom`: `invitada` y `aceptada` sí antes de `startsAt`; en el ms exacto de `startsAt`, no; quien convoca nunca (`hostId === me.profileId`); `rechazada` nunca; cancelada nunca.
- `canCancelRoom`: quien convoca antes de `startsAt` sí; en `startsAt`, no; otra persona nunca; ya cancelada, no.
- `validateRoomInvitees`: `null` (válido) con 2 y con 4 matches; `RoomInviteError` con 1, con 5, con un repetido, con el propio id, y con uno que no está en `matchIds`. El mensaje no importa; la clase sí.

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx jest src/data/rooms.test.ts`
Expected: FAIL (`Cannot find module './rooms'`).

- [ ] **Step 4: Implementar `src/data/rooms.ts`**

```ts
/**
 * Reglas de las salas Lock-In grupales (Fase 3).
 *
 * Una sola fuente para el mock, el repositorio de Supabase y la UI. El SQL de
 * `supabase/migrations/20261002000100_lockin_rooms.sql` repite estas mismas
 * reglas en sus RPC: si cambia una, cambian las dos. Las reglas de tiempo son
 * las de las sesiones 1:1 (`./sessions.ts`), que se importan y no se copian.
 */

import { JOIN_WINDOW_MINUTES, sessionEndsAtMs } from './sessions';

import type { LockInRoom, RoomMember } from './types';

export const ROOM_MIN_INVITEES = 2;
export const ROOM_MAX_INVITEES = 4;

const MINUTE = 60_000;

/**
 * Invitados inválidos al convocar: menos de 2 o más de 4, repetidos, tú entre
 * ellos, o alguno que no es match tuyo. `LI006` en Supabase.
 */
export class RoomInviteError extends Error {
  override name = 'RoomInviteError';
}

type RoomTiming = Pick<LockInRoom, 'startsAt' | 'blocks' | 'cancelledAt'>;

export function roomEndsAtMs(room: Pick<LockInRoom, 'startsAt' | 'blocks'>): number {
  return sessionEndsAtMs(room.startsAt, room.blocks);
}

/** Viva: no cancelada y sin terminar. */
export function isRoomLive(room: RoomTiming, nowMs: number): boolean {
  return room.cancelledAt === null && nowMs < roomEndsAtMs(room);
}

/** Se entra desde 5 minutos antes hasta el final, solo si has aceptado. */
export function isInRoomJoinWindow(
  room: RoomTiming,
  me: Pick<RoomMember, 'status'>,
  nowMs: number
): boolean {
  return (
    me.status === 'aceptada' &&
    room.cancelledAt === null &&
    nowMs >= Date.parse(room.startsAt) - JOIN_WINDOW_MINUTES * MINUTE &&
    nowMs < roomEndsAtMs(room)
  );
}

/** Responde quien está invitada o aceptada, sin convocar, antes de empezar. */
export function canRespondToRoom(
  room: RoomTiming & Pick<LockInRoom, 'hostId'>,
  me: Pick<RoomMember, 'status' | 'profileId'>,
  nowMs: number
): boolean {
  return (
    room.hostId !== me.profileId &&
    me.status !== 'rechazada' &&
    room.cancelledAt === null &&
    nowMs < Date.parse(room.startsAt)
  );
}

/** Cancela solo quien convoca, antes de empezar. */
export function canCancelRoom(
  room: RoomTiming & Pick<LockInRoom, 'hostId'>,
  actorId: string,
  nowMs: number
): boolean {
  return (
    room.hostId === actorId && room.cancelledAt === null && nowMs < Date.parse(room.startsAt)
  );
}

/** `null` si los invitados son válidos; si no, el error que lanzar. */
export function validateRoomInvitees(
  inviteeIds: readonly string[],
  actorId: string,
  matchIds: ReadonlySet<string>
): RoomInviteError | null {
  if (inviteeIds.length < ROOM_MIN_INVITEES || inviteeIds.length > ROOM_MAX_INVITEES) {
    return new RoomInviteError(
      `Una sala lleva de ${ROOM_MIN_INVITEES} a ${ROOM_MAX_INVITEES} invitados.`
    );
  }
  if (new Set(inviteeIds).size !== inviteeIds.length) {
    return new RoomInviteError('Hay un invitado repetido.');
  }
  if (inviteeIds.includes(actorId)) return new RoomInviteError('No puedes invitarte a ti.');
  if (inviteeIds.some((id) => !matchIds.has(id))) {
    return new RoomInviteError('Solo puedes invitar a tus matches.');
  }
  return null;
}
```

Y en `src/data/index.ts`, junto a `export * from './agreement';`: `export * from './rooms';`.

- [ ] **Step 5: Verificar**

Run: `npx jest src/data/rooms.test.ts` → PASS. `npx tsc --noEmit` y `npm run lint` limpios.

- [ ] **Step 6: Commit**

```bash
git add -N -- src/data/rooms.ts src/data/rooms.test.ts
git commit -m "feat(salas): tipos de dominio y reglas puras de las salas grupales" -- src/data/types.ts src/data/rooms.ts src/data/rooms.test.ts src/data/index.ts
```

---

### Task 2: Migración SQL y cobertura en PGlite [Codex]

Mecánica: el SQL está aquí entero y la lista de pruebas es cerrada. Criterio: `npm run test:schema` en verde.

**Files:**
- Create: `supabase/migrations/20261002000100_lockin_rooms.sql`
- Modify: `supabase/schema-embedded.test.mjs` (bloque nuevo al final de la prueba única, antes de la retirada)
- Modify (solo si el Step 4 falla por parseo): `supabase/drift-check.mjs`

**Interfaces:**
- Consumes: `public.matches`, `public.profiles`, `public.session_ends_at(timestamptz, smallint)`, el patrón de `20260917000100_realtime_authorization.sql`.
- Produces: tablas `lockin_rooms`, `room_members`; RPC `create_room`, `respond_room`, `cancel_room`, `join_room`, `leave_room`, `live_rooms`; topic privado `lockin:room:<uuid>`. Códigos `LI001`–`LI004`, `LI006`.

- [ ] **Step 1: Escribir la migración**

Si ya existe otra migración con fecha `20261002`, toma el siguiente sufijo libre y cámbialo también en la spec, en `PLAN.md` y en `todo/salas.md`.

```sql
-- LockIn — salas Lock-In grupales (Fase 3).
--
-- Diseño: docs/superpowers/specs/2026-10-02-salas-grupales-design.md.
-- Espejo de `src/data/rooms.ts`; las reglas de tiempo son las de
-- `20260913000100_lockin_sessions.sql` (`session_ends_at`).
--
-- Nadie escribe estas tablas directamente: sin políticas de escritura y con
-- insert/update/delete revocados. Todo pasa por los RPC SECURITY DEFINER de
-- abajo, que validan con la sala bloqueada.
--
-- El ciego de invitados vive en la política de `room_members`: quien convoca
-- ve todas las filas; el resto, la suya y las `aceptada`.

create type public.room_member_status as enum ('invitada', 'aceptada', 'rechazada');

create table public.lockin_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  blocks smallint not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lockin_rooms_blocks_valid check (blocks in (1, 2, 4))
);

comment on table public.lockin_rooms is
  'Salas Lock-In grupales (3-5 personas). Viva/terminada salen de starts_at y blocks, no se guardan.';

create index lockin_rooms_host_idx on public.lockin_rooms (host_id, starts_at desc);

create table public.room_members (
  room_id uuid not null references public.lockin_rooms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.room_member_status not null default 'invitada',
  responded_at timestamptz,
  joined_at timestamptz,
  -- NULL = no salió de forma explícita. Misma semántica que session_attendance.
  left_at timestamptz,
  primary key (room_id, profile_id),
  constraint room_members_responded_iff_not_invited
    check ((status = 'invitada') = (responded_at is null)),
  constraint room_members_left_after_join
    check (left_at is null or joined_at is not null)
);

create index room_members_profile_idx on public.room_members (profile_id);


-- ---------------------------------------------------------------------------
-- Helpers de pertenencia (SECURITY DEFINER: las políticas los llaman sin
-- recursión, y deparsean en una sola línea, que la huella necesita).
-- ---------------------------------------------------------------------------

create or replace function public.is_room_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.profile_id = (select auth.uid())
      and rm.status <> 'rechazada'
  );
$fn$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.lockin_rooms r
    where r.id = p_room_id and r.host_id = (select auth.uid())
  );
$fn$;

create or replace function public.is_room_attendee(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.profile_id = (select auth.uid())
      and rm.status = 'aceptada'
  );
$fn$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.lockin_rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.lockin_rooms from anon;
revoke all on table public.room_members from anon;
revoke insert, update, delete on table public.lockin_rooms from authenticated;
revoke insert, update, delete on table public.room_members from authenticated;

create policy "lockin_rooms: lees las salas en las que estás"
  on public.lockin_rooms for select
  to authenticated
  using (public.is_room_participant(id));

-- El ciego de invitados: una invitada no ve a las demás invitadas.
create policy "room_members: tu fila, las aceptadas y, si convocas, todas"
  on public.room_members for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.is_room_host(room_id) or (status = 'aceptada' and public.is_room_participant(room_id)));


-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_room(
  p_invitee_ids uuid[],
  p_starts_at timestamptz,
  p_blocks smallint
)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_count integer := coalesce(cardinality(p_invitee_ids), 0);
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'create_room: no hay sesión autenticada' using errcode = '28000';
  end if;

  if v_count < 2 or v_count > 4
     or array_position(p_invitee_ids, null) is not null
     or (select count(distinct i) from unnest(p_invitee_ids) as i) <> v_count
     or v_actor = any (p_invitee_ids)
     or exists (
       select 1 from unnest(p_invitee_ids) as i(id)
       where not exists (
         select 1 from public.matches m
         where (m.profile_a = v_actor and m.profile_b = i.id)
            or (m.profile_b = v_actor and m.profile_a = i.id)
       )
     ) then
    raise exception 'create_room: invitados inválidos' using errcode = 'LI006';
  end if;

  if p_blocks is null or p_blocks not in (1, 2, 4)
     or p_starts_at is null
     or p_starts_at < now() + interval '5 minutes'
     or p_starts_at > now() + interval '30 days' then
    raise exception 'create_room: hora o duración fuera de rango' using errcode = 'LI003';
  end if;

  insert into public.lockin_rooms (host_id, starts_at, blocks)
  values (v_actor, p_starts_at, p_blocks)
  returning * into v_room;

  insert into public.room_members (room_id, profile_id, status, responded_at)
  values (v_room.id, v_actor, 'aceptada', now());

  insert into public.room_members (room_id, profile_id)
  select v_room.id, i from unnest(p_invitee_ids) as i;

  return v_room;
end;
$fn$;

-- Bloquea la sala y exige que el actor tenga fila no rechazada. Uso interno.
create or replace function public.lock_room_for_member(p_room_id uuid)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_room public.lockin_rooms;
begin
  if v_actor is null then
    raise exception 'sala Lock-In: no hay sesión autenticada' using errcode = '28000';
  end if;

  select * into v_room from public.lockin_rooms where id = p_room_id for update;
  if not found or not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.profile_id = v_actor and rm.status <> 'rechazada'
  ) then
    raise exception 'sala Lock-In: no existe o no estás en ella' using errcode = 'LI004';
  end if;

  return v_room;
end;
$fn$;

create or replace function public.respond_room(
  p_room_id uuid,
  p_answer public.room_member_status
)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_row public.room_members;
begin
  if p_answer is null or p_answer not in ('aceptada', 'rechazada') then
    raise exception 'respond_room: la respuesta es aceptada o rechazada' using errcode = '22023';
  end if;
  if v_room.host_id = (select auth.uid()) then
    raise exception 'respond_room: quien convoca no responde' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null then
    raise exception 'respond_room: la sala se canceló' using errcode = 'LI001';
  end if;
  if now() >= v_room.starts_at then
    raise exception 'respond_room: la sala ya empezó' using errcode = 'LI002';
  end if;

  update public.room_members
     set status = p_answer,
         responded_at = case when status = p_answer then responded_at else now() end
   where room_id = p_room_id and profile_id = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.cancel_room(p_room_id uuid)
returns public.lockin_rooms
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
begin
  if v_room.host_id <> (select auth.uid()) then
    raise exception 'cancel_room: solo cancela quien convoca' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null then
    raise exception 'cancel_room: ya estaba cancelada' using errcode = 'LI001';
  end if;
  if now() >= v_room.starts_at then
    raise exception 'cancel_room: ya ha empezado' using errcode = 'LI002';
  end if;

  update public.lockin_rooms set cancelled_at = now() where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$fn$;

create or replace function public.join_room(p_room_id uuid)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_row public.room_members;
begin
  if not public.is_room_attendee(p_room_id) then
    raise exception 'join_room: no has aceptado la invitación' using errcode = 'LI004';
  end if;
  if v_room.cancelled_at is not null
     or now() < v_room.starts_at - interval '5 minutes'
     or now() >= public.session_ends_at(v_room.starts_at, v_room.blocks) then
    raise exception 'join_room: fuera de la ventana de entrada' using errcode = 'LI003';
  end if;

  update public.room_members
     set joined_at = coalesce(joined_at, now()), left_at = null
   where room_id = p_room_id and profile_id = (select auth.uid())
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.leave_room(p_room_id uuid)
returns public.room_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_room public.lockin_rooms := public.lock_room_for_member(p_room_id);
  v_row public.room_members;
begin
  update public.room_members
     set left_at = now()
   where room_id = v_room.id
     and profile_id = (select auth.uid())
     and joined_at is not null
  returning * into v_row;

  if not found then
    raise exception 'leave_room: no habías entrado en la sala' using errcode = 'LI003';
  end if;

  return v_row;
end;
$fn$;

-- Salas vivas en las que estás, con el reloj de Postgres. SECURITY INVOKER:
-- la RLS de `lockin_rooms` ya limita a las tuyas no rechazadas.
create or replace function public.live_rooms()
returns setof public.lockin_rooms
language sql
stable
set search_path = ''
as $fn$
  select r.*
  from public.lockin_rooms r
  where r.cancelled_at is null
    and now() < public.session_ends_at(r.starts_at, r.blocks)
  order by r.starts_at, r.id
  limit 20;
$fn$;


-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function public.is_room_participant(uuid) from public, anon;
revoke execute on function public.is_room_host(uuid) from public, anon;
revoke execute on function public.is_room_attendee(uuid) from public, anon;
revoke execute on function public.create_room(uuid[], timestamptz, smallint) from public, anon;
revoke execute on function public.lock_room_for_member(uuid) from public, anon, authenticated;
revoke execute on function public.respond_room(uuid, public.room_member_status) from public, anon;
revoke execute on function public.cancel_room(uuid) from public, anon;
revoke execute on function public.join_room(uuid) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.live_rooms() from public, anon;

grant execute on function public.is_room_participant(uuid) to authenticated;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.is_room_attendee(uuid) to authenticated;
grant execute on function public.create_room(uuid[], timestamptz, smallint) to authenticated;
grant execute on function public.respond_room(uuid, public.room_member_status) to authenticated;
grant execute on function public.cancel_room(uuid) to authenticated;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.live_rooms() to authenticated;


-- ---------------------------------------------------------------------------
-- Realtime — sostiene `RoomRepository.subscribe`. postgres_changes filtra por
-- RLS, así que el ciego de invitados también vale por aquí.
-- ---------------------------------------------------------------------------

alter table public.lockin_rooms replica identity full;
alter table public.room_members replica identity full;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lockin_rooms;
    alter publication supabase_realtime add table public.room_members;
  end if;
end;
$do$;


-- ---------------------------------------------------------------------------
-- Presencia — topic privado `lockin:room:<uuid>`, solo para quien ha aceptado.
-- Mismo diseño que `20260917000100_realtime_authorization.sql`; su guarda de
-- RLS en `realtime.messages` ya corrió allí.
-- ---------------------------------------------------------------------------

create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce(
    public.is_room_attendee(
      substring(
        p_topic
        from '^lockin:room:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
      )::uuid
    ),
    false
  );
$fn$;

revoke execute on function public.is_room_topic_member(text) from public, anon;
grant execute on function public.is_room_topic_member(text) to authenticated;

drop policy if exists "lockin: recibes de los canales de tus salas" on realtime.messages;
create policy "lockin: recibes de los canales de tus salas"
  on realtime.messages
  for select
  to authenticated
  using (
    extension in ('broadcast', 'presence')
    and public.is_room_topic_member((select realtime.topic()))
  );

drop policy if exists "lockin: envías a los canales de tus salas" on realtime.messages;
create policy "lockin: envías a los canales de tus salas"
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and public.is_room_topic_member((select realtime.topic()))
  );
```

- [ ] **Step 2: Escribir el bloque de PGlite que falla**

En `supabase/schema-embedded.test.mjs`, un bloque nuevo con comentario de cabecera «Salas grupales», con el mismo estilo que el del acuerdo (`asActor`, `sonda` con savepoint que devuelve el `errcode`). Prepara: cuatro perfiles (Ana convoca; Bea y Carla, matches de Ana; Dani, sin match con Ana) y los dos matches `Ana–Bea` y `Ana–Carla` insertados como superusuario. Pruebas, cada una con su `assert`:

1. **Ciego de invitados** (el test central del bloque): como Ana, `create_room([Bea, Carla], now()+1h, 2)`. Como Bea, `select profile_id, status from room_members` devuelve **solo** Ana (`aceptada`) y Bea (`invitada`), no Carla. Como Carla, `respond_room(sala, 'aceptada')`. Como Bea, ahora salen las tres. Como Ana, siempre las tres con su estado.
2. Como Dani: `select` de `lockin_rooms` y de `room_members` devuelve cero filas; `respond_room` y `join_room` → `LI004`.
3. `create_room` como Ana → `LI006` con: `[Bea]`, `[Bea, Carla, Dani]` (Dani no es match), `[Bea, Bea]`, `[Bea, Ana]`, `array[]::uuid[]`, `array[Bea, null]`; y cinco ids → `LI006`. Hora a 1 min → `LI003`.
4. `respond_room` como Ana (convoca) → `LI004`; `cancel_room` como Bea → `LI004`; `join_room` como Bea mientras está `invitada` → `LI004`.
5. Bea rechaza: como Bea, `select` de `lockin_rooms` devuelve cero filas y `respond_room(sala, 'aceptada')` → `LI004`; como Carla, Bea no aparece; como Ana, aparece `rechazada`.
6. `cancel_room` como Ana; después `respond_room` como Carla → `LI001`; `live_rooms()` como Ana no la devuelve.
7. Ventana: una sala de Ana con `starts_at` puesta a `now() + 2 min` por `update` de superusuario y Carla `aceptada`: `join_room` como Carla devuelve `joined_at` no nulo; segundo `join_room` conserva el mismo `joined_at`; `leave_room` pone `left_at`; `join_room` de nuevo lo pone a `null`. Con `starts_at` a `now() + 1 h`, `join_room` → `LI003`.
8. Escritura directa como `authenticated`: `insert into room_members …` y `update lockin_rooms set cancelled_at = now()` fallan por permisos (`42501`).
9. **Presencia**: con `set local "realtime.topic" = 'lockin:room:<sala>'` y rol `authenticated`, la política de `select` de `realtime.messages` deja pasar a Carla (`aceptada`) y no a Bea (`invitada`) ni a Dani. Un topic `lockin:room:no-es-uuid` se deniega sin error. Mismo patrón que el bloque de `lockin:presence:` (`:840-900`).
10. `has_function_privilege('anon', 'public.create_room(uuid[], timestamptz, smallint)', 'EXECUTE')` es `false`, y `authenticated` no tiene `EXECUTE` sobre `lock_room_for_member(uuid)`.

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npm run test:schema` → FAIL en el bloque nuevo antes de existir la migración (si lo escribiste primero), PASS el resto.

- [ ] **Step 4: Ejecutar con la migración**

Run: `npm run test:schema`
Expected: PASS entero, incluida la comparación de huella. Si `drift-check.mjs` o la huella no reconocen las tablas nuevas, ajusta solo el parseo (mismo precedente que `seeking_specialties`) y dilo en el commit.

- [ ] **Step 5: Commit**

```bash
git add -N -- supabase/migrations/20261002000100_lockin_rooms.sql
git commit -m "feat(salas): migración de salas grupales con el ciego de invitados en RLS" -- supabase/migrations/20261002000100_lockin_rooms.sql supabase/schema-embedded.test.mjs
```

---

### Task 3: Contrato, mock y registro [Claude]

Cruza `arquitecto` (contrato, fachada, store) y decide la forma de los casos que corre también Supabase: por eso es `[Claude]`.

**Files:**
- Modify: `src/data/repositories.ts` (`RoomRepository`; `rooms` en `Repositories`)
- Modify: `src/data/repositories.contract.ts` (`roomsFor` en `ContractFixture`; `describe('rooms', …)` con los doce casos)
- Create: `src/data/mock/rooms.ts`, `src/data/mock/rooms.test.ts`
- Modify: `src/data/mock/store.ts` (`rooms: LockInRoom[]`, `roomMembers: RoomMember[]` en `MockState` e `initialState()`)
- Modify: `src/data/mock/index.ts` (registro y re-export de `createMockRoomRepository`)
- Modify: `src/data/mock/index.test.ts` (`roomsFor`)
- Modify: `src/data/active.ts` (getter `rooms`)
- Modify: `src/data/supabase/contract.test.ts` y `src/data/supabase/index.ts` **solo** con un `roomsFor`/`rooms` que lance `new Error('rooms: Tarea 4')`, para que `tsc` pase y el contrato opt-in no se ejecute a medias. La Tarea 4 los sustituye.

**Interfaces:**
- Consumes: Tarea 1.
- Produces: `RoomRepository` (firma literal de la spec §1), `Repositories.rooms`, `ContractFixture.roomsFor(profileId): RoomRepository`, `createMockRoomRepository(actorId, store?, { autoAcceptFrom? })`, tópico del mock `'rooms'`.

- [ ] **Step 1: Contrato**

Añade `RoomRepository` a `repositories.ts` con el JSDoc de la spec y las reglas en una línea (como el de `LockInSessionRepository`), y `rooms: RoomRepository` en `Repositories`.

- [ ] **Step 2: Casos de contrato que fallan**

En `repositories.contract.ts`, `ContractFixture` gana:

```ts
/**
 * Salas actuando como cualquiera de los perfiles de apoyo (`reciprocalAId`,
 * `reciprocalBId`, `openToBothReciprocalId`). El usuario del test usa
 * `repositories.rooms`.
 */
roomsFor(profileId: string): RoomRepository;
```

Y un `describe('rooms', …)` con los doce casos de la spec §1, en ese orden y con esos títulos en castellano. Preparación común en un `beforeEach` del `describe`: `prepareSwiper()` y `like` a `reciprocalAId` y `reciprocalBId` (quedan como matches); `openToBothReciprocalId` no recibe like y hace de tercero. Hora: copia en el `describe('rooms')` los helpers `startsIn`/`soon`/`later` del `describe('sessions')` (`repositories.contract.ts:1085`; están en su ámbito y no se pueden importar): `later()` = dentro de 1 h, `soon()` = dentro de 5 min + 2 s. El caso 9 entra en ventana con `soon()` + `fixture.elapse(3_000)`, como los casos de sesiones, y comprueba «fuera de ventana» con `later()`. El caso 12 va con `itWithTimeTravel`.

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx jest src/data/mock/index.test.ts -t rooms` → FAIL (`roomsFor is not a function` / `rooms` indefinido).

- [ ] **Step 4: Mock**

`src/data/mock/rooms.ts`, copiando la forma de `createMockSessionRepository`:

- `isMatch(a, b)`: `state.matches.some(m => m.profileIds.includes(a) && m.profileIds.includes(b))`.
- `create`: `validateRoomInvitees(inviteeIds, actorId, matchesDelActor)` y `isValidStartsAt` (`SessionWindowError`); inserta sala y filas (convoca `aceptada` con `respondedAt`, invitados `invitada`). Con `autoAcceptFrom`, los invitados de ese conjunto pasan a `aceptada` en el acto.
- `visibleTo(room, actorId)`: la fila del actor existe y no es `rechazada`.
- `toView(room)`: `me` = fila del actor; `others` = las demás filas **filtradas con la regla de la política** (convoca → todas; si no → `aceptada`), ordenadas por `profileId`, con `profile` de `state.profiles` (las que no tengan perfil se omiten).
- `listLive`: salas visibles con `isRoomLive(room, store.nowMs())`, por `startsAt` e `id`.
- `respond`/`cancel`/`join`/`leave`: los mismos chequeos y en el mismo orden que la RPC de la Tarea 2, con las clases de `session-errors.ts`.
- Cada escritura `notify('rooms')`; `subscribe` → `subscribeTo('rooms', listener)`.

Tests propios en `src/data/mock/rooms.test.ts` solo para lo que el contrato no ve: `autoAcceptFrom` acepta al instante; un perfil inexistente en `others` se omite sin romper.

Registro en `src/data/mock/index.ts`:

```ts
rooms: createMockRoomRepository(CURRENT_USER_ID, store, {
  autoAcceptFrom: autoAcceptSessions ? SEED_RECIPROCAL_IDS : [],
}),
```

Fixture del mock (`index.test.ts`): `roomsFor: (profileId) => createMockRoomRepository(profileId)`.

Fachada (`active.ts`): `get rooms() { return resolveActive().repositories.rooms; },`.

- [ ] **Step 5: Verificar**

Run: `npx jest src/data` → PASS. `npx tsc --noEmit`, `npm run lint` limpios. `npm test` con cobertura sobre el suelo.

- [ ] **Step 6: Commit**

```bash
git add -N -- src/data/mock/rooms.ts src/data/mock/rooms.test.ts
git commit -m "feat(salas): contrato RoomRepository, casos y mock con el ciego de invitados" -- src/data/repositories.ts src/data/repositories.contract.ts src/data/mock/rooms.ts src/data/mock/rooms.test.ts src/data/mock/store.ts src/data/mock/index.ts src/data/mock/index.test.ts src/data/active.ts src/data/supabase/index.ts src/data/supabase/contract.test.ts
```

---

### Task 4: Repositorio de Supabase [Codex]

Mecánica con patrón que copiar (`src/data/supabase/sessions.ts`) contra una interfaz ya congelada por la Tarea 3. Criterio: unitarios en verde y `contract.yml` en verde.

**Files:**
- Create: `src/data/supabase/rooms.ts`, `src/data/supabase/rooms.test.ts`
- Modify: `src/data/supabase/database.types.ts` (`RoomRow`, `RoomMemberRow`, tablas y `Functions`)
- Modify: `src/data/supabase/index.ts` (sustituir el stub de la Tarea 3 por `rooms: createSupabaseRoomRepository()`)
- Modify: `src/data/supabase/contract.test.ts` (sustituir el stub de `roomsFor`)

**Interfaces:**
- Consumes: Tareas 2 y 3.
- Produces: `createSupabaseRoomRepository(deps?: RoomRepositoryDeps)`, `toLockInRoom`, `toRoomMember`, `toRoomError`.

- [ ] **Step 1: Tipos**

En `database.types.ts`, siguiendo `SessionRow`/`SessionAttendanceRow`:

```ts
/** Fila de `public.lockin_rooms`. Solo se escribe por RPC. */
export type RoomRow = {
  id: string;
  host_id: string;
  starts_at: string;
  blocks: SessionBlocks;
  cancelled_at: string | null;
  created_at: string;
};

/** Fila de `public.room_members`. La RLS aplica el ciego de invitados. */
export type RoomMemberRow = {
  room_id: string;
  profile_id: string;
  status: 'invitada' | 'aceptada' | 'rechazada';
  responded_at: string | null;
  joined_at: string | null;
  left_at: string | null;
};
```

Tablas `lockin_rooms` y `room_members` con `Insert`/`Update: Record<string, never>` y `Relationships: []`, como `lockin_sessions`. `Functions`: `create_room` (`{ p_invitee_ids: string[]; p_starts_at: string; p_blocks: SessionBlocks }` → `RoomRow`), `respond_room` (`{ p_room_id: string; p_answer: 'aceptada' | 'rechazada' }` → `RoomMemberRow`), `cancel_room` → `RoomRow`, `join_room`/`leave_room` → `RoomMemberRow`, `live_rooms` (`Record<string, never>` → `RoomRow[]`).

- [ ] **Step 2: Tests unitarios que fallan — `rooms.test.ts`**

Copia la forma de `src/data/supabase/sessions.test.ts` (cliente falso inyectado): mapeo de filas con `toIso`; `toRoomError` traduce `LI001`–`LI004` a las clases de `session-errors.ts` y `LI006` a `RoomInviteError`, y deja intacto cualquier otro código; `getById` arma `RoomView` con `me` y `others` con `toProfile`, y devuelve `null` si no hay fila de sala o no hay fila propia; `listLive` llama a `live_rooms` y hace **una** lectura de `room_members` (`.in('room_id', ids)`) y **una** de `profiles` (`.in('id', ids)`) para todas las salas, no una por sala.

- [ ] **Step 3: Implementar `src/data/supabase/rooms.ts`**

- Deps inyectables como `SessionRepositoryDeps` (`getClient`, `getUserId`).
- Lecturas: `getById` → `from('lockin_rooms').select('*').eq('id', id).maybeSingle()`, luego `room_members` y `profiles` como arriba. `listLive` → `rpc('live_rooms')` y las mismas dos lecturas en lote. Sin `select` embebido (`Relationships: []` no lo tipa).
- Escrituras: `rpc('create_room' | 'respond_room' | 'cancel_room' | 'join_room' | 'leave_room')`, `toRoomError` en el `error`. `create` relee con `getById` para devolver `RoomView`.
- Tras cada escritura propia, avisa a los listeners al momento (como `changed` en `sessions.ts`).
- `subscribe`: un solo canal `lockin:rooms` con `postgres_changes` sobre `lockin_rooms` y `room_members` (sin filtro: RLS acota), envuelto en `subscribeResyncingOnRejoin`; se cierra al irse el último listener.

- [ ] **Step 4: Registro y fixture**

`src/data/supabase/index.ts`: `rooms: createSupabaseRoomRepository(),` junto a `agreement`. En `contract.test.ts`:

```ts
function roomRepositoryFor(actor: Reciprocal): RoomRepository {
  const { createSupabaseRoomRepository } = require('./rooms') as typeof import('./rooms');
  return createSupabaseRoomRepository({
    getClient: () => actor.client,
    getUserId: async () => actor.id,
  });
}
```

y en el fixture `roomsFor: (profileId) => roomRepositoryFor(reciprocals.find((r) => r.id === profileId)!)` (lanza con mensaje claro si no lo encuentra).

- [ ] **Step 5: Verificar**

Run: `npx jest src/data/supabase` → PASS. `tsc`, lint limpios. Empuja la rama y lanza `contract.yml` a mano (`gh workflow run contract.yml --ref <rama>`); anota el run en `todo/salas.md`. Los casos con `itWithTimeTravel` salen saltados a propósito.

- [ ] **Step 6: Commit**

```bash
git add -N -- src/data/supabase/rooms.ts src/data/supabase/rooms.test.ts
git commit -m "feat(salas): repositorio de salas contra Supabase" -- src/data/supabase/rooms.ts src/data/supabase/rooms.test.ts src/data/supabase/database.types.ts src/data/supabase/index.ts src/data/supabase/contract.test.ts
```

---

### Task 5: Presencia de sala [Codex]

Mecánica: un parámetro con valor por defecto y un hook pequeño. Criterio: tests en verde.

**Files:**
- Modify: `src/data/supabase/presence.ts` (+ `presence.test.ts`)
- Modify: `src/data/active.ts`, `src/data/index.ts`
- Create: `src/features/room/use-room-presence.ts`, `use-room-presence.test.ts`, `src/features/room/index.ts`

**Interfaces:**
- Consumes: `PresenceAdapter`, `createMemoryPresenceAdapter`.
- Produces: `createSupabasePresenceAdapter(getClient?, topicPrefix = 'lockin:presence:')`; `roomPresence: PresenceAdapter` exportado desde `@/data`; `useRoomPresence(roomId | null, myProfileId | null, adapter = roomPresence): { online: boolean; presentIds: ReadonlySet<string> }`.

- [ ] **Step 1: Tests que fallan**

- `presence.test.ts`: con `topicPrefix = 'lockin:room:'`, el canal se abre como `lockin:room:<id>` con `private: true`; sin argumento sigue siendo `lockin:presence:<id>` (el test que ya existe no cambia).
- `use-room-presence.test.ts` (con `createMemoryPresenceAdapter()` inyectado): con `roomId` `null` no entra; dos perfiles en la misma sala se ven; al desmontar sale; `onConnection(false)` da `online: false`.

- [ ] **Step 2: Implementar**

`presence.ts`: segundo parámetro `topicPrefix = 'lockin:presence:'` y `client.channel(\`${topicPrefix}${sessionId}\`, …)`. Nada más cambia.

`active.ts`: `Active` gana `roomPresence: PresenceAdapter`; en la rama Supabase `createSupabasePresenceAdapter(undefined, 'lockin:room:')`, en la mock otro `createMemoryPresenceAdapter()` (instancia propia: los ids de sala y de sesión no se mezclan). Export:

```ts
/** Presencia en salas grupales, con la misma regla. Topic `lockin:room:<id>`. */
export const roomPresence: PresenceAdapter = {
  join: (roomId, profileId, handlers) =>
    resolveActive().roomPresence.join(roomId, profileId, handlers),
};
```

`src/data/index.ts`: añade `roomPresence` al `export { presence, repositories, videoSignal } from './active';`.

`use-room-presence.ts`: como `useCounterpartPresence`, pero devuelve el conjunto entero. `index.ts` de `src/features/room/` con la cabecera «Superficie pública del bloque `salas`. Las rutas de `src/app/` importan siempre desde aquí.» y el export del hook.

- [ ] **Step 3: Verificar y commit**

Run: `npx jest src/data/supabase/presence.test.ts src/features/room src/data/active.test.ts` → PASS; `tsc`, lint.

```bash
git add -N -- src/features/room/use-room-presence.ts src/features/room/use-room-presence.test.ts src/features/room/index.ts
git commit -m "feat(salas): presencia por sala en el topic privado lockin:room" -- src/data/supabase/presence.ts src/data/supabase/presence.test.ts src/data/active.ts src/data/index.ts src/features/room/use-room-presence.ts src/features/room/use-room-presence.test.ts src/features/room/index.ts
```

---

### Task 6: Fila de sala y lista viva [Codex]

Mecánica: función pura con su tabla de verdad, un componente de presentación y un hook con patrón existente (`useMatchStreaks`).

**Files:**
- Create: `src/features/room/row-view.ts` (+ test), `room-row.tsx` (+ test), `use-live-rooms.ts` (+ test)
- Modify: `src/features/room/index.ts`

**Interfaces:**
- Consumes: `RoomView`, `isInRoomJoinWindow`, `formatSessionWhen`, `blocksLabel`.
- Produces: `roomRowView(view: RoomView, nowMs: number): { kind: 'invitada' | 'convocas' | 'aceptada' | 'entrar'; title: string; detail: string; accent: 'brass' | null }`; `<RoomRow view onPress />`; `useLiveRooms(): { rooms: RoomView[]; loading: boolean; error: Error | null; refresh(): void }`.

- [ ] **Step 1: Tests que fallan**

- `row-view.test.ts`: los cuatro estados de la tabla de la spec §2 con sus textos exactos («{Nombre} te invita», «Tu sala · … · {k} de {n} han aceptado», «Sala · … · {k} personas», «Entrar a la sala»); `entrar` gana a `convocas` cuando quien convoca está en ventana; el nombre es el de pila (`name.split(' ')[0]`). En `convocas`, `k` cuenta las filas `aceptada` **sin contar a quien convoca** y `n` es el número de invitados (todos los `others`). En `aceptada`, «{k} personas» cuenta a todas las que van, tú incluida.
- `room-row.test.tsx`: pinta título y detalle; `accessibilityRole="button"` y un `accessibilityLabel` que junta los dos; `onPress` al tocar.
- `use-live-rooms.test.tsx`: lee `rooms.listLive()` al montar; relee con `rooms.subscribe`; relee al volver a enfocar y **no** en el primer foco; un tic de 30 s (`useNow(30_000)`) saca una sala que termina con la pantalla abierta (filtra con `isRoomLive`).

- [ ] **Step 2: Implementar**, exportar desde `index.ts`, verificar (`npx jest src/features/room`, `tsc`, lint) y commit:

```bash
git add -N -- src/features/room/row-view.ts src/features/room/row-view.test.ts src/features/room/room-row.tsx src/features/room/room-row.test.tsx src/features/room/use-live-rooms.ts src/features/room/use-live-rooms.test.tsx
git commit -m "feat(salas): fila de sala y lista de salas vivas" -- src/features/room/
```

---

### Task 7: Convocar una sala [Claude]

Copy, orden de los selectores y estados vacíos son criterio de producto: `[Claude]`.

**Files:**
- Create: `src/features/room/invitee-picker.tsx` (+ test)
- Create: `src/app/room/new.tsx`, `test/app/room-new.test.tsx`
- Modify: `src/app/_layout.tsx` (`Stack.Screen name="room/new"` con las opciones de cabecera de `agreement/[matchId]`)
- Modify: `src/features/room/index.ts`

**Interfaces:**
- Consumes: `useMatches`, `ProfileAvatar` (`@/features/chat`); `dayOptions`, `slotsForDay`, `formatTimeOfDay`, `blocksLabel` (`@/features/session`); `SESSION_BLOCK_OPTIONS`, `ROOM_MAX_INVITEES`, `ROOM_MIN_INVITEES`, `RoomInviteError` (`@/data`).
- Produces: `<InviteePicker matches selected onToggle />`, ruta `/room/new`.

- [ ] **Step 1: Tests que fallan**

- `invitee-picker.test.tsx`: un chip por match con `accessibilityRole="checkbox"` y `accessibilityState.checked`; contador «{k} de 4»; con 4 marcados, los no marcados quedan `disabled`; desmarcar uno los vuelve a habilitar.
- `test/app/room-new.test.tsx` (mock con dos matches recíprocos hechos con `recordDecision`): «Convocar» deshabilitado con 0 y 1 marcados; con 2, convoca, llama `router.replace('/room/<id>')` y **una sola** escritura aunque se toque dos veces (Review Focus 2); con menos de 2 matches, «Necesitas al menos 2 matches para convocar una sala» y enlace a Descubrir; un `RoomInviteError` del repositorio sale como texto, no como pantalla rota.

- [ ] **Step 2: Implementar.** Pantalla: título «Convocar sala Lock-In», secciones «Con quién», «Cuándo», «Cuánto»; preselección del próximo tramo válido (`slotsForDay(dayOptions(now)[0], now)[0]`, saltando a mañana si hoy no queda ninguno). Sin campo de texto (Global Constraints).

- [ ] **Step 3: Verificar** (`npx jest src/features/room test/app/room-new.test.tsx test/app/layouts.test.tsx`, `tsc`, lint, `npx expo export --platform web`) **y commit**:

```bash
git add -N -- src/features/room/invitee-picker.tsx src/features/room/invitee-picker.test.tsx src/app/room/new.tsx test/app/room-new.test.tsx
git commit -m "feat(salas): pantalla para convocar una sala entre tus matches" -- src/features/room/ src/app/room/new.tsx test/app/room-new.test.tsx src/app/_layout.tsx
```

---

### Task 8: Pantalla de la sala y sección en Matches [Claude]

La pantalla con más estados del bloque y el cruce con `chat`: `[Claude]`.

**Files:**
- Create: `src/features/room/use-room.ts` (+ test), `src/features/room/rooms-section.tsx` (+ test)
- Create: `src/app/room/[roomId].tsx`, `test/app/roomId.test.tsx`
- Modify: `src/app/_layout.tsx` (`Stack.Screen name="room/[roomId]"`)
- Modify: `src/app/(tabs)/matches.tsx` (una línea, `<RoomsSection />` en `ListHeaderComponent` bajo el título) + `test/app/matches.test.tsx`
- Modify: `src/features/room/index.ts`

**Interfaces:**
- Consumes: Tareas 5 y 6; `phaseAt`, `formatCountdown`, `useNow`, `formatSessionWhen`, `blocksLabel` (`@/features/session`); `repositories.sessions.serverNow()`.
- Produces: `useRoom(roomId): { view: RoomView | null; loading; error; offsetMs; respond; cancel; join; leave; pending }`; `<RoomsSection />`; ruta `/room/[roomId]`.

- [ ] **Step 1: Tests que fallan**

- `use-room.test.tsx`: carga `getById`; relee con `subscribe`; calcula `offsetMs` con `serverNow()` como `useSessionRoom` (y sigue con 0 si falla); `pending` mientras vuela una escritura y una sola escritura por doble toque.
- `rooms-section.test.tsx`: no pinta nada con 0–1 matches y sin salas; con 2 matches pinta «Convocar sala Lock-In» que navega a `/room/new`; con salas pinta una `RoomRow` por sala que navega a `/room/<id>`.
- `test/app/roomId.test.tsx` (temporizadores falsos y reloj del mock):
  - Invitada: ve «Convoca {Nombre}», **no ve a la otra invitada**, «Me apunto» acepta.
  - Quien convoca: ve a todos con su estado; «Cancelar sala» pide confirmación en línea y cancela.
  - Aceptada, «No podré ir» con confirmación → rechaza y vuelve a Matches (`router.back()`), sin pintar «no disponible» (Review Focus 4).
  - Cancelada por `subscribe` con la pantalla abierta → «{Nombre} canceló la sala» (Review Focus 3).
  - En ventana: llama a `join` al montar, pinta la fase y la cuenta atrás, y cada persona aceptada con «Está aquí» / «Aún no ha entrado» (con `createMemoryPresenceAdapter` inyectado); «Salir» con confirmación llama a `leave`.
  - Terminada: «Sala completada» y «Volver a Matches», sin valoración.
  - No visible: «Esta sala no está disponible».
- `test/app/matches.test.tsx`: la sección aparece con 2 matches y no con 1.

- [ ] **Step 2: Implementar.** La pantalla copia la estructura de `src/app/session/[sessionId].tsx` (`Notice`, bloques, confirmación de salir, `useNow(1_000) + offsetMs`) sin importar nada de ese archivo. La presencia se lee con `useRoomPresence(enVentana ? roomId : null, me.profileId)`.

- [ ] **Step 3: Verificar** (`npx jest src/features/room test/app`, `tsc`, lint, `npx expo export --platform web`, `npm test` con cobertura) **y commit**:

```bash
git add -N -- src/features/room/use-room.ts src/features/room/use-room.test.tsx src/features/room/rooms-section.tsx src/features/room/rooms-section.test.tsx src/app/room/[roomId].tsx test/app/roomId.test.tsx
git commit -m "feat(salas): pantalla de la sala con Pomodoro y presencia, y sección en Matches" -- src/features/room/ src/app/room/ test/app/roomId.test.tsx src/app/_layout.tsx "src/app/(tabs)/matches.tsx" test/app/matches.test.tsx
```

---

### Task 9: Avisos locales de salas [Codex]

Mecánica: copia de `reminders.ts`/`session-reminder-sync.tsx` con otra clave y otro origen de datos. Criterio: tests en verde.

**Files:**
- Modify: `src/features/session/index.ts` (solo exportar `createNotificationsPort`, `REMINDER_LEAD_MS`, `SESSIONS_CHANNEL_ID` y los tipos `NotificationsPort`, `ReminderStorage`)
- Create: `src/features/room/room-reminders.ts` (+ test), `room-reminder-sync.tsx` (+ test)
- Modify: `src/app/(tabs)/_layout.tsx` (una línea: `<RoomReminderSync />` bajo `<SessionReminderSync />`)
- Modify: `src/features/room/index.ts`

**Interfaces:**
- Produces: `ROOM_REMINDER_KEY_PREFIX = 'lockin:room-reminder:'`; `syncRoomReminders(views: RoomView[], deps: { notifications; storage; nowMs }): Promise<ReminderSyncResult-like>`; `<RoomReminderSync notifications? storage? />`.

- [ ] **Step 1: Tests que fallan** (`room-reminders.test.ts`, con puertos falsos): programa a `startsAt − 5 min` las salas vivas en las que `me.status === 'aceptada'`; no programa si faltan menos de 5 min ni si estás `invitada`; cancela y borra la clave al dejar de estar viva o aceptada; **no toca ninguna clave que empiece por `lockin:reminder:`** (Review Focus 5); con el permiso denegado no programa nada. Texto: «Sala Lock-In en 5 minutos» / «Entra desde Matches.». `room-reminder-sync.test.tsx`: reconcilia al montar y otra vez al avisar `rooms.subscribe`.

- [ ] **Step 2: Implementar, verificar** (`npx jest src/features/room src/features/session test/app/layouts.test.tsx`, `tsc`, lint, export web) **y commit**:

```bash
git add -N -- src/features/room/room-reminders.ts src/features/room/room-reminders.test.ts src/features/room/room-reminder-sync.tsx src/features/room/room-reminder-sync.test.tsx
git commit -m "feat(salas): aviso local 5 minutos antes de una sala aceptada" -- src/features/room/ src/features/session/index.ts "src/app/(tabs)/_layout.tsx"
```

---

### Task 10: E2E en la variante `supabase` [Claude]

Toca el orquestador de `calidad` y depende de leer el recorrido entero: `[Claude]` (mismo precedente que el acuerdo).

**Files:**
- Create: `e2e/room.yaml`
- Modify: `e2e/verify.mjs` (`prepareRoom`, `verifyRoomAttendance`), `e2e/run.mjs` (encadenar tras `agreement.yaml`), y el test de `e2e/` que fija etiquetas contra el código si existe para el acuerdo (`agreement.test.mjs` → `room.test.mjs`, mismo patrón).

- [ ] **Step 1: `prepareRoom(status, profileName)`** con `service_role` (patrón de `prepareAgreement`): busca el perfil y su match; inserta en `lockin_rooms` una sala con `host_id` = la contraparte, `starts_at = now() + 4 min` (la ventana de entrada ya está abierta: abre 5 min antes), `blocks = 1`; en `room_members`, la contraparte `aceptada`, otro perfil de `supabase/seed.sql` que no sea ninguno de los dos `aceptada`, y el usuario `invitada`. Inserta directo porque `create_room` exige 5 min de margen y match con todos; lo que se prueba es aceptar, entrar y salir.
- [ ] **Step 2: `room.yaml`**: relanza sin borrar estado (como `session-streak.yaml`), Matches → toca «.* te invita.*» → «Me apunto» → espera la fase o «Empieza en» → «Salir» → «Salir de la sala».
- [ ] **Step 3: `verifyRoomAttendance`**: la fila del usuario es `aceptada`, `joined_at` y `left_at` no nulos. Veredicto con `room: 'verified'` junto a `agreement`.
- [ ] **Step 4: Encadenar en `run.mjs`** tras `agreement.yaml`, con su carpeta de artefactos `room/`, en la variante `supabase` solo.
- [ ] **Step 5: Verificar en Actions** (`E2E Android` verde en las variantes; en la `supabase`, `[Passed]` del flujo y `Postgres: asistencia a la sala verificada.`) **y commit**:

```bash
git add -N -- e2e/room.yaml
git commit -m "test(salas): E2E de aceptar, entrar y salir de una sala en la variante supabase" -- e2e/room.yaml e2e/verify.mjs e2e/run.mjs
```

---

### Task 11: Verificación final y cierre [Claude]

- [ ] `npx tsc --noEmit`, `npm run lint`, `npx jest --coverage` sobre el suelo, `npm run test:schema`, `npx expo export --platform web`, todo en verde en local.
- [ ] En Actions sobre el commit de cierre: `CI` verde entera («Formato» incluido), `E2E Android` verde, `contract.yml` verde (lanzado a mano), y `Schema drift`: local verde, remoto **rojo a propósito** solo por esta migración más la excepción vigente. Su `remote.diff` tiene que listar exactamente las dos tablas, el enum, las once funciones (tres helpers de pertenencia, `lock_room_for_member`, cinco RPC de escritura, `live_rooms` e `is_room_topic_member`), las dos políticas de tabla y las dos de `realtime.messages`. Nada más.
- [ ] Actualiza la memoria `schema-drift-remoto-rojo-esperado.md` y `todo/salas.md` → «Pendiente del usuario».
- [ ] Marca el hito en `docs/plan/TODO.md` con evidencia (runs), como el del acuerdo.

### Task 12: Recorrido en el emulador [comprobador]

Backend **mock** (APK local con `EXPO_NO_DOTENV=1 EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1`; ojo a la memoria `gradle-no-rastrea-expo-public.md`). Pasos:

1. Onboarding «Ambos» (Núria declara `par` y no sale en un deck Lock-In) → like a Núria y a Marc, que dan match recíproco.
2. Matches: aparece «Convocar sala Lock-In»; convocar con los dos, hoy, el próximo tramo, 1 bloque.
3. La sala abre con los dos «ha aceptado» (aceptan solos en el mock).
4. La fila en Matches dice «Sala · … · 3 personas». El reloj del mock no se puede mover desde fuera: espera a que abra la ventana (el primer tramo válido cae a 5–20 min) y entra: reloj, «Trabajo · bloque 1 de 1», tu presencia, y «Salir» con confirmación. Si la espera no cabe en la sesión, dilo y sigue con el paso 5.
5. Convoca otra sala y comprueba que «Cancelar sala» pide confirmación y la quita de Matches.
6. Captura, `uiautomator dump` y logcat en `e2e/artifacts/local/<fecha>-salas/`; hallazgos en `todo/salas.md`.

## Pendiente del usuario

- **Revisar «Decisiones tomadas sin el usuario (revisar)»** de la spec antes de la Tarea 1.
- Aplicar `supabase/migrations/20261002000100_lockin_rooms.sql` en `grrzmzktrhksbttpbblg` por el SQL Editor cuando la Tarea 11 esté cerrada.
