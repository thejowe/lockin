# Sesiones Lock-In con Pomodoro compartido — diseño

Fecha: 2026-09-13. Estado: aprobado por secciones en conversación; pendiente de
revisión del documento escrito.

## Contexto

El MVP está cerrado (ver `docs/plan/TODO.md`). En el chat hay un hueco fijo,
`src/features/chat/lock-in-cta.tsx`, que dice "Agendar sesión Lock-In" y a
propósito no hace nada: `docs/plan/CONCEPTO.md` define las sesiones de Lock-In
como el diferenciador que evita que la gente abandone la app tras el match, y
las deja para Fase 2.

### Descomposición de la Fase 2

La Fase 2 de `CONCEPTO.md` son piezas independientes con dependencias entre sí.
Cada una lleva su propia spec, plan e implementación, en este orden:

1. **Sesiones Lock-In + Pomodoro compartido** — este documento. Es la base: las
   demás leen de la sesión y de su asistencia.
2. **Valoración de 1 toque post-sesión** — lee `session_attendance` para saber
   quién estuvo.
3. **Rachas** — cuenta sesiones asistidas por persona y periodo.
4. **Vídeo real en la sesión** — se monta dentro de la pantalla de sesión que
   crea este documento. Proveedor por decidir en su propia spec.

Nada de esto toca Fase 3+ (salas grupales, verificación, Modo Talento, premium).

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| Primera pieza | Sesión agendada + Pomodoro compartido, **sin vídeo** |
| Cómo se crea | Propuesta con fecha, hora y duración; la otra persona acepta o rechaza |
| Temporizador | Plan fijo de bloques 25+5, **sin pausa**; arranca solo a la hora acordada |
| Qué se ve de la otra persona | Indicador "está aquí" (Realtime Presence) + registro de asistencia |
| Recordatorio | Notificación **local** 5 min antes (`expo-notifications`), sin push de servidor |
| Arquitectura | Tablas + RPCs con RLS, nuevo repositorio en el contrato (mock y Supabase) |

Descartados: sesión como mensaje especial del chat (`messages` no tiene update
por diseño y mezclaría dos contratos) y sesión solo en cliente (no persiste, sin
asistencia no hay rachas ni valoración).

## 1. Modelo, reglas y contrato

### Dominio — `src/data/types.ts`

```ts
/** Bloques de 25 min de trabajo + 5 de descanso. */
export type SessionBlocks = 1 | 2 | 4;

export type SessionStatus = 'propuesta' | 'aceptada' | 'rechazada' | 'cancelada';

export interface LockInSession {
  id: string;
  matchId: string;
  /** Id del perfil que propone. */
  proposedBy: string;
  /** ISO. Hora de inicio del primer bloque. */
  startsAt: string;
  blocks: SessionBlocks;
  status: SessionStatus;
  createdAt: string;
  /** ISO del cambio a aceptada/rechazada/cancelada; `null` mientras es propuesta. */
  respondedAt: string | null;
}

export interface SessionAttendance {
  sessionId: string;
  profileId: string;
  joinedAt: string;
  /** `null` = no salió de forma explícita (se quedó hasta el final o cerró la app). */
  leftAt: string | null;
}

export interface SessionProposalInput {
  matchId: string;
  startsAt: string;
  blocks: SessionBlocks;
}
```

Constantes compartidas: `WORK_MINUTES = 25`, `BREAK_MINUTES = 5`,
`BLOCK_MINUTES = 30`. Fin de la sesión: `endsAt = startsAt + blocks × 30 min`.
El último bloque incluye su descanso.

**Estados derivados, no guardados.** "Caducada", "en curso" y "terminada" se
calculan con la hora; ningún proceso de servidor cambia filas con el tiempo.

- **Viva**: `status = 'propuesta'` y `now < startsAt`, o `status = 'aceptada'` y
  `now < endsAt`.
