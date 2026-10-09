# LockIn — inventario de datos recopilados

Auditoría documental: 9 de octubre de 2026. Base: commit `0cddbbbae3a894c64e2be04f2c74c081602db8e6`. Describe el código y todas las migraciones del repositorio; no certifica la configuración del proyecto de producción. La política y los cuestionarios deben usar este mismo inventario.

Fuentes principales: [tipos de dominio](../../src/data/types.ts), [migraciones](../../supabase/migrations/), [configuración nativa](../../app.json), [selección de backend](../../src/data/active.ts) y [especificaciones](../superpowers/specs/). Con Supabase configurado los datos se guardan en el servidor. El mock conserva datos en memoria para desarrollo y no representa la recogida de una versión publicada.

## Cómo leer las tablas

Cada apartado indica el almacén; cada fila representa una columna SQL existente. En `prompts`, cada elemento guarda además `question` y `answer`. Se incluyen 11 tablas y 76 columnas, también las tablas auxiliares que no estaban enumeradas en el encargo.

Visibilidad efectiva para usuarios normales:

| Código | Quién puede leer |
| --- | --- |
| P | Cualquier cuenta autenticada puede leer el perfil completo, UUID y fechas incluidos. Una cuenta anónima de Supabase también lleva el rol authenticated: no hace falta un email verificado para enumerar perfiles. No es solo la otra persona del match. |
| U | Solo quien origina el dato: titular de preferencias, autor del swipe o autor de la valoración. El objetivo del swipe no ve likes entrantes sin corresponder. |
| M | Las dos personas del match, incluidas sus sesiones, asistencia y mensajes. |
| A | El autor lee sus propias filas. La otra persona accede mediante match_agreement y ve opción, nota y fecha de un tema solo después de responder a ese mismo tema. Antes puede saber que ya se respondió. |
| S | Quien tiene una fila de miembro con estado distinto de rechazada puede leer la sala. Tras rechazar deja de ver los datos de la sala, pero su propia fila de miembro sigue siendo legible. |
| SM | Cada persona lee su propia fila; quien convoca lee todas; los demás participantes no rechazados leen las filas aceptadas. Una invitación pendiente no se muestra a otros invitados; quien convoca sí ve rechazos. |

Además, las personas con acceso administrativo privilegiado al proyecto y sus proveedores pueden acceder según sus permisos operativos. RLS limita clientes normales; no equivale a cifrado que impida al operador leer mensajes. **[PENDIENTE DE DECISIÓN] D05:** concretar proveedores, accesos operativos y garantías en producción.

Retención: el código no fija un plazo general ni una purga automática por antigüedad en estas tablas. **[PENDIENTE DE DECISIÓN] D04:** definir plazos por clase de datos, cuentas inactivas o irrecuperables, solicitudes de baja, registros operativos y copias de seguridad. Los códigos siguientes describen únicamente lo que sí hace el esquema:

| Código | Comportamiento actual de conservación |
| --- | --- |
| R1 | Perfil persistente; editar sustituye valores. Borrar auth.users elimina el perfil por cascada. La política SQL permite al titular borrar su perfil, pero no hay flujo de baja de cuenta en la app. |
| R2 | Preferencias persistentes; desaparecen si se elimina la cuenta Auth. Borrar solo profiles no borra user_settings. |
| R3 | Persistente sin TTL. Las referencias a profiles, matches o lockin_sessions eliminan las filas dependientes por cascada si se borra su padre. No existe borrado de mensajes individuales ni de valoraciones en la UI. |
| R4 | La sala persiste al finalizar o cancelarse. Se elimina por cascada si se borra el perfil de quien convoca; entonces se eliminan también todos sus miembros. |
| R5 | La fila persiste después de rechazar o salir. Se elimina por cascada al borrar la sala o el perfil del miembro; borrar un invitado no borra toda la sala. |

Las cascadas son mecanismos SQL, no una promesa de plazo ni una función de eliminación de cuenta ya disponible. Al borrar un perfil desaparecen sus matches y con ellos también mensajes escritos por la otra persona, sesiones, valoraciones y respuestas de ese match.

## Campos persistentes de producto

### `public.profiles` → `Profile`

Almacén: Supabase Postgres, tabla `public.profiles`. Fuente: [20260905000200_profiles_and_settings.sql](../../supabase/migrations/20260905000200_profiles_and_settings.sql).

