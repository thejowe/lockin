# Plan — Vídeo real en la sesión Lock-In

Spec: `docs/superpowers/specs/2026-09-16-video-real-sesion-design.md`. Léela
entera antes de tocar código — trae las interfaces exactas y el porqué de
cada decisión. Checklist de ejecución en `docs/plan/todo/video.md`, una
casilla por tarea, marcada al hacer su commit con evidencia real al lado.

## Global Constraints

- No tocar nada fuera de "Alcance de archivos" de `docs/plan/PLAN.md` bloque
  10 sin pararse a avisarlo primero.
- `npx tsc --noEmit`, `npm run lint` y `npm test` deben quedar limpios al
  final de cada tarea (salvo que la propia tarea diga lo contrario, p. ej.
  mientras el mock nativo aún no existe).
- Seguir el estilo de comentarios del repo: nada de explicar qué hace el
  código, solo el porqué no obvio, en español, como el resto de `src/`.
- No marcar una casilla de `todo/video.md` sin haber comprobado que el
  trabajo está commiteado.

## Orden

1 → 2 → 3 (pueden ir 2 y 3 con 1 ya commiteado, pero no antes: 2 y 3 no
necesitan el módulo nativo real para sus propios tests si se mockea pronto,
pero sí necesitan que `jest.setup.js` ya tenga el mock de la Tarea 1 para no
duplicar trabajo). 4 necesita 1, 2 y 3. 5 necesita 4. 6 necesita 4 y 5.
7 necesita todas.

### Tarea 1 — Dependencia, plugin y mock de test

**Files**: `package.json`, `app.json`, `jest.setup.js`.

**Qué hace**: añade `react-native-webrtc` a dependencies, su config plugin a
`expo.plugins`, los permisos de cámara/micrófono en `ios`/`android` (ver spec
§5), y un mock manual en `jest.setup.js` que exporte `RTCPeerConnection`
(con `createOffer`/`createAnswer`/`setLocalDescription`/
`setRemoteDescription`/`addIceCandidate`/`close` como jest.fn que resuelven),
`RTCView` (componente que no renderiza nada real), y `mediaDevices` con
`getUserMedia` devolviendo un stream falso con `getTracks()` vacío o con
tracks falsos controlables por test.

**Criterio de terminado**: `npm install` deja `react-native-webrtc` en
`package-lock.json`; `npx tsc --noEmit` limpio; `npm test` sigue en verde
(nada debería importar el paquete real todavía, así que esto solo verifica
que no rompiste nada); `npx expo-doctor` o al menos `node -e
"require('./app.json')"` no falla al parsear el plugin nuevo.

**Verificación manual pendiente** (anotar en `todo/video.md`, no bloquea el
resto): un build real de dev client (`eas build --profile development`)
haría falta para confirmar que el plugin nativo compila — no es ejecutable
desde este entorno sin credenciales de EAS interactivas; queda para cuando
el usuario lo corra.

### Tarea 2 — Señalización en memoria

**Files**: `src/data/video-signal.ts` (nuevo), `src/data/video-signal.test.ts`
(nuevo), `src/data/index.ts` (reexporta).

**Interfaces**: exactas de la spec §1 (`VideoSignalMessage`,
`VideoSignalHandlers`, `VideoSignalChannel`,
`createMemoryVideoSignalAdapter`).

**Tests** (seguir el esqueleto de `src/data/presence.test.ts`): dos
`profileId` distintos en el mismo `sessionId` se reciben los mensajes el uno
al otro; un mensaje propio (`from === profileId`) no vuelve como eco; salir
(la función que devuelve `join`) deja de recibir; dos sesiones distintas no
se cruzan mensajes.

**Criterio de terminado**: `npx jest src/data/video-signal.test.ts` en
verde; `npx tsc --noEmit` limpio.

### Tarea 3 — Señalización sobre Supabase

**Files**: `src/data/supabase/video-signal.ts` (nuevo),
`src/data/supabase/video-signal.test.ts` (nuevo), `src/data/active.ts`
(añade `videoSignal`).