- **Caducada**: `status = 'propuesta'` y `now ≥ startsAt`. No es viva.
- **Ventana de entrada**: `status = 'aceptada'` y `startsAt − 5 min ≤ now < endsAt`.

### Reglas

1. Se puede proponer en **cualquier match**, sea de modo `par` o `lockin`.
2. **Una sola sesión viva por match.** Para cambiar la hora se cancela y se
   vuelve a proponer; no hay contrapropuestas.
3. `startsAt` debe cumplir `now + 5 min ≤ startsAt ≤ now + 30 días`.
4. Solo **la otra persona** (no quien propuso) puede aceptar o rechazar, y solo
   mientras la propuesta es viva.
5. **Cualquiera de los dos** puede cancelar una sesión viva antes de `startsAt`.
   Una vez empezada no se cancela: se sale.
6. `join` solo dentro de la ventana de entrada. Es idempotente: si ya había fila,
   conserva `joinedAt` y pone `leftAt = null`.
7. `leave` solo si hay fila de asistencia; guarda `leftAt = now`. Solo cuenta
   como **abandono** un `leftAt` anterior a `endsAt`.
8. Nadie fuera del match lee ni escribe nada de sus sesiones.

### Contrato — `src/data/repositories.ts`

```ts
export interface LockInSessionRepository {
  /** La sesión viva del match, o `null`. */
  getActive(matchId: string): Promise<LockInSession | null>;
  getById(sessionId: string): Promise<LockInSession | null>;
  propose(input: SessionProposalInput): Promise<LockInSession>;
  respond(sessionId: string, answer: 'aceptada' | 'rechazada'): Promise<LockInSession>;
  cancel(sessionId: string): Promise<LockInSession>;
  join(sessionId: string): Promise<SessionAttendance>;
  leave(sessionId: string): Promise<SessionAttendance>;
  listAttendance(sessionId: string): Promise<SessionAttendance[]>;
  /** Hora del servidor, para corregir el reloj del móvil. */
  serverNow(): Promise<string>;
  /** Avisa de cualquier cambio en sesiones o asistencia del match. */
  subscribe(matchId: string, listener: () => void): Unsubscribe;
}
```

Errores de dominio, exportados desde `src/data`:

| Error | Cuándo |
|---|---|
| `SessionConflictError` | Ya hay sesión viva al proponer; el estado cambió antes de responder o cancelar |
| `SessionExpiredError` | Responder a una propuesta caducada; cancelar una sesión ya empezada |
| `SessionWindowError` | `startsAt` fuera de rango; `join` fuera de la ventana de entrada |
| `SessionForbiddenError` | Responder a tu propia propuesta; operar sobre un match ajeno |

Se añade `sessions: LockInSessionRepository` al objeto `Repositories` y a las
dos implementaciones (`src/data/mock/`, `src/data/supabase/`).

### Supabase — migración nueva en `supabase/migrations/`

- Enum `session_status` y tabla `lockin_sessions` (`id`, `match_id` →
  `matches`, `proposed_by` → `profiles`, `starts_at timestamptz`, `blocks
  smallint check (blocks in (1,2,4))`, `status`, `created_at`, `responded_at`).
- Tabla `session_attendance` (`session_id`, `profile_id`, `joined_at`,
  `left_at`, PK compuesta).
- RLS en las dos: `select` solo si `is_match_member(match_id)`; **ninguna
  política de insert/update/delete**. `anon` revocado.
- RPCs `SECURITY DEFINER` con `search_path = ''`: `propose_session`,
  `respond_session`, `cancel_session`, `join_session`, `leave_session`,
  `server_now`. EXECUTE revocado de `public`/`anon`, concedido a
  `authenticated`.
- **Unicidad de sesión viva sin índice.** Depende de `now()`, que un índice
  parcial no puede usar: un índice sobre `status in ('propuesta','aceptada')`
  bloquearía el match para siempre tras la primera sesión terminada. En su
  lugar, `propose_session` hace `select … from matches where id = p_match_id for
  update` y comprueba dentro de ese bloqueo que no queda sesión viva. Los RPCs
  que cambian estado bloquean la fila de la sesión (`for update`) y revalidan.
