# cofounder — inventario de datos recopilados

Revisado el 14 de octubre de 2026 sobre el inventario del 9-oct (commit `0cddbbb…`), tras el pivote del 12-oct-2026 (solo cofundador) y la foto de perfil del 12-oct. Describe lo que recoge la UI actual. No certifica la configuración de producción.

## Cambios respecto a la versión anterior

- Añadida la **foto de perfil**: buckets `avatar-uploads` (privado) y `avatars` (público tras moderación), columna `profiles.avatar_url`, envío a **OpenAI** (Edge Function `moderate-avatar`, falla cerrado) y permisos de galería/cámara de `expo-image-picker` (la versión anterior decía que no había permiso de fotos).
- Añadidas las tablas de **bloqueo y reporte** (migraciones `20261009224000` y `20261009231000`, aplicadas en producción el 10-oct según D09; D11 decía «pendientes de aplicar»: contradicción resuelta a favor de D09, **confirmar**).
- Corregido: la baja de cuenta **existe** (Perfil > Cuenta > Eliminar mi cuenta, D09). El texto anterior («no hay flujo de baja», «Borrarlo todo» sin efecto) estaba desactualizado.
- Movidas a «inactivas» las tablas y flujos de Lock-In: `lockin_sessions`, `session_attendance`, `session_ratings`, `agreement_answers`, `lockin_rooms`, `room_members`, presencia, señalización WebRTC, vídeo/audio, STUN de Google y recordatorios locales.

## Retención

Datos de producto hasta la baja, que los borra de inmediato; cuentas con 24 meses sin acceso pueden eliminarse (sin proceso automático); backups hasta 30 días; registros de proveedores máx. 90 días; reportes máx. 12 meses con purga automática (D04).

| Código | Comportamiento |
| --- | --- |
| R1 | Perfil persistente; editar sustituye valores. Se borra con la baja de cuenta (cascada desde auth.users). |
| R2 | Preferencias persistentes; se borran con la cuenta Auth. |
| R3 | Persistente sin TTL; se borra por cascada al borrar el perfil o el match. Sin borrado individual de mensajes en la UI. |

Visibilidad: **P** = cualquier cuenta autenticada (también anónima); **U** = solo el autor; **M** = las dos personas del match.

## Campos persistentes activos

### `public.profiles` → `Profile`

Almacén: Supabase Postgres, tabla `public.profiles`. Fuente: [20260905000200_profiles_and_settings.sql](../../supabase/migrations/20260905000200_profiles_and_settings.sql).

