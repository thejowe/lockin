# Política de privacidad de cofounder

> Revisada el 21 de octubre de 2026 (versión 1.3): los emails de cuenta pasan a enviarse con Brevo.
>
> Revisada el 20 de octubre de 2026 (versión 1.2): vía de revisión humana para las fotos que rechaza la revisión automática (art. 22 RGPD), aclaración de que las personas de 16 y 17 años son menores de edad, y retirada de la reserva de borrar cuentas inactivas, que no tiene proceso detrás.
>
> Revisada el 18 de octubre de 2026: acceso con Google y Apple, tablón personal de fotos moderado con OpenAI, enlaces a Instagram y TikTok, y envío de correo por Supabase mientras Brevo no esté configurado. Publicada ese día en la URL pública. Ese mismo día, tras aplicar `20261018120000_profiles_block_visibility` en producción, §4 vuelve a decir que el bloqueo impide ver el perfil (antes: «la app deja de mostrar»).

**Versión:** 1.3.

**Entrada en vigor:** 21 de octubre de 2026.

## 1. Quién es responsable de tus datos

cofounder es una app para encontrar cofundador o cofundadora entre pares.

El responsable del tratamiento es **Joel de Torres Sainz de la Maza**, con domicilio en carrer Nou, 37, 25153 Lleida (Catalunya, España). Para privacidad o soporte: **cofounder.soporte@gmail.com**.

