# Salas Lock-In grupales — diseño

> Fase 3, tercer y último sub-proyecto. Spec escrita el 2026-10-02 **sin el
> usuario delante**: todas las decisiones discutibles están listadas justo
> debajo, con la alternativa que se descartó, para que las revise antes de que
> empiece la implementación.
>
> Bloque: `salas` (bloque 14 de `docs/plan/PLAN.md`; el 13 ya es `visual`).
> Plan de implementación: `docs/superpowers/plans/2026-10-02-salas-grupales.md`.
> Checklist: `docs/plan/todo/salas.md`.

## Decisiones tomadas sin el usuario (revisar)

Cada una se puede revertir antes de la Tarea 1 sin tirar nada. Después, la que
más cuesta deshacer es la 1 (toca SQL, RLS y contrato).

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| 1 | **La sala la convoca una persona invitando a 2–4 de sus matches** (de cualquier modo). Cada invitado acepta o rechaza. | (a) Salas abiertas por franja horaria que cualquiera descubre y en las que entra. (b) Enlace o código de invitación. (c) Ampliar un match 1:1 a grupo. (d) Exigir que todos los miembros tengan match entre sí. | Ver «La decisión central» abajo. |
| 2 | **Una sala es una sesión grupal agendada, de un solo uso**: hora, 1/2/4 bloques 25+5, y se acabó. | Grupo persistente con sesiones recurrentes. | Un grupo persistente necesita chat de grupo, gestión de miembros (añadir, expulsar, salir) y sesiones dentro del grupo: es otro producto. Repetir con la misma gente es crear otra sala. |
| 3 | **Sin vídeo.** Pomodoro compartido + presencia «está aquí» por persona. | WebRTC en malla para N>2, o un SFU de proveedor. | Ver «Por qué sin vídeo». |
| 4 | **Sin chat de grupo ni ningún texto libre** (ni título, ni objetivo de la sala). | Título u objetivo visible para todos; hilo de mensajes de la sala. | Con N personas que no tienen match entre sí, cualquier texto de una persona llega a gente que nunca la eligió. Eso necesita moderación y denuncias, y este repo no tiene ninguna de las dos. La coordinación va por los chats 1:1 que ya existen. |
| 5 | **Tamaño: 3 a 5 personas** (quien convoca + 2–4 invitados). | Sin tope, o hasta 8–10. | Con 2 personas ya existe la sesión 1:1. Por encima de 5 la lista de presencia deja de caber en un móvil sin desplazarse, y el riesgo de invitar en masa crece sin que el producto gane nada. Es una constante (`ROOM_MAX_INVITEES`) y un `check` en una RPC: subirla es barato. |
| 6 | **Los invitados pendientes solo los ve quien convoca.** Los demás ven a quien ya ha aceptado. | Lista completa visible desde la invitación. | Ver «El ciego de invitados». |
| 7 | **La entrada vive en la pestaña Matches**, en una sección «Salas Lock-In» encima de la lista. | Pestaña nueva «Salas». | Una pestaña nueva toca `app-tabs.tsx` y `app-tabs.web.tsx` (dos cruces con `arquitecto`), y estaría vacía para casi todo el mundo: una sala necesita al menos 2 matches. La sección de Matches no se pinta si no hay nada que enseñar. |
| 8 | **Las salas no cuentan para rachas ni se valoran.** | Valoración de un toque al acabar; que una sala con tu pareja sume a vuestra racha. | La racha es de la pareja (spec de rachas) y una sala no es «de» ninguna pareja. La valoración es privada y 1:1; en grupo se convertiría en reputación. Ninguna de las dos piezas se toca. |
| 9 | **Quien convoca no manda una vez convocada.** Puede cancelar antes de empezar y nada más: ni añadir gente, ni reinvitar, ni expulsar. | Gestión de miembros por quien convoca. | Principio innegociable de `CONCEPTO.md`: los lados son pares. Que una persona pueda echar a otra de una sala la convierte en jefa. El copy dice «Convoca {nombre}», nunca «anfitrión», «organizador» ni «admin». |
| 10 | **Rechazar es definitivo para esa sala**, y también el «no podré ir» de quien ya había aceptado. Quien rechaza deja de verla. | Poder volver a aceptar tras rechazar. | Volver tras rechazar necesitaría seguir viendo la sala sin estar en ella, que choca con la 6. Si cambias de idea, quien convoca crea otra. |
| 11 | **Se acepta solo antes de la hora de inicio**, igual que una propuesta 1:1. | Aceptar hasta que la sala termine. | Mismas reglas de tiempo que las sesiones 1:1 (`src/data/sessions.ts`): menos casos que probar y un modelo mental único. |
| 12 | **Aviso local 5 min antes**, como en las sesiones 1:1. | Sin aviso en v1. | Una sesión agendada sin aviso se olvida, y reutiliza `NotificationsPort` sin dependencias nuevas. Es la última tarea de código y se puede recortar sola si hiciera falta. |
| 13 | **Errores: se reutilizan las cuatro clases `Session*Error`** para `LI001`–`LI004`, con el mismo significado, y se añade `RoomInviteError` (**`LI006`**, nuevo). | Una familia `Room*Error` propia. | La UI decide por clase; una sala es una sesión Lock-In con más gente, y los cuatro significados (conflicto, caducada, fuera de ventana, no te corresponde) son exactamente los mismos. Importarlas no toca `session-errors.ts`. |
| 14 | **Bloque 14**, no 13. | — | El 13 de `PLAN.md` ya es `visual` (2026-09-29). |

