# Vídeo real en la sesión Lock-In — diseño

> Bloque 10 `video` de `docs/plan/PLAN.md`. Cierra el hueco que `sesiones`
> (Fase 2, bloque 7) dejó a propósito: la sesión Lock-In tiene Pomodoro
> compartido, presencia y recordatorios, pero la llamada de vídeo en sí seguía
> siendo un hueco sin construir (`CONCEPTO.md` → "Fuera de alcance del MVP").

## Contexto

`CONCEPTO.md`, sección "El diferenciador": *"El MVP no construye el video
real, pero el chat debe dejar hueco visible para esa acción"*. Ese hueco ya
existe — `src/app/session/[sessionId].tsx` tiene Pomodoro, presencia
("Está aquí"/"Aún no ha entrado") y asistencia. Falta la llamada en sí.

El commit `db763db` ("configura el proyecto EAS y expo-updates para builds en
dispositivo") deja el terreno preparado: una llamada de vídeo real necesita
módulos nativos (cámara, micrófono, WebRTC) que **no existen en Expo Go** —
hace falta un dev client / build de EAS, que es justo lo que ese commit monta.

## Qué problema resuelve, y cuál no

Resuelve: una llamada de vídeo 1:1 real entre las dos personas de una sesión
Lock-In, dentro de la ventana de la sesión, sin salir de la pantalla que ya
tienen.

No resuelve (fuera de alcance de esta spec, quedan para fases posteriores):

- Salas grupales (Fase 3 de `CONCEPTO.md`).
- Grabación, compartir pantalla, fondos virtuales, subtítulos.
- TURN gestionado de pago — sin él, una llamada entre dos redes con NAT
  simétrico (frecuente en 4G/5G restrictivo o redes corporativas) puede no
  conectar. Es una limitación conocida, documentada, no un bug a perseguir en
  este bloque.
- Subida o almacenamiento de vídeo en ningún sitio — coherente con "sin
  subida de imágenes real" que ya rige el resto del MVP.

## Decisiones tomadas

### Por qué WebRTC nativo (`react-native-webrtc`) y no un proveedor de pago

Daily, Twilio, LiveKit, etc. resuelven TURN gestionado y son más robustos en
redes difíciles, pero cada uno añade una tercera credencial bloqueante — el
mismo problema que ya tiene `datos` con Supabase (bloque parcialmente
bloqueado sin credenciales del usuario). Para un MVP de una llamada 1:1 entre
dos móviles, WebRTC directo con **STUN público** (`stun:stun.l.google.com:19302`,
sin cuenta) es suficiente en la mayoría de redes domésticas/WiFi y no depende
de que el usuario dé de alta ni pague nada. Si en verificación real aparecen
fallos de conexión sistemáticos, añadir TURN gestionado es un cambio acotado
a `use-video-call.ts` (una entrada más en `iceServers`), no un rediseño.

### Por qué la señalización va por Supabase Realtime Broadcast, no por una tabla

La señalización (SDP offer/answer, candidatos ICE) es tráfico efímero de
segundos, no estado que alguien necesite leer después — igual que la
presencia de `src/data/presence.ts`. Se sigue el mismo patrón exacto: un
canal por sesión, sin tabla, sin migración, sin RLS que diseñar. Broadcast en
vez de Presence porque aquí no hace falta "quién está", sino "pásale este
mensaje a la otra persona conectada al canal ahora mismo".

### Por qué solo funciona en build de dispositivo, no en Expo Go ni en export web

`react-native-webrtc` es un módulo nativo: no existe en el runtime de Expo Go
ni tiene build web real (el `expo-router` "export web" del CI seguirá
funcionando porque el código deberá comprobar `Platform.OS` antes de tocar el
módulo, pero la llamada en sí no es utilizable desde un navegador de
escritorio en esta spec). Quien abra la sesión desde la versión web del
proyecto ve un aviso, no una pantalla en blanco ni un crash — y el CI de
`export web` sigue en verde porque el módulo nativo nunca se ejecuta ahí.

### Por qué la ventana de la llamada es la misma que la de la sesión

La llamada empieza a estar disponible en cuanto `isInJoinWindow()` es cierto
(los 5 minutos de antelación que ya usa la asistencia) y se cierra cuando la
fase es `'terminada'` — ni una fase nueva ni un botón "empezar llamada"
aparte. Coincide con cómo ya funciona la presencia y evita que la persona
tenga que sincronizar dos cosas distintas a la vez que entra.

### Por qué un fallo de vídeo no bloquea el resto de la sesión

El Pomodoro, la asistencia y la valoración son independientes de si la
llamada conecta. Si alguien deniega el permiso de cámara, su dispositivo no
tiene cámara, o la conexión ICE nunca cierra, la sesión sigue: se ve el
temporizador y se puede seguir usando el chat. El estado de error de la
llamada se pinta como un aviso dentro de su propio hueco de UI, nunca como
pantalla de error de toda la sesión.

## 1. Señalización — `src/data/video-signal.ts` (nuevo)

Mismo patrón que `src/data/presence.ts`: no es un repositorio, no tiene
contrato de persistencia, `src/data/active.ts` elige el adaptador con la
misma regla (credenciales de Supabase presentes o no).

```ts
export type VideoSignalKind = 'offer' | 'answer' | 'ice-candidate' | 'hangup';

export interface VideoSignalMessage {
  kind: VideoSignalKind;
  /** profileId de quien envía — para que el receptor descarte sus propios ecos. */
  from: string;
  /** SDP para offer/answer, candidato serializado para ice-candidate, `null` para hangup. */
  payload: unknown;
}

export interface VideoSignalHandlers {
  onMessage(message: VideoSignalMessage): void;
  onConnection(online: boolean): void;
}

export interface VideoSignalChannel {
  /** Entra en el canal de señalización de la sesión. Devuelve la función para salir. */
  join(sessionId: string, profileId: string, handlers: VideoSignalHandlers): () => void;
  send(sessionId: string, message: VideoSignalMessage): void;
}

export function createMemoryVideoSignalAdapter(): VideoSignalChannel { /* ... */ }
```

`createMemoryVideoSignalAdapter()` sigue el mismo truco que
`createMemoryPresenceAdapter()`: `Map<sessionId, Map<symbol, {profileId,
handlers}>>`, y `send` reenvía a todos los miembros de la sala salvo al
emisor (comparando `from`).

## 2. Señalización sobre Supabase — `src/data/supabase/video-signal.ts` (nuevo)

```ts
export function createSupabaseVideoSignalAdapter(
  getClient: () => LockInSupabaseClient = getSupabaseClient
): VideoSignalChannel { /* ... */ }
```

Un canal `lockin:video:<sessionId>` por sesión, evento de broadcast único
(`'signal'`). `join` se suscribe con `.on('broadcast', { event: 'signal' },
({ payload }) => ...)` y descarta mensajes con `payload.from === profileId`.
`send` usa `channel.send({ type: 'broadcast', event: 'signal', payload:
message })`. Sin `channel.track()` — a diferencia de presence, aquí no hace
falta publicar estado, solo reenviar mensajes.

`src/data/active.ts` gana un tercer export, `videoSignal`, con la misma regla
que `presence`.

## 3. La llamada — `src/features/session/use-video-call.ts` (nuevo)

```ts
export type VideoCallStatus = 'inactiva' | 'conectando' | 'conectada' | 'error';

export interface VideoCall {
  status: VideoCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  error: string | null;
  toggleMic(): void;
  toggleCamera(): void;
  hangUp(): void;
}

export function useVideoCall(
  sessionId: string | null,
  myProfileId: string | null,
  counterpartId: string | null,
  active: boolean, // true solo mientras canJoin && !ended
  channel?: VideoSignalChannel
): VideoCall
```

Decide quién ofrece con una regla determinista y sin coordinación: el
`profileId` menor en orden lexicográfico manda el `offer`; evita "glare"
(los dos ofreciendo a la vez) sin necesitar un tercer mensaje de arbitraje.
`RTCPeerConnection` con `iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]`
únicamente — sin TURN (ver "Decisiones tomadas"). `getUserMedia({ audio:
true, video: true })` de `react-native-webrtc` para el stream local.

`active` en `false` (sesión aún no en ventana, o ya terminada, o
`Platform.OS === 'web'`) desconecta y limpia sin que el resto de la pantalla
tenga que saberlo.

## 4. Pantalla — `src/features/session/video-call-view.tsx` (nuevo) + integración

`video-call-view.tsx` pinta dos `RTCView` (`react-native-webrtc`): el stream
remoto ocupando el hueco de vídeo, el propio en una esquina pequeña, con dos
botones superpuestos (mic, cámara) y un tercero para colgar que no navega —
colgar la llamada no es salir de la sesión, son cosas independientes (ver
"Por qué un fallo de vídeo no bloquea el resto de la sesión"). En
`Platform.OS === 'web'` pinta un aviso de texto en vez de intentar cargar el
módulo nativo.

En `src/app/session/[sessionId].tsx`: `video-call-view` se pinta por encima
del bloque `clock` mientras `canJoin && !ended` (mismo hueco donde hoy vive
solo el Pomodoro) — el temporizador se queda visible debajo o superpuesto en
una esquina; el diseño exacto del layout (vídeo grande + Pomodoro pequeño
superpuesto, frente a vídeo y Pomodoro apilados) lo decide quien implemente
la Tarea de pantalla mirando el espacio real en un dispositivo, no es una
decisión que valga la pena congelar aquí en abstracto.

## 5. Infraestructura y dependencias

- `react-native-webrtc` como dependencia de producción, más su config plugin
  en `app.json` → `expo.plugins`.
- Permisos: `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` en
  `ios` (vía el plugin o `infoPlist` si el plugin no los cubre), y
  `android.permissions`: `CAMERA`, `RECORD_AUDIO`.
- El módulo nativo no existe en el entorno de test de Node: mock en
  `jest.setup.js` (mismo sitio donde ya vive el mock de `expo-notifications`)
  para `RTCPeerConnection`, `RTCView`, `mediaDevices.getUserMedia`.
- Deja de poder probarse en Expo Go: cualquier verificación manual necesita
  un build de dev client (`eas build --profile development`) — anotarlo en
  `supabase/README.md` o en un README de sesión no hace falta; basta con
  dejarlo en `todo/video.md`, igual que otros bloqueos de verificación.

## 6. Casos límite

- Permiso de cámara/micrófono denegado: `error` se rellena, no crashea; el
  resto de la sesión sigue.
- La otra persona no tiene cámara o no ha dado permiso: mi lado se queda en
  `'conectando'` indefinidamente salvo timeout razonable (p. ej. 30 s →
  `'error'` con mensaje "No se pudo conectar el vídeo").
- Cambiar de red (WiFi → datos) a media llamada: no se implementa ICE
  restart en esta spec — la llamada puede caer y no reconecta sola; queda
  como límite conocido, igual que el de TURN.
- Salir de la sesión (`attendance.leave()`) cuelga la llamada como parte de
  la limpieza, no como acción aparte.
- Volver a entrar en la ventana tras haber colgado: debe poder levantar una
  llamada nueva desde cero, sin arrastrar estado de la anterior.

## 7. Tests

- `video-signal.test.ts`: mismo esqueleto que `presence.test.ts` contra
  `createMemoryVideoSignalAdapter()` — dos miembros se ven los mensajes el
  uno al otro, no el propio eco, salir deja de recibir.
- `supabase/video-signal.test.ts`: mismo esqueleto que `supabase/presence.ts`
  no tiene test dedicado hoy — comprobar contra el patrón real de
  `supabase/presence.test.ts` si existe, o el de otro adaptador de Supabase
  con canal (`sessions.subscribe`) para no inventar un doble de
  `SupabaseClient` distinto al que ya usa el resto de `src/data/supabase/`.
- `use-video-call.test.ts`: con `react-native-webrtc` mockeado, cubrir quién
  ofrece según el orden de los dos ids, la transición de estados, y que
  `active=false` limpia sin dejar el `RTCPeerConnection` abierto.
- E2E (Maestro): un emulador headless no tiene cámara real fiable — no vale
  la pena perseguir un E2E de vídeo conectando de verdad. Lo que sí puede
  cubrir un flujo E2E es que la pantalla de sesión pinta el hueco de vídeo (o
  su aviso en web) sin crashear. La conexión real entre dos dispositivos se
  cierra **con la palabra del usuario**, igual que la Tarea 11 de `sesiones`
  — dos móviles reales, ver vídeo y audio en los dos sentidos.

## Fuera de alcance de esta spec

Salas grupales, grabación, compartir pantalla, TURN gestionado/de pago,
reconexión automática tras cambio de red, fondos virtuales, subtítulos,
Modo Talento (no aplica).

## Dependencias

Bloque `sesiones` ya entregado y cerrado (presencia, Pomodoro, asistencia).
No depende de credenciales nuevas del usuario: Supabase Realtime Broadcast
usa las credenciales que ya existen, y STUN público no necesita cuenta.
Depende de la infraestructura de EAS/dev client de `db763db`, ya en el repo.