- Errores con `raise exception` y `errcode` propio (`LI001`–`LI004`), que
  `src/data/supabase/` traduce a las clases de dominio de arriba.
- Realtime: las dos tablas entran en la publicación `supabase_realtime`.
- `supabase/seed.sql` no siembra sesiones.

## 2. Pantallas y flujo

### Alcance de archivos — bloque nuevo `sesiones`

- `src/features/session/` — componentes, hooks, cálculo del reloj, avisos.
- `src/app/session/[sessionId].tsx` — pantalla de sesión.
- `src/data/**` y `supabase/**` — lo de la sección 1, en coordinación con
  `arquitecto` (contrato) y `datos` (migración, RPCs, implementación Supabase).
- **Dos cruces con archivos de otros bloques**, los dos de una línea:
  - `chat` — en `src/app/chat/[matchId].tsx` se sustituye
    `<LockInCta counterpartName=… />` por `<SessionCard match={match} me={me} />`
    en el mismo contenedor `styles.lockIn`. Se borran `lock-in-cta.tsx`, su test
    y su export de `src/features/chat/index.ts`.
  - `arquitecto` — en `src/app/(tabs)/_layout.tsx` se monta
    `<SessionReminderSync />` (sin interfaz), que reconcilia los avisos al abrir
    la app. Va en el layout de tabs y no en `useMatches` para no meter lógica de
    avisos en el bloque `chat`.

Hay que añadir el bloque `sesiones` a `docs/plan/PLAN.md` y crear
`docs/plan/todo/sesiones.md` antes de implementar.

### Tarjeta del chat — `SessionCard`

Un solo componente; qué pinta depende de la sesión viva y de quién mira:

| Estado | Contenido | Acciones |
|---|---|---|
| Sin sesión viva | "Agendar sesión Lock-In" | Abre `ProposeSessionSheet` |
| Propuesta, la hice yo | "Esperando a {nombre} · {día hora} · {n} bloques" | Cancelar |
| Propuesta, me la hacen | "{nombre} propone {día hora} · {n} bloques" | Aceptar · Rechazar |
| Aceptada, fuera de la ventana | "{día hora} · empieza en {relativo}" | Cancelar |
| Aceptada, dentro de la ventana | "Entrar a la sesión" (acento latón) | Navega a `/session/{id}` |

Día y hora siempre en la zona horaria del dispositivo de quien mira. Se
refresca con `subscribe(matchId)` y con un tic de 30 s para cruzar los umbrales
de ventana y caducidad sin eventos de red. Ante `SessionConflictError` o
`SessionExpiredError`, recarga y muestra "La sesión ha cambiado".

### Hoja de propuesta — `ProposeSessionSheet`

- **Día**: hoy y los 6 siguientes (el servidor admite hasta 30; la interfaz no
  lo necesita todavía).
- **Hora**: tramos de 15 min. Se ocultan los que caen antes de `now + 5 min`.
- **Preselección**: si las dos personas tienen la misma `timezone`, la primera
  hora futura de la primera franja común (`Availability.bands`), con estos
  inicios: `madrugada` 00:00, `manana` 06:00, `tarde` 12:00, `noche` 20:00, que
  son los de `TIME_BAND_OPTIONS` en `src/features/profile/catalog.ts`. Si las
  zonas difieren o no hay franja común, el próximo tramo válido. La franja
  común se calcula en `src/features/session/` (`sharedTimeBand` de
  `icebreakers.ts` es privada y devuelve texto, no franjas); un test fija que los
  inicios coinciden con las descripciones del catálogo.
- **Bloques**: 1, 2 o 4, mostrando la hora de fin.
- **Proponer** llama a `sessions.propose` y cierra la hoja.

### Pantalla de sesión — `src/app/session/[sessionId].tsx`