## Contexto

`CONCEPTO.md` deja Fase 3 en «salas grupales, verificación, plantillas de
acuerdo entre cofundadores». Verificación (bloque 11) y acuerdo (bloque 12)
están cerrados. Esta es la que queda, y la spec del acuerdo explica por qué se
dejó la última: **salas grupales rompe la suposición «match = 2 personas»** en
la que se apoyan chat, sesiones, rachas, valoración y vídeo.

Por eso este diseño **no toca esa suposición**: una sala no es un match, ni un
chat, ni una `lockin_sessions`. Es una entidad nueva al lado, con su propia
tabla de miembros, que reutiliza del bloque `sesiones` solo lo que es puro y
no depende de que haya dos personas: las reglas de tiempo (`src/data/sessions.ts`),
el reloj del Pomodoro (`phaseAt`), el formato, la hora del servidor
(`serverNow`), el adaptador de presencia y el puerto de notificaciones.

El problema que ataca es el de la propia sesión Lock-In llevado a grupo: tres o
cuatro personas que se conocen por la app quieren trabajar concentradas a la
vez, y hoy tendrían que montar una sesión 1:1 con cada una.

## La decisión central: cómo se forma una sala

Una sala la **convoca una persona** eligiendo entre **2 y 4 de sus matches**
(de cualquier modo, Par o Lock-In, igual que una sesión 1:1 se puede proponer
en cualquier match). Cada persona invitada **acepta o rechaza**. Los invitados
no necesitan tener match entre sí.

### Por qué desde matches

Un match es la única prueba que tiene la app de que dos personas han querido
saber la una de la otra. Invitar solo a tus matches significa que **cada
invitación llega a alguien que te dio like**: no hay forma de usar las salas
para escribir a desconocidos, y el abuso posible está acotado por el swipe que
ya existe. No hace falta ni moderación, ni bloqueo, ni límite de invitaciones.

### Por qué no salas abiertas (descartada a)

Descubrir salas por franja («hay una sala a las 10 con 3 plazas») es lo más
parecido a un «focus room» público y lo que más gente juntaría. Pero pone a
desconocidos en la misma pantalla sin el filtro del swipe, que es justo el
producto. Y exige lo que este repo no tiene: denuncias, bloqueos, un deck de
salas con su propio ranking y una política de qué se enseña de quien no te ha
elegido. Es un bloque entero por sí mismo, y queda fuera.

### Por qué no enlace o código (descartada b)

Un enlace se reenvía. El primer reenvío mete en la sala a alguien que no tiene
match con nadie, y vuelve el problema de la (a) por la puerta de atrás. Además
necesita deep links con estado de invitación y un camino de «entrar sin
perfil», que el onboarding no contempla.

### Por qué no ampliar un match (descartada c)

Convertir el chat de un match en grupo es justo lo que rompe «match = 2
personas»: `Match.profileIds` es una tupla de dos, `is_match_member()`,
`lockin_sessions.match_id`, las rachas de pareja y la valoración privada se
apoyan en ello. Tocaría casi todo Fase 2.

### Por qué no exigir match entre todos (descartada d)

