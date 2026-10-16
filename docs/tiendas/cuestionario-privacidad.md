# cofounder — cuestionario de privacidad de las tiendas

Revisado el 15 de octubre de 2026 contra el **binario final tras T5** (commits `cf18086` y `10f4ff5`). Fuente factual: [inventario](datos-recopilados.md).

El binario enviado **ya no contiene** Lock-In (sesiones, salas, rachas, valoraciones, acuerdo), WebRTC/vídeo/audio, STUN de Google ni `expo-notifications`: se borró el código, no solo se ocultó. Por tanto no se declaran audio, vídeo de llamada, interacciones de sesión ni recordatorios. Si alguna vez se restaura Lock-In (git, commit anterior a `cf18086`), reabrir este documento antes de publicar.

### Inventario del binario final (app.json y package.json tras T5)

| Elemento | Estado | Uso |
| --- | --- | --- |
| Permisos Android declarados | solo `android.permission.CAMERA` (más `INTERNET` y los que aporten librerías: comprobar en el manifiesto del AAB, ver pendientes) | Hacer la foto de perfil |
| `RECORD_AUDIO`, `SCHEDULE_EXACT_ALARM` | **ausentes** | — |
| iOS `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` | presentes, texto «para tu foto de perfil» | Foto de perfil |
| iOS `NSMicrophoneUsageDescription` | **ausente** (`expo-image-picker` con `microphonePermission: false`) | — |
| `ITSAppUsesNonExemptEncryption` | `false` (solo HTTPS/TLS estándar del sistema) | Exportación de cifrado |
| `expo-secure-store` | presente | Sesión Auth y copia de respaldo del dispositivo en Keychain/Keystore |
| `expo-image-picker` | presente, solo galería y cámara | Foto de perfil opcional |
| `expo-updates` / EAS | presente | Actualizaciones OTA (EAS-Client-ID, plataforma, runtime) |
| `react-native-webrtc`, `expo-notifications` | **retirados** | — |
| Anuncios, analítica, SDK de terceros de seguimiento | ninguno | — |

Procesador adicional fuera del binario: la Edge Function `moderate-avatar` envía la foto a **OpenAI** (`omni-moderation-latest`) desde el servidor para moderarla antes de publicarla; la app no habla con OpenAI directamente.

## Apple — App Privacy