Publicamos la app en España y el resto del Espacio Económico Europeo. Se aplican el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). La autoridad de control es la Agencia Española de Protección de Datos ([aepd.es](https://www.aepd.es)); en Catalunya también puedes acudir a la Autoritat Catalana de Protecció de Dades.

## 2. Qué datos tratamos

### Tu cuenta

La app puede crear una cuenta sin pedirte un correo. Aunque el acceso sea «anónimo», se asigna un identificador de cuenta que vincula tu perfil y tu actividad.

Puedes añadir y confirmar un email y una contraseña para recuperar la cuenta desde otro dispositivo; también existen alta y acceso por email. El email no forma parte del perfil que ven otras personas.

**Acceso con Google o Apple (opcional).** Si entras con Google o con Apple, ese servicio nos confirma tu email y el servicio de autenticación guarda los datos básicos que envía: con Google, tu email, tu nombre y la dirección de la foto de tu cuenta; con Apple, tu email (que puede ser una dirección de reenvío de Apple si eliges ocultarlo). Los usamos solo para identificar tu cuenta; no se publican en tu perfil.

Si verificas tu enlace de GitHub, se vincula tu identidad de GitHub y se publica el nombre de esa cuenta y la fecha de verificación junto al distintivo «GitHub verificado». El distintivo indica que el enlace de GitHub te pertenece; no acredita tu identidad ni tus conocimientos. El servicio de autenticación puede recibir otros metadatos de GitHub según la configuración del proveedor.

### Tu perfil

Guardamos el nombre y la edad que indicas, tu ciudad o zona y zona horaria, iniciales y color del avatar, especialidades que dominas y que buscas, punto de partida, disponibilidad semanal y franjas horarias, nivel de ambición, enlaces opcionales a GitHub, portfolio, LinkedIn, Instagram y TikTok, y tus respuestas breves a preguntas de perfil, con las fechas de creación y modificación.

La ubicación se escribe como texto; la app no usa GPS.

**Foto de perfil (opcional).** Si subes una foto, se guarda primero en un espacio privado y nuestro servidor la envía a **OpenAI** (solo la imagen, sin tu nombre ni el resto del perfil) con el único fin de comprobar que es apropiada. La revisión es automática. Solo se publica, visible para otras personas de la app, si supera esa revisión. Si el servicio de revisión no está disponible, la foto no se publica. Si crees que se ha rechazado por error, escríbenos a cofounder.soporte@gmail.com y una persona la revisará (ver §8). Puedes quitarla cuando quieras y se retira al borrar tu cuenta (ver §7).

**Tablón (opcional).** Puedes publicar en tu perfil hasta 12 fotos, por ejemplo de tu trabajo, cada una con un texto opcional de hasta 280 caracteres. Antes de publicarse, nuestro servidor envía la foto y su texto a **OpenAI** (sin tu nombre ni el resto del perfil) para comprobar que son apropiados; si no superan la revisión o no se puede hacer, no se publican. Si crees que se ha rechazado una foto por error, escríbenos a cofounder.soporte@gmail.com y una persona la revisará (ver §8). Puedes quitar cada foto cuando quieras.

### Tu actividad y conversaciones

Guardamos tus decisiones al deslizar (te interesa o pasas), los matches mutuos y los mensajes de texto del chat, con sus participantes y fechas. También guardamos los bloqueos y reportes que hagas o recibas: quién bloquea o reporta, a quién, el motivo elegido, el texto opcional que añadas (hasta 500 caracteres) y la fecha (ver §7). Los bloqueos son visibles solo para quien bloquea; los reportes no los ve ninguna otra persona de la app.

### Datos del dispositivo y servicios técnicos

La app guarda en el dispositivo la sesión de autenticación y datos temporales para completar la vinculación de GitHub o el acceso con Google o Apple. En Android e iOS la sesión se guarda en el almacén seguro del sistema (Keystore / Keychain); en la versión web, en el almacenamiento local del navegador.

Para descargar actualizaciones, Expo/EAS recibe un identificador aleatorio de instalación, la plataforma, la versión y metadatos de actualizaciones y de posibles fallos de arranque. No es un identificador publicitario.

Los servicios de autenticación, base de datos, almacenamiento y actualizaciones reciben datos de red como la dirección IP y pueden generar registros técnicos. No los usamos para publicidad ni para elaborar perfiles.

## 3. Para qué usamos los datos y con qué base jurídica

Usamos los datos para mantener y recuperar tu cuenta, mostrar y editar tu perfil, mostrarte perfiles, resolver los intereses mutuos, permitir el chat con tus matches, verificar tu enlace de GitHub, permitir el acceso con Google o Apple, revisar las fotos de perfil y del tablón, atender bloqueos y reportes y servir actualizaciones de la app. No usamos SDK de publicidad ni analítica comercial.

- **Ejecución del servicio que solicitas** (art. 6.1.b RGPD): cuenta, perfil, swipes, matches y mensajes.
- **Consentimiento** (art. 6.1.a): foto de perfil, fotos del tablón, verificación de GitHub y acceso con Google o Apple, todos opcionales. Puedes retirarlo quitando las fotos, desvinculando GitHub o eliminando la cuenta.
- **Interés legítimo** (art. 6.1.f): seguridad, prevención de abusos, revisión de fotos y de reportes y operación técnica.
- **Obligación legal** (art. 6.1.c): atender requerimientos de las autoridades.

## 4. Quién puede verlos

- **Tu perfil (incluidas la foto aprobada, las fotos del tablón y tus enlaces) puede verlo cualquier persona con cuenta en la app**, también las cuentas creadas sin email, no solo tus matches. No incluyas información que no quieras compartir. Si hay un bloqueo entre dos personas, en cualquier sentido, ninguna de las dos puede ver el perfil, la foto ni el tablón de la otra: no solo deja de mostrarlos la app, el servidor tampoco los entrega.
- **Las fotos aprobadas (de perfil y del tablón) se guardan en un espacio privado y solo se sirven con enlaces temporales** (caducan en una hora) a las personas con sesión iniciada en la app; no hay una dirección pública permanente. Un enlace temporal que alguien ya tuviera sigue funcionando hasta que caduque.
- Solo tú ves tus decisiones al deslizar; el sistema las usa para detectar el interés mutuo.
- Solo las dos personas de un match ven su conversación.
- Los operadores con acceso administrativo y los proveedores pueden acceder a datos en la medida necesaria para prestar el servicio. El chat se guarda en la base de datos y no tiene cifrado de extremo a extremo.

## 5. Servicios externos y transferencias

- **Supabase** (encargado): autenticación, base de datos, almacenamiento de fotos y comunicación en tiempo real. Alojado en la región UE Centro (Fráncfort).
- **OpenAI** (encargado, EE. UU.): revisión automática de las fotos de perfil y de las fotos del tablón con su texto, solo si las subes. Recibe la imagen (y, en el tablón, el texto) desde nuestro servidor. Es una transferencia fuera del EEE (ver más abajo). Usamos su servicio de moderación (`omni-moderation-latest`). Según la documentación pública de OpenAI (consultada el 16-oct-2026), los datos enviados a su API no se usan para entrenar sus modelos salvo que el cliente lo autorice, y el servicio de moderación no conserva el contenido para monitorización de abuso; una imagen que se detecte como material de abuso sexual infantil puede conservarse para revisión manual. Estas condiciones son las de OpenAI y pueden cambiar. El acuerdo de tratamiento de datos (DPA) de OpenAI forma parte de las condiciones que rigen el uso de su API.
- **Brevo** (encargado, Sendinblue SAS, Francia): envío de los emails de confirmación y recuperación de cuenta. Recibe tu dirección de email y el contenido de ese mensaje. Brevo registra, sin asociarlo a un contacto, si el email se abre y si se pulsa su enlace, y el enlace de confirmación pasa por un servidor de Brevo antes de llegar a nosotros. Pediremos a Brevo que desactive ese seguimiento y actualizaremos este punto cuando lo haga.
- **Expo / EAS** (encargado): distribución de actualizaciones de la app.
- **GitHub** (responsable independiente): solo si verificas tu enlace.
- **Google** y **Apple** (responsables independientes): solo si entras con su cuenta. Cada uno trata ese inicio de sesión según su propia política de privacidad.

OpenAI trata datos fuera del Espacio Económico Europeo (EE. UU.). Esa transferencia se apoya en las cláusulas contractuales tipo de la Comisión Europea o en el Marco de Privacidad de Datos UE-EE. UU. (DPF), según el caso. Puedes pedir información sobre estas garantías en cofounder.soporte@gmail.com.

Al abrir un enlace de portfolio, GitHub, LinkedIn, Instagram o TikTok de otra persona, visitas un servicio externo con sus propias prácticas de privacidad.

## 6. Permisos

La app pide acceso a tu galería o a tu cámara solo si eliges añadir una foto de perfil o del tablón. Puedes denegarlo y usar el avatar de iniciales. Puedes cambiar los permisos en los ajustes del dispositivo.

Para completar el perfil, la app pide nombre, edad, zona, disponibilidad y al menos una respuesta breve. Email, enlaces, foto, tablón y verificación de GitHub son opcionales.

## 7. Cuánto tiempo se conservan

Conservamos tus datos mientras tu cuenta exista. Al eliminar la cuenta desde la app (Perfil > Cuenta > Eliminar mi cuenta) se borran de inmediato tu perfil y los datos asociados. Al borrar la cuenta, el servidor intenta eliminar también tus fotos del almacenamiento (la de perfil, las del tablón y cualquier subida pendiente) y, en todo caso, dejan de ser accesibles. Si alguna de esas retiradas falla, puede quedar un archivo sin enlace ni metadatos en el almacenamiento hasta que lo retiremos, y los sistemas de copia del proveedor pueden conservar un residuo técnico; si necesitas una confirmación de retirada, escríbenos a cofounder.soporte@gmail.com.

- **Cuentas inactivas:** no las eliminamos por inactividad. Si en el futuro lo hacemos, lo indicaremos aquí con el plazo y avisaremos antes a quien tenga email.
- **Copias de seguridad del proveedor:** pueden conservar datos eliminados hasta 30 días más.
- **Registros técnicos** (IP, peticiones): según la configuración de cada proveedor, sin superar 90 días en nuestra operación.
- **Reportes de abuso:** se conservan como máximo 12 meses desde su creación y se borran automáticamente. Si una de las cuentas implicadas se elimina, el reporte se mantiene hasta ese plazo, con el identificador interno como referencia.
- **Fotos rechazadas o pendientes de revisión:** tras cada revisión, aprobada o rechazada, el servidor elimina el archivo de la subida pendiente. Si ese borrado fallara, una tarea programada elimina cada hora las subidas pendientes con más de 24 horas. Una foto rechazada no se publica ni se conserva.
- **Foto aprobada:** hasta que la quites o elimines la cuenta; la copia anterior se retira al sustituirla.
- **Fotos del tablón:** hasta que las quites o elimines la cuenta; al quitar una se borran el archivo y su texto.

Al eliminar una cuenta se borran también sus matches y los mensajes de esas conversaciones, incluidos los que escribió la otra persona.

Cerrar sesión o desinstalar la app no borra los datos del servidor. Cerrar sesión puede dejar irrecuperable una cuenta sin email confirmado.

## 8. Tus derechos

Puedes editar tu perfil, quitar tu foto y las fotos del tablón y desvincular GitHub (se retiran el distintivo y el enlace derivado). La app no permite editar ni borrar mensajes individuales.

La revisión de las fotos de perfil y del tablón es automática (§2). Tienes derecho a que una persona revise un rechazo, a expresar tu punto de vista y a impugnar la decisión: escribe a cofounder.soporte@gmail.com y respondemos en el mismo plazo de 30 días.

Puedes eliminar tu cuenta desde la app o pedirlo en cofounder.soporte@gmail.com o en https://thejowe.github.io/cofounder-web/eliminar-cuenta; respondemos en un máximo de 30 días. Tienes además derecho de acceso, rectificación, supresión, oposición, limitación y portabilidad, que puedes ejercer por el mismo correo, y a reclamar ante la AEPD.

## 9. Menores

cofounder es para personas de **16 años o más**. La edad es autodeclarada y no hay verificación documental ni controles parentales. Si detectamos una cuenta de una persona menor de 16 años, la eliminaremos. Si crees que ocurre, escríbenos.

Las personas de 16 y 17 años son menores de edad y pueden usar la app. Su perfil, como el de cualquier otra persona, es visible para cualquier cuenta de la app (ver §4), y pueden bloquear y reportar a otras personas en cualquier momento. No incluyas en tu perfil datos que no quieras que vea un adulto desconocido.

## 10. Seguridad, moderación y cambios

El servidor aplica controles de acceso por cuenta y por pertenencia a un match. Las conexiones con nuestros proveedores usan TLS. No prometemos cifrado de extremo a extremo ni certificaciones de seguridad.

Puedes **bloquear y reportar** a otra persona desde la app. Revisamos los reportes y actuamos sobre el contenido o las cuentas que incumplan las [normas de la comunidad](https://thejowe.github.io/cofounder-web/normas) y los [términos de uso](https://thejowe.github.io/cofounder-web/terminos). Nuestros estándares de seguridad infantil están en https://thejowe.github.io/cofounder-web/seguridad-infantil.

Si cambiamos esta política de forma relevante, lo avisaremos en la app y, si tienes email, por correo, al menos 30 días antes de que entre en vigor.

---

Nota editorial, a retirar del texto publicado:

- Se han retirado sesiones Lock-In, salas, videollamada, STUN de Google, rachas, valoraciones, acuerdo, recordatorios y alarmas exactas porque ya no están en la UI. El código y las tablas siguen en el repositorio y en la base de datos de producción, vacías: los datos de prueba de `lockin_sessions`, `session_attendance` y `lockin_rooms` se borraron el 16-oct-2026.
- **Cotejado con el código el 14-oct-2026:** los sugeridores de apertura del chat son reglas fijas, sin IA ni proveedor; la sesión se guarda con `expo-secure-store` en móvil; `expo-notifications`, WebRTC, `RECORD_AUDIO` y `SCHEDULE_EXACT_ALARM` ya no están en el binario desde T5 (no hay push ni recordatorios); `looking_for` y `active_mode` siguen escribiéndose en base de datos; `moderate-avatar` borra la subida pendiente tras cada revisión y la tarea `purge_stale_avatar_uploads()` (cada hora, aplicada en producción el 16-oct) retira las de más de 24 h; `delete_my_account` borra en servidor los objetos de la persona en `avatars` y `avatar-uploads` (límite: Supabase documenta que los bytes del backend S3 no se retiran con SQL; la dirección deja de resolver).
- **18-oct-2026:** publicada en `cofounder-web`. El DPA de OpenAI se cita como parte de sus condiciones (el texto de feb-2024 dice que se incorpora por referencia al acuerdo que rige la API); firmar el formulario de DPA de OpenAI sigue siendo recomendable. El SMTP de Brevo no está configurado en Supabase Auth (comprobado ese día), así que el texto nombra a Supabase como emisor del correo; al configurar Brevo, volver a nombrarlo en §5.
- **21-oct-2026 (v1.3):** SMTP de Brevo configurado en Supabase Auth y comprobado (alta de prueba entregada en bandeja de entrada). §5 nombra a Brevo y quita la frase de Supabase como emisor. El correo de prueba llevaba píxel de apertura y el enlace de confirmación reescrito por Brevo (`sendibt3.com/tr/cl/…`); en el panel solo existe «seguimiento anónimo» (activado el 21-oct), no apagarlo. §5 lo declara tal cual. Pedido a soporte de Brevo que lo apague; cuando esté apagado y comprobado en un correo real, cambiar §5 a «no se usa su seguimiento». Publicada el 21-oct en `cofounder-web` porque la 1.2 publicada nombraba a Supabase como emisor, ya falso.
- **Pendiente de decidir o confirmar:** (1) ~~condiciones de la API de OpenAI (DPA)~~ ver la línea anterior; (2) ~~plazo de las fotos rechazadas o pendientes~~ resuelto: borrado tras cada revisión y purga de restos a las 24 h; (3) ~~proveedor de correo~~ decidido el 16-oct: Brevo, remitente cofounder.soporte@gmail.com; no empujar este texto hasta que el SMTP de Brevo esté configurado en Supabase Auth; (4) ~~fecha de publicación~~ v1.2 con entrada en vigor el 20-oct-2026, pendiente de subir a `cofounder-web`; (5) ~~job `purge_old_user_reports()`~~ confirmado activo en producción el 16-oct (03:20 diario); (6) los plazos de revisión de reportes (72 h / 24 h) son un compromiso operativo, no una regla del código.