Con 4 invitados harían falta 10 matches cruzados: en la práctica no habría
ninguna sala. Basta con que **quien convoca** tenga match con cada uno, porque
la exposición que preocupa —que gente que no se eligió se vea— la resuelven el
ciego de invitados (abajo) y que no haya texto libre (decisión 4): de los demás
solo se ve lo que ya es público para cualquier cuenta autenticada (el perfil,
ver `20260905000400_rls_policies.sql`) y si están dentro o no.

### El ciego de invitados

Si al recibir una invitación vieras la lista completa de invitados, sabrías con
quién más tiene match quien convoca, aunque esas personas no hayan aceptado
nunca. Eso filtra el grafo de matches de terceros sin su consentimiento.

Regla, impuesta por RLS: **una persona invitada ve a quien convoca y a quien ya
ha aceptado; quien convoca ve a todo el mundo con su estado.** Aceptar es el
consentimiento para que los demás te vean en esa sala. Rechazar no deja rastro
para nadie salvo para quien convocó, que ya sabía que te había invitado.

## Por qué sin vídeo

El vídeo 1:1 del bloque `video` es WebRTC directo con **solo STUN público** y
sin servidor de medios. Para N personas hay dos caminos y ninguno cabe:

- **Malla (cada uno con cada uno)**: con 5 personas son 10 conexiones y cada
  móvil codifica y sube su vídeo 4 veces. Batería y subida se van en minutos en
  una sesión de 2 horas, y sin TURN la probabilidad de que **alguno** de los
  10 pares no conecte detrás de un NAT simétrico crece con cada persona: la
  sala falla parcialmente de forma que nadie sabe explicar.
- **SFU** (un servidor que reenvía): es un proveedor de pago o un servidor
  propio, y el bloque `video` se diseñó precisamente para no tener ninguno.

Y el producto no lo necesita para funcionar: lo que sostiene el lock-in en
grupo es saber que los demás **están** —presencia— y compartir el reloj.
Además, sin vídeo no hay build nativa nueva, la sala funciona en Expo Go y en
web, y el `comprobador` puede recorrerla entera en el emulador, cosa que con el
vídeo 1:1 no puede.

## 1. Modelo y contrato

### Dominio — `src/data/types.ts` (cruce con `arquitecto`)

```ts
/** Estado de una persona en una sala. Quien convoca nace `aceptada`. */
export type RoomMemberStatus = 'invitada' | 'aceptada' | 'rechazada';

/**
 * Sala Lock-In grupal (Fase 3): una sesión de bloques 25+5 para 3–5 personas,
 * convocada por una de ellas entre sus matches. No es un match ni tiene chat.
 * Ver `docs/superpowers/specs/2026-10-02-salas-grupales-design.md`.
 */
export interface LockInRoom {
  id: string;
  /** Quien la convocó. No tiene más poder que cancelarla antes de empezar. */
  hostId: string;
  /** ISO. Inicio del primer bloque. */
  startsAt: string;
  blocks: SessionBlocks;
  /** ISO de la cancelación; `null` si sigue en pie. */
  cancelledAt: string | null;
  createdAt: string;
}

/** Una persona en una sala: su respuesta a la invitación y su asistencia. */
export interface RoomMember {
  roomId: string;
  profileId: string;
  status: RoomMemberStatus;
  /** ISO de la última respuesta; `null` mientras está `invitada`. */
  respondedAt: string | null;
  /** ISO de la primera entrada; `null` si no ha entrado. */
  joinedAt: string | null;
  /** Misma semántica que `SessionAttendance.leftAt`. */
  leftAt: string | null;
}

/** Una sala vista desde el usuario actual. */
export interface RoomView {
  room: LockInRoom;
  /** Mi fila. Siempre está: si no la hay, no ves la sala. */
  me: RoomMember;
  /**
   * Las demás personas que puedes ver, con su perfil, por orden de
   * `profileId`. Quien convoca las ve todas; el resto, solo a quien ha
   * aceptado (el ciego de invitados lo impone el servidor).
   */
  others: { member: RoomMember; profile: Profile }[];
}

/** Datos para convocar. El repositorio pone id, quien convoca y fechas. */
export interface RoomInput {
  /** 2–4 ids de perfil, sin repetir, todos matches tuyos. */
  inviteeIds: string[];
  startsAt: string;
  blocks: SessionBlocks;
}
```

### Reglas — `src/data/rooms.ts` (nuevo)