**Interfaces**: `createSupabaseVideoSignalAdapter` de la spec §2. Antes de
escribir, leer `src/data/supabase/presence.ts` y su cliente
(`src/data/supabase/client.ts`) para reusar exactamente el mismo patrón de
mock de `SupabaseClient` que ya usen los tests vecinos de `supabase/` (mirar
cómo `sessions.test.ts` o el test más cercano a un canal de realtime
construye su doble, en vez de inventar uno nuevo).

**Criterio de terminado**: `npx jest src/data/supabase/video-signal.test.ts`
en verde; `npx tsc --noEmit` limpio; `src/data/active.ts` exporta
`videoSignal` con la misma regla que `presence`.

### Tarea 4 — El hook de la llamada

**Files**: `src/features/session/use-video-call.ts` (nuevo),
`src/features/session/use-video-call.test.ts` (nuevo),
`src/features/session/index.ts` (reexporta).

**Interfaces**: exactas de la spec §3 (`VideoCallStatus`, `VideoCall`,
`useVideoCall`).

**Qué cubrir en tests** (con el mock de la Tarea 1): quién ofrece según el
orden lexicográfico de `myProfileId`/`counterpartId` — determinista, sin
azar; transición `'inactiva' → 'conectando' → 'conectada'` cuando ambos
extremos intercambian offer/answer/ICE por el canal mock de la Tarea 2;
`active=false` (o pasar a `false` a mitad) limpia la conexión (`close()`
llamado) sin dejarla abierta; `toggleMic`/`toggleCamera` cambian el estado
expuesto y detienen/reanudan los tracks del stream falso.

**Criterio de terminado**: `npx jest
src/features/session/use-video-call.test.ts` en verde; `npx tsc --noEmit`
limpio.

### Tarea 5 — Pantalla de la llamada e integración

**Files**: `src/features/session/video-call-view.tsx` (nuevo),
`src/features/session/video-call-view.test.tsx` (nuevo),
`src/app/session/[sessionId].tsx` (integra), `src/features/session/index.ts`.

**Qué hace**: `video-call-view.tsx` según spec §4 — dos `RTCView`, controles
de mic/cámara/colgar, aviso de texto en `Platform.OS === 'web'`. Se integra
en la pantalla de sesión mientras `canJoin && !ended`, sin tocar la lógica
de fases/asistencia/valoración que ya existe (solo añade el componente al
árbol y le pasa `sessionId`/ids/`active`).

**Criterio de terminado**: `npx jest
src/features/session/video-call-view.test.tsx
src/app/session/\[sessionId\].test.tsx` en verde (si el test de la pantalla
de sesión ya existe, extenderlo con el caso de que el hueco de vídeo aparece
en ventana y no fuera de ella); `npx tsc --noEmit` limpio; `npm run lint`
limpio.

### Tarea 6 — Cobertura de casos límite

**Files**: los mismos test de las Tareas 4 y 5, extendidos — sin archivos
nuevos salvo que el revisor vea que un caso necesita su propio archivo.

**Qué cubrir**: los de la spec §6 — permiso denegado (`getUserMedia`
rechaza), timeout de conexión sin respuesta de la otra parte, colgar limpia
sin dejar listeners, volver a entrar tras colgar levanta una llamada nueva
sin arrastrar estado.

**Criterio de terminado**: `npm test -- --coverage` sin bajar el suelo de
`jest.config.js`; `npm run lint` y `npx tsc --noEmit` limpios.

### Tarea 7 — Cierre del bloque

**Files**: `docs/plan/TODO.md`, `docs/plan/todo/video.md`.

**Qué hace**: marca las casillas de `todo/video.md` con su evidencia real
(comandos y salida, no solo la marca), añade la entrada de "vídeo" a
`docs/plan/TODO.md` sustituyendo la línea suelta "Vídeo real en la sesión
(spec propia)", y dejar explícito qué sigue sin verificar y por qué (la
llamada real entre dos dispositivos, el build de EAS con el plugin nativo) —
mismo estilo que el cierre de `sesiones`/`rachas`: no marcar como hecho lo
que solo se verificó con mocks.

**Criterio de terminado**: `git status` limpio para los archivos de este
bloque; CI (`lint`, tipos, tests, export web) en verde sobre el commit final.
