# cofounder — inventario de datos recopilados

Actualizado el 15 de octubre de 2026 tras T5 (binario sin Lock-In). Revisado el 14 de octubre de 2026 sobre el inventario del 9-oct (commit `0cddbbb…`), tras el pivote del 12-oct-2026 (solo cofundador) y la foto de perfil del 12-oct. Describe lo que recoge la UI actual. No certifica la configuración de producción.

## Cambios respecto a la versión anterior

- Añadida la **foto de perfil**: buckets `avatar-uploads` (privado) y `avatars` (privado; se sirve con URL firmada tras moderación), columna `profiles.avatar_url`, envío a **OpenAI** (Edge Function `moderate-avatar`, falla cerrado) y permisos de galería/cámara de `expo-image-picker` (la versión anterior decía que no había permiso de fotos).
- Añadidas las tablas de **bloqueo y reporte** (migraciones `20261009224000`, `20261009231000` y `20261010120000`; D09 las da por aplicadas en producción el 10-oct y D11 decía «pendientes de aplicar»: resuelto a favor de D09, **confirmar contra producción**). Columnas completadas desde las migraciones.
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
| `avatar_url` | `avatar.url` | Ruta del objeto de la foto aprobada en el bucket privado `avatars` (`<uid>/<uuid>.jpg`; no es una URL), o null. | P | R1; se borra con la cuenta |
| `specialties` | `specialties` | Especialidades que declara dominar; 1–10 etiquetas. | P | R1 |
| `looking_for` | `lookingFor` | par, lockin o ambos. Sigue existiendo y escribiéndose desde el formulario de perfil (comprobado en `src/data/supabase/mappers.ts`). | P | R1 |
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
| `active_mode` | `activeMode` | Modo activo; null antes de elegirlo. Sigue escribiéndose (`src/data/supabase/index.ts`). | U | R2 |
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

Fuente: [20261009224000_block_report.sql](../../supabase/migrations/20261009224000_block_report.sql) y [20261010120000_reports_retention_and_block_followups.sql](../../supabase/migrations/20261010120000_reports_retention_and_block_followups.sql). Ninguna tabla se publica en Realtime y ninguna admite escritura directa del cliente: se escribe con las funciones `block_profile()` y `report_profile()`.

`public.user_blocks`: `blocker_id`, `blocked_id`, `created_at`. Visibilidad: quien bloquea ve sus propias filas (política SELECT); el bloqueo funciona en las dos direcciones. Retención: se borra en cascada con cualquiera de las dos cuentas.

`public.user_reports`: `id`, `reporter_id` y `reported_id` (anulables, `on delete set null`), `reporter_ref` y `reported_ref` (UUID copiado como texto), `reason` (acoso, contenido-inapropiado, spam, suplantacion, otro), `details` (texto opcional, hasta 500 caracteres) y `created_at`. Visibilidad: ninguna persona de la app (sin política SELECT); solo el operador con acceso administrativo. Retención: 12 meses desde `created_at` (`purge_old_user_reports()`, programada con pg_cron si la extensión existe: **confirmar en producción**); sobrevive a la baja de cualquiera de las dos cuentas hasta ese plazo.

### Foto de perfil (Supabase Storage)

| Almacén | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- |
| `avatar-uploads` (privado, solo JPEG, 5 MB) | Imagen original subida | Titular (solo insertar y borrar en su carpeta), Edge Function y operador | Comportamiento actual de `moderate-avatar`: tras cada petición `set`, aprobada, rechazada o con error, intenta borrar el archivo pendiente; `remove` borra también lo que haya pendiente de la persona. Barrido horario `purge_stale_avatar_uploads()` (pg_cron) de lo que supere 24 h; `delete_my_account()` borra además los objetos de la persona. Aplicado en producción el 16-oct-2026 |
| OpenAI (moderación, `omni-moderation-latest`) | Imagen enviada (data URL base64) para clasificarla; solo la imagen | OpenAI como encargado | **Pregunta abierta:** retención y uso según las condiciones aplicables a la cuenta; ¿DPA? No se declara nada sobre entrenamiento hasta confirmarlo. Transferencia fuera del EEE: CCT/DPF |
| `avatars` (privado) | Imagen aprobada (`<uid>/<uuid>.jpg`) | Cuentas con sesión (incluidas las anónimas), mediante URL firmada de 1 h; sin acceso anónimo | Hasta que se quita o se sustituye (la anterior se retira, mejor esfuerzo) o se borra la cuenta |

