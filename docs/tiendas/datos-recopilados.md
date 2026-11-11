# cofounder — inventario de datos recopilados

Actualizado el 9 de noviembre de 2026 con Grupos y tokens push sobre el inventario del 15 de octubre de 2026 tras T5 (binario sin Lock-In). Revisado el 14 de octubre de 2026 sobre el inventario del 9-oct (commit `0cddbbb…`), tras el pivote del 12-oct-2026 (solo cofundador) y la foto de perfil del 12-oct. Describe lo que recoge la UI actual. No certifica la configuración de producción.

## Cambios respecto a la versión anterior

- **9-nov-2026, Grupos y push:** `groups`, `group_roles`, `group_members`, `group_swipes`, `group_messages` y `push_tokens`; nombres/descripciones y perfiles buscados como contenido de usuario, swipes/pertenencia/bloqueo como interacciones, chat 1:1 y de grupo como mensajes in-app y token de Expo como identificador de dispositivo para funcionalidad, sin tracking. Detalle de acceso, payload y retención abajo.
- **2-nov-2026, Premium e idiomas:** `public.entitlements` (`premium_until`, `product_id`, `store`, `updated_at`), `like_events` (hora y tipo de cada like o Super Like) y `boosts`, todas con borrado en cascada desde `profiles`; `revenuecat_events` solo guarda el id del evento del webhook. **RevenueCat** (encargado, EE. UU.) recibe el UUID de cuenta (`logIn` en `src/lib/purchases.ts`) y los datos de la compra; las Edge Functions `sync-entitlement` y `revenuecat-webhook` escriben el estado. En `profiles`: `languages`, `seeking_languages` y `other_specialty` (`20261102120000`). Sin datos de tarjeta: cobran Apple o Google.
- Añadida la **foto de perfil**: buckets `avatar-uploads` (privado) y `avatars` (privado; se sirve con URL firmada tras moderación), columna `profiles.avatar_url`, envío a **OpenAI** (Edge Function `moderate-avatar`, falla cerrado) y permisos de galería/cámara de `expo-image-picker` (la versión anterior decía que no había permiso de fotos).
- Añadidas las tablas de **bloqueo y reporte** (migraciones `20261009224000`, `20261009231000` y `20261010120000`; D09 las da por aplicadas en producción el 10-oct y D11 decía «pendientes de aplicar»: resuelto a favor de D09, **confirmar contra producción**). Columnas completadas desde las migraciones.
- Corregido: la baja de cuenta **existe** (Ajustes > Cuenta > Eliminar mi cuenta, D09). El texto anterior («no hay flujo de baja», «Borrarlo todo» sin efecto) estaba desactualizado.
- Movidas a «inactivas» las tablas y flujos de Lock-In: `lockin_sessions`, `session_attendance`, `session_ratings`, `agreement_answers`, `lockin_rooms`, `room_members`, presencia, señalización WebRTC, vídeo/audio, STUN de Google y recordatorios locales.

## Retención

Datos de producto hasta la baja, que los borra de inmediato; backups hasta 30 días; registros de proveedores máx. 90 días; reportes máx. 12 meses con purga automática (D04).

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
| `locale` | — | Idioma de las notificaciones es/en/ca; null usa inglés. Sincronizado con el idioma de la app. | U/servidor | R2 |
| `last_active_at` | — | Última actividad aproximada, actualizada como máximo cada 15 min para evitar recordatorios tras entrar. Fallback inicial: `auth.users.last_sign_in_at`. | Servidor | R2 |
| `incoming_likes_seen_at` | — | Cuándo se abrió /likes, con o sin Premium. Define likes no vistos junto al último resumen. | Servidor | R2 |
| `last_like_digest_at`, `last_reengagement_at`, `last_premium_expiry_notice_on` | — | Marcas al aceptar Expo al menos un token, para impedir repeticiones. El reenganche con likes consume también la marca del resumen. | Servidor | R2 |
| `notify_likes`, `notify_matches`, `notify_messages`, `notify_group_messages`, `notify_group_activity`, `notify_reminders`, `notify_premium` | `NotificationPrefs` | Siete interruptores, inicialmente true; escritura solo mediante RPC de la propia cuenta. Recordatorios opcionales con oposición en Ajustes. | U/servidor | R2 |
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

### Grupos y notificaciones push

Fuentes: [Grupos](../../supabase/migrations/20261109130000_groups.sql), [edición](../../supabase/migrations/20261109140000_groups_edit.sql), [push](../../supabase/migrations/20261109150000_group_message_push.sql), [payload](../../supabase/functions/notify-group-message/logic.mjs) y [registro/baja del token](../../src/lib/push.ts).

