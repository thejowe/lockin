# cofounder — cuestionario de privacidad de las tiendas

Revisado el 14 de octubre de 2026 tras el pivote del 12-oct-2026 y la foto de perfil moderada con OpenAI. Fuente factual: [inventario](datos-recopilados.md). Asume que el binario enviado **no** recoge datos de las funciones Lock-In ocultas (sesiones, salas, vídeo, rachas, valoraciones, acuerdo, recordatorios). Si el código sigue activo en el binario, volver a añadir esos tipos (vídeo/audio, interacciones de sesión, IP a STUN de Google).

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
| Baja de cuenta en la app (Apple 5.1.1(v), Google) | Implementada: `delete_my_account()` + `deleteAvatar` previo (mejor esfuerzo); botón en Perfil > Cuenta. Aplicada en producción según D09 | Probar en la build final; el archivo de la foto puede quedar huérfano si falla (tarea T4) |
| Bloquear y reportar **perfiles** (Apple 1.2, UGC de Google) | Implementado y comprobado en el código: `block_profile()`, `report_profile()` y panel con «Bloquear» y «Reportar» en el deck y el chat | Probar en la build. **No existe reportar un mensaje concreto** (tarea T3b) |
| Filtrado de contenido objetable (Apple 1.2) | Fotos moderadas con OpenAI; textos de perfil y chat **sin filtrar** | Tarea T3b (filtro básico) o documentar revisión de reportes (72 h / 24 h, D11) en las notas de revisión |
| Aceptación de términos/normas antes de publicar contenido (Apple 1.2) | **No existe aún en la app.** Términos, normas y seguridad infantil redactados (versión 1.0, 14-oct-2026) | Tarea T3a: aceptación obligatoria con versión y fecha. No enviar sin ella |
| Política y normas públicas, enlace en la app | Páginas generadas por `scripts/build-web.mjs` (privacidad, términos, normas, seguridad infantil, soporte, eliminar cuenta). **Sin enlaces dentro de la app aún** | Publicar en Pages y enlazar desde Perfil (T3a) |
| Seguridad infantil (Google, categoría Social) | Estándares publicados en `/seguridad-infantil/` (CSAE, vía de reporte, contacto, cumplimiento legal); contacto D11 | Completar la declaración en Play Console |
| Cadenas de permisos coherentes (Apple 5.1.1) | app.json mantiene el texto de cámara/micrófono para «la llamada de vídeo de la sesión Lock-In» (comprobado) | Retirar el plugin WebRTC; dejar solo el texto de cámara/galería para la foto (tarea T5, fuera de este bloque) |