Fuente: [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

| Pregunta | Respuesta |
| --- | --- |
| ¿Recoge datos? | **Sí** |
| ¿Tracking? | **No**. Sin SDK publicitario, IDFA ni intermediarios de datos. No hace falta ATT |
| ¿Vinculados a la identidad? | **Sí** (el UUID de cuenta une perfil y actividad aunque la cuenta sea anónima) |
| URL de privacidad | https://thejowe.github.io/lockin/privacidad (debe estar publicada) |

| Tipo de Apple | Datos | Vinculado | Finalidad |
| --- | --- | --- | --- |
| Contact Info → Name | Nombre del perfil | Sí | App Functionality |
| Contact Info → Email Address | Email opcional de la cuenta | Sí | App Functionality |
| Location → Coarse Location | Ciudad/zona escrita por el usuario | Sí | App Functionality |
| **User Content → Photos or Videos** | **Foto de perfil opcional; se envía a OpenAI para moderarla** | Sí | App Functionality |
| User Content → Emails or Text Messages | Mensajes del chat | Sí | App Functionality |
| User Content → Other User Content | Respuestas breves, enlaces, especialidades, disponibilidad, ambición, contenido de reportes | Sí | App Functionality; Product Personalization si las especialidades ordenan el deck |
| Contacts → Contacts | Grafo de matches y bloqueos (no se importa la agenda) | Sí | App Functionality |
| Identifiers → User ID | UUID de cuenta, handle de GitHub | Sí | App Functionality |
| Identifiers → Device ID | EAS-Client-ID de expo-updates | Sí (conservador) | App Functionality |
| Usage Data → Product Interaction | Likes/pass, matches, bloqueos | Sí | App Functionality; Product Personalization (el deck excluye decisiones previas) |
| Diagnostics → Crash Data / Other Diagnostic Data | IDs de actualizaciones fallidas, plataforma/runtime (Expo) | Sí (conservador) | App Functionality |
| Other Data | Edad, zona horaria | Sí | App Functionality |

Apple considera recogidos los datos que reciben los proveedores (OpenAI, Supabase, Expo), así que no se pueden omitir por ser encargados. Ya no se declaran Audio Data ni datos de vídeo de llamada.

## Google Play — Seguridad de los datos

Fuente: [guía del formulario](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es).

| Pregunta | Respuesta |
| --- | --- |
| ¿Recoge o comparte datos? | **Sí** |
| ¿Cifrado en tránsito? | **Sí** (HTTPS/WSS a Supabase, HTTPS a Expo y OpenAI). Confirmar que la URL de Supabase de la build es `https://` |
| Métodos de creación de cuenta | Usuario y contraseña (email), OAuth (GitHub, solo para verificar), Otros (anónima) |
| ¿Eliminación de cuenta desde la app? | **Sí**: Perfil > Cuenta > Eliminar mi cuenta (aplicado en producción el 10-oct-2026 según D09; probar en la build final) |
| URL web de eliminación | https://thejowe.github.io/lockin/eliminar-cuenta (obligatoria, debe funcionar sin instalar la app) |
| ¿Revisión de seguridad independiente? | No |

| Categoría / tipo | Datos | Opcional | Finalidad |
| --- | --- | --- | --- |
| Información personal → Nombre | Nombre | Obligatorio | Funcionalidad, gestión de cuentas |
| Información personal → Dirección de correo | Email | Opcional | Gestión de cuentas |
| Información personal → IDs de usuario | UUID, handle GitHub | UUID obligatorio | Funcionalidad, gestión de cuentas |
| Información personal → Otra información | Edad, zona horaria, datos estructurados del perfil | Obligatorio | Funcionalidad |
| Ubicación → Ubicación aproximada | Ciudad/zona escrita | Obligatorio | Funcionalidad |
| **Fotos y vídeos → Fotos** | **Foto de perfil, moderada con OpenAI** | Opcional | Funcionalidad; seguridad/prevención de fraudes y abusos |
| Mensajes → Otros mensajes en la aplicación | Chat | Opcional | Funcionalidad |
| Actividad en la aplicación → Interacciones | Likes/pass, matches, bloqueos | Obligatorio | Funcionalidad |
| Actividad en la aplicación → Otro contenido generado por usuarios | Respuestas breves, enlaces, texto de reportes | Obligatorio (al menos una respuesta) | Funcionalidad; seguridad |
| Contactos | Grafo de matches | Opcional | Funcionalidad |
| Identificadores de dispositivo | EAS-Client-ID | Obligatorio | Funcionalidad |
| Información y rendimiento → Registros de fallos / Diagnóstico | Metadatos de expo-updates | Obligatorio | Funcionalidad |

**Compartidos (D10):** no se marcan como compartidos los datos que tratan Supabase, Expo y OpenAI si actúan como encargados del tratamiento por cuenta del responsable (Google exime a los proveedores de servicios). OpenAI se declara como **encargado** con transferencia fuera del EEE (CCT/DPF); no se hace ninguna afirmación sobre entrenamiento ni retención hasta confirmar sus condiciones. **Pregunta:** confirmar que las condiciones aplicables a la cuenta lo convierten en proveedor de servicios (sin uso propio de los datos). Si no, marcar Fotos como **compartidas** con finalidad «Seguridad, cumplimiento y prevención de fraudes». Lo que ve la otra persona por acción del usuario no se marca como compartido.

## Requisitos de tienda: estado

| Requisito | Estado según los docs | Pendiente |
| --- | --- | --- |
| Baja de cuenta en la app (Apple 5.1.1(v), Google) | Implementada: `delete_my_account()` + borrado previo de la foto; botón en Perfil > Cuenta. Aplicada en producción según D09; el borrado de fotos en servidor (`20261014140000`) se aplicó el 16-oct | Probar en la build final (T7), incluido que `storage.protect_delete` no bloquee el borrado y que la URL de la foto dé 404 |
| Bloquear y reportar **perfiles** y **mensajes** (Apple 1.2, UGC de Google) | Implementado en el código: `block_profile()`, `report_profile()`, `report_message` (panel de reporte de mensaje en el chat; migración `20261014130000`) | **Migración sin aplicar en producción**; probar en la build (T7) |
| Filtrado de contenido objetable (Apple 1.2) | Filtro básico es/en en cliente para bio, textos de perfil y mensajes (`src/features/safety/content-filter.ts`) + fotos moderadas con OpenAI en servidor + revisión de reportes | Describirlo como complemento, no como moderación completa (ver notas de revisor) |
| Aceptación de Términos y Normas antes de publicar (Apple 1.2) | Implementada: pantalla de aceptación con versión y fecha (`TERMS_VERSION` = 2026-10-14), puerta en onboarding, chat y foto; enlaces legales en Perfil | **Migración `20261014120000` sin aplicar en producción**; la puerta del servidor aún no existe (solo cliente, decisión 9) |
| Política y normas públicas, enlace en la app | Páginas generadas por `scripts/build-web.mjs` (privacidad, términos, normas, seguridad infantil, soporte, eliminar cuenta); enlaces en Perfil | Publicar en Pages tras cerrar los marcadores [pendiente: fecha de publicación] |
| Seguridad infantil (Google, categoría Social) | Estándares publicados en `/seguridad-infantil/` (CSAE, vía de reporte, contacto) | Completar la declaración en Play Console [pendiente: el titular acepta ser contacto designado] |
| Cadenas de permisos coherentes (Apple 5.1.1) | **Resuelto en T5:** solo cámara y galería, con textos de foto de perfil; sin micrófono | Verificar el manifiesto del AAB y el Info.plist de la build (T7) |
| Cifrado de exportación (Apple) | `ITSAppUsesNonExemptEncryption=false` | Responder «no» al cifrado propio en App Store Connect |

## Marcadores abiertos (dependen del usuario)

- [pendiente: fecha de publicación] — en privacidad, términos y normas.
- [pendiente: proveedor SMTP] — nombrarlo en la sección 5 de privacidad y en D05; hasta entonces el límite de correo de Supabase por defecto aplica.
- [pendiente: datos de titular/NIF] — razón social o persona física, NIF y dirección para el formulario de «trader» (DSA) de Apple y Google. Los docs usan hoy nombre y dirección de D01.
- [pendiente: DPA y condiciones de OpenAI] — retención, uso para entrenamiento y si actúa como encargado; no afirmar nada hasta confirmarlo. De ello depende marcar Fotos como «compartidas» en Google.
- [pendiente: categoría secundaria de App Store] — Negocios o vacía.
- [pendiente: cuenta de prueba] — credenciales para el revisor de Apple.
- Migraciones `20261014120000`, `20261014130000` y `20261014140000` aplicadas en producción el 16-oct-2026; `moderate-avatar` v2 ya estaba desplegada (confirmar que coincide con el código del repo).
- Job `purge_old_user_reports()` confirmado activo en producción (03:20 diario); también `lockin-purge-stale-avatar-uploads` (cada hora).