| Tabla / campos | Qué se guarda | Quién lo ve | Retención |
| --- | --- | --- | --- |
| `groups`: `id`, `name`, `description`, `admin_id`, `max_members`, `created_at`, `updated_at` | Nombre, proyecto/descripción, admin, máximo de personas (hasta 6) y fechas | Lectura directa solo miembros; el deck expone el nombre, descripción, perfiles buscados y los perfiles públicos de miembros actuales a cuentas que buscan grupo | Mientras exista el grupo; al salir o borrar la cuenta del admin, hereda el miembro más antiguo por `joined_at`; si queda vacío, se borra |
| `group_roles`: `id`, `group_id`, `specialty`, `slots`, `filled` | Perfiles que busca el grupo: especialidad y plazas abiertas/cubiertas | Miembros; datos necesarios en el deck por RPC | Se borran con el grupo |
| `group_members`: `group_id`, `user_id`, `role_id`, `joined_at` | Pertenencia, perfil que cubre cada persona y fecha de entrada | Datos internos solo miembros; el deck entrega los identificadores necesarios para abrir perfiles públicos | Se borra al salir, ser expulsado, borrar la cuenta o borrar el grupo |
| `group_swipes`: `group_id`, `user_id`, `direction`, `decision`, `role_id`, `actor_id`, `created_at` | Like/pass en ambos sentidos y perfil que cubriría la persona; admin que deslizó | Sin lectura directa desde la app; solo funciones del servidor | Hasta borrar la cuenta o el grupo; al salir/expulsar, los likes previos se convierten en pass para evitar reentrada automática |
| `group_messages`: `id`, `group_id`, `sender_id`, `body`, `sent_at` | Texto (hasta 4000 caracteres), remitente, grupo y fecha | Solo miembros; Realtime con controles de pertenencia. El cliente oculta mensajes de personas bloqueadas; permite reportar mensajes concretos y filtra contenido básico | Se borran con el grupo o la cuenta del remitente; salir del grupo no borra por sí solo los mensajes |
| `push_tokens`: `token`, `user_id`, `platform`, `updated_at` | Token de Expo por dispositivo, cuenta, plataforma iOS/Android y fecha | Sin lectura directa desde la app; registro/baja por RPC, destinatarios solo por función de servidor | Cascada con la cuenta; baja al cerrar sesión de mejor esfuerzo; tokens `DeviceNotRegistered` del ticket de Expo se retiran |

Bloquear un grupo fija un pass definitivo y bloquea al admin. Denunciarlo crea un reporte contra el admin con el grupo anotado; los reportes y los de mensajes de grupo siguen la retención de abuso de 12 meses. El deck excluye grupos/candidaturas con bloqueos entre la persona y cualquier miembro.

**Push (ampliación preparada el 11-nov-2026, pendiente de migración y deploy):** likes no vistos, matches, mensajes 1:1 y de grupo, actividad de grupos, recordatorios opcionales con motivo y caducidad de Premium. Expo (650 Industries, EE. UU.) entrega por APNs de Apple / FCM de Google; recibe token, título, cuerpo y ruta interna/hilo. El aviso puede incluir nombre y fragmento de mensaje (hasta 140 caracteres). Los avisos de likes gratis contienen solo la cantidad: ni nombre ni foto; con Premium pueden incluir un nombre. Se excluyen remitente, bloqueos y preferencias apagadas; la app silencia la pantalla destino en foco. El permiso se pide al ver likes, crear match o entrar en grupo/chat; con permiso concedido, se registra al arrancar sin diálogo. El token se guarda en AsyncStorage (`lockin.push-token`) para retirarlo tras reiniciar y al retirar permiso/cerrar sesión.

**Baja del token:** `forgetPushTokenIfDenied` comprueba al arrancar y al volver a primer plano y da de baja el token si se retiró el permiso (resuelto en v1.8). Las operaciones de red son de mejor esfuerzo, con reintento al volver. Los recibos posteriores de Expo siguen pendientes (P2 en `docs/plan/todo/grupos.md`).