Una sola fuente para el mock, el repositorio de Supabase y la UI, como
`src/data/sessions.ts`, y espejo de la migración. Reutiliza de `sessions.ts`
`sessionEndsAtMs`, `isValidStartsAt` y `JOIN_WINDOW_MINUTES` (importa, no
modifica).

- `ROOM_MIN_INVITEES = 2`, `ROOM_MAX_INVITEES = 4`.
- **Viva**: `cancelledAt === null` y `now < endsAt`.
- **Se responde** solo si estás `invitada` o `aceptada`, no convocas, la sala
  no está cancelada y `now < startsAt`.
- **Se cancela** solo si convocas, no está cancelada y `now < startsAt`.
- **Ventana de entrada**: estás `aceptada`, no cancelada y
  `startsAt − 5 min ≤ now < endsAt`.
- `RoomInviteError` (`LI006`): menos de 2 o más de 4 invitados, repetidos, tú
  entre ellos, o alguno que no es match tuyo.

Las demás violaciones usan las clases de `src/data/session-errors.ts`:

| Error | Código | Cuándo |
|---|---|---|
| `SessionConflictError` | `LI001` | Responder o cancelar una sala ya cancelada |
| `SessionExpiredError` | `LI002` | Responder o cancelar una sala que ya empezó |
| `SessionWindowError` | `LI003` | `startsAt` fuera de rango al convocar; `join` fuera de ventana; `leave` sin haber entrado |
| `SessionForbiddenError` | `LI004` | Sala que no ves (ajena o rechazada); quien convoca responde; quien no convoca cancela; `join` sin haber aceptado |
| `RoomInviteError` | `LI006` | Invitados inválidos (arriba) |

### Contrato — `src/data/repositories.ts`

```ts
export interface RoomRepository {
  /**
   * Salas vivas en las que estás (convocas, te han invitado o aceptaste), por
   * `startsAt` ascendente. Sin canceladas, terminadas ni rechazadas.
   */
  listLive(): Promise<RoomView[]>;
  /** `null` si no existe, no estás o la rechazaste. Sí devuelve canceladas y terminadas. */
  getById(roomId: string): Promise<RoomView | null>;
  create(input: RoomInput): Promise<RoomView>;
  /** Devuelve tu fila: tras rechazar ya no ves la sala. Aceptar dos veces es idempotente. */
  respond(roomId: string, answer: 'aceptada' | 'rechazada'): Promise<RoomMember>;
  cancel(roomId: string): Promise<LockInRoom>;
  /** Idempotente: conserva `joinedAt` y pone `leftAt = null`. */
  join(roomId: string): Promise<RoomMember>;
  leave(roomId: string): Promise<RoomMember>;
  /** Avisa de cualquier cambio en tus salas o en sus miembros. */
  subscribe(listener: () => void): Unsubscribe;
}
```

Colgado de `Repositories` como `rooms`, y expuesto en `src/data/active.ts` e
`index.ts` como `sessions`. La hora del servidor sale de
`repositories.sessions.serverNow()`, que no depende de ningún match.

### Casos de contrato — `src/data/repositories.contract.ts`

Contra el mock y contra Supabase. Reparto: el usuario del test convoca;
`reciprocalAId` y `reciprocalBId` son sus matches (se les da like); el perfil
`openToBothReciprocalId` **no** es match en estos casos y hace de tercero.

1. Convocar con A y B devuelve la sala con `me` `aceptada` y a A y B
   `invitada`; sale en `listLive()`.
2. **El ciego de invitados**: A ve la sala, me ve a mí `aceptada` y **no ve a
   B** mientras B no acepte. Cuando B acepta, A lo ve.
3. B rechaza: quien convoca lo ve `rechazada`; A no lo ve; para B `getById`
   es `null` y la sala no sale en su `listLive()`.
4. Convocar con 1 invitado, con 5, con un repetido, conmigo dentro o con el
   tercero (no es match) → `RoomInviteError`.
5. `startsAt` fuera de rango → `SessionWindowError`.
6. El tercero: `getById` `null`; `respond` y `join` → `SessionForbiddenError`.
7. Quien convoca no puede responder; una invitada no puede cancelar →
   `SessionForbiddenError`.
8. Cancelar antes de empezar la saca de `listLive()`; responder después →
   `SessionConflictError`.