- Al montar: `serverNow()` para calcular el desfase, `join(sessionId)`, y
  `track()` en el canal de Presence `lockin:session:{id}`.
- Arriba: avatar de la otra persona con "está aquí" / "aún no ha entrado" /
  "sin conexión" (esta última cuando el propio canal está caído).
- Centro: fase ("Trabajo · bloque 2 de 4" / "Descanso"), cuenta atrás grande y
  barra con los bloques. Antes de `startsAt`: "Empieza en m:ss". Tras `endsAt`:
  "Sesión completada" y botón para volver al chat.
- "Salir" pide confirmación ("Saldrás antes de acabar; contará como
  abandono") y llama a `leave`. El gesto atrás del sistema también llama a
  `leave` si la sesión no ha terminado.
- Fuera de la ventana de entrada o sesión no aceptada: mensaje y vuelta al chat,
  sin `join`.

**Reloj.** Función pura `phaseAt(startsAt, blocks, nowMs)` en
`src/features/session/phase.ts`, que devuelve `{ kind: 'antes' | 'trabajo' |
'descanso' | 'terminada', block, remainingMs }`. La pantalla la evalúa cada
segundo con `Date.now() + desfase`. No se envían tics por la red.

**Presencia.** Hook `useCounterpartPresence(sessionId, counterpartId)` sobre un
adaptador inyectable (`PresenceAdapter`): el real usa `supabase.channel(…)`
con `track`/`untrack` y el evento `sync`; el de tests y el del backend mock es
en memoria. Queda fuera de `Repositories` a propósito: es efímero y no se
guarda.

### Recordatorio — `src/features/session/reminders.ts`

- Al aceptar, el dispositivo que acepta programa su aviso. El que propuso lo
  programa cuando `subscribe` le trae el cambio, o al abrir la app si estaba
  cerrada: `SessionReminderSync` recorre `matches.list()`, pide
  `sessions.getActive` de cada uno, programa lo que falte y cancela lo que ya
  no esté viva y aceptada. Se suscribe a `matches.subscribe` y a
  `sessions.subscribe` de cada match para repetirlo ante cambios.
- Aviso a `startsAt − 5 min` con `scheduleNotificationAsync` y trigger de tipo
  fecha, en un canal Android propio `lockin-sessions` creado antes de pedir
  permisos (Android 13 no muestra el diálogo sin canal).
- Ids programados en AsyncStorage con clave `lockin:reminder:{sessionId}`. Al
  ver la sesión cancelada, rechazada o terminada, `cancelScheduledNotificationAsync`
  y borrar la clave.
- Si faltan menos de 5 min para `startsAt`, no se programa.
- Permiso denegado: la sesión funciona igual; `SessionCard` muestra una vez
  "Activa los avisos para no perderte la sesión".
- Web: el módulo no se importa en web (`Platform.OS`), sin aviso.
- `app.json`: plugin `expo-notifications` y permiso Android
  `SCHEDULE_EXACT_ALARM` (necesario desde Android 12 para disparar a hora
  exacta).

**Por verificar al implementar.** La página de `expo-notifications` de SDK 57 se
leyó truncada: las firmas de `scheduleNotificationAsync`, la forma del trigger
de fecha (`SchedulableTriggerInputTypes.DATE`) y si el plugin es obligatorio
para avisos locales salen de un resumen. Confirmarlas contra
https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ antes de escribir
`reminders.ts`, y comprobar si hace falta pedir el permiso de alarma exacta en
tiempo de ejecución en Android 14+.

## 3. Errores y casos límite

| Caso | Comportamiento |
|---|---|
| Aceptar y cancelar a la vez | Los RPCs bloquean la fila y revalidan; el segundo recibe `SessionConflictError` y la tarjeta recarga |
| Los dos proponen a la vez | Bloqueo de la fila del match; la segunda propuesta recibe `SessionConflictError` y ve la primera |
| Aceptar una propuesta caducada | `SessionExpiredError`; la tarjeta vuelve a "Agendar" |
| Reloj del móvil desfasado | Se corrige con `serverNow()`; si falla, se usa el reloj local sin bloquear |
| Sin conexión en la sesión | La cuenta atrás sigue (local); presencia "sin conexión"; `join` se reintenta al reconectar |
| `leave` sin conexión | Se descarta; `leftAt` queda `null` |
| App cerrada a la fuerza | Presence retira a la persona sola; `leftAt` queda `null` |
| Volver a entrar tras salir | `join` pone `leftAt = null` |
| Zonas horarias distintas | Se guarda `timestamptz`; cada uno ve su hora local; sin preselección de franja |
| Permiso de avisos denegado | Sesión funciona; aviso de una vez en la tarjeta |

**Semántica para Rachas y Valoración.** Asistió = tiene fila en
`session_attendance` con `joinedAt < endsAt`. Abandonó = `leftAt` no nulo y
`leftAt < endsAt`. Un `leftAt` nulo no distingue "se quedó" de "cerró la app";
las specs posteriores no deben suponer lo contrario.

## 4. Tests

| Nivel | Qué |
|---|---|
| Unitarios | `phaseAt`: antes de empezar, cada transición trabajo↔descanso, el milisegundo exacto de cada frontera, final y después. Generación de tramos y preselección de franja (incluido zonas distintas). `reminders.ts` con `expo-notifications` y AsyncStorage simulados: programa, no programa con menos de 5 min, cancela y limpia la clave. `SessionReminderSync`: con dos matches (una sesión aceptada, otra cancelada con aviso previo) programa la primera y cancela la segunda. Traducción `LI00x` → errores de dominio. |
| Contrato (`src/data/repositories.contract.ts`) | Las 8 reglas de la sección 1 y las filas de la tabla de errores que pasan por el repositorio: solo la otra persona responde, una sola viva, sesión terminada no bloquea una nueva propuesta, límites de `startsAt`, ventana de `join`, `join` idempotente, `leave` + `join` de nuevo, caducidad, conflicto, tercero sin acceso, `subscribe` avisa en los dos lados. Corre con el mock en `npm test` y contra Supabase con `LOCKIN_SUPABASE_CONTRACT=1`. El mock acepta un reloj inyectable para probar ventanas sin esperar. |
| Componentes (RNTL) | `SessionCard` en sus 5 estados y el mensaje de conflicto; `ProposeSessionSheet`; pantalla de sesión con temporizadores falsos (antes, trabajo, descanso, completada, confirmación de salida) y `PresenceAdapter` falso. |
| Esquema | La migración entra en `schema-fingerprint.sql` sin cambios en el script; `schema-drift.yml` exigirá que el proyecto real coincida tras aplicarla. `drift-check.mjs` debe sondear los RPCs nuevos. |
| E2E Android | Flujo nuevo `e2e/session.yaml`, fuera de `full-journey.yaml`. Fixture `e2e/session-now.sql` (patrón de `incoming-likes.sql`) crea una sesión aceptada que empieza al arrancar el caso; la app entra desde el chat, ve la cuenta atrás, sale confirmando, y `e2e/verify.mjs` comprueba en Postgres la fila de asistencia con `left_at` no nulo. |

**Fuera de la verificación automática, a propósito.** La presencia entre dos
dispositivos reales no pasa por el repositorio ni cabe en un emulador; se
verifica a mano con dos móviles y queda como casilla explícita en
`docs/plan/todo/sesiones.md`, con el mismo criterio que el recorrido manual del
MVP. El aviso real a la hora exacta, igual. El suelo de cobertura de
`jest.config.js` no baja.

## Fuera de alcance de esta spec

Vídeo, pausa compartida, duraciones configurables, objetivo por bloque,
contrapropuestas, sesiones recurrentes, sesiones de más de dos personas,
notificaciones push de servidor, valoración y rachas.
