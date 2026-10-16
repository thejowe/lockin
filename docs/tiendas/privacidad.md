# Política de privacidad de cofounder

> Revisada el 14 de octubre de 2026 tras el pivote del 12-oct-2026 (solo búsqueda de cofundador) y la foto de perfil opcional moderada con OpenAI. Antes de publicarla en la URL pública, resolver las preguntas de la nota final y actualizar la fecha de entrada en vigor.

**Versión:** 1.0.

**Entrada en vigor:** [fecha de publicación — pendiente de fijar al publicar].

## 1. Quién es responsable de tus datos

cofounder es una app para encontrar cofundador o cofundadora entre pares.

El responsable del tratamiento es **Joel de Torres Sainz de la Maza**, con domicilio en carrer Nou, 37, 25153 Lleida (Catalunya, España). Para privacidad o soporte: **cofounder.soporte@gmail.com**.

Publicamos la app en España y el resto del Espacio Económico Europeo. Se aplican el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). La autoridad de control es la Agencia Española de Protección de Datos ([aepd.es](https://www.aepd.es)); en Catalunya también puedes acudir a la Autoritat Catalana de Protecció de Dades.

## 2. Qué datos tratamos

### Tu cuenta

La app puede crear una cuenta sin pedirte un correo. Aunque el acceso sea «anónimo», se asigna un identificador de cuenta que vincula tu perfil y tu actividad.

Puedes añadir y confirmar un email y una contraseña para recuperar la cuenta desde otro dispositivo; también existen alta y acceso por email. El email no forma parte del perfil que ven otras personas.

Si verificas tu enlace de GitHub, se vincula tu identidad de GitHub y se publica el nombre de esa cuenta y la fecha de verificación junto al distintivo «GitHub verificado». El distintivo indica que el enlace de GitHub te pertenece; no acredita tu identidad ni tus conocimientos. El servicio de autenticación puede recibir otros metadatos de GitHub según la configuración del proveedor.

### Tu perfil

Guardamos el nombre y la edad que indicas, tu ciudad o zona y zona horaria, iniciales y color del avatar, especialidades que dominas y que buscas, punto de partida, disponibilidad semanal y franjas horarias, nivel de ambición, enlaces opcionales a GitHub, portfolio y LinkedIn, y tus respuestas breves a preguntas de perfil, con las fechas de creación y modificación.

La ubicación se escribe como texto; la app no usa GPS.

**Foto de perfil (opcional).** Si subes una foto, se guarda primero en un espacio privado y nuestro servidor la envía a **OpenAI** (solo la imagen, sin tu nombre ni el resto del perfil) con el único fin de comprobar que es apropiada. La revisión es automática. Solo se publica, visible para otras personas de la app, si supera esa revisión. Si el servicio de revisión no está disponible, la foto no se publica. Puedes quitarla cuando quieras y se retira al borrar tu cuenta (ver §7).

### Tu actividad y conversaciones

Guardamos tus decisiones al deslizar (te interesa o pasas), los matches mutuos y los mensajes de texto del chat, con sus participantes y fechas. También guardamos los bloqueos y reportes que hagas o recibas: quién bloquea o reporta, a quién, el motivo elegido, el texto opcional que añadas (hasta 500 caracteres) y la fecha (ver §7). Los bloqueos son visibles solo para quien bloquea; los reportes no los ve ninguna otra persona de la app.

### Datos del dispositivo y servicios técnicos

La app guarda en el dispositivo la sesión de autenticación y datos temporales para completar la vinculación de GitHub. En Android e iOS la sesión se guarda en el almacén seguro del sistema (Keystore / Keychain); en la versión web, en el almacenamiento local del navegador.

Para descargar actualizaciones, Expo/EAS recibe un identificador aleatorio de instalación, la plataforma, la versión y metadatos de actualizaciones y de posibles fallos de arranque. No es un identificador publicitario.

Los servicios de autenticación, base de datos, almacenamiento y actualizaciones reciben datos de red como la dirección IP y pueden generar registros técnicos. No los usamos para publicidad ni para elaborar perfiles.

## 3. Para qué usamos los datos y con qué base jurídica

Usamos los datos para mantener y recuperar tu cuenta, mostrar y editar tu perfil, mostrarte perfiles, resolver los intereses mutuos, permitir el chat con tus matches, verificar tu enlace de GitHub, revisar fotos de perfil, atender bloqueos y reportes y servir actualizaciones de la app. No usamos SDK de publicidad ni analítica comercial.

- **Ejecución del servicio que solicitas** (art. 6.1.b RGPD): cuenta, perfil, swipes, matches y mensajes.
- **Consentimiento** (art. 6.1.a): foto de perfil y verificación de GitHub, ambas opcionales. Puedes retirarlo quitando la foto o desvinculando GitHub.
- **Interés legítimo** (art. 6.1.f): seguridad, prevención de abusos, revisión de fotos y de reportes y operación técnica.
- **Obligación legal** (art. 6.1.c): atender requerimientos de las autoridades.

## 4. Quién puede verlos

- **Tu perfil (incluida la foto aprobada) puede verlo cualquier persona con cuenta en la app**, también las cuentas creadas sin email, no solo tus matches. No incluyas información que no quieras compartir.
- **La foto aprobada se guarda en un espacio privado y solo se sirve con enlaces temporales** (caducan en una hora) a las personas con sesión iniciada en la app; no hay una dirección pública permanente. Un enlace temporal que alguien ya tuviera sigue funcionando hasta que caduque.
- Solo tú ves tus decisiones al deslizar; el sistema las usa para detectar el interés mutuo.
- Solo las dos personas de un match ven su conversación.
- Los operadores con acceso administrativo y los proveedores pueden acceder a datos en la medida necesaria para prestar el servicio. El chat se guarda en la base de datos y no tiene cifrado de extremo a extremo.

## 5. Servicios externos y transferencias

- **Supabase** (encargado): autenticación, base de datos, almacenamiento de fotos y comunicación en tiempo real. Alojado en la región UE Centro (Fráncfort).
- **OpenAI** (encargado, EE. UU.): revisión automática de las fotos de perfil, solo si subes una. Recibe la imagen desde nuestro servidor. Es una transferencia fuera del EEE (ver más abajo). Usamos su servicio de moderación (`omni-moderation-latest`). Según la documentación pública de OpenAI (consultada el 16-oct-2026), los datos enviados a su API no se usan para entrenar sus modelos salvo que el cliente lo autorice, y el servicio de moderación no conserva el contenido para monitorización de abuso; una imagen que se detecte como material de abuso sexual infantil puede conservarse para revisión manual. Estas condiciones son las de OpenAI y pueden cambiar. [pendiente de confirmar: aceptación del acuerdo de tratamiento de datos (DPA) de OpenAI en nuestra cuenta y su mecanismo de transferencia.]
- **Expo / EAS** (encargado): distribución de actualizaciones de la app.
- **GitHub** (responsable independiente): solo si verificas tu enlace.
- **Servicio de correo de autenticación** (encargado): emails de confirmación y recuperación. [Proveedor de correo: pendiente de decidir; nombrarlo aquí.]

OpenAI trata datos fuera del Espacio Económico Europeo (EE. UU.). Esa transferencia se apoya en las cláusulas contractuales tipo de la Comisión Europea o en el Marco de Privacidad de Datos UE-EE. UU. (DPF), según el caso. Puedes pedir información sobre estas garantías en cofounder.soporte@gmail.com.

Al abrir un enlace de portfolio, GitHub o LinkedIn de otra persona, visitas un servicio externo con sus propias prácticas de privacidad.

## 6. Permisos

La app pide acceso a tu galería o a tu cámara solo si eliges añadir una foto de perfil. Puedes denegarlo y usar el avatar de iniciales. Puedes cambiar los permisos en los ajustes del dispositivo.

Para completar el perfil, la app pide nombre, edad, zona, disponibilidad y al menos una respuesta breve. Email, enlaces, foto y verificación de GitHub son opcionales.

## 7. Cuánto tiempo se conservan

Conservamos tus datos mientras tu cuenta exista. Al eliminar la cuenta desde la app (Perfil > Cuenta > Eliminar mi cuenta) se borran de inmediato tu perfil y los datos asociados. Al borrar la cuenta, el servidor elimina también tus fotos del almacenamiento (la publicada y cualquier subida pendiente), de modo que dejan de ser accesibles. Los sistemas de copia del proveedor de almacenamiento pueden conservar un residuo técnico sin enlace ni metadatos; si necesitas una confirmación de retirada, escríbenos a cofounder.soporte@gmail.com.

- **Cuentas inactivas:** nos reservamos eliminar las cuentas que lleven 24 meses sin acceso, sin aviso previo automático. Hoy no existe un proceso automático que lo haga.
- **Copias de seguridad del proveedor:** pueden conservar datos eliminados hasta 30 días más.
- **Registros técnicos** (IP, peticiones): según la configuración de cada proveedor, sin superar 90 días en nuestra operación.
- **Reportes de abuso:** se conservan como máximo 12 meses desde su creación y se borran automáticamente. Si una de las cuentas implicadas se elimina, el reporte se mantiene hasta ese plazo, con el identificador interno como referencia.
- **Fotos rechazadas o pendientes de revisión:** tras cada revisión, aprobada o rechazada, el servidor elimina el archivo de la subida pendiente. Si ese borrado fallara, una tarea programada elimina cada hora las subidas pendientes con más de 24 horas. Una foto rechazada no se publica ni se conserva.
- **Foto aprobada:** hasta que la quites o elimines la cuenta; la copia anterior se retira al sustituirla.

Al eliminar una cuenta se borran también sus matches y los mensajes de esas conversaciones, incluidos los que escribió la otra persona.

Cerrar sesión o desinstalar la app no borra los datos del servidor. Cerrar sesión puede dejar irrecuperable una cuenta sin email confirmado.

## 8. Tus derechos

Puedes editar tu perfil, quitar tu foto y desvincular GitHub (se retiran el distintivo y el enlace derivado). La app no permite editar ni borrar mensajes individuales.

Puedes eliminar tu cuenta desde la app o pedirlo en cofounder.soporte@gmail.com o en https://thejowe.github.io/lockin/eliminar-cuenta; respondemos en un máximo de 30 días. Tienes además derecho de acceso, rectificación, supresión, oposición, limitación y portabilidad, que puedes ejercer por el mismo correo, y a reclamar ante la AEPD.

## 9. Menores

cofounder es para personas de **16 años o más**. La edad es autodeclarada y no hay verificación documental ni controles parentales. Si detectamos una cuenta de una persona menor de 16 años, la eliminaremos. Si crees que ocurre, escríbenos.

## 10. Seguridad, moderación y cambios

El servidor aplica controles de acceso por cuenta y por pertenencia a un match. Las conexiones con nuestros proveedores usan TLS. No prometemos cifrado de extremo a extremo ni certificaciones de seguridad.

Puedes **bloquear y reportar** a otra persona desde la app. Revisamos los reportes y actuamos sobre el contenido o las cuentas que incumplan las [normas de la comunidad](https://thejowe.github.io/lockin/normas) y los [términos de uso](https://thejowe.github.io/lockin/terminos). Nuestros estándares de seguridad infantil están en https://thejowe.github.io/lockin/seguridad-infantil.

Si cambiamos esta política de forma relevante, lo avisaremos en la app y, si tienes email, por correo, al menos 30 días antes de que entre en vigor.

---

Nota editorial, a retirar del texto publicado:

- Se han retirado sesiones Lock-In, salas, videollamada, STUN de Google, rachas, valoraciones, acuerdo, recordatorios y alarmas exactas porque ya no están en la UI. El código y las tablas siguen en el repositorio y en la base de datos de producción, vacías: los datos de prueba de `lockin_sessions`, `session_attendance` y `lockin_rooms` se borraron el 16-oct-2026.
- **Cotejado con el código el 14-oct-2026:** los sugeridores de apertura del chat son reglas fijas, sin IA ni proveedor; la sesión se guarda con `expo-secure-store` en móvil; `expo-notifications`, WebRTC, `RECORD_AUDIO` y `SCHEDULE_EXACT_ALARM` ya no están en el binario desde T5 (no hay push ni recordatorios); `looking_for` y `active_mode` siguen escribiéndose en base de datos; `moderate-avatar` borra la subida pendiente tras cada revisión y la tarea `purge_stale_avatar_uploads()` (cada hora, aplicada en producción el 16-oct) retira las de más de 24 h; `delete_my_account` borra en servidor los objetos de la persona en `avatars` y `avatar-uploads` (límite: Supabase documenta que los bytes del backend S3 no se retiran con SQL; la dirección deja de resolver).
- **Pendiente de decidir o confirmar:** (1) condiciones de la API de OpenAI aplicables (retención, entrenamiento, DPA): no afirmar nada hasta confirmarlo; (2) ~~plazo de las fotos rechazadas o pendientes~~ resuelto: borrado tras cada revisión y purga de restos a las 24 h; (3) proveedor de correo (Resend o Brevo); (4) fecha de publicación; (5) ~~job `purge_old_user_reports()`~~ confirmado activo en producción el 16-oct (03:20 diario); (6) los plazos de revisión de reportes (72 h / 24 h) son un compromiso operativo, no una regla del código.