9. `join` fuera de ventana → `SessionWindowError`; `join` estando `invitada`
   → `SessionForbiddenError`; `join` dos veces conserva `joinedAt`; `leave` y
   `join` de nuevo pone `leftAt = null`.
10. Aceptar dos veces es idempotente; rechazar tras aceptar (antes de empezar)
    funciona y la saca de mi `listLive()`.
11. `subscribe` de quien convoca avisa cuando A acepta.
12. Con reloj simulado (`itWithTimeTravel`): responder o cancelar una sala
    empezada → `SessionExpiredError`; una sala terminada sale de `listLive()`
    pero `getById` la sigue devolviendo.

### Supabase — migración nueva

`supabase/migrations/20261002000100_lockin_rooms.sql`. Patrón de
`20260913000100_lockin_sessions.sql` (tablas sin escritura directa, todo por
RPC `SECURITY DEFINER` con `search_path = ''` y la fila bloqueada) y de
`20260917000100_realtime_authorization.sql` (topic privado). El SQL completo
está en la Tarea 2 del plan; aquí, la forma:

- Enum `room_member_status`; tablas `lockin_rooms` (`id`, `host_id` →
  `profiles`, `starts_at`, `blocks` con `check in (1,2,4)`, `cancelled_at`,
  `created_at`) y `room_members` (`room_id` → `lockin_rooms`, `profile_id` →
  `profiles`, `status`, `responded_at`, `joined_at`, `left_at`; PK
  compuesta; `check` de que `responded_at` es nulo si y solo si `invitada`, y
  de que no hay `left_at` sin `joined_at`). Las dos FK con `on delete
  cascade`: `dev_reset_current_user()` borra el perfil y con él sus salas, sin
  tocar `seed.sql`.
- Tres helpers `SECURITY DEFINER` de una línea, para que las políticas
  deparseen en una línea (la huella de esquema lo exige) y no recursen:
  `is_room_participant(room)` (tienes fila no `rechazada`), `is_room_host(room)`
  e `is_room_attendee(room)` (tienes fila `aceptada`).
- **RLS, las dos tablas**, sin políticas de escritura y con `insert, update,
  delete` revocados a `authenticated` (lección del acuerdo):
  - `lockin_rooms`: lees las salas en las que participas.
  - `room_members`: lees **tu fila, todas si convocas, y las `aceptada` de las
    salas en las que participas**. Esta política es el ciego de invitados.
- RPCs: `create_room(uuid[], timestamptz, smallint)`, `respond_room(uuid,
  room_member_status)`, `cancel_room(uuid)`, `join_room(uuid)`,
  `leave_room(uuid)` y `live_rooms()`. `live_rooms()` es `security invoker`
  (RLS aplica) y existe para que «viva» la decida el `now()` de Postgres y no
  el reloj del teléfono (hallazgo 6 de la auditoría de arquitectura). Un
  helper interno `lock_room_for_member(uuid)` bloquea la sala y exige fila no
  rechazada (`LI004`), con `execute` revocado también a `authenticated`.
- **Realtime**: las dos tablas a la publicación con `replica identity full`.
  `postgres_changes` filtra por RLS, así que el ciego también vale por ahí.
- **Presencia**: topic privado `lockin:room:<uuid>`. Helper
  `is_room_topic_member(text)` (misma regex estricta de UUID que
  `is_session_topic_member`) sobre `is_room_attendee`, y dos políticas nuevas en
  `realtime.messages` cuyos nombres empiezan por `lockin` para que entren en la
  huella. **Solo quien ha aceptado** entra al canal: una invitada no sabe
  quién está dentro.

## 2. Pantallas

### Entrada — sección en Matches

`RoomsSection` (`src/features/room/rooms-section.tsx`), montada en el
`ListHeaderComponent` de `src/app/(tabs)/matches.tsx`, debajo del título. Es la
única línea que este bloque toca en esa pantalla (cruce con `chat`).

- **No se pinta** si no hay salas vivas y tienes menos de 2 matches.
- Botón «Convocar sala Lock-In» si tienes 2 o más matches → `/room/new`.
- Una fila (`RoomRow`) por sala viva, con el texto de `roomRowView()`:

| Estado (para quien mira) | Texto | Acento |
|---|---|---|
| Invitada | «{Nombre} te invita · {día hora} · {n} bloques» | latón |
| Convocas, con pendientes | «Tu sala · {día hora} · {k} de {n} han aceptado» | — |
| Aceptada, fuera de ventana | «Sala · {día hora} · {k} personas» | — |
| Aceptada, en ventana | «Entrar a la sala» | latón |

  Toda la fila navega a `/room/[roomId]`. Relee al enfocar y con
  `rooms.subscribe`, más un tic de 30 s para cruzar umbrales, como
  `SessionCard`.

### Convocar — `src/app/room/new.tsx` (nueva)

- **Con quién**: tus matches como chips de selección múltiple
  (`accessibilityRole="checkbox"`, `accessibilityState.checked`), con avatar y
  nombre. Contador «{k} de 4». Se deshabilitan los no marcados al llegar a 4.
- **Cuándo**: los mismos selectores de día y tramo de 15 min que
  `ProposeSessionSheet` (`dayOptions`, `slotsForDay`). Preselección: el
  próximo tramo válido. Sin preselección por franja común: con 3–5 personas
  rara vez hay una, y calcularla no compensa en v1.
- **Bloques**: 1, 2 o 4, mostrando la hora de fin.
- «Convocar» deshabilitado hasta tener 2 invitados. Llama a `rooms.create` y
  sustituye la ruta por `/room/[id]` (`router.replace`, para que atrás vuelva a
  Matches).
- Con menos de 2 matches (deep link): estado vacío «Necesitas al menos 2
  matches para convocar una sala».

### Sala — `src/app/room/[roomId].tsx` (nueva)

Una sola pantalla con estados; reutiliza `phaseAt`, `formatCountdown`,
`useNow` y `formatSessionWhen` de `@/features/session` y la corrección de
reloj con `serverNow()`.

- **Cabecera**: «Convoca {nombre}» (o «Convocas tú»), día y hora, bloques.
- **Personas**: tú y los demás visibles, con avatar (`ProfileAvatar`).
  - Antes de la ventana: quien convoca ve el estado de cada invitación
    («invitada», «ha aceptado», «no podrá ir»); el resto solo ve a quien va.
  - En la ventana: cada persona aceptada con «Está aquí» / «Aún no ha
    entrado», y «Sin conexión» si el canal propio cae. El estado va en texto,
    no solo en color.
- **Acciones** antes de empezar:
  - Invitada: «Me apunto» y «No puedo».
  - Aceptada (sin convocar): «No podré ir» (rechaza; deja de verla y vuelve a
    Matches).
  - Quien convoca: «Cancelar sala».
  Sin diálogos del sistema (rompen la automatización del repo): «No podré ir»
  y «Cancelar sala» piden confirmación en línea, como el «Salir» de la sesión.
- **En la ventana** (aceptada): al montar, `join`; reloj grande, fase
  («Trabajo · bloque 2 de 4»), barra de bloques, y «Salir» con confirmación
  («Saldrás antes de acabar»). El gesto atrás también llama a `leave` si no ha
  terminado.
- **Terminada**: «Sala completada» y «Volver a Matches». Sin valoración.
- **Cancelada**: «{Nombre} canceló la sala».
- **No visible** (ajena, rechazada, deep link viejo): «Esta sala no está
  disponible» y enlace a Matches.

### Aviso — `src/features/room/room-reminders.ts`

Copia de la reconciliación de `src/features/session/reminders.ts` con su propia
clave (`lockin:room-reminder:<id>`, que **no** empieza por
`lockin:reminder:`, así ninguna de las dos reconciliaciones cancela los avisos
de la otra). Programa el aviso de las salas vivas en las que estás `aceptada`
(quien convoca incluido) a `startsAt − 5 min`: «Sala Lock-In en 5 minutos ·
Entra desde Matches». `RoomReminderSync` se monta en `src/app/(tabs)/_layout.tsx`
junto a `SessionReminderSync` y repite con `rooms.subscribe`. Usa el mismo
canal Android y el mismo `NotificationsPort` (exportados desde
`@/features/session`, cruce de una línea).

### Mock — `src/data/mock/rooms.ts` (nuevo)

`createMockRoomRepository(actorId, store, { autoAcceptFrom })`, mismo patrón
que `createMockSessionRepository`: en la app los perfiles de
`SEED_RECIPROCAL_IDS` aceptan al instante, para que se pueda convocar con dos
matches semilla y entrar a la sala sin nadie al otro lado; bajo Jest, apagado.
Implementa el ciego con la misma regla que la política de RLS.

## 3. Alcance de archivos, y a quién pisa