Columnas añadidas: [especialidades buscadas](../../supabase/migrations/20260907000100_profiles_seeking_specialties.sql) y [sello GitHub](../../supabase/migrations/20260916000100_github_verification.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID de cuenta; coincide con auth.users.id. | P | R1 |
| `name` | `name` | Nombre declarado (hasta 80 caracteres). | P | R1 |
| `age` | `age` | Edad entera declarada; SQL 16–120, formulario 16–99. | P | R1 |
| `location` | `location` | Ciudad o zona en texto libre; no coordenadas ni GPS. | P | R1 |
| `timezone` | `timezone` | Zona horaria IANA declarada. | P | R1 |
| `avatar_initials` | `avatar.initials` | Una o dos iniciales; se pueden derivar del nombre. | P | R1 |
| `avatar_accent` | `avatar.accent` | Color brass o teal. | P | R1 |
| `avatar_url` | `avatar.url` | URL pública de la foto aprobada (bucket `avatars`), o null. | P | R1; se borra con la cuenta |
| `specialties` | `specialties` | Especialidades que declara dominar; 1–10 etiquetas. | P | R1 |
| `looking_for` | `lookingFor` | par, lockin o ambos. Tras el pivote, **pregunta**: ¿se sigue pidiendo o se fija a «par»? | P | R1 |
| `starting_point` | `startingPoint` | solo-ganas, idea-sin-empezar o algo-empezado. | P | R1 |
| `availability_hours_per_week` | `availability.hoursPerWeek` | Horas disponibles por semana (1–168). | P | R1 |
| `availability_bands` | `availability.bands` | Franjas madrugada, manana, tarde o noche (1–4). | P | R1 |
| `ambition` | `ambition` | lifestyle, equilibrado o todo-o-nada. | P | R1 |
| `link_github` | `links.github` | Enlace opcional; con sello se deriva de la identidad de GitHub. | P | R1 |
| `link_portfolio` | `links.portfolio` | Enlace opcional al portfolio. | P | R1 |
| `link_linkedin` | `links.linkedin` | Enlace opcional a LinkedIn; sin verificación OAuth de LinkedIn. | P | R1 |
| `prompts` | `prompts` | JSON con 0–2 objetos; la UI exige al menos una respuesta. Cada objeto guarda question y answer. | P | R1 |
| `created_at` | `createdAt` | Fecha de creación del perfil. | P | R1 |
| `updated_at` | `updatedAt` | Fecha de última actualización del perfil. | P | R1 |
| `seeking_specialties` | `seekingSpecialties` | Especialidades buscadas (0–10); vacío significa abierto a cualquiera. | P | R1 |
| `github_handle` | `githubVerification.handle` | Nombre de cuenta de GitHub obtenido del OAuth, o null. | P | R1 |
| `github_verified_at` | `githubVerification.verifiedAt` | Fecha del sello de autoría del enlace, o null. | P | R1 |

### `public.user_settings` → `Session`

Almacén: Supabase Postgres, tabla `public.user_settings`. Fuente: [20260905000200_profiles_and_settings.sql](../../supabase/migrations/20260905000200_profiles_and_settings.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `user_id` | `profileId (derivado)` | UUID de cuenta. profileId es null si todavía no hay perfil. | U | R2 |
| `active_mode` | `activeMode` | Modo activo; null antes de elegirlo. | U | R2 |
| `created_at` | — | Fecha de creación de las preferencias. | U | R2 |
| `updated_at` | — | Fecha de última actualización de las preferencias. | U | R2 |

### `public.decisions` → `Decision / DecisionResult`

Almacén: Supabase Postgres, tabla `public.decisions`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `actor_id` | `usuario actual` | UUID de quien hace el swipe. | U | R3 |
| `target_id` | `perfil objetivo` | UUID del perfil sobre el que decide. | U | R3 |
| `decision` | `decision` | like o pass. | U | R3 |
| `created_at` | — | Fecha del swipe. | U | R3 |

### `public.matches` → `Match`

Almacén: Supabase Postgres, tabla `public.matches`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID del match. | M | R3 |
| `profile_a` | `profileIds` | UUID de uno de los dos perfiles; par ordenado en SQL. | M | R3 |
| `profile_b` | `profileIds` | UUID del otro perfil. | M | R3 |
| `mode` | `mode` | par o lockin; modo en el que se creó el match. | M | R3 |
| `created_at` | `createdAt` | Fecha del match. | M | R3 |
| `last_message_at` | `lastMessageAt` | Fecha del último mensaje; null si no hay mensajes. | M | R3 |

### `public.messages` → `Message`

Almacén: Supabase Postgres, tabla `public.messages`. Fuente: [20260905000300_decisions_matches_messages.sql](../../supabase/migrations/20260905000300_decisions_matches_messages.sql).

| Campo SQL | Campo de dominio | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- | --- |
| `id` | `id` | UUID del mensaje. | M | R3 |
| `match_id` | `matchId` | UUID de la conversación/match. | M | R3 |
| `sender_id` | `senderId` | UUID de quien envía. | M | R3 |
| `body` | `body` | Texto del mensaje (1–4000 caracteres, no solo espacios). | M | R3 |
| `sent_at` | `sentAt` | Fecha de envío. | M | R3 |

### Bloqueos y reportes

Tablas creadas por las migraciones `20261009224000` y `20261009231000`. **Columnas no documentadas en este paquete**: completar desde las migraciones (previsiblemente quién bloquea/reporta, a quién, motivo/texto y fecha). Visibilidad prevista: autor y moderación. Retención: bloqueos hasta la baja; reportes 12 meses (`purge_old_user_reports()`, pg_cron).

### Foto de perfil (Supabase Storage)

| Almacén | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- |
| `avatar-uploads` (privado) | Imagen original subida | Titular, Edge Function y operador | **Pregunta:** ¿se borra tras moderar? ¿y si se rechaza? |
| OpenAI (moderación) | Imagen enviada para clasificarla | OpenAI como proveedor | **Pregunta:** retención y uso según las condiciones de la API; ¿DPA? |
| `avatars` (público) | Imagen aprobada | Cualquier persona con la URL (bucket público: no solo cuentas autenticadas) | Hasta que se quita o se borra la cuenta |

Nota: un bucket público significa que la foto aprobada es accesible para quien tenga la URL, incluso fuera de la app. Reflejarlo en la política o hacer el bucket privado con URLs firmadas (pregunta abierta).

## Identidad y credenciales

## Identidad y credenciales

Fuente: [auth.ts](../../src/data/supabase/auth.ts) y [client.ts](../../src/data/supabase/client.ts). Esquema Auth gestionado por Supabase; sus tablas internas no se crean con las migraciones de cofounder. Esta lista cubre datos que usa la app; no es un volcado de todas las columnas internas del proveedor.

| Dato | Dónde | Quién lo ve / finalidad | Retención actual |
| --- | --- | --- | --- |
| UUID de usuario | Supabase Auth; se usa como profiles.id | Titular, servidor y usuarios que leen el perfil; vincula toda la actividad a una cuenta | Hasta la baja |
| Tipo de cuenta, is_anonymous, confirmación de email | Supabase Auth; AccountState se deriva al consultar | Titular y Auth; decide recuperación y acceso a acciones de cuenta | Hasta la baja |
| Email real y email pendiente de confirmar | Supabase Auth (email / new_email) | Titular, Auth y servicio de envío de correo; no se guardan como contacto público en profiles | Opcional en el flujo sin email; necesario para alta/recuperación por email. Hasta la baja |
| Contraseña que introduce el usuario | Se envía a Supabase Auth para alta, cambio o acceso; la app la maneja temporalmente en el formulario | Auth y titular; no hay columna de contraseña en public ni persistencia deliberada de la contraseña real en AsyncStorage | Tratamiento y conservación del verificador por el proveedor; D04/D05 pendientes |
| Email sintético y contraseña aleatoria del respaldo de dispositivo | Supabase Auth y AsyncStorage, clave lockin.supabase.device-account | App y Auth; alternativa si falla/no está habilitado el acceso anónimo | Se olvida la copia local al salir o al completar vinculación de email recuperable; no se elimina la cuenta servidor |
| Identidad OAuth de GitHub, datos devueltos por el proveedor | Supabase Auth, auth.identities; user_name origina el sello público | Titular y servicios de autenticación; handle y fecha publicados en profiles | La identidad se puede desvincular; sync_github_verification elimina handle, fecha y link_github. Sin plazo general |
| Sesión Auth, access token, refresh token y datos de usuario del SDK | Supabase Auth y AsyncStorage de la app; PKCE también usa almacenamiento del SDK | App/Auth; mantiene la sesión entre reinicios | El SDK renueva/limpia la sesión; cierre de sesión no borra filas de producto |

Decisión D05: SMTP propio gratuito antes del lanzamiento; Supabase en `eu-central-1`. Auth puede conservar más metadatos del OAuth que el handle, y así se declara en la política.


## Datos locales y técnicos activos

- AsyncStorage: sesión Auth, `lockin.supabase.device-account`, claves temporales de vinculación GitHub. Sin cifrado de almacén seguro (aunque `expo-secure-store` está en app.json: **pregunta**, ¿qué guarda?).
- Expo/EAS: EAS-Client-ID, plataforma, runtime, IDs de actualización actual/incluida/fallida; IP en peticiones.
- Supabase y OpenAI: IP y metadatos de peticiones en sus registros.

## Permisos (app.json)

| Permiso | Uso visible actual | Acción |
| --- | --- | --- |
| Galería (iOS `photosPermission`) | Elegir foto de perfil | Mantener |
| Cámara (`CAMERA`, image-picker) | Hacer la foto de perfil | Mantener; quitar el texto duplicado de WebRTC |
| Micrófono (`RECORD_AUDIO`, WebRTC) | Ninguno (vídeo oculto) | **Retirar** |
| `SCHEDULE_EXACT_ALARM` | Ninguno (recordatorios de sesiones ocultos) | **Retirar** |
| Notificaciones (`expo-notifications`) | **Pregunta:** ¿se usa para algo visible? | Retirar si no |

## Tablas y flujos inactivos (Lock-In, ocultos desde el 12-oct-2026)

`user_settings.active_mode` (pregunta: ¿sigue escribiéndose?), `lockin_sessions`, `session_attendance`, `session_ratings`, `agreement_answers`, `lockin_rooms`, `room_members`, presencia y señalización Realtime, vídeo/audio WebRTC, STUN de Google y recordatorios locales. El detalle columna a columna está en la versión anterior de este documento. Si la UI no los alcanza y no recogen datos, no se declaran. Si hay datos de pruebas, borrarlos o mantener la mención en la política.

## Decisiones (D01–D12)

Siguen vigentes las del documento original, con estos ajustes: **D05** añade OpenAI (moderación de fotos, posible transferencia a EE. UU.); **D07** la categoría secundaria Productividad pierde su justificación; **D09** retirar declaración de SCHEDULE_EXACT_ALARM y permisos de vídeo; **D10** decidir si OpenAI es proveedor de servicios; **D11** corregir «pendientes de aplicar».