Nota: desde la migración `20261016120000` (sin aplicar en producción a fecha de este texto) el bucket es privado: la foto se sirve con URLs firmadas de 1 h a cualquier cuenta con sesión que pueda ver el perfil, y solo mientras esa foto sea la publicada; una URL ya firmada sigue valiendo hasta caducar. `delete_my_account()` borra en servidor los objetos de `avatars` y `avatar-uploads` de la persona (migración `20261014140000`, aplicada el 16-oct-2026); el cliente sigue llamando antes a `deleteAvatar`, que además retira los bytes por la Storage API. Límite: borrar por SQL elimina el objeto para la API (deja de poder firmarse y servirse), pero Supabase documenta que los bytes del backend S3 no se retiran con SQL.

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

Decisión D05: SMTP propio gratuito antes del lanzamiento — Brevo (plan gratuito, 300 correos/día; decidido el 16-oct-2026), remitente cofounder.soporte@gmail.com; Supabase en `eu-central-1`. Auth puede conservar más metadatos del OAuth que el handle, y así se declara en la política.


## Datos locales y técnicos activos

- `expo-secure-store` (Keystore / Keychain): sesión Auth y `lockin.supabase.device-account` (`src/data/supabase/secure-storage.ts`). Si el almacén seguro no admite la escritura, cae a AsyncStorage. En web, solo AsyncStorage (localStorage).
- AsyncStorage: claves temporales de vinculación GitHub y, en el caso descrito, la copia de reserva de la sesión.
- Expo/EAS: EAS-Client-ID, plataforma, runtime, IDs de actualización actual/incluida/fallida; IP en peticiones.
- Supabase y OpenAI: IP y metadatos de peticiones en sus registros.

## Permisos (app.json, tras T5)

| Permiso | Uso visible actual | Estado |
| --- | --- | --- |
| Galería (iOS `photosPermission`) | Elegir foto de perfil | Presente |
| Cámara (`android.permission.CAMERA`, iOS `cameraPermission`) | Hacer la foto de perfil | Presente |
| Micrófono (`RECORD_AUDIO`, `NSMicrophoneUsageDescription`) | Ninguno | **Retirado** (`microphonePermission: false` en `expo-image-picker`) |
| `SCHEDULE_EXACT_ALARM` | Ninguno | **Retirado** |
| Notificaciones (`expo-notifications`) | Ninguno | **Retirado** (no hay push ni recordatorios) |

Plugins restantes: `expo-router`, `expo-splash-screen`, `expo-image-picker`, `expo-secure-store` y el plugin local `with-new-intent-initial-url`. `ITSAppUsesNonExemptEncryption=false` en iOS. Falta contrastar con el manifiesto del AAB generado (el prebuild no se ejecutó en T5).

## Tablas y flujos inactivos (Lock-In, fuera del binario desde T5)

`lockin_sessions`, `session_attendance`, `session_ratings`, `agreement_answers`, `lockin_rooms`, `room_members`, presencia y señalización Realtime. La app publicada **no** las lee ni escribe, y WebRTC, STUN de Google y recordatorios locales no están en el binario. Siguen como tablas vacías en la base de datos de producción: las filas de prueba que había (`lockin_sessions` 4, `session_attendance` 4, `lockin_rooms` 4; lectura del 14-oct) se borraron el 16-oct-2026 a orden del usuario. El detalle columna a columna está en la versión anterior de este documento.

## Decisiones (D01–D12)

Siguen vigentes las del documento original, con estos ajustes: **D05** añade OpenAI (moderación de fotos, posible transferencia a EE. UU.); **D07** la categoría secundaria Productividad pierde su justificación; **D09** retirar declaración de SCHEDULE_EXACT_ALARM y permisos de vídeo; **D10** decidir si OpenAI es proveedor de servicios; **D11** corregir «pendientes de aplicar».