Bloque nuevo **14 `salas`**. Archivos propios, todos nuevos:

- `src/data/rooms.ts` + test; `src/data/mock/rooms.ts`,
  `src/data/supabase/rooms.ts` y sus tests.
- `supabase/migrations/20261002000100_lockin_rooms.sql`.
- `src/features/room/`: `row-view.ts`, `room-row.tsx`, `rooms-section.tsx`,
  `use-live-rooms.ts`, `use-room.ts`, `use-room-presence.ts`,
  `invitee-picker.tsx`, `room-reminders.ts`, `room-reminder-sync.tsx`,
  `index.ts`, y sus tests.
- `src/app/room/new.tsx`, `src/app/room/[roomId].tsx`;
  `test/app/room-new.test.tsx`, `test/app/roomId.test.tsx`.
- `e2e/room.yaml`.

Archivos de otros bloques que toca, declarados enteros:

| Archivo | Dueño original | Qué se toca |
|---|---|---|
| `src/data/types.ts` | `arquitecto` | `RoomMemberStatus`, `LockInRoom`, `RoomMember`, `RoomView`, `RoomInput` |
| `src/data/repositories.ts`, `repositories.contract.ts` | `arquitecto` | `RoomRepository`, `Repositories.rooms`, `ContractFixture.roomsFor` y los doce casos |
| `src/data/active.ts`, `src/data/index.ts` | `arquitecto` | Exponer `rooms` y el adaptador `roomPresence` |
| `src/data/mock/store.ts`, `mock/index.ts`, `mock/index.test.ts` | `arquitecto` | `MockState` gana `rooms` y `roomMembers`; registro; `roomsFor` del fixture |
| `src/data/supabase/index.ts`, `database.types.ts`, `contract.test.ts` | `datos` | Registro, tipos de tablas y RPC, `roomsFor` del fixture |
| `src/data/supabase/presence.ts` (+ test) | `sesiones`/`datos` | Un parámetro `topicPrefix` con el valor de hoy por defecto |
| `supabase/schema-embedded.test.mjs`, `drift-check.mjs` (solo si no parsea las tablas nuevas) | `datos`/`calidad` | Los tests en PGlite |
| `src/features/session/index.ts` | `sesiones` | Exportar `createNotificationsPort`, `REMINDER_LEAD_MS`, `SESSIONS_CHANNEL_ID` y los tipos `NotificationsPort`/`ReminderStorage` |
| `src/app/(tabs)/matches.tsx` + `test/app/matches.test.tsx` | `chat` | Una línea: `<RoomsSection />` en la cabecera |
| `src/app/_layout.tsx` | `arquitecto` | Dos `Stack.Screen`: `room/new` y `room/[roomId]` |
| `src/app/(tabs)/_layout.tsx` | `arquitecto`/`sesiones` | Una línea: `<RoomReminderSync />` |
| `e2e/run.mjs`, `verify.mjs` | `calidad` | `room.yaml` encadenado en la variante `supabase` tras `agreement.yaml`; la `mock` no se toca |

- **No toca Fase 2 por dentro.** `src/data/sessions.ts`, `session-errors.ts`,
  `src/app/session/[sessionId].tsx`, las rachas y la valoración quedan
  intactos: se importan, no se modifican. Los dos cruces con `sesiones` son una
  línea de exportación y un parámetro con valor por defecto.
- **Cero dependencias nuevas y ninguna build nativa.**

## 4. Casos límite

| Caso | Qué pasa |
|---|---|
| Nadie más acepta | La sala sigue: quien convoca la ve con «0 de N han aceptado» y puede cancelarla. Si no cancela, entra sola. |
| Dos salas a la misma hora, o una sala y una sesión 1:1 | Se permite, como hoy entre dos sesiones de matches distintos. Sin comprobación de solapes en v1. |
| Quien convoca borra su perfil | La sala cae con él (`on delete cascade`). |
| Un miembro borra su perfil | Su fila cae; la sala sigue. |
| El match entre quien convoca y un invitado desaparece | Solo se comprueba al convocar; la invitación sigue en pie. |
| Rechazar y luego querer ir | No se puede (decisión 10): la sala ya no se ve. |
| Responder y cancelar a la vez | Las RPC bloquean la fila de la sala (`for update`) y revalidan: la segunda recibe `SessionConflictError` y la pantalla relee. |
| Deep link a una sala ajena | `getById` → `null`: «Esta sala no está disponible». |
| Reloj del móvil desfasado | `serverNow()` corrige el reloj de la pantalla; `live_rooms()` usa `now()` de Postgres. |
| Sin conexión en la sala | La cuenta atrás sigue en local; «Sin conexión» en la presencia. |
| Permiso de avisos denegado | La sala funciona igual, sin aviso. |
| Sin credenciales de Supabase | Va contra el mock, como todo lo demás. |
| Web (`expo export --platform web`) | Solo React Native y datos. El puerto de notificaciones ya es nulo en web. |