Columnas añadidas: [especialidades buscadas](../../supabase/migrations/20260907000100_profiles_seeking_specialties.sql) y [sello GitHub](../../supabase/migrations/20260916000100_github_verification.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID de cuenta; coincide con auth.users.id. | P | R1; plazo D04 pendiente |
| `name` | `name` | Nombre declarado (hasta 80 caracteres). | P | R1; plazo D04 pendiente |
| `age` | `age` | Edad entera declarada; SQL 16–120, formulario 16–99. | P | R1; plazo D04 pendiente |
| `location` | `location` | Ciudad o zona en texto libre; no coordenadas ni GPS. | P | R1; plazo D04 pendiente |
| `timezone` | `timezone` | Zona horaria IANA declarada. | P | R1; plazo D04 pendiente |
| `avatar_initials` | `avatar.initials` | Una o dos iniciales; se pueden derivar del nombre. | P | R1; plazo D04 pendiente |
| `avatar_accent` | `avatar.accent` | Color brass o teal; no imagen. | P | R1; plazo D04 pendiente |
| `specialties` | `specialties` | Especialidades que declara dominar; 1–10 etiquetas. | P | R1; plazo D04 pendiente |
| `looking_for` | `lookingFor` | par, lockin o ambos. | P | R1; plazo D04 pendiente |
| `starting_point` | `startingPoint` | solo-ganas, idea-sin-empezar o algo-empezado. | P | R1; plazo D04 pendiente |
| `availability_hours_per_week` | `availability.hoursPerWeek` | Horas disponibles por semana (1–168). | P | R1; plazo D04 pendiente |
| `availability_bands` | `availability.bands` | Franjas madrugada, manana, tarde o noche (1–4). | P | R1; plazo D04 pendiente |
| `ambition` | `ambition` | lifestyle, equilibrado o todo-o-nada. | P | R1; plazo D04 pendiente |
| `link_github` | `links.github` | Enlace opcional; con sello se deriva de la identidad de GitHub. | P | R1; plazo D04 pendiente |
| `link_portfolio` | `links.portfolio` | Enlace opcional al portfolio. | P | R1; plazo D04 pendiente |
| `link_linkedin` | `links.linkedin` | Enlace opcional a LinkedIn; sin verificación OAuth de LinkedIn. | P | R1; plazo D04 pendiente |
| `prompts` | `prompts` | JSON con 0–2 objetos; la UI exige al menos una respuesta. Cada objeto guarda question y answer. | P | R1; plazo D04 pendiente |
| `created_at` | `createdAt` | Fecha de creación del perfil. | P | R1; plazo D04 pendiente |
| `updated_at` | `updatedAt` | Fecha de última actualización del perfil. | P | R1; plazo D04 pendiente |
| `seeking_specialties` | `seekingSpecialties` | Especialidades buscadas (0–10); vacío significa abierto a cualquiera. | P | R1; plazo D04 pendiente |
| `github_handle` | `githubVerification.handle` | Nombre de cuenta de GitHub obtenido del OAuth, o null. | P | R1; plazo D04 pendiente |
| `github_verified_at` | `githubVerification.verifiedAt` | Fecha del sello de autoría del enlace, o null. | P | R1; plazo D04 pendiente |

### `public.user_settings` → `Session`

Almacén: Supabase Postgres, tabla `public.user_settings`. Fuente: [20260905000200_profiles_and_settings.sql](../../supabase/migrations/20260905000200_profiles_and_settings.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `user_id` | `profileId (derivado)` | UUID de cuenta. profileId es null si todavía no hay perfil. | U | R2; plazo D04 pendiente |
| `active_mode` | `activeMode` | Modo activo; null antes de elegirlo. | U | R2; plazo D04 pendiente |
| `created_at` | — | Fecha de creación de las preferencias. | U | R2; plazo D04 pendiente |
| `updated_at` | — | Fecha de última actualización de las preferencias. | U | R2; plazo D04 pendiente |

### `public.decisions` → `Decision / DecisionResult`

Almacén: Supabase Postgres, tabla `public.decisions`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `actor_id` | `usuario actual` | UUID de quien hace el swipe. | U | R3; plazo D04 pendiente |
| `target_id` | `perfil objetivo` | UUID del perfil sobre el que decide. | U | R3; plazo D04 pendiente |
| `decision` | `decision` | like o pass. | U | R3; plazo D04 pendiente |
| `created_at` | — | Fecha del swipe. | U | R3; plazo D04 pendiente |

### `public.matches` → `Match`

Almacén: Supabase Postgres, tabla `public.matches`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID del match. | M | R3; plazo D04 pendiente |
| `profile_a` | `profileIds` | UUID de uno de los dos perfiles; par ordenado en SQL. | M | R3; plazo D04 pendiente |
| `profile_b` | `profileIds` | UUID del otro perfil. | M | R3; plazo D04 pendiente |
| `mode` | `mode` | par o lockin; modo en el que se creó el match. | M | R3; plazo D04 pendiente |
| `created_at` | `createdAt` | Fecha del match. | M | R3; plazo D04 pendiente |
| `last_message_at` | `lastMessageAt` | Fecha del último mensaje; null si no hay mensajes. | M | R3; plazo D04 pendiente |

### `public.messages` → `Message`

Almacén: Supabase Postgres, tabla `public.messages`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID del mensaje. | M | R3; plazo D04 pendiente |
| `match_id` | `matchId` | UUID de la conversación/match. | M | R3; plazo D04 pendiente |
| `sender_id` | `senderId` | UUID de quien envía. | M | R3; plazo D04 pendiente |
| `body` | `body` | Texto del mensaje (1–4000 caracteres, no solo espacios). | M | R3; plazo D04 pendiente |
| `sent_at` | `sentAt` | Fecha de envío. | M | R3; plazo D04 pendiente |

### `public.lockin_sessions` → `LockInSession`

Almacén: Supabase Postgres, tabla `public.lockin_sessions`. Fuente: [20260913000100_lockin_sessions.sql](../../supabase/migrations/20260913000100_lockin_sessions.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID de sesión de trabajo. | M | R3; plazo D04 pendiente |
| `match_id` | `matchId` | UUID del match al que pertenece. | M | R3; plazo D04 pendiente |
| `proposed_by` | `proposedBy` | UUID de quien propone. | M | R3; plazo D04 pendiente |
| `starts_at` | `startsAt` | Fecha y hora acordadas de inicio. | M | R3; plazo D04 pendiente |
| `blocks` | `blocks` | 1, 2 o 4 bloques de 25 minutos de trabajo + 5 de descanso. | M | R3; plazo D04 pendiente |
| `status` | `status` | propuesta, aceptada, rechazada o cancelada. | M | R3; plazo D04 pendiente |
| `created_at` | `createdAt` | Fecha de creación. | M | R3; plazo D04 pendiente |
| `responded_at` | `respondedAt` | Fecha de respuesta/cancelación; null mientras es propuesta. | M | R3; plazo D04 pendiente |

### `public.session_attendance` → `SessionAttendance`

Almacén: Supabase Postgres, tabla `public.session_attendance`. Fuente: [20260913000100_lockin_sessions.sql](../../supabase/migrations/20260913000100_lockin_sessions.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `session_id` | `sessionId` | UUID de la sesión. | M | R3; plazo D04 pendiente |
| `profile_id` | `profileId` | UUID de quien entra. | M | R3; plazo D04 pendiente |
| `joined_at` | `joinedAt` | Fecha de primera entrada. | M | R3; plazo D04 pendiente |
| `left_at` | `leftAt` | Salida explícita, o null. Null no distingue quedarse hasta el final de cerrar la app; volver a entrar lo restablece a null. | M | R3; plazo D04 pendiente |

### `public.session_ratings` → `SessionRatingEntry`

Almacén: Supabase Postgres, tabla `public.session_ratings`. Fuente: [20260915000100_session_ratings.sql](../../supabase/migrations/20260915000100_session_ratings.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `session_id` | `sessionId` | UUID de la sesión valorada. | U | R3; plazo D04 pendiente |
| `profile_id` | `profileId` | UUID de quien valora. | U | R3; plazo D04 pendiente |
| `rating` | `rating` | floja, bien o genial; una valoración inmutable por persona y sesión. | U | R3; plazo D04 pendiente |
| `rated_at` | `ratedAt` | Fecha de valoración. La ventana de 24 horas permite escribir; no elimina el dato después. | U | R3; plazo D04 pendiente |

### `public.agreement_answers` → `AgreementAnswer / AgreementTopicView`

Almacén: Supabase Postgres, tabla `public.agreement_answers`. Fuente: [20260924000200_agreement_answers.sql](../../supabase/migrations/20260924000200_agreement_answers.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `match_id` | `AgreementAnswerInput.matchId` | UUID del match Par. | A | R3; plazo D04 pendiente |
| `profile_id` | `autor implícito` | UUID de quien responde. | A | R3; plazo D04 pendiente |
| `topic` | `topic` | Clave del tema: dedicacion, horizonte, dinero-propio, participacion, consolidacion, decisiones, si-uno-se-va o lo-creado. | A | R3; plazo D04 pendiente |
| `option` | `option` | Clave de la opción elegida; incluye sin-decidir. Son preferencias para conversar, no pagos ni contratos. | A | R3; plazo D04 pendiente |
| `note` | `note` | Nota libre opcional (1–280 caracteres) o null. | A | R3; plazo D04 pendiente |
| `updated_at` | `updatedAt` | Fecha de última respuesta/edición. | A | R3; plazo D04 pendiente |

### `public.lockin_rooms` → `LockInRoom`

Almacén: Supabase Postgres, tabla `public.lockin_rooms`. Fuente: [20261002000100_lockin_rooms.sql](../../supabase/migrations/20261002000100_lockin_rooms.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID de sala grupal. | S | R4; plazo D04 pendiente |
| `host_id` | `hostId` | UUID de quien convoca. | S | R4; plazo D04 pendiente |
| `starts_at` | `startsAt` | Fecha y hora de inicio. | S | R4; plazo D04 pendiente |
| `blocks` | `blocks` | 1, 2 o 4 bloques 25+5. | S | R4; plazo D04 pendiente |
| `cancelled_at` | `cancelledAt` | Fecha de cancelación o null. | S | R4; plazo D04 pendiente |
| `created_at` | `createdAt` | Fecha de creación. | S | R4; plazo D04 pendiente |
| `updated_at` | — | Fecha de invalidación; cambia cuando se modifica un miembro, aunque no figure en LockInRoom. | S | R4; plazo D04 pendiente |

### `public.room_members` → `RoomMember`

Almacén: Supabase Postgres, tabla `public.room_members`. Fuente: [20261002000100_lockin_rooms.sql](../../supabase/migrations/20261002000100_lockin_rooms.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `room_id` | `roomId` | UUID de la sala. | SM | R5; plazo D04 pendiente |
| `profile_id` | `profileId` | UUID de la persona invitada o de quien convoca. | SM | R5; plazo D04 pendiente |
| `status` | `status` | invitada, aceptada o rechazada; quien convoca nace aceptada. | SM | R5; plazo D04 pendiente |
| `responded_at` | `respondedAt` | Fecha de respuesta o null mientras sigue invitada. | SM | R5; plazo D04 pendiente |
| `joined_at` | `joinedAt` | Fecha de primera entrada o null. | SM | R5; plazo D04 pendiente |
| `left_at` | `leftAt` | Fecha de salida explícita o null; misma cautela que session_attendance. | SM | R5; plazo D04 pendiente |

## Identidad y credenciales

Fuente: [auth.ts](../../src/data/supabase/auth.ts) y [client.ts](../../src/data/supabase/client.ts). Esquema Auth gestionado por Supabase; sus tablas internas no se crean con las migraciones de LockIn. Esta lista cubre datos que usa la app; no es un volcado de todas las columnas internas del proveedor.

| Dato | Dónde | Quién lo ve / finalidad | Retención actual |
| --- | --- | --- | --- |
| UUID de usuario | Supabase Auth; se usa como profiles.id | Titular, servidor y usuarios que leen el perfil; vincula toda la actividad a una cuenta | Sin plazo fijado; D04 pendiente |
| Tipo de cuenta, is_anonymous, confirmación de email | Supabase Auth; AccountState se deriva al consultar | Titular y Auth; decide recuperación y acceso a acciones de cuenta | Sin plazo fijado; D04 pendiente |
| Email real y email pendiente de confirmar | Supabase Auth (email / new_email) | Titular, Auth y servicio de envío de correo; no se guardan como contacto público en profiles | Opcional en el flujo sin email; necesario para alta/recuperación por email. Plazo D04 pendiente |
| Contraseña que introduce el usuario | Se envía a Supabase Auth para alta, cambio o acceso; la app la maneja temporalmente en el formulario | Auth y titular; no hay columna de contraseña en public ni persistencia deliberada de la contraseña real en AsyncStorage | Tratamiento y conservación del verificador por el proveedor; D04/D05 pendientes |
| Email sintético y contraseña aleatoria del respaldo de dispositivo | Supabase Auth y AsyncStorage, clave lockin.supabase.device-account | App y Auth; alternativa si falla/no está habilitado el acceso anónimo | Se olvida la copia local al salir o al completar vinculación de email recuperable; no se elimina la cuenta servidor |
| Identidad OAuth de GitHub, datos devueltos por el proveedor | Supabase Auth, auth.identities; user_name origina el sello público | Titular y servicios de autenticación; handle y fecha publicados en profiles | La identidad se puede desvincular; sync_github_verification elimina handle, fecha y link_github. Sin plazo general |
| Sesión Auth, access token, refresh token y datos de usuario del SDK | Supabase Auth y AsyncStorage de la app; PKCE también usa almacenamiento del SDK | App/Auth; mantiene la sesión entre reinicios | El SDK renueva/limpia la sesión; cierre de sesión no borra filas de producto |

**[PENDIENTE DE DECISIÓN] D05:** confirmar proveedor SMTP, datos y scopes reales recibidos de GitHub, configuración de Auth, región del proyecto, encargados, subencargados y transferencias internacionales. No afirmar que solo se recibe el handle: Auth puede conservar más metadatos del OAuth.

**Borrado comprobado en código:** signOut solo llama a auth.signOut() y removeItem(DEVICE_ACCOUNT_KEY). La pantalla [account-section.tsx](../../src/features/profile/account-section.tsx) usa «Borrarlo todo y cerrar sesión», pero no llama a deleteUser, a una función de baja ni a DELETE de datos de producto. Perder acceso a una cuenta irrecuperable no prueba que sus datos desaparezcan del servidor.

## Datos locales adicionales

| Campo / clave | Dónde | Quién lo ve | Retención efectiva |
| --- | --- | --- | --- |
| lockin.supabase.github-link-attempt: startedAt | AsyncStorage | App; retoma OAuth si Android cierra el proceso | Se quita al finalizar/cancelar; si se consulta caducado, se elimina. Vigencia lógica de 10 minutos, no purga automática al minuto 10 |
| lockin.supabase.github-link-consumed: code | AsyncStorage | App; identifica un código OAuth ya canjeado | Se sustituye por el siguiente; no consta TTL ni limpieza al salir |
| lockin:reminder:<sessionId>: notificationId | AsyncStorage | App; correlaciona sesión y aviso local | Se cancela y elimina al reconciliar una sesión que ya no se desea; no hay plazo independiente |
| lockin:room-reminder:<roomId>: notificationId | AsyncStorage | App; correlaciona sala y aviso | Igual que sesiones, con reconciliación de salas |
| lockin:reminder-hint-dismissed: 1 | AsyncStorage | App; recuerda que se cerró el aviso de permiso | Sin caducidad en código |
| Hora, título y cuerpo del recordatorio | Programador de notificaciones del sistema operativo | Titular y quien vea sus notificaciones/pantalla bloqueada según sus ajustes | Hasta ejecución/cancelación y conservación por el sistema; no plazo controlado por LockIn |
| Nombre del compañero en «Con {nombre}. Entra desde el chat.» | Cuerpo del aviso local de sesión | Visible en notificaciones según ajustes del dispositivo | Igual que el aviso. El de sala solo dice «Entra desde Matches.» |
| Perfil, matches y respuestas cargadas | Memoria/caché del proceso de la app | Titular según RLS | Vida del proceso o invalidación; no se ha encontrado copia persistente completa de producto en AsyncStorage |

Fuentes: [recordatorios de sesiones](../../src/features/session/reminders.ts), [recordatorios de salas](../../src/features/room/room-reminders.ts), [permiso y aviso](../../src/features/session/reminder-permission.ts) y [puerto de notificaciones](../../src/features/session/notifications-port.ts). La sesión Auth persistida por el SDK puede contener metadatos de usuario; no confundirla con una copia completa del perfil de producto. AsyncStorage no aporta el cifrado de un almacén de credenciales seguro.

## Tráfico temporal, proveedores y actualizaciones

| Campo / dato | Dónde circula o se guarda | Quién lo recibe | Conservación constatada |
| --- | --- | --- | --- |
| Presencia: profileId y UUID de sesión/sala en el topic | Supabase Realtime Presence; topics lockin:presence:<id> y lockin:room:<id> | Miembros autorizados del match; en salas solo quienes aceptaron | Sin tabla de producto; untrack/removeChannel al salir. D04/D05 para registros del proveedor |
| Señalización: kind, from, payload; SDP type/sdp; ICE candidate/sdpMid/sdpMLineIndex | Supabase Realtime Broadcast, topic privado lockin:video:<sessionId> | Las dos personas del match y servicio de señalización | No se almacena en una tabla de producto ni se ofrece historial. Registros operativos D04/D05 pendientes |
| Direcciones de red/IP y puertos en SDP/ICE | Memoria del cliente y señalización WebRTC | Otra persona y servicio de señalización, según candidato | Tiempo de negociación/conexión en la app; conservación del proveedor sin determinar |
| Imagen de cámara y voz del micrófono | Flujo WebRTC directo 1:1 entre dispositivos | La otra persona de la sesión | Sin grabación, archivo ni subida a Storage implementados; el código libera tracks al cerrar. No impide que el receptor grabe por otros medios |
| IP y datos de negociación STUN | stun.l.google.com:19302 | Servicio STUN público de Google | No hay retención de este servicio definida en el repo; D04/D05 pendientes. El STUN configurado no usa TLS |
| IP y metadatos de peticiones Auth, API, Realtime y actualizaciones | Infraestructura Supabase, Expo/EAS y servicios de red | Proveedores y operadores autorizados | El cliente no crea una tabla IP; logs del proveedor pueden conservarla. D04/D05 pendientes |
| EAS-Client-ID (UUID aleatorio persistente) | SharedPreferences Android / UserDefaults iOS; cabecera de expo-updates hacia Expo/EAS | Servicio de actualizaciones | Persiste entre arranques; no es ID publicitario ni prueba de anonimato. Plazo servidor D04 pendiente |
| Expo-Platform, Expo-Runtime-Version y metadatos de protocolo | Peticiones de expo-updates a u.expo.dev y activos | Expo/EAS | Versiones de plataforma/runtime; sin política de plazo en el repo |
| Expo-Current-Update-ID, Expo-Embedded-Update-ID y Expo-Recent-Failed-Update-IDs | Estado local del SDK y cabeceras de actualización cuando corresponda | Expo/EAS | IDs de actualización en uso/incluida y fallos de arranque; no son UUID de cuenta. D04 pendiente |
| Estado, manifiestos y archivos de actualizaciones descargadas | Caché/base local de expo-updates | App y SDK; proveedores sirven los archivos | Gestionado por el SDK; no plazo definido por LockIn |

Fuentes: [presencia](../../src/data/supabase/presence.ts), [señalización](../../src/data/supabase/video-signal.ts), [tipos de señalización](../../src/data/video-signal.ts), [videollamada](../../src/features/session/use-video-call.ts), app.json y las dependencias bloqueadas en [package-lock.json](../../package-lock.json). Se inspeccionó además el código instalado de expo-updates 57.0.22 y expo-eas-client: FileDownloader.kt/Swift envían EAS-Client-ID y metadatos; EASClientID.kt/Swift generan y persisten el UUID. No se modificaron dependencias.

El permiso de cámara/micrófono y que el vídeo sea temporal no bastan para responder el formulario de las tiendas. Apple y Google aplican definiciones distintas; véase [cuestionario-privacidad.md](cuestionario-privacidad.md).

## Permisos y datos que no se han encontrado

| Permiso / capacidad | Configuración y uso real | Datos relacionados |
| --- | --- | --- |
| Cámara | android.permission.CAMERA; plugin @config-plugins/react-native-webrtc con texto de permiso iOS | Vídeo de la llamada 1:1; no foto de avatar ni escáner de identidad |
| Micrófono | android.permission.RECORD_AUDIO; mismo plugin con texto de permiso iOS | Audio de llamada; no mensajes de voz ni grabaciones persistentes |
| Notificaciones | Plugin expo-notifications; solicitud al programar avisos | Recordatorios locales 5 minutos antes; no llamadas a getExpoPushTokenAsync/getDevicePushTokenAsync encontradas |
| Alarmas exactas | android.permission.SCHEDULE_EXACT_ALARM en app.json | Disparar recordatorios por fecha; no lectura del calendario |
| Localización/contactos/fotos | No se declaran permisos de localización, agenda o biblioteca de fotos en app.json | Ciudad y zona horaria escritas por el usuario; grafo de matches propio, sin importar la agenda |
| Seguimiento/publicidad | No se ha encontrado SDK publicitario, ATT, IDFA, Advertising ID ni analítica comercial en src/package.json | Eso no excluye identificadores y registros técnicos de Expo/Supabase |

La manifestación final de permisos puede añadir los de las dependencias nativas, por ejemplo POST_NOTIFICATIONS. **[PENDIENTE DE DECISIÓN] D09:** verificar el binario de publicación, SDKs, permisos efectivos, configuración de servicios, cifrado de todos los flujos y clasificación definitiva de metadatos técnicos.

No hay Storage de avatares, cobros, historial de compras, documentos de identidad ni datos biométricos implementados. El acuerdo pregunta por disposición a aportar dinero y reparto futuro, sin pedir cuentas bancarias, salario ni importes reales; revisar si el formulario clasifica esas preferencias como información financiera adicional (D09). Los campos libres pueden contener lo que escriba el usuario.

## Datos derivados, que no son columnas nuevas

- Session.profileId y activeMode se reconstruyen de Auth, profiles y user_settings; no son la tabla de sesiones de trabajo.
- MatchWithProfile.counterpart y lastMessage se obtienen de profiles/messages.
- El estado en curso/terminada/caducada y las fases Pomodoro se calculan de starts_at, blocks y reloj.
- MatchStreak.count y aliveUntil se calculan de sesiones/asistencia. Solo los ve la pareja; no usan session_ratings, no son una nota pública y no se guardan en una tabla de rachas.
- AgreementTopicView.theirs puede ser hidden; el ciego se impone en match_agreement.
- RoomView agrega sala, fila propia y miembros permitidos. Las salas son de 3–5 personas, sin vídeo ni chat grupal y no generan rachas o valoraciones.

Fuentes de acceso: [RLS de perfiles y chat](../../supabase/migrations/20260905000400_rls_policies.sql), migraciones de sesiones/valoraciones/acuerdo/salas, [autorización Realtime](../../supabase/migrations/20260917000100_realtime_authorization.sql) y [endurecimiento de permisos](../../supabase/migrations/20261003000100_harden_grants_and_clock.sql). La configuración de producción de Realtime debe cerrar el acceso público además de aplicar estas migraciones (D09).

## Decisiones pendientes compartidas por los cinco documentos

| ID | Marca y decisión |
| --- | --- |
| D01 | [PENDIENTE DE DECISIÓN] Identidad del responsable/editor: razón social o nombre legal y domicilio. owner de Expo no identifica por sí solo al responsable legal. |
| D02 | [PENDIENTE DE DECISIÓN] Correo operativo de privacidad y soporte; canal para ejercer derechos. |
| D03 | [PENDIENTE DE DECISIÓN] Jurisdicción y mercados, bases jurídicas por finalidad, derechos aplicables y autoridad de control. |
| D04 | [PENDIENTE DE DECISIÓN] Plazos de conservación por dato, inactividad, cuentas sin acceso, bajas, logs, backups y excepciones legales. |
| D05 | [PENDIENTE DE DECISIÓN] Proveedores/configuración de producción: región, contratos, subencargados, transferencias, correo, OAuth y tratamiento de Expo/STUN. |
| D06 | [PENDIENTE DE DECISIÓN] Política de menores, público objetivo, edad mínima de uso y clasificación final Apple/IARC por territorio. El código admite 16 años; no decide un lanzamiento solo para mayores de 18. |
| D07 | [PENDIENTE DE DECISIÓN] Categorías definitivas de las tiendas. Se proponen Redes sociales / Social. |
| D08 | [PENDIENTE DE DECISIÓN] URLs públicas de privacidad, soporte, solicitud de eliminación de cuenta y normas de comunidad/seguridad infantil. |
| D09 | [PENDIENTE DE DECISIÓN] Validación de versión de publicación: permisos/SDKs, despliegue/RLS/Realtime, cifrado, retención de proveedores y tipos técnicos/financieros que deben declararse. |
| D10 | [PENDIENTE DE DECISIÓN] Aplicación de excepciones de «compartidos» en Google según contratos y transparencia/acción del usuario; no equivalen a «nadie recibe los datos». |
| D11 | [PENDIENTE DE DECISIÓN] Normas y operación de moderación/seguridad infantil: términos, responsable, contacto designado, revisión de reportes y plazos de respuesta. Bloquear/reportar aún requieren implementación. |
| D12 | [PENDIENTE DE DECISIÓN] Fecha de entrada en vigor de la política y procedimiento para comunicar cambios. |