**Tablas técnicas nuevas:** `push_notice_claims` guarda cuenta, tipo, UUID de reserva, hora de selección, fecha de caducidad y si el recordatorio incluye likes; una fila por cuenta/tipo, reserva de 15 min, sustituida en el siguiente intento. `push_group_events` guarda UUID de evento/grupo/actor/persona afectada, tipo (entrada/expulsión/candidatura) y fecha, sin textos, y se purga tras 7 días mediante el job horario. Ambas sin lectura/escritura de cliente (RLS y RPC solo service_role), con cascada al borrar la cuenta; los eventos también caen con el grupo. No son analytics. Migración: `20261111160000_push_notifications.sql`; pendiente de aplicar. Zona horaria: IANA declarada en `profiles.timezone`, nunca GPS; fallback Europe/Madrid.

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
| Teléfono de contacto | Supabase Auth, raw_user_meta_data.phone_number (E.164) | Solo titular; no se publica en profiles. Opcional desde el 9-nov-2026 (antes obligatorio en el alta) | Hasta la baja |
| Huella del correo de una cuenta eliminada | public.blocked_account_emails (sha256 del correo normalizado, de auth.users y auth.identities) | Nadie desde la app; funciones SECURITY DEFINER. Impide reutilizar el correo | Sin plazo: hasta aprobar una solicitud de desbloqueo |
| Solicitud de desbloqueo (correo y motivo) | public.account_unblock_requests | Equipo, desde el editor SQL; la escribe la persona sin sesión | Sin purga automática |
| Contraseña que introduce el usuario | Se envía a Supabase Auth para alta, cambio o acceso; la app la maneja temporalmente en el formulario | Auth y titular; no hay columna de contraseña en public ni persistencia deliberada de la contraseña real en AsyncStorage | Tratamiento y conservación del verificador por el proveedor; D04/D05 pendientes |
| Email sintético y contraseña aleatoria del respaldo de dispositivo | Supabase Auth y AsyncStorage, clave lockin.supabase.device-account | App y Auth; alternativa si falla/no está habilitado el acceso anónimo | Se olvida la copia local al salir o al completar vinculación de email recuperable; no se elimina la cuenta servidor |
| Identidad OAuth de GitHub, datos devueltos por el proveedor | Supabase Auth, auth.identities; user_name origina el sello público | Titular y servicios de autenticación; handle y fecha publicados en profiles | La identidad se puede desvincular; sync_github_verification elimina handle, fecha y link_github. Sin plazo general |
| Sesión Auth, access token, refresh token y datos de usuario del SDK | Supabase Auth y AsyncStorage de la app; PKCE también usa almacenamiento del SDK | App/Auth; mantiene la sesión entre reinicios | El SDK renueva/limpia la sesión; cierre de sesión no borra filas de producto |

Decisión D05: SMTP propio gratuito antes del lanzamiento — Brevo (plan gratuito, 300 correos/día; decidido el 16-oct-2026), remitente soporte@getcofounder.app; Supabase en `eu-central-1`. Auth puede conservar más metadatos del OAuth que el handle, y así se declara en la política.


## Datos locales y técnicos activos

- `expo-secure-store` (Keystore / Keychain): sesión Auth y `lockin.supabase.device-account` (`src/data/supabase/secure-storage.ts`). Si el almacén seguro no admite la escritura, cae a AsyncStorage. En web, solo AsyncStorage (localStorage).
- AsyncStorage: claves temporales de vinculación GitHub y, en el caso descrito, la copia de reserva de la sesión.
- Expo/EAS: EAS-Client-ID, plataforma, runtime, IDs de actualización actual/incluida/fallida; IP en peticiones.
- Expo push: token en `push_tokens` y AsyncStorage (`lockin.push-token`); nombres de persona/grupo, fragmento de mensaje o cantidad de likes según tipo y Premium; identificador de dispositivo para funcionalidad, no tracking. Idioma, preferencias y actividad reciente permanecen en servidor; se declaran como datos de producto vinculados a cuenta.
- Supabase y OpenAI: IP y metadatos de peticiones en sus registros.

## Permisos (app.json, tras T5)

| Permiso | Uso visible actual | Estado |
| --- | --- | --- |
| Galería (iOS `photosPermission`) | Elegir foto de perfil | Presente |
| Cámara (`android.permission.CAMERA`, iOS `cameraPermission`) | Hacer la foto de perfil | Presente |
| Micrófono (`RECORD_AUDIO`, `NSMicrophoneUsageDescription`) | Ninguno | **Retirado** (`microphonePermission: false` en `expo-image-picker`) |
| `SCHEDULE_EXACT_ALARM` | Ninguno | **Retirado** |
| Notificaciones (`expo-notifications`) | Avisos de servicio por tipo y recordatorios opcionales con motivo | Ampliación del 11-nov preparada, no desplegada. Permiso contextual likes/match/grupo, canales traducidos y baja en Ajustes/sistema. Sin recordatorios Lock-In |

Plugins: `expo-router`, `expo-splash-screen`, `expo-image-picker`, `expo-secure-store`, `expo-notifications` y el plugin local `with-new-intent-initial-url`. `ITSAppUsesNonExemptEncryption=false` en iOS. Falta contrastar los permisos de notificaciones con el manifiesto del AAB y el Info.plist de la build con Grupos.

## Tablas y flujos inactivos (Lock-In, fuera del binario desde T5)

`lockin_sessions`, `session_attendance`, `session_ratings`, `agreement_answers`, `lockin_rooms`, `room_members`, presencia y señalización Realtime. La app publicada **no** las lee ni escribe, y WebRTC, STUN de Google y recordatorios locales no están en el binario. Siguen como tablas vacías en la base de datos de producción: las filas de prueba que había (`lockin_sessions` 4, `session_attendance` 4, `lockin_rooms` 4; lectura del 14-oct) se borraron el 16-oct-2026 a orden del usuario. El detalle columna a columna está en la versión anterior de este documento.

## Decisiones (D01–D12)

Siguen vigentes las del documento original, con estos ajustes: **D05** añade OpenAI (moderación de fotos, posible transferencia a EE. UU.); **D07** la categoría secundaria Productividad pierde su justificación; **D09** retirar declaración de SCHEDULE_EXACT_ALARM y permisos de vídeo; **D10** decidir si OpenAI es proveedor de servicios; **D11** corregir «pendientes de aplicar».