## 5. Tests

- **Unitarios**: `src/data/rooms.ts` (viva, ventana, se puede responder, se
  puede cancelar, validación de invitados, con las fronteras exactas);
  `roomRowView` en sus cuatro estados; `room-reminders.ts` (programa, no
  programa con menos de 5 min, no programa si estás `invitada`, cancela al
  rechazar o cancelarse, **no toca claves `lockin:reminder:`**).
- **Contrato** (`repositories.contract.ts`): los doce casos de arriba.
- **SQL en PGlite** (`schema-embedded.test.mjs`). El test que más vale del
  bloque es **el ciego de invitados por RLS**: con la sala de Ana (convoca)
  invitando a Bea y Carla, Bea ve a Ana y no a Carla; cuando Carla acepta, sí;
  Ana ve a las dos con su estado; un tercero no ve ni la sala ni sus filas.
  Además: `insert`/`update` directos de `authenticated` fallan por permisos;
  `create_room` rechaza un no-match, un repetido, 1 y 5 invitados (`LI006`) y
  la hora fuera de rango (`LI003`); `respond_room` de quien convoca y de un
  tercero (`LI004`); `join_room` de una invitada (`LI004`); las políticas de
  `realtime.messages` dejan entrar en `lockin:room:<id>` a una aceptada y no a
  una invitada ni a un tercero; `anon` sin `execute`.
- **Componentes y pantallas** (RNTL): `RoomRow`, `RoomsSection` (oculta con 0–1
  matches y sin salas), `InviteePicker` (tope de 4), `test/app/room-new.test.tsx`
  (convoca y navega) y `test/app/roomId.test.tsx` (invitada acepta, convoca y
  cancela, en ventana entra y ve el reloj, salir con confirmación, terminada,
  no disponible).
- **E2E** (Maestro, variante `supabase`, encadenado tras `agreement.yaml`):
  `prepareRoom` siembra con `service_role` una sala que convoca la contraparte
  del match del recorrido, empieza en 4 minutos, con un tercer perfil semilla
  `aceptada` y el usuario `invitada`. La app abre Matches, toca la invitación,
  «Me apunto», ve el reloj y «Salir» con confirmación; `verifyRoomAttendance`
  comprueba en Postgres su fila `aceptada` con `joined_at` y `left_at` no
  nulos. La variante `mock` sigue siendo el control negativo y no se toca.

## Fuera de alcance de esta spec

- Vídeo y audio en la sala.
- Chat de grupo, título, objetivo o cualquier texto libre de la sala.
- Salas abiertas, descubribles o por enlace.
- Grupos persistentes, salas recurrentes, añadir o expulsar gente.
- Valoración de la sala y cualquier efecto en rachas.
- Solapes entre salas y sesiones.
- Notificación push de servidor al recibir una invitación (el aviso es local y
  solo para salas aceptadas; la invitación se ve al abrir Matches).

## Dependencias

Del código: `sesiones` entregado (reglas de tiempo, `phaseAt`, `serverNow`,
presencia, notificaciones). No depende de `video`, `rachas`, `valoracion`,
`verificacion` ni `acuerdo`.

**Del usuario**, que no bloquea el desarrollo (avanza entero contra el mock y
PGlite):

1. **Revisar las decisiones de arriba** antes de la Tarea 1.
2. Aplicar `20261002000100_lockin_rooms.sql` en `grrzmzktrhksbttpbblg` por el
   SQL Editor. Hasta entonces `Schema drift` remoto suma esta migración a la
   excepción vigente (memoria `schema-drift-remoto-rojo-esperado.md`: hoy son
   `record_decision` y `discovery_deck`).
3. Nada más: sin credenciales, sin dashboard y sin build nativa. Recorrer la
   sala en el emulador lo hace el agente `comprobador`.
